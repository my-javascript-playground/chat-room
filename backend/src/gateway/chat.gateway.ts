import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import {
  ChatMessage, SendChatPayload, UserListMessage, UserPresence,
  PresenceStatus, SetPresencePayload,
} from '../chat/chat.types';
import { AuthService }  from '../auth/auth.service';
import { UserService }  from '../auth/user.service';
import { ChatService }  from '../chat/chat.service';

interface ClientInfo {
  username:       string;
  socketId:       string;
  userId:         number;
  currentRoom:    number;   // which room is currently visible
  presenceStatus: PresenceStatus;
}

// Multiple sockets per username (multi-tab / multi-browser) are allowed.
// Key = socket.id
const clients    = new Map<string, ClientInfo>();

const MSG_WINDOW_MS = 5_000;
const MSG_MAX       = 10;
const rateLimits    = new Map<string, { timestamps: number[] }>();

// Grace-period timers for offline broadcast.
// When a socket disconnects we wait OFFLINE_GRACE_MS before declaring the user
// offline.  If they reconnect within the window (e.g. page refresh) we cancel
// the timer and never broadcast offline at all.
const OFFLINE_GRACE_MS = 3_000;
const offlineTimers    = new Map<number, ReturnType<typeof setTimeout>>(); // userId → timer

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly auth:    AuthService,
    private readonly users:   UserService,
    private readonly chatSvc: ChatService,
  ) {}

  // ── Public helpers (called from token.controller) ─────────────────────────

  /** Push a fresh rooms_list to every socket belonging to users in `userIds`. */
  notifyUsersRoomsUpdated(userIds?: number[]): void {
    for (const [, c] of clients) {
      if (userIds && !userIds.includes(c.userId)) continue;
      const userRooms = this.users.getUserRooms(c.userId);
      this.server.to(c.socketId).emit('rooms_list', { rooms: userRooms });
    }
  }

  /** After a join-request is approved, send 'user_joined' to that room. */
  notifyRoomJoined(roomId: number, userId: number): void {
    const user = this.users.findById(userId);
    if (!user) return;
    this._broadcastToRoomViewers(roomId, 'user_joined', {
      type: 'user_joined', username: user.username, roomId, timestamp: Date.now(),
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Emit to every socket currently VIEWING this room.
   * Used for chat messages (users who are looking at the room see them directly).
   */
  private _broadcastToRoomViewers(roomId: number, event: string, data: unknown): void {
    for (const [, c] of clients) {
      if (c.currentRoom === roomId) {
        this.server.to(c.socketId).emit(event, data);
      }
    }
  }

  /**
   * Emit to every socket of users who are APPROVED members of this room,
   * regardless of which room they're currently viewing.
   * Used for presence / join / leave notifications.
   */
  private _broadcastToRoomMembers(roomId: number, event: string, data: unknown): void {
    const memberIds = new Set(
      this.users.getRoomMembers(roomId)
        .filter(m => m.status === 'approved')
        .map(m => m.userId),
    );
    for (const [, c] of clients) {
      if (memberIds.has(c.userId)) {
        this.server.to(c.socketId).emit(event, data);
      }
    }
  }

  /**
   * Broadcast presence change to every room this user shares with others.
   * This ensures "X is now online" appears in ALL rooms the user belongs to.
   */
  private _broadcastPresenceToSharedRooms(userId: number, username: string, presenceStatus: PresenceStatus): void {
    const userRooms = this.users.getUserRooms(userId);
    const timestamp = Date.now();
    const payload   = { type: 'user_online', username, presenceStatus, timestamp };

    // Collect every approved member across all rooms this user belongs to,
    // then emit user_online to all their sockets unconditionally.
    // This ensures:
    //   (a) the "In Room" presence dot updates even for viewers currently in another room
    //   (b) globalPresence in the frontend stays accurate for DM partner dots
    const notifiedSockets = new Set<string>();
    for (const room of userRooms) {
      const memberIds = new Set(
        this.users.getRoomMembers(room.id)
          .filter(m => m.status === 'approved')
          .map(m => m.userId),
      );
      for (const [, c] of clients) {
        if (!memberIds.has(c.userId)) continue;
        if (notifiedSockets.has(c.socketId)) continue;
        this.server.to(c.socketId).emit('user_online', payload);
        notifiedSockets.add(c.socketId);
      }
    }
  }

  private _broadcastUserListToRoom(roomId: number): void {
    // Collect unique usernames currently viewing this room (one entry per user even if multi-tab)
    const seen = new Set<string>();
    const users: UserPresence[] = [];
    for (const [, c] of clients) {
      if (c.currentRoom === roomId && !seen.has(c.username)) {
        seen.add(c.username);
        users.push({ username: c.username, presenceStatus: c.presenceStatus });
      }
    }
    const payload: UserListMessage = { type: 'user_list', users };
    this._broadcastToRoomViewers(roomId, 'user_list', payload);
  }

  /**
   * After a presence change, re-emit user_list for every room the user belongs to.
   * Viewers of those rooms will see the updated dot colour immediately.
   */
  private _broadcastUserListToAllMemberRooms(userId: number): void {
    const userRooms = this.users.getUserRooms(userId);
    for (const room of userRooms) {
      this._broadcastUserListToRoom(room.id);
    }
  }

  /**
   * Build a deduplicated map of username → presenceStatus for every connected socket.
   * Used to seed the reconnecting client's globalPresence so DM dots are immediately correct.
   */
  private _buildPresenceSnapshot(): { username: string; presenceStatus: PresenceStatus }[] {
    const seen = new Map<string, PresenceStatus>();
    for (const [, c] of clients) {
      if (!seen.has(c.username)) {
        seen.set(c.username, c.presenceStatus);
      }
    }
    return Array.from(seen.entries()).map(([username, presenceStatus]) => ({ username, presenceStatus }));
  }

  private _verifyHandshake(socket: Socket): { username: string; userId: number } | null {
    try {
      const header     = socket.handshake.headers['authorization'] ?? '';
      const fromHeader = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      const fromAuth   = (socket.handshake.auth as { token?: string }).token ?? '';
      const raw        = fromHeader || fromAuth;
      if (!raw) return null;
      const payload = this.auth.verify(raw);
      const user    = this.users.findByUsername(payload.username);
      if (!user) return null;
      return { username: payload.username, userId: user.id };
    } catch { return null; }
  }

  private _checkRateLimit(socketId: string): boolean {
    const now   = Date.now();
    const entry = rateLimits.get(socketId) ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter(t => now - t < MSG_WINDOW_MS);
    if (entry.timestamps.length >= MSG_MAX) { rateLimits.set(socketId, entry); return false; }
    entry.timestamps.push(now);
    rateLimits.set(socketId, entry);
    return true;
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  handleConnection(socket: Socket): void {
    const identity = this._verifyHandshake(socket);
    if (!identity) {
      socket.emit('auth_error', { message: 'Missing or invalid auth token.' });
      socket.disconnect(true);
      return;
    }

    const { username, userId } = identity;
    // FIX 2: Multiple sessions allowed — removed duplicate-username check.

    const userRooms   = this.users.getUserRooms(userId);
    const generalRoom = this.users.findRoomByName('general');
    const defaultRoom = userRooms[0] ?? generalRoom;

    if (!defaultRoom) {
      socket.emit('auth_error', { message: 'No accessible room found.' });
      socket.disconnect(true);
      return;
    }

    clients.set(socket.id, {
      username,
      socketId:       socket.id,
      userId,
      currentRoom:    defaultRoom.id,
      presenceStatus: 'online',
    });

    console.log(`[+] ${username} connected (${socket.id})`);

    // Check if this is a reconnect within the grace window (e.g. page refresh).
    // If so: cancel the pending offline timer AND skip re-broadcasting online —
    // other users never saw offline, so announcing online again is redundant noise.
    const pendingOffline = offlineTimers.get(userId);
    const isReconnect    = !!pendingOffline;
    if (pendingOffline) {
      clearTimeout(pendingOffline);
      offlineTimers.delete(userId);
      console.log(`[~] ${username} reconnected within grace period — online/offline suppressed`);
    }

    socket.emit('rooms_list',   { rooms: userRooms });
    socket.emit('history',      { type: 'history', messages: this.chatSvc.getRecentMessages(defaultRoom.id), roomId: defaultRoom.id });
    socket.emit('room_changed', { roomId: defaultRoom.id, roomName: defaultRoom.name });

    // Send a full presence snapshot so the reconnecting client can seed globalPresence
    // for ALL online users, not just those in the current room. Without this, users
    // in other rooms would show as offline in the DM list after a page refresh.
    const snapshot = this._buildPresenceSnapshot();
    socket.emit('presence_snapshot', { users: snapshot });

    // Only broadcast online on a fresh first connection, not on a silent reconnect.
    if (!isReconnect) {
      this._broadcastPresenceToSharedRooms(userId, username, 'online');
    }
    // Always refresh the user_list for the default room so the dot appears.
    this._broadcastUserListToAllMemberRooms(userId);
  }

  // ── Disconnection ──────────────────────────────────────────────────────────

  handleDisconnect(socket: Socket): void {
    const client = clients.get(socket.id);
    rateLimits.delete(socket.id);
    if (!client) return;

    clients.delete(socket.id);
    console.log(`[-] ${client.username} disconnected (${socket.id})`);

    this._broadcastUserListToRoom(client.currentRoom);

    // Only broadcast offline if this was their LAST socket.
    // We use a short grace period so that a page refresh (disconnect → reconnect
    // within ~1-2 s) does not flash an offline/online notification to other users.
    const hasOtherSockets = [...clients.values()].some(c => c.userId === client.userId);
    if (!hasOtherSockets) {
      // Cancel any existing timer for this user (shouldn't normally exist, but be safe)
      const existing = offlineTimers.get(client.userId);
      if (existing) clearTimeout(existing);

      const { userId, username } = client;
      const timer = setTimeout(() => {
        offlineTimers.delete(userId);
        // Double-check they haven't reconnected during the grace period
        const reconnected = [...clients.values()].some(c => c.userId === userId);
        if (!reconnected) {
          this._broadcastPresenceToSharedRooms(userId, username, 'offline');
          this._broadcastUserListToAllMemberRooms(userId);
        }
      }, OFFLINE_GRACE_MS);
      offlineTimers.set(userId, timer);
    }
  }

  // ── Set presence ───────────────────────────────────────────────────────────

  @SubscribeMessage('set_presence')
  handleSetPresence(@ConnectedSocket() socket: Socket, @MessageBody() payload: SetPresencePayload): void {
    const client = clients.get(socket.id);
    if (!client) return;

    const allowed: PresenceStatus[] = ['online', 'away', 'offline'];
    if (!allowed.includes(payload.status)) return;

    client.presenceStatus = payload.status;
    // FIX 1: Broadcast to ALL shared rooms.
    this._broadcastPresenceToSharedRooms(client.userId, client.username, payload.status);
    this._broadcastUserListToAllMemberRooms(client.userId);
  }

  // ── Exit room (un-join) ────────────────────────────────────────────────────

  @SubscribeMessage('exit_room')
  handleExitRoom(@ConnectedSocket() socket: Socket, @MessageBody() payload: { roomId: number }): void {
    const client = clients.get(socket.id);
    if (!client) return;

    const room = this.users.findRoomById(payload.roomId);
    if (!room) { socket.emit('error_msg', { message: 'Room not found.' }); return; }

    // FIX 3: Prevent exiting the general room entirely
    if (room.name.toLowerCase() === 'general') {
      socket.emit('error_msg', { message: 'You cannot leave the general room.' });
      return;
    }

    // FIX 4: Actually remove from room_members so it persists across reconnects.
    const removed = this.users.rejectJoinRequest(payload.roomId, client.userId);
    // rejectJoinRequest only removes 'pending', so also handle 'approved' members
    if (!removed) {
      // Remove approved member record
      this.users.removeRoomMember(payload.roomId, client.userId);
    }

    // Notify remaining members of the left room
    this._broadcastToRoomMembers(payload.roomId, 'user_exited_room', {
      type: 'user_exited_room', username: client.username, roomId: payload.roomId, timestamp: Date.now(),
    });

    // Notify every socket currently VIEWING the left room to remove this user
    // from their In Room list. We use a dedicated event so it does NOT touch
    // globalPresence — the user's actual presence status (for DMs etc.) is unchanged.
    for (const [, c] of clients) {
      if (c.currentRoom === payload.roomId) {
        this.server.to(c.socketId).emit('user_removed_from_room', {
          username: client.username, roomId: payload.roomId,
        });
      }
    }

    // Move this user's current room if they were viewing the exited one
    if (client.currentRoom === payload.roomId) {
      const remaining = this.users.getUserRooms(client.userId);
      const nextRoom  = remaining[0];
      if (nextRoom) {
        client.currentRoom = nextRoom.id;
        socket.emit('history',      { type: 'history', messages: this.chatSvc.getRecentMessages(nextRoom.id), roomId: nextRoom.id });
        socket.emit('room_changed', { roomId: nextRoom.id, roomName: nextRoom.name });
        this._broadcastUserListToRoom(nextRoom.id);
      }
    }

    // Push updated room list to this user (room is now gone)
    const updatedRooms = this.users.getUserRooms(client.userId);
    socket.emit('rooms_list',  { rooms: updatedRooms });
    socket.emit('room_exited', { roomId: payload.roomId });

    this._broadcastUserListToRoom(payload.roomId);
  }

  // ── Switch room ────────────────────────────────────────────────────────────

  @SubscribeMessage('switch_room')
  handleSwitchRoom(@ConnectedSocket() socket: Socket, @MessageBody() payload: { roomId: number }): void {
    const client = clients.get(socket.id);
    if (!client) return;

    const room   = this.users.findRoomById(payload.roomId);
    if (!room) { socket.emit('error_msg', { message: 'Room not found.' }); return; }

    const member = this.users.getRoomMember(room.id, client.userId);
    if (!member || member.status !== 'approved') {
      socket.emit('error_msg', { message: 'You are not a member of this room.' });
      return;
    }

    const oldRoomId    = client.currentRoom;
    client.currentRoom = room.id;

    this._broadcastUserListToRoom(oldRoomId);
    socket.emit('history',      { type: 'history', messages: this.chatSvc.getRecentMessages(room.id), roomId: room.id });
    socket.emit('room_changed', { roomId: room.id, roomName: room.name });
    this._broadcastUserListToRoom(room.id);
  }

  // ── Chat message ───────────────────────────────────────────────────────────

  @SubscribeMessage('chat')
  handleChat(@ConnectedSocket() socket: Socket, @MessageBody() payload: SendChatPayload): void {
    const client = clients.get(socket.id);
    if (!client) return;

    if (!this._checkRateLimit(socket.id)) {
      socket.emit('error_msg', { message: 'Rate limit exceeded.' });
      return;
    }

    const text = (payload.text ?? '').trim().slice(0, 500);
    if (!text) return;

    const mentionMatches = [...text.matchAll(/@([\w-]{1,24})/g)];
    const mentions       = mentionMatches.map(m => m[1]);

    const msg: ChatMessage = {
      type: 'chat', id: randomUUID(), username: client.username,
      text, timestamp: Date.now(),
      mentions: mentions.length ? mentions : undefined,
    };

    this.chatSvc.saveMessage(client.currentRoom, msg);

    // FIX 5: Send to viewers directly; send room_msg (with roomId) to non-viewers for unread badge.
    const roomId = client.currentRoom;
    const memberIds = new Set(
      this.users.getRoomMembers(roomId)
        .filter(m => m.status === 'approved')
        .map(m => m.userId),
    );

    for (const [, c] of clients) {
      if (!memberIds.has(c.userId)) continue;
      if (c.currentRoom === roomId) {
        // User is actively viewing this room → send the full chat event
        this.server.to(c.socketId).emit('chat', msg);
      } else {
        // User is a member but viewing another room → send room_msg for unread badge
        this.server.to(c.socketId).emit('room_msg', { roomId, msg });
      }
    }

    // @mention notifications for users who are online in another room
    if (mentions.length) {
      for (const [, c] of clients) {
        if (c.username === client.username) continue;
        if (mentions.includes(c.username) && c.currentRoom !== roomId) {
          this.server.to(c.socketId).emit('mention', {
            ...msg, roomId,
            roomName: this.users.findRoomById(roomId)?.name ?? '',
          });
        }
      }
    }
  }

  // ── Direct message ─────────────────────────────────────────────────────────

  @SubscribeMessage('dm')
  handleDm(@ConnectedSocket() socket: Socket, @MessageBody() payload: { to: string; text: string }): void {
    const client = clients.get(socket.id);
    if (!client) return;

    if (!this._checkRateLimit(socket.id)) {
      socket.emit('error_msg', { message: 'Rate limit exceeded.' });
      return;
    }

    const toUser = this.users.findByUsername(payload.to);
    if (!toUser) { socket.emit('error_msg', { message: `User "${payload.to}" not found.` }); return; }
    if (toUser.username === client.username) { socket.emit('error_msg', { message: 'Cannot DM yourself.' }); return; }

    const text = (payload.text ?? '').trim().slice(0, 500);
    if (!text) return;

    const dm = this.chatSvc.saveDm(client.username, toUser.username, text);

    // Echo to sender
    socket.emit('dm_msg', dm);

    // Deliver to ALL sockets of the recipient
    for (const [, c] of clients) {
      if (c.username === toUser.username) {
        this.server.to(c.socketId).emit('dm_msg', dm);
      }
    }
  }

  @SubscribeMessage('dm_history')
  handleDmHistory(@ConnectedSocket() socket: Socket, @MessageBody() payload: { with: string }): void {
    const client = clients.get(socket.id);
    if (!client) return;
    const history = this.chatSvc.getDmHistory(client.username, payload.with);
    socket.emit('dm_history', { with: payload.with, messages: history });
  }
}

import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import { ChatMessage, SendChatPayload, UserListMessage } from '../chat/chat.types';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../auth/user.service';

// ── In-memory state ──────────────────────────────────────────────────────────
interface ClientInfo { username: string; socketId: string; userId: number; currentRoom: number; }
const clients = new Map<string, ClientInfo>();

// Per-room history
const roomHistory = new Map<number, ChatMessage[]>();
const MAX_HISTORY = 50;

const MSG_WINDOW_MS = 5_000;
const MSG_MAX = 10;
const rateLimits = new Map<string, { timestamps: number[] }>();

@WebSocketGateway({ cors: { origin: 'http://localhost:3000', credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly users: UserService,
  ) {}

  private getHistory(roomId: number): ChatMessage[] {
    if (!roomHistory.has(roomId)) roomHistory.set(roomId, []);
    return roomHistory.get(roomId)!;
  }

  private saveToHistory(roomId: number, msg: ChatMessage): void {
    const hist = this.getHistory(roomId);
    hist.push(msg);
    if (hist.length > MAX_HISTORY) hist.shift();
  }

  private getRoomSocketIds(roomId: number): string[] {
    return [...clients.values()].filter(c => c.currentRoom === roomId).map(c => c.socketId);
  }

  private broadcastToRoom(roomId: number, event: string, data: any): void {
    const ids = this.getRoomSocketIds(roomId);
    for (const id of ids) this.server.to(id).emit(event, data);
  }

  private broadcastUserListToRoom(roomId: number): void {
    const users = [...clients.values()].filter(c => c.currentRoom === roomId).map(c => c.username);
    const payload: UserListMessage = { type: 'user_list', users };
    this.broadcastToRoom(roomId, 'user_list', payload);
  }

  private verifyHandshake(socket: Socket): { username: string; userId: number } | null {
    try {
      const header = socket.handshake.headers['authorization'] ?? '';
      const fromHeader = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      const fromAuth = (socket.handshake.auth as { token?: string }).token ?? '';
      const raw = fromHeader || fromAuth;
      if (!raw) return null;
      const payload = this.auth.verify(raw);
      const user = this.users.findByUsername(payload.username);
      if (!user) return null;
      return { username: payload.username, userId: user.id };
    } catch { return null; }
  }

  private checkRateLimit(socketId: string): boolean {
    const now = Date.now();
    const entry = rateLimits.get(socketId) ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter(t => now - t < MSG_WINDOW_MS);
    if (entry.timestamps.length >= MSG_MAX) { rateLimits.set(socketId, entry); return false; }
    entry.timestamps.push(now);
    rateLimits.set(socketId, entry);
    return true;
  }

  handleConnection(socket: Socket): void {
    const identity = this.verifyHandshake(socket);
    if (!identity) {
      socket.emit('auth_error', { message: 'Missing or invalid auth token.' });
      socket.disconnect(true);
      return;
    }

    const { username, userId } = identity;
    const duplicate = [...clients.values()].find(c => c.username === username);
    if (duplicate) {
      socket.emit('auth_error', { message: 'Username already connected.' });
      socket.disconnect(true);
      return;
    }

    // Get user's approved rooms; default to general
    const userRooms = this.users.getUserRooms(userId);
    const generalRoom = this.users.findRoomByName('general');
    const defaultRoom = userRooms[0] ?? generalRoom;
    if (!defaultRoom) {
      socket.emit('auth_error', { message: 'No accessible room found.' });
      socket.disconnect(true);
      return;
    }

    clients.set(socket.id, { username, socketId: socket.id, userId, currentRoom: defaultRoom.id });

    // Send rooms list
    socket.emit('rooms_list', { rooms: userRooms });
    // Send history of current room
    socket.emit('history', { type: 'history', messages: this.getHistory(defaultRoom.id), roomId: defaultRoom.id });
    socket.emit('room_changed', { roomId: defaultRoom.id, roomName: defaultRoom.name });
    socket.broadcast.emit('user_joined', { type: 'user_joined', username, timestamp: Date.now() });
    this.broadcastUserListToRoom(defaultRoom.id);
    console.log(`[+] ${username} connected to #${defaultRoom.name}`);
  }

  handleDisconnect(socket: Socket): void {
    const client = clients.get(socket.id);
    rateLimits.delete(socket.id);
    if (!client) return;
    const roomId = client.currentRoom;
    clients.delete(socket.id);
    this.server.emit('user_left', { type: 'user_left', username: client.username, timestamp: Date.now() });
    this.broadcastUserListToRoom(roomId);
    console.log(`[-] ${client.username} disconnected`);
  }

  @SubscribeMessage('chat')
  handleChat(@ConnectedSocket() socket: Socket, @MessageBody() payload: SendChatPayload): void {
    const client = clients.get(socket.id);
    if (!client) return;
    if (!this.checkRateLimit(socket.id)) { socket.emit('error_msg', { message: 'Rate limit exceeded.' }); return; }
    const text = (payload.text ?? '').trim().slice(0, 500);
    if (!text) return;
    const msg: ChatMessage = { type: 'chat', id: randomUUID(), username: client.username, text, timestamp: Date.now() };
    this.saveToHistory(client.currentRoom, msg);
    this.broadcastToRoom(client.currentRoom, 'chat', msg);
  }

  @SubscribeMessage('switch_room')
  async handleSwitchRoom(@ConnectedSocket() socket: Socket, @MessageBody() payload: { roomId: number }): Promise<void> {
    const client = clients.get(socket.id);
    if (!client) return;
    const room = this.users.findRoomById(payload.roomId);
    if (!room) { socket.emit('error_msg', { message: 'Room not found.' }); return; }

    // Check membership
    const member = this.users.getRoomMember(room.id, client.userId);
    if (!member || member.status !== 'approved') {
      socket.emit('error_msg', { message: 'You are not a member of this room.' }); return;
    }

    const oldRoomId = client.currentRoom;
    client.currentRoom = room.id;

    this.broadcastUserListToRoom(oldRoomId);
    socket.emit('history', { type: 'history', messages: this.getHistory(room.id), roomId: room.id });
    socket.emit('room_changed', { roomId: room.id, roomName: room.name });
    this.broadcastUserListToRoom(room.id);
  }
}

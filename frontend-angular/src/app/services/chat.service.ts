import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import {
  MessageItem, ChatMessage, ConnectionStatus, Room,
  UserPresence, PresenceStatus, MentionNotification,
  DmMessage, DmConversation,
} from '../models/chat.models';
import { environment } from '../../environments/environment';

const MAX_HISTORY = 200;

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function dismissedKey(u: string) { return `chatroom_dm_dismissed:${u}`; }
function loadDismissed(u: string): Set<string> {
  try {
    const raw = localStorage.getItem(dismissedKey(u));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}
function saveDismissed(u: string, s: Set<string>) {
  localStorage.setItem(dismissedKey(u), JSON.stringify([...s]));
}

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private _messages        = new BehaviorSubject<MessageItem[]>([]);
  private _users           = new BehaviorSubject<UserPresence[]>([]);
  private _status          = new BehaviorSubject<ConnectionStatus>('connecting');
  private _rooms           = new BehaviorSubject<Room[]>([]);
  private _currentRoom     = new BehaviorSubject<Room | null>(null);
  private _unreadCounts    = new BehaviorSubject<Record<number, number>>({});
  private _mentions        = new BehaviorSubject<MentionNotification[]>([]);
  private _presenceStatus  = new BehaviorSubject<PresenceStatus>('online');
  private _dmMessages      = new BehaviorSubject<Record<string, DmMessage[]>>({});
  private _dmConversations = new BehaviorSubject<DmConversation[]>([]);
  private _dmUnread        = new BehaviorSubject<Record<string, number>>({});
  private _activeDm        = new BehaviorSubject<string | null>(null);
  private _globalPresence  = new BehaviorSubject<Map<string, PresenceStatus>>(new Map());

  messages$        = this._messages.asObservable();
  users$           = this._users.asObservable();
  status$          = this._status.asObservable();
  rooms$           = this._rooms.asObservable();
  currentRoom$     = this._currentRoom.asObservable();
  unreadCounts$    = this._unreadCounts.asObservable();
  mentions$        = this._mentions.asObservable();
  presenceStatus$  = this._presenceStatus.asObservable();
  dmMessages$      = this._dmMessages.asObservable();
  dmConversations$ = this._dmConversations.asObservable();
  dmUnread$        = this._dmUnread.asObservable();
  activeDm$        = this._activeDm.asObservable();
  globalPresence$  = this._globalPresence.asObservable();

  // Synchronous getters for templates
  get messages()        { return this._messages.value; }
  get users()           { return this._users.value; }
  get status()          { return this._status.value; }
  get rooms()           { return this._rooms.value; }
  get currentRoom()     { return this._currentRoom.value; }
  get unreadCounts()    { return this._unreadCounts.value; }
  get mentions()        { return this._mentions.value; }
  get presenceStatus()  { return this._presenceStatus.value; }
  get dmMessages()      { return this._dmMessages.value; }
  get dmConversations() { return this._dmConversations.value; }
  get dmUnread()        { return this._dmUnread.value; }
  get activeDm()        { return this._activeDm.value; }
  get globalPresence()  { return this._globalPresence.value; }

  private socket: Socket | null = null;
  private currentRoomId: number | null = null;
  private currentActiveDm: string | null = null;
  private dismissed = new Set<string>();
  private username = '';
  private onAuthError?: () => void;

  connect(token: string, username: string, onAuthError: () => void): void {
    if (this.socket?.connected) return;
    this.username     = username;
    this.onAuthError  = onAuthError;
    this.dismissed    = loadDismissed(username);

    const socket: Socket = io(environment.serverUrl, {
      auth:                 { token },
      extraHeaders:         { Authorization: `Bearer ${token}` },
      transports:           ['websocket'],
      reconnectionDelay:    500,
      reconnectionDelayMax: 30_000,
      reconnectionAttempts: Infinity,
    });
    this.socket = socket;

    socket.on('connect', () => {
      this._status.next('connected');
      fetch(`${environment.serverUrl}/auth/dm/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : [])
        .then((convos: DmConversation[]) => {
          const visible = convos.filter(c => !this.dismissed.has(c.partner));
          if (visible.length) {
            this._dmConversations.next(visible);
            visible.forEach(c => socket.emit('dm_history', { with: c.partner }));
          }
        })
        .catch(() => {});
    });

    socket.on('disconnect',    () => this._status.next('disconnected'));
    socket.on('connect_error', () => this._status.next('error'));

    socket.on('presence_snapshot', (data: { users: { username: string; presenceStatus: PresenceStatus }[] }) => {
      const next = new Map<string, PresenceStatus>();
      data.users.forEach(u => next.set(u.username, u.presenceStatus));
      this._globalPresence.next(next);
    });

    socket.on('auth_error', () => {
      this._status.next('error');
      socket.disconnect();
      this.onAuthError?.();
    });

    socket.on('rooms_list', (data: { rooms: Room[] }) => this._rooms.next(data.rooms));

    socket.on('room_changed', (data: { roomId: number; roomName: string }) => {
      const prev = this._currentRoom.value;
      this._currentRoom.next({
        ...(prev ?? { createdBy: 0, createdAt: 0 }),
        id: data.roomId, name: data.roomName,
      });
      this.currentRoomId = data.roomId;
    });

    socket.on('history', (data: { messages: ChatMessage[] }) => {
      this._messages.next(data.messages.map(m => ({ ...m, kind: 'chat' as const })));
    });

    socket.on('chat', (msg: ChatMessage) => {
      this.pushMessage({ ...msg, kind: 'chat' });
    });

    socket.on('room_msg', (data: { roomId: number }) => {
      const uc = this._unreadCounts.value;
      this._unreadCounts.next({ ...uc, [data.roomId]: (uc[data.roomId] ?? 0) + 1 });
    });

    socket.on('user_joined', (data: { username: string; roomId: number }) => {
      if (data.roomId === this.currentRoomId) this.pushSystem(`${data.username} joined the room`);
    });

    socket.on('user_exited_room', (data: { username: string; roomId: number }) => {
      if (data.roomId === this.currentRoomId) this.pushSystem(`${data.username} left the room`);
    });

    socket.on('user_online', (data: { username: string; presenceStatus: PresenceStatus }) => {
      const label = data.presenceStatus === 'online' ? 'is now online'
                  : data.presenceStatus === 'away'   ? 'is now away' : 'went offline';
      this.pushSystem(`${data.username} ${label}`);
      const gp = new Map(this._globalPresence.value);
      gp.set(data.username, data.presenceStatus);
      this._globalPresence.next(gp);
      this._users.next(
        this._users.value.map(u =>
          u.username === data.username ? { ...u, presenceStatus: data.presenceStatus } : u
        )
      );
    });

    socket.on('user_list', (data: { users: UserPresence[] }) => {
      this._users.next(data.users);
      const gp = new Map(this._globalPresence.value);
      data.users.forEach(u => gp.set(u.username, u.presenceStatus));
      this._globalPresence.next(gp);
    });

    socket.on('mention', (data: MentionNotification) => {
      this._mentions.next([...this._mentions.value, data]);
    });

    socket.on('user_removed_from_room', (data: { username: string }) => {
      this._users.next(this._users.value.filter(u => u.username !== data.username));
    });

    socket.on('room_exited', (data: { roomId: number }) => {
      this._rooms.next(this._rooms.value.filter(r => r.id !== data.roomId));
      const uc = { ...this._unreadCounts.value };
      delete uc[data.roomId];
      this._unreadCounts.next(uc);
    });

    socket.on('error_msg', (data: { message: string }) => this.pushSystem(`⚠ ${data.message}`));

    socket.on('dm_msg', (msg: DmMessage) => {
      const key = msg.from === username ? msg.to : msg.from;
      const prev = this._dmMessages.value;
      const existing = prev[key] ?? [];
      if (!existing.some(m => m.id === msg.id)) {
        this._dmMessages.next({ ...prev, [key]: [...existing, msg] });
      }
      if (this.dismissed.has(key)) {
        this.dismissed.delete(key);
        saveDismissed(username, this.dismissed);
      }
      const convos = this._dmConversations.value;
      const updated: DmConversation = { partner: key, lastMessage: msg.text, lastAt: msg.timestamp };
      if (convos.find(c => c.partner === key)) {
        this._dmConversations.next(
          convos.map(c => c.partner === key ? updated : c).sort((a, b) => b.lastAt - a.lastAt)
        );
      } else {
        this._dmConversations.next([updated, ...convos]);
      }
      if (this.currentActiveDm !== key) {
        const du = this._dmUnread.value;
        this._dmUnread.next({ ...du, [key]: (du[key] ?? 0) + 1 });
      }
    });

    socket.on('dm_history', (data: { with: string; messages: DmMessage[] }) => {
      this._dmMessages.next({ ...this._dmMessages.value, [data.with]: data.messages });
    });
  }

  private pushMessage(item: MessageItem): void {
    const prev = this._messages.value;
    const next = [...prev, item];
    this._messages.next(next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next);
  }

  private pushSystem(text: string): void {
    this.pushMessage({ kind: 'system', id: uuid(), text, timestamp: Date.now() });
  }

  sendMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || !this.socket?.connected) return;
    const mentions = [...trimmed.matchAll(/@([\w-]{1,24})/g)].map(m => m[1]);
    this.socket.emit('chat', { text: trimmed, mentions: mentions.length ? mentions : undefined });
  }

  switchRoom(roomId: number): void {
    if (this.socket?.connected) this.socket.emit('switch_room', { roomId });
  }

  exitRoom(roomId: number): void {
    if (this.socket?.connected) this.socket.emit('exit_room', { roomId });
  }

  setPresence(status: PresenceStatus): void {
    this._presenceStatus.next(status);
    this.socket?.emit('set_presence', { status });
  }

  clearMention(id: string): void {
    this._mentions.next(this._mentions.value.filter(m => m.id !== id));
  }

  markRoomRead(roomId: number): void {
    const uc = { ...this._unreadCounts.value };
    delete uc[roomId];
    this._unreadCounts.next(uc);
  }

  sendDm(to: string, text: string): void {
    const trimmed = text.trim();
    if (!trimmed || !this.socket?.connected) return;
    this.socket.emit('dm', { to, text: trimmed });
  }

  openDm(partner: string): void {
    this.currentActiveDm = partner;
    this._activeDm.next(partner);
    const du = { ...this._dmUnread.value };
    delete du[partner];
    this._dmUnread.next(du);
    this.socket?.emit('dm_history', { with: partner });
  }

  closeDm(): void {
    this.currentActiveDm = null;
    this._activeDm.next(null);
  }

  closeDmConversation(partner: string): void {
    this._dmConversations.next(this._dmConversations.value.filter(c => c.partner !== partner));
    const dms = { ...this._dmMessages.value };
    delete dms[partner];
    this._dmMessages.next(dms);
    const du = { ...this._dmUnread.value };
    delete du[partner];
    this._dmUnread.next(du);
    if (this.currentActiveDm === partner) this.closeDm();
    this.dismissed.add(partner);
    saveDismissed(this.username, this.dismissed);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this._messages.next([]);
    this._users.next([]);
    this._status.next('connecting');
    this._rooms.next([]);
    this._currentRoom.next(null);
    this._unreadCounts.next({});
    this._mentions.next([]);
    this._presenceStatus.next('online');
    this._dmMessages.next({});
    this._dmConversations.next([]);
    this._dmUnread.next({});
    this._activeDm.next(null);
    this._globalPresence.next(new Map());
    this.currentRoomId    = null;
    this.currentActiveDm  = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}

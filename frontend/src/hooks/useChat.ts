'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  MessageItem, ChatMessage, ConnectionStatus, Room,
  UserPresence, PresenceStatus, MentionNotification,
  DmMessage, DmConversation,
} from '@/types/chat';

const SERVER_URL  = 'http://localhost:8080';
const MAX_HISTORY = 200;

interface UseChatOptions {
  token:        string;
  username:     string;
  enabled:      boolean;
  onAuthError?: () => void;
}

interface UseChatReturn {
  messages:         MessageItem[];
  users:            UserPresence[];
  status:           ConnectionStatus;
  currentRoom:      Room | null;
  rooms:            Room[];
  unreadCounts:     Record<number, number>;       // roomId → count
  mentions:         MentionNotification[];
  presenceStatus:   PresenceStatus;
  // DM state
  dmMessages:       Record<string, DmMessage[]>;  // partner → messages
  dmConversations:  DmConversation[];
  dmUnread:         Record<string, number>;        // partner → unread count
  activeDm:         string | null;                // currently open DM partner
  // Actions
  sendMessage:      (text: string) => void;
  switchRoom:       (roomId: number) => void;
  exitRoom:         (roomId: number) => void;
  setPresence:      (status: PresenceStatus) => void;
  clearMention:     (id: string) => void;
  markRoomRead:     (roomId: number) => void;
  sendDm:           (to: string, text: string) => void;
  openDm:           (partner: string) => void;
  closeDm:          () => void;
  markDmRead:       (partner: string) => void;
  disconnect:       () => void;
}

export function useChat({ token, username, enabled, onAuthError }: UseChatOptions): UseChatReturn {
  const [messages,        setMessages]        = useState<MessageItem[]>([]);
  const [users,           setUsers]           = useState<UserPresence[]>([]);
  const [status,          setStatus]          = useState<ConnectionStatus>('connecting');
  const [rooms,           setRooms]           = useState<Room[]>([]);
  const [currentRoom,     setCurrentRoom]     = useState<Room | null>(null);
  const [unreadCounts,    setUnreadCounts]    = useState<Record<number, number>>({});
  const [mentions,        setMentions]        = useState<MentionNotification[]>([]);
  const [presenceStatus,  setPresenceStatus]  = useState<PresenceStatus>('online');
  const [dmMessages,      setDmMessages]      = useState<Record<string, DmMessage[]>>({});
  const [dmConversations, setDmConversations] = useState<DmConversation[]>([]);
  const [dmUnread,        setDmUnread]        = useState<Record<string, number>>({});
  const [activeDm,        setActiveDm]        = useState<string | null>(null);

  const socketRef      = useRef<Socket | null>(null);
  const currentRoomRef = useRef<number | null>(null);
  const activeDmRef    = useRef<string | null>(null);

  useEffect(() => { currentRoomRef.current = currentRoom?.id ?? null; }, [currentRoom]);
  useEffect(() => { activeDmRef.current = activeDm; }, [activeDm]);

  const pushMessage = useCallback((item: MessageItem) => {
    setMessages(prev => {
      const next = [...prev, item];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
  }, []);

  const pushSystem = useCallback((text: string) => {
    pushMessage({ kind: 'system', id: crypto.randomUUID(), text, timestamp: Date.now() });
  }, [pushMessage]);

  useEffect(() => {
    if (!enabled || !token) return;

    const socket: Socket = io(SERVER_URL, {
      auth:                 { token },
      extraHeaders:         { Authorization: `Bearer ${token}` },
      transports:           ['websocket'],
      reconnectionDelay:    500,
      reconnectionDelayMax: 30_000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on('connect',       () => setStatus('connected'));
    socket.on('disconnect',    () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));

    socket.on('auth_error', () => {
      setStatus('error');
      socket.disconnect();
      onAuthError?.();
    });

    socket.on('rooms_list', (data: { rooms: Room[] }) => {
      setRooms(data.rooms);
    });

    socket.on('room_changed', (data: { roomId: number; roomName: string }) => {
      setCurrentRoom(prev => ({
        ...(prev ?? { createdBy: 0, createdAt: 0 }),
        id: data.roomId, name: data.roomName,
      }));
    });

    socket.on('history', (data: { messages: ChatMessage[]; roomId: number }) => {
      setMessages(data.messages.map(m => ({ ...m, kind: 'chat' as const })));
    });

    // Message for the currently visible room
    socket.on('chat', (msg: ChatMessage) => {
      pushMessage({ ...msg, kind: 'chat' });
    });

    // FIX 5: Background room message → increment unread badge
    socket.on('room_msg', (data: { roomId: number; msg: ChatMessage }) => {
      setUnreadCounts(prev => ({
        ...prev,
        [data.roomId]: (prev[data.roomId] ?? 0) + 1,
      }));
    });

    socket.on('user_joined', (data: { username: string; roomId: number }) => {
      if (data.roomId === currentRoomRef.current) {
        pushSystem(`${data.username} joined the room`);
      }
    });

    socket.on('user_exited_room', (data: { username: string; roomId: number }) => {
      if (data.roomId === currentRoomRef.current) {
        pushSystem(`${data.username} left the room`);
      }
    });

    // FIX 1: Presence arrives for every shared room — show in current room chat
    socket.on('user_online', (data: { username: string; presenceStatus: PresenceStatus }) => {
      const label = data.presenceStatus === 'online' ? 'is now online'
                  : data.presenceStatus === 'away'   ? 'is now away'
                  : 'went offline';
      pushSystem(`${data.username} ${label}`);
    });

    socket.on('user_list', (data: { users: UserPresence[] }) => {
      setUsers(data.users);
    });

    socket.on('mention', (data: MentionNotification) => {
      setMentions(prev => [...prev, data]);
    });

    // FIX 4: room_exited → remove room from list (server has removed the membership)
    socket.on('room_exited', (data: { roomId: number }) => {
      setRooms(prev => prev.filter(r => r.id !== data.roomId));
      setUnreadCounts(prev => { const n = { ...prev }; delete n[data.roomId]; return n; });
    });

    socket.on('error_msg', (data: { message: string }) => {
      pushSystem(`⚠ ${data.message}`);
    });

    // ── DM events ────────────────────────────────────────────────────────────

    socket.on('dm_msg', (msg: DmMessage) => {
      // Partner = the other person in the conversation (never ourselves).
      // If we sent it → partner is msg.to. If we received it → partner is msg.from.
      const key = msg.from === username ? msg.to : msg.from;

      setDmMessages(prev => {
        const existing = prev[key] ?? [];
        // Avoid duplicates
        if (existing.some(m => m.id === msg.id)) return prev;
        return { ...prev, [key]: [...existing, msg] };
      });

      // Update conversations list
      setDmConversations(prev => {
        const existing = prev.find(c => c.partner === key);
        const updated: DmConversation = { partner: key, lastMessage: msg.text, lastAt: msg.timestamp };
        if (existing) return prev.map(c => c.partner === key ? updated : c).sort((a, b) => b.lastAt - a.lastAt);
        return [updated, ...prev];
      });

      // Increment unread if this DM isn't currently open
      if (activeDmRef.current !== key) {
        setDmUnread(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
      }
    });

    socket.on('dm_history', (data: { with: string; messages: DmMessage[] }) => {
      setDmMessages(prev => ({ ...prev, [data.with]: data.messages }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, token, onAuthError, pushMessage, pushSystem]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current?.connected) return;
    const mentions = [...trimmed.matchAll(/@([\w-]{1,24})/g)].map(m => m[1]);
    socketRef.current.emit('chat', { text: trimmed, mentions: mentions.length ? mentions : undefined });
  }, []);

  const switchRoom = useCallback((roomId: number) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('switch_room', { roomId });
  }, []);

  // FIX 4: exitRoom now just emits — server removes membership & we get rooms_list back
  const exitRoom = useCallback((roomId: number) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('exit_room', { roomId });
  }, []);

  const setPresence = useCallback((s: PresenceStatus) => {
    setPresenceStatus(s);
    socketRef.current?.emit('set_presence', { status: s });
  }, []);

  const clearMention = useCallback((id: string) => {
    setMentions(prev => prev.filter(m => m.id !== id));
  }, []);

  const markRoomRead = useCallback((roomId: number) => {
    setUnreadCounts(prev => { const n = { ...prev }; delete n[roomId]; return n; });
  }, []);

  const sendDm = useCallback((to: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current?.connected) return;
    socketRef.current.emit('dm', { to, text: trimmed });
  }, []);

  const openDm = useCallback((partner: string) => {
    setActiveDm(partner);
    setDmUnread(prev => { const n = { ...prev }; delete n[partner]; return n; });
    // Request history if not yet loaded
    socketRef.current?.emit('dm_history', { with: partner });
  }, []);

  const closeDm = useCallback(() => setActiveDm(null), []);

  const markDmRead = useCallback((partner: string) => {
    setDmUnread(prev => { const n = { ...prev }; delete n[partner]; return n; });
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  return {
    messages, users, status, currentRoom, rooms,
    unreadCounts, mentions, presenceStatus,
    dmMessages, dmConversations, dmUnread, activeDm,
    sendMessage, switchRoom, exitRoom, setPresence,
    clearMention, markRoomRead,
    sendDm, openDm, closeDm, markDmRead,
    disconnect,
  };
}

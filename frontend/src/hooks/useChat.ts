'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  MessageItem, ChatMessage, ConnectionStatus, Room,
  UserPresence, PresenceStatus, MentionNotification,
  DmMessage, DmConversation,
} from '@/types/chat';

import { SERVER_URL } from '@/lib/env';

const MAX_HISTORY = 200;

// ── Persistent DM dismissal ─────────────────────────────────────────────────
// Stored in localStorage as a Set of partner usernames, keyed per user so
// logging in as a different account doesn't bleed state.
function dismissedKey(username: string) { return `chatroom_dm_dismissed:${username}`; }

function loadDismissed(username: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(dismissedKey(username));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

function saveDismissed(username: string, set: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(dismissedKey(username), JSON.stringify([...set]));
}

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
  globalPresence:   Map<string, PresenceStatus>;   // all known users → presence
  // Actions
  sendMessage:      (text: string) => void;
  switchRoom:       (roomId: number) => void;
  exitRoom:         (roomId: number) => void;
  setPresence:      (status: PresenceStatus) => void;
  clearMention:     (id: string) => void;
  markRoomRead:     (roomId: number) => void;
  sendDm:               (to: string, text: string) => void;
  openDm:               (partner: string) => void;
  closeDm:              () => void;
  closeDmConversation:  (partner: string) => void;
  markDmRead:           (partner: string) => void;
  disconnect:           () => void;
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
  const [globalPresence,  setGlobalPresence]  = useState<Map<string, PresenceStatus>>(new Map());

  const socketRef      = useRef<Socket | null>(null);
  const currentRoomRef = useRef<number | null>(null);
  const activeDmRef    = useRef<string | null>(null);
  // Keep a mutable ref to dismissed set so socket callbacks always see latest value
  const dismissedRef   = useRef<Set<string>>(new Set());

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

    // Load persisted dismissals for this user on mount
    const dismissed = loadDismissed(username);
    dismissedRef.current = dismissed;

    const socket: Socket = io(SERVER_URL, {
      auth:                 { token },
      extraHeaders:         { Authorization: `Bearer ${token}` },
      transports:           ['websocket'],
      reconnectionDelay:    500,
      reconnectionDelayMax: 30_000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      fetch(`${SERVER_URL}/auth/dm/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : [])
        .then((convos: { partner: string; lastMessage: string; lastAt: number }[]) => {
          if (!convos.length) return;
          // Filter out any partners the user has dismissed
          const visible = convos.filter(c => !dismissedRef.current.has(c.partner));
          setDmConversations(visible);
          visible.forEach(c => {
            socket.emit('dm_history', { with: c.partner });
          });
        })
        .catch(() => {});
    });
    socket.on('disconnect',    () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));

    // Seed globalPresence with ALL currently-online users on (re)connect.
    // This is a full replace (not merge) so stale entries from the previous
    // session are cleared. Without this, users in other rooms show as offline
    // in the DM list after a page refresh because user_list only covers the
    // current room.
    socket.on('presence_snapshot', (data: { users: { username: string; presenceStatus: PresenceStatus }[] }) => {
      setGlobalPresence(() => {
        const next = new Map<string, PresenceStatus>();
        data.users.forEach(u => next.set(u.username, u.presenceStatus));
        return next;
      });
    });

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

    socket.on('chat', (msg: ChatMessage) => {
      pushMessage({ ...msg, kind: 'chat' });
    });

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

    socket.on('user_online', (data: { username: string; presenceStatus: PresenceStatus }) => {
      const label = data.presenceStatus === 'online' ? 'is now online'
                  : data.presenceStatus === 'away'   ? 'is now away'
                  : 'went offline';
      pushSystem(`${data.username} ${label}`);

      // Update globalPresence so DM partner dots reflect the new status immediately,
      // regardless of which room the viewer is currently in.
      setGlobalPresence(prev => {
        const next = new Map(prev);
        next.set(data.username, data.presenceStatus);
        return next;
      });

      // Also patch the users array (In Room list) so the presence dot updates
      // in real-time without waiting for the next user_list event.
      setUsers(prev =>
        prev.map(u =>
          u.username === data.username
            ? { ...u, presenceStatus: data.presenceStatus }
            : u
        )
      );
    });

    socket.on('user_list', (data: { users: UserPresence[] }) => {
      setUsers(data.users);
      setGlobalPresence(prev => {
        const next = new Map(prev);
        data.users.forEach(u => next.set(u.username, u.presenceStatus));
        return next;
      });
    });

    socket.on('mention', (data: MentionNotification) => {
      setMentions(prev => [...prev, data]);
    });

    // Fired when a user leaves a room — remove them from the In Room list only.
    // Intentionally does NOT update globalPresence so DM partner dots are unaffected.
    socket.on('user_removed_from_room', (data: { username: string; roomId: number }) => {
      setUsers(prev => prev.filter(u => u.username !== data.username));
    });

    socket.on('room_exited', (data: { roomId: number }) => {
      setRooms(prev => prev.filter(r => r.id !== data.roomId));
      setUnreadCounts(prev => { const n = { ...prev }; delete n[data.roomId]; return n; });
    });

    socket.on('error_msg', (data: { message: string }) => {
      pushSystem(`⚠ ${data.message}`);
    });

    // ── DM events ─────────────────────────────────────────────────────────────

    socket.on('dm_msg', (msg: DmMessage) => {
      const key = msg.from === username ? msg.to : msg.from;

      setDmMessages(prev => {
        const existing = prev[key] ?? [];
        if (existing.some(m => m.id === msg.id)) return prev;
        return { ...prev, [key]: [...existing, msg] };
      });

      // If this partner was dismissed, receiving a new message un-dismisses them
      // (remove from the dismissed set and persist the change).
      if (dismissedRef.current.has(key)) {
        dismissedRef.current.delete(key);
        saveDismissed(username, dismissedRef.current);
      }

      setDmConversations(prev => {
        const existing = prev.find(c => c.partner === key);
        const updated: DmConversation = { partner: key, lastMessage: msg.text, lastAt: msg.timestamp };
        if (existing) return prev.map(c => c.partner === key ? updated : c).sort((a, b) => b.lastAt - a.lastAt);
        return [updated, ...prev];
      });

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
  }, [enabled, token, username, onAuthError, pushMessage, pushSystem]);

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
    socketRef.current?.emit('dm_history', { with: partner });
  }, []);

  const closeDm = useCallback(() => setActiveDm(null), []);

  // Remove DM from sidebar AND persist the dismissal so it survives logout/login.
  // The dismissal is cleared automatically when a new message arrives from that partner.
  const closeDmConversation = useCallback((partner: string) => {
    setDmConversations(prev => prev.filter(c => c.partner !== partner));
    setDmMessages(prev => { const n = { ...prev }; delete n[partner]; return n; });
    setDmUnread(prev => { const n = { ...prev }; delete n[partner]; return n; });
    setActiveDm(prev => prev === partner ? null : prev);
    // Persist dismissal
    dismissedRef.current.add(partner);
    saveDismissed(username, dismissedRef.current);
  }, [username]);

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
    dmMessages, dmConversations, dmUnread, activeDm, globalPresence,
    sendMessage, switchRoom, exitRoom, setPresence,
    clearMention, markRoomRead,
    sendDm, openDm, closeDm, closeDmConversation, markDmRead,
    disconnect,
  };
}

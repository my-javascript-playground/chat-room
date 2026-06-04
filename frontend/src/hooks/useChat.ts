'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageItem, ChatMessage, ConnectionStatus, Room } from '@/types/chat';

const SERVER_URL  = 'http://localhost:8080';
const MAX_HISTORY = 200;

interface UseChatOptions {
  token:   string;
  enabled: boolean;
}

interface UseChatReturn {
  messages:    MessageItem[];
  users:       string[];
  status:      ConnectionStatus;
  currentRoom: Room | null;
  rooms:       Room[];
  sendMessage: (text: string) => void;
  switchRoom:  (roomId: number) => void;
  disconnect:  () => void;
}

export function useChat({ token, enabled }: UseChatOptions): UseChatReturn {
  const [messages,    setMessages]    = useState<MessageItem[]>([]);
  const [users,       setUsers]       = useState<string[]>([]);
  const [status,      setStatus]      = useState<ConnectionStatus>('connecting');
  const [rooms,       setRooms]       = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const socketRef = useRef<Socket | null>(null);

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
      auth: { token },
      extraHeaders: { Authorization: `Bearer ${token}` },
      transports: ['websocket'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 30_000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on('connect',       () => setStatus('connected'));
    socket.on('disconnect',    () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));

    socket.on('auth_error', (data: { message: string }) => {
      setStatus('error');
      socket.disconnect();
    });

    socket.on('rooms_list', (data: { rooms: Room[] }) => {
      setRooms(data.rooms);
    });

    socket.on('room_changed', (data: { roomId: number; roomName: string }) => {
      setCurrentRoom(prev => ({ ...(prev ?? { createdBy: 0, createdAt: 0 }), id: data.roomId, name: data.roomName }));
      setMessages([]);
    });

    socket.on('history', (data: { messages: ChatMessage[] }) => {
      setMessages(data.messages.map(m => ({ ...m, kind: 'chat' as const })));
    });

    socket.on('chat', (msg: ChatMessage) => {
      pushMessage({ ...msg, kind: 'chat' });
    });

    socket.on('user_joined', (data: { username: string }) => {
      pushSystem(`${data.username} joined`);
    });

    socket.on('user_left', (data: { username: string }) => {
      pushSystem(`${data.username} left`);
    });

    socket.on('user_list', (data: { users: string[] }) => {
      setUsers(data.users);
    });

    socket.on('error_msg', (data: { message: string }) => {
      pushSystem(`⚠ ${data.message}`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, token, pushMessage, pushSystem]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current?.connected) return;
    socketRef.current.emit('chat', { text: trimmed });
  }, []);

  const switchRoom = useCallback((roomId: number) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('switch_room', { roomId });
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  return { messages, users, status, currentRoom, rooms, sendMessage, switchRoom, disconnect };
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageItem, ChatMessage, ConnectionStatus } from '@/types/chat';

const SERVER_URL  = 'http://localhost:8080';
const MAX_HISTORY = 200;

interface UseChatOptions {
  token:   string;   // already-validated JWT
  enabled: boolean;
}

interface UseChatReturn {
  messages:    MessageItem[];
  users:       string[];
  status:      ConnectionStatus;
  sendMessage: (text: string) => void;
  disconnect:  () => void;
}

export function useChat({ token, enabled }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [users,    setUsers]    = useState<string[]>([]);
  const [status,   setStatus]   = useState<ConnectionStatus>('connecting');
  const socketRef               = useRef<Socket | null>(null);

  const pushMessage = useCallback((item: MessageItem) => {
    setMessages((prev) => {
      const next = [...prev, item];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
  }, []);

  const pushSystem = useCallback(
    (text: string) => {
      pushMessage({
        kind:      'system',
        id:        crypto.randomUUID(),
        text,
        timestamp: Date.now(),
      });
    },
    [pushMessage],
  );

  useEffect(() => {
    if (!enabled || !token) return;

    const socket: Socket = io(SERVER_URL, {
      auth:             { token },
      extraHeaders:     { Authorization: `Bearer ${token}` },
      transports:       ['websocket'],
      reconnectionDelay:    500,
      reconnectionDelayMax: 30_000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect',       () => setStatus('connected'));
    socket.on('disconnect',    () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));

    socket.on('auth_error', (data: { message: string }) => {
      console.error('[ws] auth_error:', data.message);
      setStatus('error');
      socket.disconnect();
    });

    socket.on('history', (data: { messages: ChatMessage[] }) => {
      setMessages(data.messages.map((m) => ({ ...m, kind: 'chat' as const })));
    });

    socket.on('chat', (msg: ChatMessage) => {
      pushMessage({ ...msg, kind: 'chat' });
    });

    socket.on('user_joined', (data: { username: string }) => {
      pushSystem(`${data.username} joined the room`);
    });

    socket.on('user_left', (data: { username: string }) => {
      pushSystem(`${data.username} left the room`);
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

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  return { messages, users, status, sendMessage, disconnect };
}

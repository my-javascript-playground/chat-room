'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageItem, ChatMessage, ConnectionStatus } from '@/types/chat';

const SERVER_URL  = 'http://localhost:8080';
const MAX_HISTORY = 200;

type AuthMode = 'login' | 'register';

interface UseChatOptions {
  username: string;
  password: string;
  mode:     AuthMode;
  enabled:  boolean;
}

interface UseChatReturn {
  messages:    MessageItem[];
  users:       string[];
  status:      ConnectionStatus;
  authError:   string | null;
  sendMessage: (text: string) => void;
}

/**
 * Obtain a JWT from the backend.
 * Uses POST /auth/register (first time) or POST /auth/token (login).
 */
async function fetchToken(
  username: string,
  password: string,
  mode: AuthMode,
): Promise<string> {
  const endpoint = mode === 'register' ? '/auth/register' : '/auth/token';
  const res = await fetch(`${SERVER_URL}${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password }),
    cache:   'no-store',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message ?? `Auth failed: ${res.status}`);
  }

  const { token } = body;
  if (typeof token !== 'string' || !token) throw new Error('Server returned empty token');
  return token;
}

export function useChat({
  username,
  password,
  mode,
  enabled,
}: UseChatOptions): UseChatReturn {
  const [messages,  setMessages]  = useState<MessageItem[]>([]);
  const [users,     setUsers]     = useState<string[]>([]);
  const [status,    setStatus]    = useState<ConnectionStatus>('connecting');
  const [authError, setAuthError] = useState<string | null>(null);
  const socketRef                 = useRef<Socket | null>(null);

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
    if (!enabled || !username || !password) return;

    let cancelled = false;

    async function connect() {
      setStatus('connecting');
      setAuthError(null);

      let token: string;
      try {
        token = await fetchToken(username, password, mode);
      } catch (err: any) {
        if (cancelled) return;
        console.error('[auth] Failed to obtain token:', err);
        setAuthError(err.message ?? 'Authentication failed');
        setStatus('error');
        return;
      }

      if (cancelled) return;

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
        setAuthError(data.message);
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
    }

    connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [enabled, username, password, mode, pushMessage, pushSystem]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current?.connected) return;
    socketRef.current.emit('chat', { text: trimmed });
  }, []);

  return { messages, users, status, authError, sendMessage };
}

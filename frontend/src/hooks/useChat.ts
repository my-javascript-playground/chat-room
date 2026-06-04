'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageItem, ChatMessage, ConnectionStatus } from '@/types/chat';

const SERVER_URL  = 'http://localhost:8080';
const MAX_HISTORY = 200;

interface UseChatOptions {
  username: string;
  enabled: boolean;
}

interface UseChatReturn {
  messages: MessageItem[];
  users:    string[];
  status:   ConnectionStatus;
  sendMessage: (text: string) => void;
}

/**
 * Fetch a short-lived JWT from the backend for the given username.
 * Throws on network or server errors so callers can surface them.
 */
async function fetchToken(username: string): Promise<string> {
  const res = await fetch(`${SERVER_URL}/auth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username }),
    // Never cache auth requests
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? `Token request failed: ${res.status}`);
  }

  const { token } = await res.json();
  if (typeof token !== 'string' || !token) throw new Error('Server returned empty token');
  return token;
}

export function useChat({ username, enabled }: UseChatOptions): UseChatReturn {
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
    if (!enabled || !username) return;

    let cancelled = false; // guard against React double-invoke in dev

    async function connect() {
      setStatus('connecting');

      let token: string;
      try {
        token = await fetchToken(username);
      } catch (err) {
        if (cancelled) return;
        console.error('[auth] Failed to obtain token:', err);
        setStatus('error');
        return;
      }

      if (cancelled) return;

      /**
       * Pass the JWT in TWO places so it works regardless of transport:
       *
       * 1. socket.io `auth` object  → available as socket.handshake.auth.token
       *    on the server. Works for both WebSocket and polling transports.
       *
       * 2. `extraHeaders` (Authorization: Bearer …) → available as
       *    socket.handshake.headers.authorization on the server.
       *    NOTE: socket.io-client ignores extraHeaders in browser
       *    XMLHttpRequest polling, but they ARE sent for the WebSocket
       *    upgrade request. Since we force `transports: ['websocket']`
       *    both channels are effectively covered.
       */
      const socket: Socket = io(SERVER_URL, {
        auth:             { token },
        extraHeaders:     { Authorization: `Bearer ${token}` },
        transports:       ['websocket'],
        reconnectionDelay:    500,
        reconnectionDelayMax: 30_000,
        reconnectionAttempts: Infinity,
      });

      socketRef.current = socket;

      // ── lifecycle ──────────────────────────────────────────────────────
      socket.on('connect', () => setStatus('connected'));
      socket.on('disconnect', () => setStatus('disconnected'));
      socket.on('connect_error', () => setStatus('error'));

      // Server-side auth rejection
      socket.on('auth_error', (data: { message: string }) => {
        console.error('[ws] auth_error:', data.message);
        setStatus('error');
        socket.disconnect();
      });

      // ── server → client ────────────────────────────────────────────────
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
  }, [enabled, username, pushMessage, pushSystem]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current?.connected) return;
    socketRef.current.emit('chat', { text: trimmed });
  }, []);

  return { messages, users, status, sendMessage };
}

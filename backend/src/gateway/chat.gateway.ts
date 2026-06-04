import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import {
  ChatMessage,
  SendChatPayload,
  UserListMessage,
} from '../chat/chat.types';
import { AuthService } from '../auth/auth.service';

// ── In-memory state ──────────────────────────────────────────────────────────
const clients = new Map<string, { username: string; socketId: string }>();
const history: ChatMessage[] = [];
const MAX_HISTORY = 50;

// ── Rate-limit state (per socket) ────────────────────────────────────────────
const MSG_WINDOW_MS  = 5_000;  // 5-second sliding window
const MSG_MAX        = 10;     // max messages per window

interface RateEntry {
  timestamps: number[];
}
const rateLimits = new Map<string, RateEntry>();

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly auth: AuthService) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private getUserList(): string[] {
    return [...clients.values()].map((c) => c.username);
  }

  private saveToHistory(msg: ChatMessage): void {
    history.push(msg);
    if (history.length > MAX_HISTORY) history.shift();
  }

  private broadcastUserList(): void {
    const payload: UserListMessage = { type: 'user_list', users: this.getUserList() };
    this.server.emit('user_list', payload);
  }

  /**
   * Extract and verify the JWT from the handshake.
   *
   * The client sends the token in the Authorization header:
   *   Authorization: Bearer <token>
   * as part of the socket.io extraHeaders option.
   *
   * Falls back to checking handshake.auth.token for clients that
   * cannot set custom headers (e.g. browser WS without socket.io).
   */
  private verifyHandshake(socket: Socket): string | null {
    try {
      // Prefer Authorization header (more conventional)
      const header = socket.handshake.headers['authorization'] ?? '';
      const fromHeader = header.startsWith('Bearer ')
        ? header.slice(7).trim()
        : '';

      // Fallback: socket.io auth object  { auth: { token: '...' } }
      const fromAuth = (socket.handshake.auth as { token?: string }).token ?? '';

      const raw = fromHeader || fromAuth;
      if (!raw) return null;

      const payload = this.auth.verify(raw);
      return payload.username ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Simple sliding-window rate limiter.
   * Returns true if the message should be allowed.
   */
  private checkRateLimit(socketId: string): boolean {
    const now = Date.now();
    const entry = rateLimits.get(socketId) ?? { timestamps: [] };

    // Drop timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < MSG_WINDOW_MS);

    if (entry.timestamps.length >= MSG_MAX) {
      rateLimits.set(socketId, entry);
      return false;
    }

    entry.timestamps.push(now);
    rateLimits.set(socketId, entry);
    return true;
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  handleConnection(socket: Socket): void {
    const username = this.verifyHandshake(socket);

    if (!username) {
      // Reject unauthenticated or expired-token connections immediately
      socket.emit('auth_error', {
        message: 'Missing or invalid auth token. Connect via POST /auth/token first.',
      });
      socket.disconnect(true);
      console.warn(`[!] Rejected unauthenticated connection from ${socket.id}`);
      return;
    }

    // Check for duplicate username (optional — remove if you allow multi-tab)
    const duplicate = [...clients.values()].find((c) => c.username === username);
    if (duplicate) {
      socket.emit('auth_error', { message: 'Username already connected.' });
      socket.disconnect(true);
      console.warn(`[!] Duplicate username "${username}" rejected`);
      return;
    }

    clients.set(socket.id, { username, socketId: socket.id });
    console.log(`[+] ${username} connected  (total: ${clients.size})`);

    socket.emit('history',   { type: 'history',   messages: history });
    socket.emit('user_list', { type: 'user_list', users: this.getUserList() });

    socket.broadcast.emit('user_joined', {
      type: 'user_joined',
      username,
      timestamp: Date.now(),
    });

    this.broadcastUserList();
  }

  // ── Disconnection ──────────────────────────────────────────────────────────

  handleDisconnect(socket: Socket): void {
    const client = clients.get(socket.id);
    rateLimits.delete(socket.id);
    if (!client) return;

    clients.delete(socket.id);
    console.log(`[-] ${client.username} disconnected  (total: ${clients.size})`);

    this.server.emit('user_left', {
      type: 'user_left',
      username: client.username,
      timestamp: Date.now(),
    });

    this.broadcastUserList();
  }

  // ── Incoming: chat message ─────────────────────────────────────────────────

  @SubscribeMessage('chat')
  handleChat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: SendChatPayload,
  ): void {
    const client = clients.get(socket.id);
    if (!client) return;

    // Rate-limit check
    if (!this.checkRateLimit(socket.id)) {
      socket.emit('error_msg', { message: 'Rate limit exceeded. Slow down.' });
      return;
    }

    const text = (payload.text ?? '').trim().slice(0, 500);
    if (!text) return;

    const msg: ChatMessage = {
      type: 'chat',
      id: randomUUID(),
      username: client.username,   // always use server-side identity
      text,
      timestamp: Date.now(),
    };

    this.saveToHistory(msg);
    this.server.emit('chat', msg);
    console.log(`[msg] ${client.username}: ${text}`);
  }
}

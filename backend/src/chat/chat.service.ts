import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as Database from 'better-sqlite3';
import * as path from 'path';
import { ChatMessage } from './chat.types';
import { randomUUID } from 'crypto';

const DB_PATH          = path.resolve(process.env.DB_PATH ?? './chatroom.db');
const THIRTY_DAYS_MS   = 30 * 24 * 60 * 60 * 1000;
const MAX_HISTORY_LOAD = 200;

export interface DmMessage {
  id:        string;
  from:      string;
  to:        string;
  text:      string;
  timestamp: number;
}

@Injectable()
export class ChatService implements OnModuleInit, OnModuleDestroy {
  private db: Database.Database;

  onModuleInit() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id        TEXT    PRIMARY KEY,
        roomId    INTEGER NOT NULL,
        username  TEXT    NOT NULL,
        text      TEXT    NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_room_ts ON messages (roomId, timestamp);

      CREATE TABLE IF NOT EXISTS direct_messages (
        id        TEXT    PRIMARY KEY,
        fromUser  TEXT    NOT NULL COLLATE NOCASE,
        toUser    TEXT    NOT NULL COLLATE NOCASE,
        text      TEXT    NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dm_pair ON direct_messages (fromUser, toUser, timestamp);
    `);

    this.pruneOldMessages();
    setInterval(() => this.pruneOldMessages(), 60 * 60 * 1000);
    console.log('[chat] Message store initialised');
  }

  onModuleDestroy() {
    this.db?.close();
  }

  private pruneOldMessages() {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const r1 = this.db.prepare('DELETE FROM messages WHERE timestamp < ?').run(cutoff);
    const r2 = this.db.prepare('DELETE FROM direct_messages WHERE timestamp < ?').run(cutoff);
    if (r1.changes + r2.changes > 0)
      console.log(`[chat] Pruned ${r1.changes + r2.changes} old messages`);
  }

  // ── Room messages ─────────────────────────────────────────────────────────

  saveMessage(roomId: number, msg: ChatMessage): void {
    this.db.prepare(
      `INSERT OR IGNORE INTO messages (id, roomId, username, text, timestamp) VALUES (?, ?, ?, ?, ?)`
    ).run(msg.id, roomId, msg.username, msg.text, msg.timestamp);
  }

  getRecentMessages(roomId: number): ChatMessage[] {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return (this.db.prepare(
      `SELECT id, username, text, timestamp FROM messages
       WHERE roomId = ? AND timestamp >= ?
       ORDER BY timestamp DESC LIMIT ?`
    ).all(roomId, cutoff, MAX_HISTORY_LOAD) as any[])
      .reverse()
      .map(row => ({ type: 'chat' as const, id: row.id, username: row.username, text: row.text, timestamp: row.timestamp }));
  }

  // ── Direct messages ───────────────────────────────────────────────────────

  saveDm(from: string, to: string, text: string): DmMessage {
    const dm: DmMessage = { id: randomUUID(), from, to, text, timestamp: Date.now() };
    this.db.prepare(
      `INSERT INTO direct_messages (id, fromUser, toUser, text, timestamp) VALUES (?, ?, ?, ?, ?)`
    ).run(dm.id, dm.from, dm.to, dm.text, dm.timestamp);
    return dm;
  }

  getDmHistory(userA: string, userB: string): DmMessage[] {
    return (this.db.prepare(
      `SELECT id, fromUser as "from", toUser as "to", text, timestamp
       FROM direct_messages
       WHERE (fromUser = ? AND toUser = ?) OR (fromUser = ? AND toUser = ?)
       ORDER BY timestamp DESC LIMIT 200`
    ).all(userA, userB, userB, userA) as any[]).reverse();
  }

  /** Returns a list of distinct DM partners for a user (most recent first). */
  getDmConversations(username: string): { partner: string; lastMessage: string; lastAt: number }[] {
    return this.db.prepare(`
      SELECT
        CASE WHEN fromUser = ? THEN toUser ELSE fromUser END AS partner,
        text   AS lastMessage,
        MAX(timestamp) AS lastAt
      FROM direct_messages
      WHERE fromUser = ? OR toUser = ?
      GROUP BY partner
      ORDER BY lastAt DESC
    `).all(username, username, username) as any[];
  }
}

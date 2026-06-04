import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as Database from 'better-sqlite3';
import * as bcrypt from 'bcrypt';
import * as path from 'path';

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  createdAt: number;
}

const DB_PATH = path.resolve(process.env.DB_PATH ?? './chatroom.db');
const SALT_ROUNDS = 12;

@Injectable()
export class UserService implements OnModuleInit, OnModuleDestroy {
  private db: Database.Database;

  onModuleInit() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        username     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        passwordHash TEXT    NOT NULL,
        createdAt    INTEGER NOT NULL
      );
    `);
    console.log(`[db] SQLite database at ${DB_PATH}`);
  }

  onModuleDestroy() {
    this.db?.close();
  }

  /** Returns true if the username is already taken (case-insensitive). */
  exists(username: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE')
      .get(username);
    return !!row;
  }

  /** Register a new user. Throws if username is taken. */
  async register(username: string, password: string): Promise<User> {
    if (this.exists(username)) {
      throw new Error('Username already taken');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const createdAt = Date.now();
    const info = this.db
      .prepare(
        'INSERT INTO users (username, passwordHash, createdAt) VALUES (?, ?, ?)',
      )
      .run(username, passwordHash, createdAt);

    return {
      id: info.lastInsertRowid as number,
      username,
      passwordHash,
      createdAt,
    };
  }

  /** Verify credentials. Returns the user on success, null on failure. */
  async verify(username: string, password: string): Promise<User | null> {
    const row = this.db
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
      .get(username) as User | undefined;

    if (!row) return null;
    const match = await bcrypt.compare(password, row.passwordHash);
    return match ? row : null;
  }
}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as Database from 'better-sqlite3';
import * as bcrypt from 'bcrypt';
import * as path from 'path';

export type UserStatus = 'pending' | 'approved';
export type UserRole   = 'user' | 'admin';

export interface User {
  id:           number;
  username:     string;
  passwordHash: string;
  status:       UserStatus;
  role:         UserRole;
  createdAt:    number;
}

const DB_PATH    = path.resolve(process.env.DB_PATH ?? './chatroom.db');
const SALT_ROUNDS = 12;

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';

@Injectable()
export class UserService implements OnModuleInit, OnModuleDestroy {
  private db: Database.Database;

  onModuleInit() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');

    // Create table for brand-new databases
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        username     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        passwordHash TEXT    NOT NULL,
        status       TEXT    NOT NULL DEFAULT 'pending',
        role         TEXT    NOT NULL DEFAULT 'user',
        createdAt    INTEGER NOT NULL
      );
    `);

    // Migrate existing databases that pre-date the status/role columns
    this.migrate();

    this.seedAdmin();
    console.log(`[db] SQLite database at ${DB_PATH}`);
  }

  /** Idempotent schema migrations — safe to run on every startup. */
  private migrate(): void {
    const columns = (this.db.pragma('table_info(users)') as { name: string }[]).map(
      (c) => c.name,
    );

    if (!columns.includes('status')) {
      this.db.exec(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';`);
      console.log('[db] Migration: added column status (existing rows set to approved)');
    }

    if (!columns.includes('role')) {
      this.db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';`);
      console.log('[db] Migration: added column role (existing rows set to user)');
    }
  }

  onModuleDestroy() {
    this.db?.close();
  }

  // ── Seeding ───────────────────────────────────────────────────────────────

  private seedAdmin(): void {
    const existing = this.db
      .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
      .get(DEFAULT_ADMIN_USERNAME);
    if (existing) return;

    const passwordHash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS);
    this.db
      .prepare(
        `INSERT INTO users (username, passwordHash, status, role, createdAt)
         VALUES (?, ?, 'approved', 'admin', ?)`,
      )
      .run(DEFAULT_ADMIN_USERNAME, passwordHash, Date.now());
    console.log(`[db] Default admin created: ${DEFAULT_ADMIN_USERNAME}`);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  findByUsername(username: string): User | null {
    return (
      (this.db
        .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
        .get(username) as User | undefined) ?? null
    );
  }

  findById(id: number): User | null {
    return (
      (this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined) ??
      null
    );
  }

  listAll(): User[] {
    return this.db.prepare('SELECT * FROM users ORDER BY createdAt ASC').all() as User[];
  }

  exists(username: string): boolean {
    return !!this.db
      .prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE')
      .get(username);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Register a new user with status=pending. Throws if username is taken. */
  async register(username: string, password: string): Promise<User> {
    if (this.exists(username)) throw new Error('Username already taken');

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const createdAt    = Date.now();
    const info = this.db
      .prepare(
        `INSERT INTO users (username, passwordHash, status, role, createdAt)
         VALUES (?, ?, 'pending', 'user', ?)`,
      )
      .run(username, passwordHash, createdAt);

    return this.findById(info.lastInsertRowid as number)!;
  }

  /** Verify credentials for an approved user. Returns the user or null. */
  async verify(username: string, password: string): Promise<User | null> {
    const row = this.findByUsername(username);
    if (!row) return null;
    const match = await bcrypt.compare(password, row.passwordHash);
    return match ? row : null;
  }

  /** Approve a pending user. */
  approve(id: number): boolean {
    const result = this.db
      .prepare(`UPDATE users SET status = 'approved' WHERE id = ?`)
      .run(id);
    return result.changes > 0;
  }

  /** Reject / delete a user. */
  remove(id: number): boolean {
    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /** Change a user's password. */
  async changePassword(id: number, newPassword: string): Promise<boolean> {
    const hash   = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const result = this.db
      .prepare('UPDATE users SET passwordHash = ? WHERE id = ?')
      .run(hash, id);
    return result.changes > 0;
  }
}

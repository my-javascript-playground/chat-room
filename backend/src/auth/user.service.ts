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

export interface Room {
  id:        number;
  name:      string;
  createdBy: number;
  createdAt: number;
}

export type JoinStatus = 'pending' | 'approved';

export interface RoomMember {
  roomId:    number;
  userId:    number;
  status:    JoinStatus;
  createdAt: number;
}

const DB_PATH    = path.resolve(process.env.DB_PATH ?? './chatroom.db');
const SALT_ROUNDS = 12;

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';
const DEFAULT_ROOM_NAME = 'general';

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
        status       TEXT    NOT NULL DEFAULT 'pending',
        role         TEXT    NOT NULL DEFAULT 'user',
        createdAt    INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        name      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        createdBy INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS room_members (
        roomId    INTEGER NOT NULL,
        userId    INTEGER NOT NULL,
        status    TEXT    NOT NULL DEFAULT 'pending',
        createdAt INTEGER NOT NULL,
        PRIMARY KEY (roomId, userId)
      );
    `);

    this.migrate();
    this.seedAdmin();
    this.seedGeneralRoom();
    console.log(`[db] SQLite database at ${DB_PATH}`);
  }

  private migrate(): void {
    const columns = (this.db.pragma('table_info(users)') as { name: string }[]).map(c => c.name);
    if (!columns.includes('status')) {
      this.db.exec(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';`);
    }
    if (!columns.includes('role')) {
      this.db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';`);
    }

    // Fix existing installs: admin may exist and general room may exist,
    // but admin was never added to room_members (the original bug).
    const admin = this.findByUsername(DEFAULT_ADMIN_USERNAME);
    const general = this.findRoomByName(DEFAULT_ROOM_NAME);
    if (admin && general) {
      const membership = this.getRoomMember(general.id, admin.id);
      if (!membership) {
        this.db.prepare(`INSERT INTO room_members (roomId, userId, status, createdAt) VALUES (?, ?, 'approved', ?)`)
          .run(general.id, admin.id, Date.now());
        console.log(`[db] Migration: added admin to general room`);
      }
    }
  }

  onModuleDestroy() {
    this.db?.close();
  }

  // ── Seeding ───────────────────────────────────────────────────────────────

  private seedAdmin(): void {
    const existing = this.db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(DEFAULT_ADMIN_USERNAME);
    if (existing) return;
    const passwordHash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS);
    this.db.prepare(`INSERT INTO users (username, passwordHash, status, role, createdAt) VALUES (?, ?, 'approved', 'admin', ?)`)
      .run(DEFAULT_ADMIN_USERNAME, passwordHash, Date.now());
    console.log(`[db] Default admin created: ${DEFAULT_ADMIN_USERNAME}`);
  }

  private seedGeneralRoom(): void {
    const existing = this.db.prepare('SELECT id FROM rooms WHERE name = ? COLLATE NOCASE').get(DEFAULT_ROOM_NAME);
    if (existing) return;
    const admin = this.findByUsername(DEFAULT_ADMIN_USERNAME);
    if (!admin) return;
    this.db.prepare(`INSERT INTO rooms (name, createdBy, createdAt) VALUES (?, ?, ?)`).run(DEFAULT_ROOM_NAME, admin.id, Date.now());
    // Add admin as an approved member of the general room they just created
    this.addToGeneralRoom(admin.id);
    console.log(`[db] Default room "${DEFAULT_ROOM_NAME}" created`);
  }

  // ── User Queries ──────────────────────────────────────────────────────────

  findByUsername(username: string): User | null {
    return (this.db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as User | undefined) ?? null;
  }

  findById(id: number): User | null {
    return (this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined) ?? null;
  }

  listAll(): User[] {
    return this.db.prepare('SELECT * FROM users ORDER BY createdAt ASC').all() as User[];
  }

  exists(username: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(username);
  }

  // ── Room Queries ──────────────────────────────────────────────────────────

  findRoomById(id: number): Room | null {
    return (this.db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as Room | undefined) ?? null;
  }

  findRoomByName(name: string): Room | null {
    return (this.db.prepare('SELECT * FROM rooms WHERE name = ? COLLATE NOCASE').get(name) as Room | undefined) ?? null;
  }

  listRooms(): Room[] {
    return this.db.prepare('SELECT * FROM rooms ORDER BY createdAt ASC').all() as Room[];
  }

  createRoom(name: string, createdBy: number): Room {
    const existing = this.findRoomByName(name);
    if (existing) throw new Error('Room name already taken');
    const info = this.db.prepare(`INSERT INTO rooms (name, createdBy, createdAt) VALUES (?, ?, ?)`).run(name.trim(), createdBy, Date.now());
    return this.findRoomById(info.lastInsertRowid as number)!;
  }

  deleteRoom(id: number): boolean {
    const room = this.findRoomById(id);
    if (!room) return false;
    if (room.name.toLowerCase() === DEFAULT_ROOM_NAME) throw new Error('Cannot delete the general room');
    this.db.prepare('DELETE FROM room_members WHERE roomId = ?').run(id);
    const result = this.db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ── Room Membership ───────────────────────────────────────────────────────

  getRoomMember(roomId: number, userId: number): RoomMember | null {
    return (this.db.prepare('SELECT * FROM room_members WHERE roomId = ? AND userId = ?').get(roomId, userId) as RoomMember | undefined) ?? null;
  }

  getRoomMembers(roomId: number): (RoomMember & { username: string })[] {
    return this.db.prepare(
      `SELECT rm.*, u.username FROM room_members rm JOIN users u ON rm.userId = u.id WHERE rm.roomId = ?`
    ).all(roomId) as (RoomMember & { username: string })[];
  }

  getPendingJoinRequests(): (RoomMember & { username: string; roomName: string })[] {
    return this.db.prepare(
      `SELECT rm.*, u.username, r.name as roomName FROM room_members rm
       JOIN users u ON rm.userId = u.id
       JOIN rooms r ON rm.roomId = r.id
       WHERE rm.status = 'pending'`
    ).all() as (RoomMember & { username: string; roomName: string })[];
  }

  /** Returns all rooms a user is approved to access */
  getUserRooms(userId: number): Room[] {
    return this.db.prepare(
      `SELECT r.* FROM rooms r
       JOIN room_members rm ON r.id = rm.roomId
       WHERE rm.userId = ? AND rm.status = 'approved'`
    ).all(userId) as Room[];
  }

  requestJoinRoom(roomId: number, userId: number, initialStatus: JoinStatus = 'pending'): RoomMember {
    const existing = this.getRoomMember(roomId, userId);
    if (existing) throw new Error(existing.status === 'approved' ? 'Already a member' : 'Request already pending');
    this.db.prepare(`INSERT INTO room_members (roomId, userId, status, createdAt) VALUES (?, ?, ?, ?)`).run(roomId, userId, initialStatus, Date.now());
    return this.getRoomMember(roomId, userId)!;
  }

  approveJoinRequest(roomId: number, userId: number): boolean {
    const result = this.db.prepare(`UPDATE room_members SET status = 'approved' WHERE roomId = ? AND userId = ?`).run(roomId, userId);
    return result.changes > 0;
  }

  rejectJoinRequest(roomId: number, userId: number): boolean {
    const result = this.db.prepare(`DELETE FROM room_members WHERE roomId = ? AND userId = ? AND status = 'pending'`).run(roomId, userId);
    return result.changes > 0;
  }

  /** Auto-add a user to the general room upon approval */
  addToGeneralRoom(userId: number): void {
    const general = this.findRoomByName(DEFAULT_ROOM_NAME);
    if (!general) return;
    const existing = this.getRoomMember(general.id, userId);
    if (existing) {
      if (existing.status !== 'approved') {
        this.db.prepare(`UPDATE room_members SET status = 'approved' WHERE roomId = ? AND userId = ?`).run(general.id, userId);
      }
      return;
    }
    this.db.prepare(`INSERT INTO room_members (roomId, userId, status, createdAt) VALUES (?, ?, 'approved', ?)`).run(general.id, userId, Date.now());
  }

  // ── User Mutations ────────────────────────────────────────────────────────

  async register(username: string, password: string): Promise<User> {
    if (this.exists(username)) throw new Error('Username already taken');
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const createdAt = Date.now();
    const info = this.db.prepare(`INSERT INTO users (username, passwordHash, status, role, createdAt) VALUES (?, ?, 'pending', 'user', ?)`).run(username, passwordHash, createdAt);
    return this.findById(info.lastInsertRowid as number)!;
  }

  async verify(username: string, password: string): Promise<User | null> {
    const row = this.findByUsername(username);
    if (!row) return null;
    const match = await bcrypt.compare(password, row.passwordHash);
    return match ? row : null;
  }

  approve(id: number): boolean {
    const result = this.db.prepare(`UPDATE users SET status = 'approved' WHERE id = ?`).run(id);
    if (result.changes > 0) this.addToGeneralRoom(id);
    return result.changes > 0;
  }

  remove(id: number): boolean {
    this.db.prepare('DELETE FROM room_members WHERE userId = ?').run(id);
    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async changePassword(id: number, newPassword: string): Promise<boolean> {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const result = this.db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(hash, id);
    return result.changes > 0;
  }

  /** Forcefully remove an approved or pending member from a room. */
  removeRoomMember(roomId: number, userId: number): boolean {
    const result = this.db.prepare('DELETE FROM room_members WHERE roomId = ? AND userId = ?').run(roomId, userId);
    return result.changes > 0;
  }
}

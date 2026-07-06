import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

interface UserRow { id: number; username: string; status: 'pending' | 'approved'; role: 'user' | 'admin'; createdAt: number; }
interface RoomRow { id: number; name: string; createdBy: number; createdAt: number; }
interface JoinReq { roomId: number; userId: number; username: string; roomName: string; status: string; createdAt: number; }
type Tab = 'users' | 'rooms' | 'joins';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-panel.component.html',
})
export class AdminPanelComponent implements OnInit {
  @Input()  token!:  string;
  @Output() closed = new EventEmitter<void>();

  tab:     Tab       = 'users';
  readonly tabOptions: { id: Tab; label: string }[] = [
    { id: 'users', label: 'Users' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'joins', label: 'Join Requests' },
  ];
  users:   UserRow[] = [];
  rooms:   RoomRow[] = [];
  joins:   JoinReq[] = [];
  loading  = false;
  error    = '';
  newRoom  = '';

  pwTarget: UserRow | null = null;
  newPw    = '';
  pwError  = '';
  pwInfo   = '';

  ngOnInit(): void { this.fetchAll(); }

  get pending():  UserRow[] { return this.users.filter(u => u.status === 'pending'); }
  get approved(): UserRow[] { return this.users.filter(u => u.status === 'approved'); }

  private get headers() {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' };
  }

  async fetchAll(): Promise<void> {
    this.loading = true; this.error = '';
    try {
      const [uRes, rRes, jRes] = await Promise.all([
        fetch(`${environment.serverUrl}/auth/admin/users`,         { headers: this.headers }),
        fetch(`${environment.serverUrl}/auth/admin/rooms`,         { headers: this.headers }),
        fetch(`${environment.serverUrl}/auth/admin/join-requests`, { headers: this.headers }),
      ]);
      if (uRes.ok) this.users = await uRes.json();
      if (rRes.ok) this.rooms = await rRes.json();
      if (jRes.ok) this.joins = await jRes.json();
    } catch (e: unknown) {
      this.error = (e instanceof Error ? e.message : null) ?? 'Error';
    } finally {
      this.loading = false;
    }
  }

  async approveUser(id: number): Promise<void> {
    const res = await fetch(`${environment.serverUrl}/auth/admin/users/${id}/approve`, { method: 'PATCH', headers: this.headers });
    if (res.ok) this.fetchAll(); else this.error = (await res.json())?.message ?? 'Failed';
  }

  async removeUser(id: number, username: string): Promise<void> {
    if (!confirm(`Remove user "${username}"?`)) return;
    const res = await fetch(`${environment.serverUrl}/auth/admin/users/${id}`, { method: 'DELETE', headers: this.headers });
    if (res.ok) this.fetchAll(); else this.error = (await res.json())?.message ?? 'Failed';
  }

  async createRoom(): Promise<void> {
    if (!this.newRoom.trim()) return;
    const res  = await fetch(`${environment.serverUrl}/auth/admin/rooms`, { method: 'POST', headers: this.headers, body: JSON.stringify({ name: this.newRoom.trim() }) });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { this.newRoom = ''; this.fetchAll(); } else this.error = body?.message ?? 'Failed';
  }

  async deleteRoom(id: number, name: string): Promise<void> {
    if (!confirm(`Delete room "#${name}"?`)) return;
    const res = await fetch(`${environment.serverUrl}/auth/admin/rooms/${id}`, { method: 'DELETE', headers: this.headers });
    if (res.ok) this.fetchAll(); else this.error = (await res.json())?.message ?? 'Failed';
  }

  async approveJoin(roomId: number, userId: number): Promise<void> {
    const res = await fetch(`${environment.serverUrl}/auth/admin/rooms/${roomId}/members/${userId}/approve`, { method: 'PATCH', headers: this.headers });
    if (res.ok) this.fetchAll(); else this.error = (await res.json())?.message ?? 'Failed';
  }

  async rejectJoin(roomId: number, userId: number): Promise<void> {
    const res = await fetch(`${environment.serverUrl}/auth/admin/rooms/${roomId}/members/${userId}`, { method: 'DELETE', headers: this.headers });
    if (res.ok) this.fetchAll(); else this.error = (await res.json())?.message ?? 'Failed';
  }

  openSetPassword(u: UserRow): void {
    this.pwTarget = u; this.newPw = ''; this.pwError = ''; this.pwInfo = '';
  }

  async submitPassword(): Promise<void> {
    if (!this.pwTarget) return;
    this.pwError = '';
    if (this.newPw.trim().length < 6) { this.pwError = 'Min. 6 characters'; return; }
    const res  = await fetch(`${environment.serverUrl}/auth/admin/users/${this.pwTarget.id}/password`, { method: 'PATCH', headers: this.headers, body: JSON.stringify({ password: this.newPw.trim() }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { this.pwError = body?.message ?? 'Failed'; return; }
    this.pwInfo = 'Password updated!';
    this.newPw  = '';
    setTimeout(() => { this.pwTarget = null; this.pwInfo = ''; }, 1200);
  }

  closeIfBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.closed.emit();
  }

  fmtDate(ts: number): string { return new Date(ts).toLocaleDateString(); }
}

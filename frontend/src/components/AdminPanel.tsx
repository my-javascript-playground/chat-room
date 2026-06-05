'use client';

import { useState, useEffect, useCallback } from 'react';

import { SERVER_URL } from '@/lib/env';

interface UserRow  { id: number; username: string; status: 'pending' | 'approved'; role: 'user' | 'admin'; createdAt: number; }
interface RoomRow  { id: number; name: string; createdBy: number; createdAt: number; }
interface JoinReq  { roomId: number; userId: number; username: string; roomName: string; status: string; createdAt: number; }

type Tab = 'users' | 'rooms' | 'joins';

export default function AdminPanel({ token, onClose }: { token: string; onClose: () => void }) {
  const [tab,     setTab]     = useState<Tab>('users');
  const [users,   setUsers]   = useState<UserRow[]>([]);
  const [rooms,   setRooms]   = useState<RoomRow[]>([]);
  const [joins,   setJoins]   = useState<JoinReq[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [newRoom, setNewRoom] = useState('');

  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [newPw,    setNewPw]    = useState('');
  const [pwError,  setPwError]  = useState('');
  const [pwInfo,   setPwInfo]   = useState('');

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [uRes, rRes, jRes] = await Promise.all([
        fetch(`${SERVER_URL}/auth/admin/users`,        { headers: authHeaders }),
        fetch(`${SERVER_URL}/auth/admin/rooms`,        { headers: authHeaders }),
        fetch(`${SERVER_URL}/auth/admin/join-requests`, { headers: authHeaders }),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      if (rRes.ok) setRooms(await rRes.json());
      if (jRes.ok) setJoins(await jRes.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function approveUser(id: number) {
    const res = await fetch(`${SERVER_URL}/auth/admin/users/${id}/approve`, { method: 'PATCH', headers: authHeaders });
    if (res.ok) fetchAll(); else setError((await res.json())?.message ?? 'Failed');
  }

  async function removeUser(id: number, username: string) {
    if (!confirm(`Remove user "${username}"?`)) return;
    const res = await fetch(`${SERVER_URL}/auth/admin/users/${id}`, { method: 'DELETE', headers: authHeaders });
    if (res.ok) fetchAll(); else setError((await res.json())?.message ?? 'Failed');
  }

  async function createRoom() {
    if (!newRoom.trim()) return;
    const res = await fetch(`${SERVER_URL}/auth/admin/rooms`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: newRoom.trim() }) });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { setNewRoom(''); fetchAll(); }
    else setError(body?.message ?? 'Failed');
  }

  async function deleteRoom(id: number, name: string) {
    if (!confirm(`Delete room "#${name}"?`)) return;
    const res = await fetch(`${SERVER_URL}/auth/admin/rooms/${id}`, { method: 'DELETE', headers: authHeaders });
    if (res.ok) fetchAll(); else setError((await res.json())?.message ?? 'Failed');
  }

  async function approveJoin(roomId: number, userId: number) {
    const res = await fetch(`${SERVER_URL}/auth/admin/rooms/${roomId}/members/${userId}/approve`, { method: 'PATCH', headers: authHeaders });
    if (res.ok) fetchAll(); else setError((await res.json())?.message ?? 'Failed');
  }

  async function rejectJoin(roomId: number, userId: number) {
    const res = await fetch(`${SERVER_URL}/auth/admin/rooms/${roomId}/members/${userId}`, { method: 'DELETE', headers: authHeaders });
    if (res.ok) fetchAll(); else setError((await res.json())?.message ?? 'Failed');
  }

  async function submitPassword() {
    if (!pwTarget) return;
    setPwError('');
    if (newPw.trim().length < 6) { setPwError('Min. 6 characters'); return; }
    const res = await fetch(`${SERVER_URL}/auth/admin/users/${pwTarget.id}/password`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ password: newPw.trim() }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setPwError(body?.message ?? 'Failed'); return; }
    setPwInfo('Password updated!');
    setNewPw('');
    setTimeout(() => { setPwTarget(null); setPwInfo(''); }, 1200);
  }

  const pending  = users.filter(u => u.status === 'pending');
  const approved = users.filter(u => u.status === 'approved');

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', marginBottom: '0.4rem', fontSize: '0.82rem' };
  const btnStyle = (color: string): React.CSSProperties => ({ padding: '0.25rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, borderRadius: 4, border: 'none', cursor: 'pointer', background: color, color: '#fff', flexShrink: 0 });
  const tabStyle = (active: boolean): React.CSSProperties => ({ padding: '0.4rem 0.9rem', fontFamily: 'var(--display)', fontWeight: 700, fontSize: '0.75rem', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, background: active ? 'var(--accent)' : 'var(--bg)', color: active ? '#000' : 'var(--text-dim)', cursor: 'pointer' });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 'min(560px, 95vw)', maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent)' }}>Admin Panel</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={tabStyle(tab === 'users')} onClick={() => setTab('users')}>Users {pending.length > 0 && `(${pending.length} pending)`}</button>
          <button style={tabStyle(tab === 'rooms')} onClick={() => setTab('rooms')}>Rooms</button>
          <button style={tabStyle(tab === 'joins')} onClick={() => setTab('joins')}>Join Requests {joins.length > 0 && `(${joins.length})`}</button>
        </div>

        {error && <div style={{ color: '#e55', fontSize: '0.8rem' }}>{error}</div>}
        {loading && <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>Loading…</div>}

        {/* Users tab */}
        {tab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Pending — {pending.length}</div>
              {pending.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>No pending registrations</div>}
              {pending.map(u => (
                <div key={u.id} style={rowStyle}>
                  <span style={{ flex: 1, color: 'var(--text)' }}>{u.username}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>{new Date(u.createdAt).toLocaleDateString()}</span>
                  <button style={btnStyle('#2a9d5c')} onClick={() => approveUser(u.id)}>Approve</button>
                  <button style={btnStyle('#c0392b')} onClick={() => removeUser(u.id, u.username)}>Reject</button>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Approved — {approved.length}</div>
              {approved.map(u => (
                <div key={u.id} style={rowStyle}>
                  <span style={{ flex: 1, color: 'var(--text)' }}>
                    {u.username}
                    {u.role === 'admin' && <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', background: 'var(--accent)', color: '#000', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>admin</span>}
                  </span>
                  <button style={btnStyle('#555')} onClick={() => { setPwTarget(u); setNewPw(''); setPwError(''); setPwInfo(''); }}>Set password</button>
                  {u.role !== 'admin' && <button style={btnStyle('#c0392b')} onClick={() => removeUser(u.id, u.username)}>Remove</button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rooms tab */}
        {tab === 'rooms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text" value={newRoom} onChange={e => setNewRoom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createRoom()}
                placeholder="New room name (letters, numbers, hyphens)"
                style={{ flex: 1, padding: '0.55rem 0.8rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.85rem', outline: 'none' }}
              />
              <button onClick={createRoom} style={btnStyle('#2a9d5c')}>Create</button>
            </div>
            {rooms.map(r => (
              <div key={r.id} style={rowStyle}>
                <span style={{ flex: 1, color: 'var(--text)', fontFamily: 'var(--mono)' }}># {r.name}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                {r.name !== 'general' && <button style={btnStyle('#c0392b')} onClick={() => deleteRoom(r.id, r.name)}>Delete</button>}
                {r.name === 'general' && <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '0.2rem 0.5rem' }}>default</span>}
              </div>
            ))}
          </div>
        )}

        {/* Join Requests tab */}
        {tab === 'joins' && (
          <div>
            {joins.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>No pending join requests</div>}
            {joins.map(j => (
              <div key={`${j.roomId}-${j.userId}`} style={rowStyle}>
                <span style={{ flex: 1, color: 'var(--text)' }}>{j.username}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>→ #{j.roomName}</span>
                <button style={btnStyle('#2a9d5c')} onClick={() => approveJoin(j.roomId, j.userId)}>Approve</button>
                <button style={btnStyle('#c0392b')} onClick={() => rejectJoin(j.roomId, j.userId)}>Reject</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change-password sub-modal */}
      {pwTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem', width: 'min(360px,90vw)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>Set password for <span style={{ color: 'var(--accent)' }}>{pwTarget.username}</span></div>
            <input type="password" autoFocus value={newPw} placeholder="New password (min. 6 chars)" onChange={e => setNewPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitPassword()} style={{ padding: '0.65rem 0.9rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.9rem', outline: 'none' }} />
            {pwError && <div style={{ color: '#e55', fontSize: '0.78rem' }}>{pwError}</div>}
            {pwInfo  && <div style={{ color: 'var(--accent)', fontSize: '0.78rem' }}>{pwInfo}</div>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={submitPassword} style={{ ...btnStyle('var(--accent)'), color: '#000', flex: 1, padding: '0.6rem' }}>Update</button>
              <button onClick={() => setPwTarget(null)} style={{ ...btnStyle('var(--border)'), flex: 1, padding: '0.6rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

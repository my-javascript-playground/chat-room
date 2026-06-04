'use client';

import { useState, useEffect, useCallback } from 'react';

const SERVER_URL = 'http://localhost:8080';

interface UserRow {
  id:        number;
  username:  string;
  status:    'pending' | 'approved';
  role:      'user' | 'admin';
  createdAt: number;
}

export default function AdminPanel({
  token,
  onClose,
}: {
  token:   string;
  onClose: () => void;
}) {
  const [users,   setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Change-password modal
  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [newPw,    setNewPw]    = useState('');
  const [pwError,  setPwError]  = useState('');
  const [pwInfo,   setPwInfo]   = useState('');

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${SERVER_URL}/auth/admin/users`, { headers: authHeaders });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? 'Failed to load users');
      setUsers(body as UserRow[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function approve(id: number) {
    const res  = await fetch(`${SERVER_URL}/auth/admin/users/${id}/approve`, { method: 'PATCH', headers: authHeaders });
    if (res.ok) fetchUsers();
    else setError((await res.json())?.message ?? 'Failed');
  }

  async function remove(id: number, username: string) {
    if (!confirm(`Remove user "${username}"?`)) return;
    const res = await fetch(`${SERVER_URL}/auth/admin/users/${id}`, { method: 'DELETE', headers: authHeaders });
    if (res.ok) fetchUsers();
    else setError((await res.json())?.message ?? 'Failed');
  }

  async function submitPassword() {
    if (!pwTarget) return;
    setPwError('');
    if (newPw.trim().length < 6) { setPwError('Min. 6 characters'); return; }
    const res  = await fetch(`${SERVER_URL}/auth/admin/users/${pwTarget.id}/password`, {
      method:  'PATCH',
      headers: authHeaders,
      body:    JSON.stringify({ password: newPw.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setPwError(body?.message ?? 'Failed'); return; }
    setPwInfo('Password updated!');
    setNewPw('');
    setTimeout(() => { setPwTarget(null); setPwInfo(''); }, 1200);
  }

  const pending  = users.filter((u) => u.status === 'pending');
  const approved = users.filter((u) => u.status === 'approved');

  const rowStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    gap:            '0.5rem',
    padding:        '0.5rem 0.75rem',
    borderRadius:   6,
    background:     'var(--bg)',
    border:         '1px solid var(--border)',
    marginBottom:   '0.4rem',
    fontSize:       '0.82rem',
  };

  const btnStyle = (color: string): React.CSSProperties => ({
    padding:       '0.25rem 0.6rem',
    fontSize:      '0.72rem',
    fontWeight:    700,
    borderRadius:  4,
    border:        'none',
    cursor:        'pointer',
    background:    color,
    color:         '#fff',
    flexShrink:    0,
  });

  return (
    <div
      style={{
        position:   'fixed',
        inset:      0,
        background: 'rgba(0,0,0,0.6)',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex:     100,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width:        'min(520px, 95vw)',
          maxHeight:    '85vh',
          overflowY:    'auto',
          background:   'var(--surface)',
          border:       '1px solid var(--border)',
          borderRadius: 8,
          padding:      '1.5rem',
          display:      'flex',
          flexDirection: 'column',
          gap:          '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent)' }}>
            Admin Panel
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ color: '#e55', fontSize: '0.8rem' }}>{error}</div>}
        {loading && <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>Loading…</div>}

        {/* Pending */}
        <div>
          <div style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
            Pending approval — {pending.length}
          </div>
          {pending.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>No pending registrations</div>
          )}
          {pending.map((u) => (
            <div key={u.id} style={rowStyle}>
              <span style={{ flex: 1, color: 'var(--text)' }}>{u.username}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                {new Date(u.createdAt).toLocaleDateString()}
              </span>
              <button style={btnStyle('#2a9d5c')} onClick={() => approve(u.id)}>Approve</button>
              <button style={btnStyle('#c0392b')} onClick={() => remove(u.id, u.username)}>Reject</button>
            </div>
          ))}
        </div>

        {/* Approved */}
        <div>
          <div style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
            Approved users — {approved.length}
          </div>
          {approved.map((u) => (
            <div key={u.id} style={rowStyle}>
              <span style={{ flex: 1, color: 'var(--text)' }}>
                {u.username}
                {u.role === 'admin' && (
                  <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', background: 'var(--accent)', color: '#000', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>admin</span>
                )}
              </span>
              <button style={btnStyle('#555')} onClick={() => { setPwTarget(u); setNewPw(''); setPwError(''); setPwInfo(''); }}>
                Set password
              </button>
              {u.role !== 'admin' && (
                <button style={btnStyle('#c0392b')} onClick={() => remove(u.id, u.username)}>Remove</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Change password sub-modal */}
      {pwTarget && (
        <div
          style={{
            position:   'fixed',
            inset:      0,
            background: 'rgba(0,0,0,0.5)',
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex:     200,
          }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem', width: 'min(360px,90vw)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>
              Set password for <span style={{ color: 'var(--accent)' }}>{pwTarget.username}</span>
            </div>
            <input
              type="password"
              autoFocus
              value={newPw}
              placeholder="New password (min. 6 chars)"
              onChange={(e) => setNewPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
              style={{ padding: '0.65rem 0.9rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.9rem', outline: 'none' }}
            />
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

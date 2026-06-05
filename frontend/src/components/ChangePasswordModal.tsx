'use client';

import { useState, KeyboardEvent } from 'react';

import { SERVER_URL } from '@/lib/env';

export default function ChangePasswordModal({
  token,
  onClose,
}: {
  token:   string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [error,   setError]   = useState('');
  const [info,    setInfo]    = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(''); setInfo('');
    if (!current)           { setError('Enter your current password'); return; }
    if (next.length < 6)    { setError('New password must be at least 6 characters'); return; }
    if (next !== confirm)   { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const res  = await fetch(`${SERVER_URL}/auth/password`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ currentPassword: current, newPassword: next }),
        cache:   'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? 'Failed to update password');
      setInfo('Password updated successfully!');
      setTimeout(onClose, 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit();
  }

  const inputStyle: React.CSSProperties = {
    padding: '0.65rem 0.9rem',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    fontFamily: 'var(--mono)',
    fontSize: '0.9rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.68rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
    marginBottom: '0.3rem',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem', width: 'min(380px,92vw)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Change Password</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div><div style={labelStyle}>Current password</div><input type="password" autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} onKeyDown={handleKey} style={inputStyle} /></div>
        <div><div style={labelStyle}>New password</div><input type="password" value={next} placeholder="Min. 6 characters" onChange={(e) => setNext(e.target.value)} onKeyDown={handleKey} style={inputStyle} /></div>
        <div><div style={labelStyle}>Confirm new password</div><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={handleKey} style={inputStyle} /></div>

        {error && <div style={{ color: '#e55', fontSize: '0.78rem' }}>{error}</div>}
        {info  && <div style={{ color: 'var(--accent)', fontSize: '0.78rem' }}>{info}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ padding: '0.7rem', background: 'var(--accent)', color: '#000', fontFamily: 'var(--display)', fontWeight: 700, fontSize: '0.88rem', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </div>
  );
}

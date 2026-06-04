'use client';

import { useState, KeyboardEvent } from 'react';

export default function LoginScreen({
  onJoin,
}: {
  onJoin: (username: string) => void;
}) {
  const [username, setUsername] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleJoin() {
    const name = username.trim();
    if (!name) { setError('Please enter a username.'); return; }
    setError('');
    setLoading(true);
    try {
      // Optimistic: pass to the parent which triggers useChat → fetchToken
      onJoin(name);
    } catch {
      setError('Could not connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleJoin();
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        background:
          'radial-gradient(ellipse 60% 40% at 50% 60%, #00e5a018 0%, transparent 70%), var(--bg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          width: 'min(360px, 90vw)',
          padding: '2.5rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--display)',
            fontSize: '2rem',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            color: 'var(--accent)',
          }}
        >
          chat<span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>room</span>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              marginBottom: '0.4rem',
            }}
          >
            Your username
          </div>
          <input
            type="text"
            autoFocus
            value={username}
            maxLength={24}
            placeholder="e.g. alice"
            disabled={loading}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKey}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'var(--bg)',
              border: `1px solid ${error ? '#e55' : 'var(--border)'}`,
              borderRadius: 6,
              color: 'var(--text)',
              fontFamily: 'var(--mono)',
              fontSize: '0.95rem',
              outline: 'none',
              opacity: loading ? 0.6 : 1,
            }}
          />
          {error && (
            <div style={{ fontSize: '0.75rem', color: '#e55', marginTop: '0.35rem' }}>
              {error}
            </div>
          )}
        </div>

        <button
          onClick={handleJoin}
          disabled={loading}
          style={{
            padding: '0.8rem',
            background: 'var(--accent)',
            color: '#000',
            fontFamily: 'var(--display)',
            fontWeight: 700,
            fontSize: '0.9rem',
            letterSpacing: '0.05em',
            border: 'none',
            borderRadius: 6,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Connecting…' : 'Join room →'}
        </button>
      </div>
    </div>
  );
}

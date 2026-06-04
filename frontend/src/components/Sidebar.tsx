'use client';

import StatusBadge from './StatusBadge';
import { ConnectionStatus } from '@/types/chat';

export default function Sidebar({
  status,
  users,
  currentUser,
  isAdmin,
  onLogout,
  onAdminPanel,
  onChangePassword,
}: {
  status:           ConnectionStatus;
  users:            string[];
  currentUser:      string;
  isAdmin:          boolean;
  onLogout:         () => void;
  onAdminPanel:     () => void;
  onChangePassword: () => void;
}) {
  const btnBase: React.CSSProperties = {
    width:         '100%',
    padding:       '0.45rem 0.75rem',
    borderRadius:  6,
    border:        '1px solid var(--border)',
    background:    'var(--bg)',
    color:         'var(--text-dim)',
    fontFamily:    'var(--display)',
    fontWeight:    700,
    fontSize:      '0.75rem',
    letterSpacing: '0.05em',
    cursor:        'pointer',
    textAlign:     'left',
  };

  return (
    <aside
      style={{
        width:         220,
        flexShrink:    0,
        display:       'flex',
        flexDirection: 'column',
        background:    'var(--surface)',
        borderRight:   '1px solid var(--border)',
        padding:       '1.5rem 1rem',
        gap:           '1.5rem',
      }}
    >
      {/* Brand */}
      <div style={{ fontFamily: 'var(--display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent)' }}>
        chatroom
      </div>

      {/* Connection status */}
      <div>
        <div style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.5rem' }}>
          Connection
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Online users */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.5rem' }}>
          Online — {users.length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {users.map((u) => (
            <div
              key={u}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '0.5rem',
                fontSize:   '0.8rem',
                color:      u === currentUser ? 'var(--accent)' : 'var(--text-dim)',
                padding:    '0.3rem 0.5rem',
                borderRadius: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
              {u}{u === currentUser ? ' (you)' : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {isAdmin && (
          <button style={btnBase} onClick={onAdminPanel}>
            ⚙ Admin panel
          </button>
        )}
        <button style={btnBase} onClick={onChangePassword}>
          🔑 Change password
        </button>
        <button
          style={{ ...btnBase, color: '#e55', borderColor: '#e554' }}
          onClick={onLogout}
        >
          ⎋ Sign out
        </button>
      </div>
    </aside>
  );
}

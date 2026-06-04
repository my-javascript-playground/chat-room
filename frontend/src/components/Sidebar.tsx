'use client';

import { useState } from 'react';
import { ConnectionBadge, PresenceDot } from './StatusBadge';
import { ConnectionStatus, Room, UserPresence, PresenceStatus, DmConversation } from '@/types/chat';

const SERVER_URL = 'http://localhost:8080';

const PRESENCE_OPTIONS: { value: PresenceStatus; label: string }[] = [
  { value: 'online',  label: '🟢 Online'  },
  { value: 'away',    label: '🟡 Away'    },
  { value: 'offline', label: '⚫ Offline' },
];

export default function Sidebar({
  status, users, currentUser, isAdmin, onLogout, onAdminPanel, onChangePassword,
  rooms, currentRoom, onSwitchRoom, onExitRoom, unreadCounts,
  presenceStatus, onSetPresence, token, onOpenDm, dmConversations, dmUnread, activeDm,
}: {
  status:           ConnectionStatus;
  users:            UserPresence[];
  currentUser:      string;
  isAdmin:          boolean;
  onLogout:         () => void;
  onAdminPanel:     () => void;
  onChangePassword: () => void;
  rooms:            Room[];
  currentRoom:      Room | null;
  onSwitchRoom:     (roomId: number) => void;
  onExitRoom:       (roomId: number) => void;
  unreadCounts:     Record<number, number>;
  presenceStatus:   PresenceStatus;
  onSetPresence:    (s: PresenceStatus) => void;
  token:            string;
  onOpenDm:         (partner: string) => void;
  dmConversations:  DmConversation[];
  dmUnread:         Record<string, number>;
  activeDm:         string | null;
}) {
  const [showPresenceMenu, setShowPresenceMenu] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [dmTarget, setDmTarget] = useState('');

  const btnBase: React.CSSProperties = {
    width: '100%', padding: '0.45rem 0.75rem', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text-dim)', fontFamily: 'var(--display)', fontWeight: 700,
    fontSize: '0.75rem', letterSpacing: '0.05em', cursor: 'pointer', textAlign: 'left',
  };

  // All online users except self — for DM targets
  const dmableUsers = users.filter(u => u.username !== currentUser);

  return (
    <aside style={{
      width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
      padding: '1.25rem 0.9rem', gap: '1.1rem', overflowY: 'auto',
    }}>
      <div style={{ fontFamily: 'var(--display)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>
        chatroom
      </div>

      {/* Connection */}
      <div>
        <SectionLabel>Connection</SectionLabel>
        <ConnectionBadge status={status} />
      </div>

      {/* Presence */}
      <div style={{ position: 'relative' }}>
        <SectionLabel>My Status</SectionLabel>
        <button onClick={() => setShowPresenceMenu(v => !v)} style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <PresenceDot status={presenceStatus} size={8} />
          {PRESENCE_OPTIONS.find(o => o.value === presenceStatus)?.label.replace(/^\S+\s/, '') ?? presenceStatus}
          <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.65rem' }}>▾</span>
        </button>
        {showPresenceMenu && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
            {PRESENCE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => { onSetPresence(opt.value); setShowPresenceMenu(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.4rem 0.75rem', background: presenceStatus === opt.value ? '#00e5a015' : 'transparent', border: 'none', color: presenceStatus === opt.value ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--display)', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}>
                <PresenceDot status={opt.value} size={7} />
                {opt.label.replace(/^\S+\s/, '')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rooms */}
      <div>
        <SectionLabel>Rooms</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {rooms.map(r => {
            const isCurrent = currentRoom?.id === r.id;
            const unread    = unreadCounts[r.id] ?? 0;
            const isGeneral = r.name.toLowerCase() === 'general';

            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <button
                  onClick={() => onSwitchRoom(r.id)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.32rem 0.55rem', borderRadius: 6,
                    border:     isCurrent ? '1px solid var(--accent)' : '1px solid transparent',
                    background: isCurrent ? '#00e5a010' : 'transparent',
                    color:      isCurrent ? 'var(--accent)' : 'var(--text-dim)',
                    fontFamily: 'var(--mono)', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ opacity: 0.5 }}>#</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  {unread > 0 && (
                    <span style={{ background: 'var(--accent)', color: '#000', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 800, padding: '0 5px', minWidth: 16, textAlign: 'center', lineHeight: '16px', height: 16 }}>
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>

                {/* FIX 3: Only show exit button for non-general rooms */}
                {!isGeneral && (
                  <button
                    title="Leave room"
                    onClick={() => onExitRoom(r.id)}
                    style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.55 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Users in room */}
      <div>
        <SectionLabel>In Room — {users.length}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {users.map(u => (
            <div key={u.username}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: u.username === currentUser ? 'var(--accent)' : 'var(--text-dim)', padding: '0.25rem 0.4rem', borderRadius: 6, cursor: u.username !== currentUser ? 'pointer' : 'default' }}
              onClick={() => u.username !== currentUser && onOpenDm(u.username)}
              title={u.username !== currentUser ? `DM @${u.username}` : undefined}
            >
              <PresenceDot status={u.presenceStatus} size={7} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.username}{u.username === currentUser ? ' (you)' : ''}</span>
              {u.username !== currentUser && (
                <span style={{ fontSize: '0.6rem', opacity: 0.4 }}>💬</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* DM conversations */}
      {dmConversations.length > 0 && (
        <div>
          <SectionLabel>Direct Messages</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {dmConversations.map(c => {
              const isActive = activeDm === c.partner;
              const unread   = dmUnread[c.partner] ?? 0;
              return (
                <button key={c.partner} onClick={() => onOpenDm(c.partner)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.32rem 0.55rem', borderRadius: 6, width: '100%',
                    border:     isActive ? '1px solid var(--accent)' : '1px solid transparent',
                    background: isActive ? '#00e5a010' : 'transparent',
                    color:      isActive ? 'var(--accent)' : 'var(--text-dim)',
                    fontFamily: 'var(--mono)', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left',
                  }}>
                  <span style={{ opacity: 0.5 }}>@</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.partner}</span>
                  {unread > 0 && (
                    <span style={{ background: '#ff9944', color: '#000', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 800, padding: '0 5px', minWidth: 16, textAlign: 'center', lineHeight: '16px', height: 16 }}>
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: 'auto' }}>
        {isAdmin && <button style={btnBase} onClick={onAdminPanel}>⚙ Admin panel</button>}
        <button style={btnBase} onClick={onChangePassword}>🔑 Change password</button>
        <button style={{ ...btnBase, color: '#e55', borderColor: '#e554' }} onClick={onLogout}>⎋ Sign out</button>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.4rem' }}>
      {children}
    </div>
  );
}

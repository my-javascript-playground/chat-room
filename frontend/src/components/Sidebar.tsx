'use client';

import { useState, useEffect, useRef } from 'react';
import { ConnectionBadge, PresenceDot } from './StatusBadge';
import { ConnectionStatus, Room, UserPresence, PresenceStatus, DmConversation } from '@/types/chat';
import { SERVER_URL } from '@/lib/env';

const PRESENCE_OPTIONS: { value: PresenceStatus; label: string }[] = [
  { value: 'online',  label: '🟢 Online'  },
  { value: 'away',    label: '🟡 Away'    },
  { value: 'offline', label: '⚫ Offline' },
];

// ── Hamburger button — shown only on mobile ──────────────────────────────────
export function MobileMenuButton({ onClick, unreadTotal }: { onClick: () => void; unreadTotal: number }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open menu"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 38, height: 38, borderRadius: 8,
        border: '1px solid var(--border)', background: 'var(--surface)',
        cursor: 'pointer', position: 'relative', flexShrink: 0,
      }}
    >
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
        <rect width="18" height="2" rx="1" fill="var(--text-dim)" />
        <rect y="6" width="18" height="2" rx="1" fill="var(--text-dim)" />
        <rect y="12" width="18" height="2" rx="1" fill="var(--text-dim)" />
      </svg>
      {unreadTotal > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          background: 'var(--accent)', color: '#000',
          borderRadius: '999px', fontSize: '0.55rem', fontWeight: 800,
          padding: '0 4px', minWidth: 14, height: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {unreadTotal > 99 ? '99+' : unreadTotal}
        </span>
      )}
    </button>
  );
}

export default function Sidebar({
  status, users, currentUser, isAdmin, onLogout, onAdminPanel, onChangePassword,
  rooms, currentRoom, onSwitchRoom, onExitRoom, unreadCounts,
  presenceStatus, onSetPresence, token, onOpenDm, onCloseDmConversation,
  dmConversations, dmUnread, activeDm,
  mobileOpen, onMobileClose,
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
  onOpenDm:              (partner: string) => void;
  onCloseDmConversation: (partner: string) => void;
  dmConversations:  DmConversation[];
  dmUnread:         Record<string, number>;
  activeDm:         string | null;
  mobileOpen:       boolean;
  onMobileClose:    () => void;
}) {
  const [showPresenceMenu, setShowPresenceMenu] = useState(false);
  const presenceRef = useRef<HTMLDivElement>(null);

  // Close presence menu on outside click
  useEffect(() => {
    if (!showPresenceMenu) return;
    function handler(e: MouseEvent) {
      if (presenceRef.current && !presenceRef.current.contains(e.target as Node)) {
        setShowPresenceMenu(false);
      }
    }
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [showPresenceMenu]);

  // (mobile close is handled by backdrop onClick — no document listener needed)

  const btnBase: React.CSSProperties = {
    width: '100%', padding: '0.45rem 0.75rem', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text-dim)', fontFamily: 'var(--display)', fontWeight: 700,
    fontSize: '0.75rem', letterSpacing: '0.05em', cursor: 'pointer', textAlign: 'left',
  };

  const dmPartners = new Set(dmConversations.map(c => c.partner));
  // Build a global presence map from all known users (used for DM status dots)
  const globalPresence = new Map<string, PresenceStatus>(
    users.map(u => [u.username, u.presenceStatus])
  );

  function handleNavAction(fn: () => void) {
    fn();
    onMobileClose();
  }

  const sidebarContent = (
    <aside
      id="sidebar-aside"
      style={{
        width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        padding: '1.25rem 0.9rem', gap: '1.1rem', overflowY: 'auto',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--display)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>
          chat<span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>room</span>
        </div>
        {/* Close button — visible only in mobile drawer */}
        <button
          onClick={onMobileClose}
          className="mobile-only"
          aria-label="Close menu"
          style={{
            background: 'none', border: 'none', color: 'var(--text-dim)',
            cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0.2rem',
          }}
        >
          ✕
        </button>
      </div>

      {/* Connection */}
      <div>
        <SectionLabel>Connection</SectionLabel>
        <ConnectionBadge status={status} />
      </div>

      {/* My Status — dropdown */}
      <div style={{ position: 'relative' }} ref={presenceRef}>
        <SectionLabel>My Status</SectionLabel>
        <button
          onClick={() => setShowPresenceMenu(v => !v)}
          style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <PresenceDot status={presenceStatus} size={8} />
          {PRESENCE_OPTIONS.find(o => o.value === presenceStatus)?.label.replace(/^\S+\s/, '') ?? presenceStatus}
          <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.65rem' }}>
            {showPresenceMenu ? '▴' : '▾'}
          </span>
        </button>
        {showPresenceMenu && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 6, zIndex: 100, overflow: 'hidden', marginTop: 2,
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          }}>
            {PRESENCE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onSetPresence(opt.value); setShowPresenceMenu(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  width: '100%', padding: '0.45rem 0.75rem',
                  background: presenceStatus === opt.value ? '#00e5a015' : 'transparent',
                  border: 'none',
                  color: presenceStatus === opt.value ? 'var(--accent)' : 'var(--text)',
                  fontFamily: 'var(--display)', fontSize: '0.78rem',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
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
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <button
                  onClick={() => handleNavAction(() => onSwitchRoom(r.id))}
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
                    <span style={{
                      background: 'var(--accent)', color: '#000', borderRadius: '999px',
                      fontSize: '0.6rem', fontWeight: 800, padding: '0 5px',
                      minWidth: 16, textAlign: 'center', lineHeight: '16px', height: 16,
                    }}>
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>

                {!isGeneral && (
                  <button
                    title="Leave room"
                    onClick={() => onExitRoom(r.id)}
                    style={{
                      flexShrink: 0, width: 24, height: 24, borderRadius: 5,
                      border: '1px solid #cc333355', background: '#cc333322',
                      color: '#ff6666', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = '#cc333355'; el.style.borderColor = '#ff4444'; el.style.color = '#ffffff';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = '#cc333322'; el.style.borderColor = '#cc333355'; el.style.color = '#ff6666';
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* In Room */}
      <div>
        <SectionLabel>In Room — {users.length}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {users.map(u => {
            const isSelf = u.username === currentUser;
            const canDm  = !isSelf && (u.presenceStatus === 'online' || dmPartners.has(u.username));
            return (
              <div
                key={u.username}
                onClick={() => canDm && handleNavAction(() => onOpenDm(u.username))}
                title={canDm ? `DM @${u.username}` : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.78rem',
                  color: isSelf ? 'var(--accent)' : (canDm ? 'var(--text)' : 'var(--text-dim)'),
                  padding: '0.25rem 0.4rem', borderRadius: 6,
                  cursor: canDm ? 'pointer' : 'default',
                  opacity: isSelf ? 1 : (canDm ? 1 : 0.55),
                }}
              >
                <PresenceDot status={u.presenceStatus} size={7} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.username}{isSelf ? ' (you)' : ''}
                </span>
                {canDm && <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>💬</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Direct Messages */}
      {dmConversations.length > 0 && (
        <div>
          <SectionLabel>Direct Messages</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {dmConversations
              .map(c => {
                const isActive = activeDm === c.partner;
                const unread   = dmUnread[c.partner] ?? 0;
                const partnerPresence = globalPresence.get(c.partner) ?? 'offline';
                return (
                  <div key={c.partner} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <button
                      onClick={() => handleNavAction(() => onOpenDm(c.partner))}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.32rem 0.55rem', borderRadius: 6,
                        border:     isActive ? '1px solid var(--accent)' : '1px solid transparent',
                        background: isActive ? '#00e5a010' : 'transparent',
                        color:      isActive ? 'var(--accent)' : 'var(--text-dim)',
                        fontFamily: 'var(--mono)', fontSize: '0.78rem',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <PresenceDot status={partnerPresence} size={6} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.partner}
                      </span>
                      {unread > 0 && (
                        <span style={{
                          background: '#ff9944', color: '#000', borderRadius: '999px',
                          fontSize: '0.6rem', fontWeight: 800, padding: '0 5px',
                          minWidth: 16, textAlign: 'center', lineHeight: '16px', height: 16,
                        }}>
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </button>
                    <button
                      title="Remove from DM list"
                      onClick={e => { e.stopPropagation(); onCloseDmConversation(c.partner); }}
                      style={{
                        flexShrink: 0, width: 24, height: 24, borderRadius: 5,
                        border: '1px solid #cc333355', background: '#cc333322',
                        color: '#ff6666', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.background = '#cc333355'; el.style.borderColor = '#ff4444'; el.style.color = '#ffffff';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.background = '#cc333322'; el.style.borderColor = '#cc333355'; el.style.color = '#ff6666';
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: 'auto' }}>
        {isAdmin && <button style={btnBase} onClick={() => handleNavAction(onAdminPanel)}>⚙ Admin panel</button>}
        <button style={btnBase} onClick={() => handleNavAction(onChangePassword)}>🔑 Change password</button>
        <button style={{ ...btnBase, color: '#ff6666', borderColor: '#cc333355' }} onClick={onLogout}>⎋ Sign out</button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: always visible */}
      <div className="sidebar-desktop">
        {sidebarContent}
      </div>

      {/* Mobile: slide-in drawer with backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={onMobileClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 260, height: '100%', overflowY: 'auto' }}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase',
      color: 'var(--muted)', marginBottom: '0.4rem',
    }}>
      {children}
    </div>
  );
}

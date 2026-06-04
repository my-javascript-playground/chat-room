'use client';

import { ConnectionStatus, PresenceStatus } from '@/types/chat';

// ── WebSocket connection badge ────────────────────────────────────────────────
const CONN_CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  connected:    { label: 'connected',     color: '#00e5a0' },
  connecting:   { label: 'connecting…',   color: '#f0c040' },
  disconnected: { label: 'reconnecting…', color: '#ff9944' },
  error:        { label: 'error',         color: '#ff5e5e' },
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const { label, color } = CONN_CONFIG[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', padding: '0.25rem 0.6rem', borderRadius: '999px', border: `1px solid ${color}`, color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

// ── Presence status badge ─────────────────────────────────────────────────────
const PRESENCE_CONFIG: Record<PresenceStatus, { label: string; color: string; emoji: string }> = {
  online:  { label: 'Online',   color: '#00e5a0', emoji: '🟢' },
  away:    { label: 'Away',     color: '#f0c040', emoji: '🟡' },
  offline: { label: 'Offline',  color: '#888',    emoji: '⚫' },
};

export function PresenceDot({ status, size = 8 }: { status: PresenceStatus; size?: number }) {
  const { color } = PRESENCE_CONFIG[status];
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

export default function StatusBadge({ status }: { status: ConnectionStatus }) {
  return <ConnectionBadge status={status} />;
}

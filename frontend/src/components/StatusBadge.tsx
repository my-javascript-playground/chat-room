import { ConnectionStatus } from '@/types/chat';

const CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  connected:    { label: 'connected',    color: '#00e5a0' },
  connecting:   { label: 'connecting…',  color: '#f0c040' },
  disconnected: { label: 'reconnecting…',color: '#ff9944' },
  error:        { label: 'error',        color: '#ff5e5e' },
};

export default function StatusBadge({ status }: { status: ConnectionStatus }) {
  const { label, color } = CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.72rem',
        padding: '0.25rem 0.6rem',
        borderRadius: '999px',
        border: `1px solid ${color}`,
        color,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}

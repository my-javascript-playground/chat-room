'use client';

import { useEffect, useRef } from 'react';
import { MessageItem } from '@/types/chat';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MessageList({
  messages,
  currentUser,
}: {
  messages: MessageItem[];
  currentUser: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.15rem',
      }}
    >
      {messages.map((msg, i) => {
        // ── system notice ──────────────────────────────────────
        if (msg.kind === 'system') {
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: 'center',
                fontSize: '0.7rem',
                color: 'var(--muted)',
                padding: '0.2rem 0.8rem',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                margin: '0.5rem 0',
              }}
            >
              {msg.text}
            </div>
          );
        }

        // ── chat bubble ────────────────────────────────────────
        const isSelf = msg.username === currentUser;
        const prev   = messages[i - 1];
        const isGrouped =
          prev &&
          prev.kind === 'chat' &&
          prev.username === msg.username;

        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isSelf ? 'flex-end' : 'flex-start',
              alignSelf: isSelf ? 'flex-end' : 'flex-start',
              maxWidth: '72%',
              marginTop: isGrouped ? 0 : '0.75rem',
            }}
          >
            {/* meta row — hidden when grouped */}
            {!isGrouped && (
              <div
                style={{
                  fontSize: '0.65rem',
                  color: isSelf ? 'var(--accent)' : 'var(--muted)',
                  opacity: isSelf ? 0.7 : 1,
                  marginBottom: '0.25rem',
                  padding: '0 0.5rem',
                }}
              >
                {msg.username} · {formatTime(msg.timestamp)}
              </div>
            )}

            {/* bubble */}
            <div
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: '6px',
                fontSize: '0.88rem',
                lineHeight: 1.55,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                background: isSelf ? '#00e5a018' : 'var(--surface)',
                border: isSelf
                  ? '1px solid #00e5a035'
                  : '1px solid var(--border)',
                borderBottomRightRadius: isSelf ? 2 : 6,
                borderBottomLeftRadius: isSelf ? 6 : 2,
              }}
            >
              {msg.text}
            </div>
          </div>
        );
      })}

      {/* invisible scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}

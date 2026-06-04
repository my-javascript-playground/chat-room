'use client';

import { useEffect, useRef } from 'react';
import { MessageItem } from '@/types/chat';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Render text with @mentions highlighted */
function renderText(text: string, currentUser: string) {
  const parts = text.split(/(@[\w-]{1,24})/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name  = part.slice(1);
      const isMe  = name === currentUser;
      return (
        <span key={i} style={{ fontWeight: 700, color: isMe ? '#ff9944' : 'var(--accent)', background: isMe ? '#ff994415' : 'var(--accent)10', borderRadius: 3, padding: '0 2px' }}>
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function MessageList({
  messages,
  currentUser,
}: {
  messages:    MessageItem[];
  currentUser: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      {messages.map((msg, i) => {
        if (msg.kind === 'system') {
          return (
            <div key={msg.id} style={{ alignSelf: 'center', fontSize: '0.7rem', color: 'var(--muted)', padding: '0.2rem 0.8rem', borderRadius: '999px', border: '1px solid var(--border)', margin: '0.5rem 0' }}>
              {msg.text}
            </div>
          );
        }

        const isSelf     = msg.username === currentUser;
        const isMentioned = msg.mentions?.includes(currentUser);
        const prev        = messages[i - 1];
        const isGrouped   = prev && prev.kind === 'chat' && prev.username === msg.username;

        return (
          <div
            key={msg.id}
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems:  isSelf ? 'flex-end' : 'flex-start',
              alignSelf:   isSelf ? 'flex-end' : 'flex-start',
              maxWidth:    '72%',
              marginTop:   isGrouped ? 0 : '0.75rem',
            }}
          >
            {!isGrouped && (
              <div style={{ fontSize: '0.65rem', color: isSelf ? 'var(--accent)' : 'var(--muted)', opacity: isSelf ? 0.7 : 1, marginBottom: '0.25rem', padding: '0 0.5rem' }}>
                {msg.username} · {formatTime(msg.timestamp)}
              </div>
            )}
            <div
              style={{
                padding: '0.6rem 0.9rem', borderRadius: '6px', fontSize: '0.88rem', lineHeight: 1.55, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                background: isMentioned ? '#ff994410' : isSelf ? '#00e5a018' : 'var(--surface)',
                border: isMentioned
                  ? '1px solid #ff994450'
                  : isSelf ? '1px solid #00e5a035' : '1px solid var(--border)',
                borderBottomRightRadius: isSelf ? 2 : 6,
                borderBottomLeftRadius:  isSelf ? 6 : 2,
              }}
            >
              {renderText(msg.text, currentUser)}
              {isMentioned && (
                <span style={{ marginLeft: 6, fontSize: '0.65rem', color: '#ff9944', fontWeight: 700 }}>◀ you</span>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { DmMessage } from '@/types/chat';

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DirectMessagePanel({
  partner,
  currentUser,
  messages,
  onSend,
  onClose,
}: {
  partner:     string;
  currentUser: string;
  messages:    DmMessage[];
  onSend:      (text: string) => void;
  onClose:     () => void;
}) {
  const [draft,  setDraft]  = useState('');
  const bottomRef           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  return (
    <div style={{
      position:       'fixed',
      bottom:         '5rem',
      right:          '1.5rem',
      width:          'min(380px, 92vw)',
      height:         460,
      background:     'var(--surface)',
      border:         '1px solid var(--border)',
      borderRadius:   10,
      display:        'flex',
      flexDirection:  'column',
      boxShadow:      '0 8px 40px rgba(0,0,0,0.5)',
      zIndex:         150,
    }}>
      {/* Header */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        padding:       '0.75rem 1rem',
        borderBottom:  '1px solid var(--border)',
        gap:           '0.5rem',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: '0.9rem', flex: 1, color: 'var(--text)' }}>
          @{partner}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.25rem' }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>
            Start your conversation with @{partner}
          </div>
        )}
        {messages.map(msg => {
          const isSelf = msg.from === currentUser;
          return (
            <div key={msg.id} style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:    isSelf ? 'flex-end' : 'flex-start',
              alignSelf:     isSelf ? 'flex-end' : 'flex-start',
              maxWidth:      '85%',
            }}>
              <div style={{
                padding:             '0.5rem 0.8rem',
                borderRadius:        6,
                fontSize:            '0.83rem',
                lineHeight:          1.5,
                wordBreak:           'break-word',
                whiteSpace:          'pre-wrap',
                background:          isSelf ? '#00e5a018' : 'var(--bg)',
                border:              isSelf ? '1px solid #00e5a035' : '1px solid var(--border)',
                borderBottomRightRadius: isSelf ? 2 : 6,
                borderBottomLeftRadius:  isSelf ? 6 : 2,
              }}>
                {msg.text}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: '0.15rem', padding: '0 0.3rem' }}>
                {formatTime(msg.timestamp)}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder={`Message @${partner}…`}
          rows={1}
          style={{
            flex:        1,
            resize:      'none',
            minHeight:   36,
            maxHeight:   100,
            padding:     '0.5rem 0.75rem',
            background:  'var(--bg)',
            border:      '1px solid var(--border)',
            borderRadius: 6,
            color:       'var(--text)',
            fontFamily:  'var(--mono)',
            fontSize:    '0.82rem',
            outline:     'none',
            lineHeight:  1.4,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim()}
          style={{
            height:        36,
            padding:       '0 0.9rem',
            background:    'var(--accent)',
            color:         '#000',
            fontFamily:    'var(--display)',
            fontWeight:    700,
            fontSize:      '0.78rem',
            border:        'none',
            borderRadius:  6,
            cursor:        draft.trim() ? 'pointer' : 'not-allowed',
            opacity:       draft.trim() ? 1 : 0.35,
            flexShrink:    0,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

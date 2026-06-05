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
    <>
      {/* Desktop: floating panel bottom-right */}
      <div className="dm-panel-desktop" style={{
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
        <DmPanelContent
          partner={partner}
          currentUser={currentUser}
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          onSend={handleSend}
          onClose={onClose}
          onKey={handleKey}
          bottomRef={bottomRef}
        />
      </div>

      {/* Mobile: full-screen overlay */}
      <div className="dm-panel-mobile" style={{
        position:       'fixed',
        inset:          0,
        background:     'var(--bg)',
        display:        'flex',
        flexDirection:  'column',
        zIndex:         250,
      }}>
        <DmPanelContent
          partner={partner}
          currentUser={currentUser}
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          onSend={handleSend}
          onClose={onClose}
          onKey={handleKey}
          bottomRef={bottomRef}
        />
      </div>
    </>
  );
}

function DmPanelContent({
  partner, currentUser, messages, draft, setDraft,
  onSend, onClose, onKey, bottomRef,
}: {
  partner:     string;
  currentUser: string;
  messages:    DmMessage[];
  draft:       string;
  setDraft:    (v: string) => void;
  onSend:      () => void;
  onClose:     () => void;
  onKey:       (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  bottomRef:   React.RefObject<HTMLDivElement>;
}) {
  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', gap: '0.5rem',
        flexShrink: 0,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: '0.9rem', flex: 1, color: 'var(--text)' }}>
          @{partner}
        </span>
        <button
          onClick={onClose}
          title="Hide conversation"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            background: 'var(--bg)', border: '1px solid var(--border)',
            color: 'var(--text-dim)', cursor: 'pointer',
            borderRadius: 5, padding: '0.2rem 0.55rem',
            fontSize: '0.72rem', fontFamily: 'var(--display)', fontWeight: 700,
          }}
        >
          <span style={{ fontSize: '0.7rem' }}>✕</span> Hide
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '0.75rem 1rem',
        display: 'flex', flexDirection: 'column', gap: '0.4rem',
      }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>
            Start your conversation with @{partner}
          </div>
        )}
        {messages.map(msg => {
          const isSelf = msg.from === currentUser;
          return (
            <div key={msg.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isSelf ? 'flex-end' : 'flex-start',
              alignSelf:  isSelf ? 'flex-end' : 'flex-start',
              maxWidth:   '85%',
            }}>
              <div style={{
                padding: '0.5rem 0.8rem', borderRadius: 6,
                fontSize: '0.83rem', lineHeight: 1.5,
                wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                background: isSelf ? '#00e5a018' : 'var(--bg)',
                border:     isSelf ? '1px solid #00e5a035' : '1px solid var(--border)',
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
      <div style={{
        padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border)',
        display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0,
      }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Message @${partner}…`}
          rows={1}
          style={{
            flex: 1, resize: 'none', minHeight: 36, maxHeight: 100,
            padding: '0.5rem 0.75rem', background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 6,
            color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.82rem',
            outline: 'none', lineHeight: 1.4,
          }}
        />
        <button
          onClick={onSend}
          disabled={!draft.trim()}
          style={{
            height: 36, padding: '0 0.9rem', background: 'var(--accent)', color: '#000',
            fontFamily: 'var(--display)', fontWeight: 700, fontSize: '0.78rem',
            border: 'none', borderRadius: 6,
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
            opacity: draft.trim() ? 1 : 0.35, flexShrink: 0,
          }}
        >
          Send
        </button>
      </div>
    </>
  );
}

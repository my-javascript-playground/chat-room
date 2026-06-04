'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { ConnectionStatus } from '@/types/chat';

export default function MessageInput({
  status,
  onSend,
}: {
  status: ConnectionStatus;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft]   = useState('');
  const textareaRef         = useRef<HTMLTextAreaElement>(null);
  const isOpen              = status === 'connected';

  function handleSend() {
    if (!draft.trim() || !isOpen) return;
    onSend(draft);
    setDraft('');
    // reset height after clearing
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      style={{
        padding: '1rem 1.5rem',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-end',
        background: 'var(--bg)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!isOpen}
        placeholder={isOpen ? 'Type a message… (Enter to send)' : 'Connecting…'}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          minHeight: 44,
          maxHeight: 140,
          padding: '0.7rem 0.9rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--text)',
          fontFamily: 'var(--mono)',
          fontSize: '0.88rem',
          lineHeight: 1.5,
          outline: 'none',
          opacity: isOpen ? 1 : 0.4,
          cursor: isOpen ? 'text' : 'not-allowed',
        }}
      />
      <button
        onClick={handleSend}
        disabled={!isOpen || !draft.trim()}
        style={{
          height: 44,
          padding: '0 1.25rem',
          background: 'var(--accent)',
          color: '#000',
          fontFamily: 'var(--display)',
          fontWeight: 700,
          fontSize: '0.82rem',
          border: 'none',
          borderRadius: 6,
          cursor: isOpen && draft.trim() ? 'pointer' : 'not-allowed',
          opacity: isOpen && draft.trim() ? 1 : 0.35,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          transition: 'opacity 0.2s',
        }}
      >
        Send
      </button>
    </div>
  );
}

'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { ConnectionStatus, UserPresence } from '@/types/chat';

export default function MessageInput({
  status,
  onSend,
  users,
}: {
  status: ConnectionStatus;
  onSend: (text: string) => void;
  users:  UserPresence[];
}) {
  const [draft,       setDraft]       = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestIdx,  setSuggestIdx]  = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isOpen      = status === 'connected';

  // Detect @mention trigger
  useEffect(() => {
    const match = draft.match(/@([\w-]*)$/);
    if (!match) { setSuggestions([]); return; }
    const query = match[1].toLowerCase();
    const hits  = users.map(u => u.username).filter(u => u.toLowerCase().startsWith(query));
    setSuggestions(hits.slice(0, 6));
    setSuggestIdx(0);
  }, [draft, users]);

  function applySuggestion(username: string) {
    const newDraft = draft.replace(/@([\w-]*)$/, `@${username} `);
    setDraft(newDraft);
    setSuggestions([]);
    textareaRef.current?.focus();
  }

  function handleSend() {
    if (!draft.trim() || !isOpen) return;
    onSend(draft);
    setDraft('');
    setSuggestions([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setSuggestIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setSuggestIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && suggestions.length > 0)) {
        e.preventDefault();
        applySuggestion(suggestions[suggestIdx]);
        return;
      }
      if (e.key === 'Escape') { setSuggestions([]); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg)', position: 'relative' }}>
      {/* @mention autocomplete */}
      {suggestions.length > 0 && (
        <div style={{ position: 'absolute', bottom: '100%', left: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', zIndex: 100, minWidth: 180, marginBottom: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          {suggestions.map((u, i) => (
            <button
              key={u}
              onClick={() => applySuggestion(u)}
              style={{ display: 'block', width: '100%', padding: '0.4rem 0.75rem', background: i === suggestIdx ? 'var(--accent)20' : 'transparent', border: 'none', color: i === suggestIdx ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left' }}
            >
              @{u}
            </button>
          ))}
          <div style={{ padding: '0.25rem 0.75rem', fontSize: '0.65rem', color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>Tab / Enter to select</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isOpen}
          placeholder={isOpen ? 'Type a message… (@name to mention)' : 'Connecting…'}
          rows={1}
          style={{ flex: 1, resize: 'none', minHeight: 44, maxHeight: 140, padding: '0.7rem 0.9rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.88rem', lineHeight: 1.5, outline: 'none', opacity: isOpen ? 1 : 0.4, cursor: isOpen ? 'text' : 'not-allowed' }}
        />
        <button
          onClick={handleSend}
          disabled={!isOpen || !draft.trim()}
          style={{ height: 44, padding: '0 1.25rem', background: 'var(--accent)', color: '#000', fontFamily: 'var(--display)', fontWeight: 700, fontSize: '0.82rem', border: 'none', borderRadius: 6, cursor: isOpen && draft.trim() ? 'pointer' : 'not-allowed', opacity: isOpen && draft.trim() ? 1 : 0.35, whiteSpace: 'nowrap', flexShrink: 0, transition: 'opacity 0.2s' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

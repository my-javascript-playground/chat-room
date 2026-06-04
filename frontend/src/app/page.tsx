'use client';

import { useState } from 'react';
import LoginScreen from '@/components/LoginScreen';
import Sidebar     from '@/components/Sidebar';
import MessageList from '@/components/MessageList';
import MessageInput from '@/components/MessageInput';
import { useChat }  from '@/hooks/useChat';

export default function ChatPage() {
  const [username, setUsername] = useState<string | null>(null);

  const { messages, users, status, sendMessage } = useChat({
    username: username ?? '',
    enabled: !!username,
  });

  // ── Login screen ────────────────────────────────────────────────────────
  if (!username) {
    return <LoginScreen onJoin={setUsername} />;
  }

  // ── Chat UI ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <Sidebar status={status} users={users} currentUser={username} />

      {/* Main */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--text-dim)',
          }}
        >
          <strong
            style={{
              fontFamily: 'var(--display)',
              fontSize: '1rem',
              color: 'var(--text)',
              fontWeight: 700,
            }}
          >
            # general
          </strong>
          <span>{users.length} online</span>
        </div>

        {/* Messages */}
        <MessageList messages={messages} currentUser={username} />

        {/* Input */}
        <MessageInput status={status} onSend={sendMessage} />
      </main>
    </div>
  );
}

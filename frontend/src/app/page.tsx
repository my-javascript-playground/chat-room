'use client';

import { useState } from 'react';
import LoginScreen from '@/components/LoginScreen';
import Sidebar     from '@/components/Sidebar';
import MessageList from '@/components/MessageList';
import MessageInput from '@/components/MessageInput';
import { useChat }  from '@/hooks/useChat';

type AuthMode = 'login' | 'register';

interface Credentials {
  username: string;
  password: string;
  mode:     AuthMode;
}

export default function ChatPage() {
  const [creds, setCreds] = useState<Credentials | null>(null);

  const { messages, users, status, authError, sendMessage } = useChat({
    username: creds?.username ?? '',
    password: creds?.password ?? '',
    mode:     creds?.mode     ?? 'login',
    enabled:  !!creds,
  });

  // If auth failed after submitting, show login again with the error
  const showLogin = !creds || (status === 'error' && !!authError);

  if (showLogin) {
    return (
      <LoginScreen
        initialError={authError ?? undefined}
        onJoin={(username, password, mode) => {
          setCreds({ username, password, mode });
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      <Sidebar status={status} users={users} currentUser={creds.username} />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
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

        <MessageList messages={messages} currentUser={creds.username} />
        <MessageInput status={status} onSend={sendMessage} />
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import LoginScreen, { LoginResult } from '@/components/LoginScreen';
import Sidebar           from '@/components/Sidebar';
import MessageList       from '@/components/MessageList';
import MessageInput      from '@/components/MessageInput';
import AdminPanel        from '@/components/AdminPanel';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { useChat }       from '@/hooks/useChat';

interface Session {
  token:    string;
  username: string;
  role:     'user' | 'admin';
}

type Modal = 'none' | 'admin' | 'changePassword';

export default function ChatPage() {
  // ── Prevent SSR/CSR hydration mismatch ──────────────────────────────────
  // We render nothing on the server; only the client knows the auth state.
  const [mounted,  setMounted]  = useState(false);
  const [session,  setSession]  = useState<Session | null>(null);
  const [modal,    setModal]    = useState<Modal>('none');

  useEffect(() => { setMounted(true); }, []);

  const { messages, users, status, sendMessage, disconnect } = useChat({
    token:   session?.token ?? '',
    enabled: !!session,
  });

  // ── Not mounted yet — render nothing to avoid hydration mismatch ─────────
  if (!mounted) return null;

  // ── Login ────────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <LoginScreen
        onLogin={(result: LoginResult) => {
          setSession(result);
          setModal('none');
        }}
      />
    );
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  function handleLogout() {
    disconnect();
    setSession(null);
    setModal('none');
  }

  // ── Chat UI ──────────────────────────────────────────────────────────────
  return (
    <>
      <div
        style={{
          display:      'flex',
          flexDirection: 'row',
          height:       '100dvh',
          overflow:     'hidden',
        }}
      >
        <Sidebar
          status={status}
          users={users}
          currentUser={session.username}
          isAdmin={session.role === 'admin'}
          onLogout={handleLogout}
          onAdminPanel={() => setModal('admin')}
          onChangePassword={() => setModal('changePassword')}
        />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <div
            style={{
              padding:       '1rem 1.5rem',
              borderBottom:  '1px solid var(--border)',
              display:       'flex',
              alignItems:    'center',
              justifyContent: 'space-between',
              fontSize:      '0.8rem',
              color:         'var(--text-dim)',
            }}
          >
            <strong style={{ fontFamily: 'var(--display)', fontSize: '1rem', color: 'var(--text)', fontWeight: 700 }}>
              # general
            </strong>
            <span>{users.length} online</span>
          </div>

          <MessageList messages={messages} currentUser={session.username} />
          <MessageInput status={status} onSend={sendMessage} />
        </main>
      </div>

      {/* Modals */}
      {modal === 'admin' && (
        <AdminPanel token={session.token} onClose={() => setModal('none')} />
      )}
      {modal === 'changePassword' && (
        <ChangePasswordModal token={session.token} onClose={() => setModal('none')} />
      )}
    </>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import LoginScreen, { LoginResult } from '@/components/LoginScreen';
import Sidebar                       from '@/components/Sidebar';
import MessageList                   from '@/components/MessageList';
import MessageInput                  from '@/components/MessageInput';
import AdminPanel                    from '@/components/AdminPanel';
import ChangePasswordModal           from '@/components/ChangePasswordModal';
import { useChat }                   from '@/hooks/useChat';
import { Room }                      from '@/types/chat';

const SERVER_URL    = 'http://localhost:8080';
const SESSION_KEY   = 'chatroom_session';

interface Session { token: string; username: string; role: 'user' | 'admin'; }
type Modal = 'none' | 'admin' | 'changePassword';

// ── Session persistence helpers ───────────────────────────────────────────
function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || !s.username) return null;
    return s;
  } catch { return null; }
}

function saveSession(s: Session) {
  const json = JSON.stringify(s);
  localStorage.setItem(SESSION_KEY, json);     // survives full close+reopen
  sessionStorage.setItem(SESSION_KEY, json);   // cleared on tab close (belt+suspenders)
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export default function ChatPage() {
  const [mounted,  setMounted]  = useState(false);
  const [session,  setSession]  = useState<Session | null>(null);
  const [modal,    setModal]    = useState<Modal>('none');
  const [allRooms, setAllRooms] = useState<Room[]>([]);

  // Fix 5: Restore session from storage on first mount
  useEffect(() => {
    const saved = loadSession();
    if (saved) setSession(saved);
    setMounted(true);
  }, []);

  const handleAuthError = useCallback(() => {
    clearSession();
    setSession(null);
    setModal('none');
  }, []);

  const { messages, users, status, currentRoom, rooms, sendMessage, switchRoom, disconnect } = useChat({
    token:       session?.token ?? '',
    enabled:     !!session,
    onAuthError: handleAuthError,
  });

  // Fetch all rooms to compute joinable list
  const fetchAllRooms = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${SERVER_URL}/auth/rooms`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) setAllRooms(await res.json());
    } catch {}
  }, [session]);

  useEffect(() => { fetchAllRooms(); }, [fetchAllRooms, rooms]);

  if (!mounted) return null;

  if (!session) {
    return (
      <LoginScreen
        onLogin={(result: LoginResult) => {
          saveSession(result);    // Fix 5: persist on login
          setSession(result);
          setModal('none');
        }}
      />
    );
  }

  function handleLogout() {
    disconnect();
    clearSession();             // Fix 5: clear on logout
    setSession(null);
    setModal('none');
  }

  // Fix 2: Joinable = rooms user is NOT a member of, AND excluding "general"
  // (every approved user already has access to general automatically)
  const memberRoomIds = new Set(rooms.map(r => r.id));
  const joinableRooms = allRooms.filter(
    r => !memberRoomIds.has(r.id) && r.name.toLowerCase() !== 'general'
  );

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'row', height: '100dvh', overflow: 'hidden' }}>
        <Sidebar
          status={status}
          users={users}
          currentUser={session.username}
          isAdmin={session.role === 'admin'}
          onLogout={handleLogout}
          onAdminPanel={() => setModal('admin')}
          onChangePassword={() => setModal('changePassword')}
          rooms={rooms}
          currentRoom={currentRoom}
          onSwitchRoom={switchRoom}
          token={session.token}
        />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            <strong style={{ fontFamily: 'var(--display)', fontSize: '1rem', color: 'var(--text)', fontWeight: 700 }}>
              {currentRoom ? `# ${currentRoom.name}` : '# …'}
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span>{users.length} online</span>
              {/* Fix 2: Only show join button if there are non-general joinable rooms */}
              {joinableRooms.length > 0 && (
                <details style={{ position: 'relative', cursor: 'pointer' }}>
                  <summary style={{ listStyle: 'none', padding: '0.25rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
                    + Join room
                  </summary>
                  <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, zIndex: 50, minWidth: 180, padding: '0.5rem' }}>
                    {joinableRooms.map(r => (
                      <button
                        key={r.id}
                        onClick={async () => {
                          const res = await fetch(`${SERVER_URL}/auth/rooms/${r.id}/join`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${session.token}` },
                          });
                          const body = await res.json().catch(() => ({}));
                          alert(body?.message ?? (res.ok ? 'Request sent!' : 'Error'));
                          fetchAllRooms();
                        }}
                        style={{ display: 'block', width: '100%', padding: '0.4rem 0.6rem', background: 'none', border: 'none', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', borderRadius: 4 }}
                      >
                        # {r.name}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>

          <MessageList messages={messages} currentUser={session.username} />
          <MessageInput status={status} onSend={sendMessage} />
        </main>
      </div>

      {modal === 'admin'          && <AdminPanel token={session.token} onClose={() => setModal('none')} />}
      {modal === 'changePassword' && <ChangePasswordModal token={session.token} onClose={() => setModal('none')} />}
    </>
  );
}

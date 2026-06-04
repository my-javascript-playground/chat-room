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

const SERVER_URL = 'http://localhost:8080';

interface Session { token: string; username: string; role: 'user' | 'admin'; }
type Modal = 'none' | 'admin' | 'changePassword';

export default function ChatPage() {
  const [mounted,  setMounted]  = useState(false);
  const [session,  setSession]  = useState<Session | null>(null);
  const [modal,    setModal]    = useState<Modal>('none');
  const [allRooms, setAllRooms] = useState<Room[]>([]);

  useEffect(() => { setMounted(true); }, []);

  const { messages, users, status, currentRoom, rooms, sendMessage, switchRoom, disconnect } = useChat({
    token:   session?.token ?? '',
    enabled: !!session,
  });

  // Fetch all rooms (for join requests) when logged in
  const fetchAllRooms = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${SERVER_URL}/auth/rooms`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (res.ok) setAllRooms(await res.json());
    } catch {}
  }, [session]);

  useEffect(() => { fetchAllRooms(); }, [fetchAllRooms]);

  if (!mounted) return null;

  if (!session) {
    return <LoginScreen onLogin={(result: LoginResult) => { setSession(result); setModal('none'); }} />;
  }

  function handleLogout() { disconnect(); setSession(null); setModal('none'); }

  // Rooms the user is NOT yet a member of (for join requests from sidebar)
  const memberRoomIds = new Set(rooms.map(r => r.id));
  const joinableRooms = allRooms.filter(r => !memberRoomIds.has(r.id));

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
              {/* Join other rooms */}
              {joinableRooms.length > 0 && (
                <details style={{ position: 'relative', cursor: 'pointer' }}>
                  <summary style={{ listStyle: 'none', padding: '0.25rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
                    + Join room
                  </summary>
                  <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, zIndex: 50, minWidth: 180, padding: '0.5rem' }}>
                    {joinableRooms.map(r => {
                      const req = allRooms.find(a => a.id === r.id);
                      const isPending = req?.memberStatus === 'none';
                      return (
                        <button
                          key={r.id}
                          onClick={async () => {
                            const res = await fetch(`${SERVER_URL}/auth/rooms/${r.id}/join`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } });
                            const body = await res.json().catch(() => ({}));
                            alert(body?.message ?? (res.ok ? 'Request sent!' : 'Error'));
                          }}
                          style={{ display: 'block', width: '100%', padding: '0.4rem 0.6rem', background: 'none', border: 'none', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', borderRadius: 4 }}
                        >
                          # {r.name}
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          </div>

          <MessageList messages={messages} currentUser={session.username} />
          <MessageInput status={status} onSend={sendMessage} />
        </main>
      </div>

      {modal === 'admin' && <AdminPanel token={session.token} onClose={() => setModal('none')} />}
      {modal === 'changePassword' && <ChangePasswordModal token={session.token} onClose={() => setModal('none')} />}
    </>
  );
}

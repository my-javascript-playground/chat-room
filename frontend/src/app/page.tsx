'use client';

import { useState, useEffect, useCallback } from 'react';
import LoginScreen, { LoginResult }  from '@/components/LoginScreen';
import Sidebar                        from '@/components/Sidebar';
import MessageList                    from '@/components/MessageList';
import MessageInput                   from '@/components/MessageInput';
import AdminPanel                     from '@/components/AdminPanel';
import ChangePasswordModal            from '@/components/ChangePasswordModal';
import DirectMessagePanel             from '@/components/DirectMessagePanel';
import { useChat }                    from '@/hooks/useChat';
import { Room, MentionNotification }  from '@/types/chat';

const SERVER_URL  = 'http://localhost:8080';
const SESSION_KEY = 'chatroom_session';

interface Session { token: string; username: string; role: 'user' | 'admin'; }
type Modal = 'none' | 'admin' | 'changePassword';

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
  const j = JSON.stringify(s);
  localStorage.setItem(SESSION_KEY, j);
  sessionStorage.setItem(SESSION_KEY, j);
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

  useEffect(() => {
    const saved = loadSession();
    if (saved) setSession(saved);
    setMounted(true);
  }, []);

  const handleAuthError = useCallback(() => {
    clearSession(); setSession(null); setModal('none');
  }, []);

  const {
    messages, users, status, currentRoom, rooms,
    unreadCounts, mentions, presenceStatus,
    dmMessages, dmConversations, dmUnread, activeDm,
    sendMessage, switchRoom, exitRoom, setPresence,
    clearMention, markRoomRead,
    sendDm, openDm, closeDm,
    disconnect,
  } = useChat({ token: session?.token ?? '', username: session?.username ?? '', enabled: !!session, onAuthError: handleAuthError });

  const fetchAllRooms = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${SERVER_URL}/auth/rooms`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (res.ok) setAllRooms(await res.json());
    } catch {}
  }, [session]);

  useEffect(() => { fetchAllRooms(); }, [fetchAllRooms, rooms]);

  const handleSwitchRoom = useCallback((roomId: number) => {
    markRoomRead(roomId);
    switchRoom(roomId);
  }, [switchRoom, markRoomRead]);

  if (!mounted) return null;

  if (!session) {
    return (
      <LoginScreen onLogin={(result: LoginResult) => {
        saveSession(result); setSession(result); setModal('none');
      }} />
    );
  }

  function handleLogout() { disconnect(); clearSession(); setSession(null); setModal('none'); }

  const memberRoomIds = new Set(rooms.map(r => r.id));
  const joinableRooms = allRooms.filter(r => !memberRoomIds.has(r.id) && r.name.toLowerCase() !== 'general');

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
          onSwitchRoom={handleSwitchRoom}
          onExitRoom={exitRoom}
          unreadCounts={unreadCounts}
          presenceStatus={presenceStatus}
          onSetPresence={setPresence}
          token={session.token}
          onOpenDm={openDm}
          dmConversations={dmConversations}
          dmUnread={dmUnread}
          activeDm={activeDm}
        />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            <strong style={{ fontFamily: 'var(--display)', fontSize: '1rem', color: 'var(--text)', fontWeight: 700 }}>
              {currentRoom ? `# ${currentRoom.name}` : '# …'}
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span>{users.length} in room</span>
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
                          const res  = await fetch(`${SERVER_URL}/auth/rooms/${r.id}/join`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } });
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
          <MessageInput status={status} onSend={sendMessage} users={users} />
        </main>
      </div>

      {/* DM panel */}
      {activeDm && (
        <DirectMessagePanel
          partner={activeDm}
          currentUser={session.username}
          messages={dmMessages[activeDm] ?? []}
          onSend={text => sendDm(activeDm, text)}
          onClose={closeDm}
        />
      )}

      {/* Mention toasts */}
      {mentions.length > 0 && (
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 200, maxWidth: 320 }}>
          {mentions.map((m: MentionNotification) => (
            <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid #ff9944', borderRadius: 8, padding: '0.75rem 1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 700, color: '#ff9944' }}>@mention in #{m.roomName}</span>
                <button onClick={() => clearMention(m.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
              </div>
              <div style={{ color: 'var(--text-dim)', marginBottom: '0.4rem' }}>
                <strong style={{ color: 'var(--text)' }}>{m.username}</strong>: {m.text.slice(0, 100)}{m.text.length > 100 ? '…' : ''}
              </div>
              <button onClick={() => { handleSwitchRoom(m.roomId); clearMention(m.id); }} style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', border: '1px solid #ff9944', borderRadius: 4, background: 'none', color: '#ff9944', cursor: 'pointer' }}>
                Go to room →
              </button>
            </div>
          ))}
        </div>
      )}

      {modal === 'admin'          && <AdminPanel token={session.token} onClose={() => setModal('none')} />}
      {modal === 'changePassword' && <ChangePasswordModal token={session.token} onClose={() => setModal('none')} />}
    </>
  );
}

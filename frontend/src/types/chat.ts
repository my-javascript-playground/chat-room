// ── Message types received FROM the server ────────────────────────────────

export interface ChatMessage {
  type: 'chat';
  id: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface HistoryPayload {
  type: 'history';
  messages: ChatMessage[];
}

export interface UserListPayload {
  type: 'user_list';
  users: string[];
}

export interface UserJoinedPayload {
  type: 'user_joined';
  username: string;
  timestamp: number;
}

export interface UserLeftPayload {
  type: 'user_left';
  username: string;
  timestamp: number;
}

// ── Rendered message items (union of chat + system notices) ───────────────

export interface SystemItem {
  kind: 'system';
  id: string;
  text: string;
  timestamp: number;
}

export interface ChatItem extends ChatMessage {
  kind: 'chat';
}

export type MessageItem = ChatItem | SystemItem;

// ── Connection status ──────────────────────────────────────────────────────

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

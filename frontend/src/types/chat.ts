export type PresenceStatus = 'online' | 'away' | 'offline';

export interface UserPresence {
  username:       string;
  presenceStatus: PresenceStatus;
}

export interface ChatMessage {
  type:      'chat';
  id:        string;
  username:  string;
  text:      string;
  timestamp: number;
  mentions?: string[];
}

export interface DmMessage {
  id:        string;
  from:      string;
  to:        string;
  text:      string;
  timestamp: number;
}

export interface DmConversation {
  partner:     string;
  lastMessage: string;
  lastAt:      number;
}

export interface MentionNotification extends ChatMessage {
  roomId:   number;
  roomName: string;
}

export interface SystemItem {
  kind:      'system';
  id:        string;
  text:      string;
  timestamp: number;
}

export interface ChatItem extends ChatMessage {
  kind: 'chat';
}

export type MessageItem = ChatItem | SystemItem;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface Room {
  id:           number;
  name:         string;
  createdBy:    number;
  createdAt:    number;
  memberStatus?: 'approved' | 'none';
}

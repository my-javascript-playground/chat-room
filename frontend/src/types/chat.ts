export interface ChatMessage {
  type: 'chat';
  id: string;
  username: string;
  text: string;
  timestamp: number;
}

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

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface Room {
  id:           number;
  name:         string;
  createdBy:    number;
  createdAt:    number;
  memberStatus?: 'approved' | 'none';
}

export interface ChatMessage {
  type:      'chat';
  id:        string;
  username:  string;
  text:      string;
  timestamp: number;
  mentions?: string[];
}

export interface SystemMessage {
  type: 'system';
  text: string;
  timestamp: number;
}

export interface HistoryMessage {
  type:     'history';
  messages: ChatMessage[];
}

export interface UserListMessage {
  type:  'user_list';
  users: UserPresence[];
}

export interface UserJoinedMessage {
  type:      'user_joined';
  username:  string;
  roomId:    number;
  timestamp: number;
}

export interface UserLeftMessage {
  type:      'user_left';
  username:  string;
  roomId:    number;
  timestamp: number;
}

export interface UserOnlineMessage {
  type:           'user_online';
  username:       string;
  presenceStatus: PresenceStatus;
  timestamp:      number;
}

export interface UserExitedRoomMessage {
  type:      'user_exited_room';
  username:  string;
  roomId:    number;
  timestamp: number;
}

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface UserPresence {
  username:       string;
  presenceStatus: PresenceStatus;
}

export type ServerMessage =
  | ChatMessage | SystemMessage | HistoryMessage | UserListMessage
  | UserJoinedMessage | UserLeftMessage | UserOnlineMessage | UserExitedRoomMessage;

export interface SendChatPayload {
  text:      string;
  mentions?: string[];
}

export interface SetPresencePayload {
  status: PresenceStatus;
}

export interface ExitRoomPayload {
  roomId: number;
}

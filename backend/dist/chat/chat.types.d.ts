export interface ChatMessage {
    type: 'chat';
    id: string;
    username: string;
    text: string;
    timestamp: number;
}
export interface SystemMessage {
    type: 'system';
    text: string;
    timestamp: number;
}
export interface HistoryMessage {
    type: 'history';
    messages: ChatMessage[];
}
export interface UserListMessage {
    type: 'user_list';
    users: string[];
}
export interface UserJoinedMessage {
    type: 'user_joined';
    username: string;
    timestamp: number;
}
export interface UserLeftMessage {
    type: 'user_left';
    username: string;
    timestamp: number;
}
export type ServerMessage = ChatMessage | SystemMessage | HistoryMessage | UserListMessage | UserJoinedMessage | UserLeftMessage;
export interface SendChatPayload {
    text: string;
}

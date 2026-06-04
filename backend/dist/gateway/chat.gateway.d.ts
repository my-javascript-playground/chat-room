import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SendChatPayload } from '../chat/chat.types';
import { AuthService } from '../auth/auth.service';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly auth;
    server: Server;
    constructor(auth: AuthService);
    private getUserList;
    private saveToHistory;
    private broadcastUserList;
    private verifyHandshake;
    private checkRateLimit;
    handleConnection(socket: Socket): void;
    handleDisconnect(socket: Socket): void;
    handleChat(socket: Socket, payload: SendChatPayload): void;
}

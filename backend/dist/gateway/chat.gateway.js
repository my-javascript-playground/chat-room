"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const crypto_1 = require("crypto");
const auth_service_1 = require("../auth/auth.service");
const clients = new Map();
const history = [];
const MAX_HISTORY = 50;
const MSG_WINDOW_MS = 5_000;
const MSG_MAX = 10;
const rateLimits = new Map();
let ChatGateway = class ChatGateway {
    constructor(auth) {
        this.auth = auth;
    }
    getUserList() {
        return [...clients.values()].map((c) => c.username);
    }
    saveToHistory(msg) {
        history.push(msg);
        if (history.length > MAX_HISTORY)
            history.shift();
    }
    broadcastUserList() {
        const payload = { type: 'user_list', users: this.getUserList() };
        this.server.emit('user_list', payload);
    }
    verifyHandshake(socket) {
        try {
            const header = socket.handshake.headers['authorization'] ?? '';
            const fromHeader = header.startsWith('Bearer ')
                ? header.slice(7).trim()
                : '';
            const fromAuth = socket.handshake.auth.token ?? '';
            const raw = fromHeader || fromAuth;
            if (!raw)
                return null;
            const payload = this.auth.verify(raw);
            return payload.username ?? null;
        }
        catch {
            return null;
        }
    }
    checkRateLimit(socketId) {
        const now = Date.now();
        const entry = rateLimits.get(socketId) ?? { timestamps: [] };
        entry.timestamps = entry.timestamps.filter((t) => now - t < MSG_WINDOW_MS);
        if (entry.timestamps.length >= MSG_MAX) {
            rateLimits.set(socketId, entry);
            return false;
        }
        entry.timestamps.push(now);
        rateLimits.set(socketId, entry);
        return true;
    }
    handleConnection(socket) {
        const username = this.verifyHandshake(socket);
        if (!username) {
            socket.emit('auth_error', {
                message: 'Missing or invalid auth token. Connect via POST /auth/token first.',
            });
            socket.disconnect(true);
            console.warn(`[!] Rejected unauthenticated connection from ${socket.id}`);
            return;
        }
        const duplicate = [...clients.values()].find((c) => c.username === username);
        if (duplicate) {
            socket.emit('auth_error', { message: 'Username already connected.' });
            socket.disconnect(true);
            console.warn(`[!] Duplicate username "${username}" rejected`);
            return;
        }
        clients.set(socket.id, { username, socketId: socket.id });
        console.log(`[+] ${username} connected  (total: ${clients.size})`);
        socket.emit('history', { type: 'history', messages: history });
        socket.emit('user_list', { type: 'user_list', users: this.getUserList() });
        socket.broadcast.emit('user_joined', {
            type: 'user_joined',
            username,
            timestamp: Date.now(),
        });
        this.broadcastUserList();
    }
    handleDisconnect(socket) {
        const client = clients.get(socket.id);
        rateLimits.delete(socket.id);
        if (!client)
            return;
        clients.delete(socket.id);
        console.log(`[-] ${client.username} disconnected  (total: ${clients.size})`);
        this.server.emit('user_left', {
            type: 'user_left',
            username: client.username,
            timestamp: Date.now(),
        });
        this.broadcastUserList();
    }
    handleChat(socket, payload) {
        const client = clients.get(socket.id);
        if (!client)
            return;
        if (!this.checkRateLimit(socket.id)) {
            socket.emit('error_msg', { message: 'Rate limit exceeded. Slow down.' });
            return;
        }
        const text = (payload.text ?? '').trim().slice(0, 500);
        if (!text)
            return;
        const msg = {
            type: 'chat',
            id: (0, crypto_1.randomUUID)(),
            username: client.username,
            text,
            timestamp: Date.now(),
        };
        this.saveToHistory(msg);
        this.server.emit('chat', msg);
        console.log(`[msg] ${client.username}: ${text}`);
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('chat'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleChat", null);
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: 'http://localhost:3000',
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map
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
exports.TokenController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const user_service_1 = require("../auth/user.service");
function sanitizeUsername(raw) {
    return raw.trim().slice(0, 24).replace(/[<>"']/g, '');
}
let TokenController = class TokenController {
    constructor(auth, users) {
        this.auth = auth;
        this.users = users;
    }
    async register(body) {
        const username = sanitizeUsername(body.username ?? '');
        if (!username)
            throw new common_1.BadRequestException('username is required');
        const password = (body.password ?? '').trim();
        if (password.length < 6)
            throw new common_1.BadRequestException('password must be at least 6 characters');
        try {
            await this.users.register(username, password);
        }
        catch (err) {
            if (err.message === 'Username already taken')
                throw new common_1.ConflictException('Username already taken');
            throw err;
        }
        const token = this.auth.sign(username);
        return { token };
    }
    async getToken(body) {
        const username = sanitizeUsername(body.username ?? '');
        if (!username)
            throw new common_1.BadRequestException('username is required');
        const password = (body.password ?? '').trim();
        if (!password)
            throw new common_1.BadRequestException('password is required');
        const user = await this.users.verify(username, password);
        if (!user)
            throw new common_1.UnauthorizedException('Invalid username or password');
        const token = this.auth.sign(user.username);
        return { token };
    }
};
exports.TokenController = TokenController;
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TokenController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('token'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TokenController.prototype, "getToken", null);
exports.TokenController = TokenController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        user_service_1.UserService])
], TokenController);
//# sourceMappingURL=token.controller.js.map
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
const admin_guard_1 = require("../auth/admin.guard");
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
        return { message: 'Registration submitted. Please wait for admin approval.' };
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
        if (user.status === 'pending')
            throw new common_1.ForbiddenException('Your account is pending admin approval');
        const token = this.auth.sign(username);
        return { token, role: user.role };
    }
    async changeOwnPassword(authHeader = '', body) {
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        if (!token)
            throw new common_1.UnauthorizedException('Missing token');
        let payload;
        try {
            payload = this.auth.verify(token);
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired token');
        }
        const user = this.users.findByUsername(payload.username);
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        const current = (body.currentPassword ?? '').trim();
        const next = (body.newPassword ?? '').trim();
        if (!current)
            throw new common_1.BadRequestException('currentPassword is required');
        if (next.length < 6)
            throw new common_1.BadRequestException('newPassword must be at least 6 characters');
        const verified = await this.users.verify(user.username, current);
        if (!verified)
            throw new common_1.UnauthorizedException('Current password is incorrect');
        await this.users.changePassword(user.id, next);
        return { message: 'Password updated successfully' };
    }
    listUsers() {
        return this.users.listAll().map(({ passwordHash: _, ...u }) => u);
    }
    approveUser(id) {
        const ok = this.users.approve(id);
        if (!ok)
            throw new common_1.BadRequestException('User not found');
        return { message: 'User approved' };
    }
    removeUser(id, authHeader = '') {
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const payload = this.auth.verify(token);
        const self = this.users.findByUsername(payload.username);
        if (self?.id === id)
            throw new common_1.BadRequestException('Cannot delete your own account');
        const ok = this.users.remove(id);
        if (!ok)
            throw new common_1.BadRequestException('User not found');
        return { message: 'User removed' };
    }
    async adminChangePassword(id, body) {
        const newPassword = (body.password ?? '').trim();
        if (newPassword.length < 6)
            throw new common_1.BadRequestException('password must be at least 6 characters');
        const ok = await this.users.changePassword(id, newPassword);
        if (!ok)
            throw new common_1.BadRequestException('User not found');
        return { message: 'Password updated' };
    }
};
exports.TokenController = TokenController;
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.HttpCode)(202),
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
__decorate([
    (0, common_1.Patch)('password'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TokenController.prototype, "changeOwnPassword", null);
__decorate([
    (0, common_1.Get)('admin/users'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], TokenController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Patch)('admin/users/:id/approve'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Object)
], TokenController.prototype, "approveUser", null);
__decorate([
    (0, common_1.Delete)('admin/users/:id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Object)
], TokenController.prototype, "removeUser", null);
__decorate([
    (0, common_1.Patch)('admin/users/:id/password'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], TokenController.prototype, "adminChangePassword", null);
exports.TokenController = TokenController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        user_service_1.UserService])
], TokenController);
//# sourceMappingURL=token.controller.js.map
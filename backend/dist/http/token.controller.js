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
let TokenController = class TokenController {
    constructor(auth) {
        this.auth = auth;
    }
    getToken(body) {
        const raw = (body.username ?? '').trim();
        if (!raw)
            throw new common_1.BadRequestException('username is required');
        const username = raw.slice(0, 24).replace(/[<>"']/g, '');
        if (!username)
            throw new common_1.BadRequestException('username contains only invalid characters');
        const token = this.auth.sign(username);
        return { token };
    }
};
exports.TokenController = TokenController;
__decorate([
    (0, common_1.Post)('token'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], TokenController.prototype, "getToken", null);
exports.TokenController = TokenController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], TokenController);
//# sourceMappingURL=token.controller.js.map
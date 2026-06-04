import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UserService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'] ?? '';
    const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!token) throw new UnauthorizedException('Missing token');

    let payload: { username: string };
    try {
      payload = this.auth.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = this.users.findByUsername(payload.username);
    if (!user || user.role !== 'admin')
      throw new ForbiddenException('Admin access required');

    return true;
  }
}

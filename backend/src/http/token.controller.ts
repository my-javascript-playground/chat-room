import {
  Controller,
  Post,
  Body,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../auth/user.service';

interface AuthBody {
  username?: string;
  password?: string;
}

function sanitizeUsername(raw: string): string {
  return raw.trim().slice(0, 24).replace(/[<>"']/g, '');
}

/**
 * POST /auth/register  — create account, return JWT
 * POST /auth/token     — login with password, return JWT
 */
@Controller('auth')
export class TokenController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UserService,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() body: AuthBody): Promise<{ token: string }> {
    const username = sanitizeUsername(body.username ?? '');
    if (!username) throw new BadRequestException('username is required');

    const password = (body.password ?? '').trim();
    if (password.length < 6)
      throw new BadRequestException('password must be at least 6 characters');

    try {
      await this.users.register(username, password);
    } catch (err: any) {
      if (err.message === 'Username already taken')
        throw new ConflictException('Username already taken');
      throw err;
    }

    const token = this.auth.sign(username);
    return { token };
  }

  @Post('token')
  @HttpCode(200)
  async getToken(@Body() body: AuthBody): Promise<{ token: string }> {
    const username = sanitizeUsername(body.username ?? '');
    if (!username) throw new BadRequestException('username is required');

    const password = (body.password ?? '').trim();
    if (!password) throw new BadRequestException('password is required');

    const user = await this.users.verify(username, password);
    if (!user) throw new UnauthorizedException('Invalid username or password');

    const token = this.auth.sign(user.username);
    return { token };
  }
}

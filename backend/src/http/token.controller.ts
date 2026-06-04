import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

interface JoinBody {
  username?: string;
}

/**
 * POST /auth/token
 *
 * Accepts a username and returns a short-lived JWT.
 * The frontend must include this token in the WS handshake.
 *
 * In a real app you would also verify a password / session here.
 */
@Controller('auth')
export class TokenController {
  constructor(private readonly auth: AuthService) {}

  @Post('token')
  @HttpCode(200)
  getToken(@Body() body: JoinBody): { token: string } {
    const raw = (body.username ?? '').trim();
    if (!raw) throw new BadRequestException('username is required');

    const username = raw.slice(0, 24).replace(/[<>"']/g, '');
    if (!username) throw new BadRequestException('username contains only invalid characters');

    const token = this.auth.sign(username);
    return { token };
  }
}

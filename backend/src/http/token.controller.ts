import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  HttpCode,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { AuthService }  from '../auth/auth.service';
import { UserService }  from '../auth/user.service';
import { AdminGuard }   from '../auth/admin.guard';

interface AuthBody       { username?: string; password?: string; }
interface PasswordBody   { password?: string; }

function sanitizeUsername(raw: string): string {
  return raw.trim().slice(0, 24).replace(/[<>"']/g, '');
}

@Controller('auth')
export class TokenController {
  constructor(
    private readonly auth:  AuthService,
    private readonly users: UserService,
  ) {}

  // ── Public ────────────────────────────────────────────────────────────────

  /**
   * POST /auth/register
   * Creates a pending account. Does NOT return a token — admin must approve first.
   */
  @Post('register')
  @HttpCode(202)
  async register(@Body() body: AuthBody): Promise<{ message: string }> {
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

    return { message: 'Registration submitted. Please wait for admin approval.' };
  }

  /**
   * POST /auth/token
   * Returns a JWT only if the user is approved.
   */
  @Post('token')
  @HttpCode(200)
  async getToken(@Body() body: AuthBody): Promise<{ token: string; role: string }> {
    const username = sanitizeUsername(body.username ?? '');
    if (!username) throw new BadRequestException('username is required');

    const password = (body.password ?? '').trim();
    if (!password) throw new BadRequestException('password is required');

    const user = await this.users.verify(username, password);
    if (!user) throw new UnauthorizedException('Invalid username or password');

    if (user.status === 'pending')
      throw new ForbiddenException('Your account is pending admin approval');

    const token = this.auth.sign(username);
    return { token, role: user.role };
  }

  /**
   * PATCH /auth/password
   * Authenticated user changes their own password.
   */
  @Patch('password')
  @HttpCode(200)
  async changeOwnPassword(
    @Headers('authorization') authHeader: string = '',
    @Body() body: { currentPassword?: string; newPassword?: string },
  ): Promise<{ message: string }> {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Missing token');

    let payload: { username: string };
    try { payload = this.auth.verify(token); }
    catch { throw new UnauthorizedException('Invalid or expired token'); }

    const user = this.users.findByUsername(payload.username);
    if (!user) throw new UnauthorizedException('User not found');

    const current = (body.currentPassword ?? '').trim();
    const next    = (body.newPassword    ?? '').trim();

    if (!current) throw new BadRequestException('currentPassword is required');
    if (next.length < 6) throw new BadRequestException('newPassword must be at least 6 characters');

    const verified = await this.users.verify(user.username, current);
    if (!verified) throw new UnauthorizedException('Current password is incorrect');

    await this.users.changePassword(user.id, next);
    return { message: 'Password updated successfully' };
  }

  // ── Admin only ────────────────────────────────────────────────────────────

  /** GET /auth/admin/users — list all users */
  @Get('admin/users')
  @UseGuards(AdminGuard)
  listUsers(): object[] {
    return this.users.listAll().map(({ passwordHash: _, ...u }) => u);
  }

  /** PATCH /auth/admin/users/:id/approve */
  @Patch('admin/users/:id/approve')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  approveUser(@Param('id', ParseIntPipe) id: number): { message: string } {
    const ok = this.users.approve(id);
    if (!ok) throw new BadRequestException('User not found');
    return { message: 'User approved' };
  }

  /** DELETE /auth/admin/users/:id */
  @Delete('admin/users/:id')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  removeUser(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') authHeader: string = '',
  ): { message: string } {
    // Prevent admin from deleting themselves
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const payload = this.auth.verify(token);
    const self    = this.users.findByUsername(payload.username);
    if (self?.id === id) throw new BadRequestException('Cannot delete your own account');

    const ok = this.users.remove(id);
    if (!ok) throw new BadRequestException('User not found');
    return { message: 'User removed' };
  }

  /** PATCH /auth/admin/users/:id/password — admin resets any user's password */
  @Patch('admin/users/:id/password')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  async adminChangePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PasswordBody,
  ): Promise<{ message: string }> {
    const newPassword = (body.password ?? '').trim();
    if (newPassword.length < 6)
      throw new BadRequestException('password must be at least 6 characters');

    const ok = await this.users.changePassword(id, newPassword);
    if (!ok) throw new BadRequestException('User not found');
    return { message: 'Password updated' };
  }
}

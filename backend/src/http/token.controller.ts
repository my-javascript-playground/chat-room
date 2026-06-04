import {
  Controller, Post, Get, Patch, Delete, Body, Param,
  ParseIntPipe, BadRequestException, ConflictException,
  UnauthorizedException, ForbiddenException, HttpCode,
  UseGuards, Headers,
} from '@nestjs/common';
import { AuthService }  from '../auth/auth.service';
import { UserService }  from '../auth/user.service';
import { AdminGuard }   from '../auth/admin.guard';

interface AuthBody     { username?: string; password?: string; recaptchaToken?: string; }
interface PasswordBody { password?: string; }

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY ?? '';
const RECAPTCHA_ENABLED = !!RECAPTCHA_SECRET;

async function verifyRecaptcha(token: string): Promise<boolean> {
  if (!RECAPTCHA_ENABLED) return true; // skip in dev if no secret configured
  if (!token) return false;
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=${encodeURIComponent(token)}`,
    });
    const data = await res.json() as { success: boolean; score?: number };
    // For reCAPTCHA v3, require score >= 0.5; for v2 just check success
    if (typeof data.score === 'number') return data.success && data.score >= 0.5;
    return data.success;
  } catch {
    return false;
  }
}

function sanitizeUsername(raw: string): string {
  return raw.trim().slice(0, 24).replace(/[<>"']/g, '');
}

function sanitizeRoomName(raw: string): string {
  return raw.trim().slice(0, 32).replace(/[^a-zA-Z0-9_\-]/g, '-').toLowerCase();
}

function extractToken(authHeader: string): string {
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

@Controller('auth')
export class TokenController {
  constructor(
    private readonly auth:  AuthService,
    private readonly users: UserService,
  ) {}

  // ── Public ────────────────────────────────────────────────────────────────

  @Post('register')
  @HttpCode(202)
  async register(@Body() body: AuthBody): Promise<{ message: string }> {
    const username = sanitizeUsername(body.username ?? '');
    if (!username) throw new BadRequestException('username is required');
    const password = (body.password ?? '').trim();
    if (password.length < 6) throw new BadRequestException('password must be at least 6 characters');

    const captchaOk = await verifyRecaptcha(body.recaptchaToken ?? '');
    if (!captchaOk) throw new BadRequestException('reCAPTCHA verification failed');

    try {
      await this.users.register(username, password);
    } catch (err: any) {
      if (err.message === 'Username already taken') throw new ConflictException('Username already taken');
      throw err;
    }
    return { message: 'Registration submitted. Please wait for admin approval.' };
  }

  @Post('token')
  @HttpCode(200)
  async getToken(@Body() body: AuthBody): Promise<{ token: string; role: string }> {
    const username = sanitizeUsername(body.username ?? '');
    if (!username) throw new BadRequestException('username is required');
    const password = (body.password ?? '').trim();
    if (!password) throw new BadRequestException('password is required');

    const captchaOk = await verifyRecaptcha(body.recaptchaToken ?? '');
    if (!captchaOk) throw new BadRequestException('reCAPTCHA verification failed');

    const user = await this.users.verify(username, password);
    if (!user) throw new UnauthorizedException('Invalid username or password');
    if (user.status === 'pending') throw new ForbiddenException('Your account is pending admin approval');

    const token = this.auth.sign(username);
    return { token, role: user.role };
  }

  @Patch('password')
  @HttpCode(200)
  async changeOwnPassword(
    @Headers('authorization') authHeader: string = '',
    @Body() body: { currentPassword?: string; newPassword?: string },
  ): Promise<{ message: string }> {
    const token = extractToken(authHeader);
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

  // ── Rooms (authenticated) ─────────────────────────────────────────────────

  @Get('rooms')
  @HttpCode(200)
  listRooms(@Headers('authorization') authHeader: string = ''): object[] {
    const token = extractToken(authHeader);
    if (!token) throw new UnauthorizedException('Missing token');
    let payload: { username: string };
    try { payload = this.auth.verify(token); }
    catch { throw new UnauthorizedException('Invalid or expired token'); }

    const user = this.users.findByUsername(payload.username);
    if (!user) throw new UnauthorizedException('User not found');

    const allRooms = this.users.listRooms();
    const userRooms = this.users.getUserRooms(user.id);
    const approvedIds = new Set(userRooms.map(r => r.id));

    return allRooms.map(r => ({
      ...r,
      memberStatus: approvedIds.has(r.id) ? 'approved' : 'none',
    }));
  }

  @Post('rooms/:id/join')
  @HttpCode(200)
  async requestJoin(
    @Param('id', ParseIntPipe) roomId: number,
    @Headers('authorization') authHeader: string = '',
  ): Promise<{ message: string }> {
    const token = extractToken(authHeader);
    if (!token) throw new UnauthorizedException('Missing token');
    let payload: { username: string };
    try { payload = this.auth.verify(token); }
    catch { throw new UnauthorizedException('Invalid or expired token'); }

    const user = this.users.findByUsername(payload.username);
    if (!user) throw new UnauthorizedException('User not found');

    const room = this.users.findRoomById(roomId);
    if (!room) throw new BadRequestException('Room not found');

    try {
      await this.users.requestJoinRoom(roomId, user.id);
    } catch (err: any) {
      throw new ConflictException(err.message);
    }
    return { message: 'Join request submitted. Waiting for admin approval.' };
  }

  // ── Admin only ────────────────────────────────────────────────────────────

  @Get('admin/users')
  @UseGuards(AdminGuard)
  listUsers(): object[] {
    return this.users.listAll().map(({ passwordHash: _, ...u }) => u);
  }

  @Patch('admin/users/:id/approve')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  approveUser(@Param('id', ParseIntPipe) id: number): { message: string } {
    const ok = this.users.approve(id);
    if (!ok) throw new BadRequestException('User not found');
    return { message: 'User approved' };
  }

  @Delete('admin/users/:id')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  removeUser(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') authHeader: string = '',
  ): { message: string } {
    const token = extractToken(authHeader);
    const payload = this.auth.verify(token);
    const self = this.users.findByUsername(payload.username);
    if (self?.id === id) throw new BadRequestException('Cannot delete your own account');
    const ok = this.users.remove(id);
    if (!ok) throw new BadRequestException('User not found');
    return { message: 'User removed' };
  }

  @Patch('admin/users/:id/password')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  async adminChangePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PasswordBody,
  ): Promise<{ message: string }> {
    const newPassword = (body.password ?? '').trim();
    if (newPassword.length < 6) throw new BadRequestException('password must be at least 6 characters');
    const ok = await this.users.changePassword(id, newPassword);
    if (!ok) throw new BadRequestException('User not found');
    return { message: 'Password updated' };
  }

  // Admin room management
  @Get('admin/rooms')
  @UseGuards(AdminGuard)
  adminListRooms(): object[] {
    return this.users.listRooms();
  }

  @Post('admin/rooms')
  @UseGuards(AdminGuard)
  @HttpCode(201)
  async adminCreateRoom(
    @Body() body: { name?: string },
    @Headers('authorization') authHeader: string = '',
  ): Promise<{ message: string; room: object }> {
    const name = sanitizeRoomName(body.name ?? '');
    if (!name || name.length < 2) throw new BadRequestException('Room name must be at least 2 characters');

    const token = extractToken(authHeader);
    const payload = this.auth.verify(token);
    const admin = this.users.findByUsername(payload.username);
    if (!admin) throw new UnauthorizedException();

    try {
      const room = this.users.createRoom(name, admin.id);
      return { message: `Room "#${room.name}" created`, room };
    } catch (err: any) {
      throw new ConflictException(err.message);
    }
  }

  @Delete('admin/rooms/:id')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  adminDeleteRoom(@Param('id', ParseIntPipe) id: number): { message: string } {
    try {
      const ok = this.users.deleteRoom(id);
      if (!ok) throw new BadRequestException('Room not found');
      return { message: 'Room deleted' };
    } catch (err: any) {
      if (err.message === 'Cannot delete the general room') throw new BadRequestException(err.message);
      throw err;
    }
  }

  @Get('admin/join-requests')
  @UseGuards(AdminGuard)
  getPendingJoinRequests(): object[] {
    return this.users.getPendingJoinRequests();
  }

  @Patch('admin/rooms/:roomId/members/:userId/approve')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  approveJoinRequest(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): { message: string } {
    const ok = this.users.approveJoinRequest(roomId, userId);
    if (!ok) throw new BadRequestException('Request not found');
    return { message: 'Join request approved' };
  }

  @Delete('admin/rooms/:roomId/members/:userId')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  rejectJoinRequest(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): { message: string } {
    const ok = this.users.rejectJoinRequest(roomId, userId);
    if (!ok) throw new BadRequestException('Request not found');
    return { message: 'Join request rejected' };
  }
}

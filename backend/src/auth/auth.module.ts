import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { AdminGuard }  from './admin.guard';

@Module({
  providers: [AuthService, UserService, AdminGuard],
  exports:   [AuthService, UserService, AdminGuard],
})
export class AuthModule {}

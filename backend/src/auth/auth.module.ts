import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

@Module({
  providers: [AuthService, UserService],
  exports:   [AuthService, UserService],
})
export class AuthModule {}

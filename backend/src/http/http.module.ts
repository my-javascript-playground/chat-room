import { Module } from '@nestjs/common';
import { TokenController } from './token.controller';
import { AuthModule }      from '../auth/auth.module';
import { ChatModule }      from '../chat/chat.module';

@Module({
  imports:     [AuthModule, ChatModule],
  controllers: [TokenController],
})
export class HttpModule {}

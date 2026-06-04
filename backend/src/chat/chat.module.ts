import { Module } from '@nestjs/common';
import { ChatGateway } from '../gateway/chat.gateway';
import { AuthModule }  from '../auth/auth.module';
import { ChatService } from './chat.service';

@Module({
  imports:   [AuthModule],
  providers: [ChatGateway, ChatService],
  exports:   [ChatService, ChatGateway],
})
export class ChatModule {}

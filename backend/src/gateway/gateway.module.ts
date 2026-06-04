import { Module }      from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AuthModule }  from '../auth/auth.module';
import { ChatModule }  from '../chat/chat.module';

@Module({
  imports:   [AuthModule, ChatModule],
  providers: [ChatGateway],
  exports:   [ChatGateway],
})
export class GatewayModule {}

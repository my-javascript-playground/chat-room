import { Module }          from '@nestjs/common';
import { TokenController } from './token.controller';
import { AuthModule }      from '../auth/auth.module';
import { ChatModule }      from '../chat/chat.module';
import { GatewayModule }   from '../gateway/gateway.module';

@Module({
  imports:     [AuthModule, ChatModule, GatewayModule],
  controllers: [TokenController],
})
export class HttpModule {}

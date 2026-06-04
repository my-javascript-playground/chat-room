import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { HttpModule } from './http/http.module';

@Module({
  imports: [ChatModule, HttpModule],
})
export class AppModule {}

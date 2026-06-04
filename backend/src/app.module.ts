import { Module }      from '@nestjs/common';
import { HttpModule }  from './http/http.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [HttpModule, GatewayModule],
})
export class AppModule {}

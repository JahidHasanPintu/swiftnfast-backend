import { Module, Global } from '@nestjs/common';
import { EventsGateway } from './gateways/events.gateway';

@Global()
@Module({
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class NotificationsModule {}

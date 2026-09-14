import { Module } from '@nestjs/common';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { StorefrontOrdersModule } from '../orders/storefront-orders.module';
import { SettingsModule } from '../settings/settings.module';
import { EpsService } from './eps.service';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [DatabaseSchemasModule, SettingsModule, StorefrontOrdersModule],
  controllers: [PaymentController],
  providers: [PaymentService, EpsService],
  exports: [PaymentService, EpsService],
})
export class PaymentModule {}

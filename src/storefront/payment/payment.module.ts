import { Module } from '@nestjs/common';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [DatabaseSchemasModule, SettingsModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}

import { Module } from '@nestjs/common';
import { PaymentMethodController } from './payment-method.controller';
import { PaymentMethodService } from './payment-method.service';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { StorefrontAuthModule } from '../auth/storefront-auth.module';

@Module({
  imports: [DatabaseSchemasModule, StorefrontAuthModule],
  controllers: [PaymentMethodController],
  providers: [PaymentMethodService],
  exports: [PaymentMethodService],
})
export class PaymentMethodModule {}

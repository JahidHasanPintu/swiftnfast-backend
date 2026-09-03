import { Module } from '@nestjs/common';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { OrderModule } from 'src/order/order.module';
import { StorageModule } from 'src/storage/storage.module';
import { StorefrontAuthModule } from '../auth/storefront-auth.module';
import { CartModule } from '../cart/cart.module';
import { MailModule } from '../mail/mail.module';
import { NotificationModule } from '../notifications/notification.module';
import { PreStockOrdersModule } from '../pre-stock-orders/pre-stock-orders.module';
import { StorefrontOrdersService } from './storefront-orders.service';
import { StorefrontOrdersController } from './storefront-orders.controller';

@Module({
  imports: [
    DatabaseSchemasModule,
    OrderModule,
    CartModule,
    StorefrontAuthModule,
    StorageModule,
    MailModule,
    NotificationModule,
    PreStockOrdersModule,
  ],
  controllers: [StorefrontOrdersController],
  providers: [StorefrontOrdersService],
  exports: [StorefrontOrdersService],
})
export class StorefrontOrdersModule {}

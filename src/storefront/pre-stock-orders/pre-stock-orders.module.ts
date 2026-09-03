import { Module } from '@nestjs/common';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { CartModule } from '../cart/cart.module';
import { NotificationModule } from '../notifications/notification.module';
import { StorageModule } from 'src/storage/storage.module';
import { PreStockOrdersController } from './pre-stock-orders.controller';
import { PreStockOrdersService } from './pre-stock-orders.service';

@Module({
  imports: [
    DatabaseSchemasModule,
    CartModule,
    NotificationModule,
    StorageModule,
  ],
  controllers: [PreStockOrdersController],
  providers: [PreStockOrdersService],
  exports: [PreStockOrdersService],
})
export class PreStockOrdersModule {}

import { forwardRef, Module } from '@nestjs/common';
import { PurchaseController } from './PurchaseController';
import { PurchaseService } from './purchase.service';
import { DatabaseModule } from 'src/database/database.module';
import { MongooseModule } from '@nestjs/mongoose';
import PurchaseSchema from './schemas/purchase.schemas';
import OrderSchema from '../order/schemas/order.schema';
import { SearchPurchaseController } from './search-purchase/search-purchase.controller';
import { SearchPurchaseService } from './search-purchase/search-purchase.service';
import { SearchOrdersController } from 'src/order/search-orders/search-orders.controller';
import { PathaoService } from './pathao.service';
import { ShipmentModule } from 'src/shipment/shipment.module';

@Module({
  imports: [
    MongooseModule.forFeature([]),
    forwardRef(() => ShipmentModule),
    DatabaseModule,
    MongooseModule.forFeature([
      { name: 'Purchases', schema: PurchaseSchema },
      { name: 'Orders', schema: OrderSchema },
      
    ]),
  ],
  controllers: [PurchaseController, SearchPurchaseController],
  providers: [PurchaseService, SearchPurchaseService, PathaoService],
})
export class PurchaseModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import OrderSchema from 'src/order/schemas/order.schema';
import CustomerSchema from 'src/order/schemas/customer.schema';
import PurchaseSchema from 'src/purchase/schemas/purchase.schemas';
import CancelledOrderSchema from 'src/cancelled-orders/schemas/cancelOrders.schema';
import PaymentSchema from 'src/order/schemas/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Order', schema: OrderSchema },
      { name: 'Customer', schema: CustomerSchema },
      { name: 'Purchase', schema: PurchaseSchema },
      { name: 'CancelledOrder', schema: CancelledOrderSchema },
      { name: 'Payment', schema: PaymentSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
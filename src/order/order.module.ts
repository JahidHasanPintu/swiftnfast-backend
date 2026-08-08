import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { UpdateOrderService } from './update-order/update-order.service';
import { UpdateOrderController } from './update-order/update-order.controller';
import { EditCustomerService } from './edit-customer/edit-customer.service';
import { EditCustomerController } from './edit-customer/edit-customer.controller';
import { CustomerController } from './customer/customer.controller';
import { CustomerService } from './customer/customer.service';
import { SearchOrdersController } from './search-orders/search-orders.controller';
import { SearchOrdersService } from './search-orders/search-orders.service';
import { InvoiceService } from 'src/invoice/invoice.service';

@Module({
  imports: [DatabaseModule, DatabaseSchemasModule],
  controllers: [
    OrderController,
    UpdateOrderController,
    EditCustomerController,
    CustomerController,
    SearchOrdersController,
  ],
  providers: [
    OrderService,
    UpdateOrderService,
    EditCustomerService,
    CustomerService,
    SearchOrdersService,
    InvoiceService,
  ],
})
export class OrderModule {}

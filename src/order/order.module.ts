import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from 'src/database/database.module';
import { UpdateOrderService } from './update-order/update-order.service';
import { UpdateOrderController } from './update-order/update-order.controller';
import { EditCustomerService } from './edit-customer/edit-customer.service';
import CustomerSchema from './schemas/customer.schema';
import OrderSchema from './schemas/order.schema';
import PaymentSchema from './schemas/payment.schema';
import { EditCustomerController } from './edit-customer/edit-customer.controller';
import { CustomerController } from './customer/customer.controller';
import { CustomerService } from './customer/customer.service';
import { SearchOrdersController } from './search-orders/search-orders.controller';
import { SearchOrdersService } from './search-orders/search-orders.service';
import { InvoiceService } from 'src/invoice/invoice.service';


@Module({
    imports: [
        DatabaseModule,
        MongooseModule.forFeature([
            { name: 'Customer', schema: CustomerSchema },
            { name: 'Orders', schema: OrderSchema },
            { name: 'Payments', schema: PaymentSchema },
        ]),
    ],
    controllers: [OrderController, UpdateOrderController, EditCustomerController, CustomerController, SearchOrdersController],
    providers: [OrderService, UpdateOrderService, EditCustomerService, CustomerService, SearchOrdersService, InvoiceService]
})
export class OrderModule { }

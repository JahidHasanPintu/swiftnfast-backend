import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import CustomerSchema from 'src/order/schemas/customer.schema';
import OrderSchema from 'src/order/schemas/order.schema';
import PaymentSchema from 'src/order/schemas/payment.schema';
import PurchaseSchema from 'src/purchase/schemas/purchase.schemas';
import CancelledOrderSchema from 'src/cancelled-orders/schemas/cancelOrders.schema';
import CardBeneficiarySchema from 'src/card/schema/addCard.schema';
import { UserRegistrationSchema } from 'src/client/registration/client-reg.model';
import UserSchema from 'src/user/schemas/login.schemas';
import DropShipSchema from 'src/dropship/schemas/dropship.schema';
import ShipmentSchema from 'src/shipment/schemas/shipment.schema';
import ShippingAddressSchema from 'src/shipping-address/schemas/shippingAddressSchema';
import { Account, AccountSchema } from 'src/accounts/schemas/account.schema';
import {
  Transaction,
  TransactionSchema,
} from 'src/transactions/schemas/transaction.schema';

/**
 * Single place where every Mongoose model is registered once with its
 * canonical name. Feature modules import this module instead of declaring
 * their own `MongooseModule.forFeature([...])`.
 *
 * Canonical names: Customer, Orders, Payments, Purchases, CancelledOrder,
 * Cards, Registration, Login, DropShip, Shipment, shipping-address,
 * Account, Transaction. (Unifies legacy aliases: Order->Orders,
 * Payment->Payments, Purchase->Purchases, cancelled-orders->CancelledOrder.)
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Customer', schema: CustomerSchema },
      { name: 'Orders', schema: OrderSchema },
      { name: 'Payments', schema: PaymentSchema },
      { name: 'Purchases', schema: PurchaseSchema },
      { name: 'CancelledOrder', schema: CancelledOrderSchema },
      { name: 'Cards', schema: CardBeneficiarySchema },
      { name: 'Registration', schema: UserRegistrationSchema },
      { name: 'Login', schema: UserSchema },
      { name: 'DropShip', schema: DropShipSchema },
      { name: 'Shipment', schema: ShipmentSchema },
      { name: 'shipping-address', schema: ShippingAddressSchema },
      { name: Account.name, schema: AccountSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseSchemasModule {}

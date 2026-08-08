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
import Pfu2UserSchema from 'src/storefront/schemas/pfu2-user.schema';
import CategorySchema from 'src/storefront/schemas/category.schema';
import BrandSchema from 'src/storefront/schemas/brand.schema';
import ProductSchema from 'src/storefront/schemas/product.schema';
import OfferSchema from 'src/storefront/schemas/offer.schema';
import BannerSchema from 'src/storefront/schemas/banner.schema';
import FaqSchema from 'src/storefront/schemas/faq.schema';
import PartnerSchema from 'src/storefront/schemas/partner.schema';
import SettingSchema from 'src/storefront/schemas/setting.schema';
import CartSchema from 'src/storefront/schemas/cart.schema';
import Pfu2ShippingAddressSchema from 'src/storefront/schemas/pfu2-shipping-address.schema';
import Pfu2BillingAddressSchema from 'src/storefront/schemas/pfu2-billing-address.schema';
import Pfu2PaymentSchema from 'src/storefront/schemas/pfu2-payment.schema';

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
      { name: 'Pfu2User', schema: Pfu2UserSchema },
      { name: 'Category', schema: CategorySchema },
      { name: 'Brand', schema: BrandSchema },
      { name: 'Product', schema: ProductSchema },
      { name: 'Offer', schema: OfferSchema },
      { name: 'Banner', schema: BannerSchema },
      { name: 'Faq', schema: FaqSchema },
      { name: 'Partner', schema: PartnerSchema },
      { name: 'Setting', schema: SettingSchema },
      { name: 'Cart', schema: CartSchema },
      { name: 'Pfu2ShippingAddress', schema: Pfu2ShippingAddressSchema },
      { name: 'Pfu2BillingAddress', schema: Pfu2BillingAddressSchema },
      { name: 'Pfu2Payment', schema: Pfu2PaymentSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseSchemasModule {}

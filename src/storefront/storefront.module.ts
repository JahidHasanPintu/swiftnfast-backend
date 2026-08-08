import { Module } from '@nestjs/common';
import { StorefrontAuthModule } from './auth/storefront-auth.module';
import { StorefrontCatalogModule } from './catalog/storefront-catalog.module';
import { OffersModule } from './offers/offers.module';
import { BannerModule } from './banner/banner.module';
import { FaqsModule } from './faqs/faqs.module';
import { PartnersModule } from './partners/partners.module';
import { SettingsModule } from './settings/settings.module';
import { StorefrontUsersModule } from './users/storefront-users.module';
import { CartModule } from './cart/cart.module';
import { AddressModule } from './addresses/address.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    StorefrontAuthModule,
    StorefrontCatalogModule,
    OffersModule,
    BannerModule,
    FaqsModule,
    PartnersModule,
    SettingsModule,
    StorefrontUsersModule,
    CartModule,
    AddressModule,
    PaymentModule,
  ],
})
export class StorefrontModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CancelledOrdersModule } from './cancelled-orders/cancelled-orders.module';
import { CardModule } from './card/card.module';
import { ClientModule } from './client/client.module';
import { DatabaseModule } from './database/database.module';
import { OrderModule } from './order/order.module';
import { PurchaseModule } from './purchase/purchase.module';
import { StorageModule } from './storage/storage.module';
import { UserModule } from './user/user.module';
import { ShippingAddressModule } from './shipping-address/shipping-address.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ShipmentModule } from './shipment/shipment.module';
import { DropShipModule } from './dropship/dropship.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    OrderModule,
    DatabaseModule,
    AuthModule,
    UserModule,
    CardModule,
    PurchaseModule,
    ClientModule,
    CancelledOrdersModule,
    StorageModule,
    ShippingAddressModule,
    DashboardModule,
    AccountsModule,
    TransactionsModule,
    ShipmentModule,
    DropShipModule,
  ],
  controllers: [AppController],
  // providers: [AppService],

  providers: [
    AppService,
    // {
    //   provide: APP_FILTER,
    //   useClass: LoggingFilter,
    // },
  ],
})
export class AppModule {
  // configure(consumer: MiddlewareConsumer) {
  //   consumer.apply(LoggingMiddleware).forRoutes('*'); // Apply to all routes
  // }
}

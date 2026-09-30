import { Module } from '@nestjs/common';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { StorageModule } from 'src/storage/storage.module';
import { StorefrontAuthModule } from '../auth/storefront-auth.module';
import { MailModule } from '../mail/mail.module';
import { NotificationModule } from '../notifications/notification.module';
import { SettingsModule } from '../settings/settings.module';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';

@Module({
  imports: [
    DatabaseSchemasModule,
    StorefrontAuthModule,
    StorageModule,
    MailModule,
    NotificationModule,
    SettingsModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}

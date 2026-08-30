import { Module } from '@nestjs/common';
import { StorefrontAuthController } from './storefront-auth.controller';
import { StorefrontAuthService } from './storefront-auth.service';
import { StorefrontJwtService } from './storefront-jwt.service';
import {
  StorefrontOptionalAuthGuard,
  StorefrontAuthGuard,
} from './storefront-auth.guards';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [DatabaseSchemasModule, MailModule, SmsModule],
  controllers: [StorefrontAuthController],
  providers: [
    StorefrontAuthService,
    StorefrontJwtService,
    StorefrontOptionalAuthGuard,
    StorefrontAuthGuard,
  ],
  exports: [
    StorefrontJwtService,
    StorefrontOptionalAuthGuard,
    StorefrontAuthGuard,
  ],
})
export class StorefrontAuthModule {}

import { Module } from '@nestjs/common';
import { StorefrontAuthController } from './storefront-auth.controller';
import { StorefrontAuthService } from './storefront-auth.service';
import { StorefrontJwtService } from './storefront-jwt.service';
import { StorefrontOptionalAuthGuard, StorefrontAuthGuard } from './storefront-auth.guards';
import { DatabaseSchemasModule } from 'src/database/schemas.module';

@Module({
  imports: [DatabaseSchemasModule],
  controllers: [StorefrontAuthController],
  providers: [
    StorefrontAuthService,
    StorefrontJwtService,
    StorefrontOptionalAuthGuard,
    StorefrontAuthGuard,
  ],
  exports: [StorefrontJwtService, StorefrontOptionalAuthGuard, StorefrontAuthGuard],
})
export class StorefrontAuthModule {}

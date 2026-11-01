import { Module } from '@nestjs/common';
import { StorefrontUsersController } from './storefront-users.controller';
import { StorefrontUserLookupController } from './storefront-user-lookup.controller';
import { StorefrontUsersService } from './storefront-users.service';
import { StorefrontAuthModule } from '../auth/storefront-auth.module';
import { DatabaseSchemasModule } from 'src/database/schemas.module';

@Module({
  imports: [DatabaseSchemasModule, StorefrontAuthModule],
  controllers: [StorefrontUsersController, StorefrontUserLookupController],
  providers: [StorefrontUsersService],
  exports: [StorefrontUsersService],
})
export class StorefrontUsersModule {}

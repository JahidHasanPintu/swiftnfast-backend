import { Module } from '@nestjs/common';
import { StorefrontUsersController } from './storefront-users.controller';
import { StorefrontUsersService } from './storefront-users.service';
import { StorefrontAuthModule } from '../auth/storefront-auth.module';
import { DatabaseSchemasModule } from 'src/database/schemas.module';

@Module({
  imports: [DatabaseSchemasModule, StorefrontAuthModule],
  controllers: [StorefrontUsersController],
  providers: [StorefrontUsersService],
  exports: [StorefrontUsersService],
})
export class StorefrontUsersModule {}

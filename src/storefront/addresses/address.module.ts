import { Module } from '@nestjs/common';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { StorefrontAuthModule } from '../auth/storefront-auth.module';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';

@Module({
  imports: [DatabaseSchemasModule, StorefrontAuthModule],
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService],
})
export class AddressModule {}

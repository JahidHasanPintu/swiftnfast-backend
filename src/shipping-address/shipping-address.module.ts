import { Module } from '@nestjs/common';
import { ShippingAddressController } from './shipping-address.controller';
import { ShippingAddressService } from './shipping-address.service';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseSchemasModule } from 'src/database/schemas.module';

@Module({
  imports: [DatabaseModule, DatabaseSchemasModule],
  controllers: [ShippingAddressController],
  providers: [ShippingAddressService],
})
export class ShippingAddressModule {}

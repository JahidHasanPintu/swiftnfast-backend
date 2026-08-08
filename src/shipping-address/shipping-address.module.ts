import { Module } from '@nestjs/common';
import { ShippingAddressController } from './shipping-address.controller';
import { ShippingAddressService } from './shipping-address.service';
import { DatabaseModule } from 'src/database/database.module';
import { MongooseModule } from '@nestjs/mongoose';
import ShippingAddressSchema from './schemas/shippingAddressSchema';


@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([
      { name: 'shipping-address', schema: ShippingAddressSchema },
    ]),
  ],
  controllers: [ShippingAddressController],
  providers: [ShippingAddressService]
})
export class ShippingAddressModule { }

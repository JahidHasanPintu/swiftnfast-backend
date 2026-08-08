import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DropShipController } from './dropship.controller';
import { DropShipService } from './dropship.service';
import DropShipSchema from './schemas/dropship.schema';
import CustomerSchema from '../order/schemas/customer.schema';
import { ShipmentModule } from '../shipment/shipment.module';

@Module({
  imports: [
    forwardRef(() => ShipmentModule),
    MongooseModule.forFeature([
      { name: 'DropShip', schema: DropShipSchema },
      { name: 'Customer', schema: CustomerSchema },
    ]),
  ],
  controllers: [DropShipController],
  providers: [DropShipService],
  exports: [DropShipService, MongooseModule],
})
export class DropShipModule {}

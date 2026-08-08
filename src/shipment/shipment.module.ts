import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';
import ShipmentSchema from './schemas/shipment.schema';
import PurchaseSchema from 'src/purchase/schemas/purchase.schemas';
import ShippingAddressSchema from 'src/shipping-address/schemas/shippingAddressSchema';
import DropShipSchema from 'src/dropship/schemas/dropship.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Shipment', schema: ShipmentSchema },
      { name: 'Purchase', schema: PurchaseSchema },
      { name: 'shipping-address', schema: ShippingAddressSchema },
      { name: 'DropShip', schema: DropShipSchema },
    ]),
  ],
  controllers: [ShipmentController],
  providers: [ShipmentService],
  exports: [ShipmentService],
})
export class ShipmentModule {}

import { Module, forwardRef } from '@nestjs/common';
import { DropShipController } from './dropship.controller';
import { DropShipService } from './dropship.service';
import { ShipmentModule } from '../shipment/shipment.module';
import { DatabaseSchemasModule } from 'src/database/schemas.module';

@Module({
  imports: [forwardRef(() => ShipmentModule), DatabaseSchemasModule],
  controllers: [DropShipController],
  providers: [DropShipService],
  exports: [DropShipService, DatabaseSchemasModule],
})
export class DropShipModule {}

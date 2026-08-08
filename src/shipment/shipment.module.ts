import { Module } from '@nestjs/common';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';
import { DatabaseSchemasModule } from 'src/database/schemas.module';

@Module({
  imports: [DatabaseSchemasModule],
  controllers: [ShipmentController],
  providers: [ShipmentService],
  exports: [ShipmentService],
})
export class ShipmentModule {}

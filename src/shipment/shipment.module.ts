import { Module } from '@nestjs/common';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [DatabaseSchemasModule, TransactionsModule],
  controllers: [ShipmentController],
  providers: [ShipmentService],
  exports: [ShipmentService],
})
export class ShipmentModule {}

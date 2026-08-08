import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { CancelledOrdersController } from './cancelled-orders.controller';
import { CancelledOrdersService } from './cancelled-orders.service';

@Module({
  imports: [DatabaseModule, DatabaseSchemasModule],
  controllers: [CancelledOrdersController],
  providers: [CancelledOrdersService],
})
export class CancelledOrdersModule {}

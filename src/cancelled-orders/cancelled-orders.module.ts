import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from 'src/database/database.module';
import CancelledOrderSchema from './schemas/cancelOrders.schema';
import { CancelledOrdersController } from './cancelled-orders.controller';
import { CancelledOrdersService } from './cancelled-orders.service';

@Module({
    imports: [
        DatabaseModule,
        MongooseModule.forFeature([
            { name: 'cancelled-orders', schema: CancelledOrderSchema },
        ]),
    ],
    controllers: [CancelledOrdersController],
    providers: [CancelledOrdersService]
})
export class CancelledOrdersModule { }

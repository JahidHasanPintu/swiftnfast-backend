import { forwardRef, Module } from '@nestjs/common';
import { PurchaseController } from './PurchaseController';
import { PurchaseService } from './purchase.service';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { SearchPurchaseController } from './search-purchase/search-purchase.controller';
import { SearchPurchaseService } from './search-purchase/search-purchase.service';
import { PathaoService } from './pathao.service';
import { ShipmentModule } from 'src/shipment/shipment.module';

@Module({
  imports: [
    forwardRef(() => ShipmentModule),
    DatabaseModule,
    DatabaseSchemasModule,
  ],
  controllers: [PurchaseController, SearchPurchaseController],
  providers: [PurchaseService, SearchPurchaseService, PathaoService],
})
export class PurchaseModule {}

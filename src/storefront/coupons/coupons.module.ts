import { Module } from '@nestjs/common';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

// Deliberately does NOT import CartModule: the cart service needs the coupon
// rules, so the dependency runs coupons -> cart only. Applying a coupon
// (POST /cart/:id/coupon) validates server-side against the real basket totals.
@Module({
  imports: [DatabaseSchemasModule],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
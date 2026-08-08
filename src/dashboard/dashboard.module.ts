import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DatabaseSchemasModule } from 'src/database/schemas.module';

@Module({
  imports: [DatabaseSchemasModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

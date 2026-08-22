import { Module } from '@nestjs/common';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { StorageModule } from 'src/storage/storage.module';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';

@Module({
  imports: [DatabaseSchemasModule, StorageModule],
  controllers: [AdminCatalogController],
  providers: [AdminCatalogService],
})
export class AdminModule {}

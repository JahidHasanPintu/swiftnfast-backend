import { Module } from '@nestjs/common';
import { CardController } from './card.controller';
import { CardService } from './card.service';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseSchemasModule } from 'src/database/schemas.module';

@Module({
  imports: [DatabaseModule, DatabaseSchemasModule],
  controllers: [CardController],
  providers: [CardService],
})
export class CardModule {}

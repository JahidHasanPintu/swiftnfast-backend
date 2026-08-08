import { Module } from '@nestjs/common';
import { CardController } from './card.controller';
import { CardService } from './card.service';
import { DatabaseModule } from 'src/database/database.module';
import { MongooseModule } from '@nestjs/mongoose';
import CardBeneficiarySchema from './schema/addCard.schema';

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([
      { name: 'Cards', schema: CardBeneficiarySchema },
    ]),
  ],
  controllers: [CardController],
  providers: [CardService]
})
export class CardModule { }

import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { DatabaseSchemasModule } from 'src/database/schemas.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [
    DatabaseSchemasModule,
    AccountsModule, // provides AccountsService
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}

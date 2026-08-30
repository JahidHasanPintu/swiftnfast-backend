import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { DatabaseSchemasModule } from 'src/database/schemas.module';

@Module({
  imports: [DatabaseSchemasModule],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}

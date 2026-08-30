import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsAdminController } from './sms-admin.controller';
import { DatabaseSchemasModule } from 'src/database/schemas.module';

@Module({
  imports: [DatabaseSchemasModule],
  controllers: [SmsAdminController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}

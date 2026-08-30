import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [MailModule, SmsModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

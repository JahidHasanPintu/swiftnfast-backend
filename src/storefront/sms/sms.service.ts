import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';

export interface SmsSendResult {
  success: boolean;
  code: string | null;
  body: string | null;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger('SmsService');

  constructor(
    private readonly config: ConfigService,
    @InjectModel('SmsLog')
    private readonly smsLogModel: Model<any>,
    @InjectModel('Setting')
    private readonly settingModel: Model<any>,
  ) {}

  /**
   * Admin Settings (DB) win over env vars. The SMS Gateway page in the admin
   * panel saves sms_api_key / sms_sender_id / sms_base_url to the Settings
   * collection; sending used to read env only, so a key saved via the panel
   * was silently ignored and every SMS failed with BulkSMSBD code != 202.
   */
  private async resolveConfig(): Promise<{
    apiKey: string;
    senderId: string;
    baseUrl: string;
  }> {
    let settings: Record<string, string> = {};
    try {
      const rows = await this.settingModel
        .find({
          key: { $in: ['sms_api_key', 'sms_sender_id', 'sms_base_url'] },
        })
        .lean()
        .exec();
      for (const row of rows || []) settings[row.key] = String(row.value ?? '');
    } catch (err) {
      this.logger.warn(`Failed to read SMS settings, falling back to env: ${err.message}`);
    }
    return {
      apiKey: settings['sms_api_key'] || this.config.get<string>('SMS_API_KEY') || '',
      senderId:
        settings['sms_sender_id'] || this.config.get<string>('SMS_SENDER_ID') || 'PFU2',
      baseUrl:
        settings['sms_base_url'] ||
        this.config.get<string>('SMS_BASE_URL') ||
        'http://bulksmsbd.net/api',
    };
  }

  async sendSms(
    to: string,
    message: string,
    purpose: string = 'GENERAL',
  ): Promise<SmsSendResult> {
    const number = this.normalizePhone(to);

    let responseCode: string | null = null;
    let responseBody: string | null = null;
    let status: 'SUCCESS' | 'FAILED' | 'PENDING' = 'PENDING';

    try {
      const { apiKey, senderId, baseUrl } = await this.resolveConfig();
      const url = `${baseUrl}/smsapi`;
      const params = {
        api_key: apiKey,
        type: 'text',
        number,
        senderid: senderId,
        message,
      };

      const { data } = await axios.get(url, { params, timeout: 10000 });
      responseBody = JSON.stringify(data);

      const code = String(data?.response_code || data?.error_code || '');
      responseCode = code;
      status = code === '202' ? 'SUCCESS' : 'FAILED';
    } catch (err) {
      responseBody = err.message;
      status = 'FAILED';
    }

    try {
      await this.smsLogModel.create({
        to: number,
        message,
        status,
        responseCode,
        responseBody,
        purpose,
      });
    } catch (logErr) {
      this.logger.error('Failed to write SMS log', logErr.stack);
    }

    return {
      success: status === 'SUCCESS',
      code: responseCode,
      body: responseBody,
    };
  }

  async sendBulkSms(
    recipients: string[],
    message: string,
    purpose: string = 'BULK',
  ): Promise<{ sent: number; failed: number; results: SmsSendResult[] }> {
    const results = await Promise.allSettled(
      recipients.map((to) => this.sendSms(to, message, purpose)),
    );

    let sent = 0;
    let failed = 0;
    const smsResults: SmsSendResult[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        sent++;
      } else {
        failed++;
      }
      if (result.status === 'fulfilled') {
        smsResults.push(result.value);
      } else {
        smsResults.push({ success: false, code: null, body: result.reason });
      }
    }

    this.logger.log(
      `Bulk SMS: ${sent} sent, ${failed} failed out of ${recipients.length}`,
    );

    return { sent, failed, results: smsResults };
  }

  async getBalance(): Promise<any> {
    const { apiKey, baseUrl } = await this.resolveConfig();
    const url = `${baseUrl}/getBalanceApi`;
    const { data } = await axios.get(url, {
      params: { api_key: apiKey },
      timeout: 10000,
    });
    return data;
  }

  async getSmsLogs(query: {
    page?: number;
    limit?: number;
    status?: string;
    purpose?: string;
    to?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.purpose) filter.purpose = query.purpose;
    if (query.to) filter.to = { $regex: query.to, $options: 'i' };

    const [logs, total] = await Promise.all([
      this.smsLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.smsLogModel.countDocuments(filter),
    ]);

    return {
      logs,
      meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
    };
  }

  normalizePhone(phone: string): string {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('880')) return digits;
    if (digits.startsWith('0')) return '88' + digits;
    return '880' + digits;
  }

  isPhone(identifier: string): boolean {
    return /^[0-9+]{7,15}$/.test(identifier.replace(/\s/g, ''));
  }
}

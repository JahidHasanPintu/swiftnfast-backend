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
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    @InjectModel('SmsLog')
    private readonly smsLogModel: Model<any>,
  ) {
    this.apiKey = this.config.get<string>('SMS_API_KEY') || '';
    this.senderId = this.config.get<string>('SMS_SENDER_ID') || 'PFU2';
    this.baseUrl =
      this.config.get<string>('SMS_BASE_URL') || 'http://bulksmsbd.net/api';
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
      const url = `${this.baseUrl}/smsapi`;
      const params = {
        api_key: this.apiKey,
        type: 'text',
        number,
        senderid: this.senderId,
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
    const url = `${this.baseUrl}/getBalanceApi`;
    const { data } = await axios.get(url, {
      params: { api_key: this.apiKey },
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

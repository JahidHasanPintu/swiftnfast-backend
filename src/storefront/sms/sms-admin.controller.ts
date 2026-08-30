import { Controller, Get, Put, Query, Body } from '@nestjs/common';
import { SmsService } from './sms.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/sms')
export class SmsAdminController {
  constructor(
    private readonly smsService: SmsService,
    @InjectModel('Setting')
    private readonly settingModel: Model<any>,
  ) {}

  @Get('logs')
  async getLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('purpose') purpose?: string,
    @Query('to') to?: string,
  ) {
    const result = await this.smsService.getSmsLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      purpose,
      to,
    });
    return {
      success: true,
      message: 'SMS logs fetched',
      data: result,
    };
  }

  @Get('balance')
  async getBalance() {
    const data = await this.smsService.getBalance();
    return {
      success: true,
      message: 'Balance fetched',
      data,
    };
  }

  @Get('config')
  async getConfig() {
    const senderId = await this.settingModel.findOne({ key: 'sms_sender_id' }).lean().exec();
    const apiKey = await this.settingModel.findOne({ key: 'sms_api_key' }).lean().exec();
    const baseUrl = await this.settingModel.findOne({ key: 'sms_base_url' }).lean().exec();
    return {
      success: true,
      message: 'SMS config fetched',
      data: {
        senderId: (senderId as any)?.value || '',
        apiKey: (apiKey as any)?.value ? '••••••' + (apiKey as any).value.slice(-4) : '',
        apiKeyRaw: (apiKey as any)?.value || '',
        baseUrl: (baseUrl as any)?.value || 'http://bulksmsbd.net/api',
      },
    };
  }

  @Put('config')
  async updateConfig(
    @Body() body: { senderId?: string; apiKey?: string; baseUrl?: string },
  ) {
    const updates: any[] = [];
    if (body.senderId !== undefined) {
      updates.push(
        this.settingModel.findOneAndUpdate(
          { key: 'sms_sender_id' },
          { key: 'sms_sender_id', value: body.senderId, label: 'SMS Sender ID' },
          { upsert: true },
        ),
      );
    }
    if (body.apiKey !== undefined) {
      updates.push(
        this.settingModel.findOneAndUpdate(
          { key: 'sms_api_key' },
          { key: 'sms_api_key', value: body.apiKey, label: 'SMS API Key' },
          { upsert: true },
        ),
      );
    }
    if (body.baseUrl !== undefined) {
      updates.push(
        this.settingModel.findOneAndUpdate(
          { key: 'sms_base_url' },
          { key: 'sms_base_url', value: body.baseUrl, label: 'SMS Base URL' },
          { upsert: true },
        ),
      );
    }
    await Promise.all(updates);
    return {
      success: true,
      message: 'SMS config updated',
      data: null,
    };
  }
}

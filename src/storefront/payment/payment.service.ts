import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';

const DEFAULT_PHONE = '01929918378';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel('Pfu2Payment') private readonly paymentModel: Model<any>,
    private readonly settingsService: SettingsService,
  ) {}

  async createPayment(data: any, file?: any) {
    if (file) {
      data.screenshotUrl = file.filename || file.originalname;
    }
    const payment = await this.paymentModel.create(data);
    return this.sanitize(payment);
  }

  async getPaymentById(id: string) {
    const payment = await this.paymentModel.findById(id).exec();
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return this.sanitize(payment);
  }

  async getAllPayments() {
    const payments = await this.paymentModel
      .find()
      .sort({ createdAt: -1 })
      .exec();
    return payments.map((p: any) => this.sanitize(p));
  }

  private sanitize(payment: any) {
    const p = payment.toObject ? payment.toObject() : payment;
    if (p.rawResponse && typeof p.rawResponse === 'object') {
      const raw = { ...p.rawResponse };
      delete raw.responseData?.verification?.tokenizedCard?.securityCode;
      p.rawResponse = raw;
    }
    return p;
  }

  async getAccessToken() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const cached = await this.settingsService.getByKey('bkash_token');
    if (
      cached?.value &&
      new Date(cached.updatedAt ?? cached.updated_at) > oneHourAgo
    ) {
      return cached.value;
    }

    const baseUrl = process.env.BKASH_BASE_URL;
    if (!baseUrl || !process.env.BKASH_APP_KEY) {
      throw new BadRequestException(
        'bKash is not configured (BKASH_BASE_URL / BKASH_APP_KEY missing)',
      );
    }

    const response = await axios.post(
      `${baseUrl}/checkout/token/grant`,
      {
        app_key: process.env.BKASH_APP_KEY,
        app_secret: process.env.BKASH_APP_SECRET,
      },
      {
        headers: {
          username: process.env.BKASH_USERNAME,
          password: process.env.BKASH_PASSWORD,
          'Content-Type': 'application/json',
        },
      },
    );

    const token = response.data.id_token;
    await this.settingsService.upsert(
      'bkash_token',
      token,
      'Access token for bKash API',
    );
    return token;
  }

  async createBkashPayment(body: any) {
    const token = await this.getAccessToken();
    const baseUrl = process.env.BKASH_BASE_URL;
    if (!baseUrl) throw new BadRequestException('bKash is not configured');

    const invoiceNumber = 'INVPFU2-' + Date.now();
    const paymentData = {
      mode: '0011',
      payerReference: body.phone || DEFAULT_PHONE,
      callbackURL: `${process.env.BACKEND_URL}/api/v1/payment/bkash/callback`,
      merchantAssociationInfo: 'MI05MID54RF09123456One',
      amount: body.amount,
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: invoiceNumber,
    };

    const response = await axios.post(
      `${baseUrl}/checkout/create`,
      paymentData,
      {
        headers: {
          authorization: token,
          'x-app-key': process.env.BKASH_APP_KEY,
          'Content-Type': 'application/json',
        },
      },
    );

    const { paymentID, bkashURL } = response.data;

    await this.paymentModel.create({
      method: 'bkash',
      phoneNumber: body.phone || DEFAULT_PHONE,
      paymentId: paymentID,
      orderId: body.orderId ?? null,
      transactionStatus: 'initiated',
      statusMessage: 'Awaiting bKash execution',
      amount: body.amount,
    });

    return { paymentID, bkashURL };
  }

  private clientUrl() {
    return (
      process.env.CLIENT_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'
    );
  }

  private backendUrl() {
    return process.env.BACKEND_URL || 'http://localhost:30003';
  }

  async bkashCallback(query: Record<string, string>) {
    const { status, paymentID } = query;
    if (!paymentID || !status) {
      return `${this.clientUrl()}/payment-failed?reason=invalid_callback`;
    }
    if (status === 'cancel' || status === 'failure') {
      await this.paymentModel
        .updateOne(
          { paymentId: paymentID },
          {
            $set: {
              transactionStatus: status,
              statusMessage: 'User cancelled or failed',
              paymentStatus: 'failed',
            },
          },
        )
        .exec();
      return `${this.clientUrl()}/payment-failed?reason=${status}`;
    }
    return `${this.backendUrl()}/api/v1/payment/bkash/execute?paymentID=${paymentID}`;
  }

  async executePayment(query: Record<string, string>) {
    const { paymentID } = query;
    const token = await this.getAccessToken();
    const baseUrl = process.env.BKASH_BASE_URL;
    if (!baseUrl) throw new BadRequestException('bKash is not configured');

    try {
      const response = await axios.post(
        `${baseUrl}/checkout/execute`,
        { paymentID },
        {
          headers: {
            authorization: token,
            'x-app-key': process.env.BKASH_APP_KEY,
            'Content-Type': 'application/json',
          },
        },
      );
      const data = response.data;
      const completed =
        data.statusCode === '0000' && data.transactionStatus === 'Completed';
      await this.paymentModel
        .updateOne(
          { paymentId: paymentID },
          {
            $set: {
              transactionStatus:
                data.transactionStatus || (completed ? 'Completed' : 'failed'),
              transactionId: data.trxID,
              statusCode: data.statusCode,
              statusMessage: data.statusMessage,
              rawResponse: data,
              paymentStatus: completed ? 'paid' : 'failed',
            },
          },
        )
        .exec();
      return completed
        ? `${this.clientUrl()}/payment-success`
        : `${this.clientUrl()}/payment-failed?reason=${encodeURIComponent(
            data.statusMessage,
          )}`;
    } catch (error) {
      console.error('Execute error:', error?.response?.data || error);
      return `${this.backendUrl()}/api/v1/payment/bkash/query?paymentID=${paymentID}`;
    }
  }

  async queryPayment(query: Record<string, string>) {
    const { paymentID } = query;
    const token = await this.getAccessToken();
    const baseUrl = process.env.BKASH_BASE_URL;
    if (!baseUrl) throw new BadRequestException('bKash is not configured');

    try {
      const response = await axios.post(
        `${baseUrl}/checkout/payment/query`,
        { paymentID },
        {
          headers: {
            authorization: token,
            'x-app-key': process.env.BKASH_APP_KEY,
            'Content-Type': 'application/json',
          },
        },
      );
      const data = response.data;
      const completed = data.transactionStatus === 'Completed';
      await this.paymentModel
        .updateOne(
          { paymentId: paymentID },
          {
            $set: {
              transactionStatus:
                data.transactionStatus || (completed ? 'Completed' : 'failed'),
              transactionId: data.trxID,
              statusCode: data.statusCode,
              statusMessage: data.statusMessage,
              rawResponse: data,
              paymentStatus: completed ? 'paid' : 'failed',
            },
          },
        )
        .exec();
      return completed
        ? `${this.clientUrl()}/payment-success`
        : `${this.clientUrl()}/payment-failed?reason=${encodeURIComponent(
            data.statusMessage,
          )}`;
    } catch (error) {
      console.error('Query failed:', error?.response?.data || error);
      return `${this.clientUrl()}/payment-failed?reason=query_error`;
    }
  }

  async refundPayment(body: {
    trxID: string;
    paymentID: string;
    amount: string;
  }) {
    const { trxID, paymentID, amount } = body;
    const token = await this.getAccessToken();
    const baseUrl = process.env.BKASH_BASE_URL;
    if (!baseUrl) throw new BadRequestException('bKash is not configured');
    const response = await axios.post(
      `${baseUrl}/checkout/payment/refund`,
      { paymentID, trxID, amount, reason: 'UAT refund test' },
      {
        headers: {
          authorization: token,
          'x-app-key': process.env.BKASH_APP_KEY,
          'Content-Type': 'application/json',
        },
      },
    );
    return response.data;
  }
}

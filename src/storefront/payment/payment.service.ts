import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';
import { StorefrontOrdersService } from '../orders/storefront-orders.service';



@Injectable()
export class PaymentService {
  constructor(
    @InjectModel('Pfu2Payment') private readonly paymentModel: Model<any>,
    private readonly settingsService: SettingsService,
    private readonly storefrontOrdersService: StorefrontOrdersService,
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

  async getPaymentByOrderId(orderId: string) {
    return this.paymentModel.findOne({ orderId }).lean().exec();
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
    console.log('[bKash] Getting access token...');
    // bKash tokens are valid for a long time (months). Cache until invalidated.
    const cached = await this.settingsService.getByKey('bkash_token');
    if (cached?.value) {
      console.log('[bKash] Using cached token (stored at:', cached.updatedAt || cached.updated_at, ')');
      return cached.value;
    }

    console.log('[bKash] No cached token, requesting new one...');
    return this.generateNewToken();
  }

  /**
   * Generate a new bKash access token and cache it.
   */
  private async generateNewToken(): Promise<string> {
    const baseUrl = process.env.BKASH_BASE_URL;
    if (!baseUrl || !process.env.BKASH_APP_KEY) {
      console.error('[bKash] ERROR: BKASH_BASE_URL or BKASH_APP_KEY not configured');
      console.error('[bKash] BKASH_BASE_URL:', baseUrl);
      console.error('[bKash] BKASH_APP_KEY:', process.env.BKASH_APP_KEY ? 'SET' : 'MISSING');
      throw new BadRequestException(
        'bKash is not configured (BKASH_BASE_URL / BKASH_APP_KEY missing)',
      );
    }

    console.log('[bKash] Requesting token from:', `${baseUrl}/checkout/token/grant`);
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

    console.log('[bKash] Token response status:', response.status);
    const token = response.data.id_token;
    if (!token) {
      console.error('[bKash] ERROR: No id_token in response:', response.data);
      throw new BadRequestException('Failed to get bKash access token');
    }
    console.log('[bKash] Token obtained successfully');
    await this.settingsService.upsert(
      'bkash_token',
      token,
      'Access token for bKash API',
    );
    return token;
  }

  /**
   * Clear cached token (call when token is rejected by bKash).
   */
  private async clearCachedToken() {
    try {
      const cached = await this.settingsService.getByKey('bkash_token');
      if (cached) {
        await this.settingsService.upsert('bkash_token', '', 'Expired bKash token');
        console.log('[bKash] Cached token cleared');
      }
    } catch (e) {
      console.error('[bKash] Error clearing cached token:', e);
    }
  }

  async createBkashPayment(body: any) {
    console.log('[bKash] createBkashPayment called with body:', JSON.stringify(body, null, 2));

    const baseUrl = process.env.BKASH_BASE_URL;
    if (!baseUrl) {
      console.error('[bKash] ERROR: BKASH_BASE_URL not configured');
      throw new BadRequestException('bKash is not configured');
    }

    const invoiceNumber = 'INVPFU2-' + Date.now();
    const paymentData = {
      mode: '0011',
      payerReference: body.phone || '01700000000',
      callbackURL: `${process.env.BACKEND_URL}/api/v1/payment/bkash/callback`,
      merchantAssociationInfo: 'MI05MID54RF09123456One',
      amount: body.amount,
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: invoiceNumber,
    };

    console.log('[bKash] Creating payment with bKash API...');
    console.log('[bKash] Payment data:', JSON.stringify(paymentData, null, 2));
    console.log('[bKash] Request URL:', `${baseUrl}/checkout/create`);

    // Try with cached token first, retry with fresh token if auth fails
    for (let attempt = 1; attempt <= 2; attempt++) {
      const token = await (attempt === 1 ? this.getAccessToken() : this.generateNewToken());
      console.log(`[bKash] Attempt ${attempt}: Token obtained`);

      try {
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

        console.log('[bKash] bKash API response status:', response.status);
        console.log('[bKash] bKash API response data:', JSON.stringify(response.data, null, 2));

        const { paymentID, bkashURL } = response.data;

        if (!paymentID || !bkashURL) {
          console.error('[bKash] ERROR: Missing paymentID or bkashURL in response');
          console.error('[bKash] Response data:', response.data);
          throw new BadRequestException('Failed to create bKash payment - invalid response from bKash API');
        }

        console.log('[bKash] Payment created successfully. paymentID:', paymentID);
        console.log('[bKash] bkashURL:', bkashURL);

        await this.paymentModel.create({
          method: 'bkash',
          phoneNumber: body.phone || '01700000000',
          paymentId: paymentID,
          orderId: body.orderId ?? null,
          transactionStatus: 'initiated',
          statusMessage: 'Awaiting bKash execution',
          amount: body.amount,
          pendingOrderData: body.pendingOrderData ?? null,
        });
        console.log('[bKash] Payment record saved to Pfu2Payment collection');

        return { paymentID, bkashURL };
      } catch (error: any) {
        const status = error.response?.status;
        const errData = error.response?.data;
        const errCode = errData?.statusCode;
        const errMsg = errData?.statusMessage || error.message;

        console.error(`[bKash] Attempt ${attempt} failed:`, errMsg);
        console.error('[bKash] Status:', status, 'Code:', errCode);

        // Check if this is an auth/token error - retry with fresh token
        const isAuthError =
          status === 401 ||
          status === 403 ||
          errCode === '2003' ||  // Invalid token
          errCode === '2004' ||  // Token expired
          errCode === '1016' ||  // Unauthorized
          errMsg?.toLowerCase().includes('invalid') && errMsg?.toLowerCase().includes('token') ||
          errMsg?.toLowerCase().includes('unauthorized');

        if (isAuthError && attempt === 1) {
          console.log('[bKash] Auth error detected, clearing token and retrying...');
          await this.clearCachedToken();
          continue; // retry with fresh token
        }

        // Non-auth error or second attempt failed
        console.error('[bKash] ERROR creating payment:', error.message);
        console.error('[bKash] Error response data:', errData);
        throw error;
      }
    }
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
    console.log('[bKash] bkashCallback received:', JSON.stringify(query, null, 2));

    if (!paymentID || !status) {
      console.error('[bKash] ERROR: Missing paymentID or status in callback');
      return `${this.clientUrl()}/payment-failed?reason=invalid_callback`;
    }
    if (status === 'cancel' || status === 'failure') {
      console.log('[bKash] Payment was cancelled or failed:', status);
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
      console.log('[bKash] Pfu2Payment record updated to failed');

      // Also update the Payments collection for this order
      await this.updateOrderPaymentStatus(paymentID, 'failed');
      // Send payment failure email
      await this.sendPaymentFailureEmail(paymentID, status);

      return `${this.clientUrl()}/payment-failed?reason=${status}&paymentID=${paymentID}`;
    }
    console.log('[bKash] Payment callback OK, redirecting to execute endpoint');
    return `${this.backendUrl()}/api/v1/payment/bkash/execute?paymentID=${paymentID}`;
  }

  async executePayment(query: Record<string, string>) {
    const { paymentID } = query;
    console.log('[bKash] executePayment called with paymentID:', paymentID);

    const token = await this.getAccessToken();
    const baseUrl = process.env.BKASH_BASE_URL;
    if (!baseUrl) throw new BadRequestException('bKash is not configured');

    try {
      console.log('[bKash] Executing payment on bKash API...');
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
      console.log('[bKash] Execute response:', JSON.stringify(data, null, 2));

      const completed =
        data.statusCode === '0000' && data.transactionStatus === 'Completed';
      console.log('[bKash] Payment completed:', completed);
      console.log('[bKash] Transaction status:', data.transactionStatus);
      console.log('[bKash] Transaction ID:', data.trxID);

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
      console.log('[bKash] Pfu2Payment record updated');

      // Also update the Payments collection for this order
      await this.updateOrderPaymentStatus(paymentID, completed ? 'paid' : 'failed');

      // Send payment failure email if not completed
      if (!completed) {
        await this.sendPaymentFailureEmail(paymentID, data.transactionStatus || 'failed');
      }

      // Create order after successful payment (payment-first flow)
      let orderId = '';
      let paymentAmount = '';
      if (completed) {
        const paymentRecord = await this.paymentModel.findOne({ paymentId: paymentID }).exec();
        paymentAmount = paymentRecord?.amount || '';
        if (paymentRecord?.pendingOrderData) {
          try {
            console.log('[bKash] Creating order from pendingOrderData...');
            const orderData = paymentRecord.pendingOrderData;
            const orderResult = await this.storefrontOrdersService.createPreStockOrder({
              userId: orderData.userId,
              guestEmail: orderData.guestEmail,
              guestContact: orderData.guestContact,
              isGuest: orderData.isGuest,
              cartId: orderData.cartId,
              shipping: orderData.shipping,
              billing: orderData.billing,
              paymentMethod: orderData.paymentMethod || 'bkash',
              advancePaymentData: {
                trxID: data.trxID,
                amount: paymentRecord?.amount ? parseFloat(paymentRecord.amount) : 0,
                paymentID: paymentID,
              },
            });
            orderId = orderResult.orderNumber;
            console.log('[bKash] Order created:', orderId);

            // Link payment to the created order
            await this.paymentModel
              .updateOne({ paymentId: paymentID }, { $set: { orderId } })
              .exec();

            // Send payment success email to customer
            await this.sendPaymentSuccessEmail(paymentID, orderId);
          } catch (orderError: any) {
            console.error('[bKash] Error creating order from pendingOrderData:', orderError.message);
          }
        } else {
          orderId = paymentRecord?.orderId || '';
        }
      } else {
        const paymentRecord = await this.paymentModel.findOne({ paymentId: paymentID }).exec();
        orderId = paymentRecord?.orderId || '';
        paymentAmount = paymentRecord?.amount || '';
      }

      return completed
        ? `${this.clientUrl()}/payment-success?paymentID=${paymentID}&trxID=${data.trxID || ''}&amount=${paymentAmount}&orderId=${orderId}`
        : `${this.clientUrl()}/payment-failed?reason=${encodeURIComponent(
            data.statusMessage,
          )}&paymentID=${paymentID}&orderId=${orderId}`;
    } catch (error) {
      console.error('[bKash] Execute error:', error?.response?.data || error);
      return `${this.backendUrl()}/api/v1/payment/bkash/query?paymentID=${paymentID}`;
    }
  }

  async queryPayment(query: Record<string, string>) {
    const { paymentID } = query;
    console.log('[bKash] queryPayment called with paymentID:', paymentID);

    const token = await this.getAccessToken();
    const baseUrl = process.env.BKASH_BASE_URL;
    if (!baseUrl) throw new BadRequestException('bKash is not configured');

    try {
      console.log('[bKash] Querying payment on bKash API...');
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
      console.log('[bKash] Query response:', JSON.stringify(data, null, 2));

      const completed = data.transactionStatus === 'Completed';
      console.log('[bKash] Payment completed:', completed);

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
      console.log('[bKash] Pfu2Payment record updated');

      // Also update the Payments collection for this order
      await this.updateOrderPaymentStatus(paymentID, completed ? 'paid' : 'failed');

      // Send payment failure email if not completed
      if (!completed) {
        await this.sendPaymentFailureEmail(paymentID, data.transactionStatus || 'failed');
      }

      // Get orderId from Pfu2Payment record to include in redirect
      const paymentRecord = await this.paymentModel.findOne({ paymentId: paymentID }).exec();
      const orderId = paymentRecord?.orderId || '';

      return completed
        ? `${this.clientUrl()}/payment-success?paymentID=${paymentID}&trxID=${data.trxID || ''}&amount=${paymentRecord?.amount || ''}&orderId=${orderId}`
        : `${this.clientUrl()}/payment-failed?reason=${encodeURIComponent(
            data.statusMessage,
          )}&paymentID=${paymentID}&orderId=${orderId}`;
    } catch (error) {
      console.error('[bKash] Query failed:', error?.response?.data || error);
      return `${this.clientUrl()}/payment-failed?reason=query_error&paymentID=${paymentID}`;
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

  /**
   * Update the Payments collection (used by storefront orders) when bKash
   * payment status changes. This links the bKash gateway result back to
   * the actual order payment record.
   */
  private async updateOrderPaymentStatus(paymentID: string, status: string) {
    try {
      // Find the Pfu2Payment record to get the orderId
      const pfu2Payment = await this.paymentModel.findOne({ paymentId: paymentID }).exec();
      if (!pfu2Payment?.orderId) {
        console.log('[bKash] No orderId found in Pfu2Payment for paymentID:', paymentID);
        return;
      }

      const orderId = pfu2Payment.orderId;
      console.log('[bKash] Updating Payments collection for orderId:', orderId, 'status:', status);

      // Use mongoose to get the Payments model directly
      const mongoose = this.paymentModel.db;
      const PaymentsModel = mongoose.model('Payments');

      const updateResult = await PaymentsModel.updateOne(
        { orderId: orderId },
        {
          $set: {
            paymentStatus: status,
            transactionStatus: status === 'paid' ? 'Completed' : status,
          },
        },
      ).exec();

      console.log('[bKash] Payments collection update result:', updateResult);
    } catch (error: any) {
      console.error('[bKash] Error updating Payments collection:', error.message);
    }
  }

  /**
   * Repay a failed order using bKash.
   * Creates a new bKash payment for the existing order.
   */
  async repayBkashPayment(orderId: string) {
    console.log('[bKash] repayBkashPayment called for orderId:', orderId);

    if (!orderId) {
      console.error('[bKash] ERROR: orderId is required');
      throw new BadRequestException('orderId is required');
    }

    // Find the Payments record for this order to get the amount
    const mongoose = this.paymentModel.db;
    const PaymentsModel = mongoose.model('Payments');
    const paymentRecord = await PaymentsModel.findOne({ orderId }).exec();

    if (!paymentRecord) {
      console.error('[bKash] ERROR: No payment record found for orderId:', orderId);
      throw new NotFoundException(`No payment record found for order ${orderId}`);
    }

    console.log('[bKash] Found payment record:', JSON.stringify(paymentRecord, null, 2));

    const amount = paymentRecord.amount || paymentRecord.grandTotal;
    if (!amount) {
      console.error('[bKash] ERROR: No amount found in payment record');
      throw new BadRequestException('Payment amount not found for this order');
    }

    // Get customer phone from the order
    const OrdersModel = mongoose.model('Orders');
    const orderDoc = await OrdersModel.findOne({ orderNumber: orderId }).exec();
    const phone = orderDoc?.guestContact || '01929918378';

    console.log('[bKash] Repaying with amount:', amount, 'phone:', phone);

    // Create a new bKash payment
    const result = await this.createBkashPayment({
      amount: String(amount),
      orderId: orderId,
      phone: phone,
    });

    console.log('[bKash] Repay payment created:', result);
    return result;
  }

  /**
   * Send payment failure email to customer when bKash payment fails.
   */
  private async sendPaymentFailureEmail(paymentID: string, reason: string) {
    try {
      const pfu2Payment = await this.paymentModel.findOne({ paymentId: paymentID }).exec();
      if (!pfu2Payment?.orderId) {
        console.log('[bKash] No orderId found for failure email, paymentID:', paymentID);
        return;
      }

      // Try to get customer email from the order or customer model
      const mongoose = this.paymentModel.db;
      const OrdersModel = mongoose.model('Orders');
      const orderDoc = await OrdersModel.findOne({ orderNumber: pfu2Payment.orderId }).exec();

      if (!orderDoc) {
        console.log('[bKash] No order found for failure email, orderId:', pfu2Payment.orderId);
        return;
      }

      // Get customer email
      let customerEmail = '';
      let customerName = '';
      if (orderDoc.userId) {
        const CustomerModel = mongoose.model('Customer');
        const customer = await CustomerModel.findById(orderDoc.userId).exec();
        if (customer) {
          customerEmail = customer.emailAddress || customer.email || '';
          customerName = customer.customerName || customer.name || '';
        }
      }
      // Fallback to guest email
      if (!customerEmail && orderDoc.guestEmail) {
        customerEmail = orderDoc.guestEmail;
        customerName = 'Customer';
      }

      if (!customerEmail) {
        console.log('[bKash] No email found for failure notification');
        return;
      }

      console.log('[bKash] Sending payment failure email to:', customerEmail);

      // Import MailService dynamically to avoid circular dependency issues
      // We'll use the transporter directly from the existing mail service
      const clientUrl = this.clientUrl();
      const trackUrl = `${clientUrl}/trackorder/${pfu2Payment.orderId}`;
      const repayUrl = `${clientUrl}/account/orders`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 30px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">PFU2</h1>
                      <p style="color: #fecaca; margin: 5px 0 0 0; font-size: 13px;">Payment Failed</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 30px 0 30px; text-align: center;">
                      <div style="display: inline-block; background: #fef2f2; border: 2px solid #ef4444; border-radius: 50px; padding: 12px 30px;">
                        <span style="font-size: 20px; margin-right: 8px;">✕</span>
                        <span style="color: #ef4444; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Payment Failed</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 25px 30px;">
                      <p style="color: #374151; font-size: 16px; margin: 0 0 10px 0;">Dear <strong>${customerName}</strong>,</p>
                      <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                        Your payment for order <strong>#${pfu2Payment.orderId}</strong> could not be completed.
                      </p>
                      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Reason:</strong> ${reason}</p>
                        <p style="margin: 8px 0 0 0; color: #991b1b; font-size: 14px;"><strong>Amount:</strong> Tk ${pfu2Payment.amount}</p>
                      </div>
                      <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 5px 0;">
                        You can retry the payment from your account orders page.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 30px 15px 30px; text-align: center;">
                      <a href="${repayUrl}" style="display: inline-block; background: #0d6efd; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Retry Payment</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 30px 30px 30px; text-align: center;">
                      <a href="${trackUrl}" style="display: inline-block; background: transparent; color: #0d6efd; padding: 10px 30px; text-decoration: none; border: 1px solid #0d6efd; border-radius: 8px; font-weight: 600; font-size: 14px;">Track Order</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>`;

      // Use process.env to get SMTP config and send directly
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `PFU2 <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: customerEmail,
        subject: `Payment Failed - Order ${pfu2Payment.orderId} - PFU2`,
        html,
      });
      console.log('[bKash] Payment failure email sent to:', customerEmail);
    } catch (error: any) {
      console.error('[bKash] Error sending payment failure email:', error.message);
    }
  }

  /**
   * Send payment success confirmation email to customer after bKash payment succeeds.
   */
  private async sendPaymentSuccessEmail(paymentID: string, orderNumber: string) {
    try {
      const pfu2Payment = await this.paymentModel.findOne({ paymentId: paymentID }).exec();
      if (!pfu2Payment) {
        console.log('[bKash] No payment record found for success email, paymentID:', paymentID);
        return;
      }

      const pendingData = pfu2Payment.pendingOrderData;
      const customerEmail = pendingData?.shipping?.email || pendingData?.billing?.email || '';
      const customerName = pendingData?.shipping?.name || pendingData?.billing?.name || 'Customer';

      if (!customerEmail) {
        console.log('[bKash] No email found for success notification');
        return;
      }

      console.log('[bKash] Sending payment success email to:', customerEmail);

      const clientUrl = this.clientUrl();
      const trackUrl = `${clientUrl}/trackorder/${orderNumber}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #059669, #10b981); padding: 30px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">PFU2</h1>
                      <p style="color: #d1fae5; margin: 5px 0 0 0; font-size: 13px;">Payment Successful</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 30px 0 30px; text-align: center;">
                      <div style="display: inline-block; background: #ecfdf5; border: 2px solid #10b981; border-radius: 50px; padding: 12px 30px;">
                        <span style="font-size: 20px; margin-right: 8px;">✓</span>
                        <span style="color: #059669; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Payment Confirmed</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 25px 30px;">
                      <p style="color: #374151; font-size: 16px; margin: 0 0 10px 0;">Dear <strong>${customerName}</strong>,</p>
                      <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                        Your payment has been received successfully and your order has been placed.
                      </p>
                      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #065f46; font-size: 14px;"><strong>Order Number:</strong> ${orderNumber}</p>
                        <p style="margin: 8px 0 0 0; color: #065f46; font-size: 14px;"><strong>Amount Paid:</strong> Tk ${pfu2Payment.amount}</p>
                        <p style="margin: 8px 0 0 0; color: #065f46; font-size: 14px;"><strong>Transaction ID:</strong> ${pfu2Payment.transactionId || 'N/A'}</p>
                      </div>
                      <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 5px 0;">
                        You can track your order status anytime from your account.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 30px 30px 30px; text-align: center;">
                      <a href="${trackUrl}" style="display: inline-block; background: #059669; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Track My Order</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 30px;">
                      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;">
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 15px 30px; text-align: center;">
                      <p style="color: #9ca3af; font-size: 11px; margin: 3px 0;">PFU2</p>
                      <p style="color: #9ca3af; font-size: 11px; margin: 3px 0;">Contact: 09678-114411 | Email: info@pfu2.com</p>
                      <p style="color: #9ca3af; font-size: 11px; margin: 3px 0;">House 56, Road 01, Block A, Niketan, Gulshan - 01, Dhaka - 1212</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>`;

      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `PFU2 <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: customerEmail,
        subject: `Payment Confirmed - Order ${orderNumber} - PFU2`,
        html,
      });
      console.log('[bKash] Payment success email sent to:', customerEmail);
    } catch (error: any) {
      console.error('[bKash] Error sending payment success email:', error.message);
    }
  }
}

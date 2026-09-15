import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';
import { StorefrontOrdersService } from '../orders/storefront-orders.service';

/**
 * EPS (Easy Payment System) Gateway integration.
 *
 * Flow:
 *  1. GetToken          -> JWT bearer token (cached until expiry)
 *  2. InitializeEPS     -> returns { TransactionId, RedirectURL }
 *  3. Redirect customer -> EPS payment page
 *  4. EPS calls back    -> successUrl/failUrl/cancelUrl with merchantTransactionId
 *  5. Verify txn        -> CheckMerchantTransactionStatus (merchantTransactionId)
 *
 * Auth headers:
 *  - x-hash: HMACSHA512(value, hashKey) base64  (value = username for GetToken,
 *            value = merchantTransactionId for Initialize/Verify)
 *  - Authorization: Bearer <token>
 */
@Injectable()
export class EpsService {
  constructor(
    @InjectModel('Pfu2Payment') private readonly paymentModel: Model<any>,
    private readonly settingsService: SettingsService,
    private readonly storefrontOrdersService: StorefrontOrdersService,
  ) {}

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private endpoints() {
    const sandbox =
      String(process.env.EPS_SANDBOX || 'true').toLowerCase() !== 'false';
    const base = sandbox
      ? 'https://sandboxpgapi.eps.com.bd'
      : 'https://pgapi.eps.com.bd';
    return {
      getToken: `${base}/v1/Auth/GetToken`,
      initialize: `${base}/v1/EPSEngine/InitializeEPS`,
      verify: `${base}/v1/EPSEngine/CheckMerchantTransactionStatus`,
    };
  }

  private generateHash(value: string, hashKey: string): string {
    const hmac = crypto.createHmac('sha512', Buffer.from(hashKey, 'utf8'));
    hmac.update(value, 'utf8');
    return hmac.digest('base64');
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

  private ensureConfigured() {
    const missing = [
      'EPS_USERNAME',
      'EPS_PASSWORD',
      'EPS_HASH_KEY',
      'EPS_MERCHANT_ID',
      'EPS_STORE_ID',
    ].filter((k) => !process.env[k]);
    if (missing.length) {
      throw new BadRequestException(
        `EPS is not configured (missing: ${missing.join(', ')})`,
      );
    }
  }

  private requiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new BadRequestException(`EPS is not configured (missing: ${key})`);
    }
    return value;
  }

  // ------------------------------------------------------------------
  // Token management (cached in settings collection)
  // ------------------------------------------------------------------

  async getAccessToken(): Promise<string> {
    const [cached, expiry] = await Promise.all([
      this.settingsService.getByKey('eps_token'),
      this.settingsService.getByKey('eps_token_expiry'),
    ]);
    const isFresh =
      cached?.value &&
      (!expiry?.value || new Date(expiry.value).getTime() > Date.now());
    if (isFresh) {
      return cached.value;
    }
    return this.generateNewToken();
  }

  private async generateNewToken(): Promise<string> {
    this.ensureConfigured();
    const { getToken } = this.endpoints();
    const hash = this.generateHash(
      this.requiredEnv('EPS_USERNAME'),
      this.requiredEnv('EPS_HASH_KEY'),
    );

    const response = await axios.post(
      getToken,
      {
        userName: this.requiredEnv('EPS_USERNAME'),
        password: this.requiredEnv('EPS_PASSWORD'),
      },
      {
        headers: {
          'x-hash': hash,
          'Content-Type': 'application/json',
        },
      },
    );

    const data = response.data;
    if (!data?.token) {
      console.error('[EPS] Token response error:', JSON.stringify(data));
      throw new BadRequestException(
        data?.errorMessage || 'Failed to get EPS access token',
      );
    }
    await this.settingsService.upsert(
      'eps_token',
      data.token,
      'Access token for EPS API',
    );
    await this.settingsService.upsert(
      'eps_token_expiry',
      data.expireDate || '',
      'EPS access token expiry',
    );
    return data.token;
  }

  private async clearCachedToken() {
    try {
      await Promise.all([
        this.settingsService.remove('eps_token'),
        this.settingsService.remove('eps_token_expiry'),
      ]);
    } catch (e) {
      console.error('[EPS] Error clearing cached token:', e);
    }
  }

  // ------------------------------------------------------------------
  // Initialize payment
  // ------------------------------------------------------------------

  async initializePayment(body: any): Promise<{
    merchantTransactionId: string;
    redirectUrl: string;
    TransactionId: string;
  }> {
    this.ensureConfigured();
    const { initialize } = this.endpoints();

    const token = await this.getAccessToken();
    const merchantTransactionId =
      body.merchantTransactionId || `PFU2${Date.now()}`;

    // Full amount to charge. Defaults to total order amount if not supplied.
    const totalAmount = Number(body.amount);
    if (!totalAmount || totalAmount <= 0) {
      throw new BadRequestException('amount is required and must be > 0');
    }

    const orderData = body.pendingOrderData || {};
    const shipping = orderData.shipping || {};
    const customerName = shipping.name || body.customerName || 'Customer';
    const customerEmail =
      shipping.email ||
      body.customerEmail ||
      orderData.guestEmail ||
      'customer@example.com';
    const customerPhone = shipping.phone || body.phone || '01700000000';
    const customerAddress =
      shipping.shippingAddress || body.customerAddress || 'Dhaka';
    const customerCity = shipping.district || body.customerCity || 'Dhaka';
    const customerPostcode = body.customerPostcode || '1200';

    const hash = this.generateHash(
      merchantTransactionId,
      this.requiredEnv('EPS_HASH_KEY'),
    );

    const payload = {
      merchantId: this.requiredEnv('EPS_MERCHANT_ID'),
      storeId: this.requiredEnv('EPS_STORE_ID'),
      CustomerOrderId: `PFU2-${Date.now()}`,
      merchantTransactionId,
      transactionTypeId: 1, // 1 = Web
      financialEntityId: 0,
      transitionStatusId: 0,
      totalAmount,
      ipAddress: '0.0.0.0',
      version: '1',
      successUrl: `${this.backendUrl()}/api/v1/payment/eps/callback?result=success`,
      failUrl: `${this.backendUrl()}/api/v1/payment/eps/callback?result=failed`,
      cancelUrl: `${this.backendUrl()}/api/v1/payment/eps/callback?result=cancelled`,
      customerName,
      customerEmail,
      CustomerAddress: customerAddress,
      CustomerAddress2: body.customerAddress2 || '',
      CustomerCity: customerCity,
      CustomerState: customerCity,
      CustomerPostcode: customerPostcode,
      CustomerCountry: body.customerCountry || 'BD',
      CustomerPhone: customerPhone,
      ShipmentName: shipping.name || customerName,
      ShipmentAddress: customerAddress,
      ShipmentAddress2: '',
      ShipmentCity: customerCity,
      ShipmentState: customerCity,
      ShipmentPostcode: customerPostcode,
      ShipmentCountry: 'BD',
      ValueA: String(body.orderId || orderData.orderId || ''),
      ValueB: '',
      ValueC: '',
      ValueD: '',
      ShippingMethod: 'NO',
      NoOfItem: '1',
      ProductName: body.productName || orderData.productName || 'PFU2 Order',
      ProductProfile: 'general',
      ProductCategory: 'general',
      ProductList: [],
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      const attemptToken =
        attempt === 1 ? token : await this.generateNewToken();
      const attemptHash =
        attempt === 1
          ? hash
          : this.generateHash(
              merchantTransactionId,
              this.requiredEnv('EPS_HASH_KEY'),
            );
      try {
        const response = await axios.post(initialize, payload, {
          headers: {
            'x-hash': attemptHash,
            Authorization: `Bearer ${attemptToken}`,
            'Content-Type': 'application/json',
          },
        });

        const data = response.data;
        if (!data?.RedirectURL) {
          console.error('[EPS] Initialize failed:', JSON.stringify(data));
          throw new BadRequestException(
            data?.ErrorMessage || 'Failed to initialize EPS payment',
          );
        }

        await this.paymentModel.create({
          method: 'eps',
          phoneNumber: customerPhone,
          paymentId: data.TransactionId || null,
          merchantTransactionId,
          redirectUrl: data.RedirectURL,
          orderId: body.orderId ?? null,
          transactionStatus: 'initiated',
          statusMessage: 'Awaiting EPS execution',
          amount: String(totalAmount),
          pendingOrderData: body.pendingOrderData ?? null,
        });

        return {
          merchantTransactionId,
          redirectUrl: data.RedirectURL,
          TransactionId: data.TransactionId || '',
        };
      } catch (error: any) {
        const status = error.response?.status;
        const isAuthError = status === 401 || status === 403 || status === 404;
        if (isAuthError && attempt === 1) {
          console.log('[EPS] Auth error, clearing token and retrying...');
          await this.clearCachedToken();
          continue;
        }
        throw error;
      }
    }
    throw new BadRequestException('Failed to initialize EPS payment');
  }

  // ------------------------------------------------------------------
  // Verify transaction (CheckMerchantTransactionStatus)
  // ------------------------------------------------------------------

  async verifyPayment(merchantTransactionId: string): Promise<any> {
    if (!merchantTransactionId) {
      throw new BadRequestException('merchantTransactionId is required');
    }
    const { verify } = this.endpoints();
    const hash = this.generateHash(
      merchantTransactionId,
      this.requiredEnv('EPS_HASH_KEY'),
    );

    for (let attempt = 1; attempt <= 2; attempt++) {
      const token = await this.getAccessToken();
      try {
        const response = await axios.get(
          `${verify}?merchantTransactionId=${encodeURIComponent(
            merchantTransactionId,
          )}`,
          {
            headers: {
              'x-hash': hash,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );
        return response.data;
      } catch (error: any) {
        const status = error.response?.status;
        const isAuthError = status === 401 || status === 403 || status === 404;
        if (isAuthError && attempt === 1) {
          console.log(
            '[EPS] Verify auth error, clearing token and retrying...',
          );
          await this.clearCachedToken();
          continue;
        }
        throw error;
      }
    }
    throw new BadRequestException('Failed to verify EPS transaction');
  }

  // ------------------------------------------------------------------
  // Callback handler (EPS redirects back to success/fail/cancel URL)
  // ------------------------------------------------------------------

  async callback(query: Record<string, string>): Promise<string> {
    console.log('[EPS] Callback received:', JSON.stringify(query));

    const merchantTransactionId =
      query.MerchantTransactionId ||
      query.merchantTransactionId ||
      query.MerchantTransactionId2 ||
      query.merchantTransactionId2 ||
      query.transactionId ||
      query.TransactionId ||
      '';

    if (!merchantTransactionId) {
      return `${this.clientUrl()}/payment-failed?reason=invalid_callback&method=eps`;
    }

    try {
      const verification = await this.verifyPayment(merchantTransactionId);
      console.log(
        '[EPS] Verification result:',
        JSON.stringify(verification, null, 2),
      );

      const status = (verification?.Status || '').toLowerCase();
      const amount = verification?.TotalAmount || '';
      const epsTransactionId = verification?.EPSTransactionId || '';

      // Find the stored payment record
      const paymentRecord = await this.paymentModel
        .findOne({ merchantTransactionId })
        .exec();

      if (status === 'success') {
        // Update payment records
        await this.paymentModel
          .updateOne(
            { merchantTransactionId },
            {
              $set: {
                transactionStatus: 'Completed',
                transactionId: epsTransactionId,
                statusCode: verification.ErrorCode || '',
                statusMessage: verification.ErrorMessage || 'Payment completed',
                rawResponse: verification,
                paymentStatus: 'paid',
              },
            },
          )
          .exec();
        await this.updateOrderPaymentStatus(merchantTransactionId, 'paid');

        // Create the order after successful payment (payment-first flow).
        // Idempotent: skip if the order was already created by a previous
        // callback invocation (EPS may call the success URL more than once).
        let orderId = paymentRecord?.orderId || '';
        if (paymentRecord?.pendingOrderData && !orderId) {
          try {
            const orderData = paymentRecord.pendingOrderData;
            const orderResult =
              await this.storefrontOrdersService.createPreStockOrder({
                userId: orderData.userId,
                guestEmail: orderData.guestEmail,
                guestContact: orderData.guestContact,
                isGuest: orderData.isGuest,
                cartId: orderData.cartId,
                shipping: orderData.shipping,
                billing: orderData.billing,
                paymentMethod: orderData.paymentMethod || 'eps',
                advancePaymentData: {
                  trxID: epsTransactionId,
                  amount: Number(
                    paymentRecord?.amount
                      ? parseFloat(paymentRecord.amount)
                      : parseFloat(amount || '0'),
                  ),
                  paymentID: paymentRecord?.paymentId,
                },
              });
            orderId = orderResult.orderNumber || orderResult.orderId;
            await this.paymentModel
              .updateOne({ merchantTransactionId }, { $set: { orderId } })
              .exec();
            await this.sendPaymentSuccessEmail(merchantTransactionId, orderId);
          } catch (orderError: any) {
            console.error('[EPS] Error creating order:', orderError.message);
          }
        }

        return `${this.clientUrl()}/payment-success?trxID=${encodeURIComponent(
          epsTransactionId,
        )}&amount=${encodeURIComponent(
          amount || paymentRecord?.amount || '',
        )}&orderId=${encodeURIComponent(orderId)}`;
      }

      // Failed / pending / cancelled
      await this.paymentModel
        .updateOne(
          { merchantTransactionId },
          {
            $set: {
              transactionStatus: verification.TransactionType || status,
              transactionId: epsTransactionId,
              statusCode: verification.ErrorCode || '',
              statusMessage: verification.ErrorMessage || 'Payment failed',
              rawResponse: verification,
              paymentStatus: 'failed',
            },
          },
        )
        .exec();
      await this.updateOrderPaymentStatus(merchantTransactionId, 'failed');
      await this.sendPaymentFailureEmail(
        merchantTransactionId,
        verification.ErrorMessage || status,
      );

      return `${this.clientUrl()}/payment-failed?reason=${encodeURIComponent(
        verification.ErrorMessage || status,
      )}&orderId=${encodeURIComponent(
        paymentRecord?.orderId || '',
      )}&method=eps&merchantTransactionId=${encodeURIComponent(
        merchantTransactionId,
      )}`;
    } catch (error: any) {
      console.error(
        '[EPS] Callback error:',
        error?.response?.data || error?.message || error,
      );
      return `${this.clientUrl()}/payment-failed?reason=verification_error&method=eps&merchantTransactionId=${encodeURIComponent(
        merchantTransactionId,
      )}`;
    }
  }

  // ------------------------------------------------------------------
  // Repay a failed order via EPS
  // ------------------------------------------------------------------

  async repayEpsPayment(orderId: string) {
    console.log('[EPS] repayEpsPayment called for orderId:', orderId);
    if (!orderId) {
      throw new BadRequestException('orderId is required');
    }

    const mongoose = this.paymentModel.db;
    const PaymentsModel = mongoose.model('Payments');
    const paymentRecord = await PaymentsModel.findOne({ orderId }).exec();
    if (!paymentRecord) {
      throw new NotFoundException(
        `No payment record found for order ${orderId}`,
      );
    }

    const amount = paymentRecord.amount || paymentRecord.grandTotal;
    if (!amount) {
      throw new BadRequestException('Payment amount not found for this order');
    }

    const OrdersModel = mongoose.model('Orders');
    const orderDoc = await OrdersModel.findOne({ orderNumber: orderId }).exec();
    const shipping = orderDoc?.shippingAddress || {};
    const phone = orderDoc?.guestContact || shipping.phone || '01700000000';

    return this.initializePayment({
      amount: String(amount),
      orderId,
      phone,
    });
  }

  /**
   * Quick payment status endpoint helper.
   */
  async getPaymentStatus(merchantTransactionId: string) {
    const verification = await this.verifyPayment(merchantTransactionId);
    const record: any = await this.paymentModel
      .findOne({ merchantTransactionId })
      .lean()
      .exec();
    return {
      merchantTransactionId,
      Status: verification?.Status || 'Unknown',
      EpsTransactionId: verification?.EPSTransactionId || '',
      TotalAmount: verification?.TotalAmount || record?.amount || '',
      ErrorCode: verification?.ErrorCode || '',
      ErrorMessage: verification?.ErrorMessage || '',
      transactionStatus: record?.transactionStatus || 'unknown',
      paymentStatus: record?.paymentStatus || 'pending',
    };
  }

  // ------------------------------------------------------------------
  // Payments collection sync (used by storefront orders)
  // ------------------------------------------------------------------

  private async updateOrderPaymentStatus(
    merchantTransactionId: string,
    status: string,
  ) {
    try {
      const pfu2Payment = await this.paymentModel
        .findOne({ merchantTransactionId })
        .exec();
      if (!pfu2Payment?.orderId) {
        console.log(
          '[EPS] No orderId found for merchantTransactionId:',
          merchantTransactionId,
        );
        return;
      }
      const orderId = pfu2Payment.orderId;
      const mongoose = this.paymentModel.db;
      const PaymentsModel = mongoose.model('Payments');
      await PaymentsModel.updateOne(
        { orderId },
        {
          $set: {
            paymentStatus: status,
            transactionStatus: status === 'paid' ? 'Completed' : status,
          },
        },
      ).exec();
      console.log('[EPS] Payments collection updated for orderId:', orderId);
    } catch (error: any) {
      console.error('[EPS] Error updating Payments collection:', error.message);
    }
  }

  // ------------------------------------------------------------------
  // Emails
  // ------------------------------------------------------------------

  private async sendPaymentFailureEmail(
    merchantTransactionId: string,
    reason: string,
  ) {
    try {
      const pfu2Payment = await this.paymentModel
        .findOne({ merchantTransactionId })
        .exec();
      const pendingData = pfu2Payment?.pendingOrderData || {};
      const customerEmail =
        pendingData?.shipping?.email || pendingData?.billing?.email || '';
      const customerName =
        pendingData?.shipping?.name || pendingData?.billing?.name || 'Customer';

      if (!customerEmail) {
        console.log('[EPS] No email found for failure notification');
        return;
      }

      const clientUrl = this.clientUrl();
      const trackUrl = ordersTrackUrl(clientUrl, pfu2Payment?.orderId || '');
      const repayUrl = `${clientUrl}/account/orders`;
      const orderId = pfu2Payment?.orderId || '';

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
                        Your payment for order <strong>#${
                          orderId || merchantTransactionId
                        }</strong> could not be completed.
                      </p>
                      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Reason:</strong> ${reason}</p>
                        <p style="margin: 8px 0 0 0; color: #991b1b; font-size: 14px;"><strong>Amount:</strong> Tk ${
                          pfu2Payment?.amount || 'N/A'
                        }</p>
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
        subject: `Payment Failed - Order ${
          orderId || merchantTransactionId
        } - PFU2`,
        html,
      });
      console.log('[EPS] Payment failure email sent to:', customerEmail);
    } catch (error: any) {
      console.error('[EPS] Error sending failure email:', error.message);
    }
  }

  private async sendPaymentSuccessEmail(
    merchantTransactionId: string,
    orderNumber: string,
  ) {
    try {
      const pfu2Payment = await this.paymentModel
        .findOne({ merchantTransactionId })
        .exec();
      if (!pfu2Payment) {
        console.log('[EPS] No payment record for success email');
        return;
      }
      const pendingData = pfu2Payment.pendingOrderData || {};
      const customerEmail =
        pendingData?.shipping?.email || pendingData?.billing?.email || '';
      const customerName =
        pendingData?.shipping?.name || pendingData?.billing?.name || 'Customer';

      if (!customerEmail) {
        console.log('[EPS] No email found for success notification');
        return;
      }

      const clientUrl = this.clientUrl();
      const trackUrl = ordersTrackUrl(clientUrl, orderNumber);

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
                        <p style="margin: 8px 0 0 0; color: #065f46; font-size: 14px;"><strong>Amount Paid:</strong> Tk ${
                          pfu2Payment.amount
                        }</p>
                        <p style="margin: 8px 0 0 0; color: #065f46; font-size: 14px;"><strong>Transaction ID:</strong> ${
                          pfu2Payment.transactionId || 'N/A'
                        }</p>
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
      console.log('[EPS] Payment success email sent to:', customerEmail);
    } catch (error: any) {
      console.error('[EPS] Error sending success email:', error.message);
    }
  }
}

function ordersTrackUrl(clientUrl: string, orderNumber: string): string {
  if (!orderNumber) return `${clientUrl}/account/orders`;
  return `${clientUrl}/trackorder/${orderNumber}`;
}

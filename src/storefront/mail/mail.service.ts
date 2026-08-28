import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly orderEmail: string;
  private readonly clientUrl: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get('SMTP_FROM') || this.config.get('SMTP_USER');
    this.orderEmail = this.config.get('ORDER_EMAIL');
    this.clientUrl = this.config.get('CLIENT_URL') || 'http://localhost:5173';

    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: Number(this.config.get('SMTP_PORT') || 465),
      secure: true,
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });

    this.transporter.verify().then(() => {
      this.logger.log('SMTP transporter verified');
    }).catch((err) => {
      this.logger.error('SMTP transporter verification failed', err.stack);
    });
  }

  async sendOtpEmail(email: string, otp: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px;">Your OTP Code</h2>
          <div style="background: #0d6efd; color: #fff; font-size: 32px; font-weight: bold;
                      padding: 15px 30px; border-radius: 8px; letter-spacing: 8px; display: inline-block;">
            ${otp}
          </div>
          <p style="color: #666; margin-top: 20px; font-size: 14px;">
            This code will expire in 5 minutes.<br/>
            Do not share this code with anyone.
          </p>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
          If you did not request this code, please ignore this email.
        </p>
      </div>`;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: 'Your OTP Code - PFU2',
        html,
      });
      this.logger.log(`OTP email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${email}`, err.stack);
    }
  }

  async sendPriceRequestEmail(customerName: string, cartId: string): Promise<void> {
    if (!this.orderEmail) {
      this.logger.warn('ORDER_EMAIL not configured, skipping price request notification');
      return;
    }

    const adminUrl = `${this.clientUrl}/dashboard/pfu2/carts`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; border-radius: 8px; padding: 30px;">
          <h2 style="color: #333; margin-bottom: 15px;">New Price Request Received</h2>
          <p style="color: #555; font-size: 15px;">
            <strong>${customerName}</strong> has submitted a new price request.
          </p>
          <p style="color: #555; font-size: 15px;">
            Please review and update the pricing in the admin panel.
          </p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${adminUrl}"
               style="background: #0d6efd; color: #fff; padding: 12px 30px; text-decoration: none;
                      border-radius: 6px; font-weight: bold; display: inline-block;">
              View in Admin Panel
            </a>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center;">
            Cart ID: ${cartId}
          </p>
        </div>
      </div>`;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: this.orderEmail,
        subject: 'New Price Request Received - PFU2',
        html,
      });
      this.logger.log(`Price request email sent to ${this.orderEmail}`);
    } catch (err) {
      this.logger.error('Failed to send price request email', err.stack);
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.clientUrl}/reset-password?token=${resetToken}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; border-radius: 8px; padding: 30px;">
          <h2 style="color: #333; margin-bottom: 15px;">Reset Your Password</h2>
          <p style="color: #555; font-size: 15px;">
            You requested a password reset. Click the button below to set a new password.
          </p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${resetUrl}"
               style="background: #dc3545; color: #fff; padding: 12px 30px; text-decoration: none;
                      border-radius: 6px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 13px;">
            This link will expire in 15 minutes.<br/>
            If you did not request this, please ignore this email.
          </p>
        </div>
      </div>`;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: 'Reset Your Password - PFU2',
        html,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}`, err.stack);
    }
  }

  async sendOrderConfirmationEmail(
    email: string,
    orderNumber: string,
    totalPrice: string,
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; border-radius: 8px; padding: 30px;">
          <h2 style="color: #28a745; margin-bottom: 15px;">Order Confirmed!</h2>
          <p style="color: #555; font-size: 15px;">
            Thank you for your order. Your order has been placed successfully.
          </p>
          <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Order Number:</strong> ${orderNumber}</p>
            <p style="margin: 5px 0;"><strong>Total:</strong> Tk ${totalPrice}</p>
          </div>
          <p style="color: #666; font-size: 13px;">
            You can track your order status in your account.
          </p>
        </div>
      </div>`;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: `Order Confirmed - ${orderNumber} - PFU2`,
        html,
      });
      this.logger.log(`Order confirmation email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send order confirmation email to ${email}`, err.stack);
    }
  }
}

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
    const smtpFrom = this.config.get('SMTP_FROM') || this.config.get('SMTP_USER');
    this.from = `PFU2 <${smtpFrom}>`;
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
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">PFU2</p>
        <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">Contact: 09678-114411 | Email: info@pfu2.com</p>
        <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">House 56, Road 01, Block A, Niketan, Gulshan - 01, Dhaka - 1212</p>
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
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">PFU2</p>
          <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">Contact: 09678-114411 | Email: info@pfu2.com</p>
          <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">House 56, Road 01, Block A, Niketan, Gulshan - 01, Dhaka - 1212</p>
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

  async sendPriceUpdatedEmail(
    email: string,
    customerName: string,
    cartId: string,
  ): Promise<void> {
    const cartUrl = `${this.clientUrl}/cart`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1f2937, #374151); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">PFU2</h1>
                    <p style="color: #9ca3af; margin: 5px 0 0 0; font-size: 13px;">Price Update Notification</p>
                  </td>
                </tr>
                <!-- Status Badge -->
                <tr>
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <div style="display: inline-block; background: #22c55e15; border: 2px solid #22c55e; border-radius: 50px; padding: 12px 30px;">
                      <span style="font-size: 20px; margin-right: 8px;">✓</span>
                      <span style="color: #22c55e; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Price Updated</span>
                    </div>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 25px 30px;">
                    <p style="color: #374151; font-size: 16px; margin: 0 0 10px 0;">Dear <strong>${customerName}</strong>,</p>
                    <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Great news! The prices for your requested items have been updated. You can now review the prices and place your order.</p>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin: 20px 0;">
                      <p style="margin: 0; color: #166534; font-size: 14px;">Your cart is ready for checkout. Please review the updated prices and complete your order.</p>
                    </div>
                  </td>
                </tr>
                <!-- CTA Button -->
                <tr>
                  <td style="padding: 0 30px 30px 30px; text-align: center;">
                    <a href="${cartUrl}" style="display: inline-block; background: #22c55e; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Go to Cart & Place Order</a>
                  </td>
                </tr>
                <!-- Divider -->
                <tr>
                  <td style="padding: 0 30px;">
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;">
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 30px; text-align: center;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0 0 5px 0;">If you have any questions, please contact our support team.</p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
                <!-- Contact Footer -->
                <tr>
                  <td style="padding: 0 30px 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 11px; margin: 15px 0 3px 0;">PFU2</p>
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

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: `Prices Updated - Ready to Order - PFU2`,
        html,
      });
      this.logger.log(`Price updated email sent to ${email} for cart ${cartId}`);
    } catch (err) {
      this.logger.error(`Failed to send price updated email to ${email}`, err.stack);
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.clientUrl}/auth/reset-password?token=${resetToken}`;
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
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">PFU2</p>
        <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">Contact: 09678-114411 | Email: info@pfu2.com</p>
        <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">House 56, Road 01, Block A, Niketan, Gulshan - 01, Dhaka - 1212</p>
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
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">PFU2</p>
        <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">Contact: 09678-114411 | Email: info@pfu2.com</p>
        <p style="color: #999; font-size: 11px; text-align: center; margin: 5px 0;">House 56, Road 01, Block A, Niketan, Gulshan - 01, Dhaka - 1212</p>
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

  async sendOrderStatusUpdateEmail(
    email: string,
    orderNumber: string,
    customerName: string,
    status: string,
    totalPrice?: number,
  ): Promise<void> {
    const statusConfig: Record<string, { color: string; icon: string; message: string; title: string }> = {
      Pending: { color: '#f59e0b', icon: '⏳', title: 'Order Received', message: 'Your order has been received and is being reviewed by our team.' },
      PENDING: { color: '#f59e0b', icon: '⏳', title: 'Order Received', message: 'Your order has been received and is being reviewed by our team.' },
      Confirmed: { color: '#3b82f6', icon: '✓', title: 'Order Confirmed', message: 'Your order has been confirmed and is being prepared.' },
      CONFIRMED: { color: '#3b82f6', icon: '✓', title: 'Order Confirmed', message: 'Your order has been confirmed and is being prepared.' },
      Processing: { color: '#8b5cf6', icon: '⚙', title: 'Order Processing', message: 'Your order is currently being processed.' },
      PROCESSING: { color: '#8b5cf6', icon: '⚙', title: 'Order Processing', message: 'Your order is currently being processed.' },
      Purchased: { color: '#10b981', icon: '🛒', title: 'Item Purchased', message: 'Your item has been purchased and is on its way to our warehouse.' },
      purchased: { color: '#10b981', icon: '🛒', title: 'Item Purchased', message: 'Your item has been purchased and is on its way to our warehouse.' },
      'Ready To Deliver': { color: '#6366f1', icon: '📦', title: 'Ready to Deliver', message: 'Your order is packed and ready for delivery.' },
      Shipped: { color: '#0ea5e9', icon: '🚚', title: 'Order Shipped', message: 'Great news! Your order has been shipped and is on its way to you.' },
      SHIPPED: { color: '#0ea5e9', icon: '🚚', title: 'Order Shipped', message: 'Great news! Your order has been shipped and is on its way to you.' },
      Delivered: { color: '#22c55e', icon: '🎉', title: 'Order Delivered', message: 'Your order has been delivered successfully. Thank you for shopping with us!' },
      FULL_DELIVERED: { color: '#22c55e', icon: '🎉', title: 'Order Delivered', message: 'Your order has been delivered successfully. Thank you for shopping with us!' },
      PARTIAL_DELIVERED: { color: '#22c55e', icon: '🎉', title: 'Partial Delivery', message: 'Part of your order has been delivered. The remaining items will arrive soon.' },
      Cancelled: { color: '#ef4444', icon: '✕', title: 'Order Cancelled', message: 'Your order has been cancelled. If you have any questions, please contact our support team.' },
      CANCELLED: { color: '#ef4444', icon: '✕', title: 'Order Cancelled', message: 'Your order has been cancelled. If you have any questions, please contact our support team.' },
      cancelled: { color: '#ef4444', icon: '✕', title: 'Order Cancelled', message: 'Your order has been cancelled. If you have any questions, please contact our support team.' },
      stockout: { color: '#ef4444', icon: '⚠', title: 'Item Out of Stock', message: 'Unfortunately, one or more items in your order are currently out of stock. Our team will contact you shortly.' },
    };

    const config = statusConfig[status] || { color: '#6b7280', icon: '📋', title: 'Order Updated', message: `Your order status has been updated to ${status}.` };
    const trackUrl = `${this.clientUrl}/my-orders`;
    const priceSection = totalPrice
      ? `<div style="background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin: 20px 0;">
           <p style="margin: 5px 0; font-size: 14px; color: #555;"><strong>Order Number:</strong> ${orderNumber}</p>
           <p style="margin: 5px 0; font-size: 14px; color: #555;"><strong>Total:</strong> Tk ${totalPrice.toLocaleString()}</p>
         </div>`
      : `<div style="background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin: 20px 0;">
           <p style="margin: 5px 0; font-size: 14px; color: #555;"><strong>Order Number:</strong> ${orderNumber}</p>
         </div>`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1f2937, #374151); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">PFU2</h1>
                    <p style="color: #9ca3af; margin: 5px 0 0 0; font-size: 13px;">Order Update Notification</p>
                  </td>
                </tr>
                <!-- Status Badge -->
                <tr>
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <div style="display: inline-block; background: ${config.color}15; border: 2px solid ${config.color}; border-radius: 50px; padding: 12px 30px;">
                      <span style="font-size: 20px; margin-right: 8px;">${config.icon}</span>
                      <span style="color: ${config.color}; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">${config.title}</span>
                    </div>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 25px 30px;">
                    <p style="color: #374151; font-size: 16px; margin: 0 0 10px 0;">Dear <strong>${customerName}</strong>,</p>
                    <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">${config.message}</p>
                    ${priceSection}
                    <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 5px 0;">You can track your order status anytime from your account dashboard.</p>
                  </td>
                </tr>
                <!-- CTA Button -->
                <tr>
                  <td style="padding: 0 30px 30px 30px; text-align: center;">
                    <a href="${trackUrl}" style="display: inline-block; background: ${config.color}; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Track My Order</a>
                  </td>
                </tr>
                <!-- Divider -->
                <tr>
                  <td style="padding: 0 30px;">
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;">
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 30px; text-align: center;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0 0 5px 0;">If you have any questions, please contact our support team.</p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
                <!-- Contact Footer -->
                <tr>
                  <td style="padding: 0 30px 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 11px; margin: 15px 0 3px 0;">PFU2</p>
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

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: `${config.title} - Order ${orderNumber} - PFU2`,
        html,
      });
      this.logger.log(`Order status update email sent to ${email} for order ${orderNumber}`);
    } catch (err) {
      this.logger.error(`Failed to send order status update email to ${email}`, err.stack);
    }
  }
}

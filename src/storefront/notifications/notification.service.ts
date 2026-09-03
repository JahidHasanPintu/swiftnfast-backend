import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../sms/sms.service';
import {
  NOTIFICATION_CONFIG,
  NotificationScenario,
  resolveScenario,
  getStatusLabel,
} from './notification.config';

export interface NotificationContext {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderNumber?: string;
  cartId?: string;
  status?: string;
  totalPrice?: number;
  [key: string]: any;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger('NotificationService');

  constructor(
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Send notification (email + SMS) for a given scenario.
   * Non-blocking: errors are logged but never thrown.
   */
  async notify(
    scenario: NotificationScenario,
    ctx: NotificationContext,
  ): Promise<void> {
    const config = NOTIFICATION_CONFIG[scenario];
    if (!config) {
      this.logger.warn(`No notification config for scenario: ${scenario}`);
      return;
    }

    const tasks: Promise<any>[] = [];

    // ─── Email ───────────────────────────────────────────────────────────
    if (config.email.enabled && ctx.customerEmail) {
      tasks.push(this.sendEmail(scenario, ctx));
    }

    // ─── SMS ─────────────────────────────────────────────────────────────
    if (config.sms.enabled && config.smsTemplate && ctx.customerPhone) {
      tasks.push(this.sendSms(config.smsTemplate, config.smsPurpose, ctx));
    }

    await Promise.allSettled(tasks);
  }

  /**
   * Convenience: send notification derived from an order status string.
   * Resolves the scenario automatically.
   */
  async notifyStatusChange(
    status: string,
    ctx: NotificationContext,
  ): Promise<void> {
    const scenario = resolveScenario(status);
    if (!scenario) {
      this.logger.debug(`No notification scenario for status: ${status}`);
      return;
    }
    return this.notify(scenario, ctx);
  }

  private async sendEmail(
    scenario: NotificationScenario,
    ctx: NotificationContext,
  ): Promise<void> {
    try {
      // Use the existing rich HTML email for order status updates
      if (ctx.orderNumber && ctx.customerName && ctx.status) {
        await this.mailService.sendOrderStatusUpdateEmail(
          ctx.customerEmail,
          ctx.orderNumber,
          ctx.customerName,
          ctx.status,
          ctx.totalPrice,
        );
        return;
      }

      // Price updated email
      if (scenario === 'PRICE_UPDATED' && ctx.cartId && ctx.customerName) {
        await this.mailService.sendPriceUpdatedEmail(
          ctx.customerEmail,
          ctx.customerName,
          ctx.cartId,
        );
        return;
      }

      // Order created / payment success email
      if (scenario === 'ORDER_CREATED' && ctx.orderNumber && ctx.customerEmail && ctx.totalPrice) {
        await this.mailService.sendOrderConfirmationEmail(
          ctx.customerEmail,
          ctx.orderNumber,
          String(ctx.totalPrice),
        );
        return;
      }
    } catch (err) {
      this.logger.error(
        `Email notification failed [${scenario}] to ${ctx.customerEmail}: ${err.message}`,
      );
    }
  }

  private async sendSms(
    template: string,
    purpose: string,
    ctx: NotificationContext,
  ): Promise<void> {
    try {
      const message = this.renderTemplate(template, ctx);
      const result = await this.smsService.sendSms(
        ctx.customerPhone,
        message,
        purpose,
      );
      if (!result.success) {
        this.logger.warn(
          `SMS delivery failed [${purpose}] to ${ctx.customerPhone}: code=${result.code}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `SMS notification failed [${purpose}] to ${ctx.customerPhone}: ${err.message}`,
      );
    }
  }

  /**
   * Render a template string by replacing {{key}} placeholders with context values.
   */
  private renderTemplate(
    template: string,
    ctx: NotificationContext,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const val = ctx[key];
      return val !== undefined && val !== null ? String(val) : '';
    });
  }
}

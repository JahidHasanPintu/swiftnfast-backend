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

export interface NotifyResult {
  email: 'sent' | 'failed' | 'skipped';
  sms: 'sent' | 'failed' | 'skipped';
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
   * Never throws; per-channel outcome is returned so callers (e.g. the cart
   * price queue) can persist an SMS status the admin can see and retry.
   */
  async notify(
    scenario: NotificationScenario,
    ctx: NotificationContext,
  ): Promise<NotifyResult> {
    const result: NotifyResult = { email: 'skipped', sms: 'skipped' };
    const config = NOTIFICATION_CONFIG[scenario];
    if (!config) {
      this.logger.warn(`No notification config for scenario: ${scenario}`);
      return result;
    }

    const tasks: Promise<{ channel: 'email' | 'sms'; ok: boolean }>[] = [];

    // ─── Email ───────────────────────────────────────────────────────────
    if (config.email.enabled && ctx.customerEmail) {
      tasks.push(
        this.sendEmail(scenario, ctx).then((ok) => ({ channel: 'email' as const, ok })),
      );
    }

    // ─── SMS ─────────────────────────────────────────────────────────────
    if (config.sms.enabled && config.smsTemplate && ctx.customerPhone) {
      tasks.push(
        this.sendSms(config.smsTemplate, config.smsPurpose, ctx).then((ok) => ({
          channel: 'sms' as const,
          ok,
        })),
      );
    }

    const settled = await Promise.allSettled(tasks);
    for (const s of settled) {
      if (s.status === 'rejected') continue;
      result[s.value.channel] = s.value.ok ? 'sent' : 'failed';
    }
    return result;
  }

  /**
   * Convenience: send notification derived from an order status string.
   * Resolves the scenario automatically.
   */
  async notifyStatusChange(
    status: string,
    ctx: NotificationContext,
  ): Promise<NotifyResult> {
    const scenario = resolveScenario(status);
    if (!scenario) {
      this.logger.debug(`No notification scenario for status: ${status}`);
      return { email: 'skipped', sms: 'skipped' };
    }
    return this.notify(scenario, ctx);
  }

  private async sendEmail(
    scenario: NotificationScenario,
    ctx: NotificationContext,
  ): Promise<boolean> {
    try {
      // Cart item Hold / Cancel / Reopen raised from the admin price queue.
      if (
        scenario === 'CART_ITEM_HOLD' ||
        scenario === 'CART_ITEM_CANCELLED' ||
        scenario === 'CART_ITEM_REOPENED'
      ) {
        if (!ctx.customerEmail) return false;
        await this.mailService.sendCartItemStatusEmail(
          ctx.customerEmail,
          ctx.customerName || 'Customer',
          ctx.productName || 'An item in your request',
          ctx.itemStatus || 'PENDING',
          { reason: ctx.reason, kind: ctx.kind },
        );
        return true;
      }

      // Use the existing rich HTML email for order status updates
      if (ctx.orderNumber && ctx.customerName && ctx.status) {
        await this.mailService.sendOrderStatusUpdateEmail(
          ctx.customerEmail,
          ctx.orderNumber,
          ctx.customerName,
          ctx.status,
          ctx.totalPrice,
        );
        return true;
      }

      // Price updated email
      if (scenario === 'PRICE_UPDATED' && ctx.cartId && ctx.customerName) {
        await this.mailService.sendPriceUpdatedEmail(
          ctx.customerEmail,
          ctx.customerName,
          ctx.cartId,
        );
        return true;
      }

      // Order created / payment success email
      if (scenario === 'ORDER_CREATED' && ctx.orderNumber && ctx.customerEmail && ctx.totalPrice) {
        await this.mailService.sendOrderConfirmationEmail(
          ctx.customerEmail,
          ctx.orderNumber,
          String(ctx.totalPrice),
        );
        return true;
      }
      return false;
    } catch (err) {
      this.logger.error(
        `Email notification failed [${scenario}] to ${ctx.customerEmail}: ${err.message}`,
      );
      return false;
    }
  }

  private async sendSms(
    template: string,
    purpose: string,
    ctx: NotificationContext,
  ): Promise<boolean> {
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
      return result.success;
    } catch (err) {
      this.logger.error(
        `SMS notification failed [${purpose}] to ${ctx.customerPhone}: ${err.message}`,
      );
      return false;
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

/**
 * Notification Configuration
 *
 * Each scenario defines whether email and/or SMS should be sent,
 * along with message templates. Edit this file to change notification
 * behavior without touching service code.
 */

export type NotificationScenario =
  | 'PRICE_UPDATED'
  | 'ORDER_CREATED'
  | 'STATUS_PENDING'
  | 'STATUS_CONFIRMED'
  | 'STATUS_PROCESSING'
  | 'STATUS_PURCHASED'
  | 'STATUS_READY_TO_DELIVER'
  | 'STATUS_SHIPPED'
  | 'STATUS_DELIVERED'
  | 'STATUS_CANCELLED'
  | 'STATUS_STOCKOUT'
  | 'STATUS_PARTIAL_DELIVERED'
  | 'STATUS_FULL_DELIVERED'
  | 'WEIGHT_CHARGED'
  | 'USWAREHOUSE'
  | 'BDOFFICE';

export interface NotificationChannel {
  enabled: boolean;
}

export interface NotificationEntry {
  email: NotificationChannel;
  sms: NotificationChannel;
  /** SMS message template. Use {{variable}} for interpolation. */
  smsTemplate?: string;
  /** Purpose tag for SMS logging */
  smsPurpose: string;
}

// ─── Status display names for SMS ──────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  Pending: 'Order Received',
  PENDING: 'Order Received',
  Confirmed: 'Order Confirmed',
  CONFIRMED: 'Order Confirmed',
  Processing: 'Order Processing',
  PROCESSING: 'Order Processing',
  Purchased: 'Item Purchased',
  purchased: 'Item Purchased',
  'Ready To Deliver': 'Ready to Deliver',
  Shipped: 'Order Shipped',
  SHIPPED: 'Order Shipped',
  Delivered: 'Order Delivered',
  FULL_DELIVERED: 'Order Delivered',
  PARTIAL_DELIVERED: 'Partial Delivery',
  Cancelled: 'Order Cancelled',
  CANCELLED: 'Order Cancelled',
  cancelled: 'Order Cancelled',
  stockout: 'Item Out of Stock',
  USWAREHOUSE: 'Reached US Warehouse',
  BDOFFICE: 'Reached Bangladesh Office',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

// ─── Notification Config ───────────────────────────────────────────────────

export const NOTIFICATION_CONFIG: Record<
  NotificationScenario,
  NotificationEntry
> = {
  // ─── Price Request ─────────────────────────────────────────────────────
  PRICE_UPDATED: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Your price request has been updated. Check your cart & email for details. - PFU2',
    smsPurpose: 'PRICE',
  },

  // ─── Order Lifecycle ───────────────────────────────────────────────────
  ORDER_CREATED: {
    email: { enabled: true },
    sms: { enabled: false },
    smsTemplate: '',
    smsPurpose: 'ORDER_STATUS',
  },

  STATUS_PENDING: {
    email: { enabled: true },
    sms: { enabled: false },
    smsTemplate: '',
    smsPurpose: 'ORDER_STATUS',
  },

  STATUS_CONFIRMED: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Your order #{{orderNumber}} has been confirmed. - PFU2',
    smsPurpose: 'ORDER_STATUS',
  },

  STATUS_PROCESSING: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Your order #{{orderNumber}} is now being processed. - PFU2',
    smsPurpose: 'ORDER_STATUS',
  },

  STATUS_PURCHASED: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Your item in order #{{orderNumber}} has been purchased and is on its way to our warehouse. - PFU2',
    smsPurpose: 'ORDER_STATUS',
  },

  STATUS_READY_TO_DELIVER: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Your order #{{orderNumber}} has reached our Bangladesh office and is ready for delivery. - PFU2',
    smsPurpose: 'ORDER_STATUS',
  },

  STATUS_SHIPPED: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Hi {{customerName}}, great news! Your order #{{orderNumber}} has been shipped and is on its way to you. - PFU2',
    smsPurpose: 'ORDER_STATUS',
  },

  STATUS_DELIVERED: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Your order #{{orderNumber}} has been delivered successfully. Thank you for shopping with PFU2!',
    smsPurpose: 'ORDER_STATUS',
  },

  STATUS_CANCELLED: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Your order #{{orderNumber}} has been cancelled. Please contact support if you have questions. - PFU2',
    smsPurpose: 'ORDER_STATUS',
  },

  STATUS_STOCKOUT: {
    email: { enabled: true },
    sms: { enabled: false },
    smsTemplate: '',
    smsPurpose: 'ORDER_STATUS',
  },

  STATUS_PARTIAL_DELIVERED: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Hi {{customerName}}, part of your order #{{orderNumber}} has been delivered. The remaining items will arrive soon. - PFU2',
    smsPurpose: 'ORDER_STATUS',
  },

  STATUS_FULL_DELIVERED: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Hi {{customerName}}, all items in your order #{{orderNumber}} have been delivered. Thank you for shopping with PFU2!',
    smsPurpose: 'ORDER_STATUS',
  },

  // ─── Shipment / Weight ─────────────────────────────────────────────────
  WEIGHT_CHARGED: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Hi {{customerName}}, weight charges for your order #{{orderNumber}} have been applied. Check your email for the detailed breakdown. - PFU2',
    smsPurpose: 'ORDER_STATUS',
  },

  USWAREHOUSE: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Your items for order #{{orderNumber}} have reached our US warehouse. - PFU2',
    smsPurpose: 'ORDER_STATUS',
  },

  BDOFFICE: {
    email: { enabled: true },
    sms: { enabled: true },
    smsTemplate:
      'Your items for order #{{orderNumber}} have reached our Bangladesh office. - PFU2',
    smsPurpose: 'ORDER_STATUS',
  },
};

/**
 * Resolve a notification scenario from an order status string.
 * Maps various status formats to the correct scenario key.
 */
export function resolveScenario(status: string): NotificationScenario | null {
  const map: Record<string, NotificationScenario> = {
    Pending: 'STATUS_PENDING',
    PENDING: 'STATUS_PENDING',
    Confirmed: 'STATUS_CONFIRMED',
    CONFIRMED: 'STATUS_CONFIRMED',
    Processing: 'STATUS_PROCESSING',
    PROCESSING: 'STATUS_PROCESSING',
    Purchased: 'STATUS_PURCHASED',
    purchased: 'STATUS_PURCHASED',
    'Ready To Deliver': 'STATUS_READY_TO_DELIVER',
    Shipped: 'STATUS_SHIPPED',
    SHIPPED: 'STATUS_SHIPPED',
    Delivered: 'STATUS_DELIVERED',
    FULL_DELIVERED: 'STATUS_FULL_DELIVERED',
    PARTIAL_DELIVERED: 'STATUS_PARTIAL_DELIVERED',
    Cancelled: 'STATUS_CANCELLED',
    CANCELLED: 'STATUS_CANCELLED',
    cancelled: 'STATUS_CANCELLED',
    stockout: 'STATUS_STOCKOUT',
    USWAREHOUSE: 'USWAREHOUSE',
    BDOFFICE: 'BDOFFICE',
  };
  return map[status] || null;
}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminNotificationDocument = HydratedDocument<AdminNotification>;

/**
 * In-app notification for the admin panel. Separate from the customer-facing
 * NotificationService (which sends email/SMS) - this is what powers the header
 * bell and the real-time toasts.
 */
@Schema({ timestamps: true, collection: 'admin_notifications' })
export class AdminNotification {
  @Prop({
    required: true,
    enum: ['price_request', 'order', 'prestock_order'],
    index: true,
  })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  message: string;

  @Prop({ required: true })
  referenceId: string;

  @Prop({ default: '' })
  link: string;

  @Prop({ default: false, index: true })
  isRead: boolean;
}

export const AdminNotificationSchema =
  SchemaFactory.createForClass(AdminNotification);

AdminNotificationSchema.index({ createdAt: -1 });

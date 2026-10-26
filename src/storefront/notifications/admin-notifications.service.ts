import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export type AdminNotificationType =
  | 'price_request'
  | 'order'
  | 'prestock_order';

export interface CreateAdminNotificationDto {
  type: AdminNotificationType;
  title: string;
  message?: string;
  referenceId: string;
  link?: string;
}

@Injectable()
export class AdminNotificationsService {
  constructor(
    @InjectModel('AdminNotification')
    private readonly model: Model<any>,
  ) {}

  create(dto: CreateAdminNotificationDto) {
    return this.model.create({
      type: dto.type,
      title: dto.title,
      message: dto.message || '',
      referenceId: dto.referenceId,
      link: dto.link || '',
      isRead: false,
    });
  }

  async getFeed(limit = 25) {
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const [notifications, unreadCount, grouped] = await Promise.all([
      this.model.find().sort({ createdAt: -1 }).limit(safeLimit).lean().exec(),
      this.model.countDocuments({ isRead: false }).exec(),
      this.model
        .aggregate([
          { $match: { isRead: false } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const byType = (type: AdminNotificationType) =>
      grouped.find((g: any) => g._id === type)?.count || 0;

    return {
      notifications,
      unreadCount,
      counts: {
        priceRequests: byType('price_request'),
        orders: byType('order'),
        prestockOrders: byType('prestock_order'),
      },
    };
  }

  markAllRead() {
    return this.model.updateMany({ isRead: false }, { $set: { isRead: true } });
  }

  markRead(id: string) {
    return this.model.updateOne({ _id: id }, { $set: { isRead: true } });
  }
}

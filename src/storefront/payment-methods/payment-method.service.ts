import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class PaymentMethodService {
  constructor(
    @InjectModel('PaymentMethod')
    private readonly model: Model<any>,
  ) {}

  private requireId(userId?: string) {
    if (!userId) throw new BadRequestException('User not found in token');
    return userId;
  }

  async getAll(userId: string | undefined) {
    const uid = this.requireId(userId);
    return this.model
      .find({ userId: uid })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean()
      .exec();
  }

  async create(userId: string | undefined, body: any) {
    const uid = this.requireId(userId);
    if (body.isDefault) {
      await this.model.updateMany({ userId: uid }, { $set: { isDefault: false } });
    }
    const doc = await this.model.create({ ...body, userId: uid });
    return { id: doc._id, ...body, userId: uid };
  }

  async update(userId: string | undefined, id: string, body: any) {
    const uid = this.requireId(userId);
    if (body.isDefault) {
      await this.model.updateMany(
        { userId: uid, _id: { $ne: id } },
        { $set: { isDefault: false } },
      );
    }
    const doc = await this.model
      .findOneAndUpdate({ _id: id, userId: uid }, { $set: body }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('Payment method not found');
    return doc;
  }

  async delete(userId: string | undefined, id: string) {
    const uid = this.requireId(userId);
    const result = await this.model.deleteOne({ _id: id, userId: uid }).exec();
    if (result.deletedCount === 0) throw new NotFoundException('Payment method not found');
  }
}

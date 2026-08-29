import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class AddressService {
  constructor(
    @InjectModel('Pfu2ShippingAddress')
    private readonly shippingModel: Model<any>,
    @InjectModel('Pfu2BillingAddress')
    private readonly billingModel: Model<any>,
  ) {}

  private requireId(userId?: string) {
    if (!userId) throw new BadRequestException('User not found in token');
    return userId;
  }

  async createShipping(
    userId: string | undefined,
    body: {
      name: string;
      email: string;
      phone: string;
      shippingAddress: string;
      district?: string;
      isDefault?: boolean;
    },
  ) {
    const uid = this.requireId(userId);
    // If new address is default, unset other defaults
    if (body.isDefault) {
      await this.shippingModel.updateMany(
        { userId: uid },
        { $set: { isDefault: false } },
      );
    }
    const address = await this.shippingModel.create({ ...body, userId: uid });
    return { id: address._id, ...body, userId: uid };
  }

  async getAllShipping(userId: string | undefined) {
    const uid = this.requireId(userId);
    const rows = await this.shippingModel
      .find({ userId: uid })
      .sort({ isDefault: -1, createdAt: -1 })
      .exec();
    return rows.map((r: any) => ({
      id: r._id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      shippingAddress: r.shippingAddress,
      district: r.district,
      isDefault: r.isDefault,
      userId: r.userId,
    }));
  }

  async updateShipping(userId: string | undefined, id: string, body: any) {
    const uid = this.requireId(userId);
    // If setting as default, unset other defaults
    if (body.isDefault) {
      await this.shippingModel.updateMany(
        { userId: uid, _id: { $ne: id } },
        { $set: { isDefault: false } },
      );
    }
    const address = await this.shippingModel
      .findOneAndUpdate({ _id: id, userId: uid }, { $set: body }, { new: true })
      .exec();
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async deleteShipping(userId: string | undefined, id: string) {
    const uid = this.requireId(userId);
    const result = await this.shippingModel
      .deleteOne({ _id: id, userId: uid })
      .exec();
    if (result.deletedCount === 0)
      throw new NotFoundException('Address not found');
  }

  async createBilling(
    userId: string | undefined,
    body: { name: string; email: string; phone: string },
  ) {
    const uid = this.requireId(userId);
    const address = await this.billingModel.create({ ...body, userId: uid });
    return { id: address._id, ...body, userId: uid };
  }

  async getAllBilling(userId: string | undefined) {
    const uid = this.requireId(userId);
    const rows = await this.billingModel
      .find({ userId: uid })
      .sort({ createdAt: -1 })
      .exec();
    return rows.map((r: any) => ({
      id: r._id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      userId: r.userId,
    }));
  }

  async updateBilling(userId: string | undefined, id: string, body: any) {
    const uid = this.requireId(userId);
    const address = await this.billingModel
      .findOneAndUpdate({ _id: id, userId: uid }, { $set: body }, { new: true })
      .exec();
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async deleteBilling(userId: string | undefined, id: string) {
    const uid = this.requireId(userId);
    const result = await this.billingModel
      .deleteOne({ _id: id, userId: uid })
      .exec();
    if (result.deletedCount === 0)
      throw new NotFoundException('Address not found');
  }
}

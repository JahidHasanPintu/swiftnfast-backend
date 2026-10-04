import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CouponType } from 'src/storefront/schemas/coupon.schema';

export interface ResolvedCoupon {
  coupon: any;
  /** Money taken off the order, never more than the subtotal. */
  discount: number;
  /** Subtotal before the discount. */
  subtotal: number;
  /** What is actually left to pay. 0 means the gateway is skipped entirely. */
  payable: number;
  isFreeOrder: boolean;
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel('Coupon') private readonly couponModel: Model<any>,
  ) {}

  // ---- Admin CRUD ---------------------------------------------------------

  async findAll(query: Record<string, any> = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.isActive === 'true' || query.isActive === 'false') {
      filter.isActive = query.isActive === 'true';
    }
    if (query.type) filter.type = query.type;
    if (query.search) {
      const safe = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.code = { $regex: safe, $options: 'i' };
    }

    const [coupons, total] = await Promise.all([
      this.couponModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.couponModel.countDocuments(filter).exec(),
    ]);

    return { coupons, total, page, limit };
  }

  async findOne(id: string) {
    const coupon = await this.couponModel.findById(id).lean().exec();
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async create(body: any) {
    const code = this.normaliseCode(body?.code);
    const value = this.parseNumber(body?.value, 'value');

    if (value <= 0) throw new BadRequestException('Value must be greater than 0');

    const type = this.parseType(body?.type);
    if (type === CouponType.PERCENTAGE && value > 100) {
      throw new BadRequestException(
        'A percentage coupon cannot be worth more than 100',
      );
    }

    const existing = await this.couponModel
      .findOne({ code })
      .lean()
      .exec();
    if (existing) throw new BadRequestException(`Coupon "${code}" already exists`);

    return this.couponModel.create({
      code,
      description: body?.description || '',
      type,
      value,
      maxDiscount: this.parseNumber(body?.maxDiscount, 'maxDiscount', 0),
      minOrderValue: this.parseNumber(body?.minOrderValue, 'minOrderValue', 0),
      expiryDate: this.parseDate(body?.expiryDate),
      maxUse: this.parseNumber(body?.maxUse, 'maxUse', 0),
      isActive: body?.isActive === undefined ? true : !!body.isActive,
    });
  }

  async update(id: string, body: any) {
    const coupon = await this.couponModel.findById(id).exec();
    if (!coupon) throw new NotFoundException('Coupon not found');

    if (body?.code !== undefined) coupon.code = this.normaliseCode(body.code);
    if (body?.description !== undefined) coupon.description = body.description;

    if (body?.type !== undefined) coupon.type = this.parseType(body.type);
    if (body?.value !== undefined) {
      coupon.value = this.parseNumber(body.value, 'value');
    }
    if (coupon.type === CouponType.PERCENTAGE && Number(coupon.value) > 100) {
      throw new BadRequestException(
        'A percentage coupon cannot be worth more than 100',
      );
    }
    if (body?.maxDiscount !== undefined) {
      coupon.maxDiscount = this.parseNumber(body.maxDiscount, 'maxDiscount', 0);
    }
    if (body?.minOrderValue !== undefined) {
      coupon.minOrderValue = this.parseNumber(body.minOrderValue, 'minOrderValue', 0);
    }
    if (body?.expiryDate !== undefined) {
      coupon.expiryDate = this.parseDate(body.expiryDate);
    }
    if (body?.maxUse !== undefined) {
      coupon.maxUse = this.parseNumber(body.maxUse, 'maxUse', 0);
    }
    if (body?.isActive !== undefined) coupon.isActive = !!body.isActive;

    await coupon.save();
    return coupon.toObject();
  }

  async remove(id: string) {
    const coupon = await this.couponModel.findByIdAndDelete(id).exec();
    if (!coupon) throw new NotFoundException('Coupon not found');
    return { success: true, message: 'Coupon deleted', data: coupon };
  }

  // ---- Customer-facing validation ----------------------------------------

  /**
   * Check a code against an order subtotal and work out what it is worth.
   * Pure validation - it does NOT record a use, so a customer can apply and
   * remove a code as many times as they like. `consume` is called only once an
   * order is actually placed.
   */
  async resolve(code: string, subtotal: number): Promise<ResolvedCoupon> {
    const normalised = this.normaliseCode(code);
    const amount = this.toNumber(subtotal);

    // `Model<any>` makes .lean() resolve to a union that includes the array
    // form; findOne can only ever yield a single document, so narrow it once.
    const coupon = (await this.couponModel
      .findOne({ code: normalised })
      .lean()
      .exec()) as any;
    if (!coupon) throw new NotFoundException('Invalid coupon code');

    if (!coupon.isActive) {
      throw new BadRequestException('This coupon is no longer active');
    }

    if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < Date.now()) {
      throw new BadRequestException('This coupon has expired');
    }

    const maxUse = Number(coupon.maxUse) || 0;
    if (maxUse > 0 && Number(coupon.usedCount) >= maxUse) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    const minOrder = Number(coupon.minOrderValue) || 0;
    if (amount < minOrder) {
      throw new BadRequestException(
        `This coupon needs a minimum order of ৳${minOrder.toFixed(2)}`,
      );
    }

    const discount = this.discountFor(coupon, amount);
    const payable = Math.max(0, this.round2(amount - discount));

    return {
      coupon,
      discount,
      subtotal: this.round2(amount),
      payable,
      isFreeOrder: payable <= 0,
    };
  }

  /**
   * Record one use of a coupon.
   *
   * The `maxUse` guard is evaluated by MongoDB inside the same update as the
   * increment ($expr compares two fields of the matched document), so two
   * customers checking out at the same instant cannot both take the last use.
   */
  async consume(code: string): Promise<void> {
    const normalised = this.normaliseCode(code);
    // findOneAndUpdate resolves to a union type that includes the array form of
    // findOneAndUpdate; the update filter can never match an array, so the shape
    // is narrowed here rather than at every use site.
    const updated = (await this.couponModel
      .findOneAndUpdate(
        {
          code: normalised,
          isActive: true,
          $expr: {
            $or: [
              { $eq: ['$maxUse', 0] }, // 0 = unlimited
              { $lt: ['$usedCount', '$maxUse'] },
            ],
          },
        },
        { $inc: { usedCount: 1 } },
        { new: true },
      )
      .lean()) as any;

    if (!updated) {
      throw new BadRequestException(
        'This coupon is no longer available',
      );
    }
  }

  /**
   * Give one use back to a coupon.
   *
   * Used to undo a `consume()` when the order could not be created afterwards,
   * so a failed checkout never burns a use. The floor of 0 keeps a coupon that
   * was edited or deleted from going negative, and `$gt` keeps a use from being
   * released twice for the same attempt.
   */
  async release(code: string): Promise<void> {
    if (!code) return;
    const normalised = this.normaliseCode(code);
    await this.couponModel.updateOne(
      { code: normalised, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
    );
  }

  // ---- Helpers ------------------------------------------------------------

  /** Money a coupon takes off a given subtotal. Never exceeds the subtotal. */
  private discountFor(coupon: any, subtotal: number): number {
    const value = Number(coupon.value) || 0;
    let discount: number;

    if (coupon.type === CouponType.FLAT) {
      discount = value;
    } else {
      discount = (subtotal * value) / 100;
      const cap = Number(coupon.maxDiscount) || 0;
      if (cap > 0) discount = Math.min(discount, cap);
    }

    // A coupon can never push the payable amount below zero.
    return this.round2(Math.min(discount, Math.max(0, subtotal)));
  }

  private normaliseCode(code: any): string {
    const value = String(code ?? '').trim().toUpperCase();
    if (!value) throw new BadRequestException('Coupon code is required');
    if (!/^[A-Z0-9_-]{3,32}$/.test(value)) {
      throw new BadRequestException(
        'Coupon code must be 3-32 characters (letters, numbers, - and _)',
      );
    }
    return value;
  }

  private parseType(type: any): CouponType {
    const value = String(type ?? '').toLowerCase();
    if (value === CouponType.FLAT || value === CouponType.PERCENTAGE) {
      return value as CouponType;
    }
    throw new BadRequestException('Coupon type must be "flat" or "percentage"');
  }

  private parseNumber(value: any, field: string, fallback?: number): number {
    if (value === undefined || value === null || value === '') {
      if (fallback !== undefined) return fallback;
      throw new BadRequestException(`${field} is required`);
    }
    const n = Number(value);
    if (Number.isNaN(n) || n < 0) {
      throw new BadRequestException(`${field} must be zero or greater`);
    }
    return n;
  }

  private parseDate(value: any): Date | null {
    if (value === undefined || value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('expiryDate is not a valid date');
    }
    return date;
  }

  private toNumber(value: any): number {
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }

  private round2(n: number): number {
    return Number((Math.round(n * 100) / 100).toFixed(2));
  }
}
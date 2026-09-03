import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CartService } from '../cart/cart.service';
import { EventsGateway } from '../../common/gateways/events.gateway';
import { NotificationService } from '../notifications/notification.service';

function toNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class PreStockOrdersService {
  private readonly logger = new Logger(PreStockOrdersService.name);

  constructor(
    @InjectModel('PreStockOrder') private readonly orderModel: Model<any>,
    @InjectModel('Payments') private readonly paymentModel: Model<any>,
    @InjectModel('Login') private readonly usersModel: Model<any>,
    private readonly cartService: CartService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationService: NotificationService,
  ) {}

  generateOrderNumber(): string {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PS-${d}${m}${y}${rand}`;
  }

  async createOrder(body: {
    userId?: string;
    guestEmail?: string;
    guestContact?: string;
    isGuest?: boolean;
    cartId: string;
    shipping?: any;
    billing?: any;
    paymentMethod?: string;
    advancePaymentData?: {
      trxID?: string;
      amount?: number;
      paymentID?: string;
    };
  }) {
    const cart = await this.cartService.getRawCart(body.cartId);
    const rawItems = (cart.items as any[]) || [];

    if (rawItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const orderNumber = this.generateOrderNumber();

    const shipping = body.shipping || cart.shippingAddress || {};
    const shippingName = shipping.name;
    const shippingPhone = shipping.phone || body.guestContact || cart.guestContact;
    const shippingEmail = shipping.email || body.guestEmail;

    // Build items array
    const items = rawItems.map((item: any, i: number) => {
      const qty = toNumber(item.quantity) || 1;
      const uni = toNumber(item.price);
      const total = item.finalPrice != null ? toNumber(item.finalPrice) : uni * qty;

      return {
        productId: item.productId || undefined,
        prodDesc: item.name || `Product ${i + 1}`,
        quantity: qty,
        uniPrice: uni,
        totalPrice: total,
        advancePayment: 0,
        remainingAmount: total,
        color: item.color,
        size: item.size,
        status: 'PENDING',
        productImageUrl: item.ssImageUrl || undefined,
        productSourcedFrom: item.productSourcedFrom,
        orderNotes: item.notes,
      };
    });

    const grandTotal = toNumber(cart.totalPrice);
    const advanceAmount = body.advancePaymentData?.amount || 0;

    // Distribute advance payment across items
    if (advanceAmount > 0) {
      const paidPerItem = advanceAmount / items.length;
      for (const item of items) {
        item.advancePayment = Number(paidPerItem.toFixed(2));
        item.remainingAmount = Number((item.totalPrice - item.advancePayment).toFixed(2));
      }
    }

    const paymentMethod = (body.paymentMethod || 'bkash').toLowerCase();

    // Build MFS payment data
    const mfsPayment = body.advancePaymentData?.trxID
      ? {
          selectedMFS: paymentMethod,
          mfsTrxId: body.advancePaymentData.trxID,
          mfsAmount: advanceAmount,
        }
      : undefined;

    const order = await this.orderModel.create({
      orderNumber,
      userId: body.userId || undefined,
      isGuest: body.isGuest === true || !body.userId,
      guestEmail: shippingEmail,
      guestContact: body.guestContact || shippingPhone,
      customerName: shippingName,
      contactNumber: shippingPhone,
      emailAddress: shippingEmail,
      items,
      itemPrice: toNumber(cart.itemPrice),
      tax: toNumber(cart.tax),
      pfu2Charge: toNumber(cart.pfu2Charge),
      discount: toNumber(cart.discount),
      grandTotal,
      shippingAddress: shipping,
      billingAddress: body.billing || cart.billingAddress || {},
      paymentMethod,
      advancePayment: advanceAmount,
      remainingAmount: Number((grandTotal - advanceAmount).toFixed(2)),
      mfsPayment,
      status: 'PENDING',
      paymentStatus: advanceAmount > 0 ? 'paid' : 'pending',
    });

    // Also create Payments collection record for admin UI compatibility
    await this.paymentModel.create({
      orderId: orderNumber,
      method: paymentMethod,
      phoneNumber: shippingPhone || '',
      transactionStatus: body.advancePaymentData?.trxID ? 'Completed' : 'pending',
      statusMessage: body.advancePaymentData?.trxID ? 'Paid via bKash' : 'Awaiting payment confirmation',
      amount: String(grandTotal),
      paymentStatus: advanceAmount > 0 ? 'paid' : 'pending',
      paymentSource: 'prestock',
      cashPayment: 0,
      mfsPayment: mfsPayment || undefined,
      bankPayment: null,
    });

    await this.cartService.deleteById(body.cartId);

    this.eventsGateway.notifyNewPreStockOrder({
      orderNumber,
      customerName: shippingName,
    });

    return order.toObject();
  }

  // ---- Admin queries ----

  async findAll(query: Record<string, any> = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.search) {
      const rx = new RegExp(
        String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      filter.$or = [{ orderNumber: rx }, { customerName: rx }, { contactNumber: rx }];
    }

    const sort: any = { createdAt: -1 };
    if (query.sort) {
      const [field, direction] = String(query.sort).split(':');
      if (field) sort[field] = (direction || 'DESC').toUpperCase() === 'ASC' ? 1 : -1;
    }

    const [docs, total] = await Promise.all([
      this.orderModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return { orders: docs, total, page, limit };
  }

  async findOne(id: string) {
    const doc = await this.orderModel.findById(id).lean().exec();
    if (!doc) throw new NotFoundException('Pre-stock order not found');
    return doc;
  }

  async findByOrderNumber(orderNumber: string) {
    const doc = await this.orderModel.findOne({ orderNumber }).lean().exec();
    if (!doc) throw new NotFoundException(`Order ${orderNumber} not found`);
    return doc;
  }

  async updateStatus(id: string, status: string) {
    if (!status) throw new BadRequestException('status is required');
    const doc = await this.orderModel
      .findByIdAndUpdate(id, { $set: { status } }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('Order not found');

    const obj = doc.toObject();

    // Send notification
    if (obj.guestEmail || obj.contactNumber) {
      this.notificationService.notifyStatusChange(status, {
        customerName: obj.customerName,
        customerEmail: obj.guestEmail,
        customerPhone: obj.contactNumber,
        orderNumber: obj.orderNumber,
        status,
        totalPrice: obj.grandTotal,
      }).catch((err: any) => this.logger.error(`Notification failed: ${err.message}`));
    }

    return obj;
  }

  async updateItemStatus(orderId: string, productId: string, status: string) {
    if (!status) throw new BadRequestException('status is required');
    const doc = await this.orderModel.findById(orderId).exec();
    if (!doc) throw new NotFoundException('Order not found');

    // Find the item by _id or productId
    const item = doc.items.id(productId) ||
      doc.items.find((i: any) => String(i.productId) === String(productId));
    if (!item) throw new NotFoundException('Item not found in order');

    item.status = status;
    await doc.save();

    return doc.toObject();
  }

  async uploadProductImage(orderId: string, productId: string, imageUrl: string) {
    if (!imageUrl) throw new BadRequestException('No image URL provided');
    const doc = await this.orderModel.findById(orderId).exec();
    if (!doc) throw new NotFoundException('Order not found');

    const item = doc.items.id(productId) ||
      doc.items.find((i: any) => String(i.productId) === String(productId));
    if (!item) throw new NotFoundException('Item not found in order');

    item.productImageUrl = imageUrl;
    await doc.save();

    return doc.toObject();
  }

  async deleteOrder(id: string) {
    const doc = await this.orderModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Order not found');
    return { success: true, message: 'Order deleted successfully' };
  }

  async cancelOrder(id: string) {
    const doc = await this.orderModel
      .findByIdAndUpdate(id, { $set: { status: 'CANCELLED' } }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('Order not found');
    return doc.toObject();
  }

  async getPendingCount(): Promise<number> {
    return this.orderModel
      .countDocuments({ status: 'PENDING' })
      .exec();
  }
}

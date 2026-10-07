import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CartService } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { EventsGateway } from '../../common/gateways/events.gateway';
import { NotificationService } from '../notifications/notification.service';
import { SettingsService } from '../settings/settings.service';
import { resolveRate, shippingBdt, unitBdt } from '../utils/pricing.util';
import { generateImageUrl } from '../utils/image-url.util';

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
    // The basket only stores a product id, so the catalogue is the only place
    // the name, picture and brand of a ready-stock line can come from.
    @InjectModel('Product') private readonly productModel: Model<any>,
    @InjectModel('Category') private readonly categoryModel: Model<any>,
    @InjectModel('Coupon') private readonly couponModel: Model<any>,
    private readonly cartService: CartService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationService: NotificationService,
    private readonly settingsService: SettingsService,
    private readonly couponsService: CouponsService,
  ) {}

  private async getExchangeRate(source: string): Promise<number> {
    return resolveRate(source, (key) => this.settingsService.getByKey(key));
  }

  generateOrderNumber(): string {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PS-${d}${m}${y}${rand}`;
  }

  /**
   * A ready-stock basket line stores nothing but a product id, so the name,
   * pictures, brand and category the admin has to see are looked up here and
   * frozen onto the order at checkout. `describe` maps one raw basket line to
   * its catalogue snapshot; a missing/deleted product simply falls back to the
   * basket's own name.
   */
  private async buildProductDescriber(rawItems: any[]) {
    const ids = [
      ...new Set(
        rawItems
          .filter((i: any) => i && i.type !== 'outside_order' && i.productId)
          .map((i: any) => String(i.productId)),
      ),
    ];

    let products: any[] = [];
    if (ids.length) {
      try {
        products = await this.productModel
          .find({ _id: { $in: ids } })
          .lean()
          .exec();
      } catch (err: any) {
        this.logger.warn(`Catalogue lookup failed: ${err.message}`);
      }
    }

    const categoryIds = [
      ...new Set(
        products
          .map((p: any) => (p?.categoryId ? String(p.categoryId) : ''))
          .filter(Boolean),
      ),
    ];
    const categories: any[] = categoryIds.length
      ? await this.categoryModel
          .find({ _id: { $in: categoryIds } })
          .lean()
          .exec()
      : [];
    const categoryById = new Map(
      categories.map((c: any) => [String(c._id), c]),
    );
    const productById = new Map(products.map((p: any) => [String(p._id), p]));

    return (item: any, index: number) => {
      const product = item?.productId
        ? productById.get(String(item.productId)) || null
        : null;
      const images: string[] = Array.isArray(product?.images)
        ? (product.images as string[]).map((i: string) =>
            generateImageUrl('products', i),
          )
        : [];
      const categoryId = product?.categoryId
        ? String(product.categoryId)
        : '';
      const categoryName = categoryId
        ? categoryById.get(categoryId)?.name || ''
        : '';

      return {
        brand: product?.brand || undefined,
        productSlug: product?.slug || undefined,
        productImages: images,
        productShortDescription:
          product?.shortDescription || product?.description || undefined,
        cataloguePrice:
          product?.price != null ? Number(product.price) : undefined,
        categoryName: categoryName || undefined,
        prodDesc: product?.name || item?.name || `Product ${index + 1}`,
        color: item?.color || product?.color || undefined,
        size: item?.size || product?.size || undefined,
        productImageUrl:
          item?.ssImageUrl || images[0] || undefined,
      };
    };
  }

  /** Frozen copy of the voucher that was on the basket, for reporting. */
  private async buildCouponSnapshot(code?: string, discount?: number) {
    if (!code) return undefined;
    let doc: any = null;
    try {
      doc = await this.couponModel
        .findOne({ code: String(code).toUpperCase() })
        .lean()
        .exec();
    } catch (err: any) {
      this.logger.warn(`Coupon snapshot failed: ${err.message}`);
    }
    return {
      code: String(code).toUpperCase(),
      type: doc?.type || '',
      value: toNumber(doc?.value),
      maxDiscount: toNumber(doc?.maxDiscount),
      description: doc?.description || '',
      discount: toNumber(discount),
    };
  }

  /**
   * Orders written before these snapshots existed arrive with nothing but a
   * product id, no gateway detail and only a bare coupon code. They are
   * re-read on the way out so historical orders still show real product,
   * payment and voucher information, without rewriting history.
   */
  private async backfillOrderInfo(docs: any[]) {
    if (!docs.length) return docs;
    await Promise.all([
      this.backfillProductInfo(docs),
      this.backfillPaymentInfo(docs),
      this.backfillCouponInfo(docs),
    ]);
    return docs;
  }

  /** Pull the gateway detail that used to live only in the `Payments` table. */
  private async backfillPaymentInfo(docs: any[]) {
    const pending = docs.filter((d) => !d.paymentDetails && d.orderNumber);
    if (!pending.length) return;

    let rows: any[] = [];
    try {
      rows = await this.paymentModel
        .find({ orderId: { $in: pending.map((d) => d.orderNumber) } })
        .lean()
        .exec();
    } catch (err: any) {
      this.logger.warn(`Payment lookup failed: ${err.message}`);
      return;
    }
    const byOrder = new Map(rows.map((r) => [String(r.orderId), r]));

    for (const doc of pending) {
      const row = byOrder.get(String(doc.orderNumber));
      if (!row) continue;
      doc.paymentDetails = {
        gateway: row.method || doc.paymentMethod || '',
        transactionId: row.transactionId || row.mfsPayment?.mfsTrxId || '',
        paymentId: row.mfsPayment?.paymentId || '',
        phoneNumber: row.phoneNumber || '',
        amount: Number(doc.advancePayment) || 0,
        transactionStatus: row.transactionStatus || '',
        statusMessage: row.statusMessage || '',
      };
      if (!doc.mfsPayment && row.mfsPayment) doc.mfsPayment = row.mfsPayment;
    }
  }

  /** Rebuild the voucher snapshot for orders that only kept the code. */
  private async backfillCouponInfo(docs: any[]) {
    const pending = docs.filter((d) => !d.coupon && d.couponCode);
    if (!pending.length) return;

    const codes = [
      ...new Set(pending.map((d) => String(d.couponCode).toUpperCase())),
    ];
    let rows: any[] = [];
    try {
      rows = await this.couponModel
        .find({ code: { $in: codes } })
        .lean()
        .exec();
    } catch (err: any) {
      this.logger.warn(`Coupon lookup failed: ${err.message}`);
    }
    const byCode = new Map(
      rows.map((r: any) => [String(r.code).toUpperCase(), r]),
    );

    for (const doc of pending) {
      const code = String(doc.couponCode).toUpperCase();
      const row: any = byCode.get(code);
      doc.coupon = {
        code,
        type: row?.type || '',
        value: toNumber(row?.value),
        maxDiscount: toNumber(row?.maxDiscount),
        description: row?.description || '',
        discount: toNumber(doc.discount),
      };
    }
  }

  private async backfillProductInfo(docs: any[]) {
    const pending: any[] = [];
    for (const doc of docs) {
      for (const item of doc.items || []) {
        if (item?.productId && !item.productSlug) pending.push(item);
      }
    }
    if (!pending.length) return;

    const ids = [...new Set(pending.map((i) => String(i.productId)))];
    let products: any[] = [];
    try {
      products = await this.productModel
        .find({ _id: { $in: ids } })
        .lean()
        .exec();
    } catch (err: any) {
      this.logger.warn(`Catalogue lookup failed: ${err.message}`);
      return;
    }
    const byId = new Map(products.map((p: any) => [String(p._id), p]));

    for (const item of pending) {
      const p: any = byId.get(String(item.productId));
      if (!p) continue;
      const images: string[] = Array.isArray(p.images)
        ? (p.images as string[]).map((s: string) =>
            generateImageUrl('products', s),
          )
        : [];
      if (!item.prodDesc || /^Product\s+\d+$/.test(String(item.prodDesc))) {
        item.prodDesc = p.name;
      }
      item.brand = p.brand;
      item.productSlug = p.slug;
      item.productImages = images;
      item.productShortDescription = p.shortDescription || p.description;
      item.cataloguePrice = p.price;
      if (!item.productImageUrl) item.productImageUrl = images[0];
      if (item.color === undefined) item.color = p.color;
      if (item.size === undefined) item.size = p.size;
    }
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

    // Build items array. Outside orders are converted to BDT (USA taxed,
    // UK untaxed) and shipping is converted but never taxed; pre-stock items
    // are already BDT. finalPrice is a PER-UNIT override set by an admin.
    const describe = await this.buildProductDescriber(rawItems);
    const ratesCache: Record<string, number> = {};
    let grandTotal = 0;
    const items: any[] = [];
    for (let i = 0; i < rawItems.length; i++) {
      const item: any = rawItems[i];
      const qty = toNumber(item.quantity) || 1;
      const uni = toNumber(item.price);
      const source = String(item.productSourcedFrom || '');

      if (!(source in ratesCache)) {
        ratesCache[source] = await this.getExchangeRate(source);
      }
      const rate = ratesCache[source];

      // Shipping is a flat per-line charge: added once, not multiplied by qty.
      const total = Number(
        (unitBdt(item, rate) * qty + shippingBdt(item, rate)).toFixed(2),
      );
      grandTotal += total;

      items.push({
        ...describe(item, i),
        productId: item.productId || undefined,
        quantity: qty,
        uniPrice: uni,
        totalPrice: total,
        advancePayment: 0,
        remainingAmount: total,
        status: 'PENDING',
        productSourcedFrom: item.productSourcedFrom,
        orderNotes: item.notes,
        couponCode: cart.couponCode || item.promoCode,
      });
    }

    grandTotal = Number(grandTotal.toFixed(2));

    // The coupon was validated and stored on the basket when it was applied.
    // Deduct it here and work out what is actually collectable.
    const discount = Math.min(
      toNumber(cart.discount),
      grandTotal,
    );
    const payableTotal = Number(Math.max(0, grandTotal - discount).toFixed(2));
    // A coupon that covers the whole amount means there is nothing to charge,
    // so the order is recorded as paid without ever touching the gateway.
    const isFreeOrder = payableTotal <= 0;

    // Never trust an advance payment larger than what is actually owed.
    const advanceAmount = isFreeOrder
      ? 0
      : Number(
          Math.min(
            Number(body.advancePaymentData?.amount) || 0,
            payableTotal,
          ).toFixed(2),
        );

    // Distribute advance payment across items
    if (advanceAmount > 0) {
      const paidPerItem = advanceAmount / items.length;
      for (const item of items) {
        item.advancePayment = Number(paidPerItem.toFixed(2));
        item.remainingAmount = Number((item.totalPrice - item.advancePayment).toFixed(2));
      }
    }

    // Nothing is left to collect once the coupon has covered the order.
    if (isFreeOrder) {
      for (const item of items) {
        item.advancePayment = 0;
        item.remainingAmount = 0;
      }
    }

    const paymentMethod = isFreeOrder
      ? 'coupon'
      : (body.paymentMethod || 'bkash').toLowerCase();

    const adv = body.advancePaymentData;

    // Build MFS payment data
    const mfsPayment = adv?.trxID
      ? {
          selectedMFS: paymentMethod,
          mfsTrxId: adv.trxID,
          mfsAmount: advanceAmount,
          paymentId: adv.paymentID || undefined,
        }
      : undefined;

    // Everything the gateway reported, kept on the order itself so the admin
    // never has to reconstruct a payment from three different collections.
    const transactionStatus = isFreeOrder
      ? 'Completed'
      : adv?.trxID
        ? 'Completed'
        : 'pending';
    const statusMessage = isFreeOrder
      ? 'Paid in full by coupon - no payment required'
      : adv?.trxID
        ? 'Paid via online payment'
        : 'Awaiting payment confirmation';
    const paymentDetails = {
      gateway: paymentMethod,
      transactionId: adv?.trxID || '',
      paymentId: adv?.paymentID || '',
      phoneNumber: shippingPhone || '',
      amount: isFreeOrder ? 0 : Number(advanceAmount.toFixed(2)),
      transactionStatus,
      statusMessage,
      paidAt: adv?.trxID || isFreeOrder ? new Date() : undefined,
    };

    // The voucher definition is frozen next to the discount so the order still
    // explains itself after the coupon is edited or deleted.
    const couponSnapshot = await this.buildCouponSnapshot(
      cart.couponCode,
      discount,
    );

    // paid when nothing is owed, or when the advance covers the whole payable
    // amount; partial when money is still outstanding.
    const paymentStatus = isFreeOrder
      ? 'paid'
      : advanceAmount >= payableTotal && payableTotal > 0
        ? 'paid'
        : advanceAmount > 0
          ? 'partial'
          : 'pending';

    // Take the use BEFORE writing the order. The increment and the maxUse guard
    // happen in one atomic update, so two customers racing for the last use
    // cannot both win. If anything below then fails the use is handed back and
    // no orphan order is left behind.
    if (cart.couponCode) {
      await this.couponsService.consume(cart.couponCode);
    }

    let order: any;
    try {
      order = await this.orderModel.create({
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
        discount,
        couponCode: cart.couponCode,
        coupon: couponSnapshot,
        grandTotal,
        shippingAddress: shipping,
        billingAddress: body.billing || cart.billingAddress || {},
        paymentMethod,
        paymentDetails,
        advancePayment: advanceAmount,
        remainingAmount: Number((payableTotal - advanceAmount).toFixed(2)),
        mfsPayment,
        status: 'PENDING',
        paymentStatus,
      });

      // Also create Payments collection record for admin UI compatibility
      await this.paymentModel.create({
        orderId: orderNumber,
        method: paymentMethod,
        phoneNumber: shippingPhone || '',
        transactionId: adv?.trxID || '',
        transactionStatus,
        statusMessage,
        amount: String(payableTotal),
        paymentStatus,
        paymentSource: 'prestock',
        cashPayment: 0,
        mfsPayment: mfsPayment || undefined,
        bankPayment: null,
      });
    } catch (err) {
      // The order never came into existence, so the coupon use is given back.
      if (cart.couponCode) {
        await this.couponsService.release(cart.couponCode);
      }
      throw err;
    }

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
      filter.$or = [
        { orderNumber: rx },
        { customerName: rx },
        { contactNumber: rx },
        { 'items.prodDesc': rx },
        { couponCode: rx },
      ];
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

    await this.backfillOrderInfo(docs);

    return { orders: docs, total, page, limit };
  }

  async findOne(id: string) {
    const doc = await this.orderModel.findById(id).lean().exec();
    if (!doc) throw new NotFoundException('Pre-stock order not found');
    return this.backfillOrderInfo([doc]).then(() => doc);
  }

  async findByOrderNumber(orderNumber: string) {
    const doc = await this.orderModel.findOne({ orderNumber }).lean().exec();
    if (!doc) throw new NotFoundException(`Order ${orderNumber} not found`);
    return this.backfillOrderInfo([doc]).then(() => doc);
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

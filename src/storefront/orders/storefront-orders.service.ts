import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { OrderService } from 'src/order/order.service';
import { CartService } from '../cart/cart.service';
import { generateImageUrl } from '../utils/image-url.util';

const WEIGHT_CHARGES: Record<string, number> = { USA: 500, UK: 400, UAE: 300 };
const EXCHANGE_RATES: Record<string, number> = { USA: 140, UK: 140, UAE: 30 };
const OUTSIDE_TO_IMPORT: Record<string, string> = {
  DRAFT: 'Pending',
  SUBMITTED: 'Pending',
  PROCESSING: 'Pending',
  ORDERED: 'Purchased',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

function toNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class StorefrontOrdersService {
  constructor(
    @InjectModel('Orders') private readonly orderModel: Model<any>,
    @InjectModel('Product') private readonly productModel: Model<any>,
    @InjectModel('Pfu2User') private readonly userModel: Model<any>,
    @InjectModel('Pfu2Payment') private readonly paymentModel: Model<any>,
    private readonly orderService: OrderService,
    private readonly cartService: CartService,
  ) {}

  // -------------------------------------------------------------------------
  // Pre-stock checkout: cart -> unified order line items (orderType:'prestock')
  // -------------------------------------------------------------------------
  async createPreStockOrder(body: {
    userId?: string;
    guestEmail?: string;
    guestContact?: string;
    isGuest?: boolean;
    cartId: string;
    shipping?: any;
    billing?: any;
    paymentMethod?: string;
  }) {
    const cart = await this.cartService.getRawCart(body.cartId);
    const rawItems = (cart.items as any[]) || [];

    const orderNumber = this.orderService.generateStorefrontOrderNumber();

    const shipping = body.shipping || cart.shippingAddress || {};
    const shippingName = shipping.name;
    const shippingPhone = shipping.phone || body.guestContact || cart.guestContact;
    const shippingEmail = shipping.email || body.guestEmail;
    const shippingAddressText = shipping.shippingAddress || shipping.address;

    const customer = await this.orderService.findOrCreateCustomerByContact(
      shippingPhone || `GUEST-${Date.now()}`,
      {
        name: shippingName,
        email: shippingEmail,
        shippingAddress: shippingAddressText,
        sourceOfOrder: 'prestock-storefront',
      },
    );

    const userId = body.userId ? new mongoose.Types.ObjectId(body.userId) : undefined;

    const lineItems = [];
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const type = item.type || 'product';
      const qty = toNumber(item.quantity) || 1;
      const uni = toNumber(item.price);

      let productId;
      let prodDesc = item.name;
      let productSourcedFrom;
      let color = item.color;
      let size = item.size;
      if (type === 'product' && item.productId) {
        try {
          productId = new mongoose.Types.ObjectId(String(item.productId));
          const product: any = await this.productModel.findById(item.productId).lean().exec();
          if (product) prodDesc = product.name;
        } catch {
          productId = undefined;
        }
      } else {
        productSourcedFrom = item.productSourcedFrom;
        prodDesc = item.name || `${item.productSourcedFrom || 'Imported'} sourced product`;
      }

      lineItems.push({
        orderId: orderNumber,
        orderNumber,
        orderType: 'prestock',
        customerId: customer._id,
        customerName: customer.customerName || shippingName,
        contactNo: shippingPhone,
        orderDate: new Date(),
        createdBy: 'pfu2-storefront',
        orderItemIndex: i + 1,
        productId,
        productUrl: item.productUrl,
        prodDesc,
        productSourcedFrom,
        quantity: qty,
        color,
        size,
        uniPrice: uni,
        totalPrice: item.finalPrice != null ? toNumber(item.finalPrice) : uni * qty,
        advancePayment: undefined,
        remainingAmount: undefined,
        orderNotes: item.notes,
        origin: productSourcedFrom || 'Bangladesh',
        ssImageUrl: item.ssImageUrl,
        status: 'PENDING',
        userId,
        isGuest: body.isGuest === true || !userId,
        guestEmail: body.guestEmail || shippingEmail,
        guestContact: body.guestContact || shippingPhone,
        isPurchased: false,
        itemPrice: toNumber(cart.itemPrice),
        tax: toNumber(cart.tax),
        pfu2Charge: toNumber(cart.pfu2Charge),
        discount: toNumber(cart.discount),
        grandTotal: toNumber(cart.totalPrice),
        shippingAddress: shipping,
        billingAddress: body.billing || cart.billingAddress || {},
        paymentMethod: body.paymentMethod || 'BKASH',
      });
    }

    if (lineItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    await this.orderModel.insertMany(lineItems);

    const paymentMethod = (body.paymentMethod || 'BKASH').toUpperCase();
    await this.paymentModel.create({
      orderId: orderNumber,
      method: paymentMethod.toLowerCase(),
      phoneNumber: shippingPhone || '01929918378',
      transactionStatus: 'pending',
      statusMessage: 'Awaiting payment confirmation',
      amount: String(toNumber(cart.totalPrice)),
      paymentStatus: 'pending',
      paymentSource: 'prestock',
      customerId: customer._id,
    });

    await this.cartService.deleteById(body.cartId);

    const order = await this.findByOrderNumber(orderNumber);
    return { id: orderNumber, orderNumber, ...order };
  }

  // -------------------------------------------------------------------------
  // Outside (URL import) orders -> unified order line items (orderType:'import')
  // -------------------------------------------------------------------------
  async createOutsideOrder(body: {
    userId?: string;
    productUrl: string;
    productSourcedFrom: string;
    productName: string;
    price: number;
    color?: string;
    size?: string;
    quantity?: number;
    promoCode?: string;
    notes?: string;
  }) {
    if (!body.productUrl || !body.productSourcedFrom || body.price == null) {
      throw new BadRequestException(
        'productUrl, productSourcedFrom and price are required',
      );
    }
    const estimation = this.calculatePrice({
      price: body.price,
      productSourcedFrom: body.productSourcedFrom,
      quantity: body.quantity || 1,
      promoCode: body.promoCode,
    });

    const qty = toNumber(body.quantity) || 1;
    const uni = toNumber(body.price);
    const orderNumber = this.orderService.generateStorefrontOrderNumber();

    let userId;
    let customer;
    const syntheticContact = `OUT-${Date.now()}`;
    if (body.userId) {
      userId = new mongoose.Types.ObjectId(body.userId);
      const user: any = await this.userModel.findById(body.userId).lean().exec();
      if (user) {
        customer = await this.orderService.findOrCreateCustomerByContact(
          user.phone || syntheticContact,
          {
            name: user.name,
            email: user.email,
            sourceOfOrder: 'import-storefront',
          },
        );
      }
    }
    if (!customer) {
      customer = await this.orderService.findOrCreateCustomerByContact(
        syntheticContact,
        {
          name: body.productName,
          sourceOfOrder: 'import-storefront',
        },
      );
    }

    const doc = {
      orderId: orderNumber,
      orderNumber,
      orderType: 'import',
      customerId: customer._id,
      customerName: customer.customerName,
      contactNo: customer.contactNumber,
      orderDate: new Date(),
      createdBy: 'pfu2-storefront',
      orderItemIndex: 1,
      productUrl: body.productUrl,
      productSourcedFrom: body.productSourcedFrom,
      prodDesc: body.productName,
      quantity: qty,
      color: body.color,
      size: body.size,
      uniPrice: uni,
      totalPrice: estimation.totalEstimatedPrice,
      advancePayment: undefined,
      remainingAmount: estimation.totalEstimatedPrice,
      orderNotes: body.notes,
      origin: body.productSourcedFrom,
      status: 'Pending',
      couponCode: body.promoCode,
      userId,
      approximatePrice: estimation.approximatePrice,
      weightCharge: estimation.weightCharge,
      totalEstimatedPrice: estimation.totalEstimatedPrice,
      isPurchased: false,
    };

    const created = await this.orderModel.create(doc);
    return { id: created._id, orderNumber, ...created.toObject() };
  }

  calculatePrice(body: {
    price: number;
    productSourcedFrom: string;
    quantity?: number;
    promoCode?: string;
  }) {
    const { price, productSourcedFrom } = body;
    if (!price || !productSourcedFrom) {
      throw new BadRequestException(
        'Price and product source are required for calculation',
      );
    }
    const basePrice = toNumber(price) * (toNumber(body.quantity) || 1);
    const weightCharge = WEIGHT_CHARGES[productSourcedFrom] || 0;
    const exchangeRate = EXCHANGE_RATES[productSourcedFrom] || 140;
    const approximatePrice = basePrice * 1.1 * exchangeRate;

    let discount = 0;
    if (body.promoCode && body.promoCode.toUpperCase() === 'SAVE5') {
      discount = approximatePrice * 0.05;
    }

    const totalEstimatedPrice = approximatePrice;
    return {
      approximatePrice: Number(approximatePrice.toFixed(2)),
      weightCharge: Number(weightCharge.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      totalEstimatedPrice: Number(totalEstimatedPrice.toFixed(2)),
    };
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------
  private async enrichItems(docs: any[]) {
    const productIds = docs
      .filter((d) => d.productId)
      .map((d) => String(d.productId));
    const products = productIds.length
      ? await this.productModel.find({ _id: { $in: productIds } }).lean().exec()
      : [];
    const productById = new Map(products.map((p: any) => [String(p._id), p]));

    return docs.map((d) => {
      const base: any = {
        productId: d.productId,
        productUrl: d.productUrl,
        name: d.prodDesc,
        quantity: d.quantity,
        price: d.uniPrice,
        totalPrice: d.totalPrice,
        finalPrice: d.totalPrice,
        color: d.color,
        size: d.size,
        notes: d.orderNotes,
        ssImageUrl: d.ssImageUrl
          ? generateImageUrl('screenshots', d.ssImageUrl)
          : undefined,
        productSourcedFrom: d.productSourcedFrom,
        approximatePrice: d.approximatePrice,
        weightCharge: d.weightCharge,
        totalEstimatedPrice: d.totalEstimatedPrice,
        status: d.status,
      };
      if (d.orderType === 'import' || d.productSourcedFrom) {
        base.type = 'outside_order';
        base.product = {
          id: d.productId,
          name: d.prodDesc,
          price: d.uniPrice,
          shortDescription: `${d.productSourcedFrom || ''} sourced product`,
          discountPrice: '0.00',
          images: [],
          slug: `outside-order-${d.productId || d._id}`,
          productUrl: d.productUrl,
          productSourcedFrom: d.productSourcedFrom,
          color: d.color,
          size: d.size,
          notes: d.orderNotes,
          approximatePrice: d.approximatePrice,
          totalEstimatedPrice: d.totalEstimatedPrice,
          status: d.status,
          isOutsideOrder: true,
        };
      } else {
        base.type = 'product';
        const p = d.productId ? productById.get(String(d.productId)) : null;
        base.product = p
          ? {
              id: p._id,
              name: p.name,
              price: p.price,
              shortDescription: p.shortDescription,
              discountPrice: p.discountPrice,
              images: Array.isArray(p.images)
                ? p.images.map((i: string) => generateImageUrl('products', i))
                : [],
              slug: p.slug,
            }
          : null;
      }
      return base;
    });
  }

  private async groupDocs(docs: any[]) {
    const byOrder = new Map<string, any[]>();
    for (const d of docs) {
      const key = String(d.orderNumber || d.orderId);
      if (!byOrder.has(key)) byOrder.set(key, []);
      byOrder.get(key).push(d);
    }

    const orders = [];
    for (const [key, lines] of byOrder) {
      const first = lines[0];
      orders.push({
        _id: first._id,
        id: key,
        orderNumber: key,
        orderType: first.orderType,
        status: first.status,
        isPurchased: first.isPurchased,
        createdAt: first.createdAt,
        updatedAt: first.updatedAt,
        userId: first.userId,
        isGuest: first.isGuest,
        guestEmail: first.guestEmail,
        guestContact: first.guestContact,
        itemPrice: toNumber(first.itemPrice),
        tax: toNumber(first.tax),
        pfu2Charge: toNumber(first.pfu2Charge),
        discount: toNumber(first.discount),
        totalPrice: toNumber(first.grandTotal || first.totalPrice),
        shippingAddress: first.shippingAddress,
        billingAddress: first.billingAddress,
        paymentMethod: first.paymentMethod,
        items: await this.enrichItems(lines),
      });
    }
    return orders;
  }

  async getMyOrders(
    userId: string,
    query: { page?: number; limit?: number; status?: string } = {},
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter: any = { userId };
    if (query.status) filter.status = query.status;

    const docs = await this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
    const total = await this.orderModel.countDocuments(filter).exec();

    return {
      orders: await this.groupDocs(docs),
      total,
      page,
      limit,
    };
  }

  async findAll(query: Record<string, any> = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.userId) filter.userId = query.userId;
    if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
    if (query.orderType) filter.orderType = query.orderType;
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }

    const sort: any = { createdAt: -1 };
    if (query.sort) {
      const [field, direction] = String(query.sort).split(':');
      if (field) sort[field] = (direction || 'DESC').toUpperCase() === 'ASC' ? 1 : -1;
    }

    const [docs, total] = await Promise.all([
      this.orderModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return {
      orders: await this.groupDocs(docs),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const doc = await this.orderModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Order not found');
    const docs = await this.orderModel.find({ orderNumber: doc.orderNumber || doc.orderId }).exec();
    const grouped = await this.groupDocs(docs);
    return grouped[0] || { ...doc.toObject(), items: [] };
  }

  async findByOrderNumber(orderNumber: string) {
    const docs = await this.orderModel.find({ orderNumber }).exec();
    if (!docs.length) throw new NotFoundException(`Order with number ${orderNumber} not found`);
    const grouped = await this.groupDocs(docs);
    return grouped[0];
  }

  // -------------------------------------------------------------------------
  // Mutations (status/update/cancel) - shared with admin parity
  // -------------------------------------------------------------------------
  async update(id: string, data: any) {
    const doc = await this.orderModel.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Order not found');
    return doc.toObject();
  }

  async updateStatus(id: string, status: string) {
    if (!status) throw new BadRequestException('status is required');
    const doc = await this.orderModel
      .findByIdAndUpdate(
        id,
        { $set: { status, isPurchased: status === 'Purchased' || status === 'PURCHASED' } },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('Order not found');
    const docs = await this.orderModel.find({ orderNumber: doc.orderNumber || doc.orderId }).exec();
    const grouped = await this.groupDocs(docs);
    return grouped[0] || { ...doc.toObject(), items: [] };
  }

  async updateLineItemStatus(id: string, body: { productId?: string; status?: string; type?: string }) {
    const doc = await this.orderModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Order not found');
    const set: any = { status: body.status || doc.status };
    if (body.status === 'Purchased' || body.status === 'PURCHASED') set.isPurchased = true;
    const updated = await this.orderModel
      .findByIdAndUpdate(id, { $set: set }, { new: true })
      .exec();
    return updated.toObject();
  }

  async cancelOrder(id: string) {
    const doc = await this.orderModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Order not found');
    const orderNumber = doc.orderNumber || doc.orderId;
    await this.orderModel.updateMany(
      { orderNumber },
      { $set: { status: 'Cancelled', isPurchased: false } },
    ).exec();
    const docs = await this.orderModel.find({ orderNumber }).exec();
    const grouped = await this.groupDocs(docs);
    return grouped[0];
  }

  async remove(id: string) {
    const doc = await this.orderModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Order not found');
    return { success: true, message: 'Order deleted successfully' };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { CartDocument } from '../interfaces/cart.interface';
import { generateImageUrl } from '../utils/image-url.util';
import { SettingsService } from '../settings/settings.service';
import {
  breakdownBdt,
  moneyFieldsFor,
  resolveRate,
} from '../utils/pricing.util';

function parseItems(raw: any): any[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toFixed2(n: number): number {
  return Number((Math.round(n * 100) / 100).toFixed(2));
}

/**
 * Cart totals in BDT, derived from the canonical per-item breakdown in
 * pricing.util.ts (ceil entered price -> tax -> FX -> ceil BDT).
 *
 * `itemPrice` is the tax-INCLUSIVE product price, `tax` is the tax portion of
 * it, and `shippingBdt` is converted-but-untaxed shipping, so the customer
 * summary can show product price / tax / shipping as three separate lines.
 * Discount is subtracted at the end.
 */
function calculateCartTotals(
  items: any[],
  discount = 0,
  getRate: (source: string) => number = () => 1,
) {
  let basePriceBdt = 0;
  let taxBdt = 0;
  let shippingBdt = 0;

  for (const it of items || []) {
    const b = breakdownBdt(it, getRate(String(it?.productSourcedFrom || '')));
    const qty = Number(it?.quantity) || 0;
    basePriceBdt += b.basePriceBdt * qty;
    taxBdt += b.taxBdt * qty;
    shippingBdt += b.shippingBdt * qty;
  }

  const itemPrice = basePriceBdt + taxBdt;
  const totalPrice = toFixed2(itemPrice + shippingBdt - (Number(discount) || 0));
  return {
    itemPrice: toFixed2(itemPrice),
    tax: toFixed2(taxBdt),
    shippingBdt: toFixed2(shippingBdt),
    basePriceBdt: toFixed2(basePriceBdt),
    totalPrice,
  };
}

@Injectable()
export class CartService {
  constructor(
    @InjectModel('Cart') private readonly cartModel: Model<CartDocument>,
    @InjectModel('Customer') private readonly userModel: Model<any>,
    @InjectModel('Product') private readonly productModel: Model<any>,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Build a synchronous rate lookup by first awaiting every rate we need for
   * the given items. Call this once per cart mutation, then pass the returned
   * function to `calculateCartTotals` and `stampMoney`.
   */
  private async buildRateLookup(items: any[]): Promise<(source: string) => number> {
    const sources = new Set<string>();
    for (const it of items || []) {
      const s = String(it?.productSourcedFrom || '').trim().toUpperCase();
      if (s) sources.add(s);
    }
    const rates = new Map<string, number>();
    await Promise.all(
      [...sources].map(async (s) => {
        rates.set(
          s,
          await resolveRate(s, (key) => this.settingsService.getByKey(key)),
        );
      }),
    );
    return (source: string) =>
      rates.get(String(source || '').trim().toUpperCase()) ?? 1;
  }

  /**
   * Stamp the persisted per-unit BDT breakdown (priceBdt / taxBdt /
   * shippingBdt) onto every item, so the customer summary can read stored
   * values instead of re-deriving them. Items are mutated in place; the caller
   * assigns the array back to the document before saving.
   */
  private stampMoney(items: any[], getRate: (source: string) => number) {
    for (const it of items || []) {
      const source = String(it?.productSourcedFrom || '');
      Object.assign(it, moneyFieldsFor(it, getRate(source)));
    }
    return items;
  }

  /**
   * One-stop helper for every cart mutation: stamp the money breakdown onto the
   * items and recompute the cart-level totals with the same canonical pipeline.
   */
  private async applyPricing(cart: any, items: any[]) {
    const getRate = await this.buildRateLookup(items);
    this.stampMoney(items, getRate);
    return calculateCartTotals(items, cart?.discount || 0, getRate);
  }

  private async enrich(cartDoc: CartDocument) {
    const cart = cartDoc.toObject ? cartDoc.toObject() : cartDoc;
    const items = (cart.items || []).map((item: any) => ({ ...item }));

    let user = null;
    if (cart.userId) {
      user = await this.userModel
        .findById(cart.userId)
        .select('customerName emailAddress contactNumber phone role')
        .lean()
        .exec();
      if (user)
        user = {
          id: user._id,
          name: user.customerName,
          email: user.emailAddress,
          phone: user.contactNumber || user.phone,
          role: user.role,
        };
    }

    const enrichedItems = [];
    for (const item of items) {
      if (item.type === 'outside_order') {
        enrichedItems.push({
          ...item,
          ssImageUrl: item.ssImageUrl
            ? generateImageUrl('screenshots', item.ssImageUrl)
            : undefined,
          product: {
            id: item.productId,
            name: item.name,
            price: item.price,
            shortDescription:
              item.productSourcedFrom != null
                ? `${item.category ? `${item.category} - ` : ''}${
                    item.productSourcedFrom
                  } sourced product${item.color ? ` - ${item.color}` : ''}${
                    item.size ? ` - ${item.size}` : ''
                  }${item.variant ? ` - ${item.variant}` : ''}`
                : undefined,
            discountPrice: '0.00',
            images: [],
            slug: `outside-order-${item.productId}`,
            productUrl: item.productUrl,
            productSourcedFrom: item.productSourcedFrom,
            color: item.color,
            size: item.size,
            notes: item.notes,
            promoCode: item.promoCode,
            category: item.category,
            variant: item.variant,
            approximatePrice: item.approximatePrice,
            totalEstimatedPrice: item.totalEstimatedPrice,
            status: item.status,
            isOutsideOrder: true,
          },
        });
      } else {
        let product = null;
        if (item.productId) {
          product = await this.productModel
            .findById(item.productId)
            .lean()
            .exec();
        }
        if (product) {
          product = {
            id: product._id,
            name: product.name,
            price: product.price,
            shortDescription: product.shortDescription,
            discountPrice: product.discountPrice,
            images: Array.isArray(product.images)
              ? product.images.map((i: string) =>
                  generateImageUrl('products', i),
                )
              : [],
            slug: product.slug,
          };
        }
        enrichedItems.push({ ...item, product });
      }
    }

    const outsideItems = enrichedItems.filter(
      (i) => i.type === 'outside_order',
    );
    const readyToOrder =
      outsideItems.length === 0 ||
      outsideItems.every((i) => i.priceManuallyUpdated === true);

    return {
      ...cart,
      id: cart._id,
      user,
      items: enrichedItems,
      cartItemsCount: enrichedItems.length,
      readyToOrder,
      isPriceUpdated: readyToOrder,
    };
  }

  private async findOrCreate(identity: {
    userId?: string;
    guestToken?: string;
  }) {
    if (identity.userId) {
      let cart = await this.cartModel
        .findOne({ userId: identity.userId })
        .exec();
      if (!cart) {
        cart = new this.cartModel({
          userId: identity.userId,
          items: [],
          itemPrice: 0,
          tax: 0,
          pfu2Charge: 0,
          discount: 0,
          totalPrice: 0,
        });
        await cart.save();
      }
      return cart;
    }
    if (identity.guestToken) {
      let cart = await this.cartModel
        .findOne({ guestToken: identity.guestToken })
        .exec();
      if (!cart) {
        cart = new this.cartModel({
          guestToken: identity.guestToken,
          items: [],
          itemPrice: 0,
          tax: 0,
          pfu2Charge: 0,
          discount: 0,
          totalPrice: 0,
        });
        await cart.save();
      }
      return cart;
    }
    throw new BadRequestException('Missing user or guest token');
  }

  async getMyCart(identity: { userId?: string; guestToken?: string }) {
    const cart = await this.findOrCreate(identity);
    return this.enrich(cart);
  }

  async getById(id: string) {
    const cart = await this.cartModel.findById(id).exec();
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }
    return this.enrich(cart);
  }

  async getRawCart(id: string) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid cart ID');
    }
    const cart = await this.cartModel.findById(id).exec();
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }
    return cart;
  }

  async deleteById(id: string) {
    await this.cartModel.findByIdAndDelete(id).exec();
  }

  async addItem(
    identity: { userId?: string; guestToken?: string },
    body: {
      productId: string;
      quantity: number;
      price: number;
      type?: string;
      name?: string;
      productUrl?: string;
      productSourcedFrom?: string;
      color?: string;
      size?: string;
      notes?: string;
      promoCode?: string;
      category?: string;
      variant?: string;
      approximatePrice?: number;
      totalEstimatedPrice?: number;
    },
  ) {
    const cart = await this.findOrCreate(identity);
    const type = body.type || 'product';
    if (type === 'outside_order') {
      if (!body.productId)
        throw new BadRequestException('Product ID is required');
    } else {
      const product = await this.productModel
        .findById(body.productId)
        .lean()
        .exec();
      if (!product) throw new NotFoundException('Product not found');
    }

    const items = parseItems(cart.items);
    const qty = Number(body.quantity) || 1;
    const price = toFixed2(Number(body.price) || 0);
    const idx = items.findIndex(
      (it: any) =>
        String(it.productId) === String(body.productId) &&
        (it.type || 'product') === type,
    );
    if (idx >= 0) {
      items[idx].quantity = Number(items[idx].quantity) + qty;
      items[idx].price = price;
      if (body.promoCode) items[idx].promoCode = body.promoCode;
    } else {
      const item: any = {
        productId: body.productId,
        quantity: qty,
        price,
        type,
      };
      if (type === 'outside_order') {
        item.name = body.name;
        item.productUrl = body.productUrl;
        item.productSourcedFrom = body.productSourcedFrom;
        item.color = body.color;
        item.size = body.size;
        item.notes = body.notes;
        item.promoCode = body.promoCode;
        item.category = body.category;
        item.variant = body.variant;
        item.approximatePrice = body.approximatePrice;
        item.totalEstimatedPrice = body.totalEstimatedPrice;
      }
      items.push(item);
    }

    const totals = await this.applyPricing(cart, items);
    cart.items = items;
    cart.itemPrice = totals.itemPrice;
    cart.tax = totals.tax;
    cart.shippingBdt = totals.shippingBdt;
    cart.totalPrice = totals.totalPrice;
    cart.isRead = false;
    await cart.save();
    return this.enrich(cart);
  }

  async updateItem(
    id: string,
    body: {
      productId: string;
      quantity?: number;
      price?: number;
      finalPrice?: number;
      type?: string;
      /** USA sales tax RATE as a percentage (e.g. 10 = 10%). Not money. */
      usaSalesTax?: number | null;
      shippingCost?: number;
      updatedBy?: string;
    },
  ) {
    const cart = await this.cartModel.findById(id).exec();
    if (!cart) throw new NotFoundException('Cart not found');
    const type = body.type || 'product';
    const items = parseItems(cart.items);
    const idx = items.findIndex(
      (it: any) =>
        String(it.productId) === String(body.productId) &&
        (it.type || 'product') === type,
    );
    if (idx < 0) throw new NotFoundException('Cart item not found');

    if (body.price !== undefined) {
      const p = toFixed2(Number(body.price));
      items[idx].price = p;
      items[idx].finalPrice =
        body.finalPrice !== undefined ? toFixed2(Number(body.finalPrice)) : p;
      items[idx].priceManuallyUpdated = true;
    } else if (body.finalPrice !== undefined) {
      items[idx].finalPrice = toFixed2(Number(body.finalPrice));
      items[idx].priceManuallyUpdated = true;
    }
    if (body.usaSalesTax !== undefined) {
      // `usaSalesTax` is a PERCENTAGE RATE (e.g. 10 = 10%), not a money
      // amount. A blank / non-numeric / non-positive value is stored as null so
      // the default rate applies instead of being pinned to 0.
      const rate = Number(body.usaSalesTax);
      items[idx].usaSalesTax =
        Number.isFinite(rate) && rate > 0 ? toFixed2(rate) : null;
    }
    if (body.shippingCost !== undefined) {
      items[idx].shippingCost = toFixed2(Number(body.shippingCost));
    }
    if (body.updatedBy) {
      cart.updatedBy = body.updatedBy;
    }
    if (body.quantity !== undefined) {
      const q = Number(body.quantity);
      if (q <= 0) {
        items.splice(idx, 1);
      } else {
        items[idx].quantity = q;
      }
    }

    const totals = await this.applyPricing(cart, items);
    cart.items = items;
    cart.itemPrice = totals.itemPrice;
    cart.tax = totals.tax;
    cart.shippingBdt = totals.shippingBdt;
    cart.totalPrice = totals.totalPrice;
    await cart.save();
    return this.enrich(cart);
  }

  async updateQuantity(
    id: string,
    body: { productId: string; type?: string; delta: number },
  ) {
    if (!body.productId || typeof body.delta !== 'number') {
      throw new BadRequestException('Product ID and delta are required');
    }
    const cart = await this.cartModel.findById(id).exec();
    if (!cart) throw new NotFoundException('Cart not found');
    const type = body.type || 'product';
    const items = parseItems(cart.items);
    const idx = items.findIndex(
      (it: any) =>
        String(it.productId) === String(body.productId) &&
        (it.type || 'product') === type,
    );
    if (idx < 0) throw new NotFoundException('Cart item not found');
    const next = Number(items[idx].quantity) + Number(body.delta);
    if (next < 1)
      throw new BadRequestException('Quantity cannot be less than 1');
    items[idx].quantity = next;
    const totals = await this.applyPricing(cart, items);
    cart.items = items;
    cart.itemPrice = totals.itemPrice;
    cart.tax = totals.tax;
    cart.shippingBdt = totals.shippingBdt;
    cart.totalPrice = totals.totalPrice;
    await cart.save();
    return this.enrich(cart);
  }

  async uploadSsImage(
    id: string,
    body: { productId: string; type?: string },
    filename?: string,
  ) {
    if (!filename) throw new BadRequestException('No screenshot uploaded');
    const cart = await this.cartModel.findById(id).exec();
    if (!cart) throw new NotFoundException('Cart not found');
    const type = body.type || 'product';
    const items = parseItems(cart.items);
    const idx = items.findIndex(
      (it: any) =>
        String(it.productId) === String(body.productId) &&
        (it.type || 'product') === type,
    );
    if (idx < 0) throw new NotFoundException('Cart item not found');
    items[idx].ssImageUrl = filename;
    cart.items = items;
    await cart.save();
    return this.enrich(cart);
  }

  async requestPrice(
    id: string,
    body: { isRequested?: boolean; guestContact?: string },
  ) {
    const cart = await this.cartModel.findById(id).exec();
    if (!cart) return null;
    cart.isRequested = body.isRequested === true;
    if (body.isRequested === true) {
      cart.requestedAt = new Date();
    }
    if (body.guestContact !== undefined) cart.guestContact = body.guestContact;
    await cart.save();
    return this.enrich(cart);
  }

  async setItemStatus(
    id: string,
    body: {
      productId: string;
      type?: string;
      status?: string;
      reason?: string;
    },
  ) {
    const cart = await this.cartModel.findById(id).exec();
    if (!cart) throw new NotFoundException('Cart not found');
    const type = body.type || 'product';
    const items = parseItems(cart.items) as any[];
    const idx = items.findIndex(
      (it: any) =>
        String(it.productId) === String(body.productId) &&
        (it.type || 'product') === type,
    );
    if (idx < 0) throw new NotFoundException('Cart item not found');

    const status = (body.status || 'PENDING').toUpperCase();
    const allowed = ['PENDING', 'HOLD', 'CANCELLED'];
    if (!allowed.includes(status))
      throw new BadRequestException(
        `Invalid status. Allowed: ${allowed.join(', ')}`,
      );
    items[idx].adminStatus = status as any;
    if (body.reason !== undefined) items[idx].adminReason = body.reason;
    if (status === 'PENDING') items[idx].adminReason = undefined;
    cart.items = items;
    await cart.save();
    return this.enrich(cart);
  }

  async removeItem(id: string, productType: string, productId: string) {
    const cart = await this.cartModel.findById(id).exec();
    if (!cart) throw new NotFoundException('Cart not found');
    const items = parseItems(cart.items).filter(
      (it: any) =>
        !(
          String(it.productId) === String(productId) &&
          (it.type || 'product') === (productType || 'product')
        ),
    );
    const totals = await this.applyPricing(cart, items);
    cart.items = items;
    cart.itemPrice = totals.itemPrice;
    cart.tax = totals.tax;
    cart.shippingBdt = totals.shippingBdt;
    cart.totalPrice = totals.totalPrice;
    await cart.save();
    return this.enrich(cart);
  }

  async clearCart(id: string) {
    const cart = await this.cartModel.findById(id).exec();
    if (!cart) throw new NotFoundException('Cart not found');
    cart.items = [];
    cart.itemPrice = 0;
    cart.tax = 0;
    cart.shippingBdt = 0;
    cart.totalPrice = toFixed2((cart.pfu2Charge || 0) + (cart.discount || 0));
    await cart.save();
    return this.enrich(cart);
  }

  async clearUserCart(userId: string) {
    const cart = await this.cartModel.findOne({ userId }).exec();
    if (!cart) throw new NotFoundException('Cart not found');
    cart.items = [];
    cart.itemPrice = 0;
    cart.tax = 0;
    cart.shippingBdt = 0;
    cart.totalPrice = toFixed2((cart.pfu2Charge || 0) + (cart.discount || 0));
    await cart.save();
    return this.enrich(cart);
  }

  async delete(id: string) {
    await this.cartModel.findByIdAndDelete(id).exec();
  }

  async mergeGuestToUser(userId: string, guestToken?: string) {
    if (!guestToken)
      throw new BadRequestException('Missing user ID or guest token');
    const guestCart = await this.cartModel.findOne({ guestToken }).exec();
    if (!guestCart) return;
    const guestItems = parseItems(guestCart.items);

    const userCart = await this.cartModel.findOne({ userId }).exec();
    if (!userCart) {
      guestCart.userId = userId as any;
      guestCart.guestToken = undefined as any;
      await guestCart.save();
      return;
    }

    const userItems = parseItems(userCart.items);
    for (const gItem of guestItems) {
      const type = gItem.type || 'product';
      const idx = userItems.findIndex(
        (it: any) =>
          String(it.productId) === String(gItem.productId) &&
          (it.type || 'product') === type,
      );
      if (idx >= 0) {
        userItems[idx].quantity =
          Number(userItems[idx].quantity) + Number(gItem.quantity);
      } else {
        userItems.push(gItem);
      }
    }
    const totals = await this.applyPricing(userCart, userItems);
    userCart.items = userItems;
    userCart.itemPrice = totals.itemPrice;
    userCart.tax = totals.tax;
    userCart.shippingBdt = totals.shippingBdt;
    userCart.totalPrice = totals.totalPrice;
    await userCart.save();
    await guestCart.deleteOne();
  }

  async getRequestedCarts(query: Record<string, any> = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = { isRequested: true };
    if (query.userId) filter.userId = query.userId;

    const sort: Record<string, any> = { requestedAt: -1 };
    if (query.sort) {
      const [field, direction] = String(query.sort).split(':');
      if (field) sort[field] = direction === 'asc' ? 1 : -1;
    }

    const [rows, total] = await Promise.all([
      this.cartModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.cartModel.countDocuments(filter).exec(),
    ]);

    // mark unread requested carts as read
    await this.cartModel
      .updateMany(
        { isRequested: true, isRead: false },
        { $set: { isRead: true } },
      )
      .exec();

    const data = [];
    for (const row of rows) {
      data.push(await this.enrich(row));
    }
    return {
      carts: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
    };
  }

  async getRequestedCartCount() {
    const cartCount = await this.cartModel
      .countDocuments({ isRequested: true })
      .exec();
    // orderCount mirrors pfu2: count of requested carts (no separate order notion here)
    const orderCount = cartCount;
    return { cartCount, orderCount };
  }

  async getUnreadPriceRequestCount(): Promise<number> {
    return this.cartModel
      .countDocuments({ isRequested: true, isRead: false })
      .exec();
  }
}

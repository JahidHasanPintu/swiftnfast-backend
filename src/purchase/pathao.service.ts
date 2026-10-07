import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PurchaseDocument } from './interfaces/puchase.interface';
import axios from 'axios';
import { NotificationService } from 'src/storefront/notifications/notification.service';

@Injectable()
export class PathaoService {
  constructor(
    @InjectModel('Purchases') private PurchaseModel: Model<PurchaseDocument>,
    @InjectModel('PreStockOrder') private preStockOrderModel: Model<any>,
    private readonly notificationService: NotificationService,
  ) {}

  private readonly logger = new Logger(PathaoService.name);
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  // ── Auth ──────────────────────────────────────────────────────────────
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const res = await axios.post(
      `${process.env.PATHAO_BASE_URL}/aladdin/api/v1/issue-token`,
      {
        client_id: process.env.PATHAO_CLIENT_ID,
        client_secret: process.env.PATHAO_CLIENT_SECRET,
        username: process.env.PATHAO_USERNAME,
        password: process.env.PATHAO_PASSWORD,
        grant_type: 'password',
      },
    );

    this.accessToken = res.data.access_token;
    this.tokenExpiry = Date.now() + res.data.expires_in * 1000 - 60000; // 1 min buffer
    return this.accessToken;
  }

  private async pathaoPost(endpoint: string, body: any) {
    const token = await this.getAccessToken();
    // console.log('checking token: ',token);
    return axios.post(`${process.env.PATHAO_BASE_URL}${endpoint}`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // ── Validate a purchase has everything Pathao needs ───────────────────

  private validateForPathao(purchase: any, label: string): string[] {
    const errors: string[] = [];

    const customer = purchase.customer || {};

    if (!customer.contactNumber) {
      errors.push(`${label}: recipient phone is missing`);
    }

    if (!customer.shippingAddress) {
      errors.push(`${label}: recipient address is missing`);
    }

    if (!customer.customerName) {
      errors.push(`${label}: customer name is missing`);
    }

    if (
      !purchase.productWeightCharge ||
      Number(purchase.productWeightCharge) === 0
    ) {
      errors.push(
        `${label}: product weight charge is 0 — update shipment info first`,
      );
    }

    return errors;
  }

  // ── Build Pathao order payload from a purchase document ───────────────
  private buildPathaoPayload(purchase: any) {
    const customer = purchase.customer || {};

    return {
      store_id: process.env.PATHAO_STORE_ID,

      merchant_order_id: `${purchase.orderId}-${purchase.orderItemIndex}`,

      recipient_name: customer.customerName,

      recipient_phone: customer.contactNumber,

      recipient_address: customer.shippingAddress,

      // TODO: Make these dynamic later
      recipient_city: 1,
      recipient_zone: 1,

      delivery_type: 48,
      item_type: 2,

      special_instruction: purchase.note || '',

      item_quantity: Number(purchase.quantity || 1),

      item_weight: Number(purchase.productWeight || 0.5),

      amount_to_collect: Number(purchase.remaniningDue || 0),

      item_description: purchase.prodDesc || 'Product',
    };
  }

  // ── Single delivery ───────────────────────────────────────────────────
  async createSingleDelivery(orderId: string, orderItemIndex: number) {
    // Fetch purchase with customer info
    this.logger.debug(`Pathao store id: ${process.env.PATHAO_STORE_ID}`);
    const purchaseData = await this.PurchaseModel.aggregate([
      {
        $match: {
          orderId,
          orderItemIndex: Number(orderItemIndex),
        },
      },

      // Convert customerId string -> ObjectId
      {
        $addFields: {
          customerObjectId: {
            $convert: {
              input: '$customerId',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },

      // Lookup customer
      {
        $lookup: {
          from: 'customers',
          localField: 'customerObjectId',
          foreignField: '_id',
          as: 'customer',
        },
      },

      // Convert array -> object
      {
        $unwind: {
          path: '$customer',
          preserveNullAndEmptyArrays: true,
        },
      },

      // Remove temp field
      {
        $project: {
          customerObjectId: 0,
        },
      },
    ]);

    const purchase = purchaseData[0];

    if (!purchase) {
      throw new BadRequestException(
        `Order ${orderId} item ${orderItemIndex} not found`,
      );
    }

    const label = `${orderId}-${orderItemIndex}`;

    // Validate customer + purchase data
    const errors = this.validateForPathao(purchase, label);

    if (errors.length) {
      throw new BadRequestException({ errors });
    }

    // Build Pathao payload
    const payload = this.buildPathaoPayload(purchase);

    try {
      // Send to Pathao
      const res = await this.pathaoPost('/aladdin/api/v1/orders', payload);

      const { consignment_id, order_id, order_status } = res.data.data;

      // Update purchase
      await this.PurchaseModel.findOneAndUpdate(
        {
          orderId,
          orderItemIndex,
        },
        {
          $set: {
            pathaoConsignmentId: consignment_id,
            pathaoOrderId: order_id,
            pathaoStatus: order_status,
            pathaoCreatedAt: new Date(),
            deliveryMethod: 'Pathao',
            status: 'Shipped',
          },
        },
        { new: true },
      );

      // Send shipped notification
      this.notificationService.notifyStatusChange('STATUS_FULL_SHIPPED', {
        customerName: purchase.customerName,
        customerPhone: purchase.recipientPhone,
        orderNumber: orderId,
        status: 'Shipped',
        trackingCode: String(consignment_id),
      }).catch(() => {});

      return {
        success: true,
        consignment_id,
        order_id,
        order_status,
        payloadSent: payload,
      };
    } catch (err: any) {
      this.logger.error(
        `Pathao error: ${err?.response?.data?.message || err?.message || err}`,
      );

      const msg = err?.response?.data?.message || 'Pathao API error';

      throw new BadRequestException({
        errors: [`${label}: ${msg}`],
      });
    }
  }

  // ── Bulk delivery ─────────────────────────────────────────────────────
  async createBulkDelivery(
    orders: { orderId: string; orderItemIndex: number }[],
  ) {
    const results: any[] = [];
    const errors: string[] = [];

    for (const { orderId, orderItemIndex } of orders) {
      const purchase = await this.PurchaseModel.findOne({
        orderId,
        orderItemIndex,
      });
      const label = `${orderId}-${orderItemIndex}`;

      if (!purchase) {
        errors.push(`${label}: not found`);
        continue;
      }

      const validationErrors = this.validateForPathao(purchase, label);
      if (validationErrors.length) {
        errors.push(...validationErrors);
        continue;
      }

      const payload = this.buildPathaoPayload(purchase);

      try {
        const res = await this.pathaoPost('/aladdin/api/v1/orders', payload);
        const { consignment_id, order_id, order_status } = res.data.data;

        await this.PurchaseModel.findOneAndUpdate(
          { orderId, orderItemIndex },
          {
            $set: {
              pathaoConsignmentId: consignment_id,
              pathaoOrderId: order_id,
              pathaoStatus: order_status,
              pathaoCreatedAt: new Date(),
              deliveryMethod: 'Pathao',
              status: 'Shipped',
            },
          },
        );

        // Send shipped notification
        this.notificationService.notifyStatusChange('STATUS_FULL_SHIPPED', {
          customerName: purchase.customerName,
          customerPhone: purchase.recipientPhone,
          orderNumber: orderId,
          status: 'Shipped',
          trackingCode: String(consignment_id),
        }).catch(() => {});

        results.push({ label, success: true, consignment_id, order_id });
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Pathao API error';
        errors.push(`${label}: ${msg}`);
      }
    }

    return {
      succeeded: results,
      failed: errors,
      summary: `${results.length} succeeded, ${errors.length} failed`,
    };
  }

  // ── Pre-stock (stock) orders ─────────────────────────────────────────
  // A ready-stock order carries its own recipient on `shippingAddress`, so it
  // needs no join against the `customers` collection like a purchase does.

  private validatePreStockOrder(order: any, label: string): string[] {
    const errors: string[] = [];
    const shipping = order.shippingAddress || {};

    if (!order.customerName && !shipping.name) {
      errors.push(`${label}: recipient name is missing`);
    }
    if (!order.contactNumber && !shipping.phone) {
      errors.push(`${label}: recipient phone is missing`);
    }
    if (
      !shipping.address &&
      !shipping.street &&
      !shipping.line1 &&
      !shipping.shippingAddress
    ) {
      errors.push(`${label}: recipient address is missing`);
    }

    return errors;
  }

  private buildPreStockPayload(
    order: any,
    item: any,
    orderItemIndex: number,
    specialInstruction?: string,
  ) {
    const shipping = order.shippingAddress || {};
    const asInt = (v: any) => {
      const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };

    const city = asInt(shipping.city) ?? asInt(shipping.cityId) ?? 1;
    const zone = asInt(shipping.zone) ?? asInt(shipping.zoneId) ?? 1;

    return {
      store_id: process.env.PATHAO_STORE_ID,

      merchant_order_id: `${order.orderNumber}-${orderItemIndex}`,

      recipient_name: shipping.name || order.customerName,

      recipient_phone: shipping.phone || order.contactNumber,

      recipient_address:
        shipping.address || shipping.street || shipping.line1 || '',

      recipient_city: city,
      recipient_zone: zone,

      delivery_type: 48,
      item_type: 2,

      special_instruction:
        specialInstruction ||
        shipping.notes ||
        shipping.deliveryNote ||
        item.orderNotes ||
        '',

      item_quantity: Number(item.quantity || 1),

      item_weight: Number(item.weight || 0.5),

      amount_to_collect: Number(item.remainingAmount || 0),

      item_description: item.prodDesc || 'Product',
    };
  }

  /** Hand a single ready-stock line to Pathao. */
  async createPreStockDelivery(
    orderNumber: string,
    orderItemIndex: number,
    specialInstruction?: string,
  ) {
    const order: any = await this.preStockOrderModel
      .findOne({ orderNumber })
      .lean()
      .exec();

    if (!order) {
      throw new BadRequestException(`Order ${orderNumber} not found`);
    }

    const item = (order.items || [])[Number(orderItemIndex)];
    if (!item) {
      throw new BadRequestException(
        `Order ${orderNumber} item ${orderItemIndex} not found`,
      );
    }

    const label = `${orderNumber}-${orderItemIndex}`;

    if (item.delivery?.pathaoConsignmentId) {
      throw new BadRequestException({
        errors: [
          `${label}: already dispatched (consignment ${item.delivery.pathaoConsignmentId})`,
        ],
      });
    }

    const errors = this.validatePreStockOrder(order, label);
    if (item.remainingAmount === undefined || item.remainingAmount === null) {
      errors.push(`${label}: remaining amount is missing`);
    }
    if (errors.length) {
      throw new BadRequestException({ errors });
    }

    const payload = this.buildPreStockPayload(
      order,
      item,
      orderItemIndex,
      specialInstruction,
    );

    try {
      const res = await this.pathaoPost('/aladdin/api/v1/orders', payload);
      const { consignment_id, order_id, order_status } = res.data.data;

      const idx = Number(orderItemIndex);
      const isSettled = (s: string) =>
        ['SHIPPED', 'PARTIAL_DELIVERED', 'FULL_DELIVERED', 'CANCELLED'].includes(
          s,
        );
      const preShipment = new Set([
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'USWAREHOUSE',
        'BDOFFICE',
      ]);
      // The order only flips to SHIPPED once every line has left the building;
      // a half-shipped order keeps the status the admin gave it.
      const allSettled = (order.items || []).every(
        (it: any, i: number) => i === idx || isSettled(it?.status),
      );
      const nextOrderStatus =
        preShipment.has(order.status) && allSettled ? 'SHIPPED' : order.status;

      await this.preStockOrderModel.updateOne(
        { orderNumber },
        {
          $set: {
            [`items.${idx}.status`]: 'SHIPPED',
            [`items.${idx}.delivery`]: {
              method: 'Pathao',
              pathaoConsignmentId: consignment_id,
              pathaoOrderId: order_id,
              pathaoStatus: order_status,
              pathaoCreatedAt: new Date(),
            },
            status: nextOrderStatus,
          },
        },
      );

      this.notificationService
        .notifyStatusChange('STATUS_FULL_SHIPPED', {
          customerName: order.customerName,
          customerPhone: order.contactNumber,
          orderNumber,
          status: 'Shipped',
          trackingCode: String(consignment_id),
        })
        .catch(() => {});

      return {
        success: true,
        consignment_id,
        order_id,
        order_status,
        payloadSent: payload,
      };
    } catch (err: any) {
      this.logger.error(
        `Pathao pre-stock error: ${err?.response?.data?.message || err?.message || err}`,
      );
      const msg = err?.response?.data?.message || 'Pathao API error';
      throw new BadRequestException({ errors: [`${label}: ${msg}`] });
    }
  }

  /** Hand a batch of ready-stock lines to Pathao, one failure does not stop the rest. */
  async createPreStockBulkDelivery(
    orders: { orderId: string; orderItemIndex: number }[],
  ) {
    const results: any[] = [];
    const errors: string[] = [];

    for (const { orderId, orderItemIndex } of orders) {
      try {
        const res = await this.createPreStockDelivery(
          orderId,
          Number(orderItemIndex),
        );
        results.push({
          label: `${orderId}-${orderItemIndex}`,
          success: true,
          consignment_id: res.consignment_id,
          order_id: res.order_id,
        });
      } catch (err: any) {
        errors.push(...this.errorsFrom(err, `${orderId}-${orderItemIndex}`));
      }
    }

    return {
      succeeded: results,
      failed: errors,
      summary: `${results.length} succeeded, ${errors.length} failed`,
    };
  }

  /** Turn whatever a failed call threw into the label list the UI renders. */
  private errorsFrom(err: any, label: string): string[] {
    const resp =
      typeof err?.getResponse === 'function' ? err.getResponse() : err?.response;
    if (Array.isArray(resp?.errors)) return resp.errors;
    const msg =
      resp?.errors || resp?.message || err?.response?.data?.message || err?.message;
    return [`${label}: ${msg || 'Pathao API error'}`];
  }
}

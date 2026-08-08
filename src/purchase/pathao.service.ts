import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PurchaseDocument } from './interfaces/puchase.interface';
import axios from 'axios';

@Injectable()
export class PathaoService {
  constructor(
    @InjectModel('Purchases') private PurchaseModel: Model<PurchaseDocument>,
  ) {}

  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

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
    console.log('checking store: ', process.env.PATHAO_STORE_ID);
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
            $convert: { input: '$customerId', to: 'objectId', onError: null, onNull: null },
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

      return {
        success: true,
        consignment_id,
        order_id,
        order_status,
        payloadSent: payload,
      };
    } catch (err: any) {
      console.log('PATHAO ERROR:', err?.response?.data || err);

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
}

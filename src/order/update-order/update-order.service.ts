import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as _ from 'lodash';

import { OrderDocument } from '../interfaces/order.interface';
import { PaymentDocument } from '../interfaces/payment.interface';
import { CustomerDocument } from '../interfaces/customer.interface';

@Injectable()
export class UpdateOrderService {
  constructor(
    @InjectModel('Orders') private orderModel: Model<OrderDocument>,
    @InjectModel('Payments') private paymentModel: Model<PaymentDocument>,
    @InjectModel('Customer') private customerModel: Model<CustomerDocument>,
  ) {}

  /**
   * Main update entry point.
   * @param orderId  The human-readable order ID, e.g. "ORD-220426xxxx"
   * @param updateDto  The full update payload from the request body
   */
  async updateOrderAndPayments(
    orderId: string,
    updateDto: any,
  ): Promise<{ message: string; orders: OrderDocument[]; payment: any }> {
    // ── 1. Validate payload ──────────────────────────────────────────────────
    if (!updateDto.orders || updateDto.orders.length === 0) {
      throw new BadRequestException('No order items provided for update');
    }

    // ── 2. Resolve the real orderId string ───────────────────────────────────
    //
    // The frontend may send either:
    //   (a) the human-readable orderId  → "ORD-220426xxxx"  (find directly)
    //   (b) a Mongo _id of an order doc → "69e833951e5a874f6618db44"
    //   (c) a Mongo _id of a customer   → "69e833951e5a874f6618db44"
    //
    // We try (a) first, then fall back to (b)/(c) so both cases work.

    const isMongoId = /^[a-f\d]{24}$/i.test(orderId);
    let resolvedOrderId = orderId;

    if (isMongoId) {
      // Try to find an order whose _id matches (case b)
      const orderById = await this.orderModel
        .findById(orderId)
        .exec();

      if (orderById) {
        resolvedOrderId = orderById.orderId as string;
      } else {
        // Try to find orders whose customerId matches (case c)
        const orderByCustomer = await this.orderModel
          .findOne({ customerId: orderId })
          .exec();

        if (orderByCustomer) {
          resolvedOrderId = orderByCustomer.orderId as string;
        }
      }
    }

    // ── 3. Fetch all order items using the resolved orderId ──────────────────
    const existingOrders: OrderDocument[] = await this.orderModel
      .find({ orderId: resolvedOrderId })
      .exec();

    if (!existingOrders || existingOrders.length === 0) {
      throw new NotFoundException(
        `No orders found with orderId: ${resolvedOrderId} (received param: ${orderId})`,
      );
    }

    // Overwrite so the rest of the method uses the correct string
    orderId = resolvedOrderId;

    // ── 4. Resolve the customer via the first existing order's customerId ────
    const mongoCustomerId = existingOrders[0].customerId;

    const existingCustomer: CustomerDocument | null =
      await this.customerModel.findById(mongoCustomerId).exec();

    if (!existingCustomer) {
      throw new NotFoundException(
        `Customer linked to orderId ${orderId} not found`,
      );
    }

    // ── 5. Sync order items ──────────────────────────────────────────────────
    const incomingIndexes: number[] = updateDto.orders.map(
      (o: any) => Number(o.orderItemIndex),
    );

    // 4a. Delete order items no longer present in the payload
    const itemsToDelete = existingOrders.filter(
      (o) => !incomingIndexes.includes(Number(o.orderItemIndex)),
    );

    if (itemsToDelete.length > 0) {
      const idsToDelete = itemsToDelete.map((o) => o._id);
      await this.orderModel
        .deleteMany({ _id: { $in: idsToDelete } })
        .exec();
    }

    // 4b. Upsert each incoming order item
    for (const orderUpdate of updateDto.orders) {
      const itemIndex = Number(orderUpdate.orderItemIndex);

      const existingItem: OrderDocument | null = await this.orderModel
        .findOne({ orderId, orderItemIndex: itemIndex })
        .exec();

      if (existingItem) {
        // Merge into existing item and save
        const merged = _.merge(
          _.cloneDeep(existingItem.toObject()),
          orderUpdate,
        );
        await this.orderModel
          .findByIdAndUpdate(existingItem._id, { $set: merged }, { new: true })
          .exec();
      } else {
        // Create a brand-new order item linked by orderId + customerId
        await this.orderModel.create({
          ...orderUpdate,
          orderId,
          customerId: mongoCustomerId,
          customerName: existingCustomer.customerName,
          orderDate: existingCustomer.orderDate,
          createdBy: existingCustomer.createdBy,
          orderItemIndex: itemIndex,
          status: orderUpdate.status ?? 'Pending',
        });
      }
    }

    // ── 6. Update customer properties ────────────────────────────────────────
    if (updateDto.customerInfo) {
      await this.updateCustomerProperties(
        existingCustomer,
        updateDto.customerInfo,
      );
    }

    // ── 7. Upsert payment record ─────────────────────────────────────────────
    let paymentResult: any = null;
    if (updateDto.payments) {
      const existingPayment: PaymentDocument | null =
        await this.paymentModel.findOne({ orderId }).exec();

      if (existingPayment) {
        const mergedPayment = _.merge(
          _.cloneDeep(existingPayment.toObject()),
          updateDto.payments,
        );
        paymentResult = await this.paymentModel
          .findOneAndUpdate(
            { orderId },
            { $set: mergedPayment },
            { new: true },
          )
          .exec();
      } else {
        paymentResult = await this.paymentModel.create({
          ...updateDto.payments,
          orderId,
          customerId: mongoCustomerId,
        });
      }
    }

    // ── 8. Return updated state ──────────────────────────────────────────────
    const updatedOrders = await this.orderModel
      .find({ orderId })
      .sort({ orderItemIndex: 1 })
      .exec();

    return {
      message: 'Order updated successfully',
      orders: updatedOrders,
      payment: paymentResult,
    };
  }

  // ── Private helper ─────────────────────────────────────────────────────────
  private async updateCustomerProperties(
    customer: CustomerDocument,
    updateDto: any,
  ): Promise<void> {
    const fieldsToUpdate = [
      'customerName',
      'contactNumber',
      'emailAddress',
      'shippingAddress',
      'districtName',
      'totalAdvance',
      'grandTotal',
      'sourceOfOrder',
      'customerDateOfBirth',
    ];

    let changed = false;
    for (const field of fieldsToUpdate) {
      if (updateDto[field] !== undefined) {
        (customer as any)[field] = updateDto[field];
        changed = true;
      }
    }

    if (changed) {
      await customer.save();
    }
  }
}
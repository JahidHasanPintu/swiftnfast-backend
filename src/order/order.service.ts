import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCustomerDto } from './dtos/createCustomer.dto';
import { CreateOrderDto } from './dtos/createOrders.dto';
import { CreatePaymentDto } from './dtos/createPayment.dto';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { CustomerDocument } from './interfaces/customer.interface';
import { OrderDocument } from './interfaces/order.interface';
import { PaymentDocument } from './interfaces/payment.interface';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';
import * as mongoose from 'mongoose';
import { normalizePhone } from 'src/utils/phone.util';
import {
  buildCustomerDedupPipeline,
  extractDedupResult,
} from './customer/customer.aggregation';
import {
  buildOrderGroupingStages,
  buildDistinctOrderCountStages,
} from './order.aggregations';
import { NotificationService } from 'src/storefront/notifications/notification.service';
import { generateImageUrl } from 'src/storefront/utils/image-url.util';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel('Customer') private customerModel: Model<CustomerDocument>,
    @InjectModel('Orders') private orderModel: Model<OrderDocument>,
    @InjectModel('Payments') private paymentModel: Model<PaymentDocument>,
    @InjectModel('Purchases') private purchaseModel: Model<any>,
    @InjectConnection() private readonly connection: Connection,
    private readonly notificationService: NotificationService,
  ) {}

  generateUniqueOrderId(): string {
    const randomDigits = Math.floor(1000 + Math.random() * 9000); // Generates a random 4-digit number
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    // const uniqueId = `ORD-${randomDigits}${year}${month}${day}`;
    const uniqueId = `ORD-${day}${month}${year}${randomDigits}`;
    return uniqueId;
  }

  // Create orders
  async createOrder(
    customerInfo: CreateCustomerDto,
    orders: CreateOrderDto[],
    payments: CreatePaymentDto,
  ) {
    const session = await this.customerModel.db.startSession();
    session.startTransaction();

    try {
      // Reuse the existing customer for this phone number instead of creating
      // a duplicate on every order (root cause of the double-customer bug).
      const customer = await this.findOrCreateCustomer(customerInfo, session);
      const customerObjectId = customer._id;

      // Create a unique order ID for each order
      const orderId = this.generateUniqueOrderId();

      // Process and save orders, ensuring all fields are included
      const orderDocs = orders.map((order, index) => ({
        orderId, // Unique order ID for this order
        customer: customerObjectId, // Ref for populate('customer')
        customerId: customerObjectId, // Use ObjectId for customerId
        customerName: customer.customerName,
        orderDate: customerInfo.orderDate,
        createdBy: customerInfo.createdBy,
        orderItemIndex: index + 1, // Add the orderItemIndex

        // Ensure these fields are included
        productUrl: order.productUrl,
        quantity: order.quantity,
        couponCode: order.couponCode,
        prodDesc: order.prodDesc, // Product Description
        color: order.color,
        size: order.size,
        origin: order.origin,
        uniPrice: order.uniPrice, // Unit Price
        totalPrice: order.totalPrice,
        advancePayment: order.advancePayment,
        remainingAmount: order.remainingAmount,
        orderNotes: order.orderNotes,
        websiteUrl: order.websiteUrl, // Website URL
        status: 'Pending', // Default to Pending if not provided
      }));

      await this.orderModel.insertMany(orderDocs, { session });

      // Process and save payment
      const paymentDoc = new this.paymentModel({
        ...payments,
        orderId, // Use the same orderId for the payment
        customerId: customerObjectId, // Link payment to customer
      });

      await paymentDoc.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return {
        message: 'Orders created successfully',
        orders: orderDocs,
        payment: paymentDoc,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw new BadRequestException(`Error creating order: ${error.message}`);
    }
  }

  /**
   * Finds the customer for a contact number, or creates one if none exists.
   * Returns the existing customer instead of inserting a duplicate.
   * Optional info (name/address/email) is refreshed on the canonical record.
   */
  private async findOrCreateCustomer(
    customerInfo: CreateCustomerDto,
    session?: mongoose.ClientSession,
  ): Promise<CustomerDocument> {
    const rawPhone = customerInfo.contactNumber;
    const normalizedPhone = normalizePhone(rawPhone);

    let existing: CustomerDocument | null = null;

    if (rawPhone) {
      existing = await this.customerModel
        .findOne({ contactNumber: rawPhone })
        .session(session);
    }

    // Fallback for the same number written in a different format
    // (e.g. '8801...' instead of '01...').
    if (!existing && normalizedPhone && normalizedPhone !== rawPhone) {
      existing = await this.customerModel
        .findOne({ contactNumber: normalizedPhone })
        .session(session);
    }

    if (existing) {
      const changed: Partial<CustomerDocument> = {};
      if (
        customerInfo.customerName &&
        customerInfo.customerName !== existing.customerName
      ) {
        changed.customerName = customerInfo.customerName;
      }
      if (
        customerInfo.emailAddress &&
        customerInfo.emailAddress !== existing.emailAddress
      ) {
        changed.emailAddress = customerInfo.emailAddress;
      }
      if (
        customerInfo.shippingAddress &&
        customerInfo.shippingAddress !== existing.shippingAddress
      ) {
        changed.shippingAddress = customerInfo.shippingAddress;
      }
      if (
        customerInfo.districtName &&
        customerInfo.districtName !== existing.districtName
      ) {
        changed.districtName = customerInfo.districtName;
      }
      if (
        customerInfo.sourceOfOrder &&
        customerInfo.sourceOfOrder !== existing.sourceOfOrder
      ) {
        changed.sourceOfOrder = customerInfo.sourceOfOrder;
      }
      if (Object.keys(changed).length > 0) {
        Object.assign(existing, changed);
        await existing.save({ session });
      }
      return existing;
    }

    const newCustomer = new this.customerModel({
      ...customerInfo,
      _id: new mongoose.Types.ObjectId(),
    });
    await newCustomer.save({ session });
    return newCustomer;
  }

  /**
   * Public convenience wrapper for storefront/merged flows: dedupe-or-create a
   * customer by phone (same canonical logic as the admin create-order flow).
   */
  async findOrCreateCustomerByContact(
    contactNumber: string,
    opts: {
      name?: string;
      email?: string;
      shippingAddress?: string;
      districtName?: string;
      sourceOfOrder?: string;
    } = {},
    session?: mongoose.ClientSession,
  ): Promise<CustomerDocument> {
    const info: CreateCustomerDto = {
      customerId: `SF-${Date.now()}-${Math.floor(Math.random() * 900) + 100}`,
      customerName: opts.name || contactNumber || 'Guest',
      contactNumber,
      emailAddress: opts.email,
      shippingAddress: opts.shippingAddress || 'N/A',
      grandTotal: 0,
      totalAdvance: 0,
      sourceOfOrder: opts.sourceOfOrder || 'storefront',
      districtName: opts.districtName || 'N/A',
      customerJoiningDate: '',
      customerDateOfBirth: '',
      orderDate: '',
    } as unknown as CreateCustomerDto;
    return this.findOrCreateCustomer(info, session);
  }

  /**
   * Finds the customer record that matches BOTH the email and the phone
   * number. Used when a shopper checks out without being signed in: if the
   * details belong to an existing customer, the order is linked to that
   * account so it shows up in their order history.
   *
   * Phone numbers are compared in their canonical form (and the common
   * +88/88 variants) because the same person may type them differently.
   */
  async findAccountByEmailAndPhone(
    email?: string,
    phone?: string,
  ): Promise<CustomerDocument | null> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedEmail || !normalizedPhone) return null;

    // Email is unique on the customer collection, so narrow by it first and
    // then compare the phone in canonical form. This tolerates stored numbers
    // written with spaces, +88, or 880 prefixes.
    const candidates = await this.customerModel
      .find({
        isDeleted: { $ne: true },
        $expr: { $eq: [{ $toLower: '$emailAddress' }, normalizedEmail] },
      })
      .limit(5)
      .exec();

    const matches = candidates.filter(
      (c) =>
        normalizePhone(c.contactNumber) === normalizedPhone ||
        normalizePhone(c.phone) === normalizedPhone,
    );

    // Older data can contain duplicate customer rows for the same email.
    // Prefer the one that is actually a login account (has a password or is
    // verified) so the order lands in the account the shopper can sign in to.
    return (
      matches.find((c) => !!c.password || c.isVerified === true) ||
      matches[0] ||
      null
    );
  }

  generateStorefrontOrderNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 900) + 100;
    return `ORD-${timestamp}-${random}`;
  }

  async getAllCustomers(
    page = 1,
    pageSize = 10,
  ): Promise<CommonPaginationResponse<any>> {
    const result = await this.customerModel.aggregate(
      buildCustomerDedupPipeline({}, page, pageSize),
    );
    const { customers, totalItems } = extractDedupResult(result);

    return {
      data: customers,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  // new one

  async getAllOrders(
    page = 1,
    pageSize = 10,
    status?: string,
  ): Promise<CommonPaginationResponse<any>> {
    const skip = (page - 1) * pageSize;
    const matchQuery: any = {};
    if (status) {
      matchQuery['status'] = status;
    }

    const [result] = await this.orderModel.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          data: [
            ...buildOrderGroupingStages(),
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: pageSize },
          ],
          totalCount: buildDistinctOrderCountStages(),
        },
      },
    ]);

    const totalItems = result?.totalCount?.[0]?.count ?? 0;

    return {
      data: result?.data ?? [],
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getOrderItem(
    orderId: string,
    orderItemIndex: number,
  ): Promise<OrderDocument> {
    const order = await this.orderModel
      .findOne({ orderId, orderItemIndex: orderItemIndex }) // Specify the field name explicitly
      .exec();

    if (!order) {
      throw new NotFoundException(
        `Order with orderId ${orderId} and orderItemIndex ${orderItemIndex} not found.`,
      );
    }
    return order;
  }

  // updating orders collection with order id when purchase is done
  async updateOrderStatus(
    orderId: string,
    orderItemIndex: number,
    newStatus: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel
      .findOneAndUpdate(
        { orderId, orderItemIndex },
        {
          $set: {
            status: newStatus,
            isPurchased: newStatus === 'Purchased',
          },
        },
        { new: true },
      )
      .exec();

    if (!order) {
      throw new NotFoundException(
        `Order with orderId ${orderId} and orderItemIndex ${orderItemIndex} not found.`,
      );
    }

    // When a line is marked purchased, attach the purchase image (uploaded in
    // the admin Purchase modal) so the customer email shows what was bought.
    let productImageUrl: string | undefined;
    if (newStatus === 'Purchased') {
      const purchase = await this.purchaseModel
        .findOne({ orderId, orderItemIndex })
        .select('confirmationImage')
        .lean()
        .exec();
      productImageUrl =
        generateImageUrl(
          'screenshots',
          (purchase as any)?.confirmationImage ||
            (order as any).productImageUrl ||
            (order as any).ssImageUrl,
        ) || undefined;
    }

    // Send notification
    this.notificationService.notifyStatusChange(newStatus, {
      customerName: (order as any).customerName,
      customerEmail: (order as any).guestEmail,
      customerPhone: order.contactNo,
      orderNumber: (order as any).orderNumber || order.orderId,
      status: newStatus,
      totalPrice: order.totalPrice,
      productName: (order as any).prodDesc,
      productImageUrl,
    }).catch(() => {});

    return order;
  }

  // Update every line of an order so the order-level status shown to the
  // customer (and used by the track-order stepper) changes as one unit.
  async updateOrderStatusByOrderId(
    orderId: string,
    newStatus: string,
  ): Promise<void> {
    const orders = await this.orderModel.find({ orderId }).exec();
    if (!orders.length) {
      throw new NotFoundException(`Order with orderId ${orderId} not found.`);
    }

    await this.orderModel.updateMany(
      { orderId },
      {
        $set: {
          status: newStatus,
          isPurchased: newStatus === 'Purchased',
        },
      },
    );

    const first = orders[0];
    const firstItemIndex = (first as any).orderItemIndex;
    let productImageUrl: string | undefined;
    if (newStatus === 'Purchased' && firstItemIndex != null) {
      const purchase = await this.purchaseModel
        .findOne({
          orderId,
          orderItemIndex: firstItemIndex,
        })
        .select('confirmationImage')
        .lean()
        .exec();
      productImageUrl =
        generateImageUrl(
          'screenshots',
          (purchase as any)?.confirmationImage ||
            (first as any).productImageUrl ||
            (first as any).ssImageUrl,
        ) || undefined;
    }
    this.notificationService
      .notifyStatusChange(newStatus, {
        customerName: (first as any).customerName,
        customerEmail: (first as any).guestEmail,
        customerPhone: first.contactNo,
        orderNumber: (first as any).orderNumber || first.orderId,
        status: newStatus,
        totalPrice: first.totalPrice,
        productName: (first as any).prodDesc,
        productImageUrl,
      })
      .catch(() => {});
  }

  // bulk cancel of orders

  async updateBulkStatusOrder(orderId: string): Promise<void> {
    // Fetch all orders before updating so we can notify customers
    const orders = await this.orderModel.find({ orderId }).exec();

    await this.orderModel.updateMany(
      { orderId },
      { status: 'Cancelled', isPurchased: false },
    );

    // Send cancellation notification to each customer
    for (const order of orders) {
      this.notificationService.notifyStatusChange('Cancelled', {
        customerName: (order as any).customerName,
        customerEmail: (order as any).guestEmail,
        customerPhone: order.contactNo,
        orderNumber: (order as any).orderNumber || order.orderId,
        status: 'Cancelled',
        totalPrice: order.totalPrice,
        productName: (order as any).prodDesc,
      }).catch(() => {});
    }
  }

  // get customer with order id

  async getCustomerByOrderId(orderId: string): Promise<CustomerDocument[]> {
    const customer = await this.customerModel.find({ orderId }).exec();
    return customer;
  }

  async getCustomerByOrderIdToFetch(
    orderId: string,
  ): Promise<CustomerDocument | null> {
    const order = await this.orderModel.findOne({ orderId }).exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    let customer: CustomerDocument | null = null;

    if (order.customerId) {
      customer = await this.customerModel
        .findOne({ _id: order.customerId })
        .exec();
    }

    if (!customer) {
      customer = await this.customerModel.findOne({ orderId }).exec();
    }

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // The customer record is shared across all of their orders, so its
    // orderDate/createdBy may belong to a different order. Overlay the values
    // from the order being viewed.
    return {
      ...customer.toObject(),
      orderId: order.orderId,
      orderDate: order.orderDate ?? customer.orderDate,
      createdBy: order.createdBy ?? customer.createdBy,
    } as CustomerDocument;
  }

  // get customer with customer id
  async getCustomerByCustomerId(
    customerId: string,
  ): Promise<CustomerDocument[]> {
    const customer = await this.customerModel.find({ customerId }).exec();
    return customer;
  }

  async getPaymentsByOrderId(orderId: string): Promise<PaymentDocument[]> {
    return this.paymentModel.find({ orderId }).exec();
  }

  // new method

  async getCustomerByName(customerName: string): Promise<CustomerDocument[]> {
    return await this.customerModel.find({ customerName }).exec();
  }

  async getCustomerByContactNumber(
    contactNumber: string,
  ): Promise<CustomerDocument> {
    return await this.customerModel.findOne({ contactNumber }).exec();
  }

  async deleteOrderItem(
    orderId: string,
    orderItemIndex: number,
  ): Promise<void> {
    const session = await this.connection.startSession(); // Start MongoDB transaction
    session.startTransaction();

    try {
      // Step 1: Find the order item to be deleted
      const order = await this.orderModel
        .findOne({ orderId, orderItemIndex })
        .session(session);
      if (!order) {
        throw new NotFoundException('Order item not found');
      }

      // Step 2: Retrieve order details for recalculation
      const { customerId, totalPrice, advancePayment } = order;

      // Step 3: Delete the order item
      const result = await this.orderModel
        .deleteOne({ orderId, orderItemIndex })
        .session(session);
      if (result.deletedCount === 0) {
        throw new NotFoundException('Order item not found');
      }

      // Step 4: Find the customer and update their totals
      const customer = await this.customerModel
        .findById(customerId)
        .session(session);
      if (!customer) {
        throw new NotFoundException(`Customer with ID ${customerId} not found`);
      }

      customer.grandTotal -= totalPrice;
      customer.totalAdvance -= advancePayment;

      // Ensure totals don't go below zero
      customer.grandTotal = Math.max(0, customer.grandTotal);
      customer.totalAdvance = Math.max(0, customer.totalAdvance);

      await customer.save({ session }); // Save updated customer

      // Commit the transaction
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction(); // Rollback on error
      throw error;
    } finally {
      session.endSession(); // End session
    }
  }

  async getUniqueCustomers(): Promise<CustomerDocument[]> {
    const uniqueCustomers = await this.customerModel.aggregate([
      {
        $group: {
          _id: {
            customerName: '$customerName',
            contactNumber: '$contactNumber',
          },
          customerId: { $first: '$customerId' },
          orderId: { $first: '$orderId' },
          customerName: { $first: '$customerName' },
          contactNumber: { $first: '$contactNumber' },
          emailAddress: { $first: '$emailAddress' },
          shippingAddress: { $first: '$shippingAddress' },
          districtName: { $first: '$districtName' },
          totalAdvance: { $first: '$totalAdvance' },
          grandTotal: { $first: '$grandTotal' },
          sourceOfOrder: { $first: '$sourceOfOrder' },
          customerDateOfBirth: { $first: '$customerDateOfBirth' },
          customerJoiningDate: { $first: '$customerJoiningDate' },
          orderDate: { $first: '$orderDate' },
          createdBy: { $first: '$createdBy' },
        },
      },
    ]);
    return uniqueCustomers;
  }

  async deleteOrdersByOrderId(
    orderId: string,
  ): Promise<{ deletedCount: number }> {
    return this.orderModel.deleteMany({ orderId }).exec();
  }

  calculateInvoiceTotals(orders: OrderDocument[]): {
    grandTotal: number;
    totalAdvance: number;
    totalOutstanding: number;
  } {
    let grandTotal = 0;
    let totalAdvance = 0;

    orders.forEach((order) => {
      grandTotal += order.totalPrice || order.uniPrice * order.quantity; // Fallback if totalPrice isn’t set
      totalAdvance += order.advancePayment || 0; // Default to 0 if not provided
    });

    const totalOutstanding = grandTotal - totalAdvance;
    return { grandTotal, totalAdvance, totalOutstanding };
  }

  async getOrdersByOrderId(orderId: string): Promise<OrderDocument[]> {
    return this.orderModel
      .find({ orderId })
      .populate('customer') // Populate customer details if available
      .exec();
  }
}

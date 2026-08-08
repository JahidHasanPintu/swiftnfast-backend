import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let customerModel: any;
  let orderModel: any;
  let paymentModel: any;
  let connection: any;

  const session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  beforeEach(async () => {
    customerModel = jest.fn();
    orderModel = { insertMany: jest.fn(), aggregate: jest.fn() };
    paymentModel = jest.fn();
    connection = { startSession: jest.fn() };

    customerModel.db = { startSession: jest.fn().mockResolvedValue(session) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getModelToken('Customer'), useValue: customerModel },
        { provide: getModelToken('Orders'), useValue: orderModel },
        { provide: getModelToken('Payments'), useValue: paymentModel },
        { provide: getConnectionToken(), useValue: connection },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createOrder', () => {
    const customerInfo: any = {
      contactNumber: '01811483622',
      customerName: 'Mamun',
      orderDate: new Date('2026-08-01'),
      createdBy: 'tester',
    };
    const orders: any[] = [
      {
        productUrl: 'https://x.com/a',
        quantity: 1,
        prodDesc: 'Dress',
        origin: 'USA',
        uniPrice: 100,
        totalPrice: 100,
        remainingAmount: 50,
      },
      {
        productUrl: 'https://x.com/b',
        quantity: 2,
        prodDesc: 'Shoes',
        origin: 'USA',
        uniPrice: 50,
        totalPrice: 100,
        remainingAmount: 100,
      },
    ];
    const payments: any = { advance: 50 };

    it('reuses an existing customer for the phone (no duplicate customer doc)', async () => {
      const existing = {
        _id: new Types.ObjectId(),
        customerName: 'Mamun',
        emailAddress: undefined,
        shippingAddress: undefined,
        districtName: undefined,
        save: jest.fn(),
      };
      const findOneChain = {
        session: jest.fn().mockResolvedValue(existing),
      };
      customerModel.findOne = jest.fn().mockReturnValue(findOneChain);

      const savedOrders = orders.map((o, i) => ({
        ...o,
        orderId: 'ORD-X',
        orderItemIndex: i + 1,
      }));
      orderModel.insertMany.mockResolvedValue(savedOrders);

      const paymentDoc = {
        _id: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue({}),
      };
      paymentModel.mockReturnValue(paymentDoc);

      const result = await service.createOrder(customerInfo, orders, payments);

      expect(customerModel.findOne).toHaveBeenCalledWith({
        contactNumber: '01811483622',
      });
      // find-or-reuse: the existing customer is NOT saved as a new doc.
      expect(existing.save).not.toHaveBeenCalled();
      expect(orderModel.insertMany).toHaveBeenCalledTimes(1);
      expect(result.orders).toHaveLength(2);
      // Order items reference the reused customer's ObjectId.
      expect(result.orders[0].customerId.toString()).toBe(
        existing._id.toString(),
      );
      expect(paymentDoc.save).toHaveBeenCalledWith({ session });
      expect(session.commitTransaction).toHaveBeenCalled();
      expect(session.abortTransaction).not.toHaveBeenCalled();
    });

    it('creates a new customer when none exists for the phone', async () => {
      const findOneChain = { session: jest.fn().mockResolvedValue(null) };
      customerModel.findOne = jest.fn().mockReturnValue(findOneChain);

      const newCustomer = {
        _id: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue({}),
      };
      customerModel.mockReturnValue(newCustomer);
      orderModel.insertMany.mockResolvedValue(orders);
      const paymentDoc = { save: jest.fn().mockResolvedValue({}) };
      paymentModel.mockReturnValue(paymentDoc);

      const result = await service.createOrder(customerInfo, orders, payments);

      // Exactly one customer document is created.
      expect(customerModel).toHaveBeenCalledTimes(1);
      expect(newCustomer.save).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('Orders created successfully');
    });

    it('aborts the transaction and rethrows on error', async () => {
      customerModel.db.startSession.mockResolvedValue(session);
      customerModel.findOne = jest.fn().mockReturnValue({
        session: jest.fn().mockRejectedValue(new Error('boom')),
      });

      await expect(
        service.createOrder(customerInfo, orders, payments),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(session.abortTransaction).toHaveBeenCalled();
    });
  });

  describe('getAllOrders', () => {
    it('uses the distinct-order count for truthful pagination meta', async () => {
      orderModel.aggregate.mockResolvedValue([
        { data: [{ orderId: 'ORD-1' }], totalCount: [{ count: 7 }] },
      ]);

      const result = await service.getAllOrders(1, 10);

      expect(result.meta.totalItems).toBe(7);
      expect(result.meta.totalPages).toBe(1);
      expect(result.data).toEqual([{ orderId: 'ORD-1' }]);
    });

    it('passes a status filter into the $match stage', async () => {
      orderModel.aggregate.mockResolvedValue([
        { data: [], totalCount: [{ count: 0 }] },
      ]);

      await service.getAllOrders(1, 10, 'Pending');

      const match = orderModel.aggregate.mock.calls[0][0][0];
      expect(match.$match).toEqual({ status: 'Pending' });
    });

    it('returns zero total when the facet returns nothing', async () => {
      orderModel.aggregate.mockResolvedValue([]);
      const result = await service.getAllOrders(1, 10);
      expect(result.meta.totalItems).toBe(0);
      expect(result.data).toEqual([]);
    });
  });

  describe('getAllCustomers', () => {
    it('returns deduplicated customers and distinct total', async () => {
      customerModel.aggregate = jest
        .fn()
        .mockResolvedValue([
          { grouped: [{ customerName: 'Mamun' }], total: [{ n: 3 }] },
        ]);

      const result = await service.getAllCustomers(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.totalItems).toBe(3);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('updateOrderStatus', () => {
    const order = {
      _id: new Types.ObjectId(),
      orderId: 'ORD-1',
      orderItemIndex: 1,
      status: 'Purchased',
      isPurchased: true,
    };

    function mockFindOneAndUpdate(result: any) {
      orderModel.findOneAndUpdate = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(result) });
    }

    it('sets isPurchased true when status becomes Purchased', async () => {
      mockFindOneAndUpdate(order);

      const out = await service.updateOrderStatus('ORD-1', 1, 'Purchased');

      const [query, update] = orderModel.findOneAndUpdate.mock.calls[0];
      expect(query).toEqual({ orderId: 'ORD-1', orderItemIndex: 1 });
      expect(update.$set).toEqual({ status: 'Purchased', isPurchased: true });
      expect(out.isPurchased).toBe(true);
    });

    it('sets isPurchased false for any other status', async () => {
      mockFindOneAndUpdate({ ...order, status: 'Shipped', isPurchased: false });

      await service.updateOrderStatus('ORD-1', 1, 'Shipped');

      const [, update] = orderModel.findOneAndUpdate.mock.calls[0];
      expect(update.$set).toEqual({ status: 'Shipped', isPurchased: false });
    });

    it('throws NotFoundException when the order does not exist', async () => {
      mockFindOneAndUpdate(null);

      await expect(
        service.updateOrderStatus('ORD-MISSING', 1, 'Pending'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

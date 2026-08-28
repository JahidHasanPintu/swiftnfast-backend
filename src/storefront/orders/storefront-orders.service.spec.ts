import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { StorefrontOrdersService } from './storefront-orders.service';
import { OrderService } from '../../order/order.service';
import { CartService } from '../cart/cart.service';

describe('StorefrontOrdersService', () => {
  let service: StorefrontOrdersService;

  const mockExec = jest.fn().mockResolvedValue([]);
  const mockOrderModel = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue({ exec: mockExec }),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    aggregate: jest.fn().mockResolvedValue([]),
  };

  const mockProductModel = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(null),
  };

  const mockUserModel = {
    findOne: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(null),
  };

  const mockPaymentModel = {
    find: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };

  const mockOrderService = {
    findOrCreateCustomerByContact: jest.fn().mockResolvedValue({
      _id: 'cust123',
      customerName: 'Test User',
      contactNumber: '01700000000',
    }),
    generateStorefrontOrderNumber: jest.fn().mockReturnValue('SF-20260101-001'),
  };

  const mockCartService = {
    getRawCart: jest.fn().mockResolvedValue({
      _id: 'cart123',
      items: [],
      guestContact: '01700000000',
    }),
    deleteById: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockOrderModel.limit.mockReturnValue({ exec: mockExec.mockResolvedValue([]) });
    mockOrderModel.exec.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorefrontOrdersService,
        { provide: getModelToken('Orders'), useValue: mockOrderModel },
        { provide: getModelToken('Product'), useValue: mockProductModel },
        { provide: getModelToken('Pfu2User'), useValue: mockUserModel },
        { provide: getModelToken('Pfu2Payment'), useValue: mockPaymentModel },
        { provide: OrderService, useValue: mockOrderService },
        { provide: CartService, useValue: mockCartService },
      ],
    }).compile();

    service = module.get<StorefrontOrdersService>(StorefrontOrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPreStockOrder', () => {
    it('should throw BadRequestException for missing cartId', async () => {
      await expect(
        service.createPreStockOrder({ cartId: '' }),
      ).rejects.toThrow();
    });
  });

  describe('getMyOrders', () => {
    it('should return orders for a user', async () => {
      const result = await service.getMyOrders('user123', { page: 1, limit: 10 });
      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
    });
  });
});

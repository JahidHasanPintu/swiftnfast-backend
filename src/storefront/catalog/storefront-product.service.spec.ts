import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { StorefrontProductService } from './storefront-product.service';

describe('StorefrontProductService', () => {
  let service: StorefrontProductService;

  const mockExec = jest.fn().mockResolvedValue([]);
  const mockProductModel = {
    find: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue({ exec: mockExec }),
    lean: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(null),
    distinct: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
  };

  const mockCategoryModel = {
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockProductModel.limit.mockReturnValue({ exec: mockExec.mockResolvedValue([]) });
    mockProductModel.exec.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorefrontProductService,
        { provide: getModelToken('Product'), useValue: mockProductModel },
        { provide: getModelToken('Category'), useValue: mockCategoryModel },
      ],
    }).compile();

    service = module.get<StorefrontProductService>(StorefrontProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      const result = await service.findAll({});
      expect(result).toHaveProperty('products');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('totalPages');
    });

    it('should filter by category', async () => {
      const result = await service.findAll({ category: 'cat123' });
      expect(result).toHaveProperty('products');
    });

    it('should filter by brand', async () => {
      const result = await service.findAll({ brand: 'Nike' });
      expect(result).toHaveProperty('products');
    });
  });

  describe('findBySlug', () => {
    it('should throw NotFoundException for missing product', async () => {
      mockProductModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findBySlug('nonexistent')).rejects.toThrow();
    });
  });

  describe('findUniqueBrands', () => {
    it('should return unique brands', async () => {
      const result = await service.findUniqueBrands();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

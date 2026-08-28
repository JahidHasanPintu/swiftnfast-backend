import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BannerService } from './banner.service';

describe('BannerService', () => {
  let service: BannerService;

  const mockExec = jest.fn().mockResolvedValue([]);
  const mockBannerModel = {
    find: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue({ exec: mockExec }),
    countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockBannerModel.limit.mockReturnValue({ exec: mockExec.mockResolvedValue([]) });
    mockBannerModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BannerService,
        { provide: getModelToken('Banner'), useValue: mockBannerModel },
      ],
    }).compile();

    service = module.get<BannerService>(BannerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated banners', async () => {
      const result = await service.findAll({});
      expect(result).toHaveProperty('banners');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('totalPages');
    });
  });
});

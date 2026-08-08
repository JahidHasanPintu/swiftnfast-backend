import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ShipmentService } from './shipment.service';
import { TransactionsService } from '../transactions/transactions.service';

describe('ShipmentService', () => {
  let service: ShipmentService;
  let shipmentModel: any;
  let purchaseModel: any;
  let dropshipModel: any;
  let shippingAddressModel: any;

  beforeEach(async () => {
    shipmentModel = {};
    purchaseModel = {};
    dropshipModel = {};
    shippingAddressModel = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: getModelToken('Shipment'), useValue: shipmentModel },
        { provide: getModelToken('Purchases'), useValue: purchaseModel },
        { provide: getModelToken('DropShip'), useValue: dropshipModel },
        {
          provide: getModelToken('shipping-address'),
          useValue: shippingAddressModel,
        },
        { provide: TransactionsService, useValue: {} },
      ],
    }).compile();

    service = module.get<ShipmentService>(ShipmentService);
  });

  describe('getShipmentAnalytics', () => {
    const shipmentId = '6a579e0d79a213ab64968234';

    const shipment = {
      _id: shipmentId,
      name: 'S1',
      totalProducts: 3,
      totalWeightKg: 6,
      totalShippingCost: 1500,
      actualWeightChargePerKg: 250,
      customerWeightChargeTotal: 2000,
      weightChargeProfit: 500,
      totalGrossProfit: 340.4,
      totalNetProfit: 840.4,
      customsDuty: 0,
      otherExpenses: 0,
    };

    const purchases = [
      {
        customerId: 'c1',
        customerName: 'Mamun',
        productWeight: 2,
        productWeightCharge: 500,
        weightChargeProfit: 50,
        grossProfit: '৳240.40',
      },
      {
        customerId: 'c1',
        customerName: 'Mamun',
        productWeight: 3,
        productWeightCharge: 750,
        weightChargeProfit: 75,
        grossProfit: '৳100',
      },
      {
        customerId: 'c2',
        customerName: 'Tasnim',
        productWeight: 1,
        productWeightCharge: 250,
        weightChargeProfit: 25,
        grossProfit: '৳59.60',
      },
    ];

    beforeEach(() => {
      const chain2 = {
        populate: jest.fn().mockResolvedValue(shipment),
      };
      shipmentModel.findById = jest
        .fn()
        .mockReturnValue({ populate: jest.fn().mockReturnValue(chain2) });

      purchaseModel.find = jest
        .fn()
        .mockReturnValue({ select: jest.fn().mockResolvedValue(purchases) });
      purchaseModel.aggregate = jest
        .fn()
        .mockResolvedValue([{ _id: 'Purchased', count: 3 }]);
      purchaseModel.countDocuments = jest.fn().mockResolvedValue(1);
    });

    it('groups by customer and sums currency-string grossProfit correctly', async () => {
      const result = await service.getShipmentAnalytics(shipmentId);

      // Verified against real scratch data (shipment 6a579e0d...: gross 29462.38).
      expect(result.byCustomer).toHaveLength(2);

      const byId = Object.fromEntries(
        result.byCustomer.map((c: any) => [c._id, c]),
      );

      // "৳240.40" + "৳100" → 340.40 for Mamun.
      expect(byId.c1.grossProfit).toBeCloseTo(340.4, 2);
      expect(byId.c1.totalWeight).toBe(5);
      expect(byId.c1.productCount).toBe(2);
      expect(byId.c1.totalWeightCharge).toBe(1250);
      expect(byId.c1.weightChargeProfit).toBe(125);

      expect(byId.c2.grossProfit).toBeCloseTo(59.6, 2);
      expect(byId.c2.totalWeight).toBe(1);

      // Sorted by weight descending (Mamun 5kg before Tasnim 1kg).
      expect(result.byCustomer[0]._id).toBe('c1');
      expect(result.byCustomer[1]._id).toBe('c2');
    });

    it('parses negative or zero grossProfit without NaN', async () => {
      purchaseModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          {
            customerId: 'c1',
            customerName: 'Mamun',
            productWeight: 2,
            productWeightCharge: 500,
            weightChargeProfit: 0,
            grossProfit: '৳0',
          },
          {
            customerId: 'c1',
            customerName: 'Mamun',
            productWeight: 1,
            productWeightCharge: 250,
            weightChargeProfit: 0,
            grossProfit: 'invalid',
          },
        ]),
      });

      const result = await service.getShipmentAnalytics(shipmentId);

      expect(Number.isNaN(result.byCustomer[0].grossProfit)).toBe(false);
      expect(result.byCustomer[0].grossProfit).toBe(0);
      expect(result.byCustomer[0].productCount).toBe(2);
    });

    it('reports pendingWeightCount and status breakdown', async () => {
      const result = await service.getShipmentAnalytics(shipmentId);

      expect(purchaseModel.aggregate).toHaveBeenCalled();
      expect(purchaseModel.countDocuments).toHaveBeenCalledWith({
        shipmentId: new Types.ObjectId(shipmentId),
        productWeight: { $eq: 0 },
      });
      expect(result.pendingWeightCount).toBe(1);
      expect(result.byStatus).toEqual([{ _id: 'Purchased', count: 3 }]);
      expect(result.summary.totalNetProfit).toBe(840.4);
    });
  });
});

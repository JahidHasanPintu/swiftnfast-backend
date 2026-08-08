import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  SetShippingCostDto,
  LinkPurchaseToShipmentDto,
  BulkLinkPurchasesDto,
} from './dto/shipment.dto';
import { ShipmentStatus } from './schemas/shipment.schema';
import {
  ShipmentDocument,
  PurchaseDocument,
  ShippingAddressDocument,
} from './shipment.types';
import { DropShipDocument } from '../dropship/interfaces/dropship.interface';

@Injectable()
export class ShipmentService {
  constructor(
    @InjectModel('Shipment') private shipmentModel: Model<ShipmentDocument>,
    @InjectModel('Purchases') private purchaseModel: Model<PurchaseDocument>,
    @InjectModel('DropShip') private dropshipModel: Model<DropShipDocument>,
    @InjectModel('shipping-address')
    private shippingAddressModel: Model<ShippingAddressDocument>, // Inject your TransactionService / AccountsService here for auto expense creation // @Inject(forwardRef(() => TransactionsService)) // private transactionsService: TransactionsService,
  ) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────────

  async create(dto: CreateShipmentDto): Promise<ShipmentDocument> {
    // Validate and fetch agent info from ShippingAddress
    const agent = await this.shippingAddressModel.findById(
      dto.shippingAddressId,
    );
    if (!agent) {
      throw new NotFoundException(
        `Shipping address ${dto.shippingAddressId} not found`,
      );
    }

    // Derive country from origin
    const countryMap: Record<string, string> = {
      'United States': 'USA',
      'United Kingdom': 'UK',
      'United Arab Emirates': 'Dubai',
    };

    const shipment = new this.shipmentModel({
      ...dto,
      agentName: agent.source,
      origin: agent.origin,
      country: countryMap[agent.origin] ?? agent.origin,
      shipmentDate: new Date(dto.shipmentDate),
      expectedArrivalDate: dto.expectedArrivalDate
        ? new Date(dto.expectedArrivalDate)
        : undefined,
    });

    return shipment.save();
  }

  // ─── READ ──────────────────────────────────────────────────────────────────────

  async findAll(filters: {
    status?: string;
    country?: string;
    agentId?: string;
    page?: number;
    limit?: number;
  }) {
    const query: Record<string, any> = {};
    if (filters.status) query.status = filters.status;
    if (filters.country) query.country = filters.country;
    if (filters.agentId)
      query.shippingAddressId = new Types.ObjectId(filters.agentId);

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, filters.limit ?? 20);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.shipmentModel
        .find(query)
        .populate('shippingAddressId', 'source origin address weightCharge')
        .sort({ shipmentDate: -1 })
        .skip(skip)
        .limit(limit),
      this.shipmentModel.countDocuments(query),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<ShipmentDocument> {
    const shipment = await this.shipmentModel
      .findById(id)
      .populate('shippingAddressId', 'source origin address weightCharge')
      .populate('shippingExpenseTransactionId');

    if (!shipment) throw new NotFoundException(`Shipment ${id} not found`);
    return shipment;
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateShipmentDto): Promise<ShipmentDocument> {
    const shipment = await this.findOne(id);
    Object.assign(shipment, dto);
    if (dto.actualArrivalDate) {
      shipment.actualArrivalDate = new Date(dto.actualArrivalDate);
      if (shipment.status === ShipmentStatus.IN_TRANSIT) {
        shipment.status = ShipmentStatus.ARRIVED;
      }
    }
    return shipment.save();
  }

  // ─── LINK PURCHASE TO SHIPMENT ─────────────────────────────────────────────────

  async linkPurchase(
    shipmentId: string,
    dto: LinkPurchaseToShipmentDto,
  ): Promise<{ shipment: ShipmentDocument; purchase: PurchaseDocument }> {
    const shipment = await this.findOne(shipmentId);

    const purchase = await this.purchaseModel.findOne({
      orderId: dto.orderId,
      orderItemIndex: dto.orderItemIndex,
    });
    if (!purchase) {
      throw new NotFoundException(
        `Purchase ${dto.orderId}/${dto.orderItemIndex} not found`,
      );
    }

    // If this purchase was already in another shipment, subtract from that shipment
    if (purchase.shipmentId && purchase.shipmentId.toString() !== shipmentId) {
      await this.recalcShipmentTotals(purchase.shipmentId.toString());
    }

    // Update purchase with shipment link and weight info
    purchase.shipmentId = new Types.ObjectId(shipmentId);

    if (dto.productWeight !== undefined) {
      purchase.productWeight = dto.productWeight;
    }
    if (dto.weightChargePerKg !== undefined) {
      purchase.weightChargePerKg = dto.weightChargePerKg;
    }
    // Recalculate weight charge
    purchase.productWeightCharge = parseFloat(
      (purchase.productWeight * purchase.weightChargePerKg).toFixed(2),
    );

    // If shipment cost is already known, compute actualWeightChargePerKg profit
    if (shipment.actualWeightChargePerKg > 0) {
      purchase.actualWeightChargePerKg = shipment.actualWeightChargePerKg;
      purchase.weightChargeProfit = parseFloat(
        (
          (purchase.weightChargePerKg - shipment.actualWeightChargePerKg) *
          purchase.productWeight
        ).toFixed(2),
      );
    }

    // Status update
    if (purchase.productWeightCharge > 0 && purchase.status === 'Purchased') {
      purchase.status = 'Ready To Deliver';
    }

    await purchase.save();

    // Recalculate shipment totals
    await this.recalcShipmentTotals(shipmentId);

    const updatedShipment = await this.findOne(shipmentId);
    return { shipment: updatedShipment, purchase };
  }

  // ─── LINK DROP SHIP ORDER TO SHIPMENT ──────────────────────────────────────────

  async linkDropShip(
    shipmentId: string,
    dropshipId: string,
    dto?: { productWeight?: number; weightChargePerKg?: number },
  ): Promise<{ shipment: ShipmentDocument; dropship: DropShipDocument }> {
    const shipment = await this.findOne(shipmentId);

    const dropship = await this.dropshipModel.findOne({ dropshipId }).exec();
    if (!dropship) {
      throw new NotFoundException(`Drop ship order ${dropshipId} not found`);
    }

    // If already in another shipment, subtract from that shipment
    if (dropship.shipmentId && dropship.shipmentId.toString() !== shipmentId) {
      await this.recalcShipmentTotals(dropship.shipmentId.toString());
    }

    dropship.shipmentId = new Types.ObjectId(shipmentId);

    if (dto?.productWeight !== undefined) {
      dropship.productWeight = dto.productWeight;
    }
    if (dto?.weightChargePerKg !== undefined) {
      dropship.weightChargePerKg = dto.weightChargePerKg;
    }
    dropship.productWeightCharge = parseFloat(
      (dropship.productWeight * dropship.weightChargePerKg).toFixed(2),
    );

    // If shipment cost already known, compute profit
    if (shipment.actualWeightChargePerKg > 0) {
      dropship.actualWeightChargePerKg = shipment.actualWeightChargePerKg;
      dropship.weightChargeProfit = parseFloat(
        (
          (dropship.weightChargePerKg - shipment.actualWeightChargePerKg) *
          dropship.productWeight
        ).toFixed(2),
      );
    }

    if (dropship.productWeightCharge > 0 && dropship.status === 'Pending') {
      dropship.status = 'Ready To Deliver';
    }

    await dropship.save();

    await this.recalcShipmentTotals(shipmentId);

    const updatedShipment = await this.findOne(shipmentId);
    return { shipment: updatedShipment, dropship };
  }

  // ─── UNLINK DROP SHIP ──────────────────────────────────────────────────────────

  async unlinkDropShip(
    shipmentId: string,
    dropshipId: string,
  ): Promise<ShipmentDocument> {
    const dropship = await this.dropshipModel.findOne({
      dropshipId,
      shipmentId: new Types.ObjectId(shipmentId),
    });

    if (!dropship) {
      throw new NotFoundException(
        `Drop ship order ${dropshipId} not linked to this shipment`,
      );
    }

    dropship.shipmentId = undefined;
    await dropship.save();

    await this.recalcShipmentTotals(shipmentId);
    return this.findOne(shipmentId);
  }

  // ─── BULK LINK PURCHASES ───────────────────────────────────────────────────────

  async bulkLinkPurchases(
    shipmentId: string,
    dto: BulkLinkPurchasesDto,
  ): Promise<{
    shipment: ShipmentDocument;
    linkedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let linkedCount = 0;

    for (const p of dto.purchases) {
      try {
        await this.linkPurchase(shipmentId, p);
        linkedCount++;
      } catch (err: any) {
        errors.push(`${p.orderId}/${p.orderItemIndex}: ${err.message}`);
      }
    }

    const shipment = await this.findOne(shipmentId);
    return { shipment, linkedCount, errors };
  }

  // ─── UNLINK PURCHASE FROM SHIPMENT ────────────────────────────────────────────

  async unlinkPurchase(
    shipmentId: string,
    orderId: string,
    orderItemIndex: number,
  ): Promise<ShipmentDocument> {
    const purchase = await this.purchaseModel.findOne({
      orderId,
      orderItemIndex,
      shipmentId: new Types.ObjectId(shipmentId),
    });

    if (!purchase) {
      throw new NotFoundException(
        `Purchase ${orderId}/${orderItemIndex} not linked to this shipment`,
      );
    }

    purchase.shipmentId = undefined;
    await purchase.save();

    await this.recalcShipmentTotals(shipmentId);
    return this.findOne(shipmentId);
  }

  // ─── SET SHIPPING COST (KEY BUSINESS EVENT) ───────────────────────────────────
  /**
   * Called once the agent invoice arrives.
   * 1. Sets totalShippingCost
   * 2. Calculates actualWeightChargePerKg = cost / totalWeight
   * 3. Pushes actualWeightChargePerKg & weightChargeProfit to every linked purchase
   * 4. Creates an expense transaction in Accounts module
   * 5. Recalculates shipment profit figures
   */
  async setShippingCost(
    shipmentId: string,
    dto: SetShippingCostDto,
  ): Promise<ShipmentDocument> {
    const shipment = await this.findOne(shipmentId);

    if (shipment.totalWeightKg === 0) {
      throw new BadRequestException(
        'Cannot set shipping cost before any purchases are linked (total weight is 0)',
      );
    }

    shipment.totalShippingCost = dto.totalShippingCost;
    shipment.actualWeightChargePerKg = parseFloat(
      (dto.totalShippingCost / shipment.totalWeightKg).toFixed(2),
    );

    // Push actual rate to all linked purchases → individual weightChargeProfit
    await this.pushActualRateToPurchases(
      shipmentId,
      shipment.actualWeightChargePerKg,
    );

    // Recalc totals (customerWeightChargeTotal, weightChargeProfit, etc.)
    await this.recalcShipmentTotals(shipmentId);

    // ── Create Expense Transaction in Accounts Module ────────────────────────────
    // Uncomment and wire up once TransactionsService is available:
    //
    // const expenseTx = await this.transactionsService.addExpense({
    //   accountId: dto.accountId,
    //   amount: dto.totalShippingCost,
    //   category: 'Freight & Logistics',
    //   subCategory: 'International Shipping',
    //   description: `Shipping cost for ${shipment.shipmentName} — Agent: ${shipment.agentName}`,
    //   date: new Date().toISOString(),
    //   reference: shipment.shipmentName,
    //   tags: ['shipment', shipment.country.toLowerCase(), 'agent-payment'],
    // });
    // shipment.shippingExpenseTransactionId = expenseTx._id;
    // await shipment.save();

    // Return fresh data
    return this.findOne(shipmentId);
  }

  // ─── GET PURCHASES FOR SHIPMENT ────────────────────────────────────────────────

  async getLinkedPurchases(shipmentId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
      this.purchaseModel
        .find({ shipmentId: new Types.ObjectId(shipmentId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.purchaseModel.countDocuments({
        shipmentId: new Types.ObjectId(shipmentId),
      }),
    ]);

    return {
      data: purchases,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── GET DROP SHIP ORDERS FOR SHIPMENT ─────────────────────────────────────────

  async getLinkedDropShipOrders(shipmentId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.dropshipModel
        .find({ shipmentId: new Types.ObjectId(shipmentId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.dropshipModel.countDocuments({
        shipmentId: new Types.ObjectId(shipmentId),
      }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── ANALYTICS FOR A SHIPMENT ──────────────────────────────────────────────────

  async getShipmentAnalytics(shipmentId: string) {
    const shipment = await this.findOne(shipmentId);

    // Break down by customer
    const byCustomer = await this.purchaseModel.aggregate([
      { $match: { shipmentId: new Types.ObjectId(shipmentId) } },
      {
        $group: {
          _id: '$customerId',
          customerName: { $first: '$customerName' },
          totalWeight: { $sum: '$productWeight' },
          totalWeightCharge: { $sum: '$productWeightCharge' },
          weightChargeProfit: { $sum: '$weightChargeProfit' },
          grossProfit: {
            $sum: {
              $toDouble: {
                $replaceAll: {
                  input: { $ifNull: ['$grossProfit', '0'] },
                  find: /[^\d.-]/,
                  replacement: '',
                },
              },
            },
          },
          productCount: { $sum: 1 },
        },
      },
      { $sort: { totalWeight: -1 } },
    ]);

    // Status breakdown
    const byStatus = await this.purchaseModel.aggregate([
      { $match: { shipmentId: new Types.ObjectId(shipmentId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Weight not yet set (productWeight === 0)
    const pendingWeight = await this.purchaseModel.countDocuments({
      shipmentId: new Types.ObjectId(shipmentId),
      productWeight: { $eq: 0 },
    });

    return {
      shipment,
      byCustomer,
      byStatus,
      pendingWeightCount: pendingWeight,
      summary: {
        totalProducts: shipment.totalProducts,
        totalWeightKg: shipment.totalWeightKg,
        totalShippingCost: shipment.totalShippingCost,
        actualWeightChargePerKg: shipment.actualWeightChargePerKg,
        customerWeightChargeTotal: shipment.customerWeightChargeTotal,
        weightChargeProfit: shipment.weightChargeProfit,
        totalGrossProfit: shipment.totalGrossProfit,
        totalNetProfit: shipment.totalNetProfit,
        customsDuty: shipment.customsDuty,
        otherExpenses: shipment.otherExpenses,
      },
    };
  }

  // ─── DASHBOARD SUMMARY ─────────────────────────────────────────────────────────

  async getDashboard() {
    const [statusBreakdown, recent, totals] = await Promise.all([
      this.shipmentModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.shipmentModel
        .find()
        .sort({ shipmentDate: -1 })
        .limit(5)
        .populate('shippingAddressId', 'source'),
      this.shipmentModel.aggregate([
        {
          $group: {
            _id: null,
            totalShipments: { $sum: 1 },
            totalProducts: { $sum: '$totalProducts' },
            totalWeightKg: { $sum: '$totalWeightKg' },
            totalShippingCost: { $sum: '$totalShippingCost' },
            totalWeightChargeProfit: { $sum: '$weightChargeProfit' },
            totalGrossProfit: { $sum: '$totalGrossProfit' },
            totalNetProfit: { $sum: '$totalNetProfit' },
          },
        },
      ]),
    ]);

    return {
      statusBreakdown,
      recentShipments: recent,
      allTimeTotals: totals[0] ?? {},
    };
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ message: string }> {
    const shipment = await this.findOne(id);

    const linkedPurchases = await this.purchaseModel.countDocuments({
      shipmentId: new Types.ObjectId(id),
    });
    const linkedDropShips = await this.dropshipModel.countDocuments({
      shipmentId: new Types.ObjectId(id),
    });

    if (linkedPurchases > 0 || linkedDropShips > 0) {
      throw new BadRequestException(
        `Cannot delete shipment with ${linkedPurchases} linked purchases and ${linkedDropShips} linked drop ship orders. Unlink them first.`,
      );
    }

    await (shipment as any).deleteOne();
    return { message: 'Shipment deleted successfully' };
  }

  // ─── INTERNAL HELPERS ──────────────────────────────────────────────────────────

  /**
   * Recalculates all aggregate totals on the shipment from scratch.
   * Called after any purchase/dropship is linked/unlinked or weights change.
   */
  private async recalcShipmentTotals(shipmentId: string): Promise<void> {
    const shipmentObjId = new Types.ObjectId(shipmentId);

    const [purchaseAgg, dropshipAgg] = await Promise.all([
      this.purchaseModel.aggregate([
        { $match: { shipmentId: shipmentObjId } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalWeightKg: { $sum: '$productWeight' },
            customerWeightChargeTotal: { $sum: '$productWeightCharge' },
            totalGrossProfit: {
              $sum: {
                $convert: {
                  input: {
                    $trim: {
                      input: {
                        $replaceAll: {
                          input: { $ifNull: ['$grossProfit', '0'] },
                          find: '৳',
                          replacement: '',
                        },
                      },
                    },
                  },
                  to: 'double',
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },
      ]),
      this.dropshipModel.aggregate([
        { $match: { shipmentId: shipmentObjId } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalWeightKg: { $sum: '$productWeight' },
            customerWeightChargeTotal: { $sum: '$productWeightCharge' },
          },
        },
      ]),
    ]);

    const pTotals = purchaseAgg[0] ?? {
      totalProducts: 0,
      totalWeightKg: 0,
      customerWeightChargeTotal: 0,
      totalGrossProfit: 0,
    };
    const dTotals = dropshipAgg[0] ?? {
      totalProducts: 0,
      totalWeightKg: 0,
      customerWeightChargeTotal: 0,
    };

    await this.shipmentModel.findByIdAndUpdate(shipmentId, {
      $set: {
        totalProducts: pTotals.totalProducts + dTotals.totalProducts,
        totalWeightKg: pTotals.totalWeightKg + dTotals.totalWeightKg,
        customerWeightChargeTotal:
          pTotals.customerWeightChargeTotal + dTotals.customerWeightChargeTotal,
        totalGrossProfit: pTotals.totalGrossProfit,
      },
    });

    // Re-fetch and save to trigger the pre-save hook (profit recalc)
    const shipment = await this.shipmentModel.findById(shipmentId);
    if (shipment) await shipment.save();
  }

  /**
   * After total shipping cost is known, push actual rate to every linked
   * purchase AND dropship order. This allows per-customer profit breakdown.
   */
  private async pushActualRateToPurchases(
    shipmentId: string,
    actualRatePerKg: number,
  ): Promise<void> {
    const shipmentObjId = new Types.ObjectId(shipmentId);

    const [purchases, dropships] = await Promise.all([
      this.purchaseModel.find({ shipmentId: shipmentObjId }),
      this.dropshipModel.find({ shipmentId: shipmentObjId }),
    ]);

    const purchaseUpdates = purchases.map((p) => {
      const profit = parseFloat(
        ((p.weightChargePerKg - actualRatePerKg) * p.productWeight).toFixed(2),
      );
      return this.purchaseModel.findByIdAndUpdate(p._id, {
        $set: {
          actualWeightChargePerKg: actualRatePerKg,
          weightChargeProfit: profit,
        },
      });
    });

    const dropshipUpdates = dropships.map((d) => {
      const profit = parseFloat(
        ((d.weightChargePerKg - actualRatePerKg) * d.productWeight).toFixed(2),
      );
      return this.dropshipModel.findByIdAndUpdate(d._id, {
        $set: {
          actualWeightChargePerKg: actualRatePerKg,
          weightChargeProfit: profit,
        },
      });
    });

    await Promise.all([...purchaseUpdates, ...dropshipUpdates]);
  }

  // ─── CALLED BY PurchaseService.updatePurchase ──────────────────────────────────
  /**
   * When updatePurchase runs and a shipmentId is passed,
   * call this to refresh shipment totals.
   */
  async onPurchaseWeightUpdated(shipmentId: string): Promise<void> {
    await this.recalcShipmentTotals(shipmentId);
  }

  // ─── CALLED BY PurchaseService.updatePurchaseStatus ───────────────────────────
  /**
   * When a purchase is marked Delivered:
   *  - (Optional) Create an income transaction for the weight charge collected
   *  - Refresh shipment totals
   */
  async onPurchaseDelivered(purchase: PurchaseDocument): Promise<void> {
    if (!purchase.shipmentId) return;

    // Mark profit as recorded so we don't double-count
    if (!purchase.profitRecorded) {
      purchase.profitRecorded = true;
      await purchase.save();

      // ── OPTIONAL: Create income transaction for remaining due collected ────────
      // Uncomment when TransactionsService is injected:
      //
      // if (purchase.remaniningDue > 0) {
      //   await this.transactionsService.addIncome({
      //     accountId: DEFAULT_CASH_ACCOUNT_ID,
      //     amount: purchase.remaniningDue,
      //     category: 'Sales Revenue',
      //     description: `Payment on delivery — ${purchase.customerName} — ${purchase.prodDesc}`,
      //     reference: purchase.orderId,
      //     tags: ['delivery', 'collection'],
      //   });
      // }
    }

    await this.recalcShipmentTotals(purchase.shipmentId.toString());
  }

  // ─── CALLED WHEN DROP SHIP ORDER IS DELIVERED ─────────────────────────────────

  async onDropShipDelivered(dropship: DropShipDocument): Promise<void> {
    if (!dropship.shipmentId) return;

    if (!dropship.profitRecorded) {
      dropship.profitRecorded = true;
      await dropship.save();
    }

    await this.recalcShipmentTotals(dropship.shipmentId.toString());
  }
}

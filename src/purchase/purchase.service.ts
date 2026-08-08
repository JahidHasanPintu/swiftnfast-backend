import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseDocument } from './interfaces/puchase.interface';

import { OrderDocument } from '../order/interfaces/order.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePurchaseDto } from './dto/purchase.dto';
import { UpdatePurchaseDto } from './dto/updatePurchase.dto';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';
import { removeCurrencySymbols } from 'src/utils/currency.util';
import { ShipmentService } from 'src/shipment/shipment.service';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectModel('Purchases') private PurchaseModel: Model<PurchaseDocument>,
    @InjectModel('Orders') private orderModel: Model<OrderDocument>,
    @Inject(forwardRef(() => ShipmentService))
    private shipmentService: ShipmentService,
  ) {}

  async create(
    createPurchaseDto: CreatePurchaseDto,
  ): Promise<PurchaseDocument> {
    const createdPurchase = new this.PurchaseModel(createPurchaseDto);
    return createdPurchase.save();
  }

  // //get all cards info
  // async getAllPurchaseLists(): Promise<PurchaseDocument[]> {
  //     return this.PurchaseModel.find().sort({ createdAt: -1 });
  // }

  async getPurchaseByOrderIdAndItemIndex(
    orderId: string,
    orderItemIndex: number,
  ): Promise<PurchaseDocument> {
    const purchase = await this.PurchaseModel.findOne({
      orderId,
      orderItemIndex,
    })
      .select('+confirmationMail')
      .exec();

    if (!purchase) {
      throw new NotFoundException(
        `Purchase with orderId ${orderId} and orderItemIndex ${orderItemIndex} not found`,
      );
    }

    return purchase;
  }

  async updatePurchaseByOrderIdAndItemIndex(
    orderId: string,
    orderItemIndex: number,
    updatePurchaseDto: CreatePurchaseDto,
  ): Promise<PurchaseDocument> {
    const updatedPurchase = await this.PurchaseModel.findOneAndUpdate(
      { orderId, orderItemIndex },
      { $set: updatePurchaseDto },
      { new: true },
    );

    if (!updatedPurchase) {
      throw new NotFoundException(
        `Purchase with orderId ${orderId} and orderItemIndex ${orderItemIndex} not found`,
      );
    }

    return updatedPurchase;
  }

  async updateTrackId(
    orderId: string,
    orderItemIndex: number,
    updateTrackIdDto: UpdatePurchaseDto,
  ): Promise<PurchaseDocument> {
    const updatedPurchase = await this.PurchaseModel.findOneAndUpdate(
      { orderId: orderId, orderItemIndex: orderItemIndex },
      { $set: { trackId: updateTrackIdDto.trackId } }, // Only update the trackId field
      { new: true },
    );

    if (!updatedPurchase) {
      throw new NotFoundException(
        `Purchase with orderId ${orderId} and orderItemIndex ${orderItemIndex} not found`,
      );
    }

    return updatedPurchase;
  }

  async getAllPurchases(
    page = 1,
    pageSize = 10,
    status = '',
  ): Promise<CommonPaginationResponse<any>> {
    // Convert query params to numbers
    const currentPage = Number(page);
    const limit = Number(pageSize);
    const skip = (currentPage - 1) * limit;

    const filter: any = {};

    if (status) {
      const statusArray = status.split(',').map((s) => s.trim());

      filter.status = {
        $in: statusArray,
      };
    }

    // Total count
    const count = await this.PurchaseModel.countDocuments(filter);

    // Aggregate purchases
    const purchases = await this.PurchaseModel.aggregate([
      {
        $match: filter,
      },

      {
        $sort: {
          createdAt: -1,
        },
      },

      {
        $skip: skip,
      },

      {
        $limit: limit,
      },

      // Convert customerId string -> ObjectId (safe with onError)
      {
        $addFields: {
          customerObjectId: {
            $convert: { input: '$customerId', to: 'objectId', onError: null, onNull: null },
          },
          shipmentObjId: {
            $convert: { input: '$shipmentId', to: 'objectId', onError: null, onNull: null },
          },
        },
      },

      // Customer lookup
      {
        $lookup: {
          from: 'customers',
          localField: 'customerObjectId',
          foreignField: '_id',
          as: 'customer',
        },
      },

      // Convert customer array -> object
      {
        $unwind: {
          path: '$customer',
          preserveNullAndEmptyArrays: true,
        },
      },

      // Optional: remove temporary field
      {
        $project: {
          customerObjectId: 0,
        },
      },

      // Shipment lookup (uses safe ObjectId)
      {
        $lookup: {
          from: 'shipments',
          localField: 'shipmentObjId',
          foreignField: '_id',
          as: '_shipment',
        },
      },
      {
        $addFields: {
          shipmentId: {
            $cond: {
              if: { $gt: [{ $size: '$_shipment' }, 0] },
              then: { $arrayElemAt: ['$_shipment', 0] },
              else: '$shipmentId',
            },
          },
        },
      },
      {
        $project: {
          _shipment: 0,
          shipmentObjId: 0,
        },
      },
    ]);

    return {
      data: purchases,
      meta: {
        page: currentPage,
        pageSize: limit,
        totalItems: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  // delete particular purchase

  async deleteByOrderIdAndItemIndex(
    orderId: string,
    orderItemIndex: number,
  ): Promise<void> {
    await this.PurchaseModel.deleteOne({ orderId, orderItemIndex }).exec();
  }

  async filterPurchases(
    page: number,
    pageSize: number,
    startDate?: Date, // Change to Date
    endDate?: Date, // Change to Date
    websiteName?: string,
    cardType?: string,
    destination?: string,
    country?: string,
  ): Promise<CommonPaginationResponse<any>> {
    const filter: any = {};

    if (startDate instanceof Date && !isNaN(startDate.getTime())) {
      filter.purchaseDate = { ...filter.purchaseDate, $gte: startDate };
    }

    if (endDate instanceof Date && !isNaN(endDate.getTime())) {
      filter.purchaseDate = { ...filter.purchaseDate, $lte: endDate };
    }

    if (websiteName) {
      filter.websiteUrl = { $regex: new RegExp(websiteName, 'i') };
    }

    if (cardType) {
      filter.cardType = { $regex: new RegExp(cardType, 'i') };
    }

    if (destination) {
      filter.destination = { $regex: new RegExp(destination, 'i') };
    }

    if (country) {
      filter.country = { $regex: new RegExp(country, 'i') };
    }

    console.log('Filter used:', JSON.stringify(filter, null, 2));

    const skip = (page - 1) * pageSize;
    const count = await this.PurchaseModel.countDocuments(filter);
    const purchases = await this.PurchaseModel.find(filter)
      .sort({ purchaseDate: 1 })
      .skip(skip)
      .limit(pageSize)
      .select('+confirmationMail')
      .populate('shipmentId', 'shipmentName');

    return {
      data: purchases,
      meta: {
        page,
        pageSize,
        totalItems: count,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  }

  // get website url information
  async getUniqueWebsites(): Promise<string[]> {
    const uniqueWebsites = await this.PurchaseModel.distinct('websiteUrl');
    return uniqueWebsites;
  }

  async getAllPurchasesWithoutPagination(): Promise<any[]> {
    return this.PurchaseModel.find()
      .sort({ createdAt: -1 })
      .populate('shipmentId', 'shipmentName')
      .exec();
  }

  async getAllPurchasesCleaned(): Promise<any[]> {
    try {
      const purchases = await this.PurchaseModel.find()
        .sort({ createdAt: -1 })
        .populate('shipmentId', 'shipmentName')
        .exec();

      const currencyFields = [
        'selling',
        'currencyAmount',
        'buyingUP',
        'buyingBDT',
        'advance',
        'grossProfit',
      ];

      const cleanedPurchases = purchases.map((purchase) => {
        const cleanedPurchase = { ...purchase.toObject() };

        currencyFields.forEach((field) => {
          if (
            cleanedPurchase[field] &&
            typeof cleanedPurchase[field] === 'string'
          ) {
            cleanedPurchase[field] = removeCurrencySymbols(
              cleanedPurchase[field],
            );
          }
        });

        return cleanedPurchase;
      });

      return cleanedPurchases;
    } catch (error) {
      throw new Error('Failed to fetch and clean purchases');
    }
  }

  // All data with pagination : Filtered data

  async getAllFilteredPurchases(
    startDate?: Date,
    endDate?: Date,
    websiteName?: string,
    cardType?: string,
    destination?: string,
    country?: string,
  ): Promise<any> {
    const filter: any = {};

    if (
      startDate instanceof Date &&
      !isNaN(startDate.getTime()) &&
      endDate instanceof Date &&
      !isNaN(endDate.getTime())
    ) {
      filter.purchaseDate = { $gte: startDate, $lte: endDate };
    } else {
      if (startDate instanceof Date && !isNaN(startDate.getTime())) {
        filter.purchaseDate = { $gte: startDate };
      }
      if (endDate instanceof Date && !isNaN(endDate.getTime())) {
        filter.purchaseDate = { ...(filter.purchaseDate || {}), $lte: endDate };
      }
    }

    if (websiteName) {
      filter.websiteUrl = { $regex: new RegExp(websiteName, 'i') };
    }

    if (cardType) {
      filter.cardType = { $regex: new RegExp(cardType, 'i') };
    }

    if (destination) {
      filter.destination = { $regex: new RegExp(destination, 'i') };
    }

    if (country) {
      filter.country = { $regex: new RegExp(country, 'i') };
    }

    const purchases = await this.PurchaseModel.find(filter)
      .sort({ purchaseDate: 1 })
      .select('+confirmationMail')
      .populate('shipmentId', 'shipmentName');

    return {
      data: purchases,
      meta: {
        totalItems: purchases.length, // Total items without pagination
      },
    };
  }

  async getAllFilteredPurchasesCleaned(
    startDate?: Date,
    endDate?: Date,
    websiteName?: string,
    cardType?: string,
    destination?: string,
    country?: string,
  ): Promise<any> {
    const filter: any = {};

    // Apply the filtering logic for purchase date, website, cardType, etc.
    if (
      startDate instanceof Date &&
      !isNaN(startDate.getTime()) &&
      endDate instanceof Date &&
      !isNaN(endDate.getTime())
    ) {
      filter.purchaseDate = { $gte: startDate, $lte: endDate };
    } else {
      if (startDate instanceof Date && !isNaN(startDate.getTime())) {
        filter.purchaseDate = { $gte: startDate };
      }
      if (endDate instanceof Date && !isNaN(endDate.getTime())) {
        filter.purchaseDate = { ...(filter.purchaseDate || {}), $lte: endDate };
      }
    }

    if (websiteName) {
      filter.websiteUrl = { $regex: new RegExp(websiteName, 'i') };
    }

    if (cardType) {
      filter.cardType = { $regex: new RegExp(cardType, 'i') };
    }

    if (destination) {
      filter.destination = { $regex: new RegExp(destination, 'i') };
    }

    if (country) {
      filter.country = { $regex: new RegExp(country, 'i') };
    }

    // Fetch the filtered purchases
    const purchases = await this.PurchaseModel.find(filter)
      .sort({ purchaseDate: 1 })
      .select('+confirmationMail')
      .populate('shipmentId', 'shipmentName');

    // Define the fields that may contain currency symbols
    const currencyFields = [
      'selling',
      'currencyAmount',
      'buyingUP',
      'buyingBDT',
      'advance',
      'grossProfit',
    ];

    // Function to remove currency symbols
    const removeCurrencySymbols = (value: string): string => {
      return value.replace(/[^\d.]/g, ''); // Removes everything except digits and decimals
    };

    // Clean the purchases data
    const cleanedPurchases = purchases.map((purchase) => {
      const cleanedPurchase = { ...purchase.toObject() }; // Convert Mongoose document to plain object

      // Remove currency symbols from relevant fields
      currencyFields.forEach((field) => {
        if (
          cleanedPurchase[field] &&
          typeof cleanedPurchase[field] === 'string'
        ) {
          cleanedPurchase[field] = removeCurrencySymbols(
            cleanedPurchase[field],
          );
        }
      });

      return cleanedPurchase;
    });

    return {
      data: cleanedPurchases,
      meta: {
        totalItems: cleanedPurchases.length, // Total items after filtering
      },
    };
  }

  async updatePurchase(
    this: any, // PurchaseService instance
    orderId: string,
    orderItemIndex: number,
    updatePurchaseDto: any, //
  ): Promise<PurchaseDocument> {
    // Construct the query and update objects
    const query = { orderId, orderItemIndex };

    let statusToUpdate = 'Purchased';
    if (
      updatePurchaseDto.productWeightCharge &&
      updatePurchaseDto.productWeightCharge > 0
    ) {
      statusToUpdate = 'Ready To Deliver';
    }

    // Build the $set object
    const setFields: Record<string, any> = {
      productWeight: updatePurchaseDto.productWeight,
      weightChargePerKg: updatePurchaseDto.weightChargePerKg,
      productWeightCharge: updatePurchaseDto.productWeightCharge,
      remaniningDue: updatePurchaseDto.remaniningDue,
      status: statusToUpdate,
    };

    // ── NEW: link to shipment if provided ────────────────────────────────────────
    if (updatePurchaseDto.shipmentId) {
      setFields.shipmentId = new Types.ObjectId(updatePurchaseDto.shipmentId);
    }

    const update = { $set: setFields };

    const updatedPurchase = await this.PurchaseModel.findOneAndUpdate(
      query,
      update,
      { new: true },
    );

    if (!updatedPurchase) {
      throw new NotFoundException(
        `Purchase with orderId ${orderId} and orderItemIndex ${orderItemIndex} not found`,
      );
    }

    // ── NEW: refresh shipment totals after weight change ─────────────────────────
    const shipmentId =
      updatedPurchase.shipmentId ?? updatePurchaseDto.shipmentId;
    if (shipmentId) {
      await this.shipmentService.onPurchaseWeightUpdated(shipmentId.toString());
    }

    return updatedPurchase;
  }
  async updatePurchaseStatus(
    this: any, // PurchaseService instance
    orderId: string,
    orderItemIndex: number,
    updatePurchaseDto: any, // your UpdatePurchaseDto
  ) {
    const query = { orderId, orderItemIndex };

    const update = {
      $set: {
        deliveryDate: new Date(),
        status: updatePurchaseDto.status,
      },
    };

    const updateOrder = {
      $set: { status: 'Delivered' },
    };

    const updatedPurchase = await this.PurchaseModel.findOneAndUpdate(
      query,
      update,
      { new: true },
    );

    await this.orderModel.findOneAndUpdate({ orderId }, updateOrder, {
      new: true,
    });

    if (!updatedPurchase) {
      throw new NotFoundException(
        `Purchase with orderId ${orderId} and orderItemIndex ${orderItemIndex} not found`,
      );
    }

    // ── NEW: when delivered, record profit and refresh shipment ──────────────────
    if (updatePurchaseDto.status === 'Delivered') {
      await this.shipmentService.onPurchaseDelivered(updatedPurchase);
    }

    return updatedPurchase;
  }
}

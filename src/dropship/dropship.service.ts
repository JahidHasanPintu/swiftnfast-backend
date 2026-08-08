import { BadRequestException, Injectable, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { DropShipDocument } from './interfaces/dropship.interface';
import { CustomerDocument } from '../order/interfaces/customer.interface';
import { CreateDropShipDto } from './dtos/create-dropship.dto';
import { UpdateDropShipDto } from './dtos/update-dropship.dto';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';
import { ShipmentService } from 'src/shipment/shipment.service';
import * as mongoose from 'mongoose';

@Injectable()
export class DropShipService {
  constructor(
    @InjectModel('DropShip') private dropshipModel: Model<DropShipDocument>,
    @InjectModel('Customer') private customerModel: Model<CustomerDocument>,
    @Inject(forwardRef(() => ShipmentService))
    private shipmentService: ShipmentService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  generateDropShipId(): string {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `DSP-${day}${month}${year}${randomDigits}`;
  }

  async create(dto: CreateDropShipDto): Promise<{ message: string; dropship: DropShipDocument }> {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const dropshipId = this.generateDropShipId();

      const productWeightCharge = parseFloat(
        ((dto.productWeight || 0) * (dto.weightChargePerKg || 0)).toFixed(2),
      );
      const remainingDue = dto.remainingDue ?? productWeightCharge;

      const newCustomer = new this.customerModel({
        customerId: dto.customerId,
        customerName: dto.customerName,
        contactNumber: dto.contactNo,
        emailAddress: dto.emailAddress || '',
        shippingAddress: dto.shippingAddress || '',
        districtName: dto.districtName || '',
        totalAdvance: 0,
        grandTotal: productWeightCharge,
        sourceOfOrder: dto.sourceOfOrder || 'Drop Ship',
        customerDateOfBirth: dto.customerDateOfBirth || undefined,
        customerJoiningDate: dto.customerJoiningDate || undefined,
        orderDate: dto.orderDate,
        createdBy: dto.createdBy || '',
      });
      await newCustomer.save({ session });

      const dropshipDoc = new this.dropshipModel({
        dropshipId,
        customerId: newCustomer._id,
        customerName: dto.customerName,
        contactNo: dto.contactNo,
        orderDate: dto.orderDate,
        productDescription: dto.productDescription,
        productUrl: dto.productUrl || '',
        quantity: dto.quantity,
        color: dto.color || '',
        size: dto.size || '',
        productWeight: dto.productWeight,
        weightChargePerKg: dto.weightChargePerKg,
        productWeightCharge,
        remainingDue,
        orderNotes: dto.orderNotes || '',
        status: 'Pending',
        createdBy: dto.createdBy || '',
      });
      await dropshipDoc.save({ session });

      await session.commitTransaction();
      session.endSession();

      return { message: 'Drop ship order created successfully', dropship: dropshipDoc };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw new BadRequestException(`Error creating drop ship order: ${error.message}`);
    }
  }

  async findAll(
    page = 1,
    pageSize = 10,
    status?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<CommonPaginationResponse<any>> {
    const skip = (page - 1) * pageSize;
    const matchQuery: any = {};
    if (status) {
      matchQuery.status = status;
    }
    if (startDate || endDate) {
      matchQuery.orderDate = {};
      if (startDate) matchQuery.orderDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchQuery.orderDate.$lte = end;
      }
    }

    const [count, items] = await Promise.all([
      this.dropshipModel.countDocuments(matchQuery),
      this.dropshipModel.aggregate([
        { $match: matchQuery },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: pageSize },
        {
          $lookup: {
            from: 'customers',
            localField: 'customerId',
            foreignField: '_id',
            as: 'customer',
          },
        },
        {
          $unwind: {
            path: '$customer',
            preserveNullAndEmptyArrays: true,
          },
        },
      ]),
    ]);

    return {
      data: items,
      meta: {
        page,
        pageSize,
        totalItems: count,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  }

  async findOne(dropshipId: string): Promise<DropShipDocument> {
    const doc = await this.dropshipModel.findOne({ dropshipId }).populate('customerId').exec();
    if (!doc) {
      throw new NotFoundException(`Drop ship order ${dropshipId} not found`);
    }
    return doc;
  }

  async update(
    dropshipId: string,
    dto: UpdateDropShipDto,
  ): Promise<DropShipDocument> {
    const setFields: Record<string, any> = {};

    if (dto.productDescription !== undefined) setFields.productDescription = dto.productDescription;
    if (dto.productUrl !== undefined) setFields.productUrl = dto.productUrl;
    if (dto.quantity !== undefined) setFields.quantity = dto.quantity;
    if (dto.color !== undefined) setFields.color = dto.color;
    if (dto.size !== undefined) setFields.size = dto.size;
    if (dto.productWeight !== undefined) setFields.productWeight = dto.productWeight;
    if (dto.weightChargePerKg !== undefined) setFields.weightChargePerKg = dto.weightChargePerKg;
    if (dto.productWeightCharge !== undefined) setFields.productWeightCharge = dto.productWeightCharge;
    if (dto.remainingDue !== undefined) setFields.remainingDue = dto.remainingDue;
    if (dto.orderNotes !== undefined) setFields.orderNotes = dto.orderNotes;
    if (dto.status !== undefined) setFields.status = dto.status;
    if (dto.deliveryMethod !== undefined) setFields.deliveryMethod = dto.deliveryMethod;
    if (dto.deliveryDate !== undefined) setFields.deliveryDate = new Date(dto.deliveryDate);

    // Recalculate productWeightCharge if weight or rate changed
    if (dto.productWeight !== undefined || dto.weightChargePerKg !== undefined) {
      const existing = await this.dropshipModel.findOne({ dropshipId }).exec();
      if (existing) {
        const weight = dto.productWeight ?? existing.productWeight;
        const rate = dto.weightChargePerKg ?? existing.weightChargePerKg;
        setFields.productWeightCharge = parseFloat((weight * rate).toFixed(2));
      }
    }

    const updated = await this.dropshipModel
      .findOneAndUpdate({ dropshipId }, { $set: setFields }, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Drop ship order ${dropshipId} not found`);
    }

    if (dto.status === 'Delivered') {
      await this.shipmentService.onDropShipDelivered(updated);
    }

    return updated;
  }

  async linkShipment(
    dropshipId: string,
    shipmentId: string,
    productWeight?: number,
    weightChargePerKg?: number,
  ): Promise<DropShipDocument> {
    const doc = await this.dropshipModel.findOne({ dropshipId }).exec();
    if (!doc) {
      throw new NotFoundException(`Drop ship order ${dropshipId} not found`);
    }

    doc.shipmentId = new mongoose.Types.ObjectId(shipmentId);

    if (productWeight !== undefined) doc.productWeight = productWeight;
    if (weightChargePerKg !== undefined) doc.weightChargePerKg = weightChargePerKg;
    doc.productWeightCharge = parseFloat(
      (doc.productWeight * doc.weightChargePerKg).toFixed(2),
    );

    if (doc.productWeightCharge > 0 && doc.status === 'Pending') {
      doc.status = 'Ready To Deliver';
    }
    await doc.save();
    return doc;
  }

  async remove(dropshipId: string): Promise<{ message: string }> {
    const result = await this.dropshipModel.deleteOne({ dropshipId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Drop ship order ${dropshipId} not found`);
    }
    return { message: `Drop ship order ${dropshipId} deleted successfully` };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CustomerDocument } from '../../order/interfaces/customer.interface';

function sanitizeUser(user: any) {
  const doc = user.toObject ? user.toObject() : user;
  delete doc.password;
  delete doc.otp;
  delete doc.otpExpiry;
  delete doc.resetToken;
  delete doc.resetTokenExpiry;
  // Map customer fields to frontend-friendly names
  return {
    ...doc,
    id: doc._id,
    name: doc.customerName,
    email: doc.emailAddress,
    phone: doc.contactNumber || doc.phone,
  };
}

@Injectable()
export class StorefrontUsersService {
  constructor(
    @InjectModel('Customer')
    private readonly customerModel: Model<CustomerDocument>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.customerModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return sanitizeUser(user);
  }

  async updateProfile(userId: string, body: any) {
    const update = await this.buildUpdate(body);
    const user = await this.customerModel
      .findByIdAndUpdate(userId, update, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return sanitizeUser(user);
  }

  async list(query: Record<string, any>) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { isDeleted: { $ne: true } };
    if (query.email)
      filter.emailAddress = { $regex: String(query.email), $options: 'i' };
    if (query.phone)
      filter.contactNumber = { $regex: String(query.phone), $options: 'i' };
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;

    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;

    const [rows, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.customerModel.countDocuments(filter).exec(),
    ]);

    const totalPage = Math.ceil(total / limit);
    return {
      users: rows.map(sanitizeUser),
      meta: {
        total,
        page,
        limit,
        totalPage,
        hasNextPage: page < totalPage,
        hasPreviousPage: page > 1,
      },
    };
  }

  async createUser(body: any) {
    if (!body.emailAddress && !body.email)
      throw new BadRequestException('Email is required');
    const email = (body.email || body.emailAddress || '').toLowerCase();
    const existing = await this.customerModel
      .findOne({ emailAddress: email })
      .exec();
    if (existing) {
      throw new BadRequestException('User already exists');
    }
    const customerData: any = {
      customerName: body.customerName || body.name || '',
      emailAddress: email,
      contactNumber: body.contactNumber || body.phone || '',
      phone: body.phone || '',
      role: body.role || 'user',
      isVerified: body.isVerified !== undefined ? body.isVerified : true,
      isDeleted: false,
      grandTotal: 0,
      sourceOfOrder: 'storefront',
    };
    if (body.password) {
      customerData.password = await bcrypt.hash(body.password, 10);
      customerData.needsPasswordChange = body.needsPasswordChange || false;
    }
    const user = await this.customerModel.create(customerData);
    return sanitizeUser(user);
  }

  async updateUser(id: string, body: any) {
    const update = await this.buildUpdate(body);
    const user = await this.customerModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return sanitizeUser(user);
  }

  async deleteUser(id: string) {
    const user = await this.customerModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    user.isDeleted = true;
    await user.save();
    return sanitizeUser(user);
  }

  async updateAccountStatus(id: string, status: string) {
    const user = await this.customerModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    user.status = status as 'active' | 'inactive' | 'blocked';
    if (status === 'active') user.isDeleted = false;
    await user.save();
    return sanitizeUser(user);
  }

  private async buildUpdate(body: any) {
    const update: Record<string, any> = {};
    // Profile fields - map from both old and new field names
    if (body.name !== undefined || body.customerName !== undefined)
      update.customerName = body.customerName || body.name;
    if (body.email !== undefined || body.emailAddress !== undefined)
      update.emailAddress = body.emailAddress || body.email;
    if (body.phone !== undefined || body.contactNumber !== undefined) {
      update.contactNumber = body.contactNumber || body.phone;
      update.phone = body.phone || body.contactNumber;
    }
    if (body.address !== undefined) update.address = body.address;
    if (body.shippingAddress !== undefined)
      update.shippingAddress = body.shippingAddress;
    if (body.districtName !== undefined)
      update.districtName = body.districtName;
    if (body.dateOfBirth !== undefined)
      update.dateOfBirth = body.dateOfBirth;
    if (body.customerDateOfBirth !== undefined)
      update.customerDateOfBirth = body.customerDateOfBirth;
    if (body.role !== undefined) update.role = body.role;

    // Password update
    if (body.password) {
      update.needsPasswordChange = true;
      update.password = await bcrypt.hash(body.password, 10);
    }
    return update;
  }
}

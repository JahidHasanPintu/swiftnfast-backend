import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Pfu2UserDocument } from '../interfaces/pfu2-user.interface';

function sanitizeUser(user: any) {
  const doc = user.toObject ? user.toObject() : user;
  delete doc.password;
  delete doc.otp;
  delete doc.otpExpiry;
  return doc;
}

@Injectable()
export class StorefrontUsersService {
  constructor(
    @InjectModel('Pfu2User')
    private readonly userModel: Model<Pfu2UserDocument>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return sanitizeUser(user);
  }

  async updateProfile(userId: string, body: any) {
    const update = await this.buildUpdate(body);
    const user = await this.userModel
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
      filter.email = { $regex: String(query.email), $options: 'i' };
    if (query.phone)
      filter.phone = { $regex: String(query.phone), $options: 'i' };
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;

    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;

    const [rows, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
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
    if (!body.email) throw new BadRequestException('Email is required');
    const existing = await this.userModel.findOne({ email: body.email }).exec();
    if (existing) {
      throw new BadRequestException('User already exists');
    }
    const user = await this.userModel.create(body);
    return sanitizeUser(user);
  }

  async updateUser(id: string, body: any) {
    const update = await this.buildUpdate(body);
    const user = await this.userModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return sanitizeUser(user);
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    user.isDeleted = true;
    await user.save();
    return sanitizeUser(user);
  }

  async updateAccountStatus(id: string, status: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    user.status = status as 'active' | 'inactive' | 'blocked';
    if (status === 'active') user.isDeleted = false;
    await user.save();
    return sanitizeUser(user);
  }

  private async buildUpdate(body: any) {
    const update: Record<string, any> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.firstName !== undefined) update.firstName = body.firstName;
    if (body.lastName !== undefined) update.lastName = body.lastName;
    if (body.email !== undefined) update.email = body.email;
    if (body.phone !== undefined) update.phone = body.phone;
    if (body.role !== undefined) update.role = body.role;
    if (body.address !== undefined) update.address = body.address;
    if (body.password) {
      update.needsPasswordChange = true;
      update.password = await bcrypt.hash(body.password, 10);
    }
    return update;
  }
}

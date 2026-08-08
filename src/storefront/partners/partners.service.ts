import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { generateImageUrl } from '../utils/image-url.util';

@Injectable()
export class PartnersService {
  constructor(@InjectModel('Partner') private readonly partnerModel: Model<any>) {}

  private serialize(doc: any) {
    const obj = doc.toObject ? doc.toObject() : doc;
    return {
      ...obj,
      logo: generateImageUrl('partners', obj.logo),
    };
  }

  async findAll(query: Record<string, any> = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = { isActive: true };

    const [rows, totalItems] = await Promise.all([
      this.partnerModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit).exec(),
      this.partnerModel.countDocuments(filter).exec(),
    ]);
    return {
      partners: rows.map((r) => this.serialize(r)),
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }

  async findById(id: string) {
    const partner = await this.partnerModel.findById(id).exec();
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }
    return partner.toObject ? partner.toObject() : partner;
  }
}

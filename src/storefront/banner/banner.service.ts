import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { generateImageUrl } from '../utils/image-url.util';

@Injectable()
export class BannerService {
  constructor(
    @InjectModel('Banner') private readonly bannerModel: Model<any>,
  ) {}

  private serialize(doc: any) {
    const obj = doc.toObject ? doc.toObject() : doc;
    return {
      ...obj,
      bannerImage: generateImageUrl('banners', obj.bannerImage),
    };
  }

  async findAll(query: Record<string, any> = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.bannerModel
        .find({})
        .sort({ order: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bannerModel.countDocuments({}).exec(),
    ]);
    return {
      banners: rows.map((r) => this.serialize(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
    };
  }

  async findById(id: string) {
    const banner = await this.bannerModel.findById(id).exec();
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    return this.serialize(banner);
  }
}

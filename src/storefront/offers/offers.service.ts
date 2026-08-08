import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { generateImageUrl } from '../utils/image-url.util';

@Injectable()
export class OffersService {
  constructor(@InjectModel('Offer') private readonly offerModel: Model<any>) {}

  private serialize(doc: any) {
    const obj = doc.toObject ? doc.toObject() : doc;
    return {
      ...obj,
      image: generateImageUrl('offers', obj.image),
    };
  }

  async findAll(query: Record<string, any> = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {};
    if (query.search) filter.name = { $regex: query.search, $options: 'i' };
    if (query.isActive === 'true') filter.isActive = true;

    const [rows, total] = await Promise.all([
      this.offerModel
        .find(filter)
        .populate('categoryId', 'id name')
        .skip(skip)
        .limit(limit)
        .exec(),
      this.offerModel.countDocuments(filter).exec(),
    ]);
    return {
      offers: rows.map((r) => this.serialize(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
    };
  }

  async findByName(name: string) {
    const offer = await this.offerModel
      .findOne({ name })
      .populate('categoryId', 'id name')
      .exec();
    if (!offer) {
      throw new NotFoundException(`Offer with name ${name} not found`);
    }
    return this.serialize(offer);
  }

  async findById(id: string) {
    const offer = await this.offerModel
      .findById(id)
      .populate('categoryId', 'id name')
      .exec();
    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }
    return this.serialize(offer);
  }
}

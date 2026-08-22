import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { generateImageUrl } from '../utils/image-url.util';

@Injectable()
export class StorefrontCategoryService {
  constructor(
    @InjectModel('Category') private readonly categoryModel: Model<any>,
  ) {}

  private serialize(doc: any) {
    const obj = doc.toObject ? doc.toObject() : doc;
    return {
      ...obj,
      image: generateImageUrl('categories', obj.image),
      bannerImage: generateImageUrl('categories', obj.bannerImage),
    };
  }

  async findAll(query: Record<string, any> = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {};
    if (query.search) filter.name = { $regex: query.search, $options: 'i' };
    if (query.isActive === 'true') filter.isActive = true;
    if (query.isActive === 'false') filter.isActive = false;

    const [rows, total] = await Promise.all([
      this.categoryModel.find(filter).skip(skip).limit(limit).exec(),
      this.categoryModel.countDocuments(filter).exec(),
    ]);
    return {
      categories: rows.map((r) => this.serialize(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
    };
  }

  async findById(id: string) {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return this.serialize(category);
  }
}

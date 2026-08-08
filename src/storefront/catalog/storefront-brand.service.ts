import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { generateImageUrl } from '../utils/image-url.util';

@Injectable()
export class StorefrontBrandService {
  constructor(@InjectModel('Brand') private readonly brandModel: Model<any>) {}

  private serialize(doc: any) {
    const obj = doc.toObject ? doc.toObject() : doc;
    return { ...obj, logo: generateImageUrl('partners', obj.logo) };
  }

  async findAll() {
    const rows = await this.brandModel.find({ isActive: true }).sort({ name: 1 }).exec();
    return rows.map((r) => this.serialize(r));
  }

  async findById(id: string) {
    const brand = await this.brandModel.findById(id).exec();
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return this.serialize(brand);
  }
}

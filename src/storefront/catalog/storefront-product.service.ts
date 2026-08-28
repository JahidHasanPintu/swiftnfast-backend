import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductDocument } from '../interfaces/product.interface';
import { generateImageUrl } from '../utils/image-url.util';

function parseImages(images: any): string[] {
  if (!images) return [];
  if (Array.isArray(images)) {
    return images.map((i) =>
      typeof i === 'string' && /^https?:\/\//i.test(i)
        ? i
        : generateImageUrl('products', String(i)),
    );
  }
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parseImages(parsed) : [];
    } catch {
      return [images];
    }
  }
  return [];
}

@Injectable()
export class StorefrontProductService {
  constructor(
    @InjectModel('Product')
    private readonly productModel: Model<ProductDocument>,
    @InjectModel('Category') private readonly categoryModel: Model<any>,
  ) {}

  private serialize(doc: any) {
    const obj = doc.toObject ? doc.toObject() : doc;
    return {
      ...obj,
      id: obj._id?.toString(),
      categoryId: obj.categoryId,
      category: obj.category,
      images: parseImages(obj.images),
    };
  }

  async findAll(query: Record<string, any> = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {};

    if (query.category) {
      filter.categoryId = query.category;
    } else if (query.categoryId) {
      filter.categoryId = query.categoryId;
    }
    if (query.brand) filter.brand = { $regex: query.brand, $options: 'i' };
    if (query.brands) {
      const brands = String(query.brands)
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);
      if (brands.length) {
        filter.brand = { $in: brands.map((b) => new RegExp(b, 'i')) };
      }
    }
    if (query.gender) filter.gender = query.gender;
    if (query.minPrice != null && query.minPrice !== '') {
      filter.price = { $gte: Number(query.minPrice) };
    }
    if (query.maxPrice != null && query.maxPrice !== '') {
      filter.price = { ...(filter.price || {}), $lte: Number(query.maxPrice) };
    }

    const sort: Record<string, any> = { createdAt: -1 };
    if (query.sort) {
      const [field, direction] = String(query.sort).split(':');
      if (field) sort[field] = direction === 'asc' ? 1 : -1;
    }

    const [rows, total] = await Promise.all([
      this.productModel
        .find(filter)
        .populate('categoryId', 'id name')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return {
      products: rows.map((r) => this.serialize(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
    };
  }

  async search(q?: string) {
    if (!q || String(q).length < 2) return [];
    const rows = await this.productModel
      .find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { shortDescription: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
        ],
      })
      .select('id name brand slug images')
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();
    return rows.map((r) => ({
      id: r._id,
      name: r.name,
      brand: r.brand,
      slug: r.slug,
      image: parseImages(r.images)[0] || null,
    }));
  }

  async findById(id: string) {
    const product = await this.productModel
      .findOne({ _id: id })
      .populate('categoryId', 'id name')
      .exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return this.serialize(product);
  }

  async findBySlug(slug: string) {
    const product = await this.productModel
      .findOne({ slug })
      .populate('categoryId', 'id name')
      .exec();
    if (!product) {
      throw new NotFoundException(`Product with slug '${slug}' not found`);
    }
    return this.serialize(product);
  }

  async findUniqueBrands(categoryId?: string) {
    const filter: Record<string, any> = {
      brand: { $exists: true, $ne: '' },
    };
    if (categoryId) filter.categoryId = categoryId;
    const brands = await this.productModel.distinct('brand', filter).exec();
    return brands.filter((b) => b && b !== null);
  }
}

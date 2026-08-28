import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { StorageService } from 'src/storage/storage.service';
import { generateImageUrl } from '../utils/image-url.util';

function toBool(v: any): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
}

function toNum(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseJsonArray(v: any): any[] | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

@Injectable()
export class AdminCatalogService {
  constructor(
    @InjectModel('Category') private readonly categoryModel: Model<any>,
    @InjectModel('Brand') private readonly brandModel: Model<any>,
    @InjectModel('Product') private readonly productModel: Model<any>,
    @InjectModel('Offer') private readonly offerModel: Model<any>,
    @InjectModel('Partner') private readonly partnerModel: Model<any>,
    @InjectModel('Banner') private readonly bannerModel: Model<any>,
    @InjectModel('Faq') private readonly faqModel: Model<any>,
    @InjectModel('Setting') private readonly settingModel: Model<any>,
    private readonly storageService: StorageService,
  ) {}

  private async storeImage(
    file: any,
    folder: string,
  ): Promise<string | undefined> {
    if (!file?.buffer) return undefined;
    const optimized = await this.storageService.optimizeImage(file.buffer, 600);
    const result: any = await this.storageService.uploadFile(optimized, folder);
    return result.secure_url || result.url || file.originalname;
  }

  // ==========================================================================
  // Categories
  // ==========================================================================

  async createCategory(body: any, files: Record<string, any[]>) {
    const data: any = {
      name: body.name,
      description: body.description,
      isActive: toBool(body.isActive) ?? true,
    };
    const image = await this.storeImage(files?.image?.[0], 'categories');
    if (image) data.image = image;
    const bannerImage = await this.storeImage(
      files?.bannerImage?.[0],
      'categories',
    );
    if (bannerImage) data.bannerImage = bannerImage;

    try {
      const created = await this.categoryModel.create(data);
      return this.serializeCategory(created.toObject());
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException('Category name must be unique');
      }
      throw error;
    }
  }

  async updateCategory(id: string, body: any, files: Record<string, any[]>) {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) throw new NotFoundException('Category not found');

    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.isActive !== undefined) data.isActive = toBool(body.isActive);

    const image = await this.storeImage(files?.image?.[0], 'categories');
    if (image) data.image = image;
    const bannerImage = await this.storeImage(
      files?.bannerImage?.[0],
      'categories',
    );
    if (bannerImage) data.bannerImage = bannerImage;

    Object.assign(category, data);
    await category.save();
    return this.serializeCategory(category.toObject());
  }

  async removeCategory(id: string) {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) throw new NotFoundException('Category not found');
    await category.deleteOne();
    return {
      success: true,
      message: `Category with ID ${id} has been successfully deleted`,
    };
  }

  private serializeCategory(doc: any) {
    return {
      ...doc,
      id: doc._id?.toString(),
      image: doc.image ? generateImageUrl('categories', doc.image) : null,
      bannerImage: doc.bannerImage
        ? generateImageUrl('categories', doc.bannerImage)
        : null,
    };
  }

  // ==========================================================================
  // Brands (logos live in the `partners` folder, mirroring the legacy backend)
  // ==========================================================================

  async createBrand(body: any, logoFile: any) {
    const data: any = {
      name: body.name,
      description: body.description,
      website: body.website,
      isActive: toBool(body.isActive) ?? true,
    };
    const logo = await this.storeImage(logoFile, 'partners');
    if (logo) data.logo = logo;
    try {
      const created = await this.brandModel.create(data);
      return this.serializeBrand(created.toObject());
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException('Brand name must be unique');
      }
      throw error;
    }
  }

  async updateBrand(id: string, body: any, logoFile: any) {
    const brand = await this.brandModel.findById(id).exec();
    if (!brand) throw new NotFoundException(`Brand with ID ${id} not found`);
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.website !== undefined) data.website = body.website;
    if (body.isActive !== undefined) data.isActive = toBool(body.isActive);
    const logo = await this.storeImage(logoFile, 'partners');
    if (logo) data.logo = logo;
    Object.assign(brand, data);
    await brand.save();
    return this.serializeBrand(brand.toObject());
  }

  async removeBrand(id: string) {
    const brand = await this.brandModel.findById(id).exec();
    if (!brand) throw new NotFoundException(`Brand with ID ${id} not found`);
    await brand.deleteOne();
    return {
      success: true,
      message: `Brand with ID ${id} deleted successfully`,
    };
  }

  private serializeBrand(doc: any) {
    return {
      ...doc,
      id: doc._id?.toString(),
      logo: doc.logo ? generateImageUrl('partners', doc.logo) : null,
    };
  }

  // ==========================================================================
  // Products
  // ==========================================================================

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      String(name)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-') || `product-${Date.now()}`;
    let slug = base;
    let counter = 1;
    while (await this.productModel.findOne({ slug }).lean().exec()) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  async createProduct(body: any, imageFiles: any[]) {
    if (!body.name) throw new BadRequestException('Product name is required');
    const data: any = {
      name: body.name,
      slug: body.slug || (await this.uniqueSlug(body.name)),
      shortDescription: body.shortDescription,
      description: body.description,
      color: body.color,
      size: body.size,
      brand: body.brand,
      gender: body.gender,
      model: body.model,
      stock: toNum(body.stock) ?? 0,
      price: toNum(body.price),
      discountPrice: toNum(body.discountPrice),
      tax: toNum(body.tax) ?? 0,
      pfuCharge: toNum(body.pfuCharge) ?? 0,
      isLimitedTimeOffer: toBool(body.isLimitedTimeOffer) ?? true,
      isFeaturedDailyDeal: toBool(body.isFeaturedDailyDeal) ?? false,
      isTrending: toBool(body.isTrending) ?? false,
    };
    if (body.categoryId) {
      try {
        data.categoryId = new mongoose.Types.ObjectId(String(body.categoryId));
      } catch {
        throw new BadRequestException('Invalid categoryId');
      }
    }

    const uploaded: string[] = [];
    for (const file of imageFiles || []) {
      const url = await this.storeImage(file, 'products');
      if (url) uploaded.push(url);
    }
    const existing = parseJsonArray(body.images) || [];
    data.images = uploaded.length > 0 ? [...existing, ...uploaded] : existing;

    const created = await this.productModel.create(data);
    return this.serializeProduct(created.toObject());
  }

  async updateProduct(id: string, body: any, imageFiles: any[]) {
    const product = await this.productModel.findById(id).exec();
    if (!product)
      throw new NotFoundException(`Product with ID ${id} not found`);

    const data: any = {};
    for (const key of [
      'name',
      'shortDescription',
      'description',
      'color',
      'size',
      'brand',
      'gender',
      'model',
    ] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    for (const key of [
      'stock',
      'price',
      'discountPrice',
      'tax',
      'pfuCharge',
    ] as const) {
      if (body[key] !== undefined) data[key] = toNum(body[key]);
    }
    for (const key of [
      'isLimitedTimeOffer',
      'isFeaturedDailyDeal',
      'isTrending',
    ] as const) {
      if (body[key] !== undefined) data[key] = toBool(body[key]);
    }
    if (body.slug !== undefined && body.slug !== '') data.slug = body.slug;
    if (body.categoryId !== undefined) {
      if (body.categoryId === '' || body.categoryId === null) {
        data.categoryId = undefined;
      } else {
        try {
          data.categoryId = new mongoose.Types.ObjectId(
            String(body.categoryId),
          );
        } catch {
          throw new BadRequestException('Invalid categoryId');
        }
      }
    }

    // images: kept currentImages + newly uploaded files
    const uploaded: string[] = [];
    for (const file of imageFiles || []) {
      const url = await this.storeImage(file, 'products');
      if (url) uploaded.push(url);
    }
    const currentImages = parseJsonArray(body.currentImages);
    const bodyImages = parseJsonArray(body.images);
    if (currentImages !== undefined || uploaded.length > 0) {
      data.images = [...(currentImages || []), ...uploaded];
    } else if (bodyImages !== undefined) {
      data.images = bodyImages;
    }

    Object.assign(product, data);
    await product.save();
    return this.serializeProduct(product.toObject());
  }

  async removeProduct(id: string) {
    const product = await this.productModel.findById(id).exec();
    if (!product)
      throw new NotFoundException(`Product with ID ${id} not found`);
    await product.deleteOne();
    return {
      success: true,
      message: `Product with ID ${id} deleted successfully`,
    };
  }

  private serializeProduct(doc: any) {
    return {
      ...doc,
      id: doc._id?.toString(),
      images: Array.isArray(doc.images)
        ? doc.images.map((i: string) => generateImageUrl('products', i))
        : [],
    };
  }

  // ==========================================================================
  // Offers
  // ==========================================================================

  async createOffer(body: any, imageFile: any) {
    const data: any = {
      name: body.name,
      title: body.title,
      discountDetails: body.discountDetails,
      isWiderImage: toBool(body.isWiderImage) ?? false,
      isActive: toBool(body.isActive) ?? true,
    };
    if (body.categoryId) {
      try {
        data.categoryId = new mongoose.Types.ObjectId(String(body.categoryId));
      } catch {
        throw new BadRequestException('Invalid categoryId');
      }
    }
    const image = await this.storeImage(imageFile, 'offers');
    if (image) data.image = image;
    const created = await this.offerModel.create(data);
    return this.serializeOffer(created.toObject());
  }

  async updateOffer(id: string, body: any, imageFile: any) {
    const offer = await this.offerModel.findById(id).exec();
    if (!offer) throw new NotFoundException(`Offer with ID ${id} not found`);
    const data: any = {};
    for (const key of ['name', 'title', 'discountDetails'] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    for (const key of ['isActive', 'isWiderImage'] as const) {
      if (body[key] !== undefined) data[key] = toBool(body[key]);
    }
    if (body.categoryId !== undefined) {
      if (body.categoryId === '' || body.categoryId === null) {
        data.categoryId = undefined;
      } else {
        try {
          data.categoryId = new mongoose.Types.ObjectId(
            String(body.categoryId),
          );
        } catch {
          throw new BadRequestException('Invalid categoryId');
        }
      }
    }
    const image = await this.storeImage(imageFile, 'offers');
    if (image) data.image = image;
    Object.assign(offer, data);
    await offer.save();
    return this.serializeOffer(offer.toObject());
  }

  async removeOffer(id: string) {
    const offer = await this.offerModel.findById(id).exec();
    if (!offer) throw new NotFoundException(`Offer with ID ${id} not found`);
    await offer.deleteOne();
    return {
      success: true,
      message: `Offer with ID ${id} has been successfully deleted`,
    };
  }

  private async serializeOffer(doc: any) {
    let category;
    if (doc.categoryId) {
      category = await this.categoryModel
        .findById(doc.categoryId)
        .lean()
        .exec();
    }
    return {
      ...doc,
      id: doc._id?.toString(),
      categoryId: doc.categoryId,
      category: category
        ? { _id: category._id, id: category._id.toString(), name: category.name }
        : null,
      image: doc.image ? generateImageUrl('offers', doc.image) : null,
    };
  }

  // ==========================================================================
  // Shopping partners
  // ==========================================================================

  async createPartner(body: any, logoFile: any) {
    const data: any = {
      name: body.name,
      description: body.description,
      website: body.website,
      isActive: toBool(body.isActive) ?? true,
    };
    const logo = await this.storeImage(logoFile, 'partners');
    if (logo) data.logo = logo;
    try {
      const created = await this.partnerModel.create(data);
      return this.serializePartner(created.toObject());
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException('Partners name must be unique');
      }
      throw error;
    }
  }

  async updatePartner(id: string, body: any, logoFile: any) {
    const partner = await this.partnerModel.findById(id).exec();
    if (!partner)
      throw new NotFoundException(`Partners with ID ${id} not found`);
    const data: any = {};
    for (const key of ['name', 'description', 'website'] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.isActive !== undefined) data.isActive = toBool(body.isActive);
    const logo = await this.storeImage(logoFile, 'partners');
    if (logo) data.logo = logo;
    Object.assign(partner, data);
    await partner.save();
    return this.serializePartner(partner.toObject());
  }

  async removePartner(id: string) {
    const partner = await this.partnerModel.findById(id).exec();
    if (!partner)
      throw new NotFoundException(`Partners with ID ${id} not found`);
    await partner.deleteOne();
    return {
      success: true,
      message: `Partners with ID ${id} deleted successfully`,
    };
  }

  private serializePartner(doc: any) {
    return {
      ...doc,
      id: doc._id?.toString(),
      logo: doc.logo ? generateImageUrl('partners', doc.logo) : null,
    };
  }

  // ==========================================================================
  // Banners
  // ==========================================================================

  async createBanner(body: any, imageFile: any) {
    const data: any = {
      topText: body.topText,
      bottomText: body.bottomText,
    };
    const bannerImage = await this.storeImage(imageFile, 'banners');
    if (bannerImage) data.bannerImage = bannerImage;
    const count = await this.bannerModel.countDocuments().exec();
    data.order = count;
    const created = await this.bannerModel.create(data);
    return this.serializeBanner(created.toObject());
  }

  async updateBanner(id: string, body: any, imageFile: any) {
    const banner = await this.bannerModel.findById(id).exec();
    if (!banner) throw new NotFoundException('Banner not found');
    const data: any = {};
    if (body.topText !== undefined) data.topText = body.topText;
    if (body.bottomText !== undefined) data.bottomText = body.bottomText;
    const bannerImage = await this.storeImage(imageFile, 'banners');
    if (bannerImage) data.bannerImage = bannerImage;
    Object.assign(banner, data);
    await banner.save();
    return this.serializeBanner(banner.toObject());
  }

  async removeBanner(id: string) {
    const banner = await this.bannerModel.findById(id).exec();
    if (!banner) throw new NotFoundException('Banner not found');
    await banner.deleteOne();
    return {
      success: true,
      message: `Banner with ID ${id} deleted successfully`,
    };
  }

  /** Swap display order with the neighbour (direction: 'up' | 'down'). */
  async updateBannerOrder(id: string, direction: string) {
    if (!['up', 'down'].includes(direction)) {
      throw new BadRequestException('Invalid direction');
    }
    const banner = await this.bannerModel.findById(id).exec();
    if (!banner) throw new NotFoundException('Banner not found');

    const all = await this.bannerModel.find().sort({ order: 1 }).exec();
    const index = all.findIndex((b) => String(b._id) === String(id));
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= all.length) {
      return { success: true, message: 'No swap possible' };
    }
    const target = all[targetIndex];
    const temp = banner.order;
    banner.order = target.order;
    target.order = temp;
    await banner.save();
    await target.save();
    return { success: true, message: 'Order updated successfully' };
  }

  private serializeBanner(doc: any) {
    return {
      ...doc,
      id: doc._id?.toString(),
      bannerImage: doc.bannerImage
        ? generateImageUrl('banners', doc.bannerImage)
        : null,
    };
  }

  // ==========================================================================
  // FAQs
  // ==========================================================================

  async createFaq(body: any) {
    const last: any = await this.faqModel
      .findOne()
      .sort({ order: -1 })
      .lean()
      .exec();
    const order = last ? Number(last.order) + 1 : 0;
    const created = await this.faqModel.create({
      question: body.question,
      answer: body.answer,
      order,
    });
    const obj = created.toObject();
    return { ...obj, id: obj._id?.toString() };
  }

  async updateFaq(id: string, body: any) {
    const faq = await this.faqModel.findById(id).exec();
    if (!faq) throw new NotFoundException(`FAQ with ID ${id} not found`);
    if (body.question !== undefined) faq.question = body.question;
    if (body.answer !== undefined) faq.answer = body.answer;
    if (body.order !== undefined) faq.order = toNum(body.order);
    await faq.save();
    const obj = faq.toObject();
    return { ...obj, id: obj._id?.toString() };
  }

  async removeFaq(id: string) {
    const faq = await this.faqModel.findById(id).exec();
    if (!faq) throw new NotFoundException(`FAQ with ID ${id} not found`);
    await faq.deleteOne();
    await this.normalizeFaqOrders();
    return {
      success: true,
      message: `FAQ with ID ${id} has been successfully deleted`,
    };
  }

  async updateFaqOrder(id: string, direction: string) {
    if (!['up', 'down'].includes(direction)) {
      throw new BadRequestException('Invalid direction');
    }
    const current = await this.faqModel.findById(id).exec();
    if (!current) throw new NotFoundException('FAQ not found');
    const faqs = await this.faqModel.find().sort({ order: 1 }).exec();
    const index = faqs.findIndex((f) => String(f._id) === String(id));
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= faqs.length) {
      return { success: true, message: 'No swap possible' };
    }
    const target = faqs[targetIndex];
    const temp = current.order;
    current.order = target.order;
    target.order = temp;
    await current.save();
    await target.save();
    return { success: true, message: 'Order updated successfully' };
  }

  async reorderFaqs(faqList: { id: string; order: number }[]) {
    if (!Array.isArray(faqList)) {
      throw new BadRequestException('faqs array is required');
    }
    await Promise.all(
      faqList.map((item) =>
        this.faqModel
          .findByIdAndUpdate(item.id, { $set: { order: item.order } })
          .exec(),
      ),
    );
    return { success: true, message: 'Order updated' };
  }

  private async normalizeFaqOrders() {
    const faqs = await this.faqModel.find().sort({ order: 1 }).exec();
    await Promise.all(
      faqs.map((faq, index) => {
        faq.order = index;
        return faq.save();
      }),
    );
  }

  // ==========================================================================
  // Settings
  // ==========================================================================

  async upsertSetting(body: { key?: string; value?: string; label?: string }) {
    if (!body.key || body.value === undefined) {
      throw new BadRequestException('Key and value are required');
    }
    const setting = await this.settingModel.findOne({ key: body.key }).exec();
    if (setting) {
      setting.value = body.value;
      if (body.label) setting.label = body.label;
      setting.updated_at = new Date();
      await setting.save();
      return { created: false, setting };
    }
    const created = await this.settingModel.create({
      key: body.key,
      value: body.value,
      label: body.label,
      updated_at: new Date(),
    });
    return { created: true, setting: created };
  }

  async removeSetting(keyOrId: string) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(keyOrId);
    const setting = isObjectId
      ? await this.settingModel.findById(keyOrId).exec()
      : await this.settingModel.findOne({ key: keyOrId }).exec();
    if (!setting) throw new NotFoundException('Setting not found');
    await setting.deleteOne();
    return {
      success: true,
      message: `Setting with key ${setting.key} deleted successfully`,
    };
  }
}

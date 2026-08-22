import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class FaqsService {
  constructor(@InjectModel('Faq') private readonly faqModel: Model<any>) {}

  async findAll(query: Record<string, any> = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {};
    if (query.search) {
      filter.$or = [
        { question: { $regex: query.search, $options: 'i' } },
        { answer: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.faqModel
        .find(filter)
        .sort({ order: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.faqModel.countDocuments(filter).exec(),
    ]);
    return {
      faqs: rows.map((r) => (r.toObject ? r.toObject() : r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
    };
  }

  async findById(id: string) {
    const faq = await this.faqModel.findById(id).exec();
    if (!faq) {
      throw new NotFoundException('Faq not found');
    }
    return faq.toObject ? faq.toObject() : faq;
  }
}

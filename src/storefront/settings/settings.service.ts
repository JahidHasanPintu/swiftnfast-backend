import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel('Setting') private readonly settingModel: Model<any>,
  ) {}

  async findAll() {
    return this.settingModel
      .find({})
      .sort({ updated_at: -1 })
      .select('key value label updated_at createdAt updatedAt -_id')
      .exec();
  }

  async findByKey(key: string) {
    const setting = await this.settingModel
      .findOne({ key })
      .select('key value label updated_at createdAt updatedAt -_id')
      .exec();
    if (!setting) {
      throw new HttpException({ message: 'Setting not found' }, 404);
    }
    return setting.toObject ? setting.toObject() : setting;
  }

  async getByKey(key: string): Promise<any | null> {
    return this.settingModel.findOne({ key }).exec();
  }

  async upsert(key: string, value: string, label?: string) {
    const now = new Date();
    const existing = await this.settingModel.findOne({ key }).exec();
    if (existing) {
      existing.value = value;
      existing.label = label ?? existing.label;
      existing.updated_at = now;
      await existing.save();
      return existing;
    }
    return this.settingModel.create({
      key,
      value,
      label: label ?? key,
      updated_at: now,
    });
  }
}

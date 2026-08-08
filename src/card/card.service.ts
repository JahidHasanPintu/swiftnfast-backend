import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CardBeneFiciaryDocument } from './interface/addCard.interface';
import { Model } from 'mongoose';
import { CreateCardBeneficiaryDto } from './dto/addCard.dto';

@Injectable()
export class CardService {
  constructor(
    @InjectModel('Cards')
    private cardBeneficiaryModel: Model<CardBeneFiciaryDocument>,
  ) {}

  // //create  a beneficiary
  // async create(createCardBeneficiaryDto: CreateCardBeneficiaryDto): Promise<CardBeneFiciaryDocument> {
  //     const createdCardBeneficiary = new this.cardBeneficiaryModel(createCardBeneficiaryDto);
  //     return createdCardBeneficiary.save();
  // }

  // Service method
  async create(
    createCardBeneficiaryDto: CreateCardBeneficiaryDto,
  ): Promise<CardBeneFiciaryDocument> {
    const createdCardBeneficiary = new this.cardBeneficiaryModel(
      createCardBeneficiaryDto,
    );
    return createdCardBeneficiary.save();
  }

  //get all cards info
  async getAllCardBeneficiaries(): Promise<CardBeneFiciaryDocument[]> {
    return this.cardBeneficiaryModel.find().sort({ createdAt: -1 });
  }

  async getCardBeneficiariesByCardType(
    cardType: string,
  ): Promise<CardBeneFiciaryDocument[]> {
    try {
      return this.cardBeneficiaryModel.find({ cardType }).exec();
    } catch (error) {
      throw new Error(
        `Error fetching card beneficiaries by cardType: ${error.message}`,
      );
    }
  }

  // card info by card number

  async findByCardNumber(cardNumber: number): Promise<CardBeneFiciaryDocument> {
    const cardInfo = await this.cardBeneficiaryModel
      .findOne({ cardNumber })
      .exec();
    if (!cardInfo) {
      throw new NotFoundException(`Card with number ${cardNumber} not found`);
    }
    return cardInfo;
  }

  // update card beneficiary

  async updateCardBeneficiary(
    cardNumber: number,
    updateDto: CreateCardBeneficiaryDto,
  ): Promise<CardBeneFiciaryDocument> {
    const cardInfo = await this.cardBeneficiaryModel
      .findOneAndUpdate({ cardNumber }, { $set: updateDto }, { new: true })
      .exec();

    if (!cardInfo) {
      throw new NotFoundException(`Card with number ${cardNumber} not found`);
    }

    return cardInfo;
  }

  async deleteCardBeneficiary(
    cardNumber: number,
  ): Promise<{ message: string }> {
    const result = await this.cardBeneficiaryModel
      .deleteOne({ cardNumber })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Card with number ${cardNumber} not found`);
    }

    return {
      message: `Card with number ${cardNumber} has been deleted successfully`,
    };
  }
}

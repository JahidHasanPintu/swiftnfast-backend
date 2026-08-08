import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShippingAddressDocument } from './interfaces/shippingAddress.interface.';
import { ShippingAddressDto } from './dto/shippingAddress.dto';

@Injectable()
export class ShippingAddressService {


    constructor(@InjectModel('shipping-address') private shippingAddressModel: Model<ShippingAddressDocument>) { }



    async createCancelOrders(shippingAddressDto: ShippingAddressDto): Promise<ShippingAddressDocument> {
        const createCancelOrders = new this.shippingAddressModel(shippingAddressDto);
        return createCancelOrders.save();
    }


    //get all cards info
    async getAllCancelledOrdersList(): Promise<ShippingAddressDocument[]> {
        return this.shippingAddressModel.find().sort({ createdAt: -1 });
    }

    // New method to find by ID
    async findById(id: string): Promise<ShippingAddressDocument> {
        const shippingAddress = await this.shippingAddressModel.findById(id).exec();
        if (!shippingAddress) {
          throw new NotFoundException('Shipping address not found');
        }
        return shippingAddress;
      }
    

      async deleteById(id: string): Promise<void> {
        const result = await this.shippingAddressModel.findByIdAndDelete(id).exec();
        if (!result) {
          throw new NotFoundException('Shipping address not found');
        }
      }
      


      async updateById(id: string, updateShippingAddressDto: ShippingAddressDto): Promise<ShippingAddressDocument> {
        const updatedShippingAddress = await this.shippingAddressModel.findByIdAndUpdate(id, updateShippingAddressDto, { new: true }).exec();
        if (!updatedShippingAddress) {
          throw new NotFoundException('Shipping address not found');
        }
        return updatedShippingAddress;
      }


      async getShipmentInfoBySource(source: string): Promise<ShippingAddressDocument[]> {
        return this.shippingAddressModel.find({ source }).exec();
      }
      

}

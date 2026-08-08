import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CancelledOrderDocument } from './interfaces/cancelOrders.interface';
import { Model } from 'mongoose';
import { CancelledOrdersDto } from './dto/cancelOrders.dto';

@Injectable()
export class CancelledOrdersService {

    constructor(@InjectModel('cancelled-orders') private cancelOrdersModel: Model<CancelledOrderDocument>) { }



    async createCancelOrders(cancelledOrdersDto: CancelledOrdersDto): Promise<CancelledOrderDocument> {
        const createCancelOrders = new this.cancelOrdersModel(cancelledOrdersDto);
        return createCancelOrders.save();
    }


    async createBulkCancelOrders(bulkCancelledOrdersDto: CancelledOrdersDto[]): Promise<CancelledOrderDocument[]> {
        // Handle bulk cancellation logic here
        const createdOrders = await Promise.all(bulkCancelledOrdersDto.map(data => this.createCancelOrders(data)));
        return createdOrders;
    }



    //get all cards info
    async getAllCancelledOrdersList(): Promise<CancelledOrderDocument[]> {
        return this.cancelOrdersModel.find().sort({ createdAt: -1 });
    }


}

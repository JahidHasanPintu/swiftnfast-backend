import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';

import { Model } from 'mongoose';
import { PurchaseDocument } from '../interfaces/puchase.interface';

@Injectable()
export class SearchPurchaseService {
    constructor(
        @InjectModel('Purchases') public purchaseModel: Model<PurchaseDocument>,
    ) { }



    // async searchPurchase(
    //     page = 1,
    //     pageSize = 10,
    //     searchTerm?: string, // New parameter for search
    // ): Promise<CommonPaginationResponse<any>> {
    //     const skip = (page - 1) * pageSize;
    //     let query = {};

    //     // If search term is provided, create a regex pattern to match
    //     if (searchTerm) {
    //         const regex = new RegExp(searchTerm, 'i'); // Case-insensitive search
    //         query = {
    //             $or: [
    //                 { customerId: regex },
    //                 { customerName: regex },
    //                 { orderId: regex },
    //             ],
    //         };
    //     }

    //     const count = await this.purchaseModel.countDocuments(query);
    //     const purchases = await this.purchaseModel
    //         .find(query)
    //         .sort({ createdAt: -1 })
    //         .skip(skip)
    //         .limit(pageSize)
    //         .select('+confirmationMail');

    //     return {
    //         data: purchases,
    //         meta: {
    //             page,
    //             pageSize,
    //             totalItems: count,
    //             totalPages: Math.ceil(count / pageSize),
    //         },
    //     };
    // }


    async searchPurchase(
        page = 1,
        pageSize = 10,
        searchTerm?: string, // New parameter for search
    ): Promise<CommonPaginationResponse<any>> {
        const skip = (page - 1) * pageSize;
        let query = {};
    
        // If search term is provided, create a regex pattern to match
        if (searchTerm) {
            const regex = new RegExp(searchTerm, 'i'); // Case-insensitive search
            query = {
                $or: [
                    { customerId: regex },
                    { customerName: regex },
                    { orderId: regex },
                ],
            };
        }
    
        const count = await this.purchaseModel.countDocuments(query);
        const purchases = await this.purchaseModel
            .find(query)
            .sort({ purchaseDate: -1 }) // Sort by purchaseDate in descending order
            .skip(skip)
            .limit(pageSize)
            .select('+confirmationMail')
            .populate('shipmentId', 'shipmentName');
    
        return {
            data: purchases,
            meta: {
                page,
                pageSize,
                totalItems: count,
                totalPages: Math.ceil(count / pageSize),
            },
        };
    }
    
}

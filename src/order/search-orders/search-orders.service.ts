import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { OrderDocument } from '../interfaces/order.interface';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';
import { Model, PipelineStage } from 'mongoose';

@Injectable()
export class SearchOrdersService {

    constructor(

        @InjectModel('Orders') private orderModel: Model<OrderDocument>,

    ) { }


   
// workable one 
    
    // async searchOrders(query: string, page: number = 1, pageSize: number = 10): Promise<CommonPaginationResponse<OrderDocument>> {
    //     try {
    //         page = Number(page);
    //         pageSize = Number(pageSize);
    //         const skip = (page - 1) * pageSize;
    //         const normalizedQuery = query.toLowerCase();

    //         const searchCriteria: PipelineStage = {
    //             $match: {
    //                 $or: [
    //                     { customerName: { $regex: normalizedQuery, $options: 'i' } },
    //                     { orderId: { $regex: normalizedQuery, $options: 'i' } },
    //                     { productUrl: { $regex: normalizedQuery, $options: 'i' } },
    //                     { websiteUrl: { $regex: normalizedQuery, $options: 'i' } },
    //                     { contactNo: { $regex: normalizedQuery, $options: 'i' } },
    //                     { orderNotes: { $regex: normalizedQuery, $options: 'i' } },
    //                     { status: { $regex: new RegExp(normalizedQuery, 'i') } },
    //                 ]
    //             }
    //         };

    //         const aggregationPipeline: PipelineStage[] = [
    //             searchCriteria,
    //             {
    //                 $group: {
    //                     _id: '$orderId',
    //                     orders: { $push: '$$ROOT' },
    //                 },
    //             },
    //             {
    //                 $replaceRoot: {
    //                     newRoot: {
    //                         $let: {
    //                             vars: {
    //                                 pendingOrder: {
    //                                     $arrayElemAt: [
    //                                         {
    //                                             $filter: {
    //                                                 input: '$orders',
    //                                                 as: 'order',
    //                                                 cond: { $eq: ['$$order.status', 'Pending'] },
    //                                             },
    //                                         },
    //                                         0,
    //                                     ],
    //                                 },
    //                             },
    //                             in: {
    //                                 $cond: [
    //                                     { $ne: [{ $type: '$$pendingOrder' }, 'missing'] },
    //                                     '$$pendingOrder',
    //                                     { $arrayElemAt: ['$orders', 0] },
    //                                 ],
    //                             },
    //                         },
    //                     },
    //                 },
    //             },
    //             { $sort: { orderDate: -1 } }, // Sort by order date
    //             { $skip: skip },
    //             { $limit: pageSize },
    //             {
    //                 $lookup: {
    //                     from: 'customers',
    //                     localField: 'orderId',
    //                     foreignField: 'orderId',
    //                     as: 'customer',
    //                 },
    //             },
    //             { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    //         ];

    //         const searchResults = await this.orderModel.aggregate(aggregationPipeline).exec();

    //         // Get the count of unique order IDs
    //         const countPipeline: PipelineStage[] = [
    //             searchCriteria,
    //             { $group: { _id: '$orderId' } },
    //         ];

    //         const countResults = await this.orderModel.aggregate(countPipeline).exec();
    //         const count = countResults.length;

    //         return {
    //             data: searchResults,
    //             meta: {
    //                 page,
    //                 pageSize,
    //                 totalItems: count,
    //                 totalPages: Math.ceil(count / pageSize),
    //             },
    //         };
    //     } catch (error) {
    //         console.error('Error searching orders:', error);
    //         throw error;
    //     }
    // }
  
    
    
    
// modified one 

async searchOrders(query: string, page: number = 1, pageSize: number = 10): Promise<CommonPaginationResponse<OrderDocument>> {
    try {
        page = Number(page);
        pageSize = Number(pageSize);
        const skip = (page - 1) * pageSize;
        const normalizedQuery = query.toLowerCase();

        const searchCriteria: PipelineStage = {
            $match: {
                $or: [
                    { customerName: { $regex: normalizedQuery, $options: 'i' } },
                    { orderId: { $regex: normalizedQuery, $options: 'i' } },
                    { productUrl: { $regex: normalizedQuery, $options: 'i' } },
                    { websiteUrl: { $regex: normalizedQuery, $options: 'i' } },
                    { contactNo: { $regex: normalizedQuery, $options: 'i' } },
                    { orderNotes: { $regex: normalizedQuery, $options: 'i' } },
                    { status: { $regex: new RegExp(normalizedQuery, 'i') } },
                ]
            }
        };

        const aggregationPipeline: PipelineStage[] = [
            searchCriteria,
            {
                $group: {
                    _id: '$orderId', // Group by orderId to ensure uniqueness
                    latestOrder: { $first: '$$ROOT' }, // Get the most recent order for each orderId
                },
            },
            {
                $lookup: {
                    from: 'customers',
                    let: { customerId: '$latestOrder.customerId', orderId: '$_id' }, // Use both customerId and orderId for matching
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $or: [
                                        { $eq: ['$_id', '$$customerId'] }, // Match by customerId (ObjectId reference for newer orders)
                                        { $eq: ['$orderId', '$$orderId'] }, // Match by orderId (for older orders without customerId)
                                    ],
                                },
                            },
                        },
                        {
                            $project: {
                                customerId: 1,
                                customerName: 1,
                                contactNumber: 1,
                                emailAddress: 1,
                                shippingAddress: 1,
                                districtName: 1,
                                totalAdvance: 1,
                                grandTotal: 1,
                                sourceOfOrder: 1,
                            },
                        },
                    ],
                    as: 'customer',
                },
            },
            {
                $unwind: {
                    path: '$customer',
                    preserveNullAndEmptyArrays: true, // Keep orders even if no customer is found
                },
            },
            {
                $replaceRoot: {
                    newRoot: {
                        orderId: '$_id',
                        _id: '$latestOrder._id',
                        customerId: '$latestOrder.customerId',
                        customerName: '$latestOrder.customerName',
                        orderDate: '$latestOrder.orderDate',
                        isPurchased: '$latestOrder.isPurchased',
                        orderItemIndex: '$latestOrder.orderItemIndex',
                        productUrl: '$latestOrder.productUrl',
                        quantity: '$latestOrder.quantity',
                        couponCode: '$latestOrder.couponCode',
                        prodDesc: '$latestOrder.prodDesc',
                        color: '$latestOrder.color',
                        size: '$latestOrder.size',
                        origin: '$latestOrder.origin',
                        uniPrice: '$latestOrder.uniPrice',
                        totalPrice: '$latestOrder.totalPrice',
                        advancePayment: '$latestOrder.advancePayment',
                        remainingAmount: '$latestOrder.remainingAmount',
                        orderNotes: '$latestOrder.orderNotes',
                        websiteUrl: '$latestOrder.websiteUrl',
                        status: '$latestOrder.status',
                        createdBy: '$latestOrder.createdBy',
                        createdAt: '$latestOrder.createdAt',
                        updatedAt: '$latestOrder.updatedAt',
                        customer: { $ifNull: ['$customer', null] },
                    },
                },
            },
            { $sort: { orderDate: -1 } }, // Sort by order date
            { $skip: skip },
            { $limit: pageSize },
        ];

        const searchResults = await this.orderModel.aggregate(aggregationPipeline).exec();

        // Get the count of unique order IDs
        const countPipeline: PipelineStage[] = [
            searchCriteria,
            { $group: { _id: '$orderId' } },
        ];

        const countResults = await this.orderModel.aggregate(countPipeline).exec();
        const count = countResults.length;

        return {
            data: searchResults,
            meta: {
                page,
                pageSize,
                totalItems: count,
                totalPages: Math.ceil(count / pageSize),
            },
        };
    } catch (error) {
        console.error('Error searching orders:', error);
        throw error;
    }
}






    
    

    
    

    
    
    
    
    
    






}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { OrderDocument } from '../interfaces/order.interface';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';
import { Model, PipelineStage } from 'mongoose';
import {
  buildOrderGroupingStages,
  buildDistinctOrderCountStages,
} from '../order.aggregations';

@Injectable()
export class SearchOrdersService {
  constructor(
    @InjectModel('Orders') private orderModel: Model<OrderDocument>,
  ) {}

  async searchOrders(
    query: string,
    page = 1,
    pageSize = 10,
  ): Promise<CommonPaginationResponse<OrderDocument>> {
    page = Number(page);
    pageSize = Number(pageSize);
    const skip = (page - 1) * pageSize;
    const normalizedQuery = query.toLowerCase();
    const regex = new RegExp(normalizedQuery, 'i');

    const postLookupSearch: PipelineStage = {
      $match: {
        $or: [
          { customerName: { $regex: regex } },
          { orderId: { $regex: regex } },
          { productUrl: { $regex: regex } },
          { websiteUrl: { $regex: regex } },
          { contactNo: { $regex: regex } },
          { orderNotes: { $regex: regex } },
          { status: { $regex: regex } },
          { 'customer.contactNumber': { $regex: regex } },
          { 'customer.customerName': { $regex: regex } },
        ],
      },
    };

    const [result] = await this.orderModel.aggregate([
      {
        $facet: {
          data: [
            ...buildOrderGroupingStages(),
            postLookupSearch,
            { $sort: { orderDate: -1 } },
            { $skip: skip },
            { $limit: pageSize },
          ],
          totalCount: [
            ...buildOrderGroupingStages(),
            postLookupSearch,
            ...buildDistinctOrderCountStages(),
          ],
        },
      },
    ]);

    const totalItems = result?.totalCount?.[0]?.count ?? 0;

    return {
      data: result?.data ?? [],
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }
}

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
        ],
      },
    };

    const [result] = await this.orderModel.aggregate([
      searchCriteria,
      {
        $facet: {
          data: [
            ...buildOrderGroupingStages(),
            { $sort: { orderDate: -1 } },
            { $skip: skip },
            { $limit: pageSize },
          ],
          totalCount: buildDistinctOrderCountStages(),
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

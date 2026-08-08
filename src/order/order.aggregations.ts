import { PipelineStage } from 'mongoose';

/**
 * Stages that turn raw order line-items into one document per unique orderId.
 * - Sorts by createdAt BEFORE $group so $first picks the true latest item.
 * - Computes a `calculatedStatus` across all items of an order.
 * - Attaches the linked customer and flattens with $replaceRoot.
 * Shared by getAllOrders and searchOrders.
 */
export function buildOrderGroupingStages(): PipelineStage.FacetPipelineStage[] {
  return [
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$orderId',
        orders: { $push: '$$ROOT' },
        latestOrder: { $first: '$$ROOT' },
      },
    },
    {
      $addFields: {
        calculatedStatus: {
          $cond: {
            if: { $in: ['Pending', '$orders.status'] },
            then: 'Pending',
            else: {
              $cond: {
                if: {
                  $and: [
                    { $in: ['Cancelled', '$orders.status'] },
                    { $not: { $in: ['Pending', '$orders.status'] } },
                  ],
                },
                then: 'Cancelled',
                else: 'Purchased',
              },
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: 'customers',
        let: { customerId: '$latestOrder.customerId', orderId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$_id', '$$customerId'] },
                  { $eq: ['$orderId', '$$orderId'] },
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
        preserveNullAndEmptyArrays: true,
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
          status: '$calculatedStatus',
          createdBy: '$latestOrder.createdBy',
          createdAt: '$latestOrder.createdAt',
          updatedAt: '$latestOrder.updatedAt',
          customer: { $ifNull: ['$customer', null] },
        },
      },
    },
  ];
}

/** Counts distinct orderIds (used for truthful pagination meta). */
export function buildDistinctOrderCountStages(): PipelineStage.FacetPipelineStage[] {
  return [{ $group: { _id: '$orderId' } }, { $count: 'count' }];
}

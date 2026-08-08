import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel('Orders') private orderModel: Model<any>,
    @InjectModel('Customer') private customerModel: Model<any>,
    @InjectModel('Purchases') private purchaseModel: Model<any>,
    @InjectModel('CancelledOrder') private cancelledOrderModel: Model<any>,
    @InjectModel('Payments') private paymentModel: Model<any>,
  ) {}

  private getDateFilter(startDate?: string, endDate?: string) {
    const filter: any = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }
    return filter;
  }

  async getOverview(startDate?: string, endDate?: string) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    // Total Orders
    const totalOrders = await this.orderModel.countDocuments(dateFilter);

    // Orders by status
    const pendingOrders = await this.orderModel.countDocuments({
      ...dateFilter,
      status: 'Pending',
    });
    const purchasedOrders = await this.orderModel.countDocuments({
      ...dateFilter,
      status: 'Purchased',
    });
    const cancelledOrders = await this.cancelledOrderModel.countDocuments(
      dateFilter,
    );

    // Total Revenue (from orders)
    const revenueResult = await this.orderModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPrice' },
          totalAdvance: { $sum: '$advancePayment' },
          totalRemaining: { $sum: '$remainingAmount' },
        },
      },
    ]);

    // Total Profit (from purchases)
    const profitResult = await this.purchaseModel.aggregate([
      {
        $match: {
          ...this.getDateFilter(startDate, endDate),
        },
      },
      {
        $group: {
          _id: null,
          totalProfit: {
            $sum: {
              $convert: {
                input: {
                  $trim: {
                    input: {
                      $replaceAll: {
                        input: '$grossProfit',
                        find: '৳',
                        replacement: '',
                      },
                    },
                  },
                },
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
          totalSelling: {
            $sum: {
              $convert: {
                input: {
                  $trim: {
                    input: {
                      $replaceAll: {
                        input: '$selling',
                        find: '৳',
                        replacement: '',
                      },
                    },
                  },
                },
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
          totalBuying: {
            $sum: {
              $convert: {
                input: {
                  $trim: {
                    input: {
                      $replaceAll: {
                        input: '$buyingBDT',
                        find: '৳',
                        replacement: '',
                      },
                    },
                  },
                },
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);

    // Total Customers
    const totalCustomers = await this.customerModel.countDocuments(dateFilter);

    // New Customers (this period)
    const newCustomers = dateFilter.createdAt
      ? await this.customerModel.countDocuments(dateFilter)
      : 0;

    // Total Purchases
    const totalPurchases = await this.purchaseModel.countDocuments(
      this.getDateFilter(startDate, endDate),
    );

    return {
      totalOrders,
      pendingOrders,
      purchasedOrders,
      cancelledOrders,
      totalRevenue: revenueResult[0]?.totalRevenue || 0,
      totalAdvance: revenueResult[0]?.totalAdvance || 0,
      totalRemaining: revenueResult[0]?.totalRemaining || 0,
      totalProfit: profitResult[0]?.totalProfit || 0,
      totalSelling: profitResult[0]?.totalSelling || 0,
      totalBuying: profitResult[0]?.totalBuying || 0,
      totalCustomers,
      newCustomers,
      totalPurchases,
    };
  }

  async getRevenueChart(
    startDate?: string,
    endDate?: string,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    let dateFormat: any;
    switch (groupBy) {
      case 'day':
        dateFormat = {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        };
        break;
      case 'week':
        dateFormat = {
          $dateToString: { format: '%Y-W%V', date: '$createdAt' },
        };
        break;
      case 'month':
        dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
    }

    const result = await this.orderModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: dateFormat,
          revenue: { $sum: '$totalPrice' },
          orders: { $sum: 1 },
          advance: { $sum: '$advancePayment' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result.map((item) => ({
      date: item._id,
      revenue: item.revenue,
      orders: item.orders,
      advance: item.advance,
    }));
  }

  async getOrderStatusChart(startDate?: string, endDate?: string) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    const statuses = await this.orderModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const cancelledCount = await this.cancelledOrderModel.countDocuments(
      dateFilter,
    );

    const result = statuses.map((item) => ({
      status: item._id,
      count: item.count,
    }));

    // Add cancelled orders
    if (cancelledCount > 0) {
      result.push({
        status: 'Cancelled',
        count: cancelledCount,
      });
    }

    return result;
  }

  async getTopProducts(startDate?: string, endDate?: string, limit = 10) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    const result = await this.orderModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$prodDesc',
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalPrice' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
    ]);

    return result.map((item) => ({
      product: item._id,
      quantity: item.totalQuantity,
      revenue: item.totalRevenue,
      orders: item.orderCount,
    }));
  }

  async getTopCustomers(startDate?: string, endDate?: string, limit = 10) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    const result = await this.orderModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            customerId: '$customerId',
            customerName: '$customerName',
          },
          totalSpent: { $sum: '$totalPrice' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: limit },
    ]);

    return result.map((item) => ({
      customerId: item._id.customerId,
      customerName: item._id.customerName,
      totalSpent: item.totalSpent,
      orders: item.orderCount,
    }));
  }

  async getSalesByCountry(startDate?: string, endDate?: string) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    const result = await this.orderModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$origin',
          totalRevenue: { $sum: '$totalPrice' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    return result.map((item) => ({
      country: item._id,
      revenue: item.totalRevenue,
      orders: item.orderCount,
    }));
  }

  async getRecentOrders(limit = 10) {
    const orders = await this.orderModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        'orderId customerName prodDesc totalPrice status createdAt orderDate',
      )
      .exec();

    return orders;
  }

  async getProfitAnalysis(startDate?: string, endDate?: string) {
    const purchaseDateFilter: any = {};

    if (startDate || endDate) {
      purchaseDateFilter.purchaseDate = {};
      if (startDate) {
        purchaseDateFilter.purchaseDate.$gte = new Date(startDate);
      }
      if (endDate) {
        purchaseDateFilter.purchaseDate.$lte = new Date(endDate);
      }
    }

    const cleanNumber = (field: string) => ({
      $convert: {
        input: {
          $trim: {
            input: {
              $replaceAll: {
                input: field,
                find: '৳',
                replacement: '',
              },
            },
          },
        },
        to: 'double',
        onError: 0,
        onNull: 0,
      },
    });

    const result = await this.purchaseModel.aggregate([
      { $match: purchaseDateFilter },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: cleanNumber('$grossProfit') },
          totalSelling: { $sum: cleanNumber('$selling') },
          totalBuying: { $sum: cleanNumber('$buyingBDT') },
          totalOrders: { $sum: 1 },
          averageProfit: { $avg: cleanNumber('$grossProfit') },
        },
      },
    ]);

    const data = result[0] || {
      totalProfit: 0,
      totalSelling: 0,
      totalBuying: 0,
      totalOrders: 0,
      averageProfit: 0,
    };

    const profitMargin =
      data.totalSelling > 0
        ? ((data.totalProfit / data.totalSelling) * 100).toFixed(2)
        : '0';

    return {
      ...data,
      profitMargin: Number(profitMargin),
    };
  }
}

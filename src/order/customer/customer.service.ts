import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { CustomerDocument } from '../interfaces/customer.interface';
import { InjectModel } from '@nestjs/mongoose';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';
import { buildCustomerDedupPipeline, extractDedupResult } from './customer.aggregation';
import * as ExcelJS from 'exceljs';

@Injectable()
export class CustomerService {
    constructor(@InjectModel('Customer') private readonly customerModel: Model<CustomerDocument>) { }



    async getAllCustomers(): Promise<CustomerDocument[]> {
        const customers = await this.customerModel.find().sort({ createdAt: -1 });
        return customers;
    }



    async searchCustomers(
        keyword: string,
        page: number = 1,
        pageSize: number = 10,
      ): Promise<CommonPaginationResponse<CustomerDocument>> {
        // Build the search query
        const searchConditions = [];

        if (keyword) {
          // Search by contact number (partial match)
          searchConditions.push({ contactNumber: { $regex: keyword, $options: 'i' } });

          // Search by customer ID (exact match)
          searchConditions.push({ customerId: keyword });

          // Search by name (partial match)
          searchConditions.push({ customerName: { $regex: keyword, $options: 'i' } });
        }

        // Combine conditions with OR logic (if keyword exists)
        const searchQuery = keyword ? { $or: searchConditions } : {};

        // Deduplicated, paginated results (one customer per phone number)
        const result = await this.customerModel.aggregate(
          buildCustomerDedupPipeline(searchQuery, page, pageSize),
        );
        const { customers, totalItems } = extractDedupResult(result);

        return {
          data: customers,
          meta: {
            page,
            pageSize,
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize),
          },
        };
      }



    async getAllCustomersForXLS(): Promise<ExcelJS.Buffer> {
        // Deduplicated customers (one per contact number), newest first
        const result = await this.customerModel.aggregate(
          buildCustomerDedupPipeline({}, 1, 1000000),
        );
        const { customers } = extractDedupResult(result);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Customers');

        sheet.columns = [
          { header: 'Customer ID', key: 'customerId', width: 16 },
          { header: 'Name', key: 'customerName', width: 24 },
          { header: 'Contact Number', key: 'contactNumber', width: 18 },
          { header: 'Email', key: 'emailAddress', width: 28 },
          { header: 'Shipping Address', key: 'shippingAddress', width: 40 },
          { header: 'District', key: 'districtName', width: 16 },
          { header: 'Source', key: 'sourceOfOrder', width: 14 },
          { header: 'Grand Total', key: 'grandTotal', width: 12 },
          { header: 'Advance', key: 'totalAdvance', width: 12 },
          { header: 'Order Date', key: 'orderDate', width: 14 },
          { header: 'Created By', key: 'createdBy', width: 16 },
        ];

        customers.forEach((customer) => {
          sheet.addRow({
            customerId: customer.customerId,
            customerName: customer.customerName,
            contactNumber: customer.contactNumber,
            emailAddress: customer.emailAddress || '',
            shippingAddress: customer.shippingAddress,
            districtName: customer.districtName,
            sourceOfOrder: customer.sourceOfOrder,
            grandTotal: customer.grandTotal ?? 0,
            totalAdvance: customer.totalAdvance ?? 0,
            orderDate: customer.orderDate
              ? new Date(customer.orderDate).toISOString().split('T')[0]
              : '',
            createdBy: customer.createdBy || '',
          });
        });

        return workbook.xlsx.writeBuffer();
      }



}

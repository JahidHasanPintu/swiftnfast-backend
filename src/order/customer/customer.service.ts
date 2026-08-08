import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { CustomerDocument } from '../interfaces/customer.interface';
import { InjectModel } from '@nestjs/mongoose';
import { SearchCustomerDto } from '../dtos/searchCustomer.dto';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';

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
        const skip = (page - 1) * pageSize;
      
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
      
        // Fetch paginated results
        const [customers, totalItems] = await Promise.all([
          this.customerModel
            .find(searchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .exec(),
          this.customerModel.countDocuments(searchQuery),
        ]);
      
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
    


    async getAllCustomersForXLS(): Promise<CommonPaginationResponse<any>> {
        // Aggregation pipeline to group by name + phone
        const customers = await this.customerModel.aggregate([
          {
            $group: {
              _id: {
                name: '$customerName',
                phone: '$phone'
              },
              doc: { $first: '$$ROOT' } // Keeps the first occurrence of duplicates
            }
          },
          { $replaceRoot: { newRoot: '$doc' } }, // Restore the full document
          { $sort: { createdAt: -1 } } // Optional: Sort by createdAt
        ]);
      
        return {
          data: customers,
          meta: {
            page: 1,
            pageSize: customers.length,
            totalItems: customers.length,
            totalPages: 1,
          },
        };
      }
    
    
    
    
    

}

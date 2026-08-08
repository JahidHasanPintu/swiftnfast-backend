import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerDocument } from '../interfaces/customer.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class EditCustomerService {

    constructor(@InjectModel('Customer') private readonly customerModel: Model<CustomerDocument>) { }

    async updateCustomerInfo(customerId: string, updateData: any): Promise<CustomerDocument> {

        console.log('Updating customer with ID:', customerId);
        console.log('Update data:', updateData);

        const existingCustomer = await this.customerModel.findOne({ customerId });

        if (!existingCustomer) {
            throw new NotFoundException(`Customer with ID ${customerId} not found`);
        }

        // Update customer information
        Object.assign(existingCustomer, updateData);

        // Save changes to the database
        return existingCustomer.save();
    }



}

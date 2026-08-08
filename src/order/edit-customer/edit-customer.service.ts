import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerDocument } from '../interfaces/customer.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as mongoose from 'mongoose';
import { EditCustomerDto } from '../dtos/editCustomer.dto';
import { OrderDocument } from '../interfaces/order.interface';

@Injectable()
export class EditCustomerService {

    constructor(
        @InjectModel('Customer') private readonly customerModel: Model<CustomerDocument>,
        @InjectModel('Orders') private readonly orderModel: Model<OrderDocument>,
    ) { }

    async updateCustomerInfo(customerIdOrId: string, updateData: EditCustomerDto): Promise<CustomerDocument> {

        const updateFields: Partial<CustomerDocument> = {};
        for (const key of Object.keys(updateData) as (keyof EditCustomerDto)[]) {
            const value = updateData[key];
            if (value !== undefined && value !== null) {
                (updateFields as any)[key] = value;
            }
        }

        // Resolve the canonical customer: prefer Mongo _id when the param is a
        // valid ObjectId, otherwise fall back to the legacy customerId string.
        let existingCustomer: CustomerDocument | null = null;

        if (mongoose.Types.ObjectId.isValid(customerIdOrId)) {
            existingCustomer = await this.customerModel.findById(customerIdOrId);
        }

        if (!existingCustomer) {
            existingCustomer = await this.customerModel.findOne({ customerId: customerIdOrId });
        }

        if (!existingCustomer) {
            throw new NotFoundException(`Customer with ID ${customerIdOrId} not found`);
        }

        // Update customer information
        Object.assign(existingCustomer, updateFields);

        const savedCustomer = await existingCustomer.save();

        // Propagate name/phone changes to all orders belonging to this customer
        // (newer orders link via ObjectId customerId; legacy orders link via the
        // string customerId or the orderId stored on the customer doc).
        const propagationFilters: any[] = [
            { customerId: savedCustomer._id },
            { customerId: String(savedCustomer._id) },
        ];
        if ((savedCustomer as any).orderId) {
            propagationFilters.push({ orderId: (savedCustomer as any).orderId });
        }

        const setFields: any = {};
        if (updateFields.customerName !== undefined) setFields.customerName = updateFields.customerName;
        if (updateFields.contactNumber !== undefined) setFields.contactNumber = updateFields.contactNumber;

        if (Object.keys(setFields).length > 0) {
            await this.orderModel.updateMany(
                { $or: propagationFilters },
                { $set: setFields },
            );
        }

        return savedCustomer;
    }
}

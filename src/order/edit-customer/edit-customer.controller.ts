import { Body, Controller, NotFoundException, Param, Put } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CustomerDocument } from '../interfaces/customer.interface';
import { Model } from 'mongoose';
import { EditCustomerService } from './edit-customer.service';

@Controller('edit-customer')
export class EditCustomerController {

    constructor(private readonly customerService: EditCustomerService) { }

    @Put(':customerId')
    async updateCustomerInfo(@Param('customerId') customerId: string, @Body() updateData: any): Promise<CustomerDocument> {
        return this.customerService.updateCustomerInfo(customerId, updateData);
    }





}

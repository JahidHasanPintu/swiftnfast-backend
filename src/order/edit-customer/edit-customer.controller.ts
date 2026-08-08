import { Body, Controller, Param, Patch, Put } from '@nestjs/common';
import { CustomerDocument } from '../interfaces/customer.interface';
import { EditCustomerService } from './edit-customer.service';
import { EditCustomerDto } from '../dtos/editCustomer.dto';

@Controller('edit-customer')
export class EditCustomerController {
  constructor(private readonly customerService: EditCustomerService) {}

  @Put(':customerId')
  async updateCustomerInfo(
    @Param('customerId') customerId: string,
    @Body() updateData: EditCustomerDto,
  ): Promise<CustomerDocument> {
    return this.customerService.updateCustomerInfo(customerId, updateData);
  }

  @Patch(':customerId')
  async patchCustomerInfo(
    @Param('customerId') customerId: string,
    @Body() updateData: EditCustomerDto,
  ): Promise<CustomerDocument> {
    return this.customerService.updateCustomerInfo(customerId, updateData);
  }
}

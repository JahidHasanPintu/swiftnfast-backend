import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerDocument } from '../interfaces/customer.interface';
import { SearchCustomerDto } from '../dtos/searchCustomer.dto';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';

@Controller('customer')
export class CustomerController {

    constructor(private readonly customerService: CustomerService) { }


    @Get()
    async getAllCustomers(): Promise<CustomerDocument[]> {
        return this.customerService.getAllCustomers();
    }

    // @Get('search')
    // async searchCustomers(@Query() query: SearchCustomerDto): Promise<CustomerDocument[]> {
    //     return this.customerService.searchCustomers(query);
    // }

    @Get('search')
    async searchCustomers(
      @Query('keyword') keyword: string,
      @Query('page', ParseIntPipe) page = 1,
      @Query('pageSize', ParseIntPipe) pageSize = 10,
    ): Promise<CommonPaginationResponse<any>> {
      return this.customerService.searchCustomers(keyword, page, pageSize);
    }


    @Get('xls/list')
    async getAllCustomersForXLS(): Promise<CommonPaginationResponse<any>> {
      return this.customerService.getAllCustomersForXLS();
    }

}

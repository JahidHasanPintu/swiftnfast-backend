import { Controller, Get, ParseIntPipe, Query, Res } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerDocument } from '../interfaces/customer.interface';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';
import { Response } from 'express';

@Controller('customer')
export class CustomerController {

    constructor(private readonly customerService: CustomerService) { }


    @Get()
    async getAllCustomers(): Promise<CustomerDocument[]> {
        return this.customerService.getAllCustomers();
    }

    @Get('search')
    async searchCustomers(
      @Query('keyword') keyword: string,
      @Query('page', ParseIntPipe) page = 1,
      @Query('pageSize', ParseIntPipe) pageSize = 10,
    ): Promise<CommonPaginationResponse<any>> {
      return this.customerService.searchCustomers(keyword, page, pageSize);
    }


    @Get('xls/list')
    async getAllCustomersForXLS(@Res() res: Response): Promise<void> {
      const buffer = await this.customerService.getAllCustomersForXLS();
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="customers.xlsx"',
      });
      res.send(buffer);
    }

}

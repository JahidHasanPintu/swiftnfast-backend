import { Body, Controller, Get, Post } from '@nestjs/common';
import { CancelledOrdersDto } from './dto/cancelOrders.dto';
import { CancelledOrderDocument } from './interfaces/cancelOrders.interface';
import { CancelledOrdersService } from './cancelled-orders.service';
import { BulkCancelledOrdersDto } from './dto/bulkCancelOrder.dto';

@Controller('cancelled-orders')
export class CancelledOrdersController {

    constructor(public cancelledOrderService: CancelledOrdersService) {

    }


    @Post()
    async create(@Body() cancelledOrdersDto: CancelledOrdersDto) {
        return this.cancelledOrderService.createCancelOrders(cancelledOrdersDto);
    }


    @Post('bulk-cancel')
    async createBulkCancel(@Body() bulkCancelledOrdersDto: BulkCancelledOrdersDto) {
        // Handle bulk cancellation request
        return this.cancelledOrderService.createBulkCancelOrders(bulkCancelledOrdersDto.cancelledOrders);
    }





    @Get()
    async findAll(): Promise<CancelledOrderDocument[]> {
        return this.cancelledOrderService.getAllCancelledOrdersList();
    }




}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { DropShipService } from './dropship.service';
import { CreateDropShipDto } from './dtos/create-dropship.dto';
import { UpdateDropShipDto } from './dtos/update-dropship.dto';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';

@Controller('dropship')
export class DropShipController {
  constructor(private readonly dropshipService: DropShipService) {}

  @Post()
  async create(@Body() body: CreateDropShipDto) {
    return this.dropshipService.create(body);
  }

  @Get()
  async findAll(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('pageSize', ParseIntPipe) pageSize: number = 10,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<CommonPaginationResponse<any>> {
    return this.dropshipService.findAll(page, pageSize, status, startDate, endDate);
  }

  @Get(':dropshipId')
  async findOne(@Param('dropshipId') dropshipId: string) {
    return this.dropshipService.findOne(dropshipId);
  }

  @Put(':dropshipId')
  async update(
    @Param('dropshipId') dropshipId: string,
    @Body() body: UpdateDropShipDto,
  ) {
    return this.dropshipService.update(dropshipId, body);
  }

  @Put(':dropshipId/link-shipment')
  async linkShipment(
    @Param('dropshipId') dropshipId: string,
    @Body('shipmentId') shipmentId: string,
    @Body('productWeight') productWeight?: number,
    @Body('weightChargePerKg') weightChargePerKg?: number,
  ) {
    return this.dropshipService.linkShipment(dropshipId, shipmentId, productWeight, weightChargePerKg);
  }

  @Delete(':dropshipId')
  async remove(@Param('dropshipId') dropshipId: string) {
    return this.dropshipService.remove(dropshipId);
  }
}

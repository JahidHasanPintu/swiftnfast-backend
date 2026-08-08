import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseDto } from './dto/purchase.dto';
import { UpdatePurchaseDto } from './dto/updatePurchase.dto';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';
import { PathaoService } from './pathao.service';
import {
  PathaoBulkDeliveryDto,
  PathaoSingleDeliveryDto,
} from './dto/pathao.dto';

@Controller('purchase')
export class PurchaseController {
  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly pathaoService: PathaoService, // ← add this
  ) {}

  @Post()
  async create(@Body() createPurchaseDto: CreatePurchaseDto) {
    return this.purchaseService.create(createPurchaseDto);
  }

  @Put('update-trackId/:orderId/:orderItemIndex') // PUT /purchase/update-trackId/{orderId}/{orderItemIndex}
  async updateTrackId(
    @Param('orderId') orderId: string,
    @Param('orderItemIndex') orderItemIndex: number,
    @Body() updateTrackIdDto: UpdatePurchaseDto,
  ) {
    return this.purchaseService.updateTrackId(
      orderId,
      orderItemIndex,
      updateTrackIdDto,
    );
  }

  @Get()
  async getAllPurchases(
    @Query('page') page: number,
    @Query('pageSize') pageSize: number,
    @Query('status') status: string,
  ): Promise<CommonPaginationResponse<any>> {
    return this.purchaseService.getAllPurchases(page, pageSize, status);
  }

  @Get('all')
  async getAllPurchasesWithoutPagination(): Promise<any> {
    return this.purchaseService.getAllPurchasesWithoutPagination();
  }

  @Get('all/cleaned')
  async getAllPurchasesCleaned(): Promise<any[]> {
    return this.purchaseService.getAllPurchasesCleaned();
  }

  // delete api

  @Delete(':orderId/:orderItemIndex')
  async deletePurchase(
    @Param('orderId') orderId: string,
    @Param('orderItemIndex') orderItemIndex: number,
  ): Promise<void> {
    await this.purchaseService.deleteByOrderIdAndItemIndex(
      orderId,
      orderItemIndex,
    );
  }

  @Get('filter')
  async filterPurchases(
    @Query('page') page: number,
    @Query('pageSize') pageSize: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('websiteName') websiteName?: string,
    @Query('cardName') cardName?: string,
    @Query('destinationName') destinationName?: string,
    @Query('country') country?: string,
  ): Promise<CommonPaginationResponse<any>> {
    return this.purchaseService.filterPurchases(
      Number(page),
      Number(pageSize),
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      websiteName,
      cardName,
      destinationName,
      country,
    );
  }

  // get website list

  @Get('unique-websites/list')
  async getUniqueWebsites(): Promise<string[]> {
    return this.purchaseService.getUniqueWebsites();
  }

  // All data with pagination : Filtered data
  @Get('filter/all/data')
  async filterAllPurchases(
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @Query('websiteName') websiteName?: string,
    @Query('cardName') cardName?: string,
    @Query('destinationName') destinationName?: string,
    @Query('country') country?: string,
  ): Promise<CommonPaginationResponse<any>> {
    return this.purchaseService.getAllFilteredPurchases(
      startDate,
      endDate,
      websiteName,
      cardName,
      destinationName,
      country,
    );
  }

  // new

  @Get('filter/all/data/cleaned')
  async filterAllPurchasesCleaned(
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @Query('websiteName') websiteName?: string,
    @Query('cardName') cardName?: string,
    @Query('destinationName') destinationName?: string,
    @Query('country') country?: string,
  ): Promise<CommonPaginationResponse<any>> {
    return this.purchaseService.getAllFilteredPurchasesCleaned(
      startDate,
      endDate,
      websiteName,
      cardName,
      destinationName,
      country,
    );
  }

  // get single purchase by orderId + orderItemIndex
  @Get(':orderId/:orderItemIndex')
  async getPurchaseByOrderItem(
    @Param('orderId') orderId: string,
    @Param('orderItemIndex') orderItemIndex: number,
  ) {
    return this.purchaseService.getPurchaseByOrderIdAndItemIndex(
      orderId,
      orderItemIndex,
    );
  }

  // update single purchase by orderId + orderItemIndex
  @Put('update/:orderId/:orderItemIndex')
  async updatePurchaseByOrderItem(
    @Param('orderId') orderId: string,
    @Param('orderItemIndex') orderItemIndex: number,
    @Body() updatePurchaseDto: CreatePurchaseDto,
  ) {
    return this.purchaseService.updatePurchaseByOrderIdAndItemIndex(
      orderId,
      orderItemIndex,
      updatePurchaseDto,
    );
  }

  @Put('update-shipment/:orderId/:orderItemIndex')
  async updatePurchase(
    @Param('orderId') orderId: string,
    @Param('orderItemIndex') orderItemIndex: number,
    @Body() updatePurchaseDto: UpdatePurchaseDto,
  ) {
    return this.purchaseService.updatePurchase(
      orderId,
      orderItemIndex,
      updatePurchaseDto,
    );
  }
  @Put('update-purchase-status/:orderId/:orderItemIndex')
  async updatePurchaseStatus(
    @Param('orderId') orderId: string,
    @Param('orderItemIndex') orderItemIndex: number,
    @Body() updatePurchaseDto: UpdatePurchaseDto,
  ) {
    return this.purchaseService.updatePurchaseStatus(
      orderId,
      orderItemIndex,
      updatePurchaseDto,
    );
  }

  // PAthao:

  @Post('pathao/single/:orderId/:orderItemIndex')
  async createPathaoSingleDelivery(
    @Param('orderId') orderId: string,
    @Param('orderItemIndex') orderItemIndex: number,
  ) {
    return this.pathaoService.createSingleDelivery(
      orderId,
      Number(orderItemIndex),
    );
  }

  @Post('pathao/bulk')
  async createPathaoBulkDelivery(@Body() body: PathaoBulkDeliveryDto) {
    return this.pathaoService.createBulkDelivery(body.orders);
  }
}

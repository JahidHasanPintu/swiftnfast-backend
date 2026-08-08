import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { ShipmentService } from './shipment.service';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  SetShippingCostDto,
  LinkPurchaseToShipmentDto,
  BulkLinkPurchasesDto,
} from './dto/shipment.dto';
import { ShipmentStatus } from './schemas/shipment.schema';
import { ShipmentDocument, PurchaseDocument } from './shipment.types';

@ApiTags('Shipments')
@Controller('shipments')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────────

  // POST /shipments
  @Post()
  @ApiOperation({ summary: 'Create a new shipment (links to agent/warehouse)' })
  @ApiResponse({ status: 201, description: 'Shipment created' })
  create(@Body() dto: CreateShipmentDto): Promise<ShipmentDocument> {
    return this.shipmentService.create(dto);
  }

  // ─── LIST / FILTER ─────────────────────────────────────────────────────────────

  // GET /shipments
  @Get()
  @ApiOperation({ summary: 'List all shipments with optional filters' })
  @ApiQuery({ name: 'status', required: false, enum: ShipmentStatus })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'agentId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('status') status?: string,
    @Query('country') country?: string,
    @Query('agentId') agentId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ): Promise<{
    data: ShipmentDocument[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.shipmentService.findAll({
      status,
      country,
      agentId,
      page,
      limit,
    });
  }

  // GET /shipments/dashboard
  @Get('dashboard')
  @ApiOperation({
    summary:
      'All-time shipment dashboard: totals, status breakdown, recent shipments',
  })
  getDashboard(): Promise<{
    statusBreakdown: { _id: string; count: number }[];
    recentShipments: ShipmentDocument[];
    allTimeTotals: Record<string, any>;
  }> {
    return this.shipmentService.getDashboard();
  }

  // GET /shipments/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get single shipment detail' })
  findOne(@Param('id') id: string): Promise<ShipmentDocument> {
    return this.shipmentService.findOne(id);
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────────

  // PATCH /shipments/:id
  @Patch(':id')
  @ApiOperation({
    summary: 'Update shipment metadata, status, arrival date, extra costs',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
  ): Promise<ShipmentDocument> {
    return this.shipmentService.update(id, dto);
  }

  // ─── SET SHIPPING COST (key business event) ────────────────────────────────────

  // PATCH /shipments/:id/set-shipping-cost
  @Patch(':id/set-shipping-cost')
  @ApiOperation({
    summary:
      'Set total shipping cost → auto-calculates actualWeightChargePerKg, ' +
      'updates all linked purchases, computes weight-charge profit, creates expense transaction',
  })
  setShippingCost(
    @Param('id') id: string,
    @Body() dto: SetShippingCostDto,
  ): Promise<ShipmentDocument> {
    return this.shipmentService.setShippingCost(id, dto);
  }

  // ─── LINK / UNLINK PURCHASES ───────────────────────────────────────────────────

  // POST /shipments/:id/link-purchase
  @Post(':id/link-purchase')
  @ApiOperation({
    summary:
      'Link a single purchase to this shipment and optionally set its weight & charge.',
  })
  linkPurchase(
    @Param('id') id: string,
    @Body() dto: LinkPurchaseToShipmentDto,
  ): Promise<{ shipment: ShipmentDocument; purchase: PurchaseDocument }> {
    return this.shipmentService.linkPurchase(id, dto);
  }

  // POST /shipments/:id/bulk-link
  @Post(':id/bulk-link')
  @ApiOperation({
    summary: 'Link multiple purchases to this shipment in one call',
  })
  bulkLinkPurchases(
    @Param('id') id: string,
    @Body() dto: BulkLinkPurchasesDto,
  ): Promise<{
    shipment: ShipmentDocument;
    linkedCount: number;
    errors: string[];
  }> {
    return this.shipmentService.bulkLinkPurchases(id, dto);
  }

  // DELETE /shipments/:id/unlink-purchase/:orderId/:orderItemIndex
  @Delete(':id/unlink-purchase/:orderId/:orderItemIndex')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a purchase from this shipment' })
  @ApiParam({ name: 'orderId' })
  @ApiParam({ name: 'orderItemIndex', type: Number })
  unlinkPurchase(
    @Param('id') id: string,
    @Param('orderId') orderId: string,
    @Param('orderItemIndex', ParseIntPipe) orderItemIndex: number,
  ): Promise<ShipmentDocument> {
    return this.shipmentService.unlinkPurchase(id, orderId, orderItemIndex);
  }

  // ─── PURCHASES IN SHIPMENT ─────────────────────────────────────────────────────

  // GET /shipments/:id/purchases
  @Get(':id/purchases')
  @ApiOperation({
    summary: 'Get all purchases linked to this shipment (paginated)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLinkedPurchases(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<{
    data: PurchaseDocument[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.shipmentService.getLinkedPurchases(id, page, limit);
  }

  // ─── ANALYTICS ─────────────────────────────────────────────────────────────────

  // GET /shipments/:id/analytics
  @Get(':id/analytics')
  @ApiOperation({
    summary:
      'Full analytics for one shipment: per-customer breakdown, status distribution, ' +
      'profit figures (weight-charge profit + currency exchange profit)',
  })
  getAnalytics(@Param('id') id: string): Promise<any> {
    return this.shipmentService.getShipmentAnalytics(id);
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────────

  // DELETE /shipments/:id
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete shipment (only if no purchases are linked)',
  })
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.shipmentService.remove(id);
  }
}

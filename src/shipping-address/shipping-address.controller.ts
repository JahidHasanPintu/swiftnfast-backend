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
import { ShippingAddressService } from './shipping-address.service';
import { ShippingAddressDto } from './dto/shippingAddress.dto';
import { ShippingAddressDocument } from './interfaces/shippingAddress.interface.';

@Controller('shipping-address')
export class ShippingAddressController {
  constructor(public shippingAddressService: ShippingAddressService) {}

  @Post()
  async create(@Body() cancelledOrdersDto: ShippingAddressDto) {
    return this.shippingAddressService.createCancelOrders(cancelledOrdersDto);
  }

  @Get()
  async findAll(): Promise<ShippingAddressDocument[]> {
    return this.shippingAddressService.getAllCancelledOrdersList();
  }

  @Get('by-source')
  async getShipmentInfoBySource(
    @Query() query: ShippingAddressDto,
  ): Promise<ShippingAddressDocument[]> {
    return this.shippingAddressService.getShipmentInfoBySource(query.source);
  }

  // New method to get by ID
  @Get(':id')
  async findById(@Param('id') id: string): Promise<ShippingAddressDocument> {
    return this.shippingAddressService.findById(id);
  }

  // New method to delete by ID
  @Delete(':id')
  async deleteById(@Param('id') id: string): Promise<{ message: string }> {
    await this.shippingAddressService.deleteById(id);
    return { message: 'Shipping address deleted successfully' };
  }

  @Put(':id')
  async updateById(
    @Param('id') id: string,
    @Body() updateShippingAddressDto: ShippingAddressDto, // Using the same DTO
  ): Promise<ShippingAddressDocument> {
    return this.shippingAddressService.updateById(id, updateShippingAddressDto);
  }
}

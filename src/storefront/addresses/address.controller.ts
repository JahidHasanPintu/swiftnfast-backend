import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { StorefrontAuthGuard } from '../auth/storefront-auth.guards';
import { StorefrontRequest } from '../auth/storefront-request.interface';
import { AddressService } from './address.service';

@Public()
@UseGuards(StorefrontAuthGuard)
@Controller('api/v1')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post('shipping')
  async createShipping(@Req() req: StorefrontRequest, @Body() body: any) {
    const data = await this.addressService.createShipping(
      req.user?.userId,
      body,
    );
    return { success: true, data };
  }

  @Get('shipping')
  async getAllShipping(@Req() req: StorefrontRequest) {
    const data = await this.addressService.getAllShipping(req.user?.userId);
    return { success: true, data };
  }

  @Put('shipping/:id')
  async updateShipping(
    @Req() req: StorefrontRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const data = await this.addressService.updateShipping(
      req.user?.userId,
      id,
      body,
    );
    return { success: true, data };
  }

  @Delete('shipping/:id')
  async deleteShipping(@Req() req: StorefrontRequest, @Param('id') id: string) {
    await this.addressService.deleteShipping(req.user?.userId, id);
    return { success: true, message: 'Deleted successfully' };
  }

  @Post('billing')
  async createBilling(@Req() req: StorefrontRequest, @Body() body: any) {
    const data = await this.addressService.createBilling(
      req.user?.userId,
      body,
    );
    return { success: true, data };
  }

  @Get('billing')
  async getAllBilling(@Req() req: StorefrontRequest) {
    const data = await this.addressService.getAllBilling(req.user?.userId);
    return { success: true, data };
  }

  @Put('billing/:id')
  async updateBilling(
    @Req() req: StorefrontRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const data = await this.addressService.updateBilling(
      req.user?.userId,
      id,
      body,
    );
    return { success: true, data };
  }

  @Delete('billing/:id')
  async deleteBilling(@Req() req: StorefrontRequest, @Param('id') id: string) {
    await this.addressService.deleteBilling(req.user?.userId, id);
    return { success: true, message: 'Deleted successfully' };
  }
}

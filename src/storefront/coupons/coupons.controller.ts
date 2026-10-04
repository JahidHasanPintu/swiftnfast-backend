import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CouponsService } from './coupons.service';

@Controller('api/v1/coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // ---- Admin: manage the coupon book --------------------------------------

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: any) {
    const result = await this.couponsService.findAll(query);
    return {
      success: true,
      data: result.coupons,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        hasNextPage: result.page * result.limit < result.total,
      },
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const data = await this.couponsService.findOne(id);
    return { success: true, data };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: any) {
    const data = await this.couponsService.create(body);
    return { success: true, message: 'Coupon created successfully', data };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() body: any) {
    const data = await this.couponsService.update(id, body);
    return { success: true, message: 'Coupon updated successfully', data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Public } from 'src/common/decorators/public.decorator';
import { PaymentService } from './payment.service';

@Public()
@Controller('api/v1/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @UseInterceptors(FileInterceptor('screenshot'))
  async createPayment(@Body() body: any, @UploadedFile() file: any) {
    const payment = await this.paymentService.createPayment(body, file);
    return {
      success: true,
      message: 'Payment created successfully',
      data: payment,
    };
  }

  @Get(':id')
  async getPaymentById(@Param('id') id: string) {
    const payment = await this.paymentService.getPaymentById(id);
    return { success: true, data: payment };
  }

  @Get()
  async getAllPayments() {
    const payments = await this.paymentService.getAllPayments();
    return { success: true, data: payments };
  }

  @Post('bkash/create-payment')
  async createBkashPayment(@Body() body: any) {
    return this.paymentService.createBkashPayment(body);
  }

  @Post('bkash/refund-payment')
  async refundPayment(@Body() body: any) {
    return this.paymentService.refundPayment(body);
  }

  @Get('bkash/callback')
  async bkashCallback(@Query() query: any, @Res() res: Response) {
    const url = await this.paymentService.bkashCallback(query);
    return res.redirect(url);
  }

  @Get('bkash/execute')
  async executePayment(@Query() query: any, @Res() res: Response) {
    const url = await this.paymentService.executePayment(query);
    return res.redirect(url);
  }

  @Get('bkash/query')
  async queryPayment(@Query() query: any, @Res() res: Response) {
    const url = await this.paymentService.queryPayment(query);
    return res.redirect(url);
  }
}

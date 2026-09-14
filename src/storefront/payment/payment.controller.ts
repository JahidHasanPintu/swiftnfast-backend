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
import { EpsService } from './eps.service';
import { PaymentService } from './payment.service';

@Public()
@Controller('api/v1/payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly epsService: EpsService,
  ) {}

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

  @Get('order/:orderId')
  async getPaymentByOrderId(@Param('orderId') orderId: string) {
    const payment = await this.paymentService.getPaymentByOrderId(orderId);
    return { success: true, data: payment };
  }

  @Post('bkash/create-payment')
  async createBkashPayment(@Body() body: any) {
    console.log('[Payment Controller] POST /bkash/create-payment');
    console.log('[Payment Controller] Body:', JSON.stringify(body, null, 2));
    try {
      const result = await this.paymentService.createBkashPayment(body);
      console.log('[Payment Controller] createBkashPayment success:', JSON.stringify(result, null, 2));
      return result;
    } catch (error: any) {
      console.error('[Payment Controller] createBkashPayment error:', error.message);
      console.error('[Payment Controller] Error response:', error.response?.data);
      throw error;
    }
  }

  @Post('bkash/refund-payment')
  async refundPayment(@Body() body: any) {
    return this.paymentService.refundPayment(body);
  }

  @Get('bkash/callback')
  async bkashCallback(@Query() query: any, @Res() res: Response) {
    console.log('[Payment Controller] GET /bkash/callback');
    console.log('[Payment Controller] Query params:', JSON.stringify(query, null, 2));
    const url = await this.paymentService.bkashCallback(query);
    console.log('[Payment Controller] Redirecting to:', url);
    return res.redirect(url);
  }

  @Get('bkash/execute')
  async executePayment(@Query() query: any, @Res() res: Response) {
    console.log('[Payment Controller] GET /bkash/execute');
    console.log('[Payment Controller] Query params:', JSON.stringify(query, null, 2));
    const url = await this.paymentService.executePayment(query);
    console.log('[Payment Controller] Redirecting to:', url);
    return res.redirect(url);
  }

  @Get('bkash/query')
  async queryPayment(@Query() query: any, @Res() res: Response) {
    console.log('[Payment Controller] GET /bkash/query');
    console.log('[Payment Controller] Query params:', JSON.stringify(query, null, 2));
    const url = await this.paymentService.queryPayment(query);
    console.log('[Payment Controller] Redirecting to:', url);
    return res.redirect(url);
  }

  @Post('bkash/repay')
  async repayBkashPayment(@Body() body: { orderId: string }) {
    console.log('[Payment Controller] POST /bkash/repay');
    console.log('[Payment Controller] Body:', JSON.stringify(body, null, 2));
    try {
      const result = await this.paymentService.repayBkashPayment(body.orderId);
      console.log('[Payment Controller] repayBkashPayment success:', JSON.stringify(result, null, 2));
      return result;
    } catch (error: any) {
      console.error('[Payment Controller] repayBkashPayment error:', error.message);
      throw error;
    }
  }

  // -------------------------------------------------------------------
  // EPS Payment Gateway
  // -------------------------------------------------------------------

  @Post('eps/create-payment')
  async createEpsPayment(@Body() body: any) {
    console.log('[Payment Controller] POST /eps/create-payment');
    console.log('[Payment Controller] Body:', JSON.stringify(body, null, 2));
    try {
      const result = await this.epsService.initializePayment(body);
      console.log('[Payment Controller] createEpsPayment success:', JSON.stringify(result, null, 2));
      return result;
    } catch (error: any) {
      console.error('[Payment Controller] createEpsPayment error:', error.message);
      console.error('[Payment Controller] Error response:', error.response?.data);
      throw error;
    }
  }

  @Get('eps/callback')
  async epsCallback(@Query() query: any, @Res() res: Response) {
    console.log('[Payment Controller] GET /eps/callback');
    console.log('[Payment Controller] Query params:', JSON.stringify(query, null, 2));
    const url = await this.epsService.callback(query);
    console.log('[Payment Controller] Redirecting to:', url);
    return res.redirect(url);
  }

  @Get('eps/status')
  async epsStatus(@Query('merchantTransactionId') merchantTransactionId: string) {
    console.log('[Payment Controller] GET /eps/status');
    return this.epsService.getPaymentStatus(merchantTransactionId);
  }

  @Post('eps/repay')
  async repayEpsPayment(@Body() body: { orderId: string }) {
    console.log('[Payment Controller] POST /eps/repay');
    console.log('[Payment Controller] Body:', JSON.stringify(body, null, 2));
    try {
      const result = await this.epsService.repayEpsPayment(body.orderId);
      console.log('[Payment Controller] repayEpsPayment success:', JSON.stringify(result, null, 2));
      return result;
    } catch (error: any) {
      console.error('[Payment Controller] repayEpsPayment error:', error.message);
      throw error;
    }
  }
}

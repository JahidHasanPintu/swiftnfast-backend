import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';
import { CreateOrderRequestDto } from './dtos/createOrderRequest.dto';
import { CustomerDocument } from './interfaces/customer.interface';
import { OrderService } from './order.service';
import { InvoiceService } from 'src/invoice/invoice.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly invoiceService: InvoiceService,
  ) {}

  @Get('download/invoice/:orderId')
  async generateInvoice(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.invoiceService.generateInvoicePDF(orderId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${orderId}.pdf"`,
    });
    res.send(pdfBuffer);
  }

  @Get('customer/byname/:customerName') // Update the route path to make it unique
  async getCustomerByName(
    @Param('customerName') customerName: string,
  ): Promise<CustomerDocument[]> {
    const customers = await this.orderService.getCustomerByName(customerName);
    return customers;
  }

  @Get('customer/bycontact/:contactNumber') // Update the route path to make it unique
  async getCustomerByContactNumber(
    @Param('contactNumber') contactNumber: string,
  ): Promise<CustomerDocument> {
    const customer = await this.orderService.getCustomerByContactNumber(
      contactNumber,
    );
    return customer;
  }

  @Get('customer/:orderId') // Define a route parameter for orderId
  async getCustomerByOrderId(@Param('orderId') orderId: string) {
    const customer = await this.orderService.getCustomerByOrderIdToFetch(
      orderId,
    );
    return { customer };
  }
  @Get('editCustomer/:custId') // Define a route parameter for orderId
  async getCustomerByCustomerId(@Param('custId') custId: string) {
    const customer = await this.orderService.getCustomerByCustomerId(custId);
    return { customer };
  }

  @Get('byorder/:orderId') // Adjust the route as needed
  async getCustomersByOrderId(
    @Param('orderId') orderId: string,
  ): Promise<CustomerDocument[]> {
    const customers = await this.orderService.getCustomerByOrderId(orderId);
    return customers;
  }

  @Get('bypayment/:orderId')
  async getPaymentsByOrderId(@Param('orderId') orderId: string) {
    const payment = await this.orderService.getPaymentsByOrderId(orderId);
    return payment;
  }

  @Post()
  async createOrder(@Body() body: CreateOrderRequestDto) {
    return this.orderService.createOrder(
      body.customerInfo,
      body.orders,
      body.payments,
    );
  }

  @Get()
  async getAllOrders(
    @Query('page', ParseIntPipe) page = 1, // Page number with default value 1
    @Query('pageSize', ParseIntPipe) pageSize = 10, // Page size with default value 10
    @Query('status') status?: string, // Optional status filter (e.g., 'Pending', 'Purchased')
  ): Promise<CommonPaginationResponse<any>> {
    return this.orderService.getAllOrders(page, pageSize, status);
  }

  // for customer new one

  @Get('customer')
  async getAllCustomers(
    @Query('page', ParseIntPipe) page = 1,
    @Query('pageSize', ParseIntPipe) pageSize = 10,
  ): Promise<CommonPaginationResponse<any>> {
    return this.orderService.getAllCustomers(page, pageSize);
  }

  @Get(':orderId') // Define a route parameter for orderId
  async getOrdersByOrderId(@Param('orderId') orderId: string) {
    const orders = await this.orderService.getOrdersByOrderId(orderId);
    return { orders };
  }

  // get order with oreder item index

  @Get(':orderId/:orderItemIndex')
  async getOrderItem(
    @Param('orderId') orderId: string,
    @Param('orderItemIndex') orderItemIndex: number,
  ) {
    return this.orderService.getOrderItem(orderId, orderItemIndex);
  }

  // updating orders collection with order id when purchase is done

  @Put(':orderId/:orderItemIndex/status/:newStatus') // Update the route to include orderItemIndex
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Param('orderItemIndex') orderItemIndex: number, // Add orderItemIndex parameter
    @Param('newStatus') newStatus: string,
  ) {
    return this.orderService.updateOrderStatus(
      orderId,
      orderItemIndex,
      newStatus,
    );
  }

  // bulk cancel of orders

  @Put('bulk-cancel/:orderId')
  async updateBulkStatusOrder(@Param('orderId') orderId: string) {
    return this.orderService.updateBulkStatusOrder(orderId);
  }

  @Delete(':orderId')
  async deleteOrdersByOrderId(@Param('orderId') orderId: string) {
    const result = await this.orderService.deleteOrdersByOrderId(orderId);
    if (result.deletedCount === 0) {
      return { message: `No orders found with orderId: ${orderId}` };
    }
    return {
      message: `Deleted ${result.deletedCount} orders with orderId: ${orderId}`,
    };
  }

  // delete order api

  @Delete(':orderId/:orderItemIndex')
  async deleteOrderItem(
    @Param('orderId') orderId: string,
    @Param('orderItemIndex') orderItemIndex: string,
  ): Promise<void> {
    await this.orderService.deleteOrderItem(
      orderId,
      parseInt(orderItemIndex, 10),
    );
  }

  @Get('v1/customers/unique')
  async getUniqueCustomers(): Promise<CustomerDocument[]> {
    return this.orderService.getUniqueCustomers();
  }
}

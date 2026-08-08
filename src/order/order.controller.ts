import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { CommonPaginationResponse } from 'src/common/interfaces/CommonPaginationResponse';
import { CreateOrderRequestDto } from './dtos/createOrderRequest.dto';
import { CustomerDocument } from './interfaces/customer.interface';
import { OrderService } from './order.service';
// import { OrderDocument } from './interfaces/order.interface';
import { InvoiceService } from 'src/invoice/invoice.service';
import { Response } from 'express';
// import * as fs from 'fs';
import * as path from 'path';
import * as fs from 'fs-extra';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService, private readonly invoiceService: InvoiceService) { }



  // // invoice controller:

 
  @Get('download/invoice/:orderId')
  // async downloadInvoice(
  //   @Param('orderId') orderId: string,
  //   @Res() res: Response,
  // ) {
  //   try {
  //     console.log(`Attempting to generate invoice for orderId: ${orderId}`);

  //     // Generate a unique filename for the PDF
  //     const outputFilename = `invoice-${orderId}-${Date.now()}.pdf`;
  //     const outputPath = path.join(process.cwd(), 'invoices', outputFilename);

  //     // Ensure the invoices directory exists
  //     await fs.ensureDir(path.join(process.cwd(), 'invoices'));

  //     // Generate the invoice
  //     const filePath = await this.invoiceService.generateInvoice(orderId, outputPath);

  //     // Set response headers for PDF download
  //     res.setHeader('Content-Type', 'application/pdf');
  //     res.setHeader('Content-Disposition', `attachment; filename=${outputFilename}`);

  //     // Stream the file
  //     const fileStream = fs.createReadStream(filePath);
  //     fileStream.pipe(res);

  //     // Optional: Delete the file after sending
  //     fileStream.on('end', () => {
  //       fs.unlink(filePath).catch(console.error);
  //     });

  //   } catch (error) {
  //     console.error('Detailed Invoice Generation Error:', {
  //       message: error.message,
  //       stack: error.stack,
  //       orderId
  //     });
      
  //     // Handle specific error types
  //     if (error.status === 404) {
  //       res.status(HttpStatus.NOT_FOUND).json({
  //         message: 'Order not found',
  //         orderId
  //       });
  //     } else {
  //       res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
  //         message: 'Unexpected error generating invoice',
  //         error: error.message
  //       });
  //     }
  //   }
  // }
  async generateInvoice(@Param('orderId') orderId: string, @Res() res: Response) {
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

  // @Get('customer/:orderId') // Define a route parameter for orderId
  // async getCustomerByOrderId(@Param('orderId') orderId: string) {
  //   const customer = await this.orderService.getCustomerByOrderId(orderId);
  //   return { customer };
  // }

  @Get('customer/:orderId') // Define a route parameter for orderId
async getCustomerByOrderId(@Param('orderId') orderId: string) {
  const customer = await this.orderService.getCustomerByOrderIdToFetch(orderId);
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

  @Get('grouped')
  async getGroupedOrders() {
    const groupedOrders = await this.orderService.getOrdersGroupedByOrderId();
    return { groupedOrders };
  }

  //old one
  // @Get()
  // async getAllCustomers(): Promise<CustomerDocument[]> {
  //   const customers = await this.orderService.getAllCustomers();
  //   return customers;
  // }

  //new one
  // @Get()
  // async getAllOrders(
  //   @Query('page', ParseIntPipe) page = 1,
  //   @Query('pageSize', ParseIntPipe) pageSize = 10,
  // ): Promise<CommonPaginationResponse<any>> {
  //   return this.orderService.getAllOrders(page, pageSize);
  // }


  @Get()
  async getAllOrders(
    @Query('page', ParseIntPipe) page: number = 1, // Page number with default value 1
    @Query('pageSize', ParseIntPipe) pageSize: number = 10, // Page size with default value 10
    @Query('status') status?: string // Optional status filter (e.g., 'Pending', 'Purchased')
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

  // bulk cnacel of orders

  @Put('bulk-cancel/:orderId')
  async updateBulkStatusOrder(@Param('orderId') orderId: string) {
    return this.orderService.updateBulkStatusOrder(orderId);
  }

  @Put('bulk-cancel/:orderId')
  cancelOrdersByOrderId(@Param('orderId') orderId: string) {
    return this.orderService.cancelOrdersByOrderId(orderId);
  }


  @Delete(':orderId')
  async deleteOrdersByOrderId(@Param('orderId') orderId: string) {
      const result = await this.orderService.deleteOrdersByOrderId(orderId);
      if (result.deletedCount === 0) {
          return { message: `No orders found with orderId: ${orderId}` };
      }
      return { message: `Deleted ${result.deletedCount} orders with orderId: ${orderId}` };
  }

  // delete order api 

  @Delete(':orderId/:orderItemIndex')
  async deleteOrderItem(
    @Param('orderId') orderId: string,
    @Param('orderItemIndex') orderItemIndex: string,
  ): Promise<void> {
    await this.orderService.deleteOrderItem(orderId, parseInt(orderItemIndex, 10));
  }



  @Get('v1/customers/unique')
  async getUniqueCustomers(): Promise<CustomerDocument[]> {
    return this.orderService.getUniqueCustomers();
  }







}

import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { OrderDocument } from 'src/order/interfaces/order.interface';
import { OrderService } from 'src/order/order.service';

@Injectable()
export class InvoiceService {
  constructor(private readonly orderService: OrderService) {}

  async generateInvoicePDF(orderId: string): Promise<Buffer> {
    const orders = await this.orderService.getOrdersByOrderId(orderId);
    if (!orders || orders.length === 0)
      throw new Error('No orders found for this orderId');

    const totals = this.orderService.calculateInvoiceTotals(orders);
    const htmlTemplate = this.getPopulatedHtml(orders, totals);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlTemplate);
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    // Convert Uint8Array to Buffer explicitly
    return Buffer.from(pdfBuffer);
  }

  private getPopulatedHtml(
    orders: OrderDocument[],
    totals: {
      grandTotal: number;
      totalAdvance: number;
      totalOutstanding: number;
    },
  ): string {
    const firstOrder = orders[0]; // Use first order for header/customer info

    let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>${this.getCss()}</style></head><body><table class="main-table">`;

    // Header
    html += `
      <tr><td><table class="fluid">
        <tr><td><img src="http://localhost:3000/image/logo.png"></td><td><table class="fluid">
          <tr><td style="font-weight: bold;">Invoice #</td><td style="text-align: right;">${
            firstOrder.orderId
          }</td></tr>
          <tr><td style="font-weight: bold;">Date</td><td style="text-align: right;">${new Date(
            firstOrder.orderDate,
          ).toLocaleDateString()}</td></tr>
        </table></td></tr></table></td></tr>`;

    // Customer Info
    html += `
      <tr><td><table class="fluid">
        <tr><td><h3>Invoice to:</h3><h2>${firstOrder.customerName}</h2><p class="graytext">${firstOrder.contactNo}</p></td>
        <td style="vertical-align: top; padding-top: 5px;"><table class="fluid">
          <tr><td style="font-weight: bold; padding: 10px 0px;">Order #</td><td style="text-align: right; padding: 10px 0px;">${firstOrder.orderId}</td></tr>
          <tr><td style="font-weight: bold; padding: 10px 0px;">Customer ID</td><td style="text-align: right; padding: 10px 0px;">${firstOrder.customerId}</td></tr>
        </table></td></tr></table></td></tr>`;

    // Product Table (Loop through all orders)
    html += `<tr><td><table class="data-table">
      <tr><th>Product Description</th><th class="align-right">Price</th><th class="align-right">Qty</th><th class="align-right">Total</th><th class="align-right">Advance</th><th class="align-right">Outstanding</th></tr>`;
    orders.forEach((order) => {
      const totalPrice = order.totalPrice || order.uniPrice * order.quantity;
      const outstanding = totalPrice - (order.advancePayment || 0);
      html += `
        <tr><td>${order.prodDesc}</td><td class="align-right">${
        order.uniPrice
      }</td><td class="align-right">${order.quantity}</td>
        <td class="align-right">${totalPrice}</td><td class="align-right">${
        order.advancePayment || 0
      }</td><td class="align-right">${outstanding}</td></tr>`;
    });
    html += `</table></td></tr>`;

    // Totals
    html += `
      <tr><td><table class="fluid">
        <tr><td class="bold p-5">Total</td><td style="text-align: right;" class="p-5">Tk ${totals.grandTotal} /=</td></tr>
        <tr><td class="bold p-5">Advance</td><td style="text-align: right;" class="p-5">Tk ${totals.totalAdvance} /=</td></tr>
        <tr><td class="bold highlighted p-5">Outstanding</td><td style="text-align: right;" class="highlighted p-5">Tk ${totals.totalOutstanding} /= <p class="note">+ Weight Charge *</p></td></tr>
      </table></td></tr>`;

    // Payment Info and Footer
    html += `
      <tr><td><table class="fluid">
        <tr><td><h3 class="bold mt-20">Payment Info:</h3><table class="fluid">
          <tr><td>Account #:</td><td class="align-right">123456798123456</td></tr>
          <tr><td>A/C Name:</td><td class="align-right">PFU2</td></tr>
          <tr><td>Bank Name:</td><td class="align-right">The City Bank Ltd</td></tr>
          <tr><td>Bank Address:</td><td class="align-right">Gulshan avenue Branch, Dhaka 1213</td></tr>
        </table></td></tr>
        <tr><td><div class="weight-price-info">
          <p class="note">* Weight charge to be calculated once product reaches Bangladesh.</p>
          <table class="fluid"><tr><td><span class="bold">USA</span> 180 Tk / 100 gm</td><td><span class="bold">UK</span> 120 Tk / 100 gm</td><td><span class="bold">UAE</span> 120 Tk / 100 gm</td></tr></table>
        </div></td></tr></table></td></tr>
      <tr><td style="text-align: center; padding: 10px 0px;"><p>Thank you for your order</p></td></tr>
      <tr><td style="text-align: center; padding: 10px 0px 50px 0px; font-weight: bold; font-size: 13px;">
        THIS INVOICE IS SYSTEM GENERATED AND DOES NOT REQUIRE ANY SIGNATORY
      </td></tr>
      <tr><td style="border-top: 1px solid #d1202b;"><table class="fluid">
        <tr><td style="text-align: center; padding: 20px 0px 10px 0px;">
          <p>09678-114411, 01613-333011 (whatsapp) | shop.pfu2@gmail.com | www.pfu2.com</p>
        </td></tr></table></td></tr>`;

    html += `</table></body></html>`;
    return html;
  }

  private getCss(): string {
    return `
      body { font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #010101; }
      .main-table { width: 700px; margin: 0 auto; }
      .main-table tr td { padding: 0px 50px; }
      .fluid { width: 100%; border-collapse: collapse; }
      .fluid tr td { padding: 6px 0px; }
      .data-table { width: 100%; border-collapse: collapse; border: 1px solid #010101; }
      .data-table tr th { font-weight: bold; color: #fff; background-color: #010101; text-align: left; padding: 10px; }
      .data-table tr td { padding: 10px; font-size: 14px; }
      .align-right { text-align: right; }
      .bold { font-weight: bold; }
      .p-5 { padding: 10px !important; }
      .highlighted { background-color: #e8e8e8; }
      .note { color: #d1202b; font-size: 14px; font-style: italic; margin: 10px 0; }
      .weight-price-info { background-color: #fcdadc; padding: 15px; margin-top: 10px; }
      h2 { font-size: 25px; }
      h3 { font-size: 20px; }
      .graytext { color: #686868; }
      .mt-20 { margin-top: 20px; }
    `;
  }
}

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : '*',
  },
  namespace: '/notifications',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('EventsGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  notifyNewOrder(data: { orderNumber: string; customerName?: string }) {
    this.server.emit('newOrder', data);
  }

  notifyNewPreStockOrder(data: { orderNumber: string; customerName?: string }) {
    this.server.emit('newPreStockOrder', data);
  }

  notifyNewPriceRequest(data: { cartId: string; customerName?: string }) {
    this.server.emit('newPriceRequest', data);
  }

  notifyCountsUpdate(data: {
    pendingOrders?: number;
    pendingPreStock?: number;
    pendingPriceRequests?: number;
  }) {
    this.server.emit('countsUpdate', data);
  }
}

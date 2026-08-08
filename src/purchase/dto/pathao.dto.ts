export class PathaoSingleDeliveryDto {
  orderId: string;
  orderItemIndex: number;
}

export class PathaoBulkDeliveryDto {
  orders: PathaoSingleDeliveryDto[];
}
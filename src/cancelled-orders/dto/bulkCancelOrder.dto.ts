import { IsArray, ValidateNested } from 'class-validator';
import { CancelledOrdersDto } from './cancelOrders.dto';
import { Type } from 'class-transformer';

export class BulkCancelledOrdersDto {

    @ValidateNested()
    @Type(() => CancelledOrdersDto)
    cancelledOrders: CancelledOrdersDto[];
}

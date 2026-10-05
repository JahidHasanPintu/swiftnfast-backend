import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { AssistantService } from './assistant.service';
import { AskDto, WeightChargeDto } from './dto/assistant.dto';

@Public()
@Controller('api/v1/storefront/assistant')
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Get('bootstrap')
  bootstrap() {
    return this.service.bootstrap();
  }

  @Post('ask')
  ask(@Body() dto: AskDto) {
    return this.service.ask(dto.question);
  }

  @Post('weight-charge')
  weightCharge(@Body() dto: WeightChargeDto) {
    return this.service.weightCharge(dto.country, dto.grams);
  }

  @Post('events')
  events(@Body() body: { type: any }) {
    return this.service.event(body.type);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { GlobalJwtAuthGuard } from '../common/guards/global-jwt-auth.guard';

@UseGuards(GlobalJwtAuthGuard)
@Controller('api/v1/admin/assistant')
export class AdminAssistantController {
  constructor(private readonly service: AssistantService) {}

  @Get('faqs')
  getFaqs() {
    return this.service.getFaqs();
  }

  @Post('faqs')
  createFaq(@Body() body: any) {
    return this.service.createFaq(body);
  }

  @Put('faqs/:id')
  updateFaq(@Param('id') id: string, @Body() body: any) {
    return this.service.updateFaq(id, body);
  }

  @Delete('faqs/:id')
  deleteFaq(@Param('id') id: string) {
    return this.service.deleteFaq(id);
  }

  @Get('unanswered')
  unanswered(@Query('grouped') grouped = 'true') {
    return this.service.unanswered(grouped !== 'false');
  }

  @Get('stats')
  stats(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.stats(from, to);
  }

  @Put('config')
  setConfig(@Body() body: any) {
    return this.service.setConfig(body);
  }
}

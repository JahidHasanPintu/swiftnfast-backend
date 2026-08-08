import { Controller, Get, Param } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { SettingsService } from './settings.service';

@Public()
@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async findAll() {
    const docs = await this.settingsService.findAll();
    return docs;
  }

  @Get(':key')
  async findByKey(@Param('key') key: string) {
    return this.settingsService.findByKey(key);
  }
}

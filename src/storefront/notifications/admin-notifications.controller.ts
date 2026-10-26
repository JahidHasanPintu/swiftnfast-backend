import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AdminNotificationsService } from './admin-notifications.service';

@Controller('api/v1/admin-notifications')
export class AdminNotificationsController {
  constructor(
    private readonly notificationsService: AdminNotificationsService,
  ) {}

  @Get()
  async getFeed(@Query('limit') limit?: string) {
    const data = await this.notificationsService.getFeed(
      limit ? Number(limit) : 25,
    );
    return {
      success: true,
      message: 'Notifications retrieved successfully',
      data,
    };
  }

  @Patch('read-all')
  async markAllRead() {
    await this.notificationsService.markAllRead();
    return { success: true, message: 'Notifications marked as read' };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    await this.notificationsService.markRead(id);
    return { success: true, message: 'Notification marked as read' };
  }
}

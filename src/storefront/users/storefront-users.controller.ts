import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { StorefrontAuthGuard } from '../auth/storefront-auth.guards';
import { StorefrontRequest } from '../auth/storefront-request.interface';
import { StorefrontUsersService } from './storefront-users.service';

@Public()
@UseGuards(StorefrontAuthGuard)
@Controller('api/v1/users')
export class StorefrontUsersController {
  constructor(private readonly usersService: StorefrontUsersService) {}

  @Get()
  async list(@Query() query: any) {
    const result = await this.usersService.list(query);
    return { success: true, data: result.users, meta: result.meta };
  }

  @Post()
  async create(@Body() body: any) {
    const data = await this.usersService.createUser(body);
    return { success: true, message: 'User created successfully', data };
  }

  @Get('me')
  async me(@Req() req: StorefrontRequest) {
    const data = await this.usersService.getProfile(req.user.userId);
    return { success: true, message: 'Profile fetched successfully', data };
  }

  @Patch('me/update')
  async update(@Req() req: StorefrontRequest, @Body() body: any) {
    const data = await this.usersService.updateProfile(req.user.userId, body);
    return { success: true, message: 'User updated successfully', data };
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: any) {
    const data = await this.usersService.updateAccountStatus(id, body.status);
    return { success: true, message: 'Account disabled successfully', data };
  }

  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    const data = await this.usersService.updateUser(id, body);
    return { success: true, message: 'User updated successfully', data };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const data = await this.usersService.deleteUser(id);
    return { success: true, message: 'User deleted successfully', data };
  }
}

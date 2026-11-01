import { Controller, Get, Query } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { StorefrontUsersService } from './storefront-users.service';

/**
 * Public checkout helper: looks up a customer by email + phone so the form can
 * be prefilled. Kept in its own controller because the main users controller
 * applies the auth guard to every route.
 */
@Public()
@Controller('api/v1/users')
export class StorefrontUserLookupController {
  constructor(private readonly usersService: StorefrontUsersService) {}

  @Get('lookup')
  async lookup(
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    const data = await this.usersService.lookupByEmailAndPhone(email, phone);
    return { success: true, found: !!data, data };
  }
}

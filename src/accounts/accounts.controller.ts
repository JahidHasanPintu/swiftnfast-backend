import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseBoolPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import {
  AdjustBalanceDto,
  CreateAccountDto,
  UpdateAccountDto,
} from './dto/account.dto';

@ApiTags('Accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  // POST /accounts
  @Post()
  @ApiOperation({
    summary: 'Create a new account (Cash, Bank, Bkash, Rocket, etc.)',
  })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  // GET /accounts
  @Get()
  @ApiOperation({ summary: 'List all accounts with current balances' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAll(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe)
    includeInactive: boolean,
  ) {
    return this.accountsService.findAll(includeInactive);
  }

  // GET /accounts/summary
  @Get('summary')
  @ApiOperation({
    summary: 'Get total balance and account summary for dashboard',
  })
  getSummary() {
    return this.accountsService.getSummary();
  }

  // GET /accounts/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get a single account by ID' })
  @ApiParam({ name: 'id', description: 'Account MongoDB ObjectId' })
  findOne(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  // PATCH /accounts/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Update account details' })
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(id, dto);
  }

  // PATCH /accounts/:id/toggle-status
  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Activate or deactivate an account' })
  toggleStatus(@Param('id') id: string) {
    return this.accountsService.toggleStatus(id);
  }

  // PATCH /accounts/:id/adjust-balance
  @Patch(':id/adjust-balance')
  @ApiOperation({
    summary: 'Manually adjust account balance (creates an audit transaction)',
  })
  adjustBalance(@Param('id') id: string, @Body() dto: AdjustBalanceDto) {
    return this.accountsService.adjustBalance(id, dto);
  }

  // DELETE /accounts/:id
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an account (only if no transactions exist)',
  })
  remove(@Param('id') id: string) {
    return this.accountsService.remove(id);
  }
}

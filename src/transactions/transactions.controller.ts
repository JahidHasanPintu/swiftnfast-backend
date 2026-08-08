import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import {
  CreateIncomeDto,
  CreateExpenseDto,
  CreateTransferDto,
  UpdateTransactionDto,
  TransactionFilterDto,
  AnalyticsFilterDto,
} from './dto/transaction.dto';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // ─── INCOME ───────────────────────────────────────────────────────────────────

  // POST /transactions/income
  @Post('income')
  @ApiOperation({ summary: 'Record an income transaction' })
  @ApiResponse({ status: 201, description: 'Income recorded, account balance updated' })
  addIncome(@Body() dto: CreateIncomeDto) {
    return this.transactionsService.addIncome(dto);
  }

  // ─── EXPENSE ──────────────────────────────────────────────────────────────────

  // POST /transactions/expense
  @Post('expense')
  @ApiOperation({ summary: 'Record an expense transaction' })
  @ApiResponse({ status: 201, description: 'Expense recorded, account balance debited' })
  @ApiResponse({ status: 400, description: 'Insufficient balance' })
  addExpense(@Body() dto: CreateExpenseDto) {
    return this.transactionsService.addExpense(dto);
  }

  // ─── TRANSFER ─────────────────────────────────────────────────────────────────

  // POST /transactions/transfer
  @Post('transfer')
  @ApiOperation({ summary: 'Transfer funds between two accounts' })
  transfer(@Body() dto: CreateTransferDto) {
    return this.transactionsService.transfer(dto);
  }

  // ─── LIST / FILTER ────────────────────────────────────────────────────────────

  // GET /transactions
  // Supports: ?preset=today|this_week|this_month|this_year
  //           ?startDate=2024-06-01&endDate=2024-06-30
  //           ?type=income|expense|transfer
  //           ?accountId=xxx&category=Sales&tag=invoice
  //           ?page=1&limit=20&sortBy=date&sortOrder=desc
  @Get()
  @ApiOperation({
    summary: 'List transactions with rich filtering (date preset, date range, type, account, category, tag)',
  })
  findAll(@Query() filter: TransactionFilterDto) {
    return this.transactionsService.findAll(filter);
  }

  // GET /transactions/income  (convenience - pre-filters type=income)
  @Get('income')
  @ApiOperation({ summary: 'List only income transactions (all filters supported)' })
  findIncome(@Query() filter: TransactionFilterDto) {
    return this.transactionsService.findAll({ ...filter, type: 'income' as any });
  }

  // GET /transactions/expense  (convenience - pre-filters type=expense)
  @Get('expense')
  @ApiOperation({ summary: 'List only expense transactions (all filters supported)' })
  findExpense(@Query() filter: TransactionFilterDto) {
    return this.transactionsService.findAll({ ...filter, type: 'expense' as any });
  }

  // ─── ANALYTICS ────────────────────────────────────────────────────────────────

  // GET /transactions/analytics
  @Get('analytics')
  @ApiOperation({
    summary: 'Get comprehensive analytics: totals, net profit, trends, category breakdown, top transactions',
  })
  getAnalytics(@Query() filter: AnalyticsFilterDto) {
    return this.transactionsService.getAnalytics(filter);
  }

  // GET /transactions/cashflow
  @Get('cashflow')
  @ApiOperation({ summary: 'Weekly cashflow statement' })
  getCashflow(@Query() filter: AnalyticsFilterDto) {
    return this.transactionsService.getCashflowStatement(filter);
  }

  // ─── SINGLE / CRUD ────────────────────────────────────────────────────────────

  // GET /transactions/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get a single transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction MongoDB ObjectId' })
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  // PATCH /transactions/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction (amount, category, description, date)' })
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionsService.update(id, dto);
  }

  // DELETE /transactions/:id
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a transaction and reverse balance effect' })
  remove(@Param('id') id: string) {
    return this.transactionsService.remove(id);
  }
}
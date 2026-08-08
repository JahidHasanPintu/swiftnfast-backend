import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionType,
} from './schemas/transaction.schema';
import { AccountsService } from '../accounts/accounts.service';
import {
  CreateIncomeDto,
  CreateExpenseDto,
  CreateTransferDto,
  UpdateTransactionDto,
  TransactionFilterDto,
  AnalyticsFilterDto,
} from './dto/transaction.dto';
import { resolveDateRange } from '../common/date-range.util';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private txModel: Model<TransactionDocument>,
    private accountsService: AccountsService,
  ) {}

  // ─── INCOME ───────────────────────────────────────────────────────────────────

  async addIncome(dto: CreateIncomeDto): Promise<TransactionDocument> {
    const accountId = new Types.ObjectId(dto.accountId);
    await this.accountsService.findOne(dto.accountId); // validate exists

    // Credit the account
    const updatedAccount = await this.accountsService.updateBalance(accountId, dto.amount);

    const tx = new this.txModel({
      type: TransactionType.INCOME,
      amount: dto.amount,
      accountId,
      category: dto.category,
      subCategory: dto.subCategory,
      description: dto.description,
      date: dto.date ? new Date(dto.date) : new Date(),
      tags: dto.tags ?? [],
      reference: dto.reference,
      balanceAfter: updatedAccount.currentBalance,
    });

    return tx.save();
  }

  // ─── EXPENSE ──────────────────────────────────────────────────────────────────

  async addExpense(dto: CreateExpenseDto): Promise<TransactionDocument> {
    const accountId = new Types.ObjectId(dto.accountId);
    const account = await this.accountsService.findOne(dto.accountId);

    if (account.currentBalance < dto.amount) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${account.currentBalance}, Required: ${dto.amount}`,
      );
    }

    // Debit the account
    const updatedAccount = await this.accountsService.updateBalance(accountId, -dto.amount);

    const tx = new this.txModel({
      type: TransactionType.EXPENSE,
      amount: dto.amount,
      accountId,
      category: dto.category,
      subCategory: dto.subCategory,
      description: dto.description,
      date: dto.date ? new Date(dto.date) : new Date(),
      tags: dto.tags ?? [],
      reference: dto.reference,
      balanceAfter: updatedAccount.currentBalance,
    });

    return tx.save();
  }

  // ─── TRANSFER ─────────────────────────────────────────────────────────────────

  async transfer(dto: CreateTransferDto): Promise<{ debit: TransactionDocument; credit: TransactionDocument }> {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Cannot transfer to the same account');
    }

    const fromAccountId = new Types.ObjectId(dto.fromAccountId);
    const toAccountId = new Types.ObjectId(dto.toAccountId);

    const fromAccount = await this.accountsService.findOne(dto.fromAccountId);
    await this.accountsService.findOne(dto.toAccountId); // validate target exists

    if (fromAccount.currentBalance < dto.amount) {
      throw new BadRequestException(
        `Insufficient balance in source account. Available: ${fromAccount.currentBalance}`,
      );
    }

    const date = dto.date ? new Date(dto.date) : new Date();

    const updatedFrom = await this.accountsService.updateBalance(fromAccountId, -dto.amount);
    const updatedTo = await this.accountsService.updateBalance(toAccountId, dto.amount);

    const debitTx = new this.txModel({
      type: TransactionType.TRANSFER,
      amount: dto.amount,
      accountId: fromAccountId,
      toAccountId,
      category: 'Transfer Out',
      description: dto.description,
      date,
      reference: dto.reference,
      balanceAfter: updatedFrom.currentBalance,
    });

    const creditTx = new this.txModel({
      type: TransactionType.TRANSFER,
      amount: dto.amount,
      accountId: toAccountId,
      toAccountId: fromAccountId,
      category: 'Transfer In',
      description: dto.description,
      date,
      reference: dto.reference,
      balanceAfter: updatedTo.currentBalance,
    });

    const [debit, credit] = await Promise.all([debitTx.save(), creditTx.save()]);
    return { debit, credit };
  }

  // ─── LIST / FILTER ────────────────────────────────────────────────────────────

  async findAll(filter: TransactionFilterDto): Promise<{
    data: TransactionDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query: Record<string, any> = {};

    // Date range
    const dateRange = resolveDateRange(filter.preset, filter.startDate, filter.endDate);
    if (dateRange) {
      query.date = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }

    if (filter.type) query.type = filter.type;
    if (filter.accountId) query.accountId = new Types.ObjectId(filter.accountId);
    if (filter.category) query.category = { $regex: filter.category, $options: 'i' };
    if (filter.tag) query.tags = { $in: [filter.tag] };

    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, filter.limit ?? 20);
    const skip = (page - 1) * limit;

    const sortField = filter.sortBy ?? 'date';
    const sortDir = filter.sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.txModel
        .find(query)
        .populate('accountId', 'name type')
        .populate('toAccountId', 'name type')
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit),
      this.txModel.countDocuments(query),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<TransactionDocument> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid transaction ID');
    const tx = await this.txModel
      .findById(id)
      .populate('accountId', 'name type')
      .populate('toAccountId', 'name type');
    if (!tx) throw new NotFoundException(`Transaction #${id} not found`);
    return tx;
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateTransactionDto): Promise<TransactionDocument> {
    const tx = await this.findOne(id);

    if (tx.type === TransactionType.TRANSFER) {
      throw new BadRequestException('Transfer transactions cannot be edited directly');
    }
    if (tx.type === TransactionType.BALANCE_ADJUSTMENT) {
      throw new BadRequestException('Balance adjustment records cannot be edited');
    }

    // If amount changed, reverse old and apply new
    if (dto.amount && dto.amount !== tx.amount) {
      const delta = tx.type === TransactionType.INCOME
        ? dto.amount - tx.amount   // income: increase = more credit
        : tx.amount - dto.amount;  // expense: decrease amount = refund difference

      await this.accountsService.updateBalance(tx.accountId as Types.ObjectId, delta);
    }

    Object.assign(tx, dto);
    if (dto.date) tx.date = new Date(dto.date);
    return tx.save();
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ message: string }> {
    const tx = await this.findOne(id);

    if (tx.type === TransactionType.TRANSFER) {
      throw new BadRequestException('Cannot delete individual transfer legs. Delete both legs or reverse the transfer.');
    }

    // Reverse the balance effect
    const delta =
      tx.type === TransactionType.INCOME
        ? -tx.amount
        : tx.type === TransactionType.EXPENSE
        ? tx.amount
        : 0;

    if (delta !== 0) {
      await this.accountsService.updateBalance(tx.accountId as Types.ObjectId, delta);
    }

    await tx.deleteOne();
    return { message: 'Transaction deleted and balance reversed successfully' };
  }

  // ─── ANALYTICS ────────────────────────────────────────────────────────────────

  async getAnalytics(filter: AnalyticsFilterDto) {
    const matchStage: Record<string, any> = {
      type: { $in: [TransactionType.INCOME, TransactionType.EXPENSE] },
    };

    const dateRange = resolveDateRange(filter.preset, filter.startDate, filter.endDate);
    if (dateRange) {
      matchStage.date = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }
    if (filter.accountId) {
      matchStage.accountId = new Types.ObjectId(filter.accountId);
    }

    // ── Overview ──────────────────────────────────────────────────────────────
    const overview = await this.txModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avg: { $avg: '$amount' },
          max: { $max: '$amount' },
          min: { $min: '$amount' },
        },
      },
    ]);

    const income = overview.find((o) => o._id === TransactionType.INCOME) ?? {
      total: 0, count: 0, avg: 0, max: 0, min: 0,
    };
    const expense = overview.find((o) => o._id === TransactionType.EXPENSE) ?? {
      total: 0, count: 0, avg: 0, max: 0, min: 0,
    };

    const netProfit = income.total - expense.total;
    const profitMargin = income.total > 0 ? (netProfit / income.total) * 100 : 0;

    // ── Income by Category ────────────────────────────────────────────────────
    const incomeByCategory = await this.txModel.aggregate([
      { $match: { ...matchStage, type: TransactionType.INCOME } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // ── Expense by Category ───────────────────────────────────────────────────
    const expenseByCategory = await this.txModel.aggregate([
      { $match: { ...matchStage, type: TransactionType.EXPENSE } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // ── Daily trend (last 30 days) ────────────────────────────────────────────
    const dailyTrend = await this.txModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            type: '$type',
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          income: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', TransactionType.INCOME] }, '$total', 0],
            },
          },
          expense: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', TransactionType.EXPENSE] }, '$total', 0],
            },
          },
        },
      },
      { $addFields: { net: { $subtract: ['$income', '$expense'] } } },
      { $sort: { _id: 1 } },
    ]);

    // ── Monthly trend ─────────────────────────────────────────────────────────
    const monthlyTrend = await this.txModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$date' } },
            type: '$type',
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.month',
          income: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', TransactionType.INCOME] }, '$total', 0],
            },
          },
          expense: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', TransactionType.EXPENSE] }, '$total', 0],
            },
          },
        },
      },
      { $addFields: { net: { $subtract: ['$income', '$expense'] } } },
      { $sort: { _id: 1 } },
    ]);

    // ── By Account ────────────────────────────────────────────────────────────
    const byAccount = await this.txModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { accountId: '$accountId', type: '$type' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'accounts',
          localField: '_id.accountId',
          foreignField: '_id',
          as: 'account',
        },
      },
      { $unwind: '$account' },
      {
        $group: {
          _id: '$_id.accountId',
          accountName: { $first: '$account.name' },
          accountType: { $first: '$account.type' },
          income: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', TransactionType.INCOME] }, '$total', 0],
            },
          },
          expense: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', TransactionType.EXPENSE] }, '$total', 0],
            },
          },
        },
      },
      { $addFields: { net: { $subtract: ['$income', '$expense'] } } },
      { $sort: { net: -1 } },
    ]);

    // ── Top transactions ──────────────────────────────────────────────────────
    const topIncome = await this.txModel
      .find({ ...matchStage, type: TransactionType.INCOME })
      .sort({ amount: -1 })
      .limit(5)
      .populate('accountId', 'name');

    const topExpense = await this.txModel
      .find({ ...matchStage, type: TransactionType.EXPENSE })
      .sort({ amount: -1 })
      .limit(5)
      .populate('accountId', 'name');

    return {
      period: dateRange ?? { startDate: 'all time', endDate: new Date() },
      summary: {
        totalIncome: income.total,
        totalExpense: expense.total,
        netProfit,
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        incomeCount: income.count,
        expenseCount: expense.count,
        avgIncome: parseFloat((income.avg ?? 0).toFixed(2)),
        avgExpense: parseFloat((expense.avg ?? 0).toFixed(2)),
      },
      incomeByCategory,
      expenseByCategory,
      dailyTrend,
      monthlyTrend,
      byAccount,
      topIncome,
      topExpense,
    };
  }

  // ─── CASHFLOW STATEMENT ───────────────────────────────────────────────────────

  async getCashflowStatement(filter: AnalyticsFilterDto) {
    const matchStage: Record<string, any> = {};
    const dateRange = resolveDateRange(filter.preset, filter.startDate, filter.endDate);

    if (dateRange) {
      matchStage.date = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }
    if (filter.accountId) {
      matchStage.accountId = new Types.ObjectId(filter.accountId);
    }

    const rows = await this.txModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            week: { $isoWeek: '$date' },
            year: { $isoWeekYear: '$date' },
            type: '$type',
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { week: '$_id.week', year: '$_id.year' },
          income: {
            $sum: { $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0] },
          },
          expense: {
            $sum: { $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0] },
          },
        },
      },
      { $addFields: { net: { $subtract: ['$income', '$expense'] } } },
      { $sort: { '_id.year': 1, '_id.week': 1 } },
    ]);

    return { period: dateRange, cashflow: rows };
  }
}
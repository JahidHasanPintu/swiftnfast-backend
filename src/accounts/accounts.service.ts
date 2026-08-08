import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument, AccountStatus } from './schemas/account.schema';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';
import { AdjustBalanceDto, CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
  ) {}

  // ─── CREATE ───────────────────────────────────────────────────────────────────

  async create(dto: CreateAccountDto): Promise<AccountDocument> {
    // If this account is set as default, unset all others
    if (dto.isDefault) {
      await this.accountModel.updateMany({}, { isDefault: false });
    }

    const account = new this.accountModel({
      ...dto,
      currentBalance: dto.openingBalance ?? 0,
    });

    return account.save();
  }

  // ─── READ ─────────────────────────────────────────────────────────────────────

  async findAll(includeInactive = false): Promise<AccountDocument[]> {
    const filter = includeInactive ? {} : { status: AccountStatus.ACTIVE };
    return this.accountModel.find(filter).sort({ isDefault: -1, name: 1 });
  }

  async findOne(id: string): Promise<AccountDocument> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid account ID');
    const account = await this.accountModel.findById(id);
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    return account;
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateAccountDto): Promise<AccountDocument> {
    const account = await this.findOne(id);

    if (dto.isDefault) {
      await this.accountModel.updateMany({ _id: { $ne: id } }, { isDefault: false });
    }

    Object.assign(account, dto);
    return account.save();
  }

  // ─── TOGGLE STATUS ────────────────────────────────────────────────────────────

  async toggleStatus(id: string): Promise<AccountDocument> {
    const account = await this.findOne(id);
    account.status =
      account.status === AccountStatus.ACTIVE ? AccountStatus.INACTIVE : AccountStatus.ACTIVE;
    return account.save();
  }

  // ─── SOFT DELETE ──────────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ message: string }> {
    const account = await this.findOne(id);

    // Check if any transactions reference this account
    const txCount = await this.transactionModel.countDocuments({
      $or: [{ accountId: account._id }, { toAccountId: account._id }],
    });

    if (txCount > 0) {
      throw new BadRequestException(
        `Cannot delete account with ${txCount} transactions. Deactivate it instead.`,
      );
    }

    await account.deleteOne();
    return { message: 'Account deleted successfully' };
  }

  // ─── BALANCE ADJUST ───────────────────────────────────────────────────────────

  async adjustBalance(
    id: string,
    dto: AdjustBalanceDto,
  ): Promise<{ account: AccountDocument; transaction: TransactionDocument }> {
    const account = await this.findOne(id);
    const difference = dto.newBalance - account.currentBalance;

    // Record the adjustment as a transaction for audit trail
    const transaction = new this.transactionModel({
      type: TransactionType.BALANCE_ADJUSTMENT,
      amount: Math.abs(difference),
      accountId: account._id,
      category: 'Balance Adjustment',
      description: dto.reason,
      date: new Date(),
      adjustmentNote: `Previous: ${account.currentBalance} → New: ${dto.newBalance} (Diff: ${difference > 0 ? '+' : ''}${difference})`,
      balanceAfter: dto.newBalance,
    });

    account.currentBalance = dto.newBalance;

    await Promise.all([account.save(), transaction.save()]);

    return { account, transaction };
  }

  // ─── SUMMARY (for dashboard) ─────────────────────────────────────────────────

  async getSummary(): Promise<{
    totalAccounts: number;
    activeAccounts: number;
    totalBalance: number;
    accounts: AccountDocument[];
  }> {
    const accounts = await this.accountModel.find({ status: AccountStatus.ACTIVE });
    const allAccounts = await this.accountModel.find();

    const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

    return {
      totalAccounts: allAccounts.length,
      activeAccounts: accounts.length,
      totalBalance,
      accounts,
    };
  }

  // ─── INTERNAL: update balance (called by TransactionsService) ────────────────

  async updateBalance(
    accountId: Types.ObjectId,
    delta: number, // positive = credit, negative = debit
  ): Promise<AccountDocument> {
    const account = await this.accountModel.findByIdAndUpdate(
      accountId,
      { $inc: { currentBalance: delta } },
      { new: true },
    );
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    return account;
  }

  async getBalanceById(accountId: Types.ObjectId): Promise<number> {
    const account = await this.accountModel.findById(accountId).select('currentBalance');
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    return account.currentBalance;
  }
}
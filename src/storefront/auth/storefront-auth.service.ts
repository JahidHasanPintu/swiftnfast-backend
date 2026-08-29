import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { StorefrontJwtService } from './storefront-jwt.service';
import { CustomerDocument } from '../../order/interfaces/customer.interface';
import { Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';

const OTP_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes
const RESET_TOKEN_LIFETIME_MS = 15 * 60 * 1000; // 15 minutes

function sanitizeUser(user: CustomerDocument) {
  const doc = user.toObject();
  delete doc.password;
  delete doc.otp;
  delete doc.otpExpiry;
  delete doc.resetToken;
  delete doc.resetTokenExpiry;
  // Map customer fields to frontend-friendly names
  return {
    ...doc,
    id: doc._id,
    name: doc.customerName,
    email: doc.emailAddress,
    phone: doc.contactNumber || doc.phone,
  };
}

@Injectable()
export class StorefrontAuthService {
  private readonly logger = new Logger('StorefrontAuth');
  constructor(
    @InjectModel('Customer')
    private readonly customerModel: Model<CustomerDocument>,
    private readonly jwtService: StorefrontJwtService,
    private readonly mailService: MailService,
  ) {}

  private async findVerifiedByEmail(email: string) {
    return this.customerModel
      .findOne({
        emailAddress: (email || '').toLowerCase(),
        isDeleted: { $ne: true },
      })
      .exec();
  }

  async register(body: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) {
    const email = (body.email || '').toLowerCase();
    const existing = await this.customerModel
      .findOne({ emailAddress: email })
      .exec();
    if (existing) {
      throw new BadRequestException('User already exists');
    }
    const password = await bcrypt.hash(body.password, 10);
    const customer = new this.customerModel({
      customerName: body.name,
      emailAddress: email,
      contactNumber: body.phone || '',
      phone: body.phone || '',
      password,
      role: 'user',
      isVerified: true,
      isDeleted: false,
      needsPasswordChange: false,
      otpVerified: false,
      grandTotal: 0,
      sourceOfOrder: 'storefront',
    });
    await customer.save();
    return { user: customer, created: true };
  }

  async login(body: { email: string; password: string }) {
    const user = await this.findVerifiedByEmail(body.email);
    if (!user) {
      throw new BadRequestException('User does not exist');
    }
    if (!user.isVerified) {
      throw new BadRequestException(
        'Please verify your email before logging in',
      );
    }
    if (!user.password) {
      throw new BadRequestException(
        'This account does not have a password. Please use OTP login.',
      );
    }
    const ok = await bcrypt.compare(body.password, user.password);
    if (!ok) {
      throw new BadRequestException('Password does not match');
    }
    const accessToken = this.jwtService.sign({
      email: user.emailAddress,
      userId: String(user._id),
      role: user.role,
    });
    return { ...sanitizeUser(user), accessToken };
  }

  async requestOtp(body: { identifier: string }) {
    const email = (body.identifier || '').toLowerCase();
    const user = await this.customerModel
      .findOne({ emailAddress: email })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found with this email');
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + OTP_LIFETIME_MS);
    user.otpVerified = false;
    await user.save();
    // Send OTP via email (non-blocking)
    this.mailService.sendOtpEmail(email, otp).catch((err) => {
      this.logger.error(`OTP email failed for ${email}`, err.stack);
    });
    return { email, otp };
  }

  async verifyOtp(body: { identifier: string; otp: string }) {
    const email = (body.identifier || '').toLowerCase();
    const user = await this.customerModel
      .findOne({ emailAddress: email })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.otp) {
      throw new BadRequestException('No OTP found. Please request a new OTP');
    }
    if (user.otp !== String(body.otp)) {
      throw new BadRequestException('Invalid OTP');
    }
    if (!user.otpExpiry || user.otpExpiry.getTime() < Date.now()) {
      throw new BadRequestException(
        'OTP has expired. Please request a new OTP',
      );
    }
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpVerified = true;
    user.isVerified = true;
    await user.save();
    const accessToken = this.jwtService.sign({
      email: user.emailAddress,
      userId: String(user._id),
      role: user.role,
    });
    return { ...sanitizeUser(user), accessToken };
  }

  async forgotPassword(body: { email: string }) {
    const email = (body.email || '').toLowerCase();
    const user = await this.customerModel
      .findOne({ emailAddress: email })
      .exec();
    // Always return success to prevent email enumeration
    if (!user) {
      return {
        success: true,
        message: 'If the email exists, a reset link has been sent',
      };
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_LIFETIME_MS);
    await user.save();
    this.mailService.sendPasswordResetEmail(email, resetToken).catch((err) => {
      this.logger.error(`Password reset email failed for ${email}`, err.stack);
    });
    return {
      success: true,
      message: 'If the email exists, a reset link has been sent',
    };
  }

  async resetPassword(body: { token: string; newPassword: string }) {
    const user = await this.customerModel
      .findOne({
        resetToken: body.token,
        resetTokenExpiry: { $gt: new Date() },
      })
      .exec();
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    user.password = await bcrypt.hash(body.newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    return { success: true, message: 'Password reset successful' };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { StorefrontJwtService } from './storefront-jwt.service';
import { Pfu2UserDocument } from '../interfaces/pfu2-user.interface';
import { Logger } from '@nestjs/common';

const OTP_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes

function sanitizeUser(user: Pfu2UserDocument) {
  const doc = user.toObject();
  delete doc.password;
  delete doc.otp;
  delete doc.otpExpiry;
  return doc;
}

@Injectable()
export class StorefrontAuthService {
  private readonly logger = new Logger('StorefrontAuth');
  constructor(
    @InjectModel('Pfu2User')
    private readonly userModel: Model<Pfu2UserDocument>,
    private readonly jwtService: StorefrontJwtService,
  ) {}

  private async findVerifiedByEmail(email: string) {
    return this.userModel
      .findOne({ email: (email || '').toLowerCase(), isDeleted: { $ne: true } })
      .exec();
  }

  async register(body: { name: string; email: string; password: string }) {
    const email = (body.email || '').toLowerCase();
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      throw new BadRequestException('User already exists');
    }
    const password = await bcrypt.hash(body.password, 10);
    const user = new this.userModel({
      name: body.name,
      email,
      password,
      role: 'user',
      isVerified: true, // pfu2 register flow verifies via email; keep OTP-based login simple
      isDeleted: false,
      needsPasswordChange: false,
      otpVerified: false,
    });
    await user.save();
    return { user, created: true };
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
    const ok = await bcrypt.compare(body.password, user.password);
    if (!ok) {
      throw new BadRequestException('Password does not match');
    }
    const accessToken = this.jwtService.sign({
      email: user.email,
      userId: String(user._id),
      role: user.role,
    });
    return { ...sanitizeUser(user), accessToken };
  }

  async requestOtp(body: { identifier: string }) {
    const email = (body.identifier || '').toLowerCase();
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new NotFoundException('User not found with this email');
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + OTP_LIFETIME_MS);
    user.otpVerified = false;
    await user.save();
    // pfu2 echoes the OTP back AND emails it; here we log it for dev.
    this.logger.log(`OTP for ${email}: ${otp}`);
    return { email, otp };
  }

  async verifyOtp(body: { identifier: string; otp: string }) {
    const email = (body.identifier || '').toLowerCase();
    const user = await this.userModel.findOne({ email }).exec();
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
      email: user.email,
      userId: String(user._id),
      role: user.role,
    });
    return { ...sanitizeUser(user), accessToken };
  }
}

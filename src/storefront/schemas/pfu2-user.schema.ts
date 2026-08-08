import * as mongoose from 'mongoose';

export const Pfu2UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    role: {
      type: String,
      enum: ['superAdmin', 'admin', 'user'],
      default: 'user',
    },
    isDeleted: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    needsPasswordChange: { type: Boolean, default: true },
    passwordChangedAt: { type: Date },
    otp: { type: String },
    otpExpiry: { type: Date },
    otpVerified: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'pfu2_users' },
);
Pfu2UserSchema.index({ email: 1 }, { unique: true });

export default Pfu2UserSchema;

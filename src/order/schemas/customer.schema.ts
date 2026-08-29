import * as mongoose from 'mongoose';

export const CustomerSchema = new mongoose.Schema(
  {
    // Order-related fields (used by admin order system)
    customerId: { type: String }, // Unique customer identifier (e.g., 'PFU2-2334')
    contactNumber: { type: String, required: true },
    emailAddress: { type: String },
    shippingAddress: { type: String },
    districtName: { type: String },
    totalAdvance: { type: Number },
    grandTotal: { type: Number },
    sourceOfOrder: { type: String },
    customerDateOfBirth: { type: Date },
    customerJoiningDate: { type: Date },
    orderDate: { type: Date },
    createdBy: { type: String },

    // Profile fields (used by storefront)
    customerName: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    dateOfBirth: { type: Date },

    // Auth fields (used by storefront auth)
    password: { type: String },
    role: {
      type: String,
      enum: ['superAdmin', 'admin', 'user'],
      default: 'user',
    },
    isVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    needsPasswordChange: { type: Boolean, default: true },
    passwordChangedAt: { type: Date },
    otp: { type: String },
    otpExpiry: { type: Date },
    otpVerified: { type: Boolean, default: false },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
    status: {
      type: String,
      enum: ['active', 'inactive', 'blocked'],
      default: 'active',
    },
  },
  { timestamps: true },
);

// Indexes
CustomerSchema.index({ emailAddress: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ contactNumber: 1 });
CustomerSchema.index({ customerId: 1 });
CustomerSchema.index({ orderId: 1 });

export default CustomerSchema;

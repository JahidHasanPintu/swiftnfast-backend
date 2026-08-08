import * as mongoose from 'mongoose';

export const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    label: { type: String },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
SettingSchema.index({ key: 1 }, { unique: true });

export default SettingSchema;

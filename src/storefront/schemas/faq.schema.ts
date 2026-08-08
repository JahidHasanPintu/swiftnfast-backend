import * as mongoose from 'mongoose';

export const FaqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
FaqSchema.index({ order: 1 });

export default FaqSchema;

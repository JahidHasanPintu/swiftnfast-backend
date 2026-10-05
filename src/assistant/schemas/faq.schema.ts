import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: false })
export class AssistantFaq {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  category: string;

  @Prop({ default: true })
  active: boolean;

  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop({ type: [String], default: [] })
  alternative_phrasings: string[];

  @Prop({ type: [String], default: [] })
  suggested_followups: string[];

  @Prop({ type: [String], default: [] })
  keywords_bangla: string[];

  @Prop({ type: [String], default: [] })
  alternative_phrasings_bangla: string[];

  @Prop({ type: Date, default: Date.now })
  updated_at: Date;

  @Prop({ type: String })
  updated_by: string;
}

export type AssistantFaqDocument = AssistantFaq & Document;
export const AssistantFaqSchema = SchemaFactory.createForClass(AssistantFaq);
AssistantFaqSchema.index({ active: 1 });
AssistantFaqSchema.index({ id: 1 });

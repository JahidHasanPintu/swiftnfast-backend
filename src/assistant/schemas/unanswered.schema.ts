import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: false })
export class AssistantUnanswered {
  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  normalized: string;

  @Prop({ type: String })
  topCandidateId: string;

  @Prop({ type: Number })
  topScore: number;

  @Prop({ type: String, default: 'en' })
  locale: string;

  @Prop({ type: Number, default: 1 })
  timesAsked: number;

  @Prop({ type: Date, default: Date.now })
  created_at: Date;

  @Prop({ type: Date, default: Date.now })
  updated_at: Date;
}

export type AssistantUnansweredDocument = AssistantUnanswered & Document;
export const AssistantUnansweredSchema = SchemaFactory.createForClass(AssistantUnanswered);
AssistantUnansweredSchema.index({ normalized: 1 });
AssistantUnansweredSchema.index({ updated_at: -1 });

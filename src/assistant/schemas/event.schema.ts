import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: false })
export class AssistantEvent {
  @Prop({
    type: String,
    required: true,
    enum: [
      'chatbot_open',
      'chatbot_question',
      'chatbot_answered',
      'chatbot_unanswered',
      'chatbot_whatsapp',
      'chatbot_messenger',
      'quick_action',
    ],
  })
  type: string;

  @Prop({ type: Date, default: Date.now })
  created_at: Date;
}

export type AssistantEventDocument = AssistantEvent & Document;
export const AssistantEventSchema = SchemaFactory.createForClass(AssistantEvent);
AssistantEventSchema.index({ type: 1, created_at: -1 });

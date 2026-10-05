import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: false })
export class AssistantConfig {
  @Prop({ type: Object, default: { USA: 220, UK: 140 } })
  weightChargeBdtPer100g: { USA: number; UK: number };

  @Prop({
    type: Object,
    default: { below12000: 50, atLeast12000: 80 },
  })
  advancePercent: { below12000: number; atLeast12000: number };

  @Prop({ default: 12000 })
  advanceThresholdBdt: number;

  @Prop({ default: '25-45' })
  deliveryTypicalDays: string;

  @Prop({
    type: Object,
    default: {
      includedForMostProducts: true,
      mobilePhoneBdt: 50000,
      laptopBdt: 10000,
    },
  })
  customs: {
    includedForMostProducts: boolean;
    mobilePhoneBdt: number;
    laptopBdt: number;
  };

  @Prop({ type: Object, default: { insideDhaka: 100, outsideDhaka: 150 } })
  readyStockDeliveryBdt: { insideDhaka: number; outsideDhaka: number };

  @Prop({
    type: Object,
    default: {
      phone: '09678-882888',
      whatsappE164: '8801613333011',
      email: 'shop.pfu2@gmail.com',
      messengerPageUrl: 'https://m.me/pfusauk',
      instagramUrl: 'https://www.instagram.com/pfu2_15/',
      address: 'Gulshan-1, Dhaka',
    },
  })
  contact: {
    phone: string;
    whatsappE164: string;
    email: string;
    messengerPageUrl: string;
    instagramUrl: string;
    address: string;
  };

  @Prop({ default: 'ceil_per_started_100g' })
  weightRoundingRule: string;
}

export type AssistantConfigDocument = AssistantConfig & Document;
export const AssistantConfigSchema = SchemaFactory.createForClass(AssistantConfig);

// user-registration.model.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class UserRegistration extends Document {
    @Prop({ required: true })
    username: string;

    @Prop({ required: true })
    contactNumber: string;

    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true, enum: ['Admin', 'Super Admin'] })
    userType: string;

    @Prop({ required: true })
    password: string;

    // Additional fields specific to user registration, if needed

    // You can also define methods and static functions related to this model
}

export const UserRegistrationSchema = SchemaFactory.createForClass(UserRegistration);


import { Document, ObjectId } from 'mongoose';


export interface UserDocument extends Document {
    username: string;
    password: string;
}







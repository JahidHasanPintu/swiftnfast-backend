
import { Document, ObjectId } from 'mongoose';


export interface SignUpDocument extends Document {
    username: string;
    password: string;
}







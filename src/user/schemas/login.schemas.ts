import * as mongoose from 'mongoose';

export const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    roles: [{ type: String }],
}, { timestamps: true });

export interface User {
    _id: string;
    username: string;
    password: string;
    roles: string[];
    createdAt: Date;
    updatedAt: Date;
}

// Export the schema
export default UserSchema;

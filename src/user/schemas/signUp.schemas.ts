import * as mongoose from 'mongoose';

export const SignUpSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    roles: [{ type: String }],
  },
  { timestamps: true },
);

// Export the schema
export default SignUpSchema;

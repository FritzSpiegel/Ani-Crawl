import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  passHash: string;
  verified: boolean;
  verifyToken?: string;
  verifyExpires?: number;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passHash: { type: String, required: true },
  verified: { type: Boolean, default: false },
  verifyToken: { type: String },
  verifyExpires: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model<IUser>("User", userSchema);
import mongoose, { Schema, Document } from "mongoose";

export interface IApiKey extends Document {
    key: string;
    name: string;
    userId: mongoose.Types.ObjectId;
    permissions: string[];
    rateLimit: number;
    requestCount: number;
    lastUsed: Date | null;
    isActive: boolean;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const apiKeySchema = new Schema<IApiKey>({
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    permissions: {
        type: [String],
        default: ["read"],
        enum: ["read", "write", "delete", "admin"]
    },
    rateLimit: { type: Number, default: 1000 }, // requests per hour
    requestCount: { type: Number, default: 0 },
    lastUsed: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null }
}, { timestamps: true });

// Index for efficient lookups
apiKeySchema.index({ userId: 1, isActive: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ApiKey = mongoose.model<IApiKey>("ApiKey", apiKeySchema);

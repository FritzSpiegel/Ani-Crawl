import mongoose, { Schema, Document } from "mongoose";

export interface IMedia extends Document {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    path: string;
    alt: string;
    caption: string;
    uploadedBy: mongoose.Types.ObjectId;
    folder: string;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

const mediaSchema = new Schema<IMedia>({
    filename: { type: String, required: true, unique: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    path: { type: String, required: true },
    alt: { type: String, default: "" },
    caption: { type: String, default: "" },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    folder: { type: String, default: "/" },
    metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// Indexes
mediaSchema.index({ folder: 1, createdAt: -1 });
mediaSchema.index({ uploadedBy: 1 });
mediaSchema.index({ mimeType: 1 });
mediaSchema.index({ originalName: "text", alt: "text", caption: "text" });

export const Media = mongoose.model<IMedia>("Media", mediaSchema);

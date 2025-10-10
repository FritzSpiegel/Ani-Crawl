import mongoose, { Schema, Document } from "mongoose";

export interface IWatchlistItem extends Document {
  userId: mongoose.Types.ObjectId;
  itemId: string;
  title: string;
  image?: string;
  createdAt: Date;
}

const watchlistSchema = new Schema<IWatchlistItem>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  itemId: { type: String, required: true },
  title: { type: String, required: true },
  image: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Compound index to ensure user can't add same item twice
watchlistSchema.index({ userId: 1, itemId: 1 }, { unique: true });

export const WatchlistItem = mongoose.model<IWatchlistItem>("WatchlistItem", watchlistSchema);
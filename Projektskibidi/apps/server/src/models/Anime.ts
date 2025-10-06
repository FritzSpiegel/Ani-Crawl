import mongoose, { Schema, model } from "mongoose";

export type Episode = {
  number: number;
  title?: string;
  languages?: string[];
};

export type AnimeDoc = mongoose.Document & {
  slug: string;
  canonicalTitle: string;
  altTitles: string[];
  normalizedTitle: string;
  description: string;
  imageUrl?: string;
  yearStart?: number | null;
  yearEnd?: number | null;
  genres: string[];
  cast: string[];
  producers: string[];
  episodes?: Episode[];
  sourceUrl: string;
  lastCrawledAt: Date;
};

const EpisodeSchema = new Schema<Episode>({
  number: { type: Number, required: true },
  title: { type: String },
  languages: { type: [String], default: [] },
});

const AnimeSchema = new Schema<AnimeDoc>({
  slug: { type: String, index: true, unique: true },
  canonicalTitle: { type: String, required: true },
  altTitles: { type: [String], default: [] },
  normalizedTitle: { type: String, index: true },
  description: { type: String, default: "" },
  imageUrl: { type: String },
  yearStart: { type: Number },
  yearEnd: { type: Number },
  genres: { type: [String], default: [] },
  cast: { type: [String], default: [] },
  producers: { type: [String], default: [] },
  episodes: { type: [EpisodeSchema], default: [] },
  sourceUrl: { type: String, required: true },
  lastCrawledAt: { type: Date, required: true },
}, { timestamps: true });

export const AnimeModel = model<AnimeDoc>("Anime", AnimeSchema);

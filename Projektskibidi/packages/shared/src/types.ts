export type EpisodeDTO = {
  number: number;
  title?: string;
  languages?: string[];
};

export type AnimeDTO = {
  slug: string;
  canonicalTitle: string;
  altTitles: string[];
  description: string;
  imageUrl: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  genres: string[];
  cast: string[];
  producers: string[];
  episodes?: EpisodeDTO[];
  sourceUrl: string;
  lastCrawledAt: string; // ISO string
};

export type ErrorDTO = {
  error: {
    code: "NOT_FOUND" | "CRAWL_FAILED" | "VALIDATION_FAILED";
    message: string;
  };
};

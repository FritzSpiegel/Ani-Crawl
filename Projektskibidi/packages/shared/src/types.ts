export type EpisodeDTO = {
  number: number;
  title?: string;
  languages?: string[];
};

export type GenreDTO = {
  id: number;
  name: string;
  slug: string;
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

/** Extended anime shape returned when consuming Strapi directly */
export type StrapiAnimeDTO = Omit<AnimeDTO, "genres"> & {
  id: number;
  genres: GenreDTO[];
  isFeatured: boolean;
  normalizedTitle: string;
};

export type AnimeListItem = {
  id: number | string;
  slug: string;
  title: string;
  img: string;
};

export type ErrorDTO = {
  error: {
    code: "NOT_FOUND" | "CRAWL_FAILED" | "VALIDATION_FAILED" | "FETCH_FAILED";
    message: string;
  };
};

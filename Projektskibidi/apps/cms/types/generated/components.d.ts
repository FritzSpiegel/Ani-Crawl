import type { Schema, Struct } from '@strapi/strapi';

export interface AnimeEpisode extends Struct.ComponentSchema {
  collectionName: 'components_anime_episodes';
  info: {
    description: 'A single anime episode with number, title, and available languages';
    displayName: 'Episode';
    icon: 'play';
  };
  attributes: {
    languages: Schema.Attribute.JSON;
    number: Schema.Attribute.Integer & Schema.Attribute.Required;
    title: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'anime.episode': AnimeEpisode;
    }
  }
}

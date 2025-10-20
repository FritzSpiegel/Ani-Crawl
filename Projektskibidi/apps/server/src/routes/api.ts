import { Router } from "express";
import { z } from "zod";
import { AnimeModel } from "../models/Anime";
import { normalizeTitle } from "../utils/normalize";
import { loadSearchHtml, loadDetailHtml } from "../crawler/fetch";
import { parseSearch, parseDetail, deriveSlugAndSourceUrl } from "../crawler/parser";
import { AnimeSchema } from "@aniworld/shared";
import { authRouter } from "./auth";

const router = Router();

const SearchQuery = z.object({ q: z.string().min(1), fetchLive: z.coerce.boolean().optional() });
const SuggestionsQuery = z.object({ q: z.string().min(1) });

// Curated list of popular anime to quickly seed the database (~300 titles)
const POPULAR_ANIME_TITLES: string[] = [
  "Attack on Titan", "One Piece", "Naruto", "Naruto Shippuden", "Boruto",
  "Dragon Ball", "Dragon Ball Z", "Dragon Ball Super", "Dragon Ball GT",
  "Demon Slayer", "Jujutsu Kaisen", "My Hero Academia", "Fullmetal Alchemist Brotherhood",
  "Fullmetal Alchemist", "Death Note", "Bleach", "Bleach: Thousand-Year Blood War",
  "Hunter x Hunter", "Tokyo Ghoul", "Tokyo Ghoul √A", "Tokyo Ghoul:re",
  "Sword Art Online", "Sword Art Online II", "Sword Art Online: Alicization",
  "Fairy Tail", "Fairy Tail (2014)", "Black Clover", "Chainsaw Man", "Spy x Family",
  "Mob Psycho 100", "Mob Psycho 100 II", "One Punch Man", "One Punch Man 2nd Season",
  "Re:Zero", "Konosuba", "Overlord", "Overlord II", "Overlord III", "Overlord IV",
  "The Rising of the Shield Hero", "That Time I Got Reincarnated as a Slime",
  "Dr. Stone", "Dr. Stone: Stone Wars", "Dr. Stone: New World",
  "Fire Force", "The Promised Neverland", "The Promised Neverland Season 2",
  "Vinland Saga", "Beastars", "Your Name", "Spirited Away", "Princess Mononoke",
  "Howl's Moving Castle", "Grave of the Fireflies", "Ponyo", "The Wind Rises",
  "Haikyuu!!", "Haikyuu!! To the Top", "Blue Lock", "Kuroko's Basketball", "Ace of Diamond",
  "Yuri on Ice", "Slam Dunk",
  "Steins;Gate", "Steins;Gate 0", "Code Geass", "Code Geass R2",
  "Neon Genesis Evangelion", "Evangelion 1.0", "Evangelion 2.0", "Evangelion 3.0+1.0",
  "Cowboy Bebop", "Trigun", "Trigun Stampede",
  "Fate/Zero", "Fate/Stay Night", "Fate/Stay Night: Unlimited Blade Works",
  "Fate/Apocrypha", "Fate/Grand Order", "Fate/Grand Order: Babylonia",
  "Gintama", "Gintama°", "Gintama. (2017)", "Gintama: The Final",
  "JoJo's Bizarre Adventure", "JoJo: Stardust Crusaders", "JoJo: Diamond is Unbreakable",
  "JoJo: Golden Wind", "JoJo: Stone Ocean",
  "Bungo Stray Dogs", "Noragami", "Noragami Aragoto", "Psycho-Pass", "Psycho-Pass 2",
  "Parasyte", "Made in Abyss", "Made in Abyss: The Golden City",
  "The Ancient Magus' Bride", "Blue Exorcist", "Blue Exorcist: Kyoto Saga",
  "The Seven Deadly Sins", "The Seven Deadly Sins: Revival of The Commandments",
  "Magi", "Magi: The Kingdom of Magic", "Magi: Adventure of Sinbad",
  "Mushoku Tensei", "Jobless Reincarnation Season 2", "No Game No Life",
  "The Devil is a Part-Timer!", "The Devil is a Part-Timer!!",
  "Toradora!", "Clannad", "Clannad After Story", "Your Lie in April", "Anohana",
  "Violet Evergarden", "A Silent Voice", "Kaguya-sama: Love is War",
  "Kaguya-sama: Love is War?", "Kaguya-sama: Love is War -Ultra Romantic-",
  "Oregairu", "My Teen Romantic Comedy SNAFU Too!", "My Teen Romantic Comedy SNAFU Climax!",
  "Rent-A-Girlfriend", "Horimiya", "Bloom Into You", "Fruits Basket", "Fruits Basket (2019)",
  "Monster", "Berserk", "Berserk (2016)", "Berserk: The Golden Age Arc",
  "Dororo", "Samurai Champloo", "Inuyasha", "Inuyasha: The Final Act", "Yashahime",
  "Hellsing", "Hellsing Ultimate", "Black Lagoon", "Black Lagoon: Roberta's Blood Trail",
  "Erased", "Terror in Resonance", "Texhnolyze", "Serial Experiments Lain", "Akira",
  "Paprika", "Perfect Blue", "Paranoia Agent", "Nana", "Beck: Mongolian Chop Squad",
  "Great Teacher Onizuka", "Golden Kamuy", "Golden Kamuy 2nd Season",
  "91 Days", "Gangsta.", "Banana Fish", "Dorohedoro", "Devilman Crybaby",
  "Kaiji", "Akagi", "One Outs", "Hajime no Ippo", "Hajime no Ippo: New Challenger",
  "Ashita no Joe", "Megalo Box", "Megalo Box 2: Nomad",
  "Initial D", "Initial D: Second Stage", "Initial D: Fourth Stage",
  "JoJo: Phantom Blood", "JoJo: Battle Tendency",
  "FLCL", "FLCL Progressive", "FLCL Alternative",
  "Nisekoi", "The Quintessential Quintuplets", "The Quintessential Quintuplets ∬",
  "K-On!", "K-On!!", "Angel Beats!", "Charlotte", "Little Busters!",
  "Hyouka", "A Certain Scientific Railgun", "A Certain Magical Index",
  "Toaru Kagaku no Railgun S", "Toaru Kagaku no Railgun T",
  "Food Wars!", "Food Wars! The Second Plate", "Food Wars! The Third Plate",
  "Food Wars! The Fourth Plate", "Food Wars! The Fifth Plate",
  "The Melancholy of Haruhi Suzumiya", "The Disappearance of Haruhi Suzumiya",
  "Nichijou", "Daily Lives of High School Boys", "Grand Blue",
  "Kino's Journey", "Made in Abyss: Dawn of the Deep Soul",
  "March Comes in Like a Lion", "March Comes in Like a Lion 2nd Season",
  "Barakamon", "Hyouge Mono", "Space Brothers",
  "The Girl Who Leapt Through Time", "Summer Wars", "Wolf Children",
  "Weathering With You", "5 Centimeters per Second", "Belle",
  "Your Name. Another Side: Earthbound",
  "Gurren Lagann", "Kill la Kill", "Promare", "Darling in the Franxx",
  "Eureka Seven", "Eureka Seven AO", "Gundam 00", "Gundam SEED", "Gundam Iron-Blooded Orphans",
  "Gundam Unicorn", "The Witch from Mercury",
  "Log Horizon", "Log Horizon 2nd Season", "Log Horizon: Destruction of the Round Table",
  "KonoSuba: An Explosion on This Wonderful World!",
  "Grimgar of Fantasy and Ash", "Is It Wrong to Try to Pick Up Girls in a Dungeon?",
  "DanMachi II", "DanMachi III", "DanMachi IV",
  "Re:Creators", "Aldnoah.Zero", "Gargantia on the Verdurous Planet",
  "Yona of the Dawn", "Snow White with the Red Hair",
  "The Garden of Sinners", "Kara no Kyoukai: The Garden of Sinners",
  "Rurouni Kenshin", "Rurouni Kenshin: Trust & Betrayal",
  "Bungo Stray Dogs 2nd Season", "Bungo Stray Dogs 3rd Season",
  "Black Butler", "Black Butler II", "Black Butler: Book of Circus",
  "Kabaneri of the Iron Fortress", "Takt Op. Destiny",
  "The Case Study of Vanitas", "Seraph of the End",
  "86 Eighty-Six", "A Place Further Than the Universe",
  "Land of the Lustrous", "Made in Abyss: The Golden City of the Scorching Sun",
  "Moriarty the Patriot", "Call of the Night", "Link Click",
  "The World God Only Knows", "Kami nomi zo Shiru Sekai II",
  "Ano Natsu de Matteru", "Tamako Market", "Tamako Love Story",
  "Shirobako", "Bakuman.", "Bakuman. 2nd Season", "Bakuman. 3rd Season",
  "Chihayafuru", "Chihayafuru 2", "Chihayafuru 3",
  "Ping Pong the Animation", "Run with the Wind",
  "Sk8 the Infinity", "Air Gear",
  "Hells Paradise", "Oshi no Ko", "Zom 100: Bucket List of the Dead",
  "Hell's Paradise: Jigokuraku", "Bocchi the Rock!",
  "SPY x FAMILY Season 2", "Dandadan", "Kaiju No. 8",
  "The Eminence in Shadow", "Chainsaw Man Season 2",
  "Blue Period", "Drifting Dragons", "BNA: Brand New Animal",
  "Id:Invaded", "Vinland Saga Season 2",
  "To Your Eternity", "To Your Eternity Season 2",
  "Ranking of Kings", "Ranking of Kings: The Treasure Chest of Courage",
  "The Great Pretender", "Odd Taxi", "Akudama Drive",
  "Hanebado!", "RE-MAIN",
  "BNA", "Carole & Tuesday", "The Millionaire Detective Balance: Unlimited",
  "Kakegurui", "Kakegurui xx", "Komi Can't Communicate",
  "Chainsaw Man Movie", "Jujutsu Kaisen 0",
  "Demon Slayer: Mugen Train", "Demon Slayer: Swordsmith Village",
  "Attack on Titan Final Season", "Attack on Titan Final Chapters",
  "One Piece Film: Red", "One Piece Stampede",
  "My Hero Academia: Two Heroes", "My Hero Academia: Heroes Rising",
  "My Hero Academia: World Heroes' Mission",
  "Sailor Moon", "Sailor Moon Crystal", "Cardcaptor Sakura",
  "Cardcaptor Sakura: Clear Card", "Madoka Magica",
  "Madoka Magica Rebellion", "Puella Magi Madoka Magica Side Story",
  "Natsume's Book of Friends", "Mushishi", "Mushishi Zoku Shou",
  "Spice and Wolf", "Spice and Wolf: MERCHANT MEETS THE WISE WOLF",
  "Aria the Animation", "Aria the Natural", "Aria the Origination",
  "Monogatari Series: Bakemonogatari", "Nisemonogatari", "Monogatari Series Second Season",
  "Owarimonogatari", "Kizumonogatari I", "Kizumonogatari II", "Kizumonogatari III",
  "Tsukimonogatari", "Hanamonogatari",
  "The Tatami Galaxy", "Tatami Time Machine Blues",
  "Kuzu no Honkai", "Scum's Wish",
  "Ergo Proxy", "Boogiepop Phantom",
  "Tekkonkinkreet", "Redline",
  "Sound! Euphonium", "Liz and the Blue Bird",
  "Vivy: Fluorite Eye's Song", "Wonder Egg Priority",
  "Symphogear", "Symphogear G", "Symphogear GX",
  "Sora no Woto", "Hibike! Euphonium 3",
  "The Dangers in My Heart", "Insomniacs After School",
  "My Dress-Up Darling", "More than a Married Couple, But Not Lovers",
  "The Angel Next Door Spoils Me Rotten",
  "The Apothecary Diaries", "Frieren: Beyond Journey's End",
  "Solo Leveling",
  // Add more as needed to maintain ~300 size
];

// Additional classics and older well-known titles to broaden coverage
const CLASSIC_ANIME_TITLES: string[] = [
  "Legend of the Galactic Heroes", "Legend of the Galactic Heroes: Die Neue These",
  "Ashita no Joe 2", "Aim for the Ace!", "Rose of Versailles", "Urusei Yatsura",
  "Ranma 1/2", "Maison Ikkoku", "City Hunter", "City Hunter 2", "City Hunter '91",
  "Fist of the North Star", "New Fist of the North Star", "Saint Seiya",
  "Saint Seiya: The Lost Canvas", "Saint Seiya: Knights of the Zodiac",
  "Yu Yu Hakusho", "Yu Yu Hakusho: Poltergeist Report",
  "Lupin the Third Part I", "Lupin the Third Part II", "Lupin the Third Part III",
  "Lupin the Third: The Woman Called Fujiko Mine",
  "Detective Conan", "Case Closed", "Magic Kaito 1412",
  "Doraemon", "Crayon Shin-chan", "Sazae-san", "GeGeGe no Kitaro",
  "Astro Boy", "Kimba the White Lion", "Captain Tsubasa", "Captain Tsubasa J",
  "Slam Dunk Movie", "Touch", "Touch 2: The Reason of the First Love",
  "Record of Lodoss War", "Record of Lodoss War: Chronicles of the Heroic Knight",
  "Vampire Hunter D", "Vampire Hunter D: Bloodlust", "Ninja Scroll",
  "X/1999", "RG Veda", "Tsubasa Chronicle", "xxxHOLiC",
  "Outlaw Star", "The Vision of Escaflowne", "RahXephon", "Big O",
  "Bubblegum Crisis", "Bubblegum Crash", "Armitage III",
  "Patlabor: The TV Series", "Patlabor 2: The Movie", "Ghost in the Shell",
  "Ghost in the Shell: Stand Alone Complex", "Ghost in the Shell: 2nd GIG",
  "Mobile Suit Gundam", "Mobile Suit Zeta Gundam", "Mobile Suit Gundam ZZ",
  "Mobile Suit Gundam: The 08th MS Team", "Mobile Suit Gundam 0083: Stardust Memory",
  "Mobile Suit Gundam: Char's Counterattack", "Turn A Gundam",
  "Macross", "Macross Plus", "Macross Frontier", "Robotech",
  "Space Battleship Yamato", "Star Blazers", "Galaxy Express 999",
  "Space Adventure Cobra", "Nausicaä of the Valley of the Wind",
  "My Neighbor Totoro", "Kiki's Delivery Service", "Whisper of the Heart",
  "Only Yesterday", "Porco Rosso", "When Marnie Was There",
  "Perfect Blue", "Millennium Actress",
  "The Wings of Honneamise", "Royal Space Force: The Wings of Honneamise",
  "Texhnolyze (Classic)", "Serial Experiments Lain (Classic)",
  "Mobile Police Patlabor", "Akira (1988)", "Nadia: The Secret of Blue Water",
  "Starship Operators", "Planetes", "Banner of the Stars", "Crest of the Stars",
  "Twelve Kingdoms", "Twelve Kingdoms (2002)", "Now and Then, Here and There",
  "Kimagure Orange Road", "Saber Marionette J", "El-Hazard: The Magnificent World",
  "Tenchi Muyo!", "Tenchi Universe", "Tenchi in Tokyo",
  "Hyouka (Classic Era)", "Karakuri Circus", "Bastard!!",
  "Devil Lady", "Devilman: The Birth", "Devilman: Demon Bird",
  "Vampire Princess Miyu", "Vampire Princess Miyu TV",
  "Kino's Journey (2003)", "Haibane Renmei",
  "Wolf's Rain", "Scrapped Princess", "Read or Die",
  "Paranoia Agent (Classic)", "Black Jack", "Black Jack 21",
  "Gankutsuou: The Count of Monte Cristo", "Le Chevalier D'Eon",
  "Simoun", "Boogiepop and Others", "Boogiepop and Others (2019)",
  "Gungrave", "Heat Guy J", "Noir", "Madlax", "El Cazador de la Bruja",
  "Kaleido Star", "Princess Tutu", "Aria the Avvenire",
  "Kara no Kyoukai 1", "Kara no Kyoukai 2", "Kara no Kyoukai 3", "Kara no Kyoukai 4",
  "Kara no Kyoukai 5", "Kara no Kyoukai 6", "Kara no Kyoukai 7",
  "Genshiken", "Genshiken 2", "Genshiken Nidaime",
  "Baccano!", "Durarara!!",
  "Spice and Wolf II", "Spice and Wolf (2009)",
  "Clannad Movie", "Air", "Kanon (2006)",
  "Ef: A Tale of Memories", "Ef: A Tale of Melodies",
  "School Rumble", "School Rumble Ni Gakki",
  "Great Teacher Onizuka (1999)", "Sgt. Frog", "Keroro Gunsou",
  "Ghost Stories", "Azumanga Daioh", "Lucky Star",
  "Higurashi When They Cry", "Higurashi Kai", "Higurashi Rei",
  "Umineko no Naku Koro ni",
  "Katanagatari", "Mononoke (2007)", "House of Five Leaves",
  "Natsume's Book of Friends Season 2", "Natsume's Book of Friends Season 3",
  "Mushishi: The Next Passage", "Dennou Coil",
  "Mawaru Penguindrum", "Revolutionary Girl Utena",
  "Angel Densetsu", "Berserk (1997)", "Berserk: The Golden Age Arc II",
  "Berserk: The Golden Age Arc III"
];

router.get("/search", async (req, res) => {
  const parsed = SearchQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_FAILED", message: "Invalid query" } });
  }
  const { q, fetchLive } = parsed.data;
  const normalized = normalizeTitle(q);

  // Mongo-first fuzzy lookup
  const exact = await AnimeModel.findOne({ normalizedTitle: normalized }).lean();
  if (exact) {
    const dto = { ...exact, lastCrawledAt: exact.lastCrawledAt.toISOString() } as any;
    return res.json({ ...dto, source: "db" });
  }
  const prefixHit = await AnimeModel.findOne({ normalizedTitle: { $regex: `^${normalized}` } }).lean();
  if (prefixHit) {
    const dto = { ...prefixHit, lastCrawledAt: prefixHit.lastCrawledAt.toISOString() } as any;
    return res.json({ ...dto, source: "db" });
  }
  const aliasHit = await AnimeModel.findOne({ altTitles: { $elemMatch: { $regex: new RegExp(normalized.split(" ").join(".*"), "i") } } }).lean();
  if (aliasHit) {
    const dto = { ...aliasHit, lastCrawledAt: aliasHit.lastCrawledAt.toISOString() } as any;
    return res.json({ ...dto, source: "db" });
  }

  // Crawl from live search (force fetchLive=true to avoid static fixtures)
  try {
    const searchHtml = await loadSearchHtml(q, true); // Always use live fetch for searches
    const { topTitle, topHref } = parseSearch(searchHtml);
    if (!topTitle || !topHref) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "No results in search" } });
    }
    const detailHtml = await loadDetailHtml(topHref, true); // Always use live fetch for details
    const partial = parseDetail(detailHtml);
    const { slug, sourceUrl } = deriveSlugAndSourceUrl(topTitle, topHref);

    const now = new Date();
    const doc = await AnimeModel.findOneAndUpdate(
      { slug },
      {
        $set: {
          slug,
          canonicalTitle: partial.canonicalTitle || topTitle,
          altTitles: Array.from(new Set([...(partial.altTitles || []), topTitle])).filter(Boolean),
          normalizedTitle: normalizeTitle(partial.canonicalTitle || topTitle),
          description: partial.description || "",
          imageUrl: partial.imageUrl || undefined,
          yearStart: partial.yearStart ?? undefined,
          yearEnd: partial.yearEnd ?? undefined,
          genres: partial.genres || [],
          cast: partial.cast || [],
          producers: partial.producers || [],
          episodes: partial.episodes || [],
          sourceUrl,
          lastCrawledAt: now,
        },
      },
      { upsert: true, new: true }
    ).lean();

    const dto = {
      slug: doc.slug,
      canonicalTitle: doc.canonicalTitle,
      altTitles: doc.altTitles,
      description: doc.description,
      imageUrl: doc.imageUrl ?? null,
      yearStart: doc.yearStart ?? null,
      yearEnd: doc.yearEnd ?? null,
      genres: doc.genres,
      cast: doc.cast,
      producers: doc.producers,
      episodes: doc.episodes,
      sourceUrl: doc.sourceUrl,
      lastCrawledAt: doc.lastCrawledAt.toISOString(),
    };

    const validated = AnimeSchema.parse(dto);
    return res.json({ ...validated, source: "live" });
  } catch (err: any) {
    return res.status(500).json({ error: { code: "CRAWL_FAILED", message: err?.message || "Crawl failed" } });
  }
});

// Search suggestions endpoint for autocomplete
router.get("/search/suggestions", async (req, res) => {
  const parsed = SuggestionsQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_FAILED", message: "Invalid query" } });
  }
  
  const { q } = parsed.data;
  const normalized = normalizeTitle(q);
  
  try {
    // Search for anime that match the query (case-insensitive, partial matches)
    const suggestions = await AnimeModel.find({
      $or: [
        { canonicalTitle: { $regex: q, $options: 'i' } },
        { normalizedTitle: { $regex: normalized, $options: 'i' } },
        { altTitles: { $elemMatch: { $regex: q, $options: 'i' } } }
      ]
    })
    .select('slug canonicalTitle imageUrl')
    .limit(8)
    .lean();
    
    const result = suggestions.map(anime => ({
      slug: anime.slug,
      canonicalTitle: anime.canonicalTitle,
      imageUrl: anime.imageUrl || undefined
    }));
    
    return res.json({ suggestions: result });
  } catch (err: any) {
    console.error('Suggestions error:', err);
    return res.status(500).json({ error: { code: "FETCH_FAILED", message: err?.message || "Failed to fetch suggestions" } });
  }
});

router.get("/anime/:slug", async (req, res) => {
  const slug = String(req.params.slug);

  try {
    // First try to find by slug
    let doc = await AnimeModel.findOne({ slug }).lean();

    // If not found by slug, try by _id (for numeric IDs)
    if (!doc && /^[0-9a-fA-F]{24}$/.test(slug)) {
      doc = await AnimeModel.findById(slug).lean();
    }

    // If still not found, try to find by canonical title (for fallback cases)
    if (!doc) {
      doc = await AnimeModel.findOne({
        canonicalTitle: { $regex: new RegExp(slug.replace(/-/g, ' '), 'i') }
      }).lean();
    }

    // If still not found, try live crawl (similar to search)
    if (!doc) {
      try {
        // Convert slug back to a searchable title
        const searchQuery = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const searchHtml = await loadSearchHtml(searchQuery, true);
        const { topTitle, topHref } = parseSearch(searchHtml);

        if (topTitle && topHref) {
          const detailHtml = await loadDetailHtml(topHref, true);
          const partial = parseDetail(detailHtml);
          const { slug: newSlug, sourceUrl } = deriveSlugAndSourceUrl(topTitle, topHref);

          const now = new Date();
          doc = await AnimeModel.findOneAndUpdate(
            { slug: newSlug },
            {
              $set: {
                slug: newSlug,
                canonicalTitle: partial.canonicalTitle || topTitle,
                altTitles: Array.from(new Set([...(partial.altTitles || []), topTitle])).filter(Boolean),
                normalizedTitle: normalizeTitle(partial.canonicalTitle || topTitle),
                description: partial.description || "",
                imageUrl: partial.imageUrl || undefined,
                yearStart: partial.yearStart ?? undefined,
                yearEnd: partial.yearEnd ?? undefined,
                genres: partial.genres || [],
                cast: partial.cast || [],
                producers: partial.producers || [],
                episodes: partial.episodes || [],
                sourceUrl,
                lastCrawledAt: now,
              },
            },
            { upsert: true, new: true }
          ).lean();
        }
      } catch (crawlErr) {
        console.error(`Failed to crawl anime for slug ${slug}:`, crawlErr);
      }
    }

    if (!doc) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Anime not found" } });
    }

    const dto = {
      slug: doc.slug,
      canonicalTitle: doc.canonicalTitle,
      altTitles: doc.altTitles,
      description: doc.description,
      imageUrl: doc.imageUrl ?? null,
      yearStart: doc.yearStart ?? null,
      yearEnd: doc.yearEnd ?? null,
      genres: doc.genres,
      cast: doc.cast,
      producers: doc.producers,
      episodes: doc.episodes,
      sourceUrl: doc.sourceUrl,
      lastCrawledAt: doc.lastCrawledAt.toISOString(),
    };
    return res.json(dto);
  } catch (err: any) {
    console.error(`Error fetching anime ${slug}:`, err);
    return res.status(500).json({ error: { code: "FETCH_FAILED", message: err?.message || "Failed to fetch anime" } });
  }
});

// Paginated anime listing for browse/infinite scroll
router.get("/anime", async (req, res) => {
  try {
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 40));

    const docs = await AnimeModel.find({ imageUrl: { $exists: true, $nin: [null, ""] } })
      .sort({ lastCrawledAt: -1 })
      .skip(skip)
      .limit(limit)
      .select({ slug: 1, canonicalTitle: 1, imageUrl: 1 })
      .lean();

    const items = docs.map(doc => ({
      id: doc.slug,
      slug: doc.slug,
      title: doc.canonicalTitle,
      img: doc.imageUrl || ""
    }));

    return res.json({ items, nextSkip: skip + items.length, hasMore: items.length === limit });
  } catch (err: any) {
    console.error('Anime list error:', err);
    return res.status(500).json({ error: { code: "FETCH_FAILED", message: err?.message || "Failed to list anime" } });
  }
});

router.post("/reindex", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not available" } });
  }
  // Simplified: accept body { slugs: string[] } and set lastCrawledAt now
  const body = (req.body as any) || {};
  const slugs: string[] = Array.isArray(body.slugs) ? body.slugs : [];
  await AnimeModel.updateMany({ slug: { $in: slugs } }, { $set: { lastCrawledAt: new Date() } });
  return res.json({ ok: true, count: slugs.length });
});

router.get("/recommendations", async (req, res) => {
  try {
    // First try to get recommendations from database
    const recommendations = await AnimeModel.aggregate([
      { $match: { imageUrl: { $exists: true, $nin: [null, ""] } } },
      { $sample: { size: 6 } },
      {
        $project: {
          slug: 1,
          canonicalTitle: 1,
          imageUrl: 1,
          _id: 1
        }
      }
    ]);

    // If we have enough recommendations from DB, return them
    if (recommendations.length >= 6) {
      const dto = recommendations.map(anime => ({
        id: anime._id.toString(),
        slug: anime.slug,
        title: anime.canonicalTitle,
        img: anime.imageUrl
      }));
      return res.json(dto);
    }

    // If we don't have enough data in DB, crawl some popular anime
    const popularAnimeQueries = [
      "Attack on Titan",
      "One Piece",
      "Naruto",
      "Dragon Ball",
      "Demon Slayer",
      "My Hero Academia",
      "Death Note",
      "Fullmetal Alchemist"
    ];

    const crawledData = [];
    const needed = 6 - recommendations.length;

    for (let i = 0; i < Math.min(needed, popularAnimeQueries.length); i++) {
      try {
        const query = popularAnimeQueries[i];
        const normalized = normalizeTitle(query);

        // Check if we already have this one
        const existing = await AnimeModel.findOne({ normalizedTitle: normalized }).lean();
        if (existing) {
          crawledData.push({
            id: existing._id.toString(),
            slug: existing.slug,
            title: existing.canonicalTitle,
            img: existing.imageUrl || ""
          });
          continue;
        }

        // Crawl it live
        const searchHtml = await loadSearchHtml(query, true);
        const { topTitle, topHref } = parseSearch(searchHtml);

        if (topTitle && topHref) {
          const detailHtml = await loadDetailHtml(topHref, true);
          const partial = parseDetail(detailHtml);
          const { slug, sourceUrl } = deriveSlugAndSourceUrl(topTitle, topHref);

          const now = new Date();
          const doc = await AnimeModel.findOneAndUpdate(
            { slug },
            {
              $set: {
                slug,
                canonicalTitle: partial.canonicalTitle || topTitle,
                altTitles: Array.from(new Set([...(partial.altTitles || []), topTitle])).filter(Boolean),
                normalizedTitle: normalizeTitle(partial.canonicalTitle || topTitle),
                description: partial.description || "",
                imageUrl: partial.imageUrl || undefined,
                yearStart: partial.yearStart ?? undefined,
                yearEnd: partial.yearEnd ?? undefined,
                genres: partial.genres || [],
                cast: partial.cast || [],
                producers: partial.producers || [],
                episodes: partial.episodes || [],
                sourceUrl,
                lastCrawledAt: now,
              },
            },
            { upsert: true, new: true }
          ).lean();

          crawledData.push({
            id: doc._id.toString(),
            slug: doc.slug,
            title: doc.canonicalTitle,
            img: doc.imageUrl || ""
          });
        }
      } catch (err) {
        console.error(`Failed to crawl ${popularAnimeQueries[i]}:`, err);
        // Continue with next anime
      }
    }

    // Combine DB recommendations with newly crawled data
    const dbDto = recommendations.map(anime => ({
      id: anime._id.toString(),
      slug: anime.slug,
      title: anime.canonicalTitle,
      img: anime.imageUrl
    }));

    const combined = [...dbDto, ...crawledData].slice(0, 6);
    return res.json(combined);

  } catch (err: any) {
    console.error('Recommendations error:', err);
    return res.status(500).json({ error: { code: "FETCH_FAILED", message: err?.message || "Failed to fetch recommendations" } });
  }
});

// Seed ~100 popular anime by live crawling (idempotent upsert)
router.post("/seed/popular", async (req, res) => {
  // Optional body { limit?: number, titles?: string[], random?: boolean }
  const body = (req.body as any) || {};
  // Allow large batches; still clamp to a reasonable upper bound
  const limit = Math.max(1, Math.min(1000, Number(body.limit) || 100));
  const randomize = Boolean(body.random ?? true);
  const combined = (Array.isArray(body.titles) && body.titles.length > 0
    ? body.titles
    : [...POPULAR_ANIME_TITLES, ...CLASSIC_ANIME_TITLES]) as string[];

  // De-duplicate while preserving order
  const uniqueCombined = Array.from(new Set(combined.map(t => String(t))));
  const pool = randomize
    ? uniqueCombined.sort(() => Math.random() - 0.5)
    : uniqueCombined;
  const picked = pool.slice(0, limit);

  // Simple concurrency limiter
  const CONCURRENCY = 4;
  const queue = picked.slice();
  let seeded = 0;
  const errors: { title: string; message: string }[] = [];

  async function worker() {
    while (queue.length) {
      const title = queue.shift() as string;
      try {
        const normalized = normalizeTitle(title);
        // Skip if we already have a fresh entry (optional optimization)
        const existing = await AnimeModel.findOne({ normalizedTitle: normalized }).lean();
        if (existing) {
          seeded++;
          continue;
        }

        const searchHtml = await loadSearchHtml(title, true);
        const { topTitle, topHref } = parseSearch(searchHtml);
        if (!topTitle || !topHref) {
          errors.push({ title, message: "No results in search" });
          continue;
        }

        const detailHtml = await loadDetailHtml(topHref, true);
        const partial = parseDetail(detailHtml);
        const { slug, sourceUrl } = deriveSlugAndSourceUrl(topTitle, topHref);

        const now = new Date();
        await AnimeModel.findOneAndUpdate(
          { slug },
          {
            $set: {
              slug,
              canonicalTitle: partial.canonicalTitle || topTitle,
              altTitles: Array.from(new Set([...(partial.altTitles || []), topTitle])).filter(Boolean),
              normalizedTitle: normalizeTitle(partial.canonicalTitle || topTitle),
              description: partial.description || "",
              imageUrl: partial.imageUrl || undefined,
              yearStart: partial.yearStart ?? undefined,
              yearEnd: partial.yearEnd ?? undefined,
              genres: partial.genres || [],
              cast: partial.cast || [],
              producers: partial.producers || [],
              episodes: partial.episodes || [],
              sourceUrl,
              lastCrawledAt: now,
            },
          },
          { upsert: true, new: true }
        ).lean();
        seeded++;
      } catch (err: any) {
        errors.push({ title, message: err?.message || "Unknown error" });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return res.json({ ok: true, requested: picked.length, seeded, errorsCount: errors.length, errors });
});

// Mount auth routes
router.use("/auth", authRouter);

export default router;

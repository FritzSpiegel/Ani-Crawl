const { MongoClient } = require('mongodb');
const axios = require('axios');
const cheerio = require('cheerio');

// Popular anime list - 100+ well-known anime
const POPULAR_ANIME = [
    // Classic & Popular
    "Attack on Titan", "One Piece", "Naruto", "Dragon Ball", "Demon Slayer",
    "My Hero Academia", "Death Note", "Fullmetal Alchemist", "Bleach", "Hunter x Hunter",
    "Tokyo Ghoul", "Sword Art Online", "Fairy Tail", "Black Clover", "Jujutsu Kaisen",
    "Chainsaw Man", "Spy x Family", "Mob Psycho 100", "One Punch Man", "Re:Zero",
    "Konosuba", "Overlord", "The Rising of the Shield Hero", "That Time I Got Reincarnated as a Slime",
    "Dr. Stone", "Fire Force", "The Promised Neverland", "Vinland Saga", "Beastars",
    
    // Studio Ghibli & Movies
    "Your Name", "Spirited Away", "Princess Mononoke", "Howl's Moving Castle", "Grave of the Fireflies",
    "My Neighbor Totoro", "Kiki's Delivery Service", "Castle in the Sky", "Nausicaä of the Valley of the Wind",
    "The Tale of Princess Kaguya", "The Wind Rises", "Ponyo", "Arrietty", "From Up on Poppy Hill",
    
    // Modern Popular
    "A Silent Voice", "Weathering with You", "The Garden of Words", "5 Centimeters per Second",
    "Erased", "Steins;Gate", "Clannad", "Anohana", "Your Lie in April", "Violet Evergarden",
    "Made in Abyss", "The Ancient Magus' Bride", "The Devil is a Part-Timer", "No Game No Life",
    "Log Horizon", "Sword Art Online", "Accel World", "Guilty Crown", "Psycho-Pass",
    
    // Action & Shounen
    "Berserk", "Hellsing", "Trigun", "Cowboy Bebop", "Samurai Champloo",
    "Afro Samurai", "Black Lagoon", "Jormungand", "Gangsta", "91 Days",
    "Banana Fish", "Dorohedoro", "Golden Kamuy", "Megalobox", "Terror in Resonance",
    
    // Romance & Slice of Life
    "Toradora", "Clannad", "Kanon", "Air", "Little Busters", "Angel Beats",
    "The Pet Girl of Sakurasou", "Oregairu", "Bunny Girl Senpai", "Kaguya-sama: Love is War",
    "Horimiya", "Wotakoi", "My Dress-Up Darling", "Komi Can't Communicate", "Spy x Family",
    
    // Isekai & Fantasy
    "Mushoku Tensei", "The Eminence in Shadow", "Skeleton Knight in Another World",
    "How a Realist Hero Rebuilt the Kingdom", "The World's Finest Assassin Gets Reincarnated",
    "The Faraway Paladin", "The Strongest Sage with the Weakest Crest", "Trapped in a Dating Sim",
    "The Greatest Demon Lord is Reborn as a Typical Nobody", "The Executioner and Her Way of Life",
    
    // Sports & Competition
    "Haikyuu", "Kuroko's Basketball", "Slam Dunk", "Eyeshield 21", "Prince of Tennis",
    "Yowamushi Pedal", "Free", "Run with the Wind", "Chihayafuru", "Hikaru no Go",
    
    // Psychological & Thriller
    "Monster", "Death Parade", "Parasyte", "Another", "Future Diary",
    "Elfen Lied", "Higurashi", "Shiki", "Perfect Blue", "Paprika",
    
    // Comedy & Parody
    "Gintama", "Nichijou", "Lucky Star", "Azumanga Daioh", "Daily Lives of High School Boys",
    "The Disastrous Life of Saiki K", "Asobi Asobase", "Grand Blue", "Kaguya-sama: Love is War",
    
    // Sci-Fi & Mecha
    "Neon Genesis Evangelion", "Code Geass", "Gurren Lagann", "Mobile Suit Gundam",
    "Ghost in the Shell", "Akira", "Cowboy Bebop", "Trigun", "Outlaw Star",
    
    // Horror & Supernatural
    "Another", "Higurashi", "Shiki", "Corpse Party", "School-Live",
    "The Promised Neverland", "Made in Abyss", "Dorohedoro", "Jujutsu Kaisen",
    
    // Music & Idol
    "K-On", "Love Live", "Idolmaster", "Your Lie in April", "Beck",
    "Nana", "Carole & Tuesday", "Given", "BanG Dream", "Zombie Land Saga"
];

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aniworld';
const DB_NAME = 'aniworld';
const COLLECTION_NAME = 'animes';

// AniWorld search URL
const ANIWORLD_SEARCH_URL = 'https://aniworld.to/anime/search';

async function searchAnimeOnAniWorld(query) {
    try {
        console.log(`Searching for: ${query}`);
        
        const response = await axios.get(ANIWORLD_SEARCH_URL, {
            params: { q: query },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const results = [];
        
        $('.searchList .searchListBox').each((i, element) => {
            if (i >= 1) return false; // Only take the first result
            
            const $el = $(element);
            const title = $el.find('.searchListBoxContent .searchListBoxContentHeadline a').text().trim();
            const href = $el.find('.searchListBoxContent .searchListBoxContentHeadline a').attr('href');
            const image = $el.find('.searchListBoxContent .searchListBoxContentPoster img').attr('src');
            
            if (title && href) {
                results.push({
                    title,
                    href: href.startsWith('http') ? href : `https://aniworld.to${href}`,
                    image: image ? (image.startsWith('http') ? image : `https://aniworld.to${image}`) : null
                });
            }
        });
        
        return results[0] || null;
    } catch (error) {
        console.error(`Error searching for ${query}:`, error.message);
        return null;
    }
}

async function getAnimeDetails(detailUrl) {
    try {
        console.log(`Getting details from: ${detailUrl}`);
        
        const response = await axios.get(detailUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract details
        const canonicalTitle = $('.seriesTitleBox .seriesTitle').text().trim();
        const description = $('.seri_des').text().trim();
        const imageUrl = $('.seriesCoverBox .seriesCover img').attr('src');
        
        // Extract year
        const yearMatch = $('.seriesDetails .seriesDetailsBox').text().match(/(\d{4})/);
        const yearStart = yearMatch ? parseInt(yearMatch[1]) : null;
        
        // Extract genres
        const genres = [];
        $('.seriesDetails .seriesDetailsBox a[href*="/genre/"]').each((i, el) => {
            const genre = $(el).text().trim();
            if (genre) genres.push(genre);
        });
        
        // Extract alternative titles
        const altTitles = [];
        $('.seriesDetails .seriesDetailsBox').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Alternative Titel:')) {
                const altText = text.split('Alternative Titel:')[1]?.split('\n')[0]?.trim();
                if (altText) {
                    altTitles.push(...altText.split(',').map(t => t.trim()).filter(t => t));
                }
            }
        });
        
        // Create slug from title
        const slug = canonicalTitle
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        
        return {
            slug,
            canonicalTitle,
            altTitles: [...new Set(altTitles)],
            description: description || '',
            imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `https://aniworld.to${imageUrl}`) : null,
            yearStart,
            yearEnd: null,
            genres,
            cast: [],
            producers: [],
            episodes: [],
            sourceUrl: detailUrl,
            lastCrawledAt: new Date()
        };
    } catch (error) {
        console.error(`Error getting details from ${detailUrl}:`, error.message);
        return null;
    }
}

async function seedDatabase() {
    const client = new MongoClient(MONGO_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);
        
        let successCount = 0;
        let skipCount = 0;
        
        for (const animeTitle of POPULAR_ANIME) {
            try {
                // Check if already exists
                const existing = await collection.findOne({ 
                    $or: [
                        { canonicalTitle: { $regex: new RegExp(animeTitle, 'i') } },
                        { altTitles: { $elemMatch: { $regex: new RegExp(animeTitle, 'i') } } }
                    ]
                });
                
                if (existing) {
                    console.log(`⏭️  Skipping ${animeTitle} (already exists)`);
                    skipCount++;
                    continue;
                }
                
                // Search for anime
                const searchResult = await searchAnimeOnAniWorld(animeTitle);
                if (!searchResult) {
                    console.log(`❌ No search result for: ${animeTitle}`);
                    continue;
                }
                
                // Get detailed information
                const details = await getAnimeDetails(searchResult.href);
                if (!details) {
                    console.log(`❌ No details for: ${animeTitle}`);
                    continue;
                }
                
                // Insert into database
                await collection.insertOne(details);
                console.log(`✅ Added: ${details.canonicalTitle}`);
                successCount++;
                
                // Add delay to be respectful to the server
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Error processing ${animeTitle}:`, error.message);
            }
        }
        
        console.log(`\n🎉 Seeding complete!`);
        console.log(`✅ Successfully added: ${successCount} anime`);
        console.log(`⏭️  Skipped (already exists): ${skipCount} anime`);
        console.log(`❌ Failed: ${POPULAR_ANIME.length - successCount - skipCount} anime`);
        
    } catch (error) {
        console.error('Database error:', error);
    } finally {
        await client.close();
    }
}

// Run the seeding
if (require.main === module) {
    seedDatabase().catch(console.error);
}

module.exports = { seedDatabase, POPULAR_ANIME };

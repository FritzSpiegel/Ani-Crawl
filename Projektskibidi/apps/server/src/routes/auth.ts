import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { customAlphabet } from "nanoid";
import nodemailer from "nodemailer";
import { User } from "../models/User";
import { WatchlistItem } from "../models/Watchlist";
import { AnimeModel } from "../models/Anime";
import { normalizeTitle } from "../utils/normalize";
import { loadSearchHtml, loadDetailHtml } from "../crawler/fetch";
import { parseSearch, parseDetail, deriveSlugAndSourceUrl } from "../crawler/parser";
import { env } from "../env";

const router = express.Router();
const nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

// Email transporter (placeholder - configure according to your needs)
const createTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587'),
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }
  return null;
};

// Middleware to verify JWT token
const authenticateToken = async (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as any;
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const passHash = await bcrypt.hash(password, 10);

    // Generate verification token
    const verifyToken = nanoid();
    const verifyExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Create user
    const user = new User({
      firstName,
      lastName,
      email,
      passHash,
      verifyToken,
      verifyExpires,
      verified: false
    });

    await user.save();

    // Send verification email (if transporter configured)
    const transporter = createTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || 'AniCrawl <no-reply@anicrawl.local>',
          to: email,
          subject: 'Email Verification',
          text: `Your verification code is: ${verifyToken}`
        });
      } catch (error) {
        console.error('Failed to send verification email:', error);
      }
    }

    res.json({
      message: 'User registered successfully',
      email,
      needsVerification: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.passHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if verified
    if (!user.verified) {
      return res.status(401).json({ message: 'Please verify your email first' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, env.jwtSecret, { expiresIn: '7d' });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin: user.isAdmin
      },
      admin: user.isAdmin
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Verify email code
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verified) {
      return res.status(400).json({ message: 'User already verified' });
    }

    if (!user.verifyToken || user.verifyToken !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (user.verifyExpires && Date.now() > user.verifyExpires) {
      return res.status(400).json({ message: 'Verification code expired' });
    }

    // Mark as verified
    user.verified = true;
    user.verifyToken = undefined;
    user.verifyExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Resend verification code
router.post('/resend', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verified) {
      return res.status(400).json({ message: 'User already verified' });
    }

    // Generate new verification token
    const verifyToken = nanoid();
    const verifyExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    user.verifyToken = verifyToken;
    user.verifyExpires = verifyExpires;
    await user.save();

    // Send verification email
    const transporter = createTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || 'AniCrawl <no-reply@anicrawl.local>',
          to: email,
          subject: 'Email Verification',
          text: `Your verification code is: ${verifyToken}`
        });
      } catch (error) {
        console.error('Failed to send verification email:', error);
      }
    }

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Check verification status
router.get('/status', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: email as string });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ verified: user.verified });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Watchlist routes
router.get('/watchlist', authenticateToken, async (req: any, res) => {
  try {
    const items = await WatchlistItem.find({ userId: req.user._id }).sort({ createdAt: -1 });

    // If user has watchlist items, return them
    if (items.length > 0) {
      res.json({ items });
      return;
    }

    // If watchlist is empty, auto-populate with popular anime via live crawler
    const popularAnimeQueries = [
      "Attack on Titan",
      "One Piece",
      "Naruto",
      "Demon Slayer"
    ];

    const autoAddedItems = [];

    for (const query of popularAnimeQueries) {
      try {
        const normalized = normalizeTitle(query);

        // Check if we already have this anime in the database
        let animeData = await AnimeModel.findOne({ normalizedTitle: normalized }).lean();

        if (!animeData) {
          // Crawl it live if not in database
          const searchHtml = await loadSearchHtml(query, true);
          const { topTitle, topHref } = parseSearch(searchHtml);

          if (topTitle && topHref) {
            const detailHtml = await loadDetailHtml(topHref, true);
            const partial = parseDetail(detailHtml);
            const { slug, sourceUrl } = deriveSlugAndSourceUrl(topTitle, topHref);

            const now = new Date();
            animeData = await AnimeModel.findOneAndUpdate(
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
          }
        }

        if (animeData) {
          // Add to user's watchlist
          const watchlistItem = new WatchlistItem({
            userId: req.user._id,
            itemId: animeData.slug,
            title: animeData.canonicalTitle,
            image: animeData.imageUrl
          });

          try {
            await watchlistItem.save();
            autoAddedItems.push({
              id: watchlistItem.itemId,
              title: watchlistItem.title,
              image: watchlistItem.image
            });
          } catch (err: any) {
            // Skip if already exists (unique constraint)
            if (!err.message?.includes('duplicate')) {
              console.error(`Failed to add ${query} to watchlist:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to crawl and add ${query}:`, err);
        // Continue with next anime
      }
    }

    res.json({ items: autoAddedItems });
  } catch (error) {
    console.error('Watchlist fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/watchlist/contains/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const item = await WatchlistItem.findOne({ userId: req.user._id, itemId: id });
    res.json({ exists: !!item });
  } catch (error) {
    console.error('Watchlist check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/watchlist/add', authenticateToken, async (req: any, res) => {
  try {
    const { id, title, image } = req.body;

    if (!id || !title) {
      return res.status(400).json({ message: 'ID and title are required' });
    }

    // Check if already exists
    const existing = await WatchlistItem.findOne({ userId: req.user._id, itemId: id });
    if (existing) {
      return res.status(400).json({ message: 'Item already in watchlist' });
    }

    const item = new WatchlistItem({
      userId: req.user._id,
      itemId: id,
      title,
      image
    });

    await item.save();
    res.json({ message: 'Item added to watchlist' });
  } catch (error) {
    console.error('Watchlist add error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/watchlist/remove/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    await WatchlistItem.deleteOne({ userId: req.user._id, itemId: id });
    res.json({ message: 'Item removed from watchlist' });
  } catch (error) {
    console.error('Watchlist remove error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin middleware
const requireAdmin = async (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as any;
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    if (user.isAdmin) {
      req.user = user;
      next();
    } else {
      return res.status(403).json({ message: 'Admin access required' });
    }
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Admin login removed - now using regular login with isAdmin flag

// Get all users (admin only)
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, {
      passHash: 0, // Exclude password hash
      verifyToken: 0 // Exclude verification token
    }).sort({ createdAt: -1 });

    res.json({
      users: users.map(user => ({
        id: user._id,
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        verified: user.verified,
        isAdmin: user.isAdmin || false,
        created_at: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/admin/users/:email', requireAdmin, async (req, res) => {
  try {
    const { email } = req.params;

    // Don't allow deleting the admin user
    if (email === env.adminEmail) {
      return res.status(400).json({ message: 'Cannot delete admin user' });
    }

    const result = await User.deleteOne({ email });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Also delete user's watchlist items
    await WatchlistItem.deleteMany({ userId: { $exists: true } });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user (admin only)
router.post('/admin/users/update', requireAdmin, async (req, res) => {
  try {
    const { id, firstName, lastName, email, verified, isAdmin } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Find the user by ID
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update the user fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (verified !== undefined) user.verified = verified;
    if (isAdmin !== undefined) user.isAdmin = isAdmin;

    await user.save();

    res.json({ 
      message: 'User updated successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        verified: user.verified,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Temporary route to seed test users (only for development)
router.post('/admin/seed-users', requireAdmin, async (req, res) => {
  try {
    const testUsers = [
      {
        firstName: 'Max',
        lastName: 'Mustermann',
        email: 'max@example.com',
        passHash: await bcrypt.hash('password123', 10),
        verified: true
      },
      {
        firstName: 'Anna',
        lastName: 'Schmidt',
        email: 'anna@example.com',
        passHash: await bcrypt.hash('password123', 10),
        verified: true
      },
      {
        firstName: 'Peter',
        lastName: 'Weber',
        email: 'peter@example.com',
        passHash: await bcrypt.hash('password123', 10),
        verified: false
      }
    ];

    // Check if users already exist
    const existingUsers = await User.find({
      email: { $in: testUsers.map(u => u.email) }
    });

    if (existingUsers.length === 0) {
      await User.insertMany(testUsers);
      res.json({
        message: 'Test users created successfully',
        count: testUsers.length
      });
    } else {
      res.json({
        message: 'Test users already exist',
        existing: existingUsers.length
      });
    }
  } catch (error) {
    console.error('Seed users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export { router as authRouter };
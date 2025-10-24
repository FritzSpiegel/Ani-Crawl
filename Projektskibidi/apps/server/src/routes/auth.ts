import express from "express";
import mongoose from "mongoose";
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
    const emailNorm = String(email || '').trim().toLowerCase();

    if (!emailNorm || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Require DB connection; if not connected, fail clearly
    const isDbConnected = mongoose.connection?.readyState === 1;
    if (!isDbConnected) {
      return res.status(503).json({ message: 'Service unavailable (database not connected)' });
    }

    // Find user
    // Case-insensitive exact email match
    const emailRegex = new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, 'i');
    const user = await User.findOne({ email: emailRegex });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isBcrypt = typeof user.passHash === 'string' && /^\$2[aby]\$/.test(user.passHash);
    let isValid = false;
    if (isBcrypt) {
      try {
        isValid = await bcrypt.compare(password, user.passHash);
      } catch (e) {
        // If stored hash is malformed, treat as invalid credentials (no 500)
        isValid = false;
      }
    } else {
      // Fallback for legacy plaintext passwords in DB (dev-safety)
      isValid = String(password) === String(user.passHash);
    }
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
      sameSite: 'lax',
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
    // Avoid leaking server errors to client; respond as invalid credentials
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Diagnostics (dev only): check email record + hash status
router.post('/diagnostics/login-check', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ message: 'Not found' });
    }
    const { email } = req.body || {};
    const emailNorm = String(email || '').trim().toLowerCase();
    if (!emailNorm) return res.status(400).json({ message: 'Email required' });

    const isDbConnected = mongoose.connection?.readyState === 1;
    const emailRegex = new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, 'i');
    const user = isDbConnected ? await User.findOne({ email: emailRegex }) : null;
    const info = user ? {
      id: String(user._id || ''),
      email: user.email,
      verified: !!user.verified,
      isAdmin: !!user.isAdmin,
      hashType: typeof user.passHash === 'string' && /^\$2[aby]\$/.test(user.passHash) ? 'bcrypt' : (typeof user.passHash === 'string' ? 'plaintext_or_other' : 'missing'),
      passHashSample: typeof user.passHash === 'string' ? user.passHash.slice(0, 7) + '...' : null
    } : null;
    return res.json({ dbConnected: isDbConnected, userFound: !!user, user: info });
  } catch (err) {
    console.error('Diagnostics error:', err);
    return res.status(500).json({ message: 'Diagnostics failed' });
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
    res.json({ items: items.map(item => ({
      id: item.itemId,
      title: item.title,
      image: item.image
    })) });
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

    // Use upsert to avoid duplicates
    const item = await WatchlistItem.findOneAndUpdate(
      { userId: req.user._id, itemId: id },
      { 
        userId: req.user._id,
        itemId: id,
        title,
        image,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

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

// Delete user account (user can only delete their own account)
router.delete('/delete-account', async (req, res) => {
  try {
    const { email, password, confirmation } = req.body;
    
    // Validate required fields
    if (!email || !password || !confirmation) {
      return res.status(400).json({
        message: 'Email, password, and confirmation are required'
      });
    }
    
    // Validate confirmation
    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        message: 'Confirmation must be exactly "DELETE"'
      });
    }
    
    const emailNorm = String(email).trim().toLowerCase();
    
    // Find user
    const emailRegex = new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, 'i');
    const user = await User.findOne({ email: emailRegex });
    
    if (!user) {
      return res.status(404).json({
        message: 'User account not found'
      });
    }
    
    // Verify password before deletion
    const isBcrypt = typeof user.passHash === 'string' && /^\$2[aby]\$/.test(user.passHash);
    let isValid = false;
    
    if (isBcrypt) {
      try {
        isValid = await bcrypt.compare(password, user.passHash);
      } catch (e) {
        isValid = false;
      }
    } else {
      isValid = String(password) === String(user.passHash);
    }
    
    if (!isValid) {
      return res.status(401).json({
        message: 'Invalid password provided'
      });
    }
    
    // Delete user's watchlist items
    await WatchlistItem.deleteMany({ userEmail: emailNorm });
    
    // Delete user account
    await User.findByIdAndDelete(user._id);
    
    console.log(`✅ User account deleted: ${emailNorm}`);
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      message: 'Failed to delete account'
    });
  }
});

// Request password reset
router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        message: 'Email is required'
      });
    }
    
    const emailNorm = String(email).trim().toLowerCase();
    
    // Find user
    const emailRegex = new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, 'i');
    const user = await User.findOne({ email: emailRegex });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account with this email exists, a password reset code has been sent.'
      });
    }
    
    // Generate reset code
    const resetCode = nanoid();
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Save reset code to user
    await User.findByIdAndUpdate(user._id, {
      resetCode,
      resetExpiry
    });
    
    // Send reset email
    const transporter = createTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_USER || 'noreply@anicrawl.com',
        to: emailNorm,
        subject: 'AniCrawl - Passwort zurücksetzen',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Passwort zurücksetzen</h2>
            <p>Hallo ${user.firstName},</p>
            <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten.</p>
            <p>Ihr Reset-Code lautet:</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #333; border-radius: 5px; margin: 20px 0;">
              ${resetCode}
            </div>
            <p>Dieser Code ist 15 Minuten gültig.</p>
            <p>Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">AniCrawl Team</p>
          </div>
        `
      });
    }
    
    console.log(`✅ Password reset code sent to: ${emailNorm}`);
    
    res.json({
      success: true,
      message: 'If an account with this email exists, a password reset code has been sent.'
    });
    
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({
      message: 'Failed to send password reset code'
    });
  }
});

// Reset password with code
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({
        message: 'Email, code, and new password are required'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long'
      });
    }
    
    const emailNorm = String(email).trim().toLowerCase();
    
    // Find user
    const emailRegex = new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, 'i');
    const user = await User.findOne({ email: emailRegex });
    
    if (!user) {
      return res.status(404).json({
        message: 'User account not found'
      });
    }
    
    // Check if reset code exists and is valid
    if (!user.resetCode || !user.resetExpiry) {
      return res.status(400).json({
        message: 'No valid reset code found'
      });
    }
    
    // Check if code matches
    if (user.resetCode !== code) {
      return res.status(400).json({
        message: 'Invalid reset code'
      });
    }
    
    // Check if code is expired
    if (new Date() > user.resetExpiry) {
      return res.status(400).json({
        message: 'Reset code has expired'
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password and clear reset code
    await User.findByIdAndUpdate(user._id, {
      passHash: hashedPassword,
      resetCode: null,
      resetExpiry: null
    });
    
    console.log(`✅ Password reset successful for: ${emailNorm}`);
    
    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
    
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      message: 'Failed to reset password'
    });
  }
});

// Admin statistics endpoint
router.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ verified: true });
    const adminUsers = await User.countDocuments({ isAdmin: true });
    const recentUsers = await User.countDocuments({ 
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    // Get watchlist statistics
    const totalWatchlistItems = await WatchlistItem.countDocuments();
    const uniqueWatchlistUsers = await WatchlistItem.distinct('userEmail').then(emails => emails.length);
    
    // Get watchlist items per user for better statistics
    const watchlistStats = await WatchlistItem.aggregate([
      { $group: { _id: '$userEmail', count: { $sum: 1 } } },
      { $group: { 
          _id: null, 
          totalItems: { $sum: '$count' },
          uniqueUsers: { $sum: 1 },
          averagePerUser: { $avg: '$count' },
          maxPerUser: { $max: '$count' },
          minPerUser: { $min: '$count' }
        }
      }
    ]);
    
    const watchlistData = watchlistStats[0] || { totalItems: 0, uniqueUsers: 0, averagePerUser: 0, maxPerUser: 0, minPerUser: 0 };

    // Get anime statistics
    const totalAnime = await AnimeModel.countDocuments();
    const recentAnime = await AnimeModel.countDocuments({ 
      lastCrawledAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });

    // Get user registration over time (last 30 days)
    const registrationData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      
      const count = await User.countDocuments({
        createdAt: { $gte: startOfDay, $lt: endOfDay }
      });
      
      registrationData.push({
        date: startOfDay.toISOString().split('T')[0],
        count
      });
    }

    // Get most popular anime (by watchlist entries)
    const popularAnime = await WatchlistItem.aggregate([
      { $group: { _id: '$animeSlug', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'animes',
          localField: '_id',
          foreignField: 'slug',
          as: 'anime'
        }
      },
      { $unwind: '$anime' },
      {
        $project: {
          slug: '$_id',
          title: '$anime.canonicalTitle',
          watchlistCount: '$count'
        }
      }
    ]);

    // Get watchlist distribution (how many users have how many items)
    const watchlistDistribution = await WatchlistItem.aggregate([
      { $group: { _id: '$userEmail', count: { $sum: 1 } } },
      { $group: { _id: '$count', users: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Get user activity (recent logins)
    const recentActivity = await User.find({}, { 
      firstName: 1, 
      lastName: 1, 
      email: 1, 
      createdAt: 1 
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          admins: adminUsers,
          recent: recentUsers,
          verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0
        },
        watchlist: {
          totalItems: watchlistData.totalItems,
          uniqueUsers: watchlistData.uniqueUsers,
          averagePerUser: Math.round(watchlistData.averagePerUser * 10) / 10, // Rounded to 1 decimal
          maxPerUser: watchlistData.maxPerUser,
          minPerUser: watchlistData.minPerUser
        },
        anime: {
          total: totalAnime,
          recentlyCrawled: recentAnime
        },
        registrationData,
        popularAnime,
        watchlistDistribution,
        recentActivity
      }
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

export { router as authRouter };
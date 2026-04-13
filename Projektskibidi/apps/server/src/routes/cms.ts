/**
 * Headless CMS API Routes
 * 
 * This module provides a complete REST API for content management.
 * All endpoints follow REST conventions and support both JWT and API key authentication.
 */

import { Router, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { AnimeModel } from "../models/Anime";
import { User } from "../models/User";
import { ApiKey } from "../models/ApiKey";
import { WatchlistItem } from "../models/Watchlist";
import { Webhook, triggerWebhooks } from "../models/Webhook";
import {
    authenticateAny,
    optionalAuth,
    requirePermission,
    requireAdmin,
    AuthenticatedRequest
} from "../middleware/apiAuth";
import { normalizeTitle } from "../utils/normalize";

const router = Router();

// ============================================================================
// CONTENT API - Anime CRUD Operations
// ============================================================================

// Validation schemas
const CreateAnimeSchema = z.object({
    canonicalTitle: z.string().min(1),
    altTitles: z.array(z.string()).optional().default([]),
    description: z.string().optional().default(""),
    imageUrl: z.string().url().optional().nullable(),
    yearStart: z.number().int().optional().nullable(),
    yearEnd: z.number().int().optional().nullable(),
    genres: z.array(z.string()).optional().default([]),
    cast: z.array(z.string()).optional().default([]),
    producers: z.array(z.string()).optional().default([]),
    episodes: z.array(z.object({
        number: z.number().int(),
        title: z.string().optional(),
        languages: z.array(z.string()).optional().default([])
    })).optional().default([]),
    sourceUrl: z.string().optional().default(""),
    customFields: z.record(z.any()).optional()
});

const UpdateAnimeSchema = CreateAnimeSchema.partial();

const QueryParamsSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sort: z.string().optional().default("-createdAt"),
    fields: z.string().optional(),
    q: z.string().optional(),
    genre: z.string().optional(),
    yearStart: z.coerce.number().int().optional(),
    yearEnd: z.coerce.number().int().optional()
});

/**
 * GET /content/anime
 * List all anime with pagination, sorting, and filtering
 */
router.get("/content/anime", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const params = QueryParamsSchema.parse(req.query);

        // Build query
        const query: any = {};

        if (params.q) {
            const normalized = normalizeTitle(params.q);
            query.$or = [
                { normalizedTitle: { $regex: normalized, $options: "i" } },
                { canonicalTitle: { $regex: params.q, $options: "i" } },
                { altTitles: { $elemMatch: { $regex: params.q, $options: "i" } } }
            ];
        }

        if (params.genre) {
            query.genres = { $in: [params.genre] };
        }

        if (params.yearStart) {
            query.yearStart = { $gte: params.yearStart };
        }

        if (params.yearEnd) {
            query.yearEnd = { $lte: params.yearEnd };
        }

        // Build projection
        const projection: any = {};
        if (params.fields) {
            const fields = params.fields.split(",").map(f => f.trim());
            fields.forEach(f => projection[f] = 1);
        }

        // Parse sort
        const sortField = params.sort.startsWith("-") ? params.sort.slice(1) : params.sort;
        const sortOrder = params.sort.startsWith("-") ? -1 : 1;
        const sort: Record<string, 1 | -1> = { [sortField]: sortOrder as 1 | -1 };

        // Execute query with pagination
        const skip = (params.page - 1) * params.limit;

        const [items, total] = await Promise.all([
            AnimeModel.find(query, projection)
                .sort(sort)
                .skip(skip)
                .limit(params.limit)
                .lean(),
            AnimeModel.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / params.limit);

        res.json({
            data: items.map((item: any) => ({
                ...item,
                id: String(item._id),
                _id: undefined,
                lastCrawledAt: item.lastCrawledAt?.toISOString()
            })),
            meta: {
                page: params.page,
                limit: params.limit,
                total,
                totalPages,
                hasNextPage: params.page < totalPages,
                hasPrevPage: params.page > 1
            }
        });
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: { code: "VALIDATION_ERROR", details: err.errors } });
        }
        console.error("List anime error:", err);
        res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
    }
});

/**
 * GET /content/anime/:id
 * Get single anime by ID or slug
 */
router.get("/content/anime/:id", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;

        let doc: any = await AnimeModel.findOne({ slug: id }).lean();

        if (!doc && /^[0-9a-fA-F]{24}$/.test(id)) {
            doc = await AnimeModel.findById(id).lean();
        }

        if (!doc) {
            return res.status(404).json({
                error: { code: "NOT_FOUND", message: "Anime not found" }
            });
        }

        res.json({
            data: {
                ...doc,
                id: String(doc._id),
                _id: undefined,
                lastCrawledAt: doc.lastCrawledAt?.toISOString()
            }
        });
    } catch (err: any) {
        console.error("Get anime error:", err);
        res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
    }
});

/**
 * POST /content/anime
 * Create new anime entry
 */
router.post(
    "/content/anime",
    authenticateAny,
    requirePermission("write", "admin"),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const data = CreateAnimeSchema.parse(req.body);

            // Generate slug from title
            const slug = normalizeTitle(data.canonicalTitle).replace(/\s+/g, "-");

            // Check if slug already exists
            const existing = await AnimeModel.findOne({ slug }).lean();
            if (existing) {
                return res.status(409).json({
                    error: { code: "ALREADY_EXISTS", message: "Anime with this title already exists" }
                });
            }

            const doc = await AnimeModel.create({
                ...data,
                slug,
                normalizedTitle: normalizeTitle(data.canonicalTitle),
                sourceUrl: data.sourceUrl || `cms://anime/${slug}`,
                lastCrawledAt: new Date()
            });

            // Trigger webhooks
            await triggerWebhooks("anime.created", {
                id: String(doc._id),
                slug: doc.slug,
                title: doc.canonicalTitle
            });

            res.status(201).json({
                data: {
                    ...doc.toObject(),
                    id: String(doc._id),
                    _id: undefined
                }
            });
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return res.status(400).json({ error: { code: "VALIDATION_ERROR", details: err.errors } });
            }
            console.error("Create anime error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * PUT /content/anime/:id
 * Update anime entry (full replacement)
 */
router.put(
    "/content/anime/:id",
    authenticateAny,
    requirePermission("write", "admin"),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;
            const data = CreateAnimeSchema.parse(req.body);

            let query: any = { slug: id };
            if (/^[0-9a-fA-F]{24}$/.test(id)) {
                query = { $or: [{ slug: id }, { _id: id }] };
            }

            const doc: any = await AnimeModel.findOneAndUpdate(
                query,
                {
                    ...data,
                    normalizedTitle: normalizeTitle(data.canonicalTitle),
                    lastCrawledAt: new Date()
                },
                { new: true }
            ).lean();

            if (!doc) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "Anime not found" }
                });
            }

            // Trigger webhooks
            await triggerWebhooks("anime.updated", {
                id: String(doc._id),
                slug: doc.slug,
                title: doc.canonicalTitle
            });

            res.json({
                data: {
                    ...doc,
                    id: String(doc._id),
                    _id: undefined
                }
            });
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return res.status(400).json({ error: { code: "VALIDATION_ERROR", details: err.errors } });
            }
            console.error("Update anime error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * PATCH /content/anime/:id
 * Partial update anime entry
 */
router.patch(
    "/content/anime/:id",
    authenticateAny,
    requirePermission("write", "admin"),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;
            const data = UpdateAnimeSchema.parse(req.body);

            let query: any = { slug: id };
            if (/^[0-9a-fA-F]{24}$/.test(id)) {
                query = { $or: [{ slug: id }, { _id: id }] };
            }

            const updateData: any = { ...data };
            if (data.canonicalTitle) {
                updateData.normalizedTitle = normalizeTitle(data.canonicalTitle);
            }

            const doc: any = await AnimeModel.findOneAndUpdate(
                query,
                { $set: updateData },
                { new: true }
            ).lean();

            if (!doc) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "Anime not found" }
                });
            }

            // Trigger webhooks
            await triggerWebhooks("anime.updated", {
                id: String(doc._id),
                slug: doc.slug,
                title: doc.canonicalTitle,
                updatedFields: Object.keys(data)
            });

            res.json({
                data: {
                    ...doc,
                    id: String(doc._id),
                    _id: undefined
                }
            });
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return res.status(400).json({ error: { code: "VALIDATION_ERROR", details: err.errors } });
            }
            console.error("Patch anime error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * DELETE /content/anime/:id
 * Delete anime entry
 */
router.delete(
    "/content/anime/:id",
    authenticateAny,
    requirePermission("delete", "admin"),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;

            let query: any = { slug: id };
            if (/^[0-9a-fA-F]{24}$/.test(id)) {
                query = { $or: [{ slug: id }, { _id: id }] };
            }

            const doc: any = await AnimeModel.findOneAndDelete(query).lean();

            if (!doc) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "Anime not found" }
                });
            }

            // Trigger webhooks
            await triggerWebhooks("anime.deleted", {
                id: String(doc._id),
                slug: doc.slug,
                title: doc.canonicalTitle
            });

            res.status(204).send();
        } catch (err: any) {
            console.error("Delete anime error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

/**
 * GET /api-keys
 * List all API keys for the authenticated user (admin sees all)
 */
router.get(
    "/api-keys",
    authenticateAny,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const query = req.user?.isAdmin ? {} : { userId: req.user!.id };

            const keys = await ApiKey.find(query)
                .populate("userId", "email firstName lastName")
                .sort({ createdAt: -1 })
                .lean();

            res.json({
                data: keys.map((key: any) => ({
                    id: String(key._id),
                    name: key.name,
                    keyPreview: `${key.key.slice(0, 8)}...${key.key.slice(-4)}`,
                    permissions: key.permissions,
                    rateLimit: key.rateLimit,
                    requestCount: key.requestCount,
                    lastUsed: key.lastUsed?.toISOString(),
                    isActive: key.isActive,
                    expiresAt: key.expiresAt?.toISOString(),
                    createdAt: key.createdAt?.toISOString(),
                    user: key.userId
                }))
            });
        } catch (err: any) {
            console.error("List API keys error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * POST /api-keys
 * Create a new API key
 */
router.post(
    "/api-keys",
    authenticateAny,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { name, permissions, rateLimit, expiresAt } = req.body;

            if (!name) {
                return res.status(400).json({
                    error: { code: "VALIDATION_ERROR", message: "Name is required" }
                });
            }

            // Non-admins cannot create admin permissions
            const allowedPermissions = (permissions || ["read"]).filter((p: string) => {
                if (p === "admin" && !req.user?.isAdmin) return false;
                return ["read", "write", "delete", "admin"].includes(p);
            });

            // Generate secure API key
            const key = `ak_${crypto.randomBytes(32).toString("hex")}`;

            const apiKey = await ApiKey.create({
                key,
                name,
                userId: req.user!.id,
                permissions: allowedPermissions,
                rateLimit: rateLimit || 1000,
                expiresAt: expiresAt ? new Date(expiresAt) : null
            });

            // Return full key only at creation time
            res.status(201).json({
                data: {
                    id: String(apiKey._id),
                    key, // Full key returned only at creation
                    name: apiKey.name,
                    permissions: apiKey.permissions,
                    rateLimit: apiKey.rateLimit,
                    expiresAt: apiKey.expiresAt?.toISOString(),
                    createdAt: (apiKey as any).createdAt?.toISOString()
                },
                message: "API key created. Store it securely - it won't be shown again."
            });
        } catch (err: any) {
            console.error("Create API key error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * DELETE /api-keys/:id
 * Revoke an API key
 */
router.delete(
    "/api-keys/:id",
    authenticateAny,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;

            const query: any = { _id: id };
            if (!req.user?.isAdmin) {
                query.userId = req.user!.id;
            }

            const result = await ApiKey.deleteOne(query);

            if (result.deletedCount === 0) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "API key not found" }
                });
            }

            res.status(204).send();
        } catch (err: any) {
            console.error("Delete API key error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

// ============================================================================
// WEBHOOK MANAGEMENT
// ============================================================================

/**
 * GET /webhooks
 * List all webhooks for the authenticated user
 */
router.get(
    "/webhooks",
    authenticateAny,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const query = req.user?.isAdmin ? {} : { userId: req.user!.id };
            const webhooks = await Webhook.find(query).sort({ createdAt: -1 }).lean();

            res.json({
                data: webhooks.map((wh: any) => ({
                    id: String(wh._id),
                    url: wh.url,
                    events: wh.events,
                    isActive: wh.isActive,
                    secretPreview: wh.secret ? `${wh.secret.slice(0, 8)}...` : null,
                    lastTriggered: wh.lastTriggered?.toISOString(),
                    failureCount: wh.failureCount,
                    createdAt: wh.createdAt?.toISOString()
                }))
            });
        } catch (err: any) {
            console.error("List webhooks error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * POST /webhooks
 * Create a new webhook
 */
router.post(
    "/webhooks",
    authenticateAny,
    requirePermission("write", "admin"),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { url, events, secret } = req.body;

            if (!url || !events || !Array.isArray(events) || events.length === 0) {
                return res.status(400).json({
                    error: { code: "VALIDATION_ERROR", message: "URL and events array are required" }
                });
            }

            // Generate secret if not provided
            const webhookSecret = secret || `whsec_${crypto.randomBytes(24).toString("hex")}`;

            const webhook = await Webhook.create({
                url,
                events,
                secret: webhookSecret,
                userId: req.user!.id,
                isActive: true
            });

            res.status(201).json({
                data: {
                    id: String(webhook._id),
                    url: webhook.url,
                    events: webhook.events,
                    secret: webhookSecret, // Return secret only at creation
                    isActive: webhook.isActive,
                    createdAt: (webhook as any).createdAt?.toISOString()
                },
                message: "Webhook created. Store the secret securely."
            });
        } catch (err: any) {
            console.error("Create webhook error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * DELETE /webhooks/:id
 * Delete a webhook
 */
router.delete(
    "/webhooks/:id",
    authenticateAny,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;

            const query: any = { _id: id };
            if (!req.user?.isAdmin) {
                query.userId = req.user!.id;
            }

            const result = await Webhook.deleteOne(query);

            if (result.deletedCount === 0) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "Webhook not found" }
                });
            }

            res.status(204).send();
        } catch (err: any) {
            console.error("Delete webhook error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

// ============================================================================
// USER MANAGEMENT (Admin)
// ============================================================================

/**
 * GET /users
 * List all users (admin only)
 */
router.get(
    "/users",
    authenticateAny,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const params = QueryParamsSchema.parse(req.query);

            const query: any = {};
            if (params.q) {
                query.$or = [
                    { email: { $regex: params.q, $options: "i" } },
                    { firstName: { $regex: params.q, $options: "i" } },
                    { lastName: { $regex: params.q, $options: "i" } }
                ];
            }

            const skip = (params.page - 1) * params.limit;

            const [users, total] = await Promise.all([
                User.find(query, { passHash: 0 })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(params.limit)
                    .lean(),
                User.countDocuments(query)
            ]);

            res.json({
                data: users.map((user: any) => ({
                    id: String(user._id),
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    verified: user.verified,
                    isAdmin: user.isAdmin,
                    createdAt: user.createdAt?.toISOString()
                })),
                meta: {
                    page: params.page,
                    limit: params.limit,
                    total,
                    totalPages: Math.ceil(total / params.limit)
                }
            });
        } catch (err: any) {
            console.error("List users error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * GET /users/:id
 * Get a single user (admin only)
 */
router.get(
    "/users/:id",
    authenticateAny,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;

            const user: any = await User.findById(id, { passHash: 0 }).lean();

            if (!user) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "User not found" }
                });
            }

            // Get user's watchlist count
            const watchlistCount = await WatchlistItem.countDocuments({ userId: id });

            // Get user's API keys count
            const apiKeyCount = await ApiKey.countDocuments({ userId: id });

            res.json({
                data: {
                    id: String(user._id),
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    verified: user.verified,
                    isAdmin: user.isAdmin,
                    createdAt: user.createdAt?.toISOString(),
                    stats: {
                        watchlistCount,
                        apiKeyCount
                    }
                }
            });
        } catch (err: any) {
            console.error("Get user error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * PATCH /users/:id
 * Update a user (admin only)
 */
router.patch(
    "/users/:id",
    authenticateAny,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;
            const { firstName, lastName, email, verified, isAdmin } = req.body;

            const updateData: any = {};
            if (firstName !== undefined) updateData.firstName = firstName;
            if (lastName !== undefined) updateData.lastName = lastName;
            if (email !== undefined) updateData.email = email;
            if (verified !== undefined) updateData.verified = verified;
            if (isAdmin !== undefined) updateData.isAdmin = isAdmin;

            const user: any = await User.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, projection: { passHash: 0 } }
            ).lean();

            if (!user) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "User not found" }
                });
            }

            // Trigger webhooks
            await triggerWebhooks("user.updated", {
                id: String(user._id),
                email: user.email,
                updatedFields: Object.keys(updateData)
            });

            res.json({
                data: {
                    id: String(user._id),
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    verified: user.verified,
                    isAdmin: user.isAdmin,
                    createdAt: user.createdAt?.toISOString()
                }
            });
        } catch (err: any) {
            console.error("Update user error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * DELETE /users/:id
 * Delete a user (admin only)
 */
router.delete(
    "/users/:id",
    authenticateAny,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;

            // Don't allow deleting yourself
            if (id === req.user!.id) {
                return res.status(400).json({
                    error: { code: "INVALID_OPERATION", message: "Cannot delete your own account" }
                });
            }

            const user: any = await User.findByIdAndDelete(id).lean();

            if (!user) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "User not found" }
                });
            }

            // Clean up related data
            await Promise.all([
                WatchlistItem.deleteMany({ userId: id }),
                ApiKey.deleteMany({ userId: id }),
                Webhook.deleteMany({ userId: id })
            ]);

            // Trigger webhooks
            await triggerWebhooks("user.deleted", {
                id: String(user._id),
                email: user.email
            });

            res.status(204).send();
        } catch (err: any) {
            console.error("Delete user error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

// ============================================================================
// STATISTICS & ANALYTICS (Admin)
// ============================================================================

/**
 * GET /stats
 * Get CMS statistics
 */
router.get(
    "/stats",
    authenticateAny,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            const [
                totalAnime,
                totalUsers,
                totalWatchlistItems,
                totalApiKeys,
                recentAnime,
                recentUsers,
                activeApiKeys
            ] = await Promise.all([
                AnimeModel.countDocuments(),
                User.countDocuments(),
                WatchlistItem.countDocuments(),
                ApiKey.countDocuments(),
                AnimeModel.countDocuments({ lastCrawledAt: { $gte: oneDayAgo } }),
                User.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
                ApiKey.countDocuments({ isActive: true, lastUsed: { $gte: oneDayAgo } })
            ]);

            // Get top genres
            const topGenres = await AnimeModel.aggregate([
                { $unwind: "$genres" },
                { $group: { _id: "$genres", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);

            // Get API usage
            const apiUsage = await ApiKey.aggregate([
                { $group: { _id: null, totalRequests: { $sum: "$requestCount" } } }
            ]);

            res.json({
                data: {
                    content: {
                        totalAnime,
                        recentlyUpdated: recentAnime
                    },
                    users: {
                        total: totalUsers,
                        recentSignups: recentUsers,
                        totalWatchlistItems
                    },
                    api: {
                        totalKeys: totalApiKeys,
                        activeKeys: activeApiKeys,
                        totalRequests: apiUsage[0]?.totalRequests || 0
                    },
                    topGenres: topGenres.map((g: any) => ({ genre: g._id, count: g.count }))
                }
            });
        } catch (err: any) {
            console.error("Get stats error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

// ============================================================================
// SCHEMA INTROSPECTION
// ============================================================================

/**
 * GET /schema
 * Get content type schemas (for frontend form generation)
 */
router.get("/schema", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    res.json({
        data: {
            contentTypes: [
                {
                    name: "anime",
                    label: "Anime",
                    fields: [
                        { name: "canonicalTitle", type: "string", required: true, label: "Title" },
                        { name: "altTitles", type: "array", items: "string", label: "Alternative Titles" },
                        { name: "description", type: "text", label: "Description" },
                        { name: "imageUrl", type: "url", label: "Cover Image URL" },
                        { name: "yearStart", type: "number", label: "Start Year" },
                        { name: "yearEnd", type: "number", label: "End Year" },
                        { name: "genres", type: "array", items: "string", label: "Genres" },
                        { name: "cast", type: "array", items: "string", label: "Cast" },
                        { name: "producers", type: "array", items: "string", label: "Producers" },
                        {
                            name: "episodes",
                            type: "array",
                            label: "Episodes",
                            items: {
                                type: "object",
                                fields: [
                                    { name: "number", type: "number", required: true },
                                    { name: "title", type: "string" },
                                    { name: "languages", type: "array", items: "string" }
                                ]
                            }
                        }
                    ]
                }
            ],
            webhookEvents: [
                "anime.created",
                "anime.updated",
                "anime.deleted",
                "user.created",
                "user.updated",
                "user.deleted"
            ]
        }
    });
});

export default router;

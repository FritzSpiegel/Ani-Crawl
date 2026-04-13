/**
 * Media API Routes
 * 
 * Handles file uploads and media management for the Headless CMS.
 */

import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { Media } from "../models/Media";
import {
    authenticateAny,
    requirePermission,
    AuthenticatedRequest
} from "../middleware/apiAuth";

const router = Router();

// Configure multer for file uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760"); // 10MB default

// Ensure upload directory exists
(async () => {
    try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
    } catch (err) {
        console.error("Failed to create upload directory:", err);
    }
})();

const storage = multer.diskStorage({
    destination: async (req: any, file: any, cb: any) => {
        const folder = (req.body?.folder || "/").replace(/\.\./g, "");
        const fullPath = path.join(UPLOAD_DIR, folder);

        try {
            await fs.mkdir(fullPath, { recursive: true });
            cb(null, fullPath);
        } catch (err) {
            cb(err as Error, fullPath);
        }
    },
    filename: (req: any, file: any, cb: any) => {
        const uniqueSuffix = crypto.randomBytes(8).toString("hex");
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9-_]/g, "-")
            .toLowerCase();
        cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req: any, file: any, cb: any) => {
    const allowedMimes = [
        // Images
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        // Videos
        "video/mp4",
        "video/webm",
        // Audio
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        // Documents
        "application/pdf",
        "application/json",
        "text/plain",
        "text/csv"
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} not allowed`));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

/**
 * GET /media
 * List all media files with pagination and filtering
 */
router.get(
    "/",
    authenticateAny,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
            const folder = req.query.folder as string;
            const mimeType = req.query.type as string;
            const search = req.query.q as string;

            const query: any = {};

            // Filter by folder
            if (folder) {
                query.folder = folder;
            }

            // Filter by mime type category
            if (mimeType) {
                if (mimeType === "image") {
                    query.mimeType = { $regex: "^image/" };
                } else if (mimeType === "video") {
                    query.mimeType = { $regex: "^video/" };
                } else if (mimeType === "audio") {
                    query.mimeType = { $regex: "^audio/" };
                } else if (mimeType === "document") {
                    query.mimeType = { $in: ["application/pdf", "application/json", "text/plain", "text/csv"] };
                }
            }

            // Search by name, alt, or caption
            if (search) {
                query.$text = { $search: search };
            }

            const skip = (page - 1) * limit;

            const [items, total] = await Promise.all([
                Media.find(query)
                    .populate("uploadedBy", "email firstName lastName")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Media.countDocuments(query)
            ]);

            res.json({
                data: items.map((item: any) => ({
                    id: item._id.toString(),
                    filename: item.filename,
                    originalName: item.originalName,
                    mimeType: item.mimeType,
                    size: item.size,
                    url: item.url,
                    alt: item.alt,
                    caption: item.caption,
                    folder: item.folder,
                    metadata: item.metadata,
                    uploadedBy: item.uploadedBy,
                    createdAt: (item as any).createdAt?.toISOString()
                })),
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (err: any) {
            console.error("List media error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * GET /media/:id
 * Get single media file info
 */
router.get(
    "/:id",
    authenticateAny,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;

            const media = await Media.findById(id)
                .populate("uploadedBy", "email firstName lastName")
                .lean();

            if (!media) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "Media not found" }
                });
            }

            res.json({
                data: {
                    id: media._id.toString(),
                    filename: media.filename,
                    originalName: media.originalName,
                    mimeType: media.mimeType,
                    size: media.size,
                    url: media.url,
                    alt: media.alt,
                    caption: media.caption,
                    folder: media.folder,
                    metadata: media.metadata,
                    uploadedBy: media.uploadedBy,
                    createdAt: (media as any).createdAt?.toISOString()
                }
            });
        } catch (err: any) {
            console.error("Get media error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * POST /media
 * Upload a new file
 */
router.post(
    "/",
    authenticateAny,
    requirePermission("write", "admin"),
    upload.single("file"),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: { code: "NO_FILE", message: "No file provided" }
                });
            }

            const { alt, caption, folder } = req.body;
            const file = req.file;

            // Generate URL
            const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
            const relativePath = path.relative(UPLOAD_DIR, file.path).replace(/\\/g, "/");
            const url = `${baseUrl}/uploads/${relativePath}`;

            const media = await Media.create({
                filename: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                url,
                path: file.path,
                alt: alt || "",
                caption: caption || "",
                uploadedBy: req.user!.id,
                folder: folder || "/",
                metadata: {
                    encoding: file.encoding
                }
            });

            res.status(201).json({
                data: {
                    id: String((media as any)._id),
                    filename: media.filename,
                    originalName: media.originalName,
                    mimeType: media.mimeType,
                    size: media.size,
                    url: media.url,
                    alt: media.alt,
                    caption: media.caption,
                    folder: media.folder,
                    createdAt: (media as any).createdAt?.toISOString()
                }
            });
        } catch (err: any) {
            console.error("Upload media error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * PATCH /media/:id
 * Update media metadata
 */
router.patch(
    "/:id",
    authenticateAny,
    requirePermission("write", "admin"),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;
            const { alt, caption, folder } = req.body;

            const updateData: any = {};
            if (alt !== undefined) updateData.alt = alt;
            if (caption !== undefined) updateData.caption = caption;
            if (folder !== undefined) updateData.folder = folder.replace(/\.\./g, "");

            const media = await Media.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true }
            ).lean();

            if (!media) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "Media not found" }
                });
            }

            res.json({
                data: {
                    id: media._id.toString(),
                    filename: media.filename,
                    originalName: media.originalName,
                    mimeType: media.mimeType,
                    size: media.size,
                    url: media.url,
                    alt: media.alt,
                    caption: media.caption,
                    folder: media.folder,
                    createdAt: (media as any).createdAt?.toISOString()
                }
            });
        } catch (err: any) {
            console.error("Update media error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * DELETE /media/:id
 * Delete a media file
 */
router.delete(
    "/:id",
    authenticateAny,
    requirePermission("delete", "admin"),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;

            const media = await Media.findByIdAndDelete(id);

            if (!media) {
                return res.status(404).json({
                    error: { code: "NOT_FOUND", message: "Media not found" }
                });
            }

            // Delete the actual file
            try {
                await fs.unlink(media.path);
            } catch (err) {
                console.error("Failed to delete file:", err);
                // Don't fail the request if file deletion fails
            }

            res.status(204).send();
        } catch (err: any) {
            console.error("Delete media error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

/**
 * GET /media/folders
 * List all folders
 */
router.get(
    "/folders/list",
    authenticateAny,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const folders = await Media.distinct("folder");

            res.json({
                data: folders.sort()
            });
        } catch (err: any) {
            console.error("List folders error:", err);
            res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
        }
    }
);

export default router;

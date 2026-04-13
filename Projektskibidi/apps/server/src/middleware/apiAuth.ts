import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiKey, IApiKey } from "../models/ApiKey";
import { User, IUser } from "../models/User";
import { env } from "../env";

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        isAdmin: boolean;
    };
    apiKey?: {
        id: string;
        permissions: string[];
    };
    authMethod?: "jwt" | "apiKey";
    file?: any; // Multer file
}

/**
 * Middleware that authenticates requests via JWT cookie OR API key header
 * Supports both authentication methods for headless CMS architecture
 */
export async function authenticateAny(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    // Try API key first (header: X-API-Key or Authorization: Bearer <api-key>)
    const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
    const authHeader = req.headers.authorization;
    const apiKeyFromAuth = authHeader?.startsWith("ApiKey ")
        ? authHeader.slice(7)
        : undefined;

    const apiKeyValue = apiKeyHeader || apiKeyFromAuth;

    if (apiKeyValue) {
        try {
            const apiKey = await ApiKey.findOne({ key: apiKeyValue, isActive: true });

            if (!apiKey) {
                return res.status(401).json({
                    error: { code: "INVALID_API_KEY", message: "Invalid or inactive API key" }
                });
            }

            // Check if expired
            if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
                return res.status(401).json({
                    error: { code: "API_KEY_EXPIRED", message: "API key has expired" }
                });
            }

            // Check rate limit (simple hourly check)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            if (apiKey.lastUsed && apiKey.lastUsed > oneHourAgo) {
                if (apiKey.requestCount >= apiKey.rateLimit) {
                    return res.status(429).json({
                        error: { code: "RATE_LIMIT_EXCEEDED", message: "API rate limit exceeded" }
                    });
                }
            } else {
                // Reset counter if last request was more than an hour ago
                apiKey.requestCount = 0;
            }

            // Update usage stats
            apiKey.requestCount += 1;
            apiKey.lastUsed = new Date();
            await apiKey.save();

            // Get the associated user
            const user = await User.findById(apiKey.userId);
            if (!user) {
                return res.status(401).json({
                    error: { code: "USER_NOT_FOUND", message: "API key owner not found" }
                });
            }

            req.user = {
                id: String(user._id),
                email: user.email,
                isAdmin: user.isAdmin
            };
            req.apiKey = {
                id: String(apiKey._id),
                permissions: apiKey.permissions
            };
            req.authMethod = "apiKey";

            return next();
        } catch (error) {
            console.error("API key auth error:", error);
            return res.status(500).json({
                error: { code: "AUTH_ERROR", message: "Authentication failed" }
            });
        }
    }

    // Try JWT cookie
    const token = req.cookies?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, env.jwtSecret) as any;
            const user = await User.findById(decoded.userId);

            if (!user) {
                return res.status(401).json({
                    error: { code: "USER_NOT_FOUND", message: "User not found" }
                });
            }

            req.user = {
                id: String(user._id),
                email: user.email,
                isAdmin: user.isAdmin
            };
            req.authMethod = "jwt";

            return next();
        } catch {
            return res.status(401).json({
                error: { code: "INVALID_TOKEN", message: "Invalid or expired token" }
            });
        }
    }

    return res.status(401).json({
        error: { code: "NO_AUTH", message: "Authentication required. Use X-API-Key header or session cookie." }
    });
}

/**
 * Middleware that allows unauthenticated access but enriches request with user if available
 */
export async function optionalAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
    const token = req.cookies?.token;

    if (apiKeyHeader) {
        const apiKey = await ApiKey.findOne({ key: apiKeyHeader, isActive: true });
        if (apiKey) {
            const user = await User.findById(apiKey.userId);
            if (user) {
                req.user = {
                    id: String(user._id),
                    email: user.email,
                    isAdmin: user.isAdmin
                };
                req.apiKey = {
                    id: String(apiKey._id),
                    permissions: apiKey.permissions
                };
                req.authMethod = "apiKey";
            }
        }
    } else if (token) {
        try {
            const decoded = jwt.verify(token, env.jwtSecret) as any;
            const user = await User.findById(decoded.userId);
            if (user) {
                req.user = {
                    id: String(user._id),
                    email: user.email,
                    isAdmin: user.isAdmin
                };
                req.authMethod = "jwt";
            }
        } catch { }
    }

    return next();
}

/**
 * Middleware that requires specific permissions (for API key access)
 */
export function requirePermission(...permissions: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        // Admin users bypass permission checks
        if (req.user?.isAdmin) {
            return next();
        }

        // If using API key, check permissions
        if (req.authMethod === "apiKey" && req.apiKey) {
            const hasPermission = permissions.some(p => req.apiKey!.permissions.includes(p));
            if (!hasPermission) {
                return res.status(403).json({
                    error: {
                        code: "INSUFFICIENT_PERMISSIONS",
                        message: `Required permissions: ${permissions.join(", ")}`
                    }
                });
            }
        }

        return next();
    };
}

/**
 * Middleware that requires admin access
 */
export function requireAdmin(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    if (!req.user?.isAdmin) {
        return res.status(403).json({
            error: { code: "ADMIN_REQUIRED", message: "Admin access required" }
        });
    }
    return next();
}

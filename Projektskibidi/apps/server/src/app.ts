import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { httpLogger, logger } from "./../src/logger";
import api from "./routes/api";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { env } from "./env";
import mongoose, { Schema, model } from "mongoose";

export function createApp() {
  const app = express();
  app.use(httpLogger);
  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: env.appBaseUrl, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 60_000, limit: 10 }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", api);

  // --- Simple Mongo models for auth/watchlist ---
  const UserSchema = new Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passHash: { type: String, required: true },
    verified: { type: Boolean, default: true },
    createdAt: { type: Date, default: () => new Date() },
  });
  const WatchSchema = new Schema({
    userEmail: { type: String, index: true },
    itemId: { type: String },
    title: { type: String },
    image: { type: String },
    createdAt: { type: Date, default: () => new Date() },
  }, { indexes: [{ fields: { userEmail: 1, itemId: 1 }, options: { unique: true } }] } as any);
  const UserModel = (mongoose.models as any).User || model("User", UserSchema);
  const WatchModel = (mongoose.models as any).Watch || model("Watch", WatchSchema);

  // --- Auth helpers ---
  function issueToken(email: string) {
    return jwt.sign({ email }, env.jwtSecret, { expiresIn: "7d" });
  }
  function requireAuth(req: any, res: any, next: any) {
    try {
      const token = req.cookies?.token;
      if (!token) return res.status(401).json({ ok: false, code: "NO_AUTH" });
      const payload = jwt.verify(token, env.jwtSecret) as any;
      req.user = { email: payload.email };
      return next();
    } catch {
      return res.status(401).json({ ok: false, code: "BAD_TOKEN" });
    }
  }

  // --- Auth routes ---
  app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    const emailNorm = String(email || "").trim().toLowerCase();
    if (emailNorm === env.adminEmail.toLowerCase() && String(password) === String(env.adminPassword)) {
      const token = issueToken(env.adminEmail);
      res.cookie("token", token, { httpOnly: true, sameSite: "Lax", secure: false, maxAge: 7 * 24 * 3600 * 1000 });
      return res.json({ ok: true, user: { email: env.adminEmail, firstName: "Admin", lastName: "User" }, admin: true });
    }
    const user = await UserModel.findOne({ email: emailNorm }).lean();
    if (!user) return res.status(401).json({ ok: false, code: "NO_USER" });
    // NOTE: Keep simple for now (no bcrypt), expecting pre-seeded users
    if (String(password) !== String(user.passHash)) return res.status(401).json({ ok: false, code: "BAD_PASS" });
    const token = issueToken(emailNorm);
    res.cookie("token", token, { httpOnly: true, sameSite: "Lax", secure: false, maxAge: 7 * 24 * 3600 * 1000 });
    return res.json({ ok: true, user: { email: user.email, firstName: user.firstName, lastName: user.lastName }, admin: false });
  });

  app.post("/auth/logout", (_req, res) => {
    res.clearCookie("token", { httpOnly: true, sameSite: "Lax", secure: false });
    res.json({ ok: true });
  });

  app.post("/auth/register", async (req, res) => {
    const { firstName, lastName, email, password } = req.body || {};
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ ok: false, message: "missing" });
    const emailNorm = String(email).trim().toLowerCase();
    const exists = await UserModel.findOne({ email: emailNorm }).lean();
    if (exists) return res.status(409).json({ ok: false, code: "EMAIL_EXISTS" });
    await UserModel.create({ firstName, lastName, email: emailNorm, passHash: String(password), verified: true });
    return res.json({ ok: true, email: emailNorm });
  });

  // --- Admin (list/delete users) ---
  app.get("/admin/users", async (_req, res) => {
    const users = await UserModel.find({}, { passHash: 0 }).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, users });
  });
  app.delete("/admin/users/:email", async (req, res) => {
    await UserModel.deleteOne({ email: String(req.params.email).toLowerCase() });
    res.json({ ok: true });
  });

  // --- Watchlist ---
  app.get("/watchlist", requireAuth, async (req: any, res) => {
    const rows = await WatchModel.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, items: rows.map(r => ({ id: r.itemId, title: r.title, image: r.image })) });
  });
  app.get("/watchlist/contains/:id", requireAuth, async (req: any, res) => {
    const exists = await WatchModel.findOne({ userEmail: req.user.email, itemId: String(req.params.id) }).lean();
    res.json({ ok: true, exists: Boolean(exists) });
  });
  app.post("/watchlist", requireAuth, async (req: any, res) => {
    const { id, title, img } = req.body || {};
    if (!id || !title) return res.status(400).json({ ok: false, message: "id and title required" });
    await WatchModel.updateOne(
      { userEmail: req.user.email, itemId: String(id) },
      { $set: { title: String(title), image: img || null, createdAt: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true });
  });
  app.delete("/watchlist/:id", requireAuth, async (req: any, res) => {
    await WatchModel.deleteOne({ userEmail: req.user.email, itemId: String(req.params.id) });
    res.json({ ok: true });
  });

  app.use((err: any, _req: any, res: any, _next: any) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ error: { code: "CRAWL_FAILED", message: "Internal server error" } });
  });
  return app;
}

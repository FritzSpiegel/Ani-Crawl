import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app";
import { env } from "../src/env";

let app: ReturnType<typeof createApp>;

describe("e2e", () => {
  beforeAll(async () => {
    await mongoose.connect(env.mongoUri);
    app = createApp();
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("health works", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("crawl fallback works on miss", async () => {
    const res = await request(app).get("/api/search").query({ q: "narutu" });
    expect(res.status).toBe(200);
    expect(res.body.slug).toBeTruthy();
    expect(res.body.canonicalTitle).toBeTruthy();
  });
});

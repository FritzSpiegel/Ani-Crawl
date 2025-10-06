import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import { parseSearch, parseDetail } from "../src/crawler/parser";

const SEARCH_FIXTURE = "./apps/server/fixtures/search.html";
const DETAIL_FIXTURE = "./apps/server/fixtures/detail.html";

describe("parser", () => {
  it("parses top search result", async () => {
    const html = await fs.readFile(SEARCH_FIXTURE, "utf-8");
    const res = parseSearch(html);
    expect(res.topHref).toBeTruthy();
  });

  it("parses detail page fields", async () => {
    const html = await fs.readFile(DETAIL_FIXTURE, "utf-8");
    const res = parseDetail(html);
    expect(res.canonicalTitle).toBeTruthy();
    expect(typeof res.description).toBe("string");
  });
});

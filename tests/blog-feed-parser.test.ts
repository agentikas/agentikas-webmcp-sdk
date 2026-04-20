import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAtomFeed } from "../src/verticals/blog/feed-parser";

const fixtureXml = readFileSync(
  resolve(__dirname, "fixtures/blog-feed-atom.xml"),
  "utf-8",
);

describe("parseAtomFeed", () => {
  it("extracts feed-level metadata", () => {
    const feed = parseAtomFeed(fixtureXml);
    expect(feed.blog.name).toBe("Agentikas Labs");
    expect(feed.blog.subtitle).toBe("Notas sobre la web agéntica");
    expect(feed.blog.homeUrl).toBe("https://agentikas.blog.agentikas.ai/es");
    expect(feed.blog.feedUrl).toBe(
      "https://agentikas.blog.agentikas.ai/es/feed.xml",
    );
    expect(feed.blog.author).toBe("Agentikas Labs");
  });

  it("returns all entries in document order", () => {
    const feed = parseAtomFeed(fixtureXml);
    expect(feed.entries).toHaveLength(3);
    expect(feed.entries[0].title).toBe(
      "Declarar WebMCP sobre tu blog en 10 minutos",
    );
    expect(feed.entries[2].title).toBe("Post sin tags ni autor explícito");
  });

  it("extracts entry id, url, dates, and author", () => {
    const [first] = parseAtomFeed(fixtureXml).entries;
    expect(first.id).toBe(
      "https://agentikas.blog.agentikas.ai/es/webmcp-blog-10-min",
    );
    expect(first.url).toBe(
      "https://agentikas.blog.agentikas.ai/es/webmcp-blog-10-min",
    );
    expect(first.published).toBe("2026-04-15T10:00:00Z");
    expect(first.updated).toBe("2026-04-15T10:00:00Z");
    expect(first.authors).toEqual(["Salva"]);
  });

  it("extracts tags from multiple <category term> elements", () => {
    const feed = parseAtomFeed(fixtureXml);
    expect(feed.entries[0].tags).toEqual(["webmcp", "tutorial"]);
    expect(feed.entries[1].tags).toEqual(["distribution", "gtm"]);
    expect(feed.entries[2].tags).toEqual([]);
  });

  it("extracts summary when present", () => {
    const feed = parseAtomFeed(fixtureXml);
    expect(feed.entries[0].summary).toBe(
      "El 80% de las tools de un blog se reducen a exponer JSON-LD, RSS y DOM.",
    );
    expect(feed.entries[2].summary).toBeUndefined();
  });

  it("decodes escaped HTML inside <content type=\"html\">", () => {
    const feed = parseAtomFeed(fixtureXml);
    expect(feed.entries[0].content).toBe(
      "<p>Contenido completo del post en HTML. Con &amp; y <em>énfasis</em>.</p>",
    );
    // Entry without content resolves to undefined
    expect(feed.entries[1].content).toBeUndefined();
  });

  it("falls back to feed-level author when entry has no <author>", () => {
    const feed = parseAtomFeed(fixtureXml);
    expect(feed.entries[2].authors).toEqual(["Agentikas Labs"]);
  });

  it("returns empty feed gracefully for invalid input", () => {
    const empty = parseAtomFeed("<?xml version=\"1.0\"?><nothing/>");
    expect(empty.blog.name).toBe("");
    expect(empty.entries).toEqual([]);
  });

  it("collects distinct tags and authors across entries", () => {
    const feed = parseAtomFeed(fixtureXml);
    const allTags = Array.from(new Set(feed.entries.flatMap((e) => e.tags)));
    const allAuthors = Array.from(
      new Set(feed.entries.flatMap((e) => e.authors)),
    );
    expect(allTags.sort()).toEqual(
      ["distribution", "gtm", "tutorial", "webmcp"],
    );
    expect(allAuthors).toContain("Salva");
    expect(allAuthors).toContain("Marta");
  });
});

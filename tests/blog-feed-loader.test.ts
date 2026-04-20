import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeed,
  invalidateFeedCache,
  discoverFeedUrl,
} from "../src/verticals/blog/feed-loader";

const fixtureXml = readFileSync(
  resolve(__dirname, "fixtures/blog-feed-atom.xml"),
  "utf-8",
);

function mockOkFeed(xml: string = fixtureXml) {
  return vi.fn(async () =>
    new Response(xml, {
      status: 200,
      headers: { "Content-Type": "application/atom+xml" },
    }),
  );
}

function clearHead(): void {
  document.head.replaceChildren();
}

function addLink(rel: string, type: string, href: string): void {
  const link = document.createElement("link");
  link.setAttribute("rel", rel);
  link.setAttribute("type", type);
  link.setAttribute("href", href);
  document.head.appendChild(link);
}

describe("loadFeed", () => {
  beforeEach(() => {
    invalidateFeedCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    invalidateFeedCache();
  });

  it("fetches the feed URL and parses it", async () => {
    const fetchMock = mockOkFeed();
    vi.stubGlobal("fetch", fetchMock);

    const feed = await loadFeed("https://example.test/es/feed.xml");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(feed.blog.name).toBe("Agentikas Labs");
    expect(feed.entries).toHaveLength(3);
  });

  it("returns cached value on subsequent calls within TTL", async () => {
    const fetchMock = mockOkFeed();
    vi.stubGlobal("fetch", fetchMock);

    await loadFeed("https://example.test/es/feed.xml", 60_000);
    await loadFeed("https://example.test/es/feed.xml", 60_000);
    await loadFeed("https://example.test/es/feed.xml", 60_000);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refetches after invalidateFeedCache", async () => {
    const fetchMock = mockOkFeed();
    vi.stubGlobal("fetch", fetchMock);

    await loadFeed("https://example.test/es/feed.xml");
    invalidateFeedCache();
    await loadFeed("https://example.test/es/feed.xml");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches independently per URL", async () => {
    const fetchMock = mockOkFeed();
    vi.stubGlobal("fetch", fetchMock);

    await loadFeed("https://example.test/es/feed.xml");
    await loadFeed("https://example.test/en/feed.xml");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns empty feed when fetch throws and no cache exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network error");
      }),
    );
    const feed = await loadFeed("https://example.test/es/feed.xml");
    expect(feed.entries).toEqual([]);
    expect(feed.blog.name).toBe("");
  });

  it("returns empty feed when response is non-200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    const feed = await loadFeed("https://example.test/es/feed.xml");
    expect(feed.entries).toEqual([]);
  });

  it("serves stale cached value if fetch fails after a successful load", async () => {
    const okFetch = mockOkFeed();
    vi.stubGlobal("fetch", okFetch);
    await loadFeed("https://example.test/es/feed.xml", 1);

    // Let TTL expire
    await new Promise((r) => setTimeout(r, 5));

    const failFetch = vi.fn(async () => {
      throw new Error("boom");
    });
    vi.stubGlobal("fetch", failFetch);

    const feed = await loadFeed("https://example.test/es/feed.xml", 1);
    expect(feed.blog.name).toBe("Agentikas Labs");
    expect(failFetch).toHaveBeenCalledOnce();
  });
});

describe("discoverFeedUrl", () => {
  beforeEach(() => {
    clearHead();
  });

  it("reads href from <link rel=\"alternate\" type=\"application/atom+xml\">", () => {
    addLink("alternate", "application/atom+xml", "/es/feed.xml");
    const url = discoverFeedUrl();
    expect(url.endsWith("/es/feed.xml")).toBe(true);
  });

  it("falls back to /{locale}/feed.xml inferred from pathname when link is missing", () => {
    window.history.replaceState({}, "", "/es/some-post");
    const url = discoverFeedUrl();
    expect(url.endsWith("/es/feed.xml")).toBe(true);
    window.history.replaceState({}, "", "/");
  });

  it("falls back to /feed.xml at the root when pathname has no locale segment", () => {
    window.history.replaceState({}, "", "/");
    const url = discoverFeedUrl();
    expect(url.endsWith("/feed.xml")).toBe(true);
  });

  it("resolves relative hrefs against the document base URL", () => {
    addLink("alternate", "application/atom+xml", "/en/feed.xml");
    const url = discoverFeedUrl();
    expect(url.startsWith("http")).toBe(true);
    expect(url.endsWith("/en/feed.xml")).toBe(true);
  });
});

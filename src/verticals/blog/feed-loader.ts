// @agentikas/webmcp-sdk — Atom feed loader (Blog vertical)
// Module-level cache so multiple tool invocations share a single fetch.
// Standards-first: discovers the feed URL via <link rel="alternate" type="application/atom+xml">.

import { parseAtomFeed, type ParsedFeed } from "./feed-parser";

interface CacheEntry {
  value: ParsedFeed;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 60_000;

function emptyFeed(): ParsedFeed {
  return { blog: { name: "", homeUrl: "", feedUrl: "" }, entries: [] };
}

/**
 * Load an Atom feed with in-memory caching. Returns a parsed feed.
 *
 * - Within TTL: returns cached value, no network call.
 * - On fetch error with a prior cached value: returns the stale value.
 * - On fetch error with no cache: returns an empty feed (never throws).
 */
export async function loadFeed(
  url: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<ParsedFeed> {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/atom+xml, application/xml, text/xml" },
    });
    if (!res.ok) return hit?.value ?? emptyFeed();
    const xml = await res.text();
    const parsed = parseAtomFeed(xml);
    cache.set(url, { value: parsed, expiresAt: now + ttlMs });
    return parsed;
  } catch {
    return hit?.value ?? emptyFeed();
  }
}

/** Clear the feed cache (all entries, or a single URL). */
export function invalidateFeedCache(url?: string): void {
  if (url) cache.delete(url);
  else cache.clear();
}

/**
 * Locate the feed URL for the current document.
 *
 * Order:
 *   1. <link rel="alternate" type="application/atom+xml"> in <head>
 *   2. /{locale}/feed.xml derived from the pathname's first segment
 *   3. /feed.xml
 *
 * All results are absolute URLs (resolved against `document.baseURI`).
 */
export function discoverFeedUrl(doc: Document = document): string {
  const link = doc.querySelector<HTMLLinkElement>(
    'link[rel="alternate"][type="application/atom+xml"]',
  );
  if (link?.href) return link.href;

  const base = doc.baseURI;
  const path = new URL(base).pathname;
  const first = path.split("/").filter(Boolean)[0];
  const candidate = first ? `/${first}/feed.xml` : "/feed.xml";
  return new URL(candidate, base).toString();
}

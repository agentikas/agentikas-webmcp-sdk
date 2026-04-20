// @agentikas/webmcp-sdk — Atom feed parser (Blog vertical)
// Standards-first: consumes Atom 1.0 XML (RFC 4287). No custom API.

export interface FeedBlogMeta {
  name: string;
  subtitle?: string;
  /** Page the feed represents (e.g. https://slug.blog.agentikas.ai/es). */
  homeUrl: string;
  /** Canonical URL of the feed itself (from <link rel="self">). */
  feedUrl: string;
  /** Feed-level author, used as fallback for entries without one. */
  author?: string;
}

export interface FeedEntry {
  id: string;
  url: string;
  title: string;
  summary?: string;
  /** Decoded HTML of <content type="html">. Undefined if missing. */
  content?: string;
  published: string;
  updated: string;
  authors: string[];
  tags: string[];
}

export interface ParsedFeed {
  blog: FeedBlogMeta;
  entries: FeedEntry[];
}

function parseXml(xml: string): Document | null {
  if (typeof DOMParser === "undefined") return null;
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return null;
    return doc;
  } catch {
    return null;
  }
}

function text(el: Element | null): string {
  return el?.textContent?.trim() ?? "";
}

/**
 * Resolve the feed's alternate (non-self) link. Atom allows multiple <link>
 * elements; we want the one that points at the human page, not the feed URL.
 */
function feedHomeUrl(feed: Element, feedUrl: string): string {
  const links = Array.from(feed.children).filter(
    (c) => c.tagName === "link" && c.parentElement === feed,
  );
  for (const link of links) {
    const rel = link.getAttribute("rel");
    const href = link.getAttribute("href") ?? "";
    if (rel !== "self" && href) return href;
  }
  return feedUrl.replace(/\/feed\.xml$/, "");
}

function feedSelfUrl(feed: Element): string {
  const selfLink = Array.from(feed.children).find(
    (c) => c.tagName === "link" && c.getAttribute("rel") === "self",
  );
  return selfLink?.getAttribute("href") ?? "";
}

function collectCategories(entry: Element): string[] {
  return Array.from(entry.children)
    .filter((c) => c.tagName === "category")
    .map((c) => c.getAttribute("term") ?? "")
    .filter(Boolean);
}

function collectAuthors(entry: Element): string[] {
  return Array.from(entry.children)
    .filter((c) => c.tagName === "author")
    .map((a) => text(a.getElementsByTagName("name")[0] ?? null))
    .filter(Boolean);
}

function entryUrl(entry: Element): string {
  const link = Array.from(entry.children).find(
    (c) => c.tagName === "link" && !c.getAttribute("rel"),
  );
  if (link) return link.getAttribute("href") ?? "";
  const anyLink = entry.getElementsByTagName("link")[0];
  return anyLink?.getAttribute("href") ?? "";
}

function parseEntry(entry: Element, fallbackAuthor: string): FeedEntry {
  const url = entryUrl(entry);
  const published = text(entry.getElementsByTagName("published")[0] ?? null);
  const updated = text(entry.getElementsByTagName("updated")[0] ?? null) || published;
  const summary = text(entry.getElementsByTagName("summary")[0] ?? null);
  const contentEl = entry.getElementsByTagName("content")[0] ?? null;
  const authors = collectAuthors(entry);

  return {
    id: text(entry.getElementsByTagName("id")[0] ?? null) || url,
    url,
    title: text(entry.getElementsByTagName("title")[0] ?? null),
    summary: summary || undefined,
    content: contentEl?.textContent?.trim() || undefined,
    published,
    updated,
    authors: authors.length > 0 ? authors : fallbackAuthor ? [fallbackAuthor] : [],
    tags: collectCategories(entry),
  };
}

function emptyFeed(): ParsedFeed {
  return {
    blog: { name: "", homeUrl: "", feedUrl: "" },
    entries: [],
  };
}

export function parseAtomFeed(xml: string): ParsedFeed {
  const doc = parseXml(xml);
  if (!doc) return emptyFeed();

  const feed = doc.getElementsByTagName("feed")[0];
  if (!feed) return emptyFeed();

  const feedUrl = feedSelfUrl(feed);
  const homeUrl = feedHomeUrl(feed, feedUrl);
  const feedAuthor = text(
    Array.from(feed.children).find(
      (c) => c.tagName === "author" && c.parentElement === feed,
    )?.getElementsByTagName("name")[0] ?? null,
  );

  const blog: FeedBlogMeta = {
    name: text(feed.getElementsByTagName("title")[0] ?? null),
    subtitle: text(feed.getElementsByTagName("subtitle")[0] ?? null) || undefined,
    homeUrl,
    feedUrl,
    author: feedAuthor || undefined,
  };

  const entryEls = Array.from(feed.children).filter((c) => c.tagName === "entry");
  const entries = entryEls.map((e) => parseEntry(e, feedAuthor));

  return { blog, entries };
}

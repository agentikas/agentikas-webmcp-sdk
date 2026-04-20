// @agentikas/webmcp-sdk — Blog executors (Atom-feed backed, navigation-enabled).
// Every executor fetches the feed lazily on first call and reuses the
// in-memory cache across subsequent calls. Multi-post tools navigate to
// /search; single-post tools navigate to the post detail; metadata tools
// (tags/authors) return data only.

import type { ExecutorMap, ToolResult } from "../../types";
import { loadFeed, discoverFeedUrl } from "./feed-loader";
import { buildHomeUrl, buildPostUrl, buildSearchUrl, navigateTo } from "./navigate";
import type { FeedEntry } from "./feed-parser";
import {
  readPostMetadata,
  readPostContent,
  readPostSummary,
  readToc,
  readCodeBlocks,
  readCitations,
  slugify,
  type PostMetadata,
} from "./post-reader";

type NoData = unknown;

const DEFAULT_LIST_LIMIT = 10;
const DEFAULT_SEARCH_LIMIT = 20;

function text(text: string): ToolResult {
  return { content: [{ type: "text" as const, text }] };
}

function slugFromEntry(entry: FeedEntry): string {
  try {
    const parts = new URL(entry.url).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  } catch {
    const parts = entry.url.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  }
}

function summarizeEntry(entry: FeedEntry): string {
  const author = entry.authors[0] ?? "Unknown";
  const date = entry.published.slice(0, 10);
  const tags = entry.tags.length > 0 ? ` [${entry.tags.join(", ")}]` : "";
  const summary = entry.summary ? `\n  ${entry.summary}` : "";
  return `• ${entry.title} — ${author} · ${date}${tags}${summary}\n  ${entry.url}`;
}

function summarizePostList(entries: FeedEntry[], meta: { total: number; navigatedTo?: string }): string {
  if (entries.length === 0) return "No posts found.";
  const header = meta.total === entries.length
    ? `Found ${entries.length} post(s):`
    : `Found ${meta.total} post(s), showing ${entries.length}:`;
  const body = entries.map(summarizeEntry).join("\n\n");
  const footer = meta.navigatedTo ? `\n\nOpened: ${meta.navigatedTo}` : "";
  return `${header}\n\n${body}${footer}`;
}

function matchesSearch(entry: FeedEntry, q: string): boolean {
  const needle = q.toLowerCase();
  const haystack = [
    entry.title,
    entry.summary ?? "",
    entry.content ?? "",
    entry.tags.join(" "),
    entry.authors.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export const blogExecutors: ExecutorMap<NoData> = {
  list_posts: () => async (args: {
    tag?: string;
    author?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }) => {
    const { tag, author, limit = DEFAULT_LIST_LIMIT, offset = 0, sort } = args ?? {};
    const feed = await loadFeed(discoverFeedUrl());

    let entries = feed.entries;
    if (tag) entries = entries.filter((e) => e.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
    if (author) {
      const a = author.toLowerCase();
      entries = entries.filter((e) => e.authors.some((x) => x.toLowerCase().includes(a)));
    }

    const total = entries.length;
    const windowed = entries.slice(offset, offset + limit);

    const hasFilters = Boolean(tag || author || sort);
    const target = hasFilters
      ? buildSearchUrl({ tag, author, sort })
      : buildHomeUrl();
    navigateTo(target);

    return text(summarizePostList(windowed, { total, navigatedTo: target }));
  },

  search_posts: () => async (args: { query: string; limit?: number }) => {
    const query = (args?.query ?? "").trim();
    if (!query) return text("A non-empty 'query' is required.");

    const feed = await loadFeed(discoverFeedUrl());
    const limit = args?.limit ?? DEFAULT_SEARCH_LIMIT;
    const matches = feed.entries.filter((e) => matchesSearch(e, query)).slice(0, limit);

    const target = buildSearchUrl({ q: query });
    navigateTo(target);

    if (matches.length === 0) {
      return text(`No posts match "${query}".\n\nOpened: ${target}`);
    }
    return text(
      `Found ${matches.length} post(s) matching "${query}":\n\n` +
        matches.map(summarizeEntry).join("\n\n") +
        `\n\nOpened: ${target}`,
    );
  },

  get_tags: () => async () => {
    const feed = await loadFeed(discoverFeedUrl());
    const counts = new Map<string, number>();
    for (const entry of feed.entries) {
      for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    if (counts.size === 0) return text("No tags yet.");
    const rows = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, n]) => `• ${tag} (${n})`);
    return text(`Tags in use:\n\n${rows.join("\n")}`);
  },

  get_authors: () => async () => {
    const feed = await loadFeed(discoverFeedUrl());
    const set = new Set<string>();
    for (const entry of feed.entries) for (const a of entry.authors) set.add(a);
    if (set.size === 0) return text("No authors yet.");
    return text(`Authors:\n\n${[...set].map((a) => `• ${a}`).join("\n")}`);
  },

  get_latest_post: () => async () => {
    const feed = await loadFeed(discoverFeedUrl());
    if (feed.entries.length === 0) return text("No posts yet.");
    const latest = feed.entries[0];
    const slug = slugFromEntry(latest);
    const target = buildPostUrl(slug);
    navigateTo(target);
    return text(
      `Latest post:\n\n${summarizeEntry(latest)}\n\nOpened: ${target}`,
    );
  },

  filter_by_tag: () => async (args: { tag: string }) => {
    const tag = (args?.tag ?? "").trim();
    if (!tag) return text("A non-empty 'tag' is required.");

    const feed = await loadFeed(discoverFeedUrl());
    const matches = feed.entries.filter((e) =>
      e.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
    );

    const target = buildSearchUrl({ tag });
    navigateTo(target);

    if (matches.length === 0) {
      return text(`No posts tagged "${tag}".\n\nOpened: ${target}`);
    }
    return text(
      `Posts tagged "${tag}":\n\n${matches.map(summarizeEntry).join("\n\n")}\n\nOpened: ${target}`,
    );
  },

  set_sort_order: () => async (args: { order: "recent" | "popular" | "trending" }) => {
    const order = args?.order;
    const home = buildHomeUrl();
    // The blog home supports ?sort=views (popular) and ?sort=likes (trending).
    // "recent" is the default ordering; no querystring needed.
    const target =
      order === "popular" ? `${home}?sort=views`
      : order === "trending" ? `${home}?sort=likes`
      : home;
    navigateTo(target);
    return text(`Sort order set to "${order}". Opened: ${target}`);
  },

  open_post: () => async (args: { slug: string }) => {
    const slug = (args?.slug ?? "").trim();
    if (!slug) return text("A non-empty 'slug' is required.");

    const feed = await loadFeed(discoverFeedUrl());
    const match = feed.entries.find((e) => slugFromEntry(e) === slug);
    if (!match) return text(`Post "${slug}" not found.`);

    const target = buildPostUrl(slug);
    navigateTo(target);
    return text(`${summarizeEntry(match)}\n\nOpened: ${target}`);
  },

  // ── Post-detail tools ─────────────────────────────────────────────
  // Read-only DOM + browser-API tools. No navigation (the user is already
  // on the page); side effects are scroll/clipboard/share as spec'd by the
  // Web Share API, Clipboard API, and scrollIntoView().

  get_post_metadata: () => async () => {
    const meta = readPostMetadata();
    if (!meta) return text("No post metadata found on this page.");
    return text(formatMetadata(meta));
  },

  get_post_content: () => async (args: { format?: "text" | "html" } = {}) => {
    const format = args?.format === "html" ? "html" : "text";
    const content = readPostContent(document, format);
    if (!content) return text("No content found (no <article> on this page).");
    return text(content);
  },

  get_post_summary: () => async () => {
    const summary = readPostSummary();
    if (!summary) return text("No summary available on this page.");
    return text(summary);
  },

  get_table_of_contents: () => async () => {
    const toc = readToc();
    if (toc.length === 0) return text("No sections found in this post.");
    const rows = toc.map((e) => `${"•".padStart(e.level - 1, " ")} ${e.title} (#${e.anchor})`);
    return text(`Table of contents:\n\n${rows.join("\n")}`);
  },

  list_code_blocks: () => async () => {
    const blocks = readCodeBlocks();
    if (blocks.length === 0) return text("No code blocks found in this post.");
    const rows = blocks.map(
      (b) =>
        `[${b.index}] ${b.language || "plaintext"} · ${b.lineCount} line(s)\n    ${b.preview.replace(/\n/g, "\\n")}`,
    );
    return text(`Found ${blocks.length} code block(s):\n\n${rows.join("\n\n")}`);
  },

  get_code_block: () => async (args: { index: number }) => {
    const idx = Number(args?.index);
    if (!Number.isFinite(idx)) return text("A numeric 'index' is required.");
    const blocks = readCodeBlocks();
    const block = blocks[idx];
    if (!block) return text(`Code block at index ${idx} not found.`);
    return text(
      `Code block [${idx}] (${block.language || "plaintext"}, ${block.lineCount} line(s)):\n\n${block.code}`,
    );
  },

  get_citations: () => async () => {
    const cites = readCitations();
    if (cites.length === 0) return text("No external citations found in this post.");
    const rows = cites.map((c) => `• ${c.text || c.href}\n  ${c.href}`);
    return text(`External citations:\n\n${rows.join("\n")}`);
  },

  scroll_to_section: () => async (args: { section_id: string }) => {
    const id = (args?.section_id ?? "").trim();
    if (!id) return text("A non-empty 'section_id' is required.");
    const el =
      document.getElementById(id) ??
      findHeadingByText(id) ??
      document.getElementById(slugify(id));
    if (!el) return text(`Section "${id}" not found.`);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return text(`Scrolled to #${el.id || slugify(id)}.`);
  },

  copy_code_block: () => async (args: { index: number }) => {
    const idx = Number(args?.index);
    if (!Number.isFinite(idx)) return text("A numeric 'index' is required.");
    const blocks = readCodeBlocks();
    const block = blocks[idx];
    if (!block) return text(`Code block at index ${idx} not found.`);
    const clipboard = (navigator as unknown as { clipboard?: { writeText(v: string): Promise<void> } }).clipboard;
    if (!clipboard?.writeText) return text("Clipboard API not available in this context.");
    await clipboard.writeText(block.code);
    return text(`Copied ${block.lineCount} line(s) of ${block.language || "plaintext"} to the clipboard.`);
  },

  share_post: () => async (args: { channel?: string } = {}) => {
    const meta = readPostMetadata();
    const title = meta?.title || document.title || "";
    const url =
      meta?.canonicalUrl ||
      (typeof window !== "undefined" ? window.location.href : "");
    const nav = navigator as unknown as {
      share?: (data: { title: string; url: string; text?: string }) => Promise<void>;
      clipboard?: { writeText(v: string): Promise<void> };
    };

    if (nav.share) {
      try {
        await nav.share({ title, url, text: meta?.description });
        return text(`Shared: ${title} · ${url}`);
      } catch {
        // User-dismissed share — fall through to clipboard fallback below.
      }
    }

    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(url);
      return text(`Copied URL to clipboard: ${url}`);
    }

    return text(`Share URL: ${url}`);
  },
};

function formatMetadata(meta: PostMetadata): string {
  const lines: string[] = [];
  lines.push(`# ${meta.title}`);
  if (meta.description) lines.push("", meta.description);
  lines.push("");
  lines.push(`**Author:** ${meta.author || "—"}`);
  lines.push(`**Published:** ${meta.publishedAt.slice(0, 10) || "—"}`);
  if (meta.modifiedAt) lines.push(`**Modified:** ${meta.modifiedAt.slice(0, 10)}`);
  if (meta.tags.length > 0) lines.push(`**Tags:** ${meta.tags.join(", ")}`);
  if (meta.image) lines.push(`**Image:** ${meta.image}`);
  lines.push(`**URL:** ${meta.canonicalUrl}`);
  return lines.join("\n");
}

function findHeadingByText(needle: string): HTMLElement | null {
  const article = document.querySelector("article");
  if (!article) return null;
  const t = needle.toLowerCase();
  for (const h of Array.from(article.querySelectorAll<HTMLElement>("h2, h3"))) {
    if ((h.textContent ?? "").trim().toLowerCase() === t) return h;
  }
  return null;
}

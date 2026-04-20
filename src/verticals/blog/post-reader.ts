// @agentikas/webmcp-sdk — Post-detail DOM readers (Blog vertical).
// Standards-first: JSON-LD BlogPosting + Open Graph + <meta> + DOM.
// Pure data extraction. Side effects are limited to readToc, which adds
// slugified `id` attributes to anchor-less headings so scroll_to_section
// can resolve them later. Documented + covered by tests.

export interface PostMetadata {
  title: string;
  canonicalUrl: string;
  description: string;
  author: string;
  publishedAt: string;
  modifiedAt?: string;
  image?: string;
  tags: string[];
  siteName?: string;
}

export interface TocEntry {
  level: 2 | 3;
  title: string;
  anchor: string;
}

export interface CodeBlock {
  index: number;
  language: string;
  lineCount: number;
  preview: string;
  code: string;
}

export interface Citation {
  text: string;
  href: string;
}

const DIACRITIC_RE = /\p{Diacritic}/gu;
const NON_ALNUM_RE = /[^a-z0-9]+/g;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITIC_RE, "")
    .toLowerCase()
    .replace(NON_ALNUM_RE, "-")
    .replace(/^-+|-+$/g, "");
}

function text(el: Element | null): string {
  return (el?.textContent ?? "").trim();
}

function metaContent(doc: Document, selector: string): string {
  const el = doc.querySelector<HTMLMetaElement>(selector);
  return el?.getAttribute("content")?.trim() ?? "";
}

function readJsonLdBlogPosting(doc: Document): Record<string, unknown> | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const s of Array.from(scripts)) {
    try {
      const parsed = JSON.parse(s.textContent ?? "");
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of candidates) {
        if (
          node &&
          typeof node === "object" &&
          (node["@type"] === "BlogPosting" ||
            node["@type"] === "Article" ||
            node["@type"] === "NewsArticle")
        ) {
          return node as Record<string, unknown>;
        }
      }
    } catch {
      /* skip invalid JSON-LD */
    }
  }
  return null;
}

function parseKeywords(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function extractAuthor(node: Record<string, unknown>): string {
  const a = node.author;
  if (!a) return "";
  if (typeof a === "string") return a;
  if (typeof a === "object") {
    const name = (a as Record<string, unknown>).name;
    if (typeof name === "string") return name;
  }
  return "";
}

function extractImage(node: Record<string, unknown>): string | undefined {
  const img = node.image;
  if (!img) return undefined;
  if (typeof img === "string") return img;
  if (typeof img === "object") {
    const url = (img as Record<string, unknown>).url;
    if (typeof url === "string") return url;
  }
  return undefined;
}

export function readPostMetadata(doc: Document = document): PostMetadata | null {
  const node = readJsonLdBlogPosting(doc);
  if (node) {
    const mainUrl = (() => {
      const mep = node.mainEntityOfPage;
      if (typeof mep === "object" && mep && typeof (mep as any)["@id"] === "string") {
        return (mep as any)["@id"] as string;
      }
      return undefined;
    })();

    const fallbackUrl =
      doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ||
      metaContent(doc, 'meta[property="og:url"]') ||
      mainUrl ||
      (typeof node.url === "string" ? (node.url as string) : "");

    return {
      title:
        (typeof node.headline === "string" ? (node.headline as string) : "") ||
        (typeof node.name === "string" ? (node.name as string) : "") ||
        text(doc.querySelector("title")),
      canonicalUrl: fallbackUrl,
      description:
        (typeof node.description === "string" ? (node.description as string) : "") ||
        metaContent(doc, 'meta[property="og:description"]') ||
        metaContent(doc, 'meta[name="description"]'),
      author: extractAuthor(node),
      publishedAt: typeof node.datePublished === "string" ? (node.datePublished as string) : "",
      modifiedAt: typeof node.dateModified === "string" ? (node.dateModified as string) : undefined,
      image: extractImage(node),
      tags: parseKeywords(node.keywords),
      siteName: metaContent(doc, 'meta[property="og:site_name"]') || undefined,
    };
  }

  // Fallback path — no JSON-LD BlogPosting, read from meta tags.
  const title = text(doc.querySelector("title"));
  const canonical =
    doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ||
    metaContent(doc, 'meta[property="og:url"]');
  const description =
    metaContent(doc, 'meta[property="og:description"]') ||
    metaContent(doc, 'meta[name="description"]');

  if (!title && !canonical && !description) return null;

  const tags = Array.from(
    doc.querySelectorAll<HTMLMetaElement>('meta[property="article:tag"]'),
  )
    .map((m) => (m.getAttribute("content") ?? "").trim())
    .filter(Boolean);

  return {
    title,
    canonicalUrl: canonical,
    description,
    author: metaContent(doc, 'meta[property="article:author"]'),
    publishedAt: metaContent(doc, 'meta[property="article:published_time"]'),
    modifiedAt: metaContent(doc, 'meta[property="article:modified_time"]') || undefined,
    image: metaContent(doc, 'meta[property="og:image"]') || undefined,
    tags,
    siteName: metaContent(doc, 'meta[property="og:site_name"]') || undefined,
  };
}

export function readPostContent(
  doc: Document = document,
  format: "text" | "html" = "text",
): string {
  const article = doc.querySelector("article");
  if (!article) return "";
  if (format === "html") return article.innerHTML;
  return (article.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function readPostSummary(doc: Document = document): string {
  return (
    metaContent(doc, 'meta[property="og:description"]') ||
    metaContent(doc, 'meta[name="description"]')
  );
}

export function readToc(doc: Document = document): TocEntry[] {
  const article = doc.querySelector("article");
  if (!article) return [];

  const used = new Set<string>();
  const entries: TocEntry[] = [];
  const headings = article.querySelectorAll("h2, h3");

  for (const h of Array.from(headings)) {
    const title = (h.textContent ?? "").trim();
    if (!title) continue;
    const level = h.tagName.toLowerCase() === "h3" ? 3 : 2;

    let anchor = h.getAttribute("id") ?? "";
    if (!anchor) {
      const base = slugify(title) || `section-${entries.length + 1}`;
      anchor = base;
      let i = 2;
      while (used.has(anchor) || doc.getElementById(anchor)) {
        anchor = `${base}-${i++}`;
      }
      h.setAttribute("id", anchor);
    }

    used.add(anchor);
    entries.push({ level: level as 2 | 3, title, anchor });
  }

  return entries;
}

export function readCodeBlocks(doc: Document = document): CodeBlock[] {
  const article = doc.querySelector("article");
  if (!article) return [];

  const nodes = article.querySelectorAll("pre code");
  return Array.from(nodes).map((code, index) => {
    const cls = code.getAttribute("class") ?? "";
    const langMatch = cls.match(/language-([\w-]+)/);
    const language = langMatch?.[1] ?? "";
    const text = code.textContent ?? "";
    const lines = text.split(/\r?\n/);
    return {
      index,
      language,
      lineCount: lines.length,
      preview: text.slice(0, 80),
      code: text,
    };
  });
}

export function readCitations(doc: Document = document): Citation[] {
  const article = doc.querySelector("article");
  if (!article) return [];

  // Prefer window.location.hostname over doc.baseURI — the latter can be
  // "about:blank" in some jsdom contexts, which produces a useless origin.
  const localHost = (() => {
    if (typeof window !== "undefined" && window.location?.hostname) {
      return window.location.hostname;
    }
    try {
      return new URL(doc.baseURI).hostname;
    } catch {
      return "";
    }
  })();

  const seen = new Set<string>();
  const out: Citation[] = [];

  for (const a of Array.from(article.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const href = a.getAttribute("href") ?? "";
    if (!/^https?:\/\//i.test(href)) continue;
    try {
      if (localHost && new URL(href).hostname === localHost) continue;
    } catch {
      continue;
    }
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ text: (a.textContent ?? "").trim(), href });
  }

  return out;
}

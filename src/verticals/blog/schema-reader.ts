// @agentikas/webmcp-sdk — Read schema.org JSON-LD from the DOM
// Extracts Blog and BlogPosting structured data for tool executors

import type { BlogData, BlogInfo, BlogPost } from "./types";

/**
 * Parse all JSON-LD scripts from the document and extract blog data.
 * Works with both Blog (list page) and BlogPosting (single post) types.
 */
export function readBlogSchemaFromDOM(): BlogData {
  if (typeof document === "undefined") {
    return { blog: emptyBlog(), posts: [] };
  }

  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const schemas: any[] = [];

  scripts.forEach((script) => {
    try {
      const parsed = JSON.parse(script.textContent ?? "");
      if (Array.isArray(parsed)) {
        schemas.push(...parsed);
      } else {
        schemas.push(parsed);
      }
    } catch {
      // Skip invalid JSON-LD
    }
  });

  const blog = extractBlogInfo(schemas);
  const posts = extractPosts(schemas);

  return { blog, posts };
}

function extractBlogInfo(schemas: any[]): BlogInfo {
  // Look for Blog type first
  const blogSchema = schemas.find((s) => s["@type"] === "Blog");
  if (blogSchema) {
    return {
      name: blogSchema.name ?? "",
      description: blogSchema.description ?? "",
      url: blogSchema.url ?? "",
      publisher: blogSchema.publisher?.name ?? "",
      logo: blogSchema.publisher?.logo?.url ?? blogSchema.publisher?.logo ?? undefined,
    };
  }

  // Fall back to BlogPosting publisher info
  const posting = schemas.find((s) => s["@type"] === "BlogPosting");
  if (posting) {
    return {
      name: posting.publisher?.name ?? "",
      description: "",
      url: posting.mainEntityOfPage?.["@id"] ?? posting.url ?? "",
      publisher: posting.publisher?.name ?? "",
      logo: posting.publisher?.logo?.url ?? posting.publisher?.logo ?? undefined,
    };
  }

  return emptyBlog();
}

function extractPosts(schemas: any[]): BlogPost[] {
  const posts: BlogPost[] = [];

  // From Blog type with blogPost array
  const blogSchema = schemas.find((s) => s["@type"] === "Blog" && s.blogPost);
  if (blogSchema?.blogPost) {
    for (const p of blogSchema.blogPost) {
      posts.push(normalizeBlogPosting(p));
    }
  }

  // From standalone BlogPosting types
  for (const s of schemas) {
    if (s["@type"] === "BlogPosting" && !posts.some((p) => p.url === (s.url ?? ""))) {
      posts.push(normalizeBlogPosting(s));
    }
  }

  return posts;
}

function normalizeBlogPosting(s: any): BlogPost {
  const url = s.url ?? "";
  const slug = url ? url.split("/").filter(Boolean).pop() ?? "" : "";

  return {
    headline: s.headline ?? s.name ?? "",
    description: s.description ?? "",
    url,
    slug,
    datePublished: s.datePublished ?? "",
    dateModified: s.dateModified ?? undefined,
    author: s.author?.name ?? (typeof s.author === "string" ? s.author : ""),
    image: s.image?.url ?? (typeof s.image === "string" ? s.image : undefined),
    keywords: parseKeywords(s.keywords),
    body: undefined, // Body is in the HTML, not in schema.org
  };
}

function parseKeywords(kw: any): string[] {
  if (!kw) return [];
  if (Array.isArray(kw)) return kw;
  if (typeof kw === "string") return kw.split(",").map((k: string) => k.trim()).filter(Boolean);
  return [];
}

function emptyBlog(): BlogInfo {
  return { name: "", description: "", url: "" };
}

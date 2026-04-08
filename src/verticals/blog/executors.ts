// @agentikas/webmcp-sdk — Blog executors
// Reads from schema.org data extracted from the DOM

import type { ExecutorMap } from "../../types";
import type { BlogData, BlogPost } from "./types";

export const blogExecutors: ExecutorMap<BlogData> = {
  get_blog_info: (data) => () => {
    const b = data?.blog;
    if (!b?.name) {
      return { content: [{ type: "text" as const, text: "No blog data available." }] };
    }

    return {
      content: [{
        type: "text" as const,
        text: `# ${b.name}\n\n${b.description || ""}\n\n` +
          `**URL:** ${b.url}\n` +
          (b.publisher ? `**Publisher:** ${b.publisher}\n` : ""),
      }],
    };
  },

  list_posts: (data) => ({ tag, limit = 10 }: { tag?: string; limit?: number }) => {
    let posts = data?.posts ?? [];

    if (!posts.length) {
      return { content: [{ type: "text" as const, text: "No posts available." }] };
    }

    if (tag) {
      const t = tag.toLowerCase();
      posts = posts.filter((p) =>
        p.keywords.some((k) => k.toLowerCase().includes(t))
      );
    }

    posts = posts.slice(0, limit);

    if (posts.length === 0) {
      return { content: [{ type: "text" as const, text: `No posts found${tag ? ` with tag "${tag}"` : ""}.` }] };
    }

    const list = posts.map(formatPostSummary).join("\n\n---\n\n");
    return { content: [{ type: "text" as const, text: list }] };
  },

  get_post: (data) => ({ slug }: { slug: string }) => {
    const posts = data?.posts ?? [];
    const post = posts.find((p) => p.slug === slug);

    if (!post) {
      return { content: [{ type: "text" as const, text: `Post "${slug}" not found.` }] };
    }

    return {
      content: [{
        type: "text" as const,
        text: formatPostFull(post),
      }],
    };
  },

  search_posts: (data) => ({ query, limit = 10 }: { query: string; limit?: number }) => {
    const posts = data?.posts ?? [];

    if (!query) {
      return { content: [{ type: "text" as const, text: "Search query is required." }] };
    }

    const q = query.toLowerCase();
    const results = posts
      .filter((p) =>
        p.headline.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.keywords.some((k) => k.toLowerCase().includes(q))
      )
      .slice(0, limit);

    if (results.length === 0) {
      return { content: [{ type: "text" as const, text: `No posts found matching "${query}".` }] };
    }

    const list = results.map(formatPostSummary).join("\n\n---\n\n");
    return {
      content: [{
        type: "text" as const,
        text: `Found ${results.length} post(s) matching "${query}":\n\n${list}`,
      }],
    };
  },
};

function formatPostSummary(post: BlogPost): string {
  return `**${post.headline}**\n${post.description}\n` +
    `By ${post.author} · ${post.datePublished}\n` +
    (post.keywords.length > 0 ? `Tags: ${post.keywords.join(", ")}\n` : "") +
    `URL: ${post.url}`;
}

function formatPostFull(post: BlogPost): string {
  return `# ${post.headline}\n\n` +
    `${post.description}\n\n` +
    `**Author:** ${post.author}\n` +
    `**Published:** ${post.datePublished}\n` +
    (post.dateModified ? `**Modified:** ${post.dateModified}\n` : "") +
    (post.keywords.length > 0 ? `**Tags:** ${post.keywords.join(", ")}\n` : "") +
    (post.image ? `**Image:** ${post.image}\n` : "") +
    `**URL:** ${post.url}`;
}

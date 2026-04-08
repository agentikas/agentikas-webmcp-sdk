// @agentikas/webmcp-sdk — Blog tool factories (serializable)

import type { VerticalDefinition, ToolFactory } from "../../types";
import type { BlogData } from "./types";

const bName = (data: any): string => data?.blog?.name || "";
const bLabel = (data: any): string => bName(data) ? ` on ${bName(data)}` : "";

const blogInfo: ToolFactory<BlogData> = (data) => ({
  name: "get_blog_info",
  description: `Returns information about${bLabel(data) || " this blog"}: name, description, publisher, and URL.`,
  input_schema: { type: "object", properties: {}, required: [] },
});

const listPosts: ToolFactory<BlogData> = (data) => {
  const tags = data?.posts
    ? [...new Set(data.posts.flatMap((p) => p.keywords))]
    : [];
  const tagList = tags.length > 0 ? `\n\nAvailable tags: ${tags.join(", ")}` : "";

  return {
    name: "list_posts",
    description:
      `List recent blog posts${bLabel(data)}. Optionally filter by tag.${tagList}`,
    input_schema: {
      type: "object",
      properties: {
        tag: { type: "string", description: "Filter posts by tag/keyword." },
        limit: { type: "number", description: "Max number of posts to return (default 10)." },
      },
      required: [],
    },
  };
};

const getPost: ToolFactory<BlogData> = (data) => ({
  name: "get_post",
  description: `Get the full details of a blog post${bLabel(data)} by its slug. Returns title, description, author, date, tags, and URL.`,
  input_schema: {
    type: "object",
    properties: {
      slug: { type: "string", description: "The URL slug of the post (e.g. 'my-first-post')." },
    },
    required: ["slug"],
  },
});

const searchPosts: ToolFactory<BlogData> = (data) => ({
  name: "search_posts",
  description: `Search blog posts${bLabel(data)} by keyword. Matches against title, description, and tags.`,
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query." },
      limit: { type: "number", description: "Max results (default 10)." },
    },
    required: ["query"],
  },
});

export const blog: VerticalDefinition<BlogData> = {
  id: "blog",
  name: "Blog",
  tools: { blogInfo, listPosts, getPost, searchPosts },
  defaultTools: ["blogInfo", "listPosts", "getPost", "searchPosts"],
};

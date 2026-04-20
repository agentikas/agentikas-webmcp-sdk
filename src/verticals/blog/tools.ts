// @agentikas/webmcp-sdk — Blog tool factories (standards-first, feed-backed).
// All tools are registered always (no page-context detection). Read-only tools
// read from the Atom feed; action tools navigate the current page.

import type { VerticalDefinition, ToolFactory } from "../../types";

type NoData = unknown;

const listPosts: ToolFactory<NoData> = () => ({
  name: "list_posts",
  description:
    "List recent blog posts. Optionally filter by tag, author, or sort order. " +
    "Reads the blog's Atom feed. If filters are provided the user lands on the " +
    "search results page; otherwise the user is taken to the blog home.",
  input_schema: {
    type: "object",
    properties: {
      tag: { type: "string", description: "Filter posts by tag." },
      author: { type: "string", description: "Filter posts by author name (substring match)." },
      limit: { type: "number", description: "Maximum posts to return (default 10)." },
      offset: { type: "number", description: "Pagination offset (default 0)." },
      sort: {
        type: "string",
        description: "Sort order: 'recent' (feed default), 'popular' (by views), 'trending' (by likes).",
        enum: ["recent", "popular", "trending"],
      },
    },
    required: [],
  },
});

const searchPosts: ToolFactory<NoData> = () => ({
  name: "search_posts",
  description:
    "Full-text search over blog posts — matches title, summary, content, and tags. " +
    "Always navigates the user to the search results page so they see the matches.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keywords." },
      limit: { type: "number", description: "Maximum results to return (default 20)." },
    },
    required: ["query"],
  },
});

const getTags: ToolFactory<NoData> = () => ({
  name: "get_tags",
  description:
    "List every distinct tag used in the blog, with the number of posts per tag. " +
    "Read-only: does not change the current page.",
  input_schema: { type: "object", properties: {}, required: [] },
});

const getAuthors: ToolFactory<NoData> = () => ({
  name: "get_authors",
  description:
    "List every distinct author who has published in the blog. Read-only: does not change the page.",
  input_schema: { type: "object", properties: {}, required: [] },
});

const getLatestPost: ToolFactory<NoData> = () => ({
  name: "get_latest_post",
  description:
    "Get the most recently published post and navigate the user to its detail page.",
  input_schema: { type: "object", properties: {}, required: [] },
});

const filterByTag: ToolFactory<NoData> = () => ({
  name: "filter_by_tag",
  description:
    "Apply a tag filter and navigate to the search results page showing only posts with that tag.",
  input_schema: {
    type: "object",
    properties: { tag: { type: "string", description: "The tag to filter by." } },
    required: ["tag"],
  },
});

const setSortOrder: ToolFactory<NoData> = () => ({
  name: "set_sort_order",
  description:
    "Change the blog home's post ordering. 'recent' uses publication date (default); " +
    "'popular' sorts by views; 'trending' sorts by likes. Navigates to the blog home with the chosen sort.",
  input_schema: {
    type: "object",
    properties: {
      order: {
        type: "string",
        description: "The sort order to apply.",
        enum: ["recent", "popular", "trending"],
      },
    },
    required: ["order"],
  },
});

const openPost: ToolFactory<NoData> = () => ({
  name: "open_post",
  description:
    "Navigate to a specific post's detail page by slug. Returns a short summary of the post.",
  input_schema: {
    type: "object",
    properties: { slug: { type: "string", description: "The post's URL slug (e.g. 'my-first-post')." } },
    required: ["slug"],
  },
});

// ── Post-detail tools (read from the current page's DOM + metadata) ──

const getPostMetadata: ToolFactory<NoData> = () => ({
  name: "get_post_metadata",
  description:
    "Get metadata about the post on the current page: title, author, dates, tags, canonical URL, image. " +
    "Reads JSON-LD BlogPosting with fallback to Open Graph + <meta>.",
  input_schema: { type: "object", properties: {}, required: [] },
});

const getPostContent: ToolFactory<NoData> = () => ({
  name: "get_post_content",
  description:
    "Return the full content of the post on the current page. Default format is plain text; pass 'html' to get the inner HTML of the <article>.",
  input_schema: {
    type: "object",
    properties: {
      format: {
        type: "string",
        description: "Return format.",
        enum: ["text", "html"],
      },
    },
    required: [],
  },
});

const getPostSummary: ToolFactory<NoData> = () => ({
  name: "get_post_summary",
  description:
    "Return the short summary (lead / excerpt) of the post on the current page. Reads og:description or <meta name='description'>.",
  input_schema: { type: "object", properties: {}, required: [] },
});

const getTableOfContents: ToolFactory<NoData> = () => ({
  name: "get_table_of_contents",
  description:
    "Return the h2/h3 headings of the post as a table of contents, each with a DOM anchor that scroll_to_section can resolve.",
  input_schema: { type: "object", properties: {}, required: [] },
});

const listCodeBlocks: ToolFactory<NoData> = () => ({
  name: "list_code_blocks",
  description:
    "Enumerate the code blocks in the post: index, language, line count, and a short preview. Use get_code_block to fetch one in full.",
  input_schema: { type: "object", properties: {}, required: [] },
});

const getCodeBlock: ToolFactory<NoData> = () => ({
  name: "get_code_block",
  description:
    "Return the full code of a specific block by index (see list_code_blocks).",
  input_schema: {
    type: "object",
    properties: { index: { type: "number", description: "Zero-based block index." } },
    required: ["index"],
  },
});

const getCitations: ToolFactory<NoData> = () => ({
  name: "get_citations",
  description:
    "Return external links (http/https, different hostname) cited in the post, with anchor text and URL.",
  input_schema: { type: "object", properties: {}, required: [] },
});

const scrollToSection: ToolFactory<NoData> = () => ({
  name: "scroll_to_section",
  description:
    "Scroll the viewport to a named section of the post. Accepts either the anchor id or the heading text.",
  input_schema: {
    type: "object",
    properties: {
      section_id: { type: "string", description: "Anchor id (preferred) or heading text." },
    },
    required: ["section_id"],
  },
});

const copyCodeBlock: ToolFactory<NoData> = () => ({
  name: "copy_code_block",
  description:
    "Copy a code block to the user's clipboard (via the Clipboard API). Takes the block index from list_code_blocks.",
  input_schema: {
    type: "object",
    properties: { index: { type: "number", description: "Zero-based block index." } },
    required: ["index"],
  },
});

const sharePost: ToolFactory<NoData> = () => ({
  name: "share_post",
  description:
    "Share the current post using the Web Share API (native system share sheet). Falls back to copying the URL to the clipboard when the API is unavailable.",
  input_schema: {
    type: "object",
    properties: {
      channel: {
        type: "string",
        description: "Optional channel hint (ignored by most browsers; Web Share sheet picks the target).",
      },
    },
    required: [],
  },
});

export const blog: VerticalDefinition<NoData> = {
  id: "blog",
  name: "Blog",
  tools: {
    listPosts,
    searchPosts,
    getTags,
    getAuthors,
    getLatestPost,
    filterByTag,
    setSortOrder,
    openPost,
    getPostMetadata,
    getPostContent,
    getPostSummary,
    getTableOfContents,
    listCodeBlocks,
    getCodeBlock,
    getCitations,
    scrollToSection,
    copyCodeBlock,
    sharePost,
  },
  defaultTools: [
    "listPosts",
    "searchPosts",
    "getTags",
    "getAuthors",
    "getLatestPost",
    "filterByTag",
    "setSortOrder",
    "openPost",
    "getPostMetadata",
    "getPostContent",
    "getPostSummary",
    "getTableOfContents",
    "listCodeBlocks",
    "getCodeBlock",
    "getCitations",
    "scrollToSection",
    "copyCodeBlock",
    "sharePost",
  ],
};

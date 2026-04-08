// @agentikas/webmcp-sdk — Blog domain types

export interface BlogPost {
  headline: string;
  description: string;
  url: string;
  slug: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  image?: string;
  keywords: string[];
  body?: string;
}

export interface BlogInfo {
  name: string;
  description: string;
  url: string;
  publisher?: string;
  logo?: string;
}

/** Data shape passed to blog tool factories and executors. */
export interface BlogData {
  blog: BlogInfo;
  posts: BlogPost[];
}

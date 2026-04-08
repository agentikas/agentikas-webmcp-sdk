import { describe, it, expect } from "vitest";
import { blogExecutors } from "../src/verticals/blog/executors";
import type { BlogData } from "../src/verticals/blog/types";

const sampleData: BlogData = {
  blog: {
    name: "Agentikas Labs Blog",
    description: "Ideas about the agentic web",
    url: "https://agentikas.blog.agentikas.ai",
    publisher: "Agentikas Labs",
  },
  posts: [
    {
      headline: "WebMCP: el protocolo que está cambiando las reglas",
      description: "Un protocolo abierto de Google y Microsoft",
      url: "https://agentikas.blog.agentikas.ai/webmcp-protocolo",
      slug: "webmcp-protocolo",
      datePublished: "2026-03-21",
      author: "Salva Moreno",
      keywords: ["WebMCP", "Tecnología"],
    },
    {
      headline: "Caso de éxito: Los Granainos",
      description: "Primer restaurante agéntico de España",
      url: "https://agentikas.blog.agentikas.ai/caso-exito",
      slug: "caso-exito",
      datePublished: "2026-03-14",
      author: "Salva Moreno",
      keywords: ["Restaurantes", "WebMCP"],
    },
    {
      headline: "Hotel losing bookings to AI",
      description: "5 signs your hotel is losing reservations",
      url: "https://agentikas.blog.agentikas.ai/hotel-bookings",
      slug: "hotel-bookings",
      datePublished: "2026-03-07",
      author: "Salva Moreno",
      keywords: ["Hoteles", "IA"],
    },
  ],
};

const emptyData: BlogData = { blog: { name: "", description: "", url: "" }, posts: [] };

describe("Blog executors", () => {
  describe("get_blog_info", () => {
    it("returns blog info", () => {
      const exec = blogExecutors.get_blog_info(sampleData);
      const result = exec({});
      expect(result.content[0].text).toContain("Agentikas Labs Blog");
      expect(result.content[0].text).toContain("Ideas about the agentic web");
    });

    it("handles empty data", () => {
      const exec = blogExecutors.get_blog_info(emptyData);
      const result = exec({});
      expect(result.content[0].text).toContain("No blog data available");
    });
  });

  describe("list_posts", () => {
    it("lists all posts", () => {
      const exec = blogExecutors.list_posts(sampleData);
      const result = exec({});
      expect(result.content[0].text).toContain("WebMCP");
      expect(result.content[0].text).toContain("Caso de éxito");
      expect(result.content[0].text).toContain("Hotel losing");
    });

    it("filters by tag", () => {
      const exec = blogExecutors.list_posts(sampleData);
      const result = exec({ tag: "Hoteles" });
      expect(result.content[0].text).toContain("Hotel losing");
      expect(result.content[0].text).not.toContain("Caso de éxito");
    });

    it("respects limit", () => {
      const exec = blogExecutors.list_posts(sampleData);
      const result = exec({ limit: 1 });
      // Should only contain first post
      expect(result.content[0].text).toContain("WebMCP");
      expect(result.content[0].text).not.toContain("Hotel losing");
    });

    it("returns message when no posts match tag", () => {
      const exec = blogExecutors.list_posts(sampleData);
      const result = exec({ tag: "nonexistent" });
      expect(result.content[0].text).toContain("No posts found");
    });

    it("handles empty data", () => {
      const exec = blogExecutors.list_posts(emptyData);
      const result = exec({});
      expect(result.content[0].text).toContain("No posts available");
    });
  });

  describe("get_post", () => {
    it("returns post by slug", () => {
      const exec = blogExecutors.get_post(sampleData);
      const result = exec({ slug: "webmcp-protocolo" });
      expect(result.content[0].text).toContain("WebMCP: el protocolo");
      expect(result.content[0].text).toContain("Salva Moreno");
      expect(result.content[0].text).toContain("2026-03-21");
    });

    it("returns not found for unknown slug", () => {
      const exec = blogExecutors.get_post(sampleData);
      const result = exec({ slug: "does-not-exist" });
      expect(result.content[0].text).toContain("not found");
    });
  });

  describe("search_posts", () => {
    it("searches by title", () => {
      const exec = blogExecutors.search_posts(sampleData);
      const result = exec({ query: "protocolo" });
      expect(result.content[0].text).toContain("WebMCP: el protocolo");
      expect(result.content[0].text).not.toContain("Hotel");
    });

    it("searches by description", () => {
      const exec = blogExecutors.search_posts(sampleData);
      const result = exec({ query: "reservations" });
      expect(result.content[0].text).toContain("Hotel losing");
    });

    it("searches by tag", () => {
      const exec = blogExecutors.search_posts(sampleData);
      const result = exec({ query: "Restaurantes" });
      expect(result.content[0].text).toContain("Caso de éxito");
    });

    it("is case insensitive", () => {
      const exec = blogExecutors.search_posts(sampleData);
      const result = exec({ query: "WEBMCP" });
      expect(result.content[0].text).toContain("Found");
    });

    it("respects limit", () => {
      const exec = blogExecutors.search_posts(sampleData);
      const result = exec({ query: "WebMCP", limit: 1 });
      // Only first match
      expect(result.content[0].text).toContain("1 post(s)");
    });

    it("returns no results message", () => {
      const exec = blogExecutors.search_posts(sampleData);
      const result = exec({ query: "zzzznotfound" });
      expect(result.content[0].text).toContain("No posts found");
    });

    it("requires query", () => {
      const exec = blogExecutors.search_posts(sampleData);
      const result = exec({ query: "" });
      expect(result.content[0].text).toContain("required");
    });
  });
});

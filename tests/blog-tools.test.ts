import { describe, it, expect } from "vitest";
import { blog } from "../src/verticals/blog/tools";
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
  ],
};

const emptyData: BlogData = { blog: { name: "", description: "", url: "" }, posts: [] };

describe("Blog tool factories", () => {
  it("has 4 tools", () => {
    expect(Object.keys(blog.tools)).toHaveLength(4);
  });

  it("has correct vertical id and name", () => {
    expect(blog.id).toBe("blog");
    expect(blog.name).toBe("Blog");
  });

  it("default tools includes all 4", () => {
    expect(blog.defaultTools).toHaveLength(4);
  });

  describe("get_blog_info", () => {
    it("builds tool definition with blog name", () => {
      const tool = blog.tools.blogInfo(sampleData);
      expect(tool.name).toBe("get_blog_info");
      expect(tool.description).toContain("Agentikas Labs Blog");
    });

    it("works with empty data (lazy mode)", () => {
      const tool = blog.tools.blogInfo(emptyData);
      expect(tool.name).toBe("get_blog_info");
      expect(tool.description).toContain("this blog");
    });
  });

  describe("list_posts", () => {
    it("builds tool with tag filter", () => {
      const tool = blog.tools.listPosts(sampleData);
      expect(tool.name).toBe("list_posts");
      expect(tool.input_schema.properties.tag).toBeDefined();
      expect(tool.input_schema.properties.limit).toBeDefined();
    });

    it("includes available tags in description", () => {
      const tool = blog.tools.listPosts(sampleData);
      expect(tool.description).toContain("WebMCP");
      expect(tool.description).toContain("Restaurantes");
    });

    it("works with empty data", () => {
      const tool = blog.tools.listPosts(emptyData);
      expect(tool.name).toBe("list_posts");
    });
  });

  describe("get_post", () => {
    it("requires slug parameter", () => {
      const tool = blog.tools.getPost(sampleData);
      expect(tool.name).toBe("get_post");
      expect(tool.input_schema.required).toContain("slug");
    });
  });

  describe("search_posts", () => {
    it("requires query parameter", () => {
      const tool = blog.tools.searchPosts(sampleData);
      expect(tool.name).toBe("search_posts");
      expect(tool.input_schema.required).toContain("query");
    });
  });
});

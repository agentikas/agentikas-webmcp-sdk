import { describe, it, expect } from "vitest";
import { blog } from "../src/verticals/blog/tools";

describe("Blog vertical catalog", () => {
  it("exposes the full home + post-detail catalog (18 tools, get_blog_info removed)", () => {
    const names = Object.values(blog.tools).map((factory) => factory(undefined).name);
    expect(names.sort()).toEqual(
      [
        // Home (8)
        "filter_by_tag",
        "get_authors",
        "get_latest_post",
        "get_tags",
        "list_posts",
        "open_post",
        "search_posts",
        "set_sort_order",
        // Post detail (10)
        "copy_code_block",
        "get_citations",
        "get_code_block",
        "get_post_content",
        "get_post_metadata",
        "get_post_summary",
        "get_table_of_contents",
        "list_code_blocks",
        "scroll_to_section",
        "share_post",
      ].sort(),
    );
  });

  it("registers every tool in defaultTools so they always load", () => {
    expect(blog.defaultTools).toHaveLength(18);
    for (const key of blog.defaultTools) {
      expect(blog.tools[key]).toBeDefined();
    }
  });

  it("declares vertical id and name", () => {
    expect(blog.id).toBe("blog");
    expect(blog.name).toBe("Blog");
  });

  describe("list_posts schema", () => {
    const tool = blog.tools.listPosts(undefined);
    it("accepts tag, author, limit, offset, sort — all optional", () => {
      expect(tool.input_schema.required ?? []).toEqual([]);
      expect(tool.input_schema.properties.tag).toBeDefined();
      expect(tool.input_schema.properties.author).toBeDefined();
      expect(tool.input_schema.properties.limit).toBeDefined();
      expect(tool.input_schema.properties.offset).toBeDefined();
      expect(tool.input_schema.properties.sort).toBeDefined();
    });

    it("constrains sort with an enum of recent|popular|trending", () => {
      expect(tool.input_schema.properties.sort.enum).toEqual(
        ["recent", "popular", "trending"],
      );
    });
  });

  describe("search_posts schema", () => {
    const tool = blog.tools.searchPosts(undefined);
    it("requires query", () => {
      expect(tool.input_schema.required).toContain("query");
    });
  });

  describe("filter_by_tag schema", () => {
    const tool = blog.tools.filterByTag(undefined);
    it("requires tag", () => {
      expect(tool.input_schema.required).toContain("tag");
    });
  });

  describe("set_sort_order schema", () => {
    const tool = blog.tools.setSortOrder(undefined);
    it("requires order with an enum of recent|popular|trending", () => {
      expect(tool.input_schema.required).toContain("order");
      expect(tool.input_schema.properties.order.enum).toEqual(
        ["recent", "popular", "trending"],
      );
    });
  });

  describe("open_post schema", () => {
    const tool = blog.tools.openPost(undefined);
    it("requires slug", () => {
      expect(tool.input_schema.required).toContain("slug");
    });
  });

  describe("parameterless tools", () => {
    it.each([
      ["getTags", "get_tags"],
      ["getAuthors", "get_authors"],
      ["getLatestPost", "get_latest_post"],
    ])("%s has no required params", (key, expectedName) => {
      const tool = blog.tools[key](undefined);
      expect(tool.name).toBe(expectedName);
      expect(tool.input_schema.required ?? []).toEqual([]);
    });
  });
});

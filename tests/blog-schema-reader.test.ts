import { describe, it, expect, beforeEach } from "vitest";
import { readBlogSchemaFromDOM } from "../src/verticals/blog/schema-reader";

describe("Blog schema reader", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("reads Blog type with blogPost array", () => {
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Test Blog",
      description: "A test blog",
      url: "https://test.blog.agentikas.ai",
      publisher: { "@type": "Organization", name: "Test Org" },
      blogPost: [
        {
          "@type": "BlogPosting",
          headline: "First Post",
          description: "First post desc",
          url: "https://test.blog.agentikas.ai/first-post",
          datePublished: "2026-04-01",
          author: { "@type": "Person", name: "Author" },
          keywords: "tag1, tag2",
        },
      ],
    })}</script>`;

    const data = readBlogSchemaFromDOM();
    expect(data.blog.name).toBe("Test Blog");
    expect(data.blog.publisher).toBe("Test Org");
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].headline).toBe("First Post");
    expect(data.posts[0].slug).toBe("first-post");
    expect(data.posts[0].keywords).toEqual(["tag1", "tag2"]);
  });

  it("reads standalone BlogPosting", () => {
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Solo Post",
      description: "A standalone post",
      url: "https://test.blog.agentikas.ai/solo",
      datePublished: "2026-04-08",
      author: { "@type": "Person", name: "Solo Author" },
      publisher: { "@type": "Organization", name: "Solo Pub" },
      image: "https://example.com/img.jpg",
      keywords: ["WebMCP", "AI"],
      mainEntityOfPage: { "@type": "WebPage", "@id": "https://test.blog.agentikas.ai/solo" },
    })}</script>`;

    const data = readBlogSchemaFromDOM();
    expect(data.blog.publisher).toBe("Solo Pub");
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].headline).toBe("Solo Post");
    expect(data.posts[0].image).toBe("https://example.com/img.jpg");
    expect(data.posts[0].keywords).toEqual(["WebMCP", "AI"]);
  });

  it("extracts slug from URL", () => {
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Test",
      url: "https://test.blog.agentikas.ai/my-awesome-post",
      datePublished: "2026-01-01",
      author: { "@type": "Person", name: "X" },
    })}</script>`;

    const data = readBlogSchemaFromDOM();
    expect(data.posts[0].slug).toBe("my-awesome-post");
  });

  it("handles keywords as comma-separated string", () => {
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Test",
      url: "https://test.com/test",
      datePublished: "2026-01-01",
      author: "Author",
      keywords: "WebMCP, AI, Open Source",
    })}</script>`;

    const data = readBlogSchemaFromDOM();
    expect(data.posts[0].keywords).toEqual(["WebMCP", "AI", "Open Source"]);
  });

  it("handles keywords as array", () => {
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Test",
      url: "https://test.com/test",
      datePublished: "2026-01-01",
      author: "Author",
      keywords: ["A", "B"],
    })}</script>`;

    const data = readBlogSchemaFromDOM();
    expect(data.posts[0].keywords).toEqual(["A", "B"]);
  });

  it("handles author as string instead of object", () => {
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Test",
      url: "https://test.com/t",
      datePublished: "2026-01-01",
      author: "Plain String Author",
    })}</script>`;

    const data = readBlogSchemaFromDOM();
    expect(data.posts[0].author).toBe("Plain String Author");
  });

  it("handles invalid JSON-LD gracefully", () => {
    document.head.innerHTML = `<script type="application/ld+json">not json</script>`;
    const data = readBlogSchemaFromDOM();
    expect(data.blog.name).toBe("");
    expect(data.posts).toHaveLength(0);
  });

  it("handles page with no JSON-LD", () => {
    const data = readBlogSchemaFromDOM();
    expect(data.blog.name).toBe("");
    expect(data.posts).toHaveLength(0);
  });

  it("deduplicates posts from Blog.blogPost and standalone BlogPosting", () => {
    const postData = {
      "@type": "BlogPosting",
      headline: "Same Post",
      url: "https://test.com/same",
      datePublished: "2026-01-01",
      author: "X",
    };

    document.head.innerHTML = `
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "Test",
        blogPost: [postData],
      })}</script>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        ...postData,
      })}</script>
    `;

    const data = readBlogSchemaFromDOM();
    expect(data.posts).toHaveLength(1);
  });
});

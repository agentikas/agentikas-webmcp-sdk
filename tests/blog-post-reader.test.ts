import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  readPostMetadata,
  readPostContent,
  readPostSummary,
  readToc,
  readCodeBlocks,
  readCitations,
} from "../src/verticals/blog/post-reader";

const fixtureHtml = readFileSync(
  resolve(__dirname, "fixtures/blog-post-webmcp.html"),
  "utf-8",
);

function loadFixture(): void {
  // Parse the fixture as a full document and swap in its <head> + <body>
  // without using innerHTML (security hook blocks it). The DOMParser path
  // stays safe because we only mount pre-vetted fixture content.
  const parsed = new DOMParser().parseFromString(fixtureHtml, "text/html");
  document.head.replaceChildren(...Array.from(parsed.head.childNodes).map((n) => document.adoptNode(n as Node)));
  document.body.replaceChildren(...Array.from(parsed.body.childNodes).map((n) => document.adoptNode(n as Node)));
}

function resetDom(): void {
  document.head.replaceChildren();
  document.body.replaceChildren();
}

describe("readPostMetadata", () => {
  beforeEach(() => {
    resetDom();
    loadFixture();
  });

  it("extracts headline + description from JSON-LD BlogPosting", () => {
    const meta = readPostMetadata();
    expect(meta).not.toBeNull();
    expect(meta!.title).toBe(
      "WebMCP: el protocolo que está cambiando las reglas del juego",
    );
    expect(meta!.description).toContain(".well-known/mcp.json");
  });

  it("extracts canonical URL", () => {
    const meta = readPostMetadata();
    expect(meta!.canonicalUrl).toBe(
      "https://agentikas.blog.agentikas.ai/webmcp-protocolo-cambiando-reglas",
    );
  });

  it("extracts author, publishedAt, modifiedAt, image", () => {
    const meta = readPostMetadata();
    expect(meta!.author).toBe("Salva Moreno");
    expect(meta!.publishedAt).toBe("2026-03-21T00:00:00+00:00");
    expect(meta!.modifiedAt).toBe("2026-04-08T13:03:00.640874+00:00");
    expect(meta!.image).toBe("https://cdn.agentikas.ai/blog/webmcp-protocolo.jpg");
  });

  it("extracts tags from JSON-LD keywords (comma-separated string)", () => {
    const meta = readPostMetadata();
    expect(meta!.tags).toEqual(["WebMCP", "Tecnología", "Open Source"]);
  });

  it("returns null when the page has no BlogPosting JSON-LD", () => {
    resetDom();
    expect(readPostMetadata()).toBeNull();
  });

  it("falls back to <title> + <meta name=\"description\"> if JSON-LD is missing", () => {
    resetDom();
    const title = document.createElement("title");
    title.textContent = "Fallback Title";
    document.head.appendChild(title);

    const mDesc = document.createElement("meta");
    mDesc.setAttribute("name", "description");
    mDesc.setAttribute("content", "Fallback description");
    document.head.appendChild(mDesc);

    const mCanonical = document.createElement("link");
    mCanonical.setAttribute("rel", "canonical");
    mCanonical.setAttribute("href", "https://example.test/fallback");
    document.head.appendChild(mCanonical);

    const meta = readPostMetadata();
    expect(meta).not.toBeNull();
    expect(meta!.title).toBe("Fallback Title");
    expect(meta!.description).toBe("Fallback description");
    expect(meta!.canonicalUrl).toBe("https://example.test/fallback");
  });
});

describe("readPostContent", () => {
  beforeEach(() => {
    resetDom();
    loadFixture();
  });

  it("returns the text content of <article>", () => {
    const text = readPostContent();
    expect(text).toContain("En febrero de 2026");
    expect(text).toContain("WebMCP es un protocolo abierto");
    // Whitespace is normalised — no raw tags leak through
    expect(text).not.toContain("<p>");
  });

  it("returns empty string when there is no <article>", () => {
    resetDom();
    expect(readPostContent()).toBe("");
  });

  it("format=\"html\" returns the inner HTML of <article>", () => {
    const html = readPostContent(document, "html");
    expect(html).toContain("<p>");
    expect(html).toContain("<h2>");
  });
});

describe("readPostSummary", () => {
  beforeEach(() => {
    resetDom();
    loadFixture();
  });

  it("prefers og:description when present", () => {
    expect(readPostSummary()).toContain(".well-known/mcp.json");
  });

  it("falls back to <meta name=\"description\"> when og:description is missing", () => {
    resetDom();
    const m = document.createElement("meta");
    m.setAttribute("name", "description");
    m.setAttribute("content", "Plain description");
    document.head.appendChild(m);
    expect(readPostSummary()).toBe("Plain description");
  });

  it("returns empty string when nothing is available", () => {
    resetDom();
    expect(readPostSummary()).toBe("");
  });
});

describe("readToc", () => {
  beforeEach(() => {
    resetDom();
    loadFixture();
  });

  it("returns h2 + h3 headings from <article> with synthesized anchors when ids are absent", () => {
    const toc = readToc();
    expect(toc.length).toBeGreaterThan(0);
    const titles = toc.map((e) => e.title);
    expect(titles).toContain("Cómo funciona");
    expect(titles).toContain("Por qué es diferente a las APIs tradicionales");
    expect(titles).toContain("El ecosistema en 2026");
    expect(titles).toContain("Open source por diseño");
    // Synthesized anchor = slugified title
    const comoFunciona = toc.find((e) => e.title === "Cómo funciona");
    expect(comoFunciona!.anchor).toBe("como-funciona");
  });

  it("mutates the DOM to add ids so scrollIntoView can find the heading later", () => {
    readToc();
    const h2s = document.querySelectorAll("article h2");
    for (const h2 of Array.from(h2s)) {
      expect(h2.getAttribute("id")).toBeTruthy();
    }
  });

  it("respects existing ids when already present", () => {
    resetDom();
    const article = document.createElement("article");
    const h2 = document.createElement("h2");
    h2.setAttribute("id", "my-custom-id");
    h2.textContent = "Hello World";
    article.appendChild(h2);
    document.body.appendChild(article);

    const toc = readToc();
    expect(toc).toEqual([{ level: 2, title: "Hello World", anchor: "my-custom-id" }]);
  });

  it("returns [] when there is no <article>", () => {
    resetDom();
    expect(readToc()).toEqual([]);
  });
});

describe("readCodeBlocks", () => {
  beforeEach(() => {
    resetDom();
    const article = document.createElement("article");
    const pre1 = document.createElement("pre");
    const code1 = document.createElement("code");
    code1.setAttribute("class", "language-js");
    code1.textContent = "const x = 1;\nconst y = 2;\nconsole.log(x + y);";
    pre1.appendChild(code1);
    article.appendChild(pre1);

    const pre2 = document.createElement("pre");
    const code2 = document.createElement("code");
    code2.setAttribute("class", "language-python");
    code2.textContent = "print('hello world')";
    pre2.appendChild(code2);
    article.appendChild(pre2);

    // A <pre><code> without language should still appear, language unknown
    const pre3 = document.createElement("pre");
    const code3 = document.createElement("code");
    code3.textContent = "plain text block";
    pre3.appendChild(code3);
    article.appendChild(pre3);

    document.body.appendChild(article);
  });

  it("lists all <pre><code> blocks inside <article>", () => {
    const blocks = readCodeBlocks();
    expect(blocks).toHaveLength(3);
  });

  it("extracts language from the class attribute", () => {
    const blocks = readCodeBlocks();
    expect(blocks[0].language).toBe("js");
    expect(blocks[1].language).toBe("python");
    expect(blocks[2].language).toBe("");
  });

  it("captures index, line count, preview, and full code", () => {
    const blocks = readCodeBlocks();
    expect(blocks[0].index).toBe(0);
    expect(blocks[0].lineCount).toBe(3);
    expect(blocks[0].code).toContain("console.log");
    expect(blocks[0].preview.length).toBeLessThanOrEqual(80);
  });
});

describe("readCitations", () => {
  beforeEach(() => {
    resetDom();
    const article = document.createElement("article");

    const a1 = document.createElement("a");
    a1.setAttribute("href", "https://example.com/x");
    a1.textContent = "External link";
    article.appendChild(a1);

    const a2 = document.createElement("a");
    a2.setAttribute("href", "https://other.com/y");
    a2.textContent = "Another external";
    article.appendChild(a2);

    // Internal link — filtered out
    const a3 = document.createElement("a");
    a3.setAttribute("href", "/es/some-post");
    a3.textContent = "Internal";
    article.appendChild(a3);

    // Same-origin absolute — filtered out (jsdom default is localhost)
    const a4 = document.createElement("a");
    a4.setAttribute("href", "http://localhost/whatever");
    a4.textContent = "Same origin";
    article.appendChild(a4);

    // Duplicate href — dedupe
    const a5 = document.createElement("a");
    a5.setAttribute("href", "https://example.com/x");
    a5.textContent = "Duplicate";
    article.appendChild(a5);

    document.body.appendChild(article);
  });

  it("returns only external http(s) links inside <article>, deduped", () => {
    const cits = readCitations();
    const hrefs = cits.map((c) => c.href);
    expect(hrefs).toContain("https://example.com/x");
    expect(hrefs).toContain("https://other.com/y");
    expect(hrefs).not.toContain("/es/some-post");
    expect(hrefs).not.toContain("http://localhost/whatever");
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("captures link text", () => {
    const cits = readCitations();
    const ext = cits.find((c) => c.href === "https://example.com/x");
    expect(ext!.text).toBe("External link");
  });

  it("returns [] when there is no <article>", () => {
    resetDom();
    expect(readCitations()).toEqual([]);
  });
});

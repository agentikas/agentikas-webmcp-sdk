import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { blogExecutors } from "../src/verticals/blog/executors";

const fixtureHtml = readFileSync(
  resolve(__dirname, "fixtures/blog-post-webmcp.html"),
  "utf-8",
);

function loadFixture(): void {
  const parsed = new DOMParser().parseFromString(fixtureHtml, "text/html");
  document.head.replaceChildren(
    ...Array.from(parsed.head.childNodes).map((n) => document.adoptNode(n as Node)),
  );
  document.body.replaceChildren(
    ...Array.from(parsed.body.childNodes).map((n) => document.adoptNode(n as Node)),
  );
}

function resetDom(): void {
  document.head.replaceChildren();
  document.body.replaceChildren();
}

function insertCodeBlock(lang: string, text: string): void {
  let article = document.querySelector("article");
  if (!article) {
    article = document.createElement("article");
    document.body.appendChild(article);
  }
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.setAttribute("class", `language-${lang}`);
  code.textContent = text;
  pre.appendChild(code);
  article.appendChild(pre);
}

beforeEach(() => {
  resetDom();
});

describe("get_post_metadata executor", () => {
  it("returns metadata from the current page", async () => {
    loadFixture();
    const run = blogExecutors.get_post_metadata(undefined);
    const result = await run({});
    const text = result.content[0].text;
    expect(text).toContain("WebMCP: el protocolo");
    expect(text).toContain("Salva Moreno");
    expect(text).toContain("2026-03-21");
    expect(text).toContain("Tecnología");
  });

  it("returns a graceful message when the page has no post metadata", async () => {
    const run = blogExecutors.get_post_metadata(undefined);
    const result = await run({});
    expect(result.content[0].text.toLowerCase()).toContain("no post");
  });
});

describe("get_post_content executor", () => {
  it("returns the text content of <article> by default", async () => {
    loadFixture();
    const run = blogExecutors.get_post_content(undefined);
    const result = await run({});
    expect(result.content[0].text).toContain("En febrero de 2026");
    expect(result.content[0].text).not.toContain("<p>");
  });

  it("returns HTML when format=\"html\"", async () => {
    loadFixture();
    const run = blogExecutors.get_post_content(undefined);
    const result = await run({ format: "html" });
    expect(result.content[0].text).toContain("<p>");
  });

  it("returns empty message when there is no <article>", async () => {
    const run = blogExecutors.get_post_content(undefined);
    const result = await run({});
    expect(result.content[0].text.toLowerCase()).toContain("no content");
  });
});

describe("get_post_summary executor", () => {
  it("returns og:description", async () => {
    loadFixture();
    const run = blogExecutors.get_post_summary(undefined);
    const result = await run({});
    expect(result.content[0].text).toContain(".well-known/mcp.json");
  });
});

describe("get_table_of_contents executor", () => {
  it("returns the list of h2 headings with anchors", async () => {
    loadFixture();
    const run = blogExecutors.get_table_of_contents(undefined);
    const result = await run({});
    const text = result.content[0].text;
    expect(text).toContain("Cómo funciona");
    expect(text).toContain("Por qué es diferente");
    expect(text).toContain("#como-funciona");
  });

  it("returns an empty message when there are no headings", async () => {
    const article = document.createElement("article");
    document.body.appendChild(article);
    const run = blogExecutors.get_table_of_contents(undefined);
    const result = await run({});
    expect(result.content[0].text.toLowerCase()).toContain("no section");
  });
});

describe("list_code_blocks executor", () => {
  it("enumerates every <pre><code> block with language + preview", async () => {
    insertCodeBlock("js", "const x = 1;\nconsole.log(x);");
    insertCodeBlock("python", "print('hi')");
    const run = blogExecutors.list_code_blocks(undefined);
    const result = await run({});
    const text = result.content[0].text;
    expect(text).toContain("[0]");
    expect(text).toContain("js");
    expect(text).toContain("[1]");
    expect(text).toContain("python");
  });

  it("returns an empty message when there are no code blocks", async () => {
    loadFixture();
    const run = blogExecutors.list_code_blocks(undefined);
    const result = await run({});
    expect(result.content[0].text.toLowerCase()).toContain("no code");
  });
});

describe("get_code_block executor", () => {
  beforeEach(() => {
    insertCodeBlock("js", "const x = 1;\nconsole.log(x);");
    insertCodeBlock("python", "print('hi')");
  });

  it("returns the full code of a block by index", async () => {
    const run = blogExecutors.get_code_block(undefined);
    const result = await run({ index: 1 });
    expect(result.content[0].text).toContain("print('hi')");
  });

  it("returns an error message when the index is out of range", async () => {
    const run = blogExecutors.get_code_block(undefined);
    const result = await run({ index: 99 });
    expect(result.content[0].text.toLowerCase()).toContain("not found");
  });
});

describe("get_citations executor", () => {
  beforeEach(() => {
    const article = document.createElement("article");
    const a = document.createElement("a");
    a.setAttribute("href", "https://en.wikipedia.org/wiki/Atom_syndication_format");
    a.textContent = "Atom spec";
    article.appendChild(a);
    document.body.appendChild(article);
  });

  it("returns external citations with their text and href", async () => {
    const run = blogExecutors.get_citations(undefined);
    const result = await run({});
    expect(result.content[0].text).toContain("Atom spec");
    expect(result.content[0].text).toContain(
      "https://en.wikipedia.org/wiki/Atom_syndication_format",
    );
  });
});

describe("scroll_to_section executor", () => {
  let scrollSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    loadFixture();
    scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy as unknown as Element["scrollIntoView"];
  });

  it("scrolls to the section identified by its anchor", async () => {
    // Populate ids by reading ToC first (same pattern agents would use).
    await blogExecutors.get_table_of_contents(undefined)({});

    const run = blogExecutors.scroll_to_section(undefined);
    const result = await run({ section_id: "como-funciona" });
    expect(scrollSpy).toHaveBeenCalled();
    expect(result.content[0].text.toLowerCase()).toContain("scrolled");
  });

  it("returns an error when the section is not found", async () => {
    const run = blogExecutors.scroll_to_section(undefined);
    const result = await run({ section_id: "nonexistent-anchor" });
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(result.content[0].text.toLowerCase()).toContain("not found");
  });
});

describe("copy_code_block executor", () => {
  let writeTextSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    insertCodeBlock("js", "alert('copy me');");
    writeTextSpy = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextSpy },
    });
  });

  afterEach(() => {
    delete (navigator as any).clipboard;
  });

  it("calls navigator.clipboard.writeText with the block's code", async () => {
    const run = blogExecutors.copy_code_block(undefined);
    const result = await run({ index: 0 });
    expect(writeTextSpy).toHaveBeenCalledWith("alert('copy me');");
    expect(result.content[0].text.toLowerCase()).toContain("copied");
  });

  it("returns an error when the index is out of range", async () => {
    const run = blogExecutors.copy_code_block(undefined);
    const result = await run({ index: 42 });
    expect(writeTextSpy).not.toHaveBeenCalled();
    expect(result.content[0].text.toLowerCase()).toContain("not found");
  });
});

describe("share_post executor", () => {
  let shareSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    loadFixture();
    shareSpy = vi.fn(async () => {});
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: shareSpy,
    });
  });

  afterEach(() => {
    delete (navigator as any).share;
    delete (navigator as any).clipboard;
  });

  it("calls navigator.share with the post title + canonical URL", async () => {
    const run = blogExecutors.share_post(undefined);
    const result = await run({});
    expect(shareSpy).toHaveBeenCalledOnce();
    const payload = shareSpy.mock.calls[0][0];
    expect(payload.title).toContain("WebMCP");
    expect(payload.url).toContain("webmcp-protocolo-cambiando-reglas");
    expect(result.content[0].text.toLowerCase()).toContain("shared");
  });

  it("falls back to copying the URL when Web Share API is unavailable", async () => {
    delete (navigator as any).share;
    const writeTextSpy = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextSpy },
    });

    const run = blogExecutors.share_post(undefined);
    const result = await run({});
    expect(writeTextSpy).toHaveBeenCalled();
    expect(result.content[0].text.toLowerCase()).toContain("copied");
  });
});

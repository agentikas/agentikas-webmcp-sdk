import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { blogExecutors } from "../src/verticals/blog/executors";
import { invalidateFeedCache } from "../src/verticals/blog/feed-loader";

const fixtureXml = readFileSync(
  resolve(__dirname, "fixtures/blog-feed-atom.xml"),
  "utf-8",
);

function stubFetchOk(xml: string = fixtureXml) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(xml, {
          status: 200,
          headers: { "Content-Type": "application/atom+xml" },
        }),
    ),
  );
}

let originalLocation: Location;
let hrefSpy: ReturnType<typeof vi.fn>;

function installLocationSpy() {
  originalLocation = window.location;
  hrefSpy = vi.fn();
  // @ts-expect-error jsdom lets us reassign
  delete window.location;
  // @ts-expect-error test-only replacement
  window.location = new Proxy(
    { ...originalLocation, href: "http://localhost/es/" },
    {
      set(target, prop, value) {
        if (prop === "href") hrefSpy(value);
        (target as any)[prop] = value;
        return true;
      },
    },
  );
}

function restoreLocation() {
  // @ts-expect-error restore
  window.location = originalLocation;
}

beforeEach(() => {
  invalidateFeedCache();
  installLocationSpy();
  window.history.replaceState({}, "", "/es/");
  stubFetchOk();
});

afterEach(() => {
  restoreLocation();
  vi.unstubAllGlobals();
  invalidateFeedCache();
  delete (window as any).__agentikas_config;
});

describe("list_posts executor", () => {
  it("returns all posts when called with no args", async () => {
    const run = blogExecutors.list_posts(undefined);
    const result = await run({});
    expect(result.content[0].text).toContain(
      "Declarar WebMCP sobre tu blog en 10 minutos",
    );
    expect(result.content[0].text).toContain("Por qué el GTM loader");
  });

  it("filters by tag", async () => {
    const run = blogExecutors.list_posts(undefined);
    const result = await run({ tag: "webmcp" });
    expect(result.content[0].text).toContain("Declarar WebMCP");
    expect(result.content[0].text).not.toContain("GTM loader");
  });

  it("filters by author", async () => {
    const run = blogExecutors.list_posts(undefined);
    const result = await run({ author: "Marta" });
    expect(result.content[0].text).toContain("GTM loader");
    expect(result.content[0].text).not.toContain("10 minutos");
  });

  it("respects limit + offset", async () => {
    const run = blogExecutors.list_posts(undefined);
    const result = await run({ limit: 1 });
    expect(result.content[0].text).toContain("Declarar WebMCP");
    expect(result.content[0].text).not.toContain("GTM loader");
  });

  it("navigates to the blog home when no filters are applied", async () => {
    const run = blogExecutors.list_posts(undefined);
    await run({});
    expect(hrefSpy).toHaveBeenCalledWith("/es");
  });

  it("navigates to /search with filters encoded as querystring when any filter is applied", async () => {
    const run = blogExecutors.list_posts(undefined);
    await run({ tag: "webmcp", author: "Salva" });
    expect(hrefSpy).toHaveBeenCalledOnce();
    const url = hrefSpy.mock.calls[0][0];
    expect(url.startsWith("/es/search?")).toBe(true);
    expect(url).toContain("tag=webmcp");
    expect(url).toContain("author=Salva");
  });
});

describe("search_posts executor", () => {
  it("filters entries by title/summary/content substring", async () => {
    const run = blogExecutors.search_posts(undefined);
    const result = await run({ query: "gtm" });
    expect(result.content[0].text).toContain("GTM loader");
    expect(result.content[0].text).not.toContain("10 minutos");
  });

  it("is case insensitive", async () => {
    const run = blogExecutors.search_posts(undefined);
    const result = await run({ query: "WEBMCP" });
    expect(result.content[0].text).toContain("Declarar WebMCP");
  });

  it("navigates to /search?q=... always", async () => {
    const run = blogExecutors.search_posts(undefined);
    await run({ query: "webmcp" });
    const url = hrefSpy.mock.calls[0][0];
    expect(url.startsWith("/es/search?")).toBe(true);
    expect(url).toContain("q=webmcp");
  });

  it("still navigates on zero results — user lands on the empty state", async () => {
    const run = blogExecutors.search_posts(undefined);
    const result = await run({ query: "zzzzznotfound" });
    expect(result.content[0].text.toLowerCase()).toContain("no posts");
    expect(hrefSpy).toHaveBeenCalledOnce();
  });

  it("returns a helpful message when query is empty (no navigation)", async () => {
    const run = blogExecutors.search_posts(undefined);
    const result = await run({ query: "" });
    expect(result.content[0].text.toLowerCase()).toContain("required");
    expect(hrefSpy).not.toHaveBeenCalled();
  });
});

describe("get_tags executor", () => {
  it("aggregates distinct tags with counts, no navigation", async () => {
    const run = blogExecutors.get_tags(undefined);
    const result = await run({});
    const text = result.content[0].text;
    expect(text).toContain("webmcp");
    expect(text).toContain("gtm");
    expect(text).toContain("tutorial");
    expect(text).toMatch(/\b1\b/);
    expect(hrefSpy).not.toHaveBeenCalled();
  });
});

describe("get_authors executor", () => {
  it("returns distinct authors, no navigation", async () => {
    const run = blogExecutors.get_authors(undefined);
    const result = await run({});
    const text = result.content[0].text;
    expect(text).toContain("Salva");
    expect(text).toContain("Marta");
    expect(hrefSpy).not.toHaveBeenCalled();
  });
});

describe("get_latest_post executor", () => {
  it("returns the first entry and navigates to its detail URL", async () => {
    const run = blogExecutors.get_latest_post(undefined);
    const result = await run({});
    expect(result.content[0].text).toContain("Declarar WebMCP");
    expect(hrefSpy).toHaveBeenCalledWith("/es/webmcp-blog-10-min");
  });
});

describe("filter_by_tag executor", () => {
  it("navigates to /search?tag=X", async () => {
    const run = blogExecutors.filter_by_tag(undefined);
    await run({ tag: "gtm" });
    expect(hrefSpy).toHaveBeenCalledOnce();
    expect(hrefSpy.mock.calls[0][0]).toContain("tag=gtm");
    expect(hrefSpy.mock.calls[0][0].startsWith("/es/search?")).toBe(true);
  });

  it("returns a summary including the filtered post(s)", async () => {
    const run = blogExecutors.filter_by_tag(undefined);
    const result = await run({ tag: "webmcp" });
    expect(result.content[0].text).toContain("Declarar WebMCP");
  });
});

describe("set_sort_order executor", () => {
  it("navigates to /{locale} with ?sort=views for 'popular'", async () => {
    const run = blogExecutors.set_sort_order(undefined);
    await run({ order: "popular" });
    expect(hrefSpy).toHaveBeenCalledWith("/es?sort=views");
  });

  it("navigates with ?sort=likes for 'trending'", async () => {
    const run = blogExecutors.set_sort_order(undefined);
    await run({ order: "trending" });
    expect(hrefSpy).toHaveBeenCalledWith("/es?sort=likes");
  });

  it("navigates to /{locale} with no sort for 'recent' (the default ordering)", async () => {
    const run = blogExecutors.set_sort_order(undefined);
    await run({ order: "recent" });
    expect(hrefSpy).toHaveBeenCalledWith("/es");
  });
});

describe("open_post executor", () => {
  it("navigates to /{locale}/{slug} and returns the post summary", async () => {
    const run = blogExecutors.open_post(undefined);
    const result = await run({ slug: "gtm-loader-distribution" });
    expect(hrefSpy).toHaveBeenCalledWith("/es/gtm-loader-distribution");
    expect(result.content[0].text).toContain("GTM loader");
  });

  it("returns not-found message when slug is unknown (no navigation)", async () => {
    const run = blogExecutors.open_post(undefined);
    const result = await run({ slug: "no-such-post" });
    expect(result.content[0].text.toLowerCase()).toContain("not found");
    expect(hrefSpy).not.toHaveBeenCalled();
  });
});

describe("opt-out via config.navigate=false", () => {
  it("does not navigate when navigate flag is explicitly false", async () => {
    (window as any).__agentikas_config = {
      businessId: "test",
      vertical: "blog",
      navigate: false,
    };
    const run = blogExecutors.search_posts(undefined);
    const result = await run({ query: "webmcp" });
    expect(result.content[0].text).toContain("Declarar WebMCP");
    expect(hrefSpy).not.toHaveBeenCalled();
  });
});

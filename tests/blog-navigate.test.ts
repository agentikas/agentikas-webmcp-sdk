import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCurrentLocale,
  buildHomeUrl,
  buildSearchUrl,
  buildPostUrl,
  navigateTo,
} from "../src/verticals/blog/navigate";

describe("getCurrentLocale", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("returns the first pathname segment when it looks like a locale", () => {
    window.history.replaceState({}, "", "/es/some-post");
    expect(getCurrentLocale()).toBe("es");

    window.history.replaceState({}, "", "/en/search?q=foo");
    expect(getCurrentLocale()).toBe("en");
  });

  it("defaults to 'es' when the pathname has no locale segment", () => {
    window.history.replaceState({}, "", "/");
    expect(getCurrentLocale()).toBe("es");
  });

  it("defaults to 'es' when the first segment is not a 2-letter code", () => {
    window.history.replaceState({}, "", "/search");
    expect(getCurrentLocale()).toBe("es");
  });
});

describe("buildHomeUrl", () => {
  it("returns /{locale}", () => {
    expect(buildHomeUrl("es")).toBe("/es");
    expect(buildHomeUrl("en")).toBe("/en");
  });
});

describe("buildSearchUrl", () => {
  it("returns /{locale}/search with no params when none are passed", () => {
    expect(buildSearchUrl({}, "es")).toBe("/es/search");
  });

  it("includes q, tag, author, sort as querystring params when present", () => {
    const url = buildSearchUrl(
      { q: "ia", tag: "webmcp", author: "Salva", sort: "popular" },
      "es",
    );
    expect(url.startsWith("/es/search?")).toBe(true);
    expect(url).toContain("q=ia");
    expect(url).toContain("tag=webmcp");
    expect(url).toContain("author=Salva");
    expect(url).toContain("sort=popular");
  });

  it("skips empty / undefined params", () => {
    const url = buildSearchUrl({ q: "", tag: "webmcp", author: undefined }, "en");
    expect(url).toBe("/en/search?tag=webmcp");
  });

  it("URL-encodes special characters", () => {
    const url = buildSearchUrl({ q: "hello world & friends" }, "es");
    expect(url).toContain("q=hello+world+%26+friends");
  });
});

describe("buildPostUrl", () => {
  it("returns /{locale}/{slug}", () => {
    expect(buildPostUrl("webmcp-blog", "es")).toBe("/es/webmcp-blog");
    expect(buildPostUrl("gtm-loader", "en")).toBe("/en/gtm-loader");
  });
});

describe("navigateTo", () => {
  let hrefSetter: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    hrefSetter = vi.fn();
    // Replace window.location with a proxy that spies on href assignments.
    // @ts-expect-error jsdom lets us reassign
    delete window.location;
    // @ts-expect-error test-only replacement
    window.location = new Proxy(
      { ...originalLocation, href: "https://test/" },
      {
        set(target, prop, value) {
          if (prop === "href") hrefSetter(value);
          (target as any)[prop] = value;
          return true;
        },
      },
    );
  });

  afterEach(() => {
    // @ts-expect-error restore
    window.location = originalLocation;
    delete (window as any).__agentikas_config;
  });

  it("sets window.location.href to the given URL by default", () => {
    navigateTo("/es/search?q=ia");
    expect(hrefSetter).toHaveBeenCalledWith("/es/search?q=ia");
  });

  it("does not navigate when __agentikas_config.navigate === false", () => {
    (window as any).__agentikas_config = {
      businessId: "test",
      vertical: "blog",
      navigate: false,
    };
    navigateTo("/es/search?q=ia");
    expect(hrefSetter).not.toHaveBeenCalled();
  });

  it("navigates when __agentikas_config exists without navigate flag (default on)", () => {
    (window as any).__agentikas_config = { businessId: "test", vertical: "blog" };
    navigateTo("/es/webmcp-blog");
    expect(hrefSetter).toHaveBeenCalledWith("/es/webmcp-blog");
  });
});

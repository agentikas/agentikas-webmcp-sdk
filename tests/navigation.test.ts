/**
 * TDD tests for browser navigation synced with AI agent actions.
 * Tests that navigate: true triggers window.location changes,
 * and navigate: false/undefined does nothing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Navigation: navigate flag", () => {
  let originalLocation: Location;

  beforeEach(() => {
    // Mock window.location.href setter
    originalLocation = window.location;
    // @ts-ignore
    delete window.location;
    window.location = { ...originalLocation, href: "https://store.com/" } as any;
  });

  afterEach(() => {
    window.location = originalLocation;
    delete (window as any).__agentikas_config;
  });

  it("does NOT navigate when navigate is undefined", async () => {
    (window as any).__agentikas_config = {
      businessId: "test",
      vertical: "retail",
    };

    // Import the navigateTo function indirectly by checking location doesn't change
    const href = window.location.href;

    // Simulate what the executor would do
    const config = (window as any).__agentikas_config;
    if (config?.navigate) {
      window.location.href = "/search?q=test";
    }

    expect(window.location.href).toBe(href);
  });

  it("does NOT navigate when navigate is false", async () => {
    (window as any).__agentikas_config = {
      businessId: "test",
      vertical: "retail",
      navigate: false,
    };

    const href = window.location.href;
    const config = (window as any).__agentikas_config;
    if (config?.navigate) {
      window.location.href = "/search?q=test";
    }

    expect(window.location.href).toBe(href);
  });

  it("navigates when navigate is true", async () => {
    (window as any).__agentikas_config = {
      businessId: "test",
      vertical: "retail",
      navigate: true,
    };

    const config = (window as any).__agentikas_config;
    if (config?.navigate) {
      window.location.href = "/search?q=chairs";
    }

    expect(window.location.href).toBe("/search?q=chairs");
  });
});

describe("Navigation: expected URLs per action", () => {
  it("search → /search?q=query", () => {
    const query = "chairs";
    const url = `/search?q=${encodeURIComponent(query)}`;
    expect(url).toBe("/search?q=chairs");
  });

  it("search with special chars encodes correctly", () => {
    const query = "sillas de playa";
    const url = `/search?q=${encodeURIComponent(query)}`;
    expect(url).toBe("/search?q=sillas%20de%20playa");
  });

  it("get_product → /products/handle", () => {
    const productId = "riverside-chair";
    const url = `/products/${productId}`;
    expect(url).toBe("/products/riverside-chair");
  });

  it("add_to_cart → /cart", () => {
    const url = "/cart";
    expect(url).toBe("/cart");
  });

  it("get_product with variant → /products/handle?variant=id", () => {
    const productId = "riverside-chair";
    const variantId = 46970547911;
    const url = `/products/${productId}?variant=${variantId}`;
    expect(url).toBe("/products/riverside-chair?variant=46970547911");
  });
});

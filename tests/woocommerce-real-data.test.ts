/**
 * Tests using WooCommerce Store API response format.
 * Fixtures follow the documented WooCommerce Store API v1 schema.
 *
 * To capture real fixtures:
 *   curl 'https://STORE.com/wp-json/wc/store/v1/products?search=QUERY' > fixtures/woocommerce-search.json
 *   curl 'https://STORE.com/wp-json/wc/store/v1/products?slug=HANDLE' > fixtures/woocommerce-product.json
 */

import { describe, it, expect } from "vitest";
import { normalizeWooProduct } from "../src/verticals/retail/platforms/woocommerce";

import searchFixture from "./fixtures/woocommerce-search.json";
import productFixture from "./fixtures/woocommerce-product.json";

describe("WooCommerce data: search results", () => {
  it("fixture has products", () => {
    expect(searchFixture.length).toBeGreaterThan(0);
  });

  it("normalizes all search results without crashing", () => {
    for (const raw of searchFixture) {
      const p = normalizeWooProduct(raw as any);
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(typeof p.price).toBe("number");
      expect(p.price).toBeGreaterThan(0);
      expect(typeof p.inStock).toBe("boolean");
    }
  });

  it("Slim Fit Dark Jeans: correct fields", () => {
    const raw = searchFixture.find((p: any) => p.slug === "slim-fit-dark-jeans");
    const p = normalizeWooProduct(raw as any);
    expect(p.id).toBe("slim-fit-dark-jeans");
    expect(p.name).toBe("Slim Fit Dark Jeans");
    expect(p.price).toBe(79.99);
    expect(p.currency).toBe("EUR");
    expect(p.inStock).toBe(true);
  });

  it("converts price from minor units correctly", () => {
    const raw = searchFixture.find((p: any) => p.slug === "classic-white-tshirt");
    const p = normalizeWooProduct(raw as any);
    expect(p.price).toBe(29.99); // 2999 / 100
  });

  it("extracts sizes from attributes", () => {
    const raw = searchFixture.find((p: any) => p.slug === "classic-white-tshirt");
    const p = normalizeWooProduct(raw as any);
    expect(p.sizes).toContain("S");
    expect(p.sizes).toContain("M");
    expect(p.sizes).toContain("L");
  });

  it("extracts color from attributes", () => {
    const raw = searchFixture.find((p: any) => p.slug === "classic-white-tshirt");
    const p = normalizeWooProduct(raw as any);
    expect(p.color).toBe("White");
  });

  it("description strips HTML", () => {
    const raw = searchFixture[0];
    const p = normalizeWooProduct(raw as any);
    if (p.description) {
      expect(p.description).not.toContain("<p>");
    }
  });
});

describe("WooCommerce data: product detail", () => {
  it("normalizes without crashing", () => {
    const p = normalizeWooProduct(productFixture as any);
    expect(p.id).toBe("slim-fit-dark-jeans");
    expect(p.name).toBe("Slim Fit Dark Jeans");
  });

  it("has size attributes", () => {
    const sizeAttr = (productFixture as any).attributes.find((a: any) => a.name === "Size");
    expect(sizeAttr).toBeDefined();
    expect(sizeAttr.terms.length).toBe(4);
  });

  it("extracts all sizes", () => {
    const p = normalizeWooProduct(productFixture as any);
    expect(p.sizes).toEqual(["28", "30", "32", "34"]);
  });

  it("extracts color", () => {
    const p = normalizeWooProduct(productFixture as any);
    expect(p.color).toBe("Dark Blue");
  });

  it("price from minor units", () => {
    const p = normalizeWooProduct(productFixture as any);
    expect(p.price).toBe(79.99);
  });

  it("currency from prices object", () => {
    const p = normalizeWooProduct(productFixture as any);
    expect(p.currency).toBe("EUR");
  });
});

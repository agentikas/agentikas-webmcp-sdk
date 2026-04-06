/**
 * Tests using REAL Shopify API responses captured from mollyjogger.com.
 *
 * These fixtures are real responses — if a test fails, it means the
 * normalizer/executor doesn't handle that platform's actual data format.
 *
 * To add fixtures for a new Shopify store:
 *   curl -s 'https://STORE.com/search/suggest.json?q=QUERY&resources%5Btype%5D=product' > fixtures/shopify-search-QUERY.json
 *   curl -s 'https://STORE.com/products/HANDLE.json' > fixtures/shopify-product-HANDLE.json
 */

import { describe, it, expect } from "vitest";
import { normalizeShopifySearchProduct, normalizeShopifyProduct } from "../src/verticals/retail/platforms/shopify";

// Load real fixtures
import searchFixture from "./fixtures/shopify-search-chair.json";
import productChairFixture from "./fixtures/shopify-product-riverside-chair.json";
import productTshirtFixture from "./fixtures/shopify-product-tshirt.json";

describe("Shopify REAL data: search suggest", () => {
  const products = searchFixture.resources.results.products;

  it("fixture has products", () => {
    expect(products.length).toBeGreaterThan(0);
  });

  it("normalizes search result without crashing", () => {
    for (const raw of products) {
      const p = normalizeShopifySearchProduct(raw as any, "USD");
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(typeof p.price).toBe("number");
      expect(p.price).toBeGreaterThan(0);
      expect(typeof p.inStock).toBe("boolean");
    }
  });

  it("Riverside Chair: correct fields", () => {
    const raw = products.find((p: any) => p.handle === "riverside-chair");
    expect(raw).toBeDefined();
    const p = normalizeShopifySearchProduct(raw as any, "USD");
    expect(p.id).toBe("riverside-chair");
    expect(p.name).toBe("Riverside Chair");
    expect(p.price).toBe(160.00);
    expect(p.currency).toBe("USD");
    expect(p.inStock).toBe(true);
    expect(p.imageUrl).toContain("cdn.shopify.com");
  });

  it("description strips HTML", () => {
    const raw = products[0];
    const p = normalizeShopifySearchProduct(raw as any, "USD");
    if (p.description) {
      expect(p.description).not.toContain("<");
      expect(p.description).not.toContain(">");
    }
  });
});

describe("Shopify REAL data: product detail (Riverside Chair — single option)", () => {
  const raw = (productChairFixture as any).product;

  it("normalizes without crashing", () => {
    const p = normalizeShopifyProduct(raw, "USD");
    expect(p.id).toBe("riverside-chair");
    expect(p.name).toBe("Riverside Chair");
  });

  it("has variants", () => {
    expect(raw.variants.length).toBeGreaterThan(0);
  });

  it("has options", () => {
    expect(raw.options.length).toBeGreaterThan(0);
    // Chair has style variants like "Riverside Teal", "Sundown Brown"
    expect(raw.options[0].values.length).toBeGreaterThan(1);
  });

  it("extracts price from first variant", () => {
    const p = normalizeShopifyProduct(raw, "USD");
    expect(p.price).toBe(160.00);
  });

  it("has images", () => {
    expect(raw.images.length).toBeGreaterThan(0);
    const p = normalizeShopifyProduct(raw, "USD");
    expect(p.imageUrl).toContain("cdn.shopify.com");
  });

  it("description strips HTML", () => {
    const p = normalizeShopifyProduct(raw, "USD");
    expect(p.description).toBeTruthy();
    expect(p.description).not.toContain("<meta");
    expect(p.description).not.toContain("<p>");
  });
});

describe("Shopify REAL data: product detail (T-Shirt — size variants)", () => {
  const raw = (productTshirtFixture as any).product;

  it("normalizes without crashing", () => {
    const p = normalizeShopifyProduct(raw, "USD");
    expect(p.id).toBe("arrowhead-canoe-1922");
    expect(p.name).toBe("Arrowhead Canoe T-Shirt");
  });

  it("has Size option", () => {
    const sizeOption = raw.options.find((o: any) => o.name === "Size");
    expect(sizeOption).toBeDefined();
    expect(sizeOption.values.length).toBeGreaterThan(1);
  });

  it("normalizer extracts sizes", () => {
    const p = normalizeShopifyProduct(raw, "USD");
    expect(p.sizes.length).toBeGreaterThan(0);
    expect(p.sizes).toContain("Medium");
  });

  it("each variant has option1 matching a size", () => {
    const sizeOption = raw.options.find((o: any) => o.name === "Size");
    for (const v of raw.variants) {
      expect(sizeOption.values).toContain(v.option1);
    }
  });

  it("variant prices are valid numbers", () => {
    for (const v of raw.variants) {
      expect(parseFloat(v.price)).toBeGreaterThan(0);
    }
  });
});

describe("Shopify REAL data: search → get_product flow", () => {
  it("search handle matches product detail handle", () => {
    const searchProducts = searchFixture.resources.results.products;
    const chairSearch = searchProducts.find((p: any) => p.handle === "riverside-chair");
    expect(chairSearch).toBeDefined();

    const productDetail = (productChairFixture as any).product;
    expect(productDetail.handle).toBe(chairSearch!.handle);
    expect(productDetail.title).toBe((chairSearch as any).title);
  });

  it("search price matches product detail variant price", () => {
    const searchChair = searchFixture.resources.results.products.find((p: any) => p.handle === "riverside-chair");
    const detailChair = (productChairFixture as any).product;

    const searchPrice = parseFloat((searchChair as any).price);
    const detailPrice = parseFloat(detailChair.variants[0].price);
    expect(searchPrice).toBe(detailPrice);
  });
});

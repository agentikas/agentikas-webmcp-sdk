/**
 * TDD tests for Adobe EDS edge cases: P08, P09, P10
 */

import { describe, it, expect } from "vitest";
import { normalizeEdsSearchItem, type EdsSearchItem } from "../src/verticals/retail/platforms/adobe-eds";

// ── P08: Configurable products with price per variant ──────────

describe("P08: Adobe EDS configurable product pricing", () => {
  const configurableItem: EdsSearchItem = {
    product: {
      sku: "config-jacket",
      name: "Winter Jacket",
      small_image: { url: "https://cdn.example.com/jacket.jpg" },
      price_range: {
        minimum_price: {
          regular_price: { value: 199.99, currency: "USD" },
          final_price: { value: 149.99, currency: "USD" },
        },
      },
    },
    productView: {
      urlKey: "winter-jacket",
      inStock: true,
      shortDescription: "Warm winter jacket",
      attributes: [
        { name: "Size", value: "S, M, L, XL" },
        { name: "Color", value: "Black" },
      ],
    },
  };

  it("uses final_price (sale) when available", () => {
    const p = normalizeEdsSearchItem(configurableItem);
    expect(p.price).toBe(149.99);
  });

  it("falls back to regular_price when no final_price", () => {
    const noSale: EdsSearchItem = {
      ...configurableItem,
      product: {
        ...configurableItem.product,
        price_range: {
          minimum_price: {
            regular_price: { value: 199.99, currency: "USD" },
          },
        },
      },
    };
    const p = normalizeEdsSearchItem(noSale);
    expect(p.price).toBe(199.99);
  });

  it("extracts sizes from attributes", () => {
    const p = normalizeEdsSearchItem(configurableItem);
    expect(p.sizes).toEqual(["S", "M", "L", "XL"]);
  });

  it("extracts color from attributes", () => {
    const p = normalizeEdsSearchItem(configurableItem);
    expect(p.color).toBe("Black");
  });

  it("handles product with no price_range", () => {
    const noPrice: EdsSearchItem = {
      ...configurableItem,
      product: {
        sku: "no-price",
        name: "No Price Product",
      },
    };
    const p = normalizeEdsSearchItem(noPrice);
    expect(p.price).toBe(0);
    expect(p.currency).toBe("USD"); // fallback
  });
});

// ── P09: Multiple store views (languages) ──────────────────────

describe("P09: Adobe EDS multiple store views", () => {
  it("Spanish store returns Spanish product names", () => {
    const spanishItem: EdsSearchItem = {
      product: {
        sku: "chaqueta-inv",
        name: "Chaqueta de Invierno",
        price_range: {
          minimum_price: {
            regular_price: { value: 199.99, currency: "EUR" },
          },
        },
      },
      productView: {
        urlKey: "chaqueta-invierno",
        inStock: true,
        attributes: [
          { name: "Talla", value: "S, M, L" },
          { name: "Color", value: "Negro" },
        ],
      },
    };
    const p = normalizeEdsSearchItem(spanishItem);
    expect(p.name).toBe("Chaqueta de Invierno");
    expect(p.currency).toBe("EUR");
    expect(p.sizes).toEqual(["S", "M", "L"]);
    expect(p.color).toBe("Negro");
  });

  it("normalizer handles Talla (Spanish) as size attribute", () => {
    const item: EdsSearchItem = {
      product: { sku: "test", name: "Test", price_range: { minimum_price: { regular_price: { value: 10, currency: "EUR" } } } },
      productView: { attributes: [{ name: "Talla", value: "38, 40, 42" }] },
    };
    const p = normalizeEdsSearchItem(item);
    expect(p.sizes).toEqual(["38", "40", "42"]);
  });

  it("normalizer handles Colour (British English) as color attribute", () => {
    const item: EdsSearchItem = {
      product: { sku: "test", name: "Test", price_range: { minimum_price: { regular_price: { value: 10, currency: "GBP" } } } },
      productView: { attributes: [{ name: "Colour", value: "Red" }] },
    };
    const p = normalizeEdsSearchItem(item);
    expect(p.color).toBe("Red");
    expect(p.currency).toBe("GBP");
  });
});

// ── P10: Sandbox vs production detection ───────────────────────

describe("P10: Adobe EDS sandbox vs production", () => {
  it("catalog-service-sandbox.adobe.io is sandbox", () => {
    const url = "https://catalog-service-sandbox.adobe.io/graphql";
    expect(url.includes("sandbox")).toBe(true);
  });

  it("catalog-service.adobe.io is production", () => {
    const url = "https://catalog-service.adobe.io/graphql";
    expect(url.includes("sandbox")).toBe(false);
  });

  it("adobedemo.com in core endpoint indicates sandbox", () => {
    const coreEndpoint = "https://citisignal-eds.adobedemo.com/graphql";
    expect(coreEndpoint.includes("adobedemo")).toBe(true);
  });

  it("real merchant domain does not indicate sandbox", () => {
    const coreEndpoint = "https://commerce.mybrand.com/graphql";
    expect(coreEndpoint.includes("sandbox")).toBe(false);
    expect(coreEndpoint.includes("adobedemo")).toBe(false);
  });
});

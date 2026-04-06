/**
 * Tests using REAL Adobe Commerce EDS API responses from CitiSignal sandbox.
 *
 * To capture fixtures:
 *   curl -X POST 'https://catalog-service-sandbox.adobe.io/graphql' \
 *     -H 'Content-Type: application/json' \
 *     -H 'Magento-Environment-Id: ENV_ID' \
 *     -H 'Magento-Store-Code: STORE' \
 *     -H 'x-api-key: storefront-widgets' \
 *     -d '{"query":"...", "variables":{...}}' > fixtures/adobe-eds-search.json
 */

import { describe, it, expect } from "vitest";
import { normalizeEdsSearchItem } from "../src/verticals/retail/platforms/adobe-eds";

import searchFixture from "./fixtures/adobe-eds-search-phone.json";

const items = (searchFixture as any).data?.productSearch?.items ?? [];

describe("Adobe EDS REAL data: search results", () => {
  it("fixture has products", () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it("normalizes all search results without crashing", () => {
    for (const item of items) {
      const p = normalizeEdsSearchItem(item);
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(typeof p.price).toBe("number");
      expect(p.price).toBeGreaterThan(0);
      expect(typeof p.inStock).toBe("boolean");
    }
  });

  it("first result has correct structure", () => {
    const p = normalizeEdsSearchItem(items[0]);
    expect(p.currency).toBe("USD");
    expect(p.imageUrl).toBeTruthy();
  });

  it("Samsung case: correct fields", () => {
    const samsung = items.find((i: any) =>
      i.product.name.includes("Samsung"),
    );
    if (samsung) {
      const p = normalizeEdsSearchItem(samsung);
      expect(p.name).toContain("Samsung");
      expect(p.price).toBe(34.99);
      expect(p.inStock).toBe(true);
    }
  });

  it("description strips HTML from shortDescription", () => {
    for (const item of items) {
      const p = normalizeEdsSearchItem(item);
      if (p.description) {
        expect(p.description).not.toContain("<p>");
        expect(p.description).not.toContain("</p>");
      }
    }
  });

  it("product and productView data combine correctly", () => {
    for (const item of items) {
      // product has sku, name, price_range
      expect(item.product).toBeDefined();
      expect(item.product.sku).toBeTruthy();
      expect(item.product.name).toBeTruthy();

      // productView has urlKey, inStock
      if (item.productView) {
        expect(typeof item.productView.inStock).toBe("boolean");
      }
    }
  });

  it("total_count matches actual results", () => {
    const total = (searchFixture as any).data?.productSearch?.total_count;
    expect(total).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(total);
  });
});

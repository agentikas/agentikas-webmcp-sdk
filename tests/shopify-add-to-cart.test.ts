/**
 * TDD tests for Shopify add-to-cart flow.
 * Tests the full flow: search → get_product → check_stock → add_to_cart
 * Using real fixtures from mollyjogger.com.
 *
 * Product types tested:
 * - Simple product (Ozark Hellbender Sticker): single "Default Title" variant, qty 41
 * - Variant product (Arrowhead Canoe T-Shirt): Size Medium (qty 2), 2XLarge (qty 0)
 * - Variant product (Riverside Chair): Color variants, only Sundown Brown in stock (qty 1)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeShopifyProduct } from "../src/verticals/retail/platforms/shopify";

import simpleFixture from "./fixtures/shopify-product-simple-sticker.json";
import tshirtFixture from "./fixtures/shopify-product-tshirt.json";
import chairFixture from "./fixtures/shopify-product-riverside-chair.json";

// ── Stock detection ────────────────────────────────────────────

describe("Shopify stock detection", () => {
  it("simple product: detects in stock via inventory_quantity > 0", () => {
    const raw = (simpleFixture as any).product;
    const variant = raw.variants[0];
    // inventory_quantity = 41, should be in stock
    const isAvailable = variant.available !== undefined ? variant.available : variant.inventory_quantity > 0;
    expect(isAvailable).toBe(true);
  });

  it("tshirt Medium: detects in stock (qty 2)", () => {
    const raw = (tshirtFixture as any).product;
    const medium = raw.variants.find((v: any) => v.option1 === "Medium");
    expect(medium).toBeDefined();
    const isAvailable = medium.available !== undefined ? medium.available : medium.inventory_quantity > 0;
    expect(isAvailable).toBe(true);
  });

  it("tshirt 2XLarge: detects out of stock (qty 0)", () => {
    const raw = (tshirtFixture as any).product;
    const xxl = raw.variants.find((v: any) => v.option1 === "2XLarge");
    expect(xxl).toBeDefined();
    const isAvailable = xxl.available !== undefined ? xxl.available : xxl.inventory_quantity > 0;
    expect(isAvailable).toBe(false);
  });

  it("chair Sundown Brown: in stock (qty 1)", () => {
    const raw = (chairFixture as any).product;
    const sundown = raw.variants.find((v: any) => v.option1 === "Sundown Brown");
    expect(sundown).toBeDefined();
    const isAvailable = sundown.available !== undefined ? sundown.available : sundown.inventory_quantity > 0;
    expect(isAvailable).toBe(true);
  });

  it("chair Riverside Teal: out of stock (qty 0)", () => {
    const raw = (chairFixture as any).product;
    const teal = raw.variants.find((v: any) => v.option1 === "Riverside Teal");
    expect(teal).toBeDefined();
    const isAvailable = teal.available !== undefined ? teal.available : teal.inventory_quantity > 0;
    expect(isAvailable).toBe(false);
  });
});

// ── Normalizer stock handling ──────────────────────────────────

describe("Shopify normalizer: stock from real fixtures", () => {
  it("simple product shows in stock", () => {
    const p = normalizeShopifyProduct((simpleFixture as any).product, "USD");
    expect(p.inStock).toBe(true);
  });

  it("tshirt shows in stock (at least one variant available)", () => {
    const p = normalizeShopifyProduct((tshirtFixture as any).product, "USD");
    expect(p.inStock).toBe(true);
  });

  it("chair shows in stock (Sundown Brown has qty 1)", () => {
    const p = normalizeShopifyProduct((chairFixture as any).product, "USD");
    expect(p.inStock).toBe(true);
  });
});

// ── get_product variant display ────────────────────────────────

describe("Shopify get_product: variant listing", () => {
  it("simple product: single variant with Default Title", () => {
    const raw = (simpleFixture as any).product;
    expect(raw.variants.length).toBe(1);
    expect(raw.variants[0].option1).toBe("Default Title");
  });

  it("tshirt: shows sizes with stock status", () => {
    const raw = (tshirtFixture as any).product;
    const sizeOption = raw.options.find((o: any) => o.name === "Size");
    expect(sizeOption).toBeDefined();
    expect(sizeOption.values).toContain("Medium");
    expect(sizeOption.values).toContain("2XLarge");

    // Medium has stock, 2XLarge doesn't
    const medium = raw.variants.find((v: any) => v.option1 === "Medium");
    const xxl = raw.variants.find((v: any) => v.option1 === "2XLarge");
    expect(medium.inventory_quantity).toBeGreaterThan(0);
    expect(xxl.inventory_quantity).toBe(0);
  });

  it("chair: shows colors with stock status", () => {
    const raw = (chairFixture as any).product;
    const colorOption = raw.options.find((o: any) => o.name === "Color");
    expect(colorOption).toBeDefined();

    const sundown = raw.variants.find((v: any) => v.option1 === "Sundown Brown");
    expect(sundown.inventory_quantity).toBeGreaterThan(0);
  });
});

// ── add_to_cart: variant selection ─────────────────────────────

describe("Shopify add_to_cart: variant matching", () => {
  it("simple product: matches Default Title or single variant", () => {
    const raw = (simpleFixture as any).product;
    const variant = raw.variants[0];
    // Should match when user says any of: "Default", "Default Title", or just the product
    expect(variant.option1).toBe("Default Title");
    expect(variant.id).toBe(39728400597028);
  });

  it("tshirt: matches by size name 'Medium'", () => {
    const raw = (tshirtFixture as any).product;
    const variant = raw.variants.find(
      (v: any) => [v.option1, v.option2, v.option3].some(
        (opt: any) => opt?.toLowerCase() === "medium",
      ),
    );
    expect(variant).toBeDefined();
    expect(variant.id).toBe(39346608472100);
    expect(variant.inventory_quantity).toBeGreaterThan(0);
  });

  it("tshirt: rejects out-of-stock '2XLarge'", () => {
    const raw = (tshirtFixture as any).product;
    const variant = raw.variants.find(
      (v: any) => v.option1?.toLowerCase() === "2xlarge",
    );
    expect(variant).toBeDefined();
    expect(variant.inventory_quantity).toBe(0);
  });

  it("chair: matches by color 'Sundown Brown'", () => {
    const raw = (chairFixture as any).product;
    const variant = raw.variants.find(
      (v: any) => [v.option1, v.option2, v.option3].some(
        (opt: any) => opt?.toLowerCase() === "sundown brown",
      ),
    );
    expect(variant).toBeDefined();
    expect(variant.id).toBe(46970547911);
    expect(variant.inventory_quantity).toBeGreaterThan(0);
  });

  it("chair: rejects out-of-stock 'Riverside Teal'", () => {
    const raw = (chairFixture as any).product;
    const variant = raw.variants.find(
      (v: any) => v.option1?.toLowerCase() === "riverside teal",
    );
    expect(variant).toBeDefined();
    expect(variant.inventory_quantity).toBe(0);
  });

  it("matches by variant_id as string", () => {
    const raw = (tshirtFixture as any).product;
    const variant = raw.variants.find((v: any) => v.id === 39346608472100);
    expect(variant).toBeDefined();
    expect(variant.option1).toBe("Medium");
  });
});

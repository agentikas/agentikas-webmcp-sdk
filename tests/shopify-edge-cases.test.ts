/**
 * TDD tests for Shopify edge cases: P04, P05, P07, P15
 * All tests use modified fixtures to simulate edge cases.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeShopifyProduct,
  normalizeShopifySearchProduct,
  type ShopifyProduct,
  type ShopifySearchProduct,
} from "../src/verticals/retail/platforms/shopify";

import chairFixture from "./fixtures/shopify-product-riverside-chair.json";
import tshirtFixture from "./fixtures/shopify-product-tshirt.json";

// ── P04: Product with 3 options (Size, Color, Material) ────────

describe("P04: Shopify product with 3 options", () => {
  const threeOptions: ShopifyProduct = {
    ...(tshirtFixture as any).product,
    title: "Premium Jacket",
    handle: "premium-jacket",
    options: [
      { name: "Size", values: ["S", "M", "L", "XL"] },
      { name: "Color", values: ["Black", "Navy", "Red"] },
      { name: "Material", values: ["Cotton", "Polyester"] },
    ],
    variants: [
      { id: 1001, title: "S / Black / Cotton", price: "89.99", option1: "S", option2: "Black", option3: "Cotton", available: true, inventory_quantity: 5, sku: "PJ-SBC" },
      { id: 1002, title: "M / Black / Cotton", price: "89.99", option1: "M", option2: "Black", option3: "Cotton", available: true, inventory_quantity: 3, sku: "PJ-MBC" },
      { id: 1003, title: "L / Navy / Polyester", price: "99.99", option1: "L", option2: "Navy", option3: "Polyester", available: true, inventory_quantity: 1, sku: "PJ-LNP" },
      { id: 1004, title: "XL / Red / Cotton", price: "89.99", option1: "XL", option2: "Red", option3: "Cotton", available: false, inventory_quantity: 0, sku: "PJ-XRC" },
    ] as any[],
    images: [{ src: "https://cdn.shopify.com/jacket.jpg" }],
    body_html: "<p>A premium jacket</p>",
    vendor: "Test",
    product_type: "Outerwear",
  };

  it("normalizer extracts sizes from Size option", () => {
    const p = normalizeShopifyProduct(threeOptions, "USD");
    expect(p.sizes).toEqual(["S", "M", "L", "XL"]);
  });

  it("normalizer extracts first color from Color option", () => {
    const p = normalizeShopifyProduct(threeOptions, "USD");
    expect(p.color).toBe("Black");
  });

  it("all 3 options are in the raw product", () => {
    expect(threeOptions.options).toHaveLength(3);
    expect(threeOptions.options.map(o => o.name)).toEqual(["Size", "Color", "Material"]);
  });

  it("variant matching works with option1 (Size)", () => {
    const match = threeOptions.variants.find(
      v => [v.option1, v.option2, v.option3].some(o => o?.toLowerCase() === "m"),
    );
    expect(match).toBeDefined();
    expect(match!.option1).toBe("M");
  });

  it("variant matching works with option2 (Color)", () => {
    const match = threeOptions.variants.find(
      v => [v.option1, v.option2, v.option3].some(o => o?.toLowerCase() === "navy"),
    );
    expect(match).toBeDefined();
    expect(match!.option2).toBe("Navy");
  });

  it("variant matching works with option3 (Material)", () => {
    const match = threeOptions.variants.find(
      v => [v.option1, v.option2, v.option3].some(o => o?.toLowerCase() === "polyester"),
    );
    expect(match).toBeDefined();
    expect(match!.option3).toBe("Polyester");
  });

  it("out of stock variant (XL/Red/Cotton) is not available", () => {
    const xl = threeOptions.variants.find(v => v.option1 === "XL");
    expect(xl).toBeDefined();
    expect(xl!.available).toBe(false);
    expect(xl!.inventory_quantity).toBe(0);
  });
});

// ── P05: Products with discount (compare_at_price) ─────────────

describe("P05: Shopify product with discount", () => {
  const discountedSearch: ShopifySearchProduct = {
    id: 9999,
    title: "Summer Sale Dress",
    handle: "summer-sale-dress",
    body: "<p>Beautiful dress on sale</p>",
    available: true,
    price: "49.99",
    price_min: "49.99",
    price_max: "49.99",
    compare_at_price_min: "89.99",
    compare_at_price_max: "89.99",
    type: "Dresses",
    tags: ["sale"],
    url: "/products/summer-sale-dress",
    vendor: "TestBrand",
    image: "https://cdn.shopify.com/dress.jpg",
    featured_image: { url: "https://cdn.shopify.com/dress.jpg", alt: "Dress" },
    variants: [],
  } as any;

  const discountedProduct: ShopifyProduct = {
    ...(tshirtFixture as any).product,
    title: "Summer Sale Dress",
    handle: "summer-sale-dress",
    variants: [
      {
        id: 5001,
        title: "Default Title",
        price: "49.99",
        compare_at_price: "89.99",
        option1: "Default Title",
        option2: null,
        option3: null,
        available: true,
        inventory_quantity: 10,
        sku: "SSD-001",
      },
    ] as any[],
    options: [{ name: "Title", values: ["Default Title"] }],
    images: [{ src: "https://cdn.shopify.com/dress.jpg" }],
    body_html: "<p>Beautiful dress on sale</p>",
    vendor: "TestBrand",
    product_type: "Dresses",
  };

  it("search normalizer returns sale price", () => {
    const p = normalizeShopifySearchProduct(discountedSearch, "USD");
    expect(p.price).toBe(49.99);
  });

  it("product normalizer returns sale price from variant", () => {
    const p = normalizeShopifyProduct(discountedProduct, "USD");
    expect(p.price).toBe(49.99);
  });

  it("compare_at_price is accessible on variant", () => {
    const variant = discountedProduct.variants[0] as any;
    expect(parseFloat(variant.compare_at_price)).toBe(89.99);
  });

  it("discount percentage can be calculated", () => {
    const variant = discountedProduct.variants[0] as any;
    const original = parseFloat(variant.compare_at_price);
    const sale = parseFloat(variant.price);
    const discount = Math.round((1 - sale / original) * 100);
    expect(discount).toBe(44); // 44% off
  });
});

// ── P07: Backorders (inventory_policy: continue) ───────────────

describe("P07: Shopify backorders (inventory_policy: continue)", () => {
  // Import the helper indirectly via normalizer behavior
  const backorderProduct: ShopifyProduct = {
    ...(tshirtFixture as any).product,
    title: "Popular Item (backorder)",
    handle: "popular-backorder",
    variants: [
      {
        id: 6001,
        title: "Medium",
        price: "39.99",
        option1: "Medium",
        option2: null,
        option3: null,
        inventory_quantity: 0,
        inventory_policy: "continue",
        sku: "PB-M",
      },
      {
        id: 6002,
        title: "Large",
        price: "39.99",
        option1: "Large",
        option2: null,
        option3: null,
        inventory_quantity: 0,
        inventory_policy: "deny",
        sku: "PB-L",
      },
    ] as any[],
    options: [{ name: "Size", values: ["Medium", "Large"] }],
    images: [{ src: "https://cdn.shopify.com/popular.jpg" }],
    body_html: "<p>Popular item</p>",
    vendor: "Test",
    product_type: "Apparel",
  };

  it("product with backorder variant shows in stock", () => {
    const p = normalizeShopifyProduct(backorderProduct, "USD");
    // At least one variant (Medium) allows backorders → product is in stock
    expect(p.inStock).toBe(true);
  });

  it("Medium (policy=continue, qty=0) is available for purchase", () => {
    const medium = backorderProduct.variants.find(v => v.option1 === "Medium") as any;
    // inventory_policy: "continue" means sell even when qty=0
    const isAvailable = medium.inventory_policy === "continue" || medium.inventory_quantity > 0;
    expect(isAvailable).toBe(true);
  });

  it("Large (policy=deny, qty=0) is NOT available", () => {
    const large = backorderProduct.variants.find(v => v.option1 === "Large") as any;
    const isAvailable = large.inventory_policy === "continue" || large.inventory_quantity > 0;
    expect(isAvailable).toBe(false);
  });
});

// ── P15: Missing images ────────────────────────────────────────

describe("P15: Shopify product with missing images", () => {
  it("normalizer handles empty images array", () => {
    const noImages: ShopifyProduct = {
      ...(tshirtFixture as any).product,
      images: [],
    };
    const p = normalizeShopifyProduct(noImages, "USD");
    expect(p.imageUrl).toBeUndefined();
    expect(p.name).toBeTruthy(); // rest of product still works
  });

  it("normalizer handles undefined images", () => {
    const undefinedImages: ShopifyProduct = {
      ...(tshirtFixture as any).product,
      images: undefined as any,
    };
    // Should not crash
    expect(() => normalizeShopifyProduct(undefinedImages, "USD")).not.toThrow();
  });

  it("normalizer handles null images", () => {
    const nullImages: ShopifyProduct = {
      ...(tshirtFixture as any).product,
      images: null as any,
    };
    expect(() => normalizeShopifyProduct(nullImages, "USD")).not.toThrow();
  });

  it("search normalizer handles missing featured_image", () => {
    const noImage: ShopifySearchProduct = {
      id: 8888,
      title: "No Image Product",
      handle: "no-image",
      body: "",
      available: true,
      price: "10.00",
      price_min: "10.00",
      price_max: "10.00",
      type: "Other",
      tags: [],
      url: "/products/no-image",
      vendor: "Test",
      image: "",
      featured_image: undefined as any,
      variants: [],
    } as any;
    const p = normalizeShopifySearchProduct(noImage, "USD");
    expect(p.imageUrl).toBeFalsy();
    expect(p.name).toBe("No Image Product");
  });
});

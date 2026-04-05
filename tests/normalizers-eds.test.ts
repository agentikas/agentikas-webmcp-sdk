import { describe, it, expect } from "vitest";
import { normalizeEdsProduct, type EdsProductView } from "../src/verticals/retail/platforms/adobe-eds";

const mockProduct: EdsProductView = {
  name: "Wireless Bluetooth Headphones",
  sku: "WBH-100",
  urlKey: "wireless-bluetooth-headphones",
  shortDescription: "<p>Premium noise-cancelling <b>wireless</b> headphones.</p>",
  description: "Full description of the product with many details.",
  priceRange: {
    minimum: {
      regular: { amount: { value: 199.99, currency: "USD" } },
      final: { amount: { value: 149.99, currency: "USD" } },
    },
  },
  images: [
    { url: "https://cdn.example.com/headphones.jpg", label: "Main image" },
    { url: "https://cdn.example.com/headphones-2.jpg", label: "Side view" },
  ],
  attributes: [
    { name: "Color", value: "Black" },
    { name: "Size", value: "Standard, Large" },
    { name: "Brand", value: "AudioMax" },
  ],
  inStock: true,
};

describe("normalizeEdsProduct", () => {
  it("maps basic fields correctly", () => {
    const p = normalizeEdsProduct(mockProduct);
    expect(p.id).toBe("WBH-100");
    expect(p.name).toBe("Wireless Bluetooth Headphones");
    expect(p.currency).toBe("USD");
  });

  it("uses final price (sale) over regular price", () => {
    const p = normalizeEdsProduct(mockProduct);
    expect(p.price).toBe(149.99);
  });

  it("falls back to regular price when no final price", () => {
    const noSale: EdsProductView = {
      ...mockProduct,
      priceRange: { minimum: { regular: { amount: { value: 199.99, currency: "USD" } } } },
    };
    const p = normalizeEdsProduct(noSale);
    expect(p.price).toBe(199.99);
  });

  it("extracts sizes from attributes", () => {
    const p = normalizeEdsProduct(mockProduct);
    expect(p.sizes).toEqual(["Standard", "Large"]);
  });

  it("extracts color from attributes", () => {
    const p = normalizeEdsProduct(mockProduct);
    expect(p.color).toBe("Black");
  });

  it("handles product without attributes", () => {
    const noAttrs: EdsProductView = { ...mockProduct, attributes: undefined };
    const p = normalizeEdsProduct(noAttrs);
    expect(p.sizes).toEqual([]);
    expect(p.color).toBe("");
  });

  it("handles product without images", () => {
    const noImages: EdsProductView = { ...mockProduct, images: undefined };
    const p = normalizeEdsProduct(noImages);
    expect(p.imageUrl).toBeUndefined();
  });

  it("strips HTML from description", () => {
    const p = normalizeEdsProduct(mockProduct);
    expect(p.description).toBe("Premium noise-cancelling wireless headphones.");
    expect(p.description).not.toContain("<");
  });

  it("falls back to description when no shortDescription", () => {
    const noShort: EdsProductView = { ...mockProduct, shortDescription: undefined };
    const p = normalizeEdsProduct(noShort);
    expect(p.description).toBe("Full description of the product with many details.");
  });

  it("maps inStock correctly", () => {
    expect(normalizeEdsProduct(mockProduct).inStock).toBe(true);
    expect(normalizeEdsProduct({ ...mockProduct, inStock: false }).inStock).toBe(false);
  });

  it("defaults inStock to true when undefined", () => {
    const noStock: EdsProductView = { ...mockProduct, inStock: undefined };
    expect(normalizeEdsProduct(noStock).inStock).toBe(true);
  });

  it("currency comes from priceRange, not external detection", () => {
    const eur: EdsProductView = {
      ...mockProduct,
      priceRange: { minimum: { regular: { amount: { value: 50, currency: "EUR" } } } },
    };
    expect(normalizeEdsProduct(eur).currency).toBe("EUR");
  });

  it("handles Spanish size attribute name (Talla)", () => {
    const spanish: EdsProductView = {
      ...mockProduct,
      attributes: [
        { name: "Talla", value: "38, 40, 42" },
        { name: "Color", value: "Negro" },
      ],
    };
    const p = normalizeEdsProduct(spanish);
    expect(p.sizes).toEqual(["38", "40", "42"]);
    expect(p.color).toBe("Negro");
  });
});

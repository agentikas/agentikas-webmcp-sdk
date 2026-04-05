import { describe, it, expect } from "vitest";
import { normalizeEdsSearchItem, type EdsSearchItem } from "../src/verticals/retail/platforms/adobe-eds";

const mockItem: EdsSearchItem = {
  product: {
    sku: "WBH-100",
    name: "Wireless Bluetooth Headphones",
    small_image: { url: "https://cdn.example.com/headphones-sm.jpg" },
    image: { url: "https://cdn.example.com/headphones.jpg" },
    price_range: {
      minimum_price: {
        regular_price: { value: 199.99, currency: "USD" },
        final_price: { value: 149.99, currency: "USD" },
      },
    },
  },
  productView: {
    urlKey: "wireless-bluetooth-headphones",
    inStock: true,
    shortDescription: "<p>Premium noise-cancelling <b>wireless</b> headphones.</p>",
    description: "Full description of the product.",
    attributes: [
      { name: "Color", value: "Black" },
      { name: "Size", value: "Standard, Large" },
    ],
  },
};

describe("normalizeEdsSearchItem", () => {
  it("maps basic fields correctly", () => {
    const p = normalizeEdsSearchItem(mockItem);
    expect(p.id).toBe("WBH-100");
    expect(p.name).toBe("Wireless Bluetooth Headphones");
    expect(p.currency).toBe("USD");
  });

  it("uses final price over regular price", () => {
    const p = normalizeEdsSearchItem(mockItem);
    expect(p.price).toBe(149.99);
  });

  it("falls back to regular price when no final price", () => {
    const noSale: EdsSearchItem = {
      ...mockItem,
      product: {
        ...mockItem.product,
        price_range: { minimum_price: { regular_price: { value: 199.99, currency: "USD" } } },
      },
    };
    const p = normalizeEdsSearchItem(noSale);
    expect(p.price).toBe(199.99);
  });

  it("extracts sizes from productView attributes", () => {
    const p = normalizeEdsSearchItem(mockItem);
    expect(p.sizes).toEqual(["Standard", "Large"]);
  });

  it("extracts color from productView attributes", () => {
    const p = normalizeEdsSearchItem(mockItem);
    expect(p.color).toBe("Black");
  });

  it("handles missing productView", () => {
    const noView: EdsSearchItem = { product: mockItem.product };
    const p = normalizeEdsSearchItem(noView);
    expect(p.sizes).toEqual([]);
    expect(p.color).toBe("");
    expect(p.inStock).toBe(true);
  });

  it("handles missing attributes", () => {
    const noAttrs: EdsSearchItem = {
      ...mockItem,
      productView: { ...mockItem.productView, attributes: undefined },
    };
    const p = normalizeEdsSearchItem(noAttrs);
    expect(p.sizes).toEqual([]);
    expect(p.color).toBe("");
  });

  it("prefers image over small_image", () => {
    const p = normalizeEdsSearchItem(mockItem);
    expect(p.imageUrl).toBe("https://cdn.example.com/headphones.jpg");
  });

  it("falls back to small_image when no image", () => {
    const noImage: EdsSearchItem = {
      ...mockItem,
      product: { ...mockItem.product, image: undefined },
    };
    const p = normalizeEdsSearchItem(noImage);
    expect(p.imageUrl).toBe("https://cdn.example.com/headphones-sm.jpg");
  });

  it("strips HTML from description", () => {
    const p = normalizeEdsSearchItem(mockItem);
    expect(p.description).toBe("Premium noise-cancelling wireless headphones.");
    expect(p.description).not.toContain("<");
  });

  it("maps inStock correctly", () => {
    expect(normalizeEdsSearchItem(mockItem).inStock).toBe(true);
    const oos: EdsSearchItem = {
      ...mockItem,
      productView: { ...mockItem.productView, inStock: false },
    };
    expect(normalizeEdsSearchItem(oos).inStock).toBe(false);
  });

  it("currency comes from price_range", () => {
    const eur: EdsSearchItem = {
      ...mockItem,
      product: {
        ...mockItem.product,
        price_range: { minimum_price: { regular_price: { value: 50, currency: "EUR" } } },
      },
    };
    expect(normalizeEdsSearchItem(eur).currency).toBe("EUR");
  });

  it("handles Spanish attribute names", () => {
    const spanish: EdsSearchItem = {
      ...mockItem,
      productView: {
        ...mockItem.productView,
        attributes: [
          { name: "Talla", value: "38, 40, 42" },
          { name: "Color", value: "Negro" },
        ],
      },
    };
    const p = normalizeEdsSearchItem(spanish);
    expect(p.sizes).toEqual(["38", "40", "42"]);
    expect(p.color).toBe("Negro");
  });
});

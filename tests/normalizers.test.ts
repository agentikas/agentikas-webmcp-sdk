import { describe, it, expect, afterEach } from "vitest";
import { normalizeShopifyProduct, detectShopifyCurrency, type ShopifyProduct } from "../src/verticals/retail/platforms/shopify";
import { normalizeWooProduct, type WooProduct } from "../src/verticals/retail/platforms/woocommerce";
import { normalizeAdobeProduct, detectAdobeCurrency, type AdobeProduct } from "../src/verticals/retail/platforms/adobe";

// ── Shopify ────────────────────────────────────────────────────

const shopifyRaw: ShopifyProduct = {
  id: 12345,
  title: "Classic White T-Shirt",
  handle: "classic-white-tshirt",
  body_html: "<p>A comfortable <b>cotton</b> t-shirt for everyday wear.</p>",
  vendor: "Urban Style",
  product_type: "T-Shirts",
  variants: [
    { id: 1, title: "S / White", price: "29.99", option1: "S", option2: "White", option3: null, available: true, sku: "TS-W-S" },
    { id: 2, title: "M / White", price: "29.99", option1: "M", option2: "White", option3: null, available: true, sku: "TS-W-M" },
    { id: 3, title: "L / White", price: "29.99", option1: "L", option2: "White", option3: null, available: true, sku: "TS-W-L" },
    { id: 4, title: "XL / White", price: "29.99", option1: "XL", option2: "White", option3: null, available: false, sku: "TS-W-XL" },
  ],
  options: [
    { name: "Size", values: ["S", "M", "L", "XL"] },
    { name: "Color", values: ["White"] },
  ],
  images: [{ src: "https://cdn.shopify.com/tshirt.jpg" }],
};

describe("normalizeShopifyProduct", () => {
  it("maps basic fields correctly", () => {
    const p = normalizeShopifyProduct(shopifyRaw, "EUR");
    expect(p.id).toBe("classic-white-tshirt");
    expect(p.name).toBe("Classic White T-Shirt");
    expect(p.price).toBe(29.99);
    expect(p.currency).toBe("EUR");
  });

  it("extracts sizes from Size option", () => {
    const p = normalizeShopifyProduct(shopifyRaw);
    expect(p.sizes).toEqual(["S", "M", "L", "XL"]);
  });

  it("extracts color from Color option", () => {
    const p = normalizeShopifyProduct(shopifyRaw);
    expect(p.color).toBe("White");
  });

  it("inStock is true if any variant is available", () => {
    const p = normalizeShopifyProduct(shopifyRaw);
    expect(p.inStock).toBe(true);
  });

  it("inStock is false when no variants are available", () => {
    const outOfStock: ShopifyProduct = {
      ...shopifyRaw,
      variants: shopifyRaw.variants.map((v) => ({ ...v, available: false })),
    };
    const p = normalizeShopifyProduct(outOfStock);
    expect(p.inStock).toBe(false);
  });

  it("strips HTML from description", () => {
    const p = normalizeShopifyProduct(shopifyRaw);
    expect(p.description).toBe("A comfortable cotton t-shirt for everyday wear.");
    expect(p.description).not.toContain("<");
  });

  it("extracts image URL", () => {
    const p = normalizeShopifyProduct(shopifyRaw);
    expect(p.imageUrl).toBe("https://cdn.shopify.com/tshirt.jpg");
  });

  it("handles product with no options", () => {
    const noOptions: ShopifyProduct = { ...shopifyRaw, options: [] };
    const p = normalizeShopifyProduct(noOptions);
    expect(p.sizes).toEqual([]);
    expect(p.color).toBe("");
  });

  it("handles Spanish option names (Talla)", () => {
    const spanish: ShopifyProduct = {
      ...shopifyRaw,
      options: [
        { name: "Talla", values: ["38", "40", "42"] },
        { name: "Color", values: ["Negro"] },
      ],
    };
    const p = normalizeShopifyProduct(spanish);
    expect(p.sizes).toEqual(["38", "40", "42"]);
    expect(p.color).toBe("Negro");
  });
});

// ── WooCommerce ────────────────────────────────────────────────

const wooRaw: WooProduct = {
  id: 456,
  name: "Slim Fit Dark Jeans",
  slug: "slim-fit-dark-jeans",
  description: "<p>Premium denim jeans with a modern slim fit.</p>",
  short_description: "<p>Slim fit jeans in dark blue denim.</p>",
  prices: {
    price: "7999",
    currency_code: "EUR",
    currency_minor_unit: 2,
  },
  images: [{ src: "https://store.example.com/jeans.jpg", alt: "Dark Jeans" }],
  attributes: [
    { id: 1, name: "Size", taxonomy: "pa_size", has_variations: true, terms: [{ id: 10, name: "28", slug: "28" }, { id: 11, name: "30", slug: "30" }, { id: 12, name: "32", slug: "32" }] },
    { id: 2, name: "Color", taxonomy: "pa_color", has_variations: true, terms: [{ id: 20, name: "Dark Blue", slug: "dark-blue" }] },
  ],
  is_in_stock: true,
  is_purchasable: true,
};

describe("normalizeWooProduct", () => {
  it("maps basic fields correctly", () => {
    const p = normalizeWooProduct(wooRaw);
    expect(p.id).toBe("slim-fit-dark-jeans");
    expect(p.name).toBe("Slim Fit Dark Jeans");
    expect(p.currency).toBe("EUR");
  });

  it("converts price from minor units (7999 → 79.99)", () => {
    const p = normalizeWooProduct(wooRaw);
    expect(p.price).toBe(79.99);
  });

  it("handles 0 minor units (price in whole units)", () => {
    const whole: WooProduct = { ...wooRaw, prices: { ...wooRaw.prices, price: "80", currency_minor_unit: 0 } };
    const p = normalizeWooProduct(whole);
    expect(p.price).toBe(80);
  });

  it("handles 3 minor units (1000 = 1.000)", () => {
    const threeDecimals: WooProduct = { ...wooRaw, prices: { ...wooRaw.prices, price: "79990", currency_minor_unit: 3 } };
    const p = normalizeWooProduct(threeDecimals);
    expect(p.price).toBeCloseTo(79.99, 2);
  });

  it("extracts sizes from attributes", () => {
    const p = normalizeWooProduct(wooRaw);
    expect(p.sizes).toEqual(["28", "30", "32"]);
  });

  it("extracts color from attributes", () => {
    const p = normalizeWooProduct(wooRaw);
    expect(p.color).toBe("Dark Blue");
  });

  it("maps is_in_stock directly", () => {
    const p = normalizeWooProduct(wooRaw);
    expect(p.inStock).toBe(true);

    const oos: WooProduct = { ...wooRaw, is_in_stock: false };
    expect(normalizeWooProduct(oos).inStock).toBe(false);
  });

  it("strips HTML from short_description", () => {
    const p = normalizeWooProduct(wooRaw);
    expect(p.description).toBe("Slim fit jeans in dark blue denim.");
  });

  it("uses numeric ID as fallback when slug is empty", () => {
    const noSlug: WooProduct = { ...wooRaw, slug: "" };
    const p = normalizeWooProduct(noSlug);
    expect(p.id).toBe("456");
  });
});

// ── Adobe Commerce ─────────────────────────────────────────────

const adobeRaw: AdobeProduct = {
  id: 789,
  sku: "LBJ-BLK",
  name: "Leather Biker Jacket",
  price: 199.99,
  status: 1,
  type_id: "configurable",
  custom_attributes: [
    { attribute_code: "short_description", value: "<p>Premium leather jacket with asymmetric zip.</p>" },
    { attribute_code: "color", value: "Black" },
  ],
  media_gallery_entries: [{ file: "/l/b/lbj-black.jpg" }],
  extension_attributes: {
    configurable_product_options: [
      { attribute_id: "141", label: "Size", values: [{ value_index: 1, label: "M" }, { value_index: 2, label: "L" }] },
      { attribute_id: "93", label: "Color", values: [{ value_index: 10, label: "Black" }] },
    ],
    stock_item: { is_in_stock: true, qty: 5 },
  },
};

describe("normalizeAdobeProduct", () => {
  it("maps basic fields correctly", () => {
    const p = normalizeAdobeProduct(adobeRaw, "EUR");
    expect(p.id).toBe("LBJ-BLK");
    expect(p.name).toBe("Leather Biker Jacket");
    expect(p.price).toBe(199.99);
    expect(p.currency).toBe("EUR");
  });

  it("extracts sizes from configurable_product_options", () => {
    const p = normalizeAdobeProduct(adobeRaw);
    expect(p.sizes).toEqual(["M", "L"]);
  });

  it("extracts color from configurable_product_options", () => {
    const p = normalizeAdobeProduct(adobeRaw);
    expect(p.color).toBe("Black");
  });

  it("falls back to custom_attributes for color", () => {
    const noConfigColor: AdobeProduct = {
      ...adobeRaw,
      extension_attributes: {
        ...adobeRaw.extension_attributes,
        configurable_product_options: [
          { attribute_id: "141", label: "Size", values: [{ value_index: 1, label: "M" }] },
          // No color option
        ],
      },
    };
    const p = normalizeAdobeProduct(noConfigColor);
    expect(p.color).toBe("Black"); // from custom_attributes
  });

  it("uses stock_item.is_in_stock", () => {
    const p = normalizeAdobeProduct(adobeRaw);
    expect(p.inStock).toBe(true);

    const oos: AdobeProduct = {
      ...adobeRaw,
      extension_attributes: {
        ...adobeRaw.extension_attributes,
        stock_item: { is_in_stock: false, qty: 0 },
      },
    };
    expect(normalizeAdobeProduct(oos).inStock).toBe(false);
  });

  it("falls back to status=1 when no stock_item", () => {
    const noStock: AdobeProduct = {
      ...adobeRaw,
      extension_attributes: { configurable_product_options: adobeRaw.extension_attributes?.configurable_product_options },
    };
    const p = normalizeAdobeProduct(noStock);
    expect(p.inStock).toBe(true); // status: 1
  });

  it("strips HTML from short_description", () => {
    const p = normalizeAdobeProduct(adobeRaw);
    expect(p.description).toBe("Premium leather jacket with asymmetric zip.");
  });

  it("handles product with no configurable options", () => {
    const simple: AdobeProduct = {
      ...adobeRaw,
      type_id: "simple",
      extension_attributes: { stock_item: { is_in_stock: true, qty: 10 } },
    };
    const p = normalizeAdobeProduct(simple);
    expect(p.sizes).toEqual([]);
    expect(p.color).toBe("Black"); // from custom_attributes
  });

  it("uses value_index as fallback when label is missing", () => {
    const noLabels: AdobeProduct = {
      ...adobeRaw,
      extension_attributes: {
        ...adobeRaw.extension_attributes,
        configurable_product_options: [
          { attribute_id: "141", label: "Size", values: [{ value_index: 38 }, { value_index: 40 }] },
        ],
      },
    };
    const p = normalizeAdobeProduct(noLabels);
    expect(p.sizes).toEqual(["38", "40"]);
  });
});

// ── Currency detection ─────────────────────────────────────────

describe("detectShopifyCurrency", () => {
  afterEach(() => {
    delete (window as any).Shopify;
  });

  it("returns currency from window.Shopify.currency.active", () => {
    (window as any).Shopify = { currency: { active: "USD" } };
    expect(detectShopifyCurrency()).toBe("USD");
  });

  it("returns GBP when set", () => {
    (window as any).Shopify = { currency: { active: "GBP" } };
    expect(detectShopifyCurrency()).toBe("GBP");
  });

  it("returns fallback when Shopify object not present", () => {
    expect(detectShopifyCurrency()).toBe("EUR");
  });

  it("returns custom fallback", () => {
    expect(detectShopifyCurrency("JPY")).toBe("JPY");
  });

  it("normalizer auto-detects currency from Shopify global", () => {
    (window as any).Shopify = { currency: { active: "USD" } };
    const p = normalizeShopifyProduct(shopifyRaw); // no currency param
    expect(p.currency).toBe("USD");
  });

  it("normalizer uses explicit currency over auto-detected", () => {
    (window as any).Shopify = { currency: { active: "USD" } };
    const p = normalizeShopifyProduct(shopifyRaw, "GBP");
    expect(p.currency).toBe("GBP");
  });
});

describe("detectAdobeCurrency", () => {
  afterEach(() => {
    delete (window as any).checkout;
    delete (window as any).BASE_CURRENCY_CODE;
  });

  it("returns currency from window.checkout.baseCurrencyCode", () => {
    (window as any).checkout = { baseCurrencyCode: "USD" };
    expect(detectAdobeCurrency()).toBe("USD");
  });

  it("returns currency from window.BASE_CURRENCY_CODE", () => {
    (window as any).BASE_CURRENCY_CODE = "GBP";
    expect(detectAdobeCurrency()).toBe("GBP");
  });

  it("prefers checkout over BASE_CURRENCY_CODE", () => {
    (window as any).checkout = { baseCurrencyCode: "USD" };
    (window as any).BASE_CURRENCY_CODE = "GBP";
    expect(detectAdobeCurrency()).toBe("USD");
  });

  it("returns fallback when nothing present", () => {
    expect(detectAdobeCurrency()).toBe("EUR");
  });

  it("normalizer auto-detects currency from Adobe global", () => {
    (window as any).checkout = { baseCurrencyCode: "MXN" };
    const p = normalizeAdobeProduct(adobeRaw); // no currency param
    expect(p.currency).toBe("MXN");
  });
});

describe("WooCommerce currency (from API, no detection needed)", () => {
  it("uses currency_code from prices object", () => {
    const p = normalizeWooProduct(wooRaw);
    expect(p.currency).toBe("EUR");
  });

  it("preserves USD when set", () => {
    const usd: WooProduct = { ...wooRaw, prices: { ...wooRaw.prices, currency_code: "USD" } };
    const p = normalizeWooProduct(usd);
    expect(p.currency).toBe("USD");
  });

  it("preserves GBP when set", () => {
    const gbp: WooProduct = { ...wooRaw, prices: { ...wooRaw.prices, currency_code: "GBP" } };
    const p = normalizeWooProduct(gbp);
    expect(p.currency).toBe("GBP");
  });
});

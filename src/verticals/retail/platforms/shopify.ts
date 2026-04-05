// @agentikas/webmcp-sdk — Shopify platform adapter for retail
// Normalizes Shopify product JSON → common Product interface

import type { PlatformAdapter } from "../../../types";
import type { Product, RetailData } from "../types";

// ── Shopify raw types (from /products/handle.json) ─────────────

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  variants: ShopifyVariant[];
  options: ShopifyOption[];
  images: Array<{ src: string }>;
}

export interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  available: boolean;
  sku: string;
}

export interface ShopifyOption {
  name: string;
  values: string[];
}

// ── Currency detection ──────────────────────────────────────────

/**
 * Detect the active currency from Shopify's global object.
 * Shopify exposes window.Shopify.currency.active (ISO 4217).
 * Falls back to the provided default or "EUR".
 */
export function detectShopifyCurrency(fallback: string = "EUR"): string {
  try {
    const shopify = (globalThis.window as any)?.Shopify;
    return shopify?.currency?.active ?? fallback;
  } catch {
    return fallback;
  }
}

// ── Normalizer ─────────────────────────────────────────────────

export function normalizeShopifyProduct(raw: ShopifyProduct, currency?: string): Product {
  const resolvedCurrency = currency ?? detectShopifyCurrency();
  const sizeOption = raw.options.find(
    (o) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "talla",
  );
  const colorOption = raw.options.find(
    (o) => o.name.toLowerCase() === "color" || o.name.toLowerCase() === "colour",
  );

  return {
    id: raw.handle,
    name: raw.title,
    price: parseFloat(raw.variants[0]?.price ?? "0"),
    currency: resolvedCurrency,
    sizes: sizeOption?.values ?? [],
    color: colorOption?.values[0] ?? "",
    inStock: raw.variants.some((v) => v.available),
    imageUrl: raw.images[0]?.src,
    description: raw.body_html?.replace(/<[^>]*>/g, "").slice(0, 200) || undefined,
  };
}

// ── Platform adapter ───────────────────────────────────────────

export const shopifyRetailPlatform: PlatformAdapter<RetailData> = {
  id: "shopify",
  name: "Shopify",
  detect: () => !!(globalThis.window as any)?.Shopify,
  executors: {
    search_products: (data) => async ({ query }: { query: string }) => {
      const currency = (data as any)?.store?.currency ?? detectShopifyCurrency();
      const storeName = (data as any)?.store?.name || "";
      const res = await fetch(`/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=10`);
      const json = await res.json();
      const rawProducts: ShopifyProduct[] = json.resources?.results?.products ?? [];
      const products = rawProducts.map((p) => normalizeShopifyProduct(p, currency));
      const inStock = products.filter((p) => p.inStock);

      if (inStock.length === 0) {
        return { content: [{ type: "text" as const, text: `No products found for "${query}" at ${storeName}.` }] };
      }
      const list = inStock.map((p) => `- ${p.name} — ${p.currency} ${p.price.toFixed(2)} | Sizes: ${p.sizes.join(", ")}`).join("\n");
      return { content: [{ type: "text" as const, text: `# Results for "${query}"\n\n${list}` }] };
    },

    get_product: (data) => async ({ product_id }: { product_id: string }) => {
      const currency = (data as any)?.store?.currency ?? detectShopifyCurrency();
      const res = await fetch(`/products/${product_id}.json`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }
      const json = await res.json();
      const product = normalizeShopifyProduct(json.product, currency);
      return {
        content: [{
          type: "text" as const,
          text: `# ${product.name}\n\nPrice: ${product.currency} ${product.price.toFixed(2)}\nSizes: ${product.sizes.join(", ")}\nColor: ${product.color}\nIn stock: ${product.inStock ? "Yes" : "No"}${product.description ? `\n\n${product.description}` : ""}`,
        }],
      };
    },

    check_stock: (data) => async ({ product_id, size }: { product_id: string; size: string }) => {
      const currency = (data as any)?.store?.currency ?? detectShopifyCurrency();
      const res = await fetch(`/products/${product_id}.json`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }
      const json = await res.json();
      const raw: ShopifyProduct = json.product;
      const variant = raw.variants.find(
        (v) => (v.option1?.toLowerCase() === size.toLowerCase() || v.option2?.toLowerCase() === size.toLowerCase()) && v.available,
      );
      if (!variant) {
        const product = normalizeShopifyProduct(raw, currency);
        return { content: [{ type: "text" as const, text: `Size ${size} is not available for ${product.name}. Available: ${product.sizes.join(", ")}` }] };
      }
      return { content: [{ type: "text" as const, text: `${raw.title} in size ${size} is available. Price: ${currency} ${parseFloat(variant.price).toFixed(2)}` }] };
    },

    add_to_cart: (data) => async ({ product_id, size, quantity = 1 }: { product_id: string; size: string; quantity?: number }) => {
      const currency = (data as any)?.store?.currency ?? detectShopifyCurrency();
      const prodRes = await fetch(`/products/${product_id}.json`);
      if (!prodRes.ok) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }
      const json = await prodRes.json();
      const raw: ShopifyProduct = json.product;
      const variant = raw.variants.find(
        (v) => (v.option1?.toLowerCase() === size.toLowerCase() || v.option2?.toLowerCase() === size.toLowerCase()) && v.available,
      );
      if (!variant) {
        return { content: [{ type: "text" as const, text: `${raw.title} in size ${size} is not available.` }] };
      }
      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ id: variant.id, quantity }] }),
      });
      return { content: [{ type: "text" as const, text: `Added ${quantity}x ${raw.title} (size ${size}) to cart. Price: ${currency} ${parseFloat(variant.price).toFixed(2)}` }] };
    },
  },
};

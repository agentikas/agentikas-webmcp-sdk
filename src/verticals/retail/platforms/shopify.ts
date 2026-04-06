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
  available?: boolean;
  inventory_quantity?: number;
  inventory_policy?: string;
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

// ── Shopify search suggest types (from /search/suggest.json) ────

export interface ShopifySearchProduct {
  id: number;
  title: string;
  handle: string;
  body: string;
  available: boolean;
  price: string;
  price_min: string;
  price_max: string;
  type: string;
  tags: string[];
  url: string;
  vendor: string;
  image: string;
  featured_image?: { url: string; alt: string };
  variants: any[];
}

// ── Normalizers ────────────────────────────────────────────────

/** Normalize search suggest result → Product */
export function normalizeShopifySearchProduct(raw: ShopifySearchProduct, currency?: string): Product {
  const resolvedCurrency = currency ?? detectShopifyCurrency();
  return {
    id: raw.handle,
    name: raw.title,
    price: parseFloat(raw.price ?? "0"),
    currency: resolvedCurrency,
    sizes: [],
    color: "",
    inStock: raw.available,
    imageUrl: raw.featured_image?.url ?? raw.image,
    description: raw.body?.replace(/<[^>]*>/g, "").slice(0, 200) || undefined,
  };
}

/** Check if a variant is available (handles both .available and .inventory_quantity) */
function isVariantAvailable(v: ShopifyVariant): boolean {
  if (v.available !== undefined) return v.available;
  if (v.inventory_policy === "continue") return true; // sell when out of stock
  if (v.inventory_quantity !== undefined) return v.inventory_quantity > 0;
  return true; // assume available if no inventory info
}

/** Normalize full product detail → Product (from /products/handle.json) */
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
    inStock: raw.variants.some(isVariantAvailable),
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
      const rawProducts: ShopifySearchProduct[] = json.resources?.results?.products ?? [];
      const products = rawProducts.map((p) => normalizeShopifySearchProduct(p, currency));
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
      const raw: ShopifyProduct = json.product;
      const description = raw.body_html?.replace(/<[^>]*>/g, "").slice(0, 200) || "";

      // Build options summary (e.g. "Size: S, M, L, XL | Color: Red, Blue")
      const optionsSummary = (raw.options ?? [])
        .filter((o) => o.name.toLowerCase() !== "title")
        .map((o) => `${o.name}: ${o.values.join(", ")}`)
        .join("\n");

      // Build variants table with availability and price
      const variantsList = (raw.variants ?? [])
        .map((v) => {
          const options = [v.option1, v.option2, v.option3].filter(Boolean).join(" / ");
          const status = isVariantAvailable(v) ? "In stock" : "Out of stock";
          return `  - ${options || "Default"} — ${currency} ${parseFloat(v.price).toFixed(2)} (${status}) [variant_id: ${v.id}]`;
        })
        .join("\n");

      const hasVariants = raw.variants.length > 1 || (raw.variants.length === 1 && raw.variants[0].title !== "Default Title");

      return {
        content: [{
          type: "text" as const,
          text: `# ${raw.title}\n\n` +
            (description ? `${description}\n\n` : "") +
            (optionsSummary ? `## Options\n${optionsSummary}\n\n` : "") +
            (hasVariants
              ? `## Variants\n${variantsList}\n\nTo add to cart, use add_to_cart with the product_id "${product_id}" and specify the variant option (e.g. size or color).`
              : `Price: ${currency} ${parseFloat(raw.variants[0]?.price ?? "0").toFixed(2)}\nIn stock: ${raw.variants[0]?.available ? "Yes" : "No"}`),
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

      // Match variant by any option (case-insensitive)
      const matching = raw.variants.filter(
        (v) => [v.option1, v.option2, v.option3].some(
          (opt) => opt?.toLowerCase() === size.toLowerCase(),
        ),
      );

      if (matching.length === 0) {
        const allOptions = raw.options
          .filter((o) => o.name.toLowerCase() !== "title")
          .map((o) => `${o.name}: ${o.values.join(", ")}`)
          .join(" | ");
        return { content: [{ type: "text" as const, text: `"${size}" is not a valid option for ${raw.title}. Available: ${allOptions}` }] };
      }

      const available = matching.filter(isVariantAvailable);
      if (available.length === 0) {
        return { content: [{ type: "text" as const, text: `${raw.title} in "${size}" is out of stock.` }] };
      }

      const list = available
        .map((v) => {
          const opts = [v.option1, v.option2, v.option3].filter(Boolean).join(" / ");
          return `  - ${opts} — ${currency} ${parseFloat(v.price).toFixed(2)} [variant_id: ${v.id}]`;
        })
        .join("\n");

      return { content: [{ type: "text" as const, text: `${raw.title} "${size}" available:\n${list}` }] };
    },

    add_to_cart: (data) => async ({ product_id, size, quantity = 1 }: { product_id: string; size: string; quantity?: number }) => {
      const currency = (data as any)?.store?.currency ?? detectShopifyCurrency();
      const prodRes = await fetch(`/products/${product_id}.json`);
      if (!prodRes.ok) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }
      const json = await prodRes.json();
      const raw: ShopifyProduct = json.product;

      // Find matching variant — try exact match on any option, or variant_id if numeric
      let variant = raw.variants.find(
        (v) => [v.option1, v.option2, v.option3].some(
          (opt) => opt?.toLowerCase() === size.toLowerCase(),
        ) && isVariantAvailable(v),
      );

      // If size looks like a variant ID (numeric), match by ID
      if (!variant && /^\d+$/.test(size)) {
        variant = raw.variants.find((v) => v.id === parseInt(size) && isVariantAvailable(v));
      }

      // If only one variant (no options), use it
      if (!variant && raw.variants.length === 1 && isVariantAvailable(raw.variants[0])) {
        variant = raw.variants[0];
      }

      if (!variant) {
        const options = raw.options
          .filter((o) => o.name.toLowerCase() !== "title")
          .map((o) => `${o.name}: ${o.values.join(", ")}`)
          .join(" | ");
        return {
          content: [{
            type: "text" as const,
            text: `Cannot add "${size}" to cart. ${options ? `Available options: ${options}` : "No available variants."}\n\nUse get_product("${product_id}") to see all variants with their variant_ids.`,
          }],
        };
      }

      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ id: variant.id, quantity }] }),
      });

      const opts = [variant.option1, variant.option2, variant.option3].filter(Boolean).join(" / ");
      return {
        content: [{
          type: "text" as const,
          text: `Added ${quantity}x ${raw.title} (${opts || "default"}) to cart. Price: ${currency} ${parseFloat(variant.price).toFixed(2)}`,
        }],
      };
    },
  },
};

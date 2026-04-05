// @agentikas/webmcp-sdk — WooCommerce platform adapter for retail
// Normalizes WooCommerce Store API JSON → common Product interface

import type { PlatformAdapter } from "../../../types";
import type { Product, RetailData } from "../types";

// ── WooCommerce raw types (from /wp-json/wc/store/v1/products) ─

export interface WooProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  prices: {
    price: string;          // In minor units ("2999" = 29.99)
    currency_code: string;
    currency_minor_unit: number;
  };
  images: Array<{ src: string; alt: string }>;
  attributes: WooAttribute[];
  is_in_stock: boolean;
  is_purchasable: boolean;
}

export interface WooAttribute {
  id: number;
  name: string;
  taxonomy: string;
  has_variations: boolean;
  terms: Array<{ id: number; name: string; slug: string }>;
}

// ── Normalizer ─────────────────────────────────────────────────

export function normalizeWooProduct(raw: WooProduct): Product {
  const minorUnit = raw.prices.currency_minor_unit ?? 2;
  const divisor = Math.pow(10, minorUnit);

  const sizeAttr = raw.attributes.find(
    (a) => a.name.toLowerCase() === "size" || a.name.toLowerCase() === "talla",
  );
  const colorAttr = raw.attributes.find(
    (a) => a.name.toLowerCase() === "color" || a.name.toLowerCase() === "colour",
  );

  return {
    id: raw.slug || String(raw.id),
    name: raw.name,
    price: parseInt(raw.prices.price, 10) / divisor,
    currency: raw.prices.currency_code,
    sizes: sizeAttr?.terms.map((t) => t.name) ?? [],
    color: colorAttr?.terms[0]?.name ?? "",
    inStock: raw.is_in_stock,
    imageUrl: raw.images[0]?.src,
    description: raw.short_description?.replace(/<[^>]*>/g, "").slice(0, 200) || undefined,
  };
}

// ── Platform adapter ───────────────────────────────────────────

const WOO_API = "/wp-json/wc/store/v1";

export const woocommerceRetailPlatform: PlatformAdapter<RetailData> = {
  id: "woocommerce",
  name: "WooCommerce",
  detect: () => !!document.querySelector(".woocommerce, .wc-block-grid"),
  executors: {
    search_products: (data) => async ({ query }: { query: string }) => {
      const storeName = (data as any)?.store?.name || "";
      const res = await fetch(`${WOO_API}/products?search=${encodeURIComponent(query)}&per_page=10`);
      const rawProducts: WooProduct[] = await res.json();
      const products = rawProducts.map(normalizeWooProduct).filter((p) => p.inStock);

      if (products.length === 0) {
        return { content: [{ type: "text" as const, text: `No products found for "${query}" at ${storeName}.` }] };
      }
      const list = products.map((p) => `- ${p.name} — ${p.currency} ${p.price.toFixed(2)} | Sizes: ${p.sizes.join(", ")}`).join("\n");
      return { content: [{ type: "text" as const, text: `# Results for "${query}"\n\n${list}` }] };
    },

    get_product: (data) => async ({ product_id }: { product_id: string }) => {
      const res = await fetch(`${WOO_API}/products?slug=${product_id}`);
      const results: WooProduct[] = await res.json();
      if (!results.length) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }
      const product = normalizeWooProduct(results[0]);
      return {
        content: [{
          type: "text" as const,
          text: `# ${product.name}\n\nPrice: ${product.currency} ${product.price.toFixed(2)}\nSizes: ${product.sizes.join(", ")}\nColor: ${product.color}\nIn stock: ${product.inStock ? "Yes" : "No"}${product.description ? `\n\n${product.description}` : ""}`,
        }],
      };
    },

    check_stock: (data) => async ({ product_id, size }: { product_id: string; size: string }) => {
      const res = await fetch(`${WOO_API}/products?slug=${product_id}`);
      const json: WooProduct[] = await res.json();
      if (!json.length) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }
      const product = normalizeWooProduct(json[0]);
      if (!product.inStock) {
        return { content: [{ type: "text" as const, text: `${product.name} is currently out of stock.` }] };
      }
      if (!product.sizes.includes(size)) {
        return { content: [{ type: "text" as const, text: `Size ${size} is not available for ${product.name}. Available: ${product.sizes.join(", ")}` }] };
      }
      return { content: [{ type: "text" as const, text: `${product.name} in size ${size} is available. Price: ${product.currency} ${product.price.toFixed(2)}` }] };
    },

    add_to_cart: (data) => async ({ product_id, size, quantity = 1 }: { product_id: string; size: string; quantity?: number }) => {
      const res = await fetch(`${WOO_API}/products?slug=${product_id}`);
      const json: WooProduct[] = await res.json();
      if (!json.length) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }
      const raw = json[0];
      const product = normalizeWooProduct(raw);
      if (!product.inStock || !product.sizes.includes(size)) {
        return { content: [{ type: "text" as const, text: `${product.name} in size ${size} is not available.` }] };
      }
      await fetch(`${WOO_API}/cart/add-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: raw.id, quantity, variation: [{ attribute: "size", value: size }] }),
      });
      return { content: [{ type: "text" as const, text: `Added ${quantity}x ${product.name} (size ${size}) to cart. Price: ${product.currency} ${product.price.toFixed(2)}` }] };
    },
  },
};

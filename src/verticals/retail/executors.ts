// @agentikas/webmcp-sdk — Retail executors (preloaded data, platform-agnostic)
// Used when product data is already loaded (e.g. server-rendered page).

import type { ExecutorMap } from "../../types";
import type { RetailData } from "./types";

export const retailExecutors: ExecutorMap<RetailData> = {
  search_products: ({ store, products }) => ({ query }: { query: string }) => {
    const q = query.toLowerCase();
    const matches = products.filter(
      (p) => p.inStock && (p.name.toLowerCase().includes(q) || p.color.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false)),
    );
    if (matches.length === 0) {
      return { content: [{ type: "text" as const, text: `No products found for "${query}" at ${store.name}.` }] };
    }
    const list = matches
      .map((p) => `- ${p.name} — ${p.currency} ${p.price.toFixed(2)} | Sizes: ${p.sizes.join(", ")} | Color: ${p.color}`)
      .join("\n");
    return { content: [{ type: "text" as const, text: `# Results for "${query}" at ${store.name}\n\n${list}` }] };
  },

  get_product: ({ store, products }) => ({ product_id }: { product_id: string }) => {
    const product = products.find((p) => p.id === product_id);
    if (!product) {
      return { content: [{ type: "text" as const, text: `Product "${product_id}" not found at ${store.name}.` }] };
    }
    return {
      content: [{
        type: "text" as const,
        text: `# ${product.name}\n\nPrice: ${product.currency} ${product.price.toFixed(2)}\nColor: ${product.color}\nSizes: ${product.sizes.join(", ")}\nIn stock: ${product.inStock ? "Yes" : "No"}${product.description ? `\n\n${product.description}` : ""}`,
      }],
    };
  },

  check_stock: ({ store, products }) => ({ product_id, size }: { product_id: string; size: string }) => {
    const product = products.find((p) => p.id === product_id);
    if (!product) {
      return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
    }
    if (!product.inStock) {
      return { content: [{ type: "text" as const, text: `${product.name} is currently out of stock.` }] };
    }
    if (!product.sizes.includes(size)) {
      return { content: [{ type: "text" as const, text: `Size ${size} is not available for ${product.name}. Available: ${product.sizes.join(", ")}` }] };
    }
    return { content: [{ type: "text" as const, text: `${product.name} in size ${size} is available. Price: ${product.currency} ${product.price.toFixed(2)}` }] };
  },

  add_to_cart: ({ products }) => ({ product_id, size, quantity = 1 }: { product_id: string; size: string; quantity?: number }) => {
    const product = products.find((p) => p.id === product_id);
    if (!product) {
      return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
    }
    if (!product.inStock || !product.sizes.includes(size)) {
      return { content: [{ type: "text" as const, text: `${product.name} in size ${size} is not available.` }] };
    }
    return { content: [{ type: "text" as const, text: `Added ${quantity}x ${product.name} (size ${size}) to cart. Subtotal: ${product.currency} ${(product.price * quantity).toFixed(2)}` }] };
  },
};

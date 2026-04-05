// @agentikas/webmcp-sdk — Retail executors (preloaded data, platform-agnostic)
// Used when product data is already loaded (e.g. server-rendered page).
// Safe with empty data — returns "no data available" messages.

import type { ExecutorMap } from "../../types";
import type { RetailData } from "./types";

export const retailExecutors: ExecutorMap<RetailData> = {
  search_products: (data) => ({ query }: { query: string }) => {
    const store = (data as any)?.store;
    const products = (data as any)?.products ?? [];
    if (products.length === 0) {
      return { content: [{ type: "text" as const, text: "No product data available. This tool requires preloaded data or a platform adapter." }] };
    }
    const q = query.toLowerCase();
    const matches = products.filter(
      (p: any) => p.inStock && (p.name.toLowerCase().includes(q) || p.color?.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false)),
    );
    if (matches.length === 0) {
      return { content: [{ type: "text" as const, text: `No products found for "${query}"${store?.name ? ` at ${store.name}` : ""}.` }] };
    }
    const list = matches
      .map((p: any) => `- ${p.name} — ${p.currency} ${p.price.toFixed(2)} | Sizes: ${p.sizes.join(", ")} | Color: ${p.color}`)
      .join("\n");
    return { content: [{ type: "text" as const, text: `# Results for "${query}"${store?.name ? ` at ${store.name}` : ""}\n\n${list}` }] };
  },

  get_product: (data) => ({ product_id }: { product_id: string }) => {
    const store = (data as any)?.store;
    const products = (data as any)?.products ?? [];
    const product = products.find((p: any) => p.id === product_id);
    if (!product) {
      return { content: [{ type: "text" as const, text: `Product "${product_id}" not found${store?.name ? ` at ${store.name}` : ""}.` }] };
    }
    return {
      content: [{
        type: "text" as const,
        text: `# ${product.name}\n\nPrice: ${product.currency} ${product.price.toFixed(2)}\nColor: ${product.color}\nSizes: ${product.sizes.join(", ")}\nIn stock: ${product.inStock ? "Yes" : "No"}${product.description ? `\n\n${product.description}` : ""}`,
      }],
    };
  },

  check_stock: (data) => ({ product_id, size }: { product_id: string; size: string }) => {
    const products = (data as any)?.products ?? [];
    const product = products.find((p: any) => p.id === product_id);
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

  add_to_cart: (data) => ({ product_id, size, quantity = 1 }: { product_id: string; size: string; quantity?: number }) => {
    const products = (data as any)?.products ?? [];
    const product = products.find((p: any) => p.id === product_id);
    if (!product) {
      return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
    }
    if (!product.inStock || !product.sizes.includes(size)) {
      return { content: [{ type: "text" as const, text: `${product.name} in size ${size} is not available.` }] };
    }
    return { content: [{ type: "text" as const, text: `Added ${quantity}x ${product.name} (size ${size}) to cart. Subtotal: ${product.currency} ${(product.price * quantity).toFixed(2)}` }] };
  },
};

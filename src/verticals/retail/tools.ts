// @agentikas/webmcp-sdk — Retail tool factories (platform-agnostic)
// Works with or without preloaded data (lazy mode for GTM on third-party sites)

import type { VerticalDefinition, ToolFactory } from "../../types";
import type { RetailData } from "./types";

const storeName = (data: any): string => data?.store?.name || "";
const storeLabel = (data: any): string => storeName(data) ? ` in ${storeName(data)}` : "";

const search: ToolFactory<RetailData> = (data) => ({
  name: "search_products",
  description: `Search products${storeLabel(data)}. Returns matching products with prices. IMPORTANT: The search engine is full-text, not AI — always translate the query to the store's catalog language (usually English) before searching. If 0 results, retry with the translated query. After finding a product, always call get_product with its product_id to see available variants (sizes, colors) before adding to cart.`,
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query in the store's catalog language (translate from user's language if needed)" },
    },
    required: ["query"],
  },
});

const product: ToolFactory<RetailData> = (data) => ({
  name: "get_product",
  description: `Get detailed product information${storeLabel(data)} including all available variants with options (size, color, material, etc.), prices, and stock status. Always call this before add_to_cart. Present the available in-stock options to the user and let them choose. Then add to cart immediately with their choice.`,
  input_schema: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "Product ID or handle" },
    },
    required: ["product_id"],
  },
});

const stock: ToolFactory<RetailData> = (data) => ({
  name: "check_stock",
  description: `Check if a specific size is available for a product${storeLabel(data)}.`,
  input_schema: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "Product ID or handle" },
      size: { type: "string", description: "Size to check (e.g. S, M, L, 38, 42)" },
    },
    required: ["product_id", "size"],
  },
});

const cart: ToolFactory<RetailData> = (data) => ({
  name: "add_to_cart",
  description: `Add a product to the shopping cart${storeLabel(data)}. Use the exact option name from get_product (e.g. "Sundown Brown", "Medium", "Default"). For simple products without variants, use "Default".`,
  input_schema: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "Product ID or handle (from search results)" },
      size: { type: "string", description: "The variant option name from get_product (e.g. 'Medium', 'Sundown Brown', 'Default')" },
      quantity: { type: "number", description: "Quantity (default 1)" },
    },
    required: ["product_id", "size"],
  },
});

export const retail: VerticalDefinition<RetailData> = {
  id: "retail",
  name: "Retail",
  tools: { search, product, stock, cart },
  defaultTools: ["search", "product", "stock", "cart"],
};

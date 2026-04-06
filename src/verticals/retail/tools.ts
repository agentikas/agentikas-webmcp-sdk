// @agentikas/webmcp-sdk — Retail tool factories (platform-agnostic)
// Works with or without preloaded data (lazy mode for GTM on third-party sites)

import type { VerticalDefinition, ToolFactory } from "../../types";
import type { RetailData } from "./types";

const storeName = (data: any): string => data?.store?.name || "";
const storeLabel = (data: any): string => storeName(data) ? ` in ${storeName(data)}` : "";

const search: ToolFactory<RetailData> = (data) => ({
  name: "search_products",
  description: `Search products${storeLabel(data)}. Returns matching products with prices. After finding a product, always call get_product with its product_id to see available variants (sizes, colors) before adding to cart.`,
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query (product name, category, color, etc.)" },
    },
    required: ["query"],
  },
});

const product: ToolFactory<RetailData> = (data) => ({
  name: "get_product",
  description: `Get detailed product information${storeLabel(data)} including all available variants (sizes, colors, prices, stock status). Always call this before add_to_cart to show the user their options.`,
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
  description: `Add a product to the shopping cart${storeLabel(data)}.`,
  input_schema: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "Product ID or handle" },
      size: { type: "string", description: "Selected size" },
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

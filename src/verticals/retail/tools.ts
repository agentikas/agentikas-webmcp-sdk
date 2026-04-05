// @agentikas/webmcp-sdk — Retail tool factories (platform-agnostic)
// Works with or without preloaded data (lazy mode for GTM on third-party sites)

import type { VerticalDefinition, ToolFactory } from "../../types";
import type { RetailData } from "./types";

const storeName = (data: any): string => data?.store?.name || "";
const storeLabel = (data: any): string => storeName(data) ? ` in ${storeName(data)}` : "";

const search: ToolFactory<RetailData> = (data) => ({
  name: "search_products",
  description: `Search products${storeLabel(data)}. Returns matching products with prices and available sizes.`,
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
  description: `Get detailed information about a product${storeLabel(data)}.`,
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

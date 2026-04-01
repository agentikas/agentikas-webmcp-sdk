import { describe, it, expect, beforeAll } from "vitest";
import { registerVertical, buildTools, getExecutors, hasVertical } from "../src/registry";
import type { VerticalDefinition, ToolFactory, ExecutorMap } from "../src/types";

// ── Retail domain types ────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  price: number;
  sizes: string[];
  color: string;
  inStock: boolean;
}

interface RetailData {
  store: { name: string; currency: string };
  products: Product[];
}

// ── Mock data ──────────────────────────────────────────────────

const mockStore = { name: "Urban Style", currency: "EUR" };
const mockProducts: Product[] = [
  { id: "tshirt-1", name: "Classic White T-Shirt", price: 29.99, sizes: ["S", "M", "L", "XL"], color: "white", inStock: true },
  { id: "jeans-1", name: "Slim Fit Dark Jeans", price: 79.99, sizes: ["28", "30", "32", "34"], color: "dark blue", inStock: true },
  { id: "jacket-1", name: "Leather Biker Jacket", price: 199.99, sizes: ["M", "L"], color: "black", inStock: false },
  { id: "dress-1", name: "Summer Floral Dress", price: 59.99, sizes: ["S", "M", "L"], color: "floral", inStock: true },
];
const mockRetailData: RetailData = { store: mockStore, products: mockProducts };

// ── Tool factories ─────────────────────────────────────────────

const searchProducts: ToolFactory<RetailData> = ({ store }) => ({
  name: "search_products",
  description: `Search products in ${store.name}`,
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
    },
    required: ["query"],
  },
});

const getProduct: ToolFactory<RetailData> = ({ store }) => ({
  name: "get_product",
  description: `Get product details from ${store.name}`,
  input_schema: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "Product ID" },
    },
    required: ["product_id"],
  },
});

const checkStock: ToolFactory<RetailData> = ({ store }) => ({
  name: "check_stock",
  description: `Check size availability at ${store.name}`,
  input_schema: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "Product ID" },
      size: { type: "string", description: "Size to check" },
    },
    required: ["product_id", "size"],
  },
});

// ── Vertical definition ────────────────────────────────────────

const retailVertical: VerticalDefinition<RetailData> = {
  id: "retail",
  name: "Retail",
  tools: { search: searchProducts, product: getProduct, stock: checkStock },
  defaultTools: ["search", "product", "stock"],
};

// ── Executors ──────────────────────────────────────────────────

const retailExecutors: ExecutorMap<RetailData> = {
  search_products: ({ store, products }) => ({ query }: { query: string }) => {
    const q = query.toLowerCase();
    const matches = products.filter((p) => p.name.toLowerCase().includes(q) && p.inStock);
    if (matches.length === 0) {
      return { content: [{ type: "text" as const, text: `No products found for "${query}" at ${store.name}.` }] };
    }
    const list = matches.map((p) => `- ${p.name} — ${store.currency} ${p.price.toFixed(2)}`).join("\n");
    return { content: [{ type: "text" as const, text: `# Results for "${query}"\n\n${list}` }] };
  },

  get_product: ({ store, products }) => ({ product_id }: { product_id: string }) => {
    const product = products.find((p) => p.id === product_id);
    if (!product) {
      return { content: [{ type: "text" as const, text: `Product "${product_id}" not found at ${store.name}.` }] };
    }
    return {
      content: [{
        type: "text" as const,
        text: `# ${product.name}\n\nPrice: ${store.currency} ${product.price.toFixed(2)}\nColor: ${product.color}\nSizes: ${product.sizes.join(", ")}\nIn stock: ${product.inStock ? "Yes" : "No"}`,
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
      return { content: [{ type: "text" as const, text: `Size ${size} not available for ${product.name}. Available: ${product.sizes.join(", ")}` }] };
    }
    return { content: [{ type: "text" as const, text: `${product.name} in size ${size} is available. Price: ${store.currency} ${product.price.toFixed(2)}` }] };
  },
};

// ── Register ───────────────────────────────────────────────────

beforeAll(() => {
  registerVertical(retailVertical, retailExecutors, "preloaded");
});

// ── Tests ──────────────────────────────────────────────────────

describe("Retail vertical registration", () => {
  it("registers successfully", () => {
    expect(hasVertical("retail")).toBe(true);
  });
});

describe("Retail buildTools", () => {
  it("generates 3 ToolDefinitions", () => {
    const tools = buildTools({ businessId: "urban-style", vertical: "retail" }, mockRetailData);
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual(["search_products", "get_product", "check_stock"]);
  });

  it("includes store name in descriptions", () => {
    const tools = buildTools({ businessId: "urban-style", vertical: "retail" }, mockRetailData);
    for (const tool of tools) {
      expect(tool.description).toContain("Urban Style");
    }
  });

  it("respects config.tools selection", () => {
    const tools = buildTools({ businessId: "urban-style", vertical: "retail", tools: ["search"] }, mockRetailData);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("search_products");
  });
});

describe("search_products executor", () => {
  it("finds matching products", () => {
    const execute = retailExecutors.search_products(mockRetailData);
    const result = execute({ query: "T-Shirt" });
    expect(result.content[0].text).toContain("Classic White T-Shirt");
    expect(result.content[0].text).toContain("29.99");
  });

  it("excludes out-of-stock products", () => {
    const execute = retailExecutors.search_products(mockRetailData);
    const result = execute({ query: "Jacket" });
    expect(result.content[0].text).toContain("No products found");
  });

  it("returns no results message for unknown query", () => {
    const execute = retailExecutors.search_products(mockRetailData);
    const result = execute({ query: "boots" });
    expect(result.content[0].text).toContain("No products found");
  });
});

describe("get_product executor", () => {
  it("returns product details", () => {
    const execute = retailExecutors.get_product(mockRetailData);
    const result = execute({ product_id: "tshirt-1" });
    expect(result.content[0].text).toContain("Classic White T-Shirt");
    expect(result.content[0].text).toContain("29.99");
    expect(result.content[0].text).toContain("white");
    expect(result.content[0].text).toContain("S, M, L, XL");
  });

  it("returns not found for unknown product", () => {
    const execute = retailExecutors.get_product(mockRetailData);
    const result = execute({ product_id: "nonexistent" });
    expect(result.content[0].text).toContain("not found");
  });
});

describe("check_stock executor", () => {
  it("confirms available size", () => {
    const execute = retailExecutors.check_stock(mockRetailData);
    const result = execute({ product_id: "tshirt-1", size: "M" });
    expect(result.content[0].text).toContain("available");
    expect(result.content[0].text).toContain("29.99");
  });

  it("reports out of stock product", () => {
    const execute = retailExecutors.check_stock(mockRetailData);
    const result = execute({ product_id: "jacket-1", size: "M" });
    expect(result.content[0].text).toContain("out of stock");
  });

  it("reports unavailable size", () => {
    const execute = retailExecutors.check_stock(mockRetailData);
    const result = execute({ product_id: "tshirt-1", size: "XXL" });
    expect(result.content[0].text).toContain("not available");
    expect(result.content[0].text).toContain("S, M, L, XL");
  });
});

describe("End-to-end pipeline", () => {
  it("register → buildTools → getExecutors → execute → verify ToolResult", () => {
    // 1. Build tools
    const tools = buildTools({ businessId: "urban-style", vertical: "retail" }, mockRetailData);
    expect(tools.length).toBeGreaterThan(0);

    // 2. Get executors
    const executorMap = getExecutors("retail", "preloaded");
    expect(executorMap).toBeDefined();

    // 3. Pick search_products tool + executor
    const searchTool = tools.find((t) => t.name === "search_products")!;
    expect(searchTool).toBeDefined();

    const executorFactory = executorMap!["search_products"];
    const execute = executorFactory(mockRetailData);

    // 4. Execute
    const result = execute({ query: "Jeans" });

    // 5. Verify ToolResult format
    expect(result).toHaveProperty("content");
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0]).toHaveProperty("type", "text");
    expect(result.content[0]).toHaveProperty("text");
    expect(result.content[0].text).toContain("Slim Fit Dark Jeans");
  });
});

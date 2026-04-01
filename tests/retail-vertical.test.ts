import { describe, it, expect, beforeAll } from 'vitest';
import { registerVertical, buildTools, getExecutors, hasVertical } from '../src/registry';
import type { VerticalDefinition, ToolFactory, ExecutorMap, ToolResult } from '../src/types';

// ── Retail domain types ────────────────────────────────

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

// ── Mock data ──────────────────────────────────────────

const mockStore = { name: 'Urban Style', currency: 'EUR' };
const mockProducts: Product[] = [
  { id: 'tshirt-1', name: 'Classic White T-Shirt', price: 29.99, sizes: ['S', 'M', 'L', 'XL'], color: 'white', inStock: true },
  { id: 'jeans-1', name: 'Slim Fit Dark Jeans', price: 79.99, sizes: ['28', '30', '32', '34'], color: 'dark blue', inStock: true },
  { id: 'jacket-1', name: 'Leather Biker Jacket', price: 199.99, sizes: ['M', 'L'], color: 'black', inStock: false },
  { id: 'dress-1', name: 'Summer Floral Dress', price: 59.99, sizes: ['S', 'M', 'L'], color: 'floral', inStock: true },
];
const mockRetailData: RetailData = { store: mockStore, products: mockProducts };

// ── Tool factories ─────────────────────────────────────

const searchProducts: ToolFactory<RetailData> = ({ store }) => ({
  name: 'search_products',
  description: `Search products in ${store.name}`,
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
});

const getProduct: ToolFactory<RetailData> = ({ store }) => ({
  name: 'get_product',
  description: `Get product details from ${store.name}`,
  input_schema: {
    type: 'object',
    properties: {
      product_id: { type: 'string', description: 'Product ID' },
    },
    required: ['product_id'],
  },
});

const checkStock: ToolFactory<RetailData> = ({ store }) => ({
  name: 'check_stock',
  description: `Check size availability at ${store.name}`,
  input_schema: {
    type: 'object',
    properties: {
      product_id: { type: 'string', description: 'Product ID' },
      size: { type: 'string', description: 'Size to check' },
    },
    required: ['product_id', 'size'],
  },
});

// ── Vertical definition ────────────────────────────────

const retailVertical: VerticalDefinition<RetailData> = {
  id: 'retail',
  name: 'Retail',
  tools: { search: searchProducts, product: getProduct, stock: checkStock },
  defaultTools: ['search', 'product', 'stock'],
};

// ── Executors ──────────────────────────────────────────

const retailExecutors: ExecutorMap<RetailData> = {
  search_products: ({ store, products }) => ({ query }: { query: string }) => {
    const q = query.toLowerCase();
    const matches = products.filter((p) => p.name.toLowerCase().includes(q) && p.inStock);
    if (matches.length === 0) {
      return { content: [{ type: 'text' as const, text: `No products found for "${query}" at ${store.name}.` }] };
    }
    const list = matches
      .map((p) => `- ${p.name} -- ${store.currency} ${p.price.toFixed(2)} (${p.sizes.join(', ')})`)
      .join('\n');
    return { content: [{ type: 'text' as const, text: `# Results for "${query}" at ${store.name}\n\n${list}` }] };
  },

  get_product: ({ store, products }) => ({ product_id }: { product_id: string }) => {
    const product = products.find((p) => p.id === product_id);
    if (!product) {
      return { content: [{ type: 'text' as const, text: `Product "${product_id}" not found at ${store.name}.` }] };
    }
    return {
      content: [{
        type: 'text' as const,
        text: `# ${product.name}\n\nPrice: ${store.currency} ${product.price.toFixed(2)}\nColor: ${product.color}\nSizes: ${product.sizes.join(', ')}\nIn stock: ${product.inStock ? 'Yes' : 'No'}`,
      }],
    };
  },

  check_stock: ({ store, products }) => ({ product_id, size }: { product_id: string; size: string }) => {
    const product = products.find((p) => p.id === product_id);
    if (!product) {
      return { content: [{ type: 'text' as const, text: `Product "${product_id}" not found.` }] };
    }
    if (!product.inStock) {
      return { content: [{ type: 'text' as const, text: `${product.name} is currently out of stock.` }] };
    }
    if (!product.sizes.includes(size)) {
      return {
        content: [{
          type: 'text' as const,
          text: `Size ${size} is not available for ${product.name}. Available: ${product.sizes.join(', ')}`,
        }],
      };
    }
    return {
      content: [{
        type: 'text' as const,
        text: `${product.name} in size ${size} is available. Price: ${store.currency} ${product.price.toFixed(2)}`,
      }],
    };
  },
};

// ── Tests ──────────────────────────────────────────────

beforeAll(() => {
  registerVertical(retailVertical, retailExecutors);
});

describe('Registration', () => {
  it('registerVertical succeeds and hasVertical returns true', () => {
    expect(hasVertical('retail')).toBe(true);
  });
});

describe('buildTools', () => {
  it('generates 3 ToolDefinitions', () => {
    const tools = buildTools({ businessId: 'test', vertical: 'retail' }, mockRetailData);
    expect(tools).toHaveLength(3);
  });

  it('store name appears in descriptions', () => {
    const tools = buildTools({ businessId: 'test', vertical: 'retail' }, mockRetailData);
    for (const tool of tools) {
      expect(tool.description).toContain('Urban Style');
    }
  });

  it('config.tools: ["search"] returns only 1 tool', () => {
    const tools = buildTools(
      { businessId: 'test', vertical: 'retail', tools: ['search'] },
      mockRetailData,
    );
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_products');
  });
});

describe('search_products executor', () => {
  it('finds "T-Shirt" — 1 result', () => {
    const execs = getExecutors('retail')!;
    const search = execs.search_products(mockRetailData);
    const result = search({ query: 'T-Shirt' });
    const text = result.content[0].text;
    expect(text).toContain('Classic White T-Shirt');
    expect(text).not.toContain('Jeans');
  });

  it('finds "jeans" — 1 result', () => {
    const execs = getExecutors('retail')!;
    const search = execs.search_products(mockRetailData);
    const result = search({ query: 'jeans' });
    const text = result.content[0].text;
    expect(text).toContain('Slim Fit Dark Jeans');
  });

  it('no results for "boots"', () => {
    const execs = getExecutors('retail')!;
    const search = execs.search_products(mockRetailData);
    const result = search({ query: 'boots' });
    const text = result.content[0].text;
    expect(text).toContain('No products found');
  });
});

describe('get_product executor', () => {
  it('returns product details for "tshirt-1"', () => {
    const execs = getExecutors('retail')!;
    const getProductExec = execs.get_product(mockRetailData);
    const result = getProductExec({ product_id: 'tshirt-1' });
    const text = result.content[0].text;
    expect(text).toContain('Classic White T-Shirt');
    expect(text).toContain('29.99');
    expect(text).toContain('white');
  });

  it('returns not found for "nonexistent"', () => {
    const execs = getExecutors('retail')!;
    const getProductExec = execs.get_product(mockRetailData);
    const result = getProductExec({ product_id: 'nonexistent' });
    const text = result.content[0].text;
    expect(text).toContain('not found');
  });
});

describe('check_stock executor', () => {
  it('available: tshirt-1 size M', () => {
    const execs = getExecutors('retail')!;
    const check = execs.check_stock(mockRetailData);
    const result = check({ product_id: 'tshirt-1', size: 'M' });
    const text = result.content[0].text;
    expect(text).toContain('available');
    expect(text).toContain('Classic White T-Shirt');
  });

  it('out of stock: jacket-1', () => {
    const execs = getExecutors('retail')!;
    const check = execs.check_stock(mockRetailData);
    const result = check({ product_id: 'jacket-1', size: 'M' });
    const text = result.content[0].text;
    expect(text).toContain('out of stock');
  });

  it('size not available: tshirt-1 size XXL', () => {
    const execs = getExecutors('retail')!;
    const check = execs.check_stock(mockRetailData);
    const result = check({ product_id: 'tshirt-1', size: 'XXL' });
    const text = result.content[0].text;
    expect(text).toContain('not available');
    expect(text).toContain('S, M, L, XL');
  });
});

describe('End-to-end pipeline', () => {
  it('register -> buildTools -> getExecutors -> execute -> verify ToolResult format', () => {
    // Vertical is already registered in beforeAll

    // Build tools
    const tools = buildTools({ businessId: 'test', vertical: 'retail' }, mockRetailData);
    expect(tools.length).toBeGreaterThan(0);

    // Get executors
    const execs = getExecutors('retail');
    expect(execs).toBeDefined();

    // Find the search tool and execute it
    const searchTool = tools.find((t) => t.name === 'search_products');
    expect(searchTool).toBeDefined();

    const searchExec = execs!.search_products(mockRetailData);
    const result: ToolResult = searchExec({ query: 'dress' });

    // Verify ToolResult format
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0]).toHaveProperty('text');
    expect(typeof result.content[0].text).toBe('string');
    expect(result.content[0].text).toContain('Summer Floral Dress');
  });
});

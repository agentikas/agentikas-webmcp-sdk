// @agentikas/webmcp-sdk — Adobe Commerce Edge Delivery Services (EDS) platform adapter
// Uses GraphQL Catalog Service + Live Search + Drop-in Cart API
// For classic Magento 2 (REST API), see adobe.ts

import type { PlatformAdapter } from "../../../types";
import type { Product, RetailData } from "../types";

// ── EDS GraphQL response types ─────────────────────────────────

// Core Commerce product (from productSearch → product fragment)
export interface EdsSearchProduct {
  __typename?: string;
  sku: string;
  name: string;
  small_image?: { url: string };
  price_range?: {
    minimum_price?: {
      regular_price?: { value: number; currency: string };
      final_price?: { value: number; currency: string };
    };
  };
}

// ProductView fragment (from productSearch → productView)
export interface EdsProductView {
  urlKey?: string;
  inStock?: boolean;
  attributes?: Array<{ name: string; value: string }>;
}

// Combined search result item
export interface EdsSearchItem {
  product: EdsSearchProduct;
  productView?: EdsProductView;
}

// Full product detail (from products query)
export interface EdsProductDetail {
  __typename?: string;
  sku: string;
  name: string;
  description?: { html: string };
  short_description?: { html: string };
  small_image?: { url: string };
  image?: { url: string };
  price_range?: {
    minimum_price?: {
      regular_price?: { value: number; currency: string };
      final_price?: { value: number; currency: string };
    };
  };
  stock_status?: string;
}

// ── Official Adobe Commerce endpoints (documented) ─────────────
// https://developer.adobe.com/commerce/services/graphql/catalog-service/

const CATALOG_SERVICE_ENDPOINT = "https://catalog-service.adobe.io/graphql";
const CATALOG_SERVICE_SANDBOX = "https://catalog-service-sandbox.adobe.io/graphql";

// ── Merchant config (varies per store) ─────────────────────────
// Discovered from: meta tags → /configs.json → drop-in globals

interface MerchantConfig {
  environmentId: string;
  storeCode: string;
  storeViewCode: string;
  websiteCode: string;
  apiKey: string;
  coreEndpoint: string | null; // merchant's own GraphQL (for cart mutations)
  isSandbox: boolean;
}

let cachedMerchant: MerchantConfig | null = null;

async function getMerchantConfig(): Promise<MerchantConfig | null> {
  if (cachedMerchant) return cachedMerchant;

  const raw: Record<string, string> = {};

  // Source 1: Meta tags
  try {
    const metaMap: Record<string, string> = {
      "commerce-environment-id": "environmentId",
      "commerce-website-code": "websiteCode",
      "store-code": "storeCode",
      "store-view-code": "storeViewCode",
      "commerce-x-api-key": "apiKey",
      "commerce-core-endpoint": "coreEndpoint",
      "commerce-endpoint": "catalogEndpoint",
    };
    for (const [metaName, key] of Object.entries(metaMap)) {
      const meta = document.querySelector(`meta[name="${metaName}"]`);
      if (meta?.getAttribute("content")) raw[key] = meta.getAttribute("content")!;
    }
  } catch { /* no meta tags */ }

  // Source 2: /configs.json (EDS standard)
  if (!raw.environmentId) {
    try {
      const res = await fetch("/configs.json");
      if (res.ok) {
        const json = await res.json();
        const entries: Array<{ key: string; value: string }> = json?.data ?? [];
        const configMap: Record<string, string> = {};
        for (const e of entries) {
          if (e?.key && e?.value) configMap[e.key] = e.value;
        }
        raw.environmentId = raw.environmentId || configMap["commerce-environment-id"] || "";
        raw.storeCode = raw.storeCode || configMap["store-code"] || "";
        raw.storeViewCode = raw.storeViewCode || configMap["store-view-code"] || "";
        raw.websiteCode = raw.websiteCode || configMap["commerce-website-code"] || "";
        raw.apiKey = raw.apiKey || configMap["commerce-x-api-key"] || "";
        raw.coreEndpoint = raw.coreEndpoint || configMap["commerce-core-endpoint"] || "";
        raw.catalogEndpoint = raw.catalogEndpoint || configMap["commerce-endpoint"] || "";
      }
    } catch { /* no configs.json */ }
  }

  // Source 3: Drop-in global
  try {
    const d = (window as any).__dropins__?.config;
    if (d) {
      raw.environmentId = raw.environmentId || d.environmentId || "";
      raw.coreEndpoint = raw.coreEndpoint || d.commerceEndpoint || "";
    }
  } catch { /* no dropins */ }

  if (!raw.environmentId) {
    console.warn("[Agentikas] No commerce-environment-id found. Adobe EDS adapter requires merchant config.");
    return null;
  }

  const isSandbox = (raw.catalogEndpoint || "").includes("sandbox") || (raw.coreEndpoint || "").includes("sandbox") || (raw.coreEndpoint || "").includes("adobedemo");

  cachedMerchant = {
    environmentId: raw.environmentId,
    storeCode: raw.storeCode || "default",
    storeViewCode: raw.storeViewCode || "default",
    websiteCode: raw.websiteCode || "base",
    apiKey: raw.apiKey || "storefront-widgets",
    coreEndpoint: raw.coreEndpoint || null,
    isSandbox,
  };

  return cachedMerchant;
}

// ── GraphQL endpoint + headers ─────────────────────────────────
// Prefer core endpoint (same as the storefront uses) over Catalog Service.
// Core endpoint supports productSearch with product fragment + visibility filter.

function getEndpoint(merchant: MerchantConfig): string {
  return merchant.coreEndpoint ?? (merchant.isSandbox ? CATALOG_SERVICE_SANDBOX : CATALOG_SERVICE_ENDPOINT);
}

function buildHeaders(merchant: MerchantConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Magento-Environment-Id": merchant.environmentId,
    "Magento-Store-Code": merchant.storeCode,
    "Magento-Store-View-Code": merchant.storeViewCode,
    "Magento-Website-Code": merchant.websiteCode,
    "x-api-key": merchant.apiKey,
  };
}

// ── GraphQL queries ────────────────────────────────────────────

// Queries use the same schema as the EDS storefront itself (core Commerce GraphQL)
const SEARCH_QUERY = `
  query productSearch($phrase: String!, $pageSize: Int, $filter: [SearchClauseInput!], $context: QueryContextInput) {
    productSearch(phrase: $phrase, page_size: $pageSize, filter: $filter, context: $context) {
      items {
        product {
          __typename
          sku
          name
          small_image { url }
          price_range {
            minimum_price {
              regular_price { value currency }
              final_price { value currency }
            }
          }
        }
        productView {
          urlKey
          inStock
          attributes(roles: ["visible_in_storefront"]) { name value }
        }
      }
      page_info { total_pages }
      total_count
    }
  }
`;

const PRODUCT_QUERY = `
  query productByUrl($url: String!) {
    products(filter: { url_key: { eq: $url } }) {
      items {
        __typename
        sku
        name
        description { html }
        short_description { html }
        small_image { url }
        image { url }
        price_range {
          minimum_price {
            regular_price { value currency }
            final_price { value currency }
          }
        }
        stock_status
      }
    }
  }
`;

const PRODUCT_BY_SKU_QUERY = `
  query productBySku($sku: String!) {
    products(filter: { sku: { eq: $sku } }) {
      items {
        __typename
        sku
        name
        description { html }
        short_description { html }
        small_image { url }
        image { url }
        price_range {
          minimum_price {
            regular_price { value currency }
            final_price { value currency }
          }
        }
        stock_status
      }
    }
  }
`;

// ── GraphQL fetch helper ───────────────────────────────────────

async function gqlFetch<T>(query: string, variables: Record<string, any>): Promise<T | null> {
  const merchant = await getMerchantConfig();
  if (!merchant) return null;

  const endpoint = getEndpoint(merchant);
  const headers = buildHeaders(merchant);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      console.warn(`[Agentikas] GraphQL ${res.status}: ${res.statusText} (${endpoint})`);
      return null;
    }
    const json = await res.json();
    if (json.errors?.length) {
      console.warn("[Agentikas] GraphQL errors:", json.errors.map((e: any) => e.message).join(", "));
    }
    return json.data ?? null;
  } catch (err) {
    console.warn("[Agentikas] GraphQL fetch error:", err);
    return null;
  }
}

// ── Normalizers ────────────────────────────────────────────────

export function normalizeSearchItem(item: EdsSearchItem): Product {
  const p = item.product;
  const v = item.productView;

  const sizeAttr = v?.attributes?.find(
    (a) => a.name.toLowerCase() === "size" || a.name.toLowerCase() === "talla",
  );
  const colorAttr = v?.attributes?.find(
    (a) => a.name.toLowerCase() === "color" || a.name.toLowerCase() === "colour",
  );

  return {
    id: p.sku,
    name: p.name,
    price: p.price_range?.minimum_price?.final_price?.value ?? p.price_range?.minimum_price?.regular_price?.value ?? 0,
    currency: p.price_range?.minimum_price?.regular_price?.currency ?? "USD",
    sizes: sizeAttr ? sizeAttr.value.split(",").map((s) => s.trim()) : [],
    color: colorAttr?.value ?? "",
    inStock: v?.inStock ?? true,
    imageUrl: p.small_image?.url,
  };
}

export function normalizeProductDetail(raw: EdsProductDetail): Product {
  return {
    id: raw.sku,
    name: raw.name,
    price: raw.price_range?.minimum_price?.final_price?.value ?? raw.price_range?.minimum_price?.regular_price?.value ?? 0,
    currency: raw.price_range?.minimum_price?.regular_price?.currency ?? "USD",
    sizes: [],
    color: "",
    inStock: raw.stock_status === "IN_STOCK",
    imageUrl: raw.image?.url ?? raw.small_image?.url,
    description: (raw.short_description?.html ?? raw.description?.html ?? "").replace(/<[^>]*>/g, "").slice(0, 200) || undefined,
  };
}

// ── Platform adapter ───────────────────────────────────────────

export const adobeEdsRetailPlatform: PlatformAdapter<RetailData> = {
  id: "adobe-eds",
  name: "Adobe Commerce (Edge Delivery Services)",
  detect: () => {
    try {
      // Check for EDS import map with @dropins/
      const importMap = document.querySelector('script[type="importmap"]');
      if (importMap?.textContent?.includes("@dropins/")) return true;

      // Check for commerce-endpoint meta tag
      if (document.querySelector('meta[name="commerce-endpoint"]')) return true;

      // Check for AEM hostname patterns
      const host = window.location.hostname;
      if (host.includes(".aem.live") || host.includes(".hlx.live") || host.includes(".aem.page")) return true;

      return false;
    } catch {
      return false;
    }
  },
  executors: {
    search_products: (data) => async ({ query }: { query: string }) => {
      const storeName = (data as any)?.store?.name || "";
      const merchant = await getMerchantConfig();
      const customerGroup = merchant ? "b6589fc6ab0dc82cf12099d1c2d40ab994e8410c" : "";

      const result = await gqlFetch<{
        productSearch: {
          items: EdsSearchItem[];
          total_count: number;
        };
      }>(SEARCH_QUERY, {
        phrase: query,
        pageSize: 10,
        filter: [{ attribute: "visibility", in: ["Search", "Catalog, Search"] }],
        context: { customerGroup, userViewHistory: [] },
      });

      if (!result?.productSearch?.items?.length) {
        return { content: [{ type: "text" as const, text: `No products found for "${query}"${storeName ? ` at ${storeName}` : ""}.` }] };
      }

      const products = result.productSearch.items.map(normalizeSearchItem).filter((p) => p.inStock);

      if (products.length === 0) {
        return { content: [{ type: "text" as const, text: `No in-stock products found for "${query}".` }] };
      }

      const list = products
        .map((p) => `- ${p.name} (${p.id}) — ${p.currency} ${p.price.toFixed(2)}${p.sizes.length ? ` | Sizes: ${p.sizes.join(", ")}` : ""}${p.color ? ` | Color: ${p.color}` : ""}`)
        .join("\n");

      return { content: [{ type: "text" as const, text: `# Results for "${query}" (${result.productSearch.total_count} found)\n\n${list}` }] };
    },

    get_product: (data) => async ({ product_id }: { product_id: string }) => {
      const result = await gqlFetch<{ products: { items: EdsProductDetail[] } }>(
        PRODUCT_BY_SKU_QUERY,
        { sku: product_id },
      );

      const raw = result?.products?.items?.[0];
      if (!raw) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }

      const product = normalizeProductDetail(raw);
      return {
        content: [{
          type: "text" as const,
          text: `# ${product.name}\n\nSKU: ${product.id}\nPrice: ${product.currency} ${product.price.toFixed(2)}\nIn stock: ${product.inStock ? "Yes" : "No"}` +
            (product.description ? `\n\n${product.description}` : ""),
        }],
      };
    },

    check_stock: (data) => async ({ product_id, size }: { product_id: string; size: string }) => {
      const result = await gqlFetch<{ products: { items: EdsProductDetail[] } }>(
        PRODUCT_BY_SKU_QUERY,
        { sku: product_id },
      );

      const raw = result?.products?.items?.[0];
      if (!raw) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }

      const product = normalizeProductDetail(raw);
      if (!product.inStock) {
        return { content: [{ type: "text" as const, text: `${product.name} is currently out of stock.` }] };
      }
      return { content: [{ type: "text" as const, text: `${product.name} is in stock. Price: ${product.currency} ${product.price.toFixed(2)}` }] };
    },

    add_to_cart: (data) => async ({ product_id, size, quantity = 1 }: { product_id: string; size: string; quantity?: number }) => {
      // Try Drop-in Cart API first (available on EDS storefronts with cart drop-in)
      const Cart = (window as any).__dropins__?.storefront?.cart?.api;
      if (Cart?.addProductsToCart) {
        try {
          await Cart.addProductsToCart([{ sku: product_id, quantity }]);
          return { content: [{ type: "text" as const, text: `Added ${quantity}x ${product_id} (size ${size}) to cart.` }] };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `Failed to add to cart: ${err instanceof Error ? err.message : "unknown error"}` }] };
        }
      }

      // Fallback: GraphQL mutation via core endpoint
      const merchant = await getMerchantConfig();
      const endpoint = merchant?.coreEndpoint;
      if (!endpoint) {
        return { content: [{ type: "text" as const, text: "Cannot add to cart: no commerce core endpoint found." }] };
      }

      const headers = buildHeaders(merchant);
      try {
        const cartRes = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: `mutation { createEmptyCart }`,
          }),
        });
        const cartData = await cartRes.json();
        const cartId = cartData?.data?.createEmptyCart;

        if (!cartId) {
          return { content: [{ type: "text" as const, text: "Failed to create cart." }] };
        }

        await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: `mutation addToCart($cartId: String!, $items: [CartItemInput!]!) {
              addProductsToCart(cartId: $cartId, cartItems: $items) {
                cart { total_quantity }
              }
            }`,
            variables: {
              cartId,
              items: [{ sku: product_id, quantity }],
            },
          }),
        });

        return { content: [{ type: "text" as const, text: `Added ${quantity}x ${product_id} (size ${size}) to cart.` }] };
      } catch {
        return { content: [{ type: "text" as const, text: "Failed to add product to cart." }] };
      }
    },
  },
};

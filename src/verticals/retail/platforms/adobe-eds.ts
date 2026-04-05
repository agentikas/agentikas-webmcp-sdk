// @agentikas/webmcp-sdk — Adobe Commerce Edge Delivery Services (EDS) platform adapter
// Uses GraphQL Catalog Service + Live Search + Drop-in Cart API
// For classic Magento 2 (REST API), see adobe.ts

import type { PlatformAdapter } from "../../../types";
import type { Product, RetailData } from "../types";

// ── EDS GraphQL response types ─────────────────────────────────

export interface EdsProductView {
  name: string;
  sku: string;
  urlKey?: string;
  description?: string;
  shortDescription?: string;
  price: {
    regular: { amount: { value: number; currency: string } };
    final?: { amount: { value: number; currency: string } };
  };
  images?: Array<{ url: string; label?: string }>;
  attributes?: Array<{ name: string; value: string }>;
  inStock?: boolean;
}

// ── Site config cache ──────────────────────────────────────────
// EDS Commerce stores config in /configs.json, meta tags, or drop-in globals.
// We cache it after first fetch to avoid repeated requests.

let cachedConfig: Record<string, string> | null = null;

async function loadSiteConfig(): Promise<Record<string, string>> {
  if (cachedConfig) return cachedConfig;

  const config: Record<string, string> = {};

  // Method 1: Meta tags (highest priority, sync)
  try {
    const metaNames = ["commerce-endpoint", "commerce-environment-id", "commerce-website-code", "store-code", "store-view-code", "commerce-core-endpoint", "commerce-x-api-key"];
    for (const name of metaNames) {
      const meta = document.querySelector(`meta[name="${name}"]`);
      if (meta?.getAttribute("content")) {
        config[name] = meta.getAttribute("content")!;
      }
    }
  } catch { /* meta tags not available */ }

  // Method 2: /configs.json (EDS standard config file)
  if (!config["commerce-endpoint"]) {
    try {
      const res = await fetch("/configs.json");
      if (res.ok) {
        const json = await res.json();
        const entries = json?.data ?? json?.[":names"]?.map((_: any, i: number) => json.data?.[i]) ?? [];
        // configs.json can be array of {key, value} or nested structure
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            if (entry?.key && entry?.value) {
              config[entry.key] = entry.value;
            }
          }
        }
      }
    } catch { /* configs.json not available */ }
  }

  // Method 3: Drop-in global config
  try {
    const dropins = (window as any).__dropins__?.config;
    if (dropins) {
      if (dropins.commerceEndpoint && !config["commerce-endpoint"]) config["commerce-endpoint"] = dropins.commerceEndpoint;
      if (dropins.environmentId && !config["commerce-environment-id"]) config["commerce-environment-id"] = dropins.environmentId;
    }
  } catch { /* dropins not available */ }

  cachedConfig = config;
  return config;
}

// ── GraphQL endpoint + headers ─────────────────────────────────

async function getGraphQLEndpoint(): Promise<string | null> {
  const config = await loadSiteConfig();
  // Prefer catalog-service endpoint for search, fall back to core
  return config["commerce-endpoint"] || config["commerce-core-endpoint"] || null;
}

async function getStoreHeaders(): Promise<Record<string, string>> {
  const config = await loadSiteConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config["store-code"]) headers["Magento-Store-Code"] = config["store-code"];
  if (config["store-view-code"]) headers["Magento-Store-View-Code"] = config["store-view-code"];
  if (config["commerce-environment-id"]) headers["Magento-Environment-Id"] = config["commerce-environment-id"];
  if (config["commerce-website-code"]) headers["Magento-Website-Code"] = config["commerce-website-code"];
  if (config["commerce-x-api-key"]) headers["x-api-key"] = config["commerce-x-api-key"];

  return headers;
}

// ── GraphQL queries ────────────────────────────────────────────

const SEARCH_QUERY = `
  query productSearch($phrase: String!, $pageSize: Int) {
    productSearch(phrase: $phrase, page_size: $pageSize) {
      items {
        productView {
          name
          sku
          urlKey
          shortDescription
          price {
            regular { amount { value currency } }
            final { amount { value currency } }
          }
          images(roles: ["image"]) { url label }
          attributes(roles: ["visible_in_storefront"]) { name value }
          inStock
        }
      }
      total_count
    }
  }
`;

const PRODUCT_QUERY = `
  query products($skus: [String!]!) {
    products(skus: $skus) {
      name
      sku
      urlKey
      description
      shortDescription
      price {
        regular { amount { value currency } }
        final { amount { value currency } }
      }
      images(roles: ["image"]) { url label }
      attributes(roles: ["visible_in_storefront"]) { name value }
      inStock
    }
  }
`;

// ── GraphQL fetch helper ───────────────────────────────────────

async function gqlFetch<T>(query: string, variables: Record<string, any>): Promise<T | null> {
  const endpoint = await getGraphQLEndpoint();
  if (!endpoint) {
    console.warn("[Agentikas] No GraphQL endpoint found for Adobe Commerce EDS. Check /configs.json or commerce-endpoint meta tag.");
    return null;
  }

  const headers = await getStoreHeaders();

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      console.warn(`[Agentikas] GraphQL request failed: ${res.status} ${res.statusText}`);
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

// ── Normalizer ─────────────────────────────────────────────────

export function normalizeEdsProduct(raw: EdsProductView): Product {
  const sizeAttr = raw.attributes?.find(
    (a) => a.name.toLowerCase() === "size" || a.name.toLowerCase() === "talla",
  );
  const colorAttr = raw.attributes?.find(
    (a) => a.name.toLowerCase() === "color" || a.name.toLowerCase() === "colour",
  );

  return {
    id: raw.sku,
    name: raw.name,
    price: raw.price.final?.amount.value ?? raw.price.regular.amount.value,
    currency: raw.price.regular.amount.currency,
    sizes: sizeAttr ? sizeAttr.value.split(",").map((s) => s.trim()) : [],
    color: colorAttr?.value ?? "",
    inStock: raw.inStock ?? true,
    imageUrl: raw.images?.[0]?.url,
    description: (raw.shortDescription ?? raw.description ?? "").replace(/<[^>]*>/g, "").slice(0, 200) || undefined,
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

      const result = await gqlFetch<{ productSearch: { items: Array<{ productView: EdsProductView }>; total_count: number } }>(
        SEARCH_QUERY,
        { phrase: query, pageSize: 10 },
      );

      if (!result?.productSearch?.items?.length) {
        return { content: [{ type: "text" as const, text: `No products found for "${query}"${storeName ? ` at ${storeName}` : ""}.` }] };
      }

      const products = result.productSearch.items
        .map((item) => normalizeEdsProduct(item.productView))
        .filter((p) => p.inStock);

      if (products.length === 0) {
        return { content: [{ type: "text" as const, text: `No in-stock products found for "${query}".` }] };
      }

      const list = products
        .map((p) => `- ${p.name} (${p.id}) — ${p.currency} ${p.price.toFixed(2)}${p.sizes.length ? ` | Sizes: ${p.sizes.join(", ")}` : ""}${p.color ? ` | Color: ${p.color}` : ""}`)
        .join("\n");

      return { content: [{ type: "text" as const, text: `# Results for "${query}" (${result.productSearch.total_count} found)\n\n${list}` }] };
    },

    get_product: (data) => async ({ product_id }: { product_id: string }) => {
      const result = await gqlFetch<{ products: EdsProductView[] }>(
        PRODUCT_QUERY,
        { skus: [product_id] },
      );

      const raw = result?.products?.[0];
      if (!raw) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }

      const product = normalizeEdsProduct(raw);
      return {
        content: [{
          type: "text" as const,
          text: `# ${product.name}\n\nSKU: ${product.id}\nPrice: ${product.currency} ${product.price.toFixed(2)}\nIn stock: ${product.inStock ? "Yes" : "No"}` +
            (product.sizes.length ? `\nSizes: ${product.sizes.join(", ")}` : "") +
            (product.color ? `\nColor: ${product.color}` : "") +
            (product.description ? `\n\n${product.description}` : ""),
        }],
      };
    },

    check_stock: (data) => async ({ product_id, size }: { product_id: string; size: string }) => {
      const result = await gqlFetch<{ products: EdsProductView[] }>(
        PRODUCT_QUERY,
        { skus: [product_id] },
      );

      const raw = result?.products?.[0];
      if (!raw) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }

      const product = normalizeEdsProduct(raw);
      if (!product.inStock) {
        return { content: [{ type: "text" as const, text: `${product.name} is currently out of stock.` }] };
      }
      if (product.sizes.length > 0 && !product.sizes.includes(size)) {
        return { content: [{ type: "text" as const, text: `Size ${size} is not available for ${product.name}. Available: ${product.sizes.join(", ")}` }] };
      }
      return { content: [{ type: "text" as const, text: `${product.name} in size ${size} is available. Price: ${product.currency} ${product.price.toFixed(2)}` }] };
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
      const endpoint = await getGraphQLEndpoint();
      if (!endpoint) {
        return { content: [{ type: "text" as const, text: "Cannot add to cart: no commerce endpoint found." }] };
      }

      const headers = await getStoreHeaders();
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

// @agentikas/webmcp-sdk — Adobe Commerce (Magento) platform adapter for retail
// Normalizes Adobe Commerce GraphQL/REST → common Product interface

import type { PlatformAdapter } from "../../../types";
import type { Product, RetailData } from "../types";

// ── Adobe Commerce raw types ───────────────────────────────────

export interface AdobeProduct {
  id: number;
  sku: string;
  name: string;
  price: number;
  status: number;                    // 1 = enabled
  type_id: string;                   // "simple", "configurable"
  custom_attributes: AdobeAttribute[];
  media_gallery_entries?: Array<{ file: string }>;
  extension_attributes?: {
    configurable_product_options?: Array<{
      attribute_id: string;
      label: string;
      values: Array<{ value_index: number; label?: string }>;
    }>;
    stock_item?: { is_in_stock: boolean; qty: number };
  };
}

export interface AdobeAttribute {
  attribute_code: string;
  value: string;
}

// ── Currency detection ──────────────────────────────────────────

/**
 * Detect the active currency from Adobe Commerce's global config.
 * Magento exposes require('Magento_Catalog/js/price-utils') or
 * window.checkout.baseCurrencyCode. Falls back to provided default.
 */
export function detectAdobeCurrency(fallback: string = "EUR"): string {
  try {
    const w = globalThis.window as any;
    // Try checkout config (most reliable in storefront)
    if (w?.checkout?.baseCurrencyCode) return w.checkout.baseCurrencyCode;
    // Try store config injected by Magento
    if (w?.BASE_CURRENCY_CODE) return w.BASE_CURRENCY_CODE;
    return fallback;
  } catch {
    return fallback;
  }
}

// ── Normalizer ─────────────────────────────────────────────────

export function normalizeAdobeProduct(raw: AdobeProduct, currency?: string): Product {
  const resolvedCurrency = currency ?? detectAdobeCurrency();
  const getAttr = (code: string) =>
    raw.custom_attributes.find((a) => a.attribute_code === code)?.value;

  const sizeOption = raw.extension_attributes?.configurable_product_options?.find(
    (o) => o.label.toLowerCase() === "size" || o.label.toLowerCase() === "talla",
  );
  const colorOption = raw.extension_attributes?.configurable_product_options?.find(
    (o) => o.label.toLowerCase() === "color",
  );

  const sizes = sizeOption?.values.map((v) => v.label ?? String(v.value_index)) ?? [];
  const color = colorOption?.values[0]?.label ?? getAttr("color") ?? "";

  const isInStock = raw.extension_attributes?.stock_item?.is_in_stock ?? raw.status === 1;
  const baseUrl = globalThis.window?.location?.origin ?? "";
  const imageFile = raw.media_gallery_entries?.[0]?.file;

  return {
    id: raw.sku,
    name: raw.name,
    price: raw.price,
    currency: resolvedCurrency,
    sizes,
    color,
    inStock: isInStock,
    imageUrl: imageFile ? `${baseUrl}/media/catalog/product${imageFile}` : undefined,
    description: getAttr("short_description")?.replace(/<[^>]*>/g, "").slice(0, 200) || undefined,
  };
}

// ── Platform adapter ───────────────────────────────────────────

const ADOBE_API = "/rest/V1";

export const adobeRetailPlatform: PlatformAdapter<RetailData> = {
  id: "adobe",
  name: "Adobe Commerce",
  detect: () => {
    try {
      return typeof (globalThis as any).require === "function" &&
        !!(globalThis as any).require.s?.contexts?._.config?.paths?.["Magento_Ui"];
    } catch {
      return false;
    }
  },
  executors: {
    search_products: (data) => async ({ query }: { query: string }) => {
      const currency = (data as any)?.store?.currency ?? detectAdobeCurrency();
      const storeName = (data as any)?.store?.name || "";
      const filter = encodeURIComponent(`searchCriteria[filter_groups][0][filters][0][field]=name&searchCriteria[filter_groups][0][filters][0][value]=%25${query}%25&searchCriteria[filter_groups][0][filters][0][condition_type]=like&searchCriteria[pageSize]=10`);
      const res = await fetch(`${ADOBE_API}/products?${filter}`);
      const json = await res.json();
      const rawProducts: AdobeProduct[] = json.items ?? [];
      const products = rawProducts.map((p) => normalizeAdobeProduct(p, currency)).filter((p) => p.inStock);

      if (products.length === 0) {
        return { content: [{ type: "text" as const, text: `No products found for "${query}" at ${storeName}.` }] };
      }
      const list = products.map((p) => `- ${p.name} — ${p.currency} ${p.price.toFixed(2)} | Sizes: ${p.sizes.join(", ")}`).join("\n");
      return { content: [{ type: "text" as const, text: `# Results for "${query}"\n\n${list}` }] };
    },

    get_product: (data) => async ({ product_id }: { product_id: string }) => {
      const currency = (data as any)?.store?.currency ?? detectAdobeCurrency();
      const res = await fetch(`${ADOBE_API}/products/${encodeURIComponent(product_id)}`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }
      const raw: AdobeProduct = await res.json();
      const product = normalizeAdobeProduct(raw, currency);
      return {
        content: [{
          type: "text" as const,
          text: `# ${product.name}\n\nPrice: ${product.currency} ${product.price.toFixed(2)}\nSizes: ${product.sizes.join(", ")}\nColor: ${product.color}\nIn stock: ${product.inStock ? "Yes" : "No"}${product.description ? `\n\n${product.description}` : ""}`,
        }],
      };
    },

    check_stock: (data) => async ({ product_id, size }: { product_id: string; size: string }) => {
      const currency = (data as any)?.store?.currency ?? detectAdobeCurrency();
      const res = await fetch(`${ADOBE_API}/products/${encodeURIComponent(product_id)}`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }
      const raw: AdobeProduct = await res.json();
      const product = normalizeAdobeProduct(raw, currency);
      if (!product.inStock) {
        return { content: [{ type: "text" as const, text: `${product.name} is currently out of stock.` }] };
      }
      if (product.sizes.length > 0 && !product.sizes.includes(size)) {
        return { content: [{ type: "text" as const, text: `Size ${size} is not available for ${product.name}. Available: ${product.sizes.join(", ")}` }] };
      }
      return { content: [{ type: "text" as const, text: `${product.name} in size ${size} is available. Price: ${product.currency} ${product.price.toFixed(2)}` }] };
    },

    add_to_cart: (data) => async ({ product_id, size, quantity = 1 }: { product_id: string; size: string; quantity?: number }) => {
      const currency = (data as any)?.store?.currency ?? detectAdobeCurrency();
      const res = await fetch(`${ADOBE_API}/products/${encodeURIComponent(product_id)}`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: `Product "${product_id}" not found.` }] };
      }
      const raw: AdobeProduct = await res.json();
      const product = normalizeAdobeProduct(raw, currency);
      if (!product.inStock) {
        return { content: [{ type: "text" as const, text: `${product.name} is not available.` }] };
      }
      await fetch(`${ADOBE_API}/carts/mine/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartItem: { sku: product_id, qty: quantity, product_option: { extension_attributes: { configurable_item_options: [{ option_value: size }] } } } }),
      });
      return { content: [{ type: "text" as const, text: `Added ${quantity}x ${product.name} (size ${size}) to cart. Price: ${product.currency} ${product.price.toFixed(2)}` }] };
    },
  },
};

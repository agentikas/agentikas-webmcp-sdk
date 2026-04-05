// @agentikas/webmcp-sdk — Retail vertical public API

export { retail } from "./tools";
export { retailExecutors } from "./executors";
export type { Product, RetailData } from "./types";

// Platform adapters + currency detection
export { shopifyRetailPlatform, normalizeShopifyProduct, detectShopifyCurrency } from "./platforms/shopify";
export { woocommerceRetailPlatform, normalizeWooProduct } from "./platforms/woocommerce";
export { adobeRetailPlatform, normalizeAdobeProduct, detectAdobeCurrency } from "./platforms/adobe";
export { adobeEdsRetailPlatform, normalizeEdsSearchItem } from "./platforms/adobe-eds";

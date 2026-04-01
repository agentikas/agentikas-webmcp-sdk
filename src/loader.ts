// @agentikas/webmcp-sdk — Standalone loader
// Entry point for webmcp.js (loaded via <script async>).
// Reads window.__agentikas_config and window.__agentikas_data,
// detects the platform, builds tools, and registers in navigator.modelContext.

import { registerVertical, buildTools, getExecutors, registerPlatform } from "./registry";
import { detectPlatform, registerDetectionRule } from "./detect";
import { buildExecutableTools } from "./wrap-executor";
import { restaurant } from "./verticals/restaurant/tools";
import { restaurantExecutors } from "./verticals/restaurant/executors";
import { retail } from "./verticals/retail/tools";
import { retailExecutors } from "./verticals/retail/executors";
import { shopifyRetailPlatform } from "./verticals/retail/platforms/shopify";
import { woocommerceRetailPlatform } from "./verticals/retail/platforms/woocommerce";
import { adobeRetailPlatform } from "./verticals/retail/platforms/adobe";
import type { AgentikasConfig } from "./types";

declare global {
  interface Window {
    __agentikas_config?: AgentikasConfig;
    __agentikas_data?: unknown;
  }
}

// ── Register built-in verticals ────────────────────────────────

registerVertical(restaurant, restaurantExecutors, "agentikas");
registerVertical(retail, retailExecutors, "agentikas");

registerPlatform("retail", shopifyRetailPlatform);
registerPlatform("retail", woocommerceRetailPlatform);
registerPlatform("retail", adobeRetailPlatform);

// ── Detection rules ────────────────────────────────────────────

registerDetectionRule({ platformId: "shopify", detect: () => !!(window as any).Shopify });
registerDetectionRule({ platformId: "woocommerce", detect: () => !!document.querySelector(".woocommerce, .wc-block-grid") });
registerDetectionRule({
  platformId: "adobe",
  detect: () => {
    try {
      return typeof (window as any).require === "function" &&
        !!(window as any).require.s?.contexts?._.config?.paths?.["Magento_Ui"];
    } catch { return false; }
  },
});

// ── Main ───────────────────────────────────────────────────────

function main() {
  const config = window.__agentikas_config;
  if (!config) {
    console.error("[Agentikas] No window.__agentikas_config found.");
    return;
  }

  if (!config.businessId || !config.vertical) {
    console.error("[Agentikas] Config requires businessId and vertical.");
    return;
  }

  if (!config.platform) {
    config.platform = detectPlatform();
  }

  if (config.debug) {
    console.log("[Agentikas] Config:", config);
    console.log("[Agentikas] Platform:", config.platform);
    console.log("[Agentikas] Data preloaded:", !!window.__agentikas_data);
  }

  const data = window.__agentikas_data ?? {};
  const tools = buildTools(config, data);

  if (tools.length === 0) {
    console.warn("[Agentikas] No tools built. Check vertical and config.tools.");
    return;
  }

  const executorMap = getExecutors(config.vertical, config.platform);
  if (!executorMap) {
    console.error(`[Agentikas] No executors for vertical "${config.vertical}" platform "${config.platform}"`);
    return;
  }

  const executableTools = buildExecutableTools(tools, executorMap, data, config);

  if ("modelContext" in navigator) {
    (navigator as any).modelContext.provideContext({ tools: executableTools });
  } else {
    (window as any).__agentikas_tools = executableTools;
    injectJsonLdFallback(config, tools);
  }

  if (config.debug) {
    console.log(`[Agentikas] ✓ ${executableTools.length} tools registered`);
  }

  window.dispatchEvent(
    new CustomEvent("agentikas:ready", {
      detail: {
        businessId: config.businessId,
        vertical: config.vertical,
        platform: config.platform,
        tools: executableTools.map((t) => t.name),
        version: "0.1.0",
      },
    }),
  );
}

function injectJsonLdFallback(config: AgentikasConfig, tools: { name: string; description: string }[]) {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebAPI",
    name: `Agentikas WebMCP — ${config.businessId}`,
    description: `AI-accessible tools for ${config.vertical}: ${tools.map((t) => t.name).join(", ")}`,
    provider: { "@type": "Organization", name: "Agentikas", url: "https://agentikas.ai" },
  });
  document.head.appendChild(script);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

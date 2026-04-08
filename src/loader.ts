// @agentikas/webmcp-sdk — Standalone loader
// Entry point for webmcp.js (loaded via <script async>).
//
// Event-based initialization:
//   1. Script loads async (in parallel with page rendering)
//   2. Listens for 'agentikas:data-ready' event OR checks if data already set
//   3. Initializes tools + registers in navigator.modelContext
//   4. Emits 'agentikas:ready' when done

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
import { adobeEdsRetailPlatform } from "./verticals/retail/platforms/adobe-eds";
import { blog } from "./verticals/blog/tools";
import { blogExecutors } from "./verticals/blog/executors";
import { readBlogSchemaFromDOM } from "./verticals/blog/schema-reader";
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
registerVertical(blog, blogExecutors, "agentikas");

registerPlatform("retail", shopifyRetailPlatform);
registerPlatform("retail", woocommerceRetailPlatform);
registerPlatform("retail", adobeEdsRetailPlatform);
registerPlatform("retail", adobeRetailPlatform);
registerPlatform("retail", { id: "generic", name: "Generic", executors: retailExecutors });
registerPlatform("restaurant", { id: "generic", name: "Generic", executors: restaurantExecutors });
registerPlatform("blog", { id: "generic", name: "Generic", executors: blogExecutors });

// ── Detection rules ────────────────────────────────────────────

registerDetectionRule({ platformId: "shopify", detect: () => !!(window as any).Shopify });
registerDetectionRule({ platformId: "woocommerce", detect: () => !!document.querySelector(".woocommerce, .wc-block-grid") });
registerDetectionRule({
  platformId: "adobe-eds",
  detect: () => {
    try {
      const importMap = document.querySelector('script[type="importmap"]');
      if (importMap?.textContent?.includes("@dropins/")) return true;
      if (document.querySelector('meta[name="commerce-endpoint"]')) return true;
      const host = window.location.hostname;
      if (host.includes(".aem.live") || host.includes(".hlx.live") || host.includes(".aem.page")) return true;
      return false;
    } catch { return false; }
  },
});
registerDetectionRule({
  platformId: "adobe",
  detect: () => {
    try {
      return typeof (window as any).require === "function" &&
        !!(window as any).require.s?.contexts?._.config?.paths?.["Magento_Ui"];
    } catch { return false; }
  },
});

// ── Initialization ─────────────────────────────────────────────

let initialized = false;

function init() {
  if (initialized) return;

  const config = window.__agentikas_config;
  if (!config) return; // Data not ready yet, wait for event

  initialized = true;

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
  }

  const data = window.__agentikas_data ?? {};
  const tools = buildTools(config, data);

  if (tools.length === 0) {
    console.warn("[Agentikas] No tools built. Check vertical, config.tools, and preloaded data.");
  }

  const executorMap = getExecutors(config.vertical, config.platform);
  if (!executorMap) {
    console.error(`[Agentikas] No executors for vertical "${config.vertical}" platform "${config.platform}"`);
    return;
  }

  const executableTools = buildExecutableTools(tools, executorMap, data, config);

  // Always expose tools on window (for testing + extensions)
  (window as any).__agentikas_tools = executableTools;

  // Register in navigator.modelContext (WebMCP browser API)
  const mc = (navigator as any).modelContext;
  let registeredIn = "window.__agentikas_tools";

  if (mc && typeof mc.registerTool === "function") {
    try {
      for (const tool of executableTools) {
        mc.registerTool(tool);
      }
      registeredIn = "navigator.modelContext + window.__agentikas_tools";
    } catch (err) {
      console.warn("[Agentikas] modelContext.registerTool() failed:", err);
    }
  }

  if (registeredIn === "window.__agentikas_tools") {
    injectJsonLdFallback(config, tools);
  }

  console.log(
    `[Agentikas] ✓ ${executableTools.length} tools registered in ${registeredIn}:`,
    executableTools.map((t) => t.name),
  );

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

// ── Boot: event-driven, non-blocking ───────────────────────────
// Three scenarios, all handled:
//
// 1. Data already in window (inline script ran before us) → init immediately
// 2. Data not yet available → listen for 'agentikas:data-ready' event
// 3. GTM/third-party: no data, platform APIs used → init on DOMContentLoaded

// Try immediately (scenario 1)
if (window.__agentikas_config) {
  init();
}

// Listen for data-ready event (scenario 2: script loaded before inline data)
window.addEventListener("agentikas:data-ready", init);

// Fallback: try on DOMContentLoaded (scenario 3: GTM, no preloaded data)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { init(); autoDetectBlog(); });
} else if (!initialized) {
  // DOM already ready but config might come from GTM (slight delay)
  setTimeout(() => { init(); autoDetectBlog(); }, 0);
}

// ── Blog auto-detection ───────────────────────────────────────
// If no explicit config is set but the page has schema.org Blog/BlogPosting,
// auto-initialize with the blog vertical using data from the DOM.

function autoDetectBlog() {
  if (initialized) return;

  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  let hasBlog = false;
  scripts.forEach((s) => {
    try {
      const data = JSON.parse(s.textContent ?? "");
      const type = data["@type"];
      if (type === "Blog" || type === "BlogPosting") hasBlog = true;
    } catch {}
  });

  if (!hasBlog) return;

  const blogData = readBlogSchemaFromDOM();
  const blogSlug = blogData.blog.url?.split("//")[1]?.split(".")[0] ?? "blog";

  window.__agentikas_config = {
    businessId: blogSlug,
    vertical: "blog",
    platform: "generic",
  };
  window.__agentikas_data = blogData;

  console.log("[Agentikas] Auto-detected blog from schema.org:", blogData.blog.name);
  init();
}

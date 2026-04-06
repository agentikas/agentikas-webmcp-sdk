/**
 * E2E tests: Agentikas WebMCP SDK on Adobe Commerce EDS (ACCS store).
 */

import { test, expect } from "@playwright/test";

const SDK_URL = "https://cdn.agentikas.ai/webmcp.0.10.3.min.js";
const STORE_URL = "https://main--accs-adobe-store--demo-system-stores.aem.live/";

async function injectSDK(page: any) {
  await page.evaluate((sdkUrl: string) => {
    (window as any).__agentikas_config = {
      businessId: "accs-adobe-store",
      vertical: "retail",
      debug: true,
    };
    const s = document.createElement("script");
    s.src = sdkUrl;
    document.head.appendChild(s);
  }, SDK_URL);

  await page.waitForFunction(
    () => (window as any).__agentikas_tools?.length > 0,
    { timeout: 15000 },
  );
}

async function executeTool(page: any, toolName: string, args: any) {
  return page.evaluate(
    async ({ toolName, args }: { toolName: string; args: any }) => {
      const tool = (window as any).__agentikas_tools.find(
        (t: any) => t.name === toolName,
      );
      if (!tool) throw new Error(`Tool "${toolName}" not found`);
      return await tool.execute(args);
    },
    { toolName, args },
  );
}

test.describe("Adobe EDS E2E: SDK injection", () => {
  test("detects adobe-eds platform and registers 4 tools", async ({ page }) => {
    await page.goto(STORE_URL);
    await injectSDK(page);

    const toolNames = await page.evaluate(() =>
      (window as any).__agentikas_tools.map((t: any) => t.name),
    );

    expect(toolNames).toContain("search_products");
    expect(toolNames).toContain("get_product");
    expect(toolNames).toContain("check_stock");
    expect(toolNames).toContain("add_to_cart");
  });
});

test.describe("Adobe EDS E2E: search and product", () => {
  test("search for 'shirt' returns results", async ({ page }) => {
    await page.goto(STORE_URL);
    await injectSDK(page);

    const result = await executeTool(page, "search_products", { query: "shirt" });
    const text = result.content[0].text;
    expect(text).toContain("shirt");
    expect(text).not.toContain("No products found");
  });

  test("get_product returns product details by SKU", async ({ page }) => {
    await page.goto(STORE_URL);
    await injectSDK(page);

    const result = await executeTool(page, "get_product", { product_id: "ADB169" });
    const text = result.content[0].text;
    expect(text).toContain("ADB169");
  });

  test("add_to_cart adds product successfully", async ({ page }) => {
    await page.goto(STORE_URL);
    await injectSDK(page);

    const result = await executeTool(page, "add_to_cart", {
      product_id: "ADB169",
      size: "Default",
      quantity: 1,
    });
    const text = result.content[0].text;
    expect(text).toContain("Added");
    expect(text).toContain("cart");
  });
});

/**
 * E2E tests: Agentikas WebMCP SDK on a real Shopify store.
 * Injects the SDK, searches products, gets variants, checks stock, adds to cart.
 *
 * Target: mollyjogger.com (real Shopify store)
 */

import { test, expect } from "@playwright/test";

const SDK_URL = "https://cdn.agentikas.ai/webmcp.0.8.0.min.js";
const STORE_URL = "https://www.mollyjogger.com";

// Helper: inject SDK and wait for tools
async function injectSDK(page: any) {
  await page.evaluate((sdkUrl: string) => {
    (window as any).__agentikas_config = {
      businessId: "mollyjogger",
      vertical: "retail",
      debug: true,
    };
    const s = document.createElement("script");
    s.src = sdkUrl;
    document.head.appendChild(s);
  }, SDK_URL);

  // Wait for tools to be registered
  await page.waitForFunction(
    () => (window as any).__agentikas_tools?.length > 0,
    { timeout: 10000 },
  );
}

// Helper: execute a tool by name
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

test.describe("Shopify E2E: SDK injection", () => {
  test("detects Shopify platform and registers 4 tools", async ({ page }) => {
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

test.describe("Shopify E2E: search → get_product → add_to_cart", () => {
  test("search for 'chair' returns results", async ({ page }) => {
    await page.goto(STORE_URL);
    await injectSDK(page);

    const result = await executeTool(page, "search_products", { query: "chair" });
    expect(result.content[0].text).toContain("chair");
  });

  test("get_product shows variants with stock status", async ({ page }) => {
    await page.goto(STORE_URL);
    await injectSDK(page);

    const result = await executeTool(page, "get_product", {
      product_id: "riverside-chair",
    });

    const text = result.content[0].text;
    expect(text).toContain("Riverside Chair");
    expect(text).toContain("Variants");
    // Should show stock status
    expect(text).toMatch(/In stock|Out of stock/);
  });

  test("full flow: search → find in-stock variant → add to cart", async ({ page }) => {
    await page.goto(STORE_URL);
    await injectSDK(page);

    // 1. Search
    const searchResult = await executeTool(page, "search_products", {
      query: "chair",
    });
    expect(searchResult.content[0].text).toContain("Riverside Chair");

    // 2. Get product details with variants
    const productResult = await executeTool(page, "get_product", {
      product_id: "riverside-chair",
    });
    const productText = productResult.content[0].text;

    // 3. Parse variants to find one in stock
    const inStockMatch = productText.match(
      /- (.+?) — .+? \(In stock\) \[variant_id: (\d+)\]/,
    );
    expect(inStockMatch).toBeTruthy();

    const inStockVariantName = inStockMatch![1];
    const inStockVariantId = inStockMatch![2];

    // 4. Add the in-stock variant to cart
    const cartResult = await executeTool(page, "add_to_cart", {
      product_id: "riverside-chair",
      size: inStockVariantName,
    });

    expect(cartResult.content[0].text).toContain("Added");
    expect(cartResult.content[0].text).toContain("cart");
  });
});

test.describe("Shopify E2E: simple product (no variants)", () => {
  test("add simple product to cart", async ({ page }) => {
    await page.goto(STORE_URL);
    await injectSDK(page);

    // Search for sticker (simple product)
    const searchResult = await executeTool(page, "search_products", {
      query: "sticker",
    });
    expect(searchResult.content[0].text).toContain("Sticker");

    // Get product — should be simple (Default Title)
    const productResult = await executeTool(page, "get_product", {
      product_id: "ozark-hellbender-1",
    });
    const text = productResult.content[0].text;
    expect(text).toContain("Ozark Hellbender");

    // Add to cart — simple product, just use "Default"
    const cartResult = await executeTool(page, "add_to_cart", {
      product_id: "ozark-hellbender-1",
      size: "Default",
    });
    expect(cartResult.content[0].text).toContain("Added");
    expect(cartResult.content[0].text).toContain("cart");
  });
});

test.describe("Shopify E2E: product with size variants", () => {
  test("search → get_product → pick in-stock size → add to cart", async ({ page }) => {
    await page.goto(STORE_URL);
    await injectSDK(page);

    // 1. Search
    const searchResult = await executeTool(page, "search_products", {
      query: "t-shirt",
    });
    const searchText = searchResult.content[0].text;

    // Find a tshirt handle from results
    const handleMatch = searchText.match(/arrowhead-canoe/);
    if (!handleMatch) {
      // If not found by that name, try another
      console.log("Arrowhead not in search results, skipping variant test");
      return;
    }

    // 2. Get product with variants
    const productResult = await executeTool(page, "get_product", {
      product_id: "arrowhead-canoe-1922",
    });
    const productText = productResult.content[0].text;
    expect(productText).toContain("Size");

    // 3. Find in-stock size
    const inStockSize = productText.match(
      /- (.+?) — .+? \(In stock\)/,
    );

    if (!inStockSize) {
      console.log("No in-stock sizes, skipping add to cart");
      return;
    }

    // 4. Add to cart with the in-stock size
    const cartResult = await executeTool(page, "add_to_cart", {
      product_id: "arrowhead-canoe-1922",
      size: inStockSize[1].trim(),
    });
    expect(cartResult.content[0].text).toContain("Added");
  });

  test("out-of-stock size is rejected", async ({ page }) => {
    await page.goto(STORE_URL);
    await injectSDK(page);

    // Get product
    const productResult = await executeTool(page, "get_product", {
      product_id: "arrowhead-canoe-1922",
    });
    const productText = productResult.content[0].text;

    // Find out-of-stock variant
    const oosMatch = productText.match(
      /- (.+?) — .+? \(Out of stock\)/,
    );

    if (!oosMatch) {
      console.log("No out-of-stock sizes found, skipping");
      return;
    }

    // Try to add out-of-stock size
    const cartResult = await executeTool(page, "add_to_cart", {
      product_id: "arrowhead-canoe-1922",
      size: oosMatch[1].trim(),
    });

    // Should fail — not available
    expect(cartResult.content[0].text).toMatch(/not available|options/i);
  });
});

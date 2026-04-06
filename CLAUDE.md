# Agentikas WebMCP SDK

## What this is
SDK that makes any website visible to AI agents via `navigator.modelContext.registerTool()`.
Supports multiple verticals (restaurant, retail) and platforms (Shopify, WooCommerce, Adobe Commerce).

## Architecture

```
src/
├── types.ts                  Core types (ToolDefinition, PlatformAdapter, etc.)
├── registry.ts               Vertical + platform registry
├── loader.ts                 Standalone entry point (builds dist/webmcp.js)
├── provider.tsx              React component (for npm consumers)
├── wrap-executor.ts          Telemetry wrapper (sync + async)
├── detect.ts                 Platform auto-detection
├── telemetry.ts              GA4 dataLayer events
└── verticals/
    ├── restaurant/            Restaurant vertical
    │   ├── tools.ts           Tool definitions (4 tools)
    │   ├── executors.ts       Agentikas platform executors
    │   ├── types.ts           RestaurantInfo, MenuItem, etc.
    │   └── utils.ts           Allergens, menu filtering
    └── retail/                Retail vertical
        ├── tools.ts           Tool definitions (4 tools)
        ├── executors.ts       Generic/preloaded executors
        ├── types.ts           Product, RetailData
        └── platforms/
            ├── shopify.ts     Shopify APIs (/search/suggest.json, /products/*.json)
            ├── woocommerce.ts WooCommerce Store API (/wp-json/wc/store/v1/*)
            ├── adobe.ts       Classic Magento 2 REST API (/rest/V1/*)
            └── adobe-eds.ts   Adobe Commerce EDS (Catalog Service GraphQL)
```

## Commands

```bash
npm test              # Run all tests (vitest)
npm run build         # Build dist/webmcp.js (esbuild, ~23KB)
npm run test:watch    # Watch mode
```

## TDD Rules — MANDATORY

Every change to this SDK MUST follow test-driven development:

### 1. Test first, code second

**Never write or modify source code without a failing test first.**

- Bug report? Write a test that reproduces the bug. See it fail. Then fix.
- New platform? Capture real API fixtures. Write tests. See them fail. Then implement.
- New feature? Write the expected behavior as a test. See it fail. Then build.

### 2. Real data fixtures

Platform adapters MUST be tested against real API responses, not hand-crafted mocks.

```bash
# Capture a real response
curl 'https://STORE.com/api/search?q=test' > tests/fixtures/platform-search.json

# Write test that normalizes it
it("normalizes real search result", () => {
  const p = normalizeProduct(fixture[0]);
  expect(p.id).toBeTruthy();     // fails if normalizer doesn't handle real format
  expect(p.price).toBeGreaterThan(0);
});
```

Fixtures live in `tests/fixtures/`. Name them: `{platform}-{endpoint}-{query}.json`

### 3. The TDD cycle

```
RED:    Write test → npm test → test fails (expected)
GREEN:  Write minimum code → npm test → test passes
REFACTOR: Clean up → npm test → still passes
COMMIT: git add + commit
```

### 4. Adding a new platform

Step-by-step, in order:

```bash
# 1. Capture real API responses
curl 'https://store.com/api/search?q=shirt' > tests/fixtures/newplatform-search.json
curl 'https://store.com/api/product/123' > tests/fixtures/newplatform-product.json

# 2. Create test file: tests/newplatform-real-data.test.ts
#    Import fixture, write tests that normalize it
#    npm test → RED (normalizer doesn't exist)

# 3. Create adapter: src/verticals/retail/platforms/newplatform.ts
#    Implement normalizer + executors
#    npm test → GREEN

# 4. Register in src/loader.ts
#    Add detection rule
#    npm test → still GREEN

# 5. Build and test in real browser
#    npm run build
#    Inject in a real store via console
```

### 5. Fixing a bug

```bash
# 1. Reproduce with a test
it("handles missing price field", () => {
  const raw = { ...fixture, price: undefined };
  const p = normalize(raw);        // crashes → RED
  expect(p.price).toBe(0);
});

# 2. Fix the code
# 3. npm test → GREEN
# 4. Commit
```

### 6. Test categories

| Category | Files | What they test |
|---|---|---|
| Core | registry, detect, telemetry, types, wrap-executor | SDK infrastructure |
| Verticals | restaurant-tools, restaurant-executors, restaurant-utils | Vertical logic |
| Normalizers | normalizers, normalizers-eds | Data conversion |
| Real data | shopify-real-data, woocommerce-real-data, adobe-eds-real-data | Real API responses |
| Lazy mode | lazy-mode | Empty data handling |
| Integration | retail-vertical | End-to-end vertical |

### 7. What NOT to do

- Do NOT write code "to be tested later"
- Do NOT skip tests for "simple changes"
- Do NOT hand-craft fixture data when real API responses are available
- Do NOT modify a normalizer without a failing test first
- Do NOT deploy to CDN without `npm test` passing

## Defensive coding

All tool factories and executors MUST handle empty/missing data:

```ts
// BAD: crashes if data is empty
const search: ToolFactory = ({ store }) => ({ ... })

// GOOD: works with or without data
const search: ToolFactory = (data) => ({
  description: `Search products${data?.store?.name ? ` in ${data.store.name}` : ''}`,
})
```

This is required for the GTM use case where `__agentikas_data` may not exist.

## Browser API

The SDK registers tools via `navigator.modelContext.registerTool(tool)` (Chrome Canary WebMCP flag).
Always also exposes `window.__agentikas_tools` as fallback for testing + extensions.

## CDN deployment

```bash
npm run build
npx wrangler r2 object put agentikas-media/webmcp.X.Y.Z.min.js --file=dist/webmcp.js --content-type=application/javascript --remote
```

Update version in the restaurant template layout.tsx when deploying.

## Key patterns

- **Tool factories**: `(data) => ToolDefinition` — build tool schemas, defensive with data
- **Executor factories**: `(data) => (args) => ToolResult | Promise<ToolResult>` — execute tool logic
- **Platform adapters**: `{ id, name, detect?, executors }` — platform-specific executors
- **Normalizers**: Convert platform-specific data → common `Product` interface
- **Event-driven loading**: loader.ts listens for `agentikas:data-ready` event

# TDD Prompts for Agentikas WebMCP SDK

Prompts used to develop this SDK following test-driven development.
Each prompt documents what was asked, what tests were written first, and what code was changed.

---

## Adding a new platform

### Prompt
```
"Quiero que el SDK funcione para Shopify"
```

### TDD cycle

**1. Capture fixtures**
```bash
curl 'https://www.mollyjogger.com/search/suggest.json?q=chair&resources%5Btype%5D=product' > tests/fixtures/shopify-search-chair.json
curl 'https://www.mollyjogger.com/products/riverside-chair.json' > tests/fixtures/shopify-product-riverside-chair.json
```

**2. Write tests (RED)**
```
tests/shopify-real-data.test.ts
- normalizes search result without crashing
- correct fields (id, name, price, currency, inStock)
- description strips HTML
- search handle matches product detail handle
```

**3. Implement (GREEN)**
```
src/verticals/retail/platforms/shopify.ts
- ShopifySearchProduct type (from suggest.json)
- normalizeShopifySearchProduct()
- ShopifyProduct type (from /products/handle.json)
- normalizeShopifyProduct()
- Platform adapter with executors
```

---

## Fixing stock detection

### Prompt
```
"Quiero que las APIs tengan en consideración las variaciones de producto y que compruebe stock"
```

### TDD cycle

**1. Capture more fixtures**
```bash
curl 'https://www.mollyjogger.com/products/arrowhead-canoe-1922.json' > tests/fixtures/shopify-product-tshirt.json
curl 'https://www.mollyjogger.com/products/ozark-hellbender-1.json' > tests/fixtures/shopify-product-simple-sticker.json
```

**2. Write tests (RED)**
```
tests/shopify-add-to-cart.test.ts
- simple product: detects in stock via inventory_quantity > 0
- tshirt Medium: in stock (qty 2)
- tshirt 2XLarge: out of stock (qty 0)
- chair Sundown Brown: in stock (qty 1)
- chair Riverside Teal: out of stock (qty 0)
```

**3. Failures**
```
3 tests failed:
- normalizer used v.available but real responses have inventory_quantity
```

**4. Fix (GREEN)**
```
Added isVariantAvailable() helper:
1. v.available (if present)
2. v.inventory_policy === "continue" (sell when OOS)
3. v.inventory_quantity > 0
```

---

## Adding variant support to get_product

### Prompt
```
"Cuando se utiliza search_products y luego se quiere añadir al carrito, pide que seleccione tamaño o color"
```

### Implementation
```
get_product executor rewritten to show:
- All product options (Size, Color) with values
- Every variant with: option combination, price, stock status, variant_id
- Instructions for AI to call add_to_cart with correct variant

add_to_cart accepts:
- Option value (e.g. "Medium", "Sundown Brown")
- variant_id (numeric)
- Falls back to single variant for simple products
```

---

## Adobe Commerce EDS adapter

### Prompt
```
"Quiero hacer el SDK para Adobe Commerce Edge Delivery Services"
```

### TDD cycle

**1. Research APIs**
- Catalog Service GraphQL: `catalog-service.adobe.io/graphql`
- Core Commerce GraphQL: merchant-specific
- Drop-in Components: not accessible from external scripts

**2. Capture fixtures**
```bash
curl -X POST "https://catalog-service-sandbox.adobe.io/graphql" \
  -H "Magento-Environment-Id: ENV_ID" \
  -H "Magento-Store-Code: STORE" \
  -H "x-api-key: storefront-widgets" \
  -d '{"query":"..."}' > tests/fixtures/adobe-eds-search-phone.json
```

**3. Multiple iterations (RED → GREEN cycles)**

| Iteration | Error | Fix |
|---|---|---|
| 1 | `Cannot query field "price" on type "ProductView"` | Changed to `priceRange` |
| 2 | `Cannot query field "priceRange" on type "ProductView"` | Used inline fragments: `... on SimpleProductView { price }` `... on ComplexProductView { priceRange }` |
| 3 | CORS blocked on core endpoint | Switched to Catalog Service endpoint (CORS open) |
| 4 | 0 results returned | Used `product` field + visibility filter + customerGroup context (same as storefront's LiveSearchAutocomplete) |
| 5 | Wrong store-code header (`default` instead of `citisignal_store`) | Fixed configs.json key mapping: `commerce-store-code` not `store-code` |

---

## Lazy mode (no preloaded data)

### Prompt
```
"El SDK crashea cuando se carga via GTM en webs de terceros"
```

### TDD cycle

**1. Write tests (RED)**
```
tests/lazy-mode.test.ts
- restaurant tools build with data = {}
- restaurant tool descriptions are generic without data
- retail tools build with data = {}
- restaurant executors create without crashing on empty data
- restaurant get_business_info returns 'no data' message
```

**2. Fix (GREEN)**
```
Changed all tool factories and executors from:
  ({ store }) => ...        // destructuring crashes on {}
To:
  (data) => ...             // safe access with data?.store?.name
```

---

## Tool descriptions guide AI behavior

### Prompt
```
"No crees que search y get_product deberían encadenarse automáticamente?"
```

### Implementation
```
search_products description changed to:
  "...After finding a product, always call get_product with its product_id
   to see available variants (sizes, colors) before adding to cart."

get_product description changed to:
  "...Always call this before add_to_cart to show the user their options."
```

This makes the AI chain calls automatically in a single turn.

---

## Pattern: how to use this file

When starting a new feature or fix:

1. Find the most similar prompt above
2. Follow the same TDD cycle
3. Document your prompt and cycle here when done

This file serves as:
- **Training data** for agents working on the SDK
- **Documentation** of design decisions
- **Proof** that every change was test-driven

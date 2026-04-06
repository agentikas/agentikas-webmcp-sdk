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

---

## Backlog: prompts pendientes de testear

### Nuevas plataformas

```
P01: "Haz que el SDK funcione en PrestaShop. Prueba en https://demo.prestashop.com"
```
- Capturar fixtures de la PrestaShop API
- Detección: `window.prestashop`
- APIs: `/api/products`, `/api/search`

```
P02: "Haz que el SDK funcione en BigCommerce. Prueba en una tienda real."
```
- Capturar fixtures de Storefront API
- Detección: `window.BigCommerce`
- APIs: `/api/storefront/products`, `/api/storefront/cart`

```
P03: "Haz que funcione en una web genérica que tenga schema.org Product en JSON-LD"
```
- Scrapear `<script type="application/ld+json">` del DOM
- Normalizar schema.org Product → Product interface
- No necesita API — todo está en el HTML

### Edge cases en Shopify

```
P04: "Un producto de Shopify tiene 3 opciones: Size, Color y Material. Asegúrate que get_product muestre las 3 y add_to_cart las combine correctamente."
```
- Capturar fixture de producto con 3 opciones
- Test: variant matching con option1 + option2 + option3

```
P05: "Un producto de Shopify tiene precios con descuento (compare_at_price). Muestra el precio original y el descuento."
```
- Capturar fixture con compare_at_price > 0
- Test: normalizer extrae precio original y final

```
P06: "Buscar en Shopify devuelve productos en múltiples monedas. Asegúrate que la currency sea correcta."
```
- Probar en tienda con multi-currency activo
- Test: currency viene de Shopify.currency.active, no hardcodeada

```
P07: "Un producto de Shopify está agotado pero permite backorders (inventory_policy: continue). El SDK debe permitir añadirlo al carrito."
```
- Fixture con inventory_quantity=0 pero inventory_policy="continue"
- Test: isVariantAvailable devuelve true

### Edge cases en Adobe Commerce EDS

```
P08: "Productos configurables en Adobe Commerce tienen variantes con precios distintos por talla. Muéstralos."
```
- Capturar fixture de ComplexProductView con priceRange
- Test: normalizer usa priceRange.minimum

```
P09: "Una tienda Adobe Commerce tiene múltiples store views (idiomas). El SDK debe usar el store view correcto."
```
- Test: headers Magento-Store-View-Code se leen de configs.json

```
P10: "El endpoint de Catalog Service cambia en producción vs sandbox. Verifica que auto-detecta."
```
- Test: isSandbox flag se detecta correctamente
- Test: usa endpoint correcto según flag

### Nuevas verticales

```
P11: "Crea una vertical de hotel con tools: search_rooms, get_room, check_availability, book_room"
```
- TDD: definir tipos HotelData, Room
- Fixtures: inventar datos realistas
- Tests: tool factories, executors, lazy mode

```
P12: "Crea una vertical de servicios (peluquería, clínica) con tools: get_services, check_availability, book_appointment"
```
- Similar a restaurant pero con slots de tiempo
- Fixtures con calendario de disponibilidad

### Robustez y errores

```
P13: "El SDK debe funcionar cuando la API de Shopify devuelve un 429 (rate limit). Implementa retry con backoff."
```
- Test: mock fetch que devuelve 429, luego 200
- Implementar: exponential backoff en gqlFetch / fetch

```
P14: "El SDK debe funcionar cuando la red falla temporalmente. Muestra un mensaje amigable en vez de crashear."
```
- Test: mock fetch que lanza TypeError (network error)
- Test: executor devuelve ToolResult con mensaje de error, no throw

```
P15: "Un producto de Shopify tiene imágenes pero la CDN de Shopify está caída. El normalizer no debe crashear."
```
- Fixture con images: [] o images: null
- Test: normalizer devuelve imageUrl undefined, no crash

### Telemetría y analytics

```
P16: "Cada búsqueda que no devuelve resultados debe loguearse como evento de telemetría 'ai_search_no_results'."
```
- Test: search con 0 resultados → dataLayer.push con evento específico
- Útil para el dashboard Pro (búsquedas fallidas)

```
P17: "Trackear qué agente IA invoca los tools (si se puede detectar del User-Agent o de la API)."
```
- Investigar si navigator.modelContext expone info del agente
- Test: evento incluye agent_source si disponible

### Performance

```
P18: "El SDK tarda >500ms en inicializar en una web lenta. Optimiza para que no bloquee."
```
- Medir: performance.now() antes y después de init
- Test: init completa en <100ms (sin fetch)

```
P19: "Cachear resultados de búsqueda por 5 minutos para evitar llamadas repetidas."
```
- Test: segunda búsqueda con mismo query devuelve resultado cacheado sin fetch
- Test: cache expira después de 5 minutos

### Multi-idioma

```
P20: "Las descripciones de los tools deben adaptarse al idioma del store (no del browser)."
```
- Test: tool description en español cuando store es español
- Investigar: ¿merece la pena? Los agentes IA entienden cualquier idioma

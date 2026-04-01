# Agentikas WebMCP SDK

Make any website visible to AI agents.

The SDK exposes structured tools via the [WebMCP](https://github.com/nicolo-ribaudo/tc39-proposal-modelcontext) browser API (`navigator.modelContext`), allowing AI agents like ChatGPT, Claude, and Gemini to interact with your website — search menus, check availability, make reservations, add products to cart, and more.

## Quick Start

```bash
npm install @agentikas/webmcp-sdk
```

### 1. Initialize the SDK

```tsx
import { initAgentikas, buildTools } from '@agentikas/webmcp-sdk';

// Register built-in verticals (restaurant, etc.)
initAgentikas();
```

### 2. Build tools from your business data

```tsx
import { buildTools, type AgentikasConfig } from '@agentikas/webmcp-sdk';

const config: AgentikasConfig = {
  businessId: 'my-restaurant',
  vertical: 'restaurant',
  platform: 'agentikas',
};

const tools = buildTools(config, {
  restaurant: restaurantInfo,   // RestaurantInfo object
  allItems: menuItems,          // MenuItem[] array
});
```

### 3. Provide tools to AI agents

```tsx
import { WebMCPProvider } from '@agentikas/webmcp-sdk/provider';

// In your React component (e.g. layout.tsx):
<WebMCPProvider
  config={config}
  data={{ restaurant: restaurantInfo, allItems: menuItems }}
  tools={tools}
/>
```

That's it. When an AI agent visits the page, it discovers the tools and can use them.

---

## Architecture

The SDK has three dimensions:

| Dimension | What it defines | Example |
|-----------|----------------|---------|
| **Vertical** | What tools exist (schemas) | `restaurant`: get_menu, make_reservation |
| **Platform** | How tools execute (data source) | `agentikas`: pre-loaded from Supabase |
| **Config** | Which tools to activate | `tools: ['info', 'menu']` |

```
                    SERVER                              CLIENT (Browser)
                    ──────                              ──────
initAgentikas()     registers verticals + platforms
                         │
buildTools(config, data) builds ToolDefinition[]
                         │
                    ─── props (serializable) ───>   WebMCPProvider
                                                         │
                                              getExecutors(vertical, platform)
                                                         │
                                              tools.map(def + executor)
                                                         │
                                              navigator.modelContext.provideContext()
                                                         │
                                                    AI agent calls tools
```

---

## Concepts

### Vertical

A vertical defines **what** a business does and **what tools** it offers to AI agents.

```tsx
import type { VerticalDefinition, ToolFactory } from '@agentikas/webmcp-sdk';

interface MyData {
  shopName: string;
  products: Product[];
}

const searchProducts: ToolFactory<MyData> = ({ shopName, products }) => ({
  name: 'search_products',
  description: `Search products in ${shopName}`,
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
});

const myVertical: VerticalDefinition<MyData> = {
  id: 'commerce',
  name: 'Commerce',
  tools: {
    search: searchProducts,     // short name for config
    // cart: addToCart,
    // product: getProduct,
  },
  defaultTools: ['search'],
};
```

The **short names** (`search`, `cart`) are what you use in `config.tools`. The **long names** (`search_products`, `add_to_cart`) are what AI agents see.

### Platform

A platform defines **how** tools get their data. Same vertical, different platforms:

```tsx
import type { ExecutorMap } from '@agentikas/webmcp-sdk';

// Platform: data already loaded (e.g. server-rendered Next.js)
const preloadedExecutors: ExecutorMap<MyData> = {
  search_products: ({ products }) => ({ query }) => {
    const results = products.filter(p => p.name.includes(query));
    return { content: [{ type: 'text', text: JSON.stringify(results) }] };
  },
};

// Platform: data from Shopify client-side APIs
const shopifyExecutors: ExecutorMap<MyData> = {
  search_products: () => async ({ query }) => {
    const res = await fetch(`/search/suggest.json?q=${query}`);
    const data = await res.json();
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  },
};
```

Register them:

```tsx
import { registerVertical, registerPlatform } from '@agentikas/webmcp-sdk';

registerVertical(myVertical, preloadedExecutors, 'preloaded');
registerPlatform('commerce', {
  id: 'shopify',
  name: 'Shopify',
  detect: () => !!(window as any).Shopify,
  executors: shopifyExecutors,
});
```

### Config

The config tells the SDK which vertical, platform, and tools to use:

```tsx
const config: AgentikasConfig = {
  businessId: 'my-shop',
  vertical: 'commerce',
  platform: 'shopify',             // optional — defaults to the vertical's default platform
  tools: ['search', 'cart'],       // optional — defaults to the vertical's defaultTools
  debug: true,                     // optional — logs to console
};
```

---

## Built-in Restaurant Vertical

The SDK ships with a complete restaurant vertical:

### Tools

| Short name | Tool name | Description |
|-----------|-----------|-------------|
| `info` | `get_business_info` | Location, hours, contact, cuisine, features |
| `menu` | `get_menu` | Full menu with allergen filtering (EU 1169/2011) |
| `availability` | `check_availability` | Table availability for date/time/party size |
| `booking` | `make_reservation` | Create a reservation |

### Usage

```tsx
import { initAgentikas, buildTools, type AgentikasConfig } from '@agentikas/webmcp-sdk';
import { WebMCPProvider } from '@agentikas/webmcp-sdk/provider';
import type { RestaurantData } from '@agentikas/webmcp-sdk/verticals/restaurant';

initAgentikas();

const config: AgentikasConfig = {
  businessId: 'los-granainos',
  vertical: 'restaurant',
};

// Your data (from database, API, etc.)
const data: RestaurantData = {
  restaurant: { name: 'Los Granainos', /* ... */ },
  allItems: [ { name: 'Paella', price: 24, allergens: ['crustaceans', 'fish'], /* ... */ } ],
};

const tools = buildTools(config, data);

// In your component:
<WebMCPProvider config={config} data={data} tools={tools} />
```

### Activate only specific tools

```tsx
const config: AgentikasConfig = {
  businessId: 'los-granainos',
  vertical: 'restaurant',
  tools: ['info', 'menu'],        // only info + menu, no booking
};
```

### Restaurant utilities

The restaurant vertical also exports domain utilities:

```tsx
import {
  ALLERGENS,                    // EU 14 allergens with icons
  filterMenuItems,              // Filter by tag, search, allergens
  getNumericAllergens,          // Convert string allergens to numbers
  numberToStringAllergens,      // Convert numbers to string allergens
  slugify,                      // URL-safe slugs
} from '@agentikas/webmcp-sdk/verticals/restaurant';

// Filter menu items excluding gluten (1) and dairy (7)
const safe = filterMenuItems(items, { excludeAllergens: [1, 7] });

// Search by name
const results = filterMenuItems(items, { search: 'paella' });
```

---

## Telemetry (GA4)

Every tool call automatically pushes an event to Google Analytics 4 via `dataLayer`. This works when GTM is installed — silent no-op otherwise.

### Event format

```json
{
  "event": "ai_tool_call",
  "tool_name": "get_menu",
  "tool_status": "success",
  "tool_duration_ms": 12,
  "tool_vertical": "restaurant",
  "tool_platform": "agentikas"
}
```

In GA4, you'll see a new dimension: **AI agent traffic** alongside Organic, Paid, and Social.

No personal data is ever sent. No cookies. GDPR-safe.

---

## Platform Detection

For the GTM loader use case, the SDK can auto-detect which platform a website runs on:

```tsx
import { detectPlatform, registerDetectionRule } from '@agentikas/webmcp-sdk';

registerDetectionRule({
  platformId: 'shopify',
  detect: () => !!(window as any).Shopify,
});

registerDetectionRule({
  platformId: 'woocommerce',
  detect: () => !!document.querySelector('.woocommerce'),
});

const platform = detectPlatform(); // 'shopify', 'woocommerce', or 'generic'
```

---

## Creating a Custom Vertical

To create your own vertical (e.g. hotel booking, healthcare, etc.):

### Step 1: Define tool factories

```tsx
// verticals/hotel/tools.ts
import type { VerticalDefinition, ToolFactory } from '@agentikas/webmcp-sdk';

interface HotelData {
  hotel: { name: string; rooms: Room[] };
}

const searchRooms: ToolFactory<HotelData> = ({ hotel }) => ({
  name: 'search_rooms',
  description: `Search available rooms at ${hotel.name}`,
  input_schema: {
    type: 'object',
    properties: {
      check_in: { type: 'string', description: 'Check-in date (YYYY-MM-DD)' },
      check_out: { type: 'string', description: 'Check-out date (YYYY-MM-DD)' },
      guests: { type: 'number', description: 'Number of guests' },
    },
    required: ['check_in', 'check_out', 'guests'],
  },
});

export const hotel: VerticalDefinition<HotelData> = {
  id: 'hotel',
  name: 'Hotel',
  tools: { rooms: searchRooms },
  defaultTools: ['rooms'],
};
```

### Step 2: Define executors

```tsx
// verticals/hotel/executors.ts
import type { ExecutorMap } from '@agentikas/webmcp-sdk';

export const hotelExecutors: ExecutorMap<HotelData> = {
  search_rooms: ({ hotel }) => ({ check_in, check_out, guests }) => {
    const available = hotel.rooms.filter(r => r.maxGuests >= guests);
    return {
      content: [{
        type: 'text',
        text: `Found ${available.length} rooms at ${hotel.name} for ${guests} guests.`,
      }],
    };
  },
};
```

### Step 3: Register

```tsx
import { registerVertical } from '@agentikas/webmcp-sdk';
import { hotel } from './verticals/hotel/tools';
import { hotelExecutors } from './verticals/hotel/executors';

registerVertical(hotel, hotelExecutors);
```

---

## API Reference

### Core

| Function | Description |
|----------|-------------|
| `initAgentikas()` | Register built-in verticals. Call once at startup. |
| `buildTools(config, data)` | Build `ToolDefinition[]` from config + business data. |
| `registerVertical(def, executors, platformId?)` | Register a vertical with its default platform. |
| `registerPlatform(verticalId, adapter)` | Add a platform adapter to an existing vertical. |
| `getExecutors(verticalId, platformId?)` | Get executor map for a vertical/platform. |
| `hasVertical(id)` | Check if a vertical is registered. |

### Detection

| Function | Description |
|----------|-------------|
| `detectPlatform()` | Run detection rules, return matching platform ID or `'generic'`. |
| `registerDetectionRule(rule)` | Register a platform detection rule. |

### Telemetry

| Function | Description |
|----------|-------------|
| `trackToolCall(name, status, ms, vertical, platform)` | Push `ai_tool_call` event to GA4 via `dataLayer`. |

### Components

| Component | Description |
|-----------|-------------|
| `WebMCPProvider` | React component. Combines tool definitions + executors and registers them in `navigator.modelContext`. |

### Types

| Type | Description |
|------|-------------|
| `AgentikasConfig` | SDK configuration (businessId, vertical, platform, tools, debug). |
| `ToolDefinition` | Serializable tool schema (name, description, input_schema). |
| `ToolResult` | What an executor returns: `{ content: [{ type: 'text', text }] }`. |
| `Executor` | `(args) => ToolResult \| Promise<ToolResult>` |
| `ExecutorFactory<TData>` | `(data: TData) => Executor` |
| `ExecutorMap<TData>` | `Record<string, ExecutorFactory<TData>>` |
| `ToolFactory<TData>` | `(data: TData) => ToolDefinition` |
| `VerticalDefinition<TData>` | `{ id, name, tools, defaultTools }` |
| `PlatformAdapter<TData>` | `{ id, name, detect?, executors }` |

---

## Project Structure

```
src/
├── index.ts                          Public API + initAgentikas()
├── types.ts                          Core type definitions
├── registry.ts                       Vertical + platform registry
├── provider.tsx                      WebMCPProvider React component
├── telemetry.ts                      GA4 event tracking
├── detect.ts                         Platform auto-detection
└── verticals/
    └── restaurant/
        ├── index.ts                  Restaurant vertical exports
        ├── types.ts                  RestaurantInfo, MenuItem, Allergen, etc.
        ├── tools.ts                  4 tool factories
        ├── executors.ts              4 executor factories (Agentikas platform)
        └── utils.ts                  Allergens, menu filtering, slugify
```

---

## License

MIT

---

Built by [Agentikas](https://agentikas.ai) — making the web visible to AI agents.

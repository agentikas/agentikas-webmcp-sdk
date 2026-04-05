import { describe, it, expect } from "vitest";
import { restaurant } from "../src/verticals/restaurant/tools";
import { restaurantExecutors } from "../src/verticals/restaurant/executors";
import { retail } from "../src/verticals/retail/tools";
import { retailExecutors } from "../src/verticals/retail/executors";

describe("Lazy mode: tool factories with empty data", () => {
  it("restaurant tools build with data = {}", () => {
    const emptyData = {} as any;
    for (const [name, factory] of Object.entries(restaurant.tools)) {
      const tool = factory(emptyData);
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeTruthy();
    }
  });

  it("restaurant tool descriptions are generic without data", () => {
    const tool = restaurant.tools.info({} as any);
    expect(tool.description).toContain("this restaurant");
    expect(tool.description).not.toContain("undefined");
  });

  it("restaurant menu tool handles empty allItems", () => {
    const tool = restaurant.tools.menu({} as any);
    expect(tool.description).toContain("menu");
    expect(tool.description).not.toContain("undefined");
  });

  it("retail tools build with data = {}", () => {
    const emptyData = {} as any;
    for (const [name, factory] of Object.entries(retail.tools)) {
      const tool = factory(emptyData);
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeTruthy();
    }
  });

  it("retail tool descriptions are generic without data", () => {
    const tool = retail.tools.search({} as any);
    expect(tool.description).toContain("Search products");
    expect(tool.description).not.toContain("undefined");
  });
});

describe("Lazy mode: executor factories with empty data", () => {
  it("restaurant executors create without crashing on empty data", () => {
    const emptyData = {} as any;
    for (const [name, factory] of Object.entries(restaurantExecutors)) {
      const executor = factory(emptyData);
      expect(typeof executor).toBe("function");
    }
  });

  it("restaurant get_business_info returns 'no data' message", () => {
    const executor = restaurantExecutors.get_business_info({} as any);
    const result = executor({});
    expect(result.content[0].text).toContain("No restaurant data available");
  });

  it("restaurant get_menu returns 'no data' message", () => {
    const executor = restaurantExecutors.get_menu({} as any);
    const result = executor({ category: "all" });
    expect(result.content[0].text).toContain("No menu data available");
  });

  it("retail executors create without crashing on empty data", () => {
    const emptyData = {} as any;
    for (const [name, factory] of Object.entries(retailExecutors)) {
      const executor = factory(emptyData);
      expect(typeof executor).toBe("function");
    }
  });

  it("retail search returns 'no data' message on empty data", () => {
    const executor = retailExecutors.search_products({} as any);
    const result = executor({ query: "test" });
    expect(result.content[0].text).toContain("No product data available");
  });
});

describe("Lazy mode: works with preloaded data too", () => {
  const restaurantData = {
    restaurant: { name: "Test", description: "A test", openingHours: [], features: {}, address: {}, contact: {}, cuisine: [], priceRange: "€€" },
    allItems: [{ id: "1", name: "Paella", description: "Rice", price: 24, category: "Main", allergens: [], dietLabels: [], available: true }],
  };

  it("restaurant tools include restaurant name when data provided", () => {
    const tool = restaurant.tools.info(restaurantData as any);
    expect(tool.description).toContain("Test");
  });

  it("restaurant menu includes categories when data provided", () => {
    const tool = restaurant.tools.menu(restaurantData as any);
    expect(tool.description).toContain("Main");
  });

  const retailData = {
    store: { name: "Urban Style", currency: "EUR" },
    products: [{ id: "1", name: "T-Shirt", price: 29.99, currency: "EUR", sizes: ["M"], color: "white", inStock: true }],
  };

  it("retail tools include store name when data provided", () => {
    const tool = retail.tools.search(retailData as any);
    expect(tool.description).toContain("Urban Style");
  });
});

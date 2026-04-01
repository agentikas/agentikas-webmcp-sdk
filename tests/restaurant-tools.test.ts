import { describe, it, expect } from "vitest";
import { restaurant } from "../src/verticals/restaurant/tools";
import type { RestaurantData } from "../src/verticals/restaurant/types";

const mockData: RestaurantData = {
  restaurant: {
    id: "test", name: "Test Restaurant", description: "A test restaurant", shortDescription: "Test food",
    cuisine: ["Spanish"], priceRange: "€€",
    address: { streetAddress: "Calle Test 1", locality: "Madrid", region: "Madrid", postalCode: "28001", country: "ES" },
    geo: { latitude: 40.4168, longitude: -3.7038 },
    contact: { phone: "+34600000000", whatsapp: "+34600000000", website: "https://test.agentikas.ai" },
    openingHours: [{ dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "13:00", closes: "23:00" }],
    features: { hasTerraza: true, hasParking: false, isAccessible: true, acceptsReservations: true, acceptsGroups: true, hasPrivateRoom: false },
    images: { hero: "/hero.jpg", logo: "/logo.jpg" },
  },
  allItems: [
    { id: "1", name: "Paella", description: "Rice dish", price: 24, category: "Arroces", allergens: ["crustaceans", "fish"], dietLabels: [], available: true, tags: ["marisco"] },
    { id: "2", name: "Ensalada", description: "Fresh salad", price: 8, category: "Entrantes", allergens: [], dietLabels: ["vegetarian"], available: true, tags: ["vegetariano"], highlight: true },
    { id: "3", name: "Tarta", description: "Chocolate cake", price: 6, category: "Postres", allergens: ["gluten", "eggs", "milk"], dietLabels: [], available: true, tags: ["postres"] },
  ],
};

describe("Restaurant vertical definition", () => {
  it("has correct id and name", () => {
    expect(restaurant.id).toBe("restaurant");
    expect(restaurant.name).toBe("Restaurant");
  });

  it("has 4 tools", () => {
    expect(Object.keys(restaurant.tools)).toEqual(["info", "menu", "availability", "booking"]);
  });

  it("defaultTools includes all 4", () => {
    expect(restaurant.defaultTools).toEqual(["info", "menu", "availability", "booking"]);
  });
});

describe("Tool factories", () => {
  it("info factory includes restaurant name in description", () => {
    const tool = restaurant.tools.info(mockData);
    expect(tool.name).toBe("get_business_info");
    expect(tool.description).toContain("Test Restaurant");
  });

  it("menu factory includes category names in description", () => {
    const tool = restaurant.tools.menu(mockData);
    expect(tool.name).toBe("get_menu");
    expect(tool.description).toContain("Arroces");
    expect(tool.description).toContain("Entrantes");
    expect(tool.description).toContain("Postres");
  });

  it("menu factory includes allergen numbers in description", () => {
    const tool = restaurant.tools.menu(mockData);
    expect(tool.description).toContain("1=Gluten");
    expect(tool.description).toContain("14=Molluscs");
  });

  it("availability factory requires date and party_size", () => {
    const tool = restaurant.tools.availability(mockData);
    expect(tool.name).toBe("check_availability");
    expect(tool.input_schema.required).toContain("date");
    expect(tool.input_schema.required).toContain("party_size");
  });

  it("booking factory requires guest_name, date, time, party_size", () => {
    const tool = restaurant.tools.booking(mockData);
    expect(tool.name).toBe("make_reservation");
    expect(tool.input_schema.required).toEqual(expect.arrayContaining(["guest_name", "date", "time", "party_size"]));
  });
});

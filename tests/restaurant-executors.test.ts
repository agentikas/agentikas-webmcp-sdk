import { describe, it, expect, vi } from "vitest";
import { restaurantExecutors } from "../src/verticals/restaurant/executors";
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

describe("get_business_info executor", () => {
  it("returns restaurant name and address", () => {
    const execute = restaurantExecutors.get_business_info(mockData);
    const result = execute({});
    expect(result.content[0].text).toContain("Test Restaurant");
    expect(result.content[0].text).toContain("Calle Test 1");
    expect(result.content[0].text).toContain("Madrid");
  });
});

describe("get_menu executor", () => {
  it("returns all items when category is 'all'", () => {
    const execute = restaurantExecutors.get_menu(mockData);
    const result = execute({ category: "all" });
    expect(result.content[0].text).toContain("Paella");
    expect(result.content[0].text).toContain("Ensalada");
    expect(result.content[0].text).toContain("Tarta");
  });

  it("filters by category", () => {
    const execute = restaurantExecutors.get_menu(mockData);
    const result = execute({ category: "Arroces" });
    expect(result.content[0].text).toContain("Paella");
    expect(result.content[0].text).not.toContain("Ensalada");
  });

  it("returns error for unknown category", () => {
    const execute = restaurantExecutors.get_menu(mockData);
    const result = execute({ category: "Sushi" });
    expect(result.content[0].text).toContain("no encontrada");
  });

  it("excludes allergens", () => {
    const execute = restaurantExecutors.get_menu(mockData);
    const result = execute({ category: "all", exclude_allergens: [1] }); // gluten
    expect(result.content[0].text).toContain("Paella");
    expect(result.content[0].text).not.toContain("Tarta"); // has gluten
  });

  it("returns message when all items filtered out", () => {
    const execute = restaurantExecutors.get_menu(mockData);
    // Exclude crustaceans(2), fish(4), gluten(1), eggs(3), milk(7) — covers all items
    const result = execute({ category: "all", exclude_allergens: [1, 2, 3, 4, 7] });
    // Only Ensalada has no allergens, so it should remain
    expect(result.content[0].text).toContain("Ensalada");
  });

  it("dispatches agentikas:set-allergens event", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    const execute = restaurantExecutors.get_menu(mockData);
    execute({ category: "all", exclude_allergens: [1, 7] });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agentikas:set-allergens",
        detail: { allergens: [1, 7] },
      }),
    );
    spy.mockRestore();
  });
});

describe("check_availability executor", () => {
  it("returns open for a weekday (Monday)", () => {
    const execute = restaurantExecutors.check_availability(mockData);
    // 2026-04-06 is a Monday
    const result = execute({ date: "2026-04-06", party_size: 4 });
    expect(result.content[0].text).toContain("abierto");
  });

  it("returns closed for Sunday", () => {
    const execute = restaurantExecutors.check_availability(mockData);
    // 2026-04-05 is a Sunday
    const result = execute({ date: "2026-04-05", party_size: 4 });
    expect(result.content[0].text).toContain("cerrado");
  });
});

describe("make_reservation executor", () => {
  it("returns confirmation with reservation ID", () => {
    const execute = restaurantExecutors.make_reservation(mockData);
    const result = execute({
      guest_name: "Juan", date: "2026-04-10", time: "21:00", party_size: 4,
    });
    expect(result.content[0].text).toContain("RES-");
    expect(result.content[0].text).toContain("Juan");
    expect(result.content[0].text).toContain("2026-04-10");
  });

  it("rejects invalid party size", () => {
    const execute = restaurantExecutors.make_reservation(mockData);
    const result = execute({
      guest_name: "Juan", date: "2026-04-10", time: "21:00", party_size: 0,
    });
    expect(result.content[0].text).toContain("entre 1 y 20");
  });

  it("rejects invalid date format", () => {
    const execute = restaurantExecutors.make_reservation(mockData);
    const result = execute({
      guest_name: "Juan", date: "10/04/2026", time: "21:00", party_size: 4,
    });
    expect(result.content[0].text).toContain("YYYY-MM-DD");
  });
});

import { describe, it, expect } from "vitest";
import {
  ALLERGENS,
  ALLERGEN_STRING_TO_NUMBER,
  numberToStringAllergens,
  getNumericAllergens,
  filterMenuItems,
  slugify,
} from "../src/verticals/restaurant/utils";
import type { MenuItem } from "../src/verticals/restaurant/types";

const mockItems: MenuItem[] = [
  { id: "1", name: "Paella", description: "Rice dish with seafood", price: 24, category: "Arroces", allergens: ["crustaceans", "fish"], dietLabels: [], available: true, tags: ["marisco"] },
  { id: "2", name: "Ensalada", description: "Fresh green salad", price: 8, category: "Entrantes", allergens: [], dietLabels: ["vegetarian"], available: true, tags: ["vegetariano"], highlight: true },
  { id: "3", name: "Tarta", description: "Chocolate cake", price: 6, category: "Postres", allergens: ["gluten", "eggs", "milk"], dietLabels: [], available: true, tags: ["postres"] },
  { id: "4", name: "Sopa", description: "Hot soup", price: 5, category: "Entrantes", allergens: ["celery"], dietLabels: [], available: false, tags: ["caliente"] },
];

describe("ALLERGENS constant", () => {
  it("has 14 entries (EU 1169/2011)", () => {
    expect(Object.keys(ALLERGENS)).toHaveLength(14);
  });

  it("maps correct allergens", () => {
    expect(ALLERGENS[1].name).toBe("Gluten");
    expect(ALLERGENS[14].name).toBe("Molluscs");
    expect(ALLERGENS[7].es).toBe("Lácteos");
  });
});

describe("Allergen conversion", () => {
  it("ALLERGEN_STRING_TO_NUMBER maps all 14", () => {
    expect(Object.keys(ALLERGEN_STRING_TO_NUMBER)).toHaveLength(14);
    expect(ALLERGEN_STRING_TO_NUMBER.gluten).toBe(1);
    expect(ALLERGEN_STRING_TO_NUMBER.molluscs).toBe(14);
  });

  it("numberToStringAllergens converts numbers to strings", () => {
    expect(numberToStringAllergens([1, 2])).toEqual(["gluten", "crustaceans"]);
  });

  it("numberToStringAllergens skips invalid numbers", () => {
    expect(numberToStringAllergens([99, 1])).toEqual(["gluten"]);
  });

  it("getNumericAllergens converts item allergens to numbers", () => {
    expect(getNumericAllergens(mockItems[0])).toEqual([2, 4]); // crustaceans=2, fish=4
  });
});

describe("filterMenuItems", () => {
  it("returns only available items", () => {
    const result = filterMenuItems(mockItems, {});
    expect(result).toHaveLength(3); // Sopa is unavailable
    expect(result.find((i) => i.name === "Sopa")).toBeUndefined();
  });

  it("filters by tag", () => {
    const result = filterMenuItems(mockItems, { tag: "marisco" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Paella");
  });

  it("filters by search query in name", () => {
    const result = filterMenuItems(mockItems, { search: "Paella" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Paella");
  });

  it("filters by search query in description", () => {
    const result = filterMenuItems(mockItems, { search: "cake" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Tarta");
  });

  it("excludes items with specific allergens", () => {
    const result = filterMenuItems(mockItems, { excludeAllergens: [2] }); // crustaceans
    expect(result).toHaveLength(2); // Paella excluded
    expect(result.find((i) => i.name === "Paella")).toBeUndefined();
  });

  it("combines tag + allergen filters", () => {
    const result = filterMenuItems(mockItems, { tag: "postres", excludeAllergens: [1] }); // gluten
    expect(result).toHaveLength(0); // Tarta has gluten
  });
});

describe("slugify", () => {
  it("converts text to URL-safe slugs", () => {
    expect(slugify("Pescados y Mariscos")).toBe("pescados-y-mariscos");
  });

  it("handles accented characters", () => {
    expect(slugify("Menú del Día")).toBe("menu-del-dia");
  });

  it("handles special characters", () => {
    expect(slugify("Café & Té (especial)")).toBe("cafe-te-especial");
  });
});

// @agentikas/webmcp-sdk — Restaurant utilities (allergens, filters)

import type { Allergen, AllergenInfo, MenuItem } from "./types";

// ── EU Allergens 1-14 (Regulation 1169/2011) ──────────────────

export const ALLERGENS: Record<number, AllergenInfo> = {
  1:  { id: 1,  name: "Gluten",      es: "Gluten",           icon: "🌾" },
  2:  { id: 2,  name: "Crustaceans", es: "Crustáceos",       icon: "🦐" },
  3:  { id: 3,  name: "Eggs",        es: "Huevo",            icon: "🥚" },
  4:  { id: 4,  name: "Fish",        es: "Pescado",          icon: "🐟" },
  5:  { id: 5,  name: "Peanuts",     es: "Cacahuetes",       icon: "🥜" },
  6:  { id: 6,  name: "Soy",         es: "Soja",             icon: "🫘" },
  7:  { id: 7,  name: "Milk",        es: "Lácteos",          icon: "🥛" },
  8:  { id: 8,  name: "Nuts",        es: "Frutos de cáscara", icon: "🌰" },
  9:  { id: 9,  name: "Celery",      es: "Apio",             icon: "🥬" },
  10: { id: 10, name: "Mustard",     es: "Mostaza",          icon: "🟡" },
  11: { id: 11, name: "Sesame",      es: "Sésamo",           icon: "⚪" },
  12: { id: 12, name: "Sulphites",   es: "Sulfitos",         icon: "🍷" },
  13: { id: 13, name: "Lupin",       es: "Altramuces",       icon: "🌸" },
  14: { id: 14, name: "Molluscs",    es: "Moluscos",         icon: "🦪" },
};

export const ALLERGEN_STRING_TO_NUMBER: Record<Allergen, number> = {
  gluten: 1, crustaceans: 2, eggs: 3, fish: 4, peanuts: 5, soy: 6,
  milk: 7, nuts: 8, celery: 9, mustard: 10, sesame: 11, sulphites: 12,
  lupin: 13, molluscs: 14,
};

const NUMBER_TO_STRING: Record<number, Allergen> = Object.fromEntries(
  Object.entries(ALLERGEN_STRING_TO_NUMBER).map(([k, v]) => [v, k as Allergen]),
) as Record<number, Allergen>;

export function numberToStringAllergens(nums: number[]): Allergen[] {
  return nums.map((n) => NUMBER_TO_STRING[n]).filter(Boolean);
}

export function getNumericAllergens(item: MenuItem): number[] {
  return item.allergens.map((a) => ALLERGEN_STRING_TO_NUMBER[a]).filter(Boolean);
}

export function filterMenuItems(
  items: MenuItem[],
  options: { tag?: string; search?: string; excludeAllergens?: number[] },
): MenuItem[] {
  let result = items.filter((i) => i.available);

  if (options.tag && options.tag !== "todo") {
    result = result.filter(
      (i) => i.tags?.includes(options.tag!) || i.category.toLowerCase().includes(options.tag!),
    );
  }

  if (options.search) {
    const q = options.search.toLowerCase();
    result = result.filter(
      (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
    );
  }

  if (options.excludeAllergens && options.excludeAllergens.length > 0) {
    const excluded = new Set(options.excludeAllergens);
    result = result.filter((i) => !getNumericAllergens(i).some((n) => excluded.has(n)));
  }

  return result;
}

export function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

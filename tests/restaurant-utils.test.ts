import { describe, it, expect } from 'vitest';
import {
  ALLERGENS,
  ALLERGEN_STRING_TO_NUMBER,
  numberToStringAllergens,
  getNumericAllergens,
  filterMenuItems,
  slugify,
} from '../src/verticals/restaurant/utils';
import type { MenuItem } from '../src/verticals/restaurant/types';

const mockItems: MenuItem[] = [
  {
    id: '1',
    name: 'Paella',
    description: 'Rice dish',
    price: 24,
    category: 'Arroces',
    allergens: ['crustaceans', 'fish'],
    dietLabels: [],
    available: true,
    tags: ['marisco'],
  },
  {
    id: '2',
    name: 'Ensalada',
    description: 'Fresh salad',
    price: 8,
    category: 'Entrantes',
    allergens: [],
    dietLabels: ['vegetarian'],
    available: true,
    tags: ['vegetariano'],
    highlight: true,
  },
  {
    id: '3',
    name: 'Tarta',
    description: 'Chocolate cake',
    price: 6,
    category: 'Postres',
    allergens: ['gluten', 'eggs', 'milk'],
    dietLabels: [],
    available: true,
    tags: ['postres'],
  },
];

describe('ALLERGENS constant', () => {
  it('has 14 entries', () => {
    expect(Object.keys(ALLERGENS)).toHaveLength(14);
  });

  it('ALLERGENS[1] is Gluten and ALLERGENS[14] is Molluscs', () => {
    expect(ALLERGENS[1].name).toBe('Gluten');
    expect(ALLERGENS[14].name).toBe('Molluscs');
  });
});

describe('ALLERGEN_STRING_TO_NUMBER', () => {
  it('maps "gluten" to 1 and "molluscs" to 14', () => {
    expect(ALLERGEN_STRING_TO_NUMBER['gluten']).toBe(1);
    expect(ALLERGEN_STRING_TO_NUMBER['molluscs']).toBe(14);
  });
});

describe('numberToStringAllergens', () => {
  it('converts [1, 2] to ["gluten", "crustaceans"]', () => {
    expect(numberToStringAllergens([1, 2])).toEqual(['gluten', 'crustaceans']);
  });

  it('skips invalid numbers — [99] returns []', () => {
    expect(numberToStringAllergens([99])).toEqual([]);
  });
});

describe('getNumericAllergens', () => {
  it('returns [2, 4] for item with ["crustaceans", "fish"]', () => {
    const nums = getNumericAllergens(mockItems[0]); // Paella
    expect(nums).toEqual([2, 4]);
  });
});

describe('filterMenuItems', () => {
  it('returns only available items', () => {
    const withUnavailable: MenuItem[] = [
      ...mockItems,
      {
        id: '4',
        name: 'Old Soup',
        description: 'No longer served',
        price: 5,
        category: 'Sopas',
        allergens: [],
        dietLabels: [],
        available: false,
        tags: [],
      },
    ];
    const result = filterMenuItems(withUnavailable, {});
    expect(result.every((i) => i.available)).toBe(true);
    expect(result.find((i) => i.name === 'Old Soup')).toBeUndefined();
  });

  it('filters by tag "marisco" — only Paella', () => {
    const result = filterMenuItems(mockItems, { tag: 'marisco' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Paella');
  });

  it('search "Paella" returns 1 result', () => {
    const result = filterMenuItems(mockItems, { search: 'Paella' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Paella');
  });

  it('search "cake" (in description) returns Tarta', () => {
    const result = filterMenuItems(mockItems, { search: 'cake' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tarta');
  });

  it('excludeAllergens [2] (crustaceans) excludes Paella', () => {
    const result = filterMenuItems(mockItems, { excludeAllergens: [2] });
    expect(result.find((i) => i.name === 'Paella')).toBeUndefined();
    expect(result).toHaveLength(2);
  });

  it('combined: tag "postres" + excludeAllergens [1] (gluten) returns empty', () => {
    const result = filterMenuItems(mockItems, { tag: 'postres', excludeAllergens: [1] });
    expect(result).toHaveLength(0);
  });
});

describe('slugify', () => {
  it('slugifies "Pescados y Mariscos"', () => {
    expect(slugify('Pescados y Mariscos')).toBe('pescados-y-mariscos');
  });

  it('slugifies "Menu del Dia" with accent removal', () => {
    expect(slugify('Menú del Día')).toBe('menu-del-dia');
  });
});

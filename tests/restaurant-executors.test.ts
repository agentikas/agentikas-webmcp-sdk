import { describe, it, expect, vi } from 'vitest';
import { restaurantExecutors as executors } from '../src/verticals/restaurant/executors';
import type { RestaurantData } from '../src/verticals/restaurant/types';

const mockData: RestaurantData = {
  restaurant: {
    id: 'test',
    name: 'Test Restaurant',
    description: 'A test restaurant',
    shortDescription: 'Test food',
    cuisine: ['Spanish'],
    priceRange: '€€',
    address: {
      streetAddress: 'Calle Test 1',
      locality: 'Madrid',
      region: 'Madrid',
      postalCode: '28001',
      country: 'ES',
    },
    geo: { latitude: 40.4168, longitude: -3.7038 },
    contact: {
      phone: '+34600000000',
      whatsapp: '+34600000000',
      website: 'https://test.agentikas.ai',
    },
    openingHours: [
      {
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '13:00',
        closes: '23:00',
      },
    ],
    features: {
      hasTerraza: true,
      hasParking: false,
      isAccessible: true,
      acceptsReservations: true,
      acceptsGroups: true,
      hasPrivateRoom: false,
    },
    images: { hero: '/hero.jpg', logo: '/logo.jpg' },
  },
  allItems: [
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
  ],
};

describe('get_business_info executor', () => {
  it('returns text containing restaurant name and address', () => {
    const exec = executors.get_business_info(mockData);
    const result = exec({});
    const text = result.content[0].text;
    expect(text).toContain('Test Restaurant');
    expect(text).toContain('Calle Test 1');
    expect(text).toContain('28001');
    expect(text).toContain('Madrid');
  });
});

describe('get_menu executor', () => {
  it('returns all 3 items when category is "all"', () => {
    const exec = executors.get_menu(mockData);
    const result = exec({ category: 'all' });
    const text = result.content[0].text;
    expect(text).toContain('Paella');
    expect(text).toContain('Ensalada');
    expect(text).toContain('Tarta');
  });

  it('filters by category "Arroces" and returns only Paella', () => {
    const exec = executors.get_menu(mockData);
    const result = exec({ category: 'Arroces' });
    const text = result.content[0].text;
    expect(text).toContain('Paella');
    expect(text).not.toContain('Ensalada');
    expect(text).not.toContain('Tarta');
  });

  it('returns error message for unknown category', () => {
    const exec = executors.get_menu(mockData);
    const result = exec({ category: 'Sopas' });
    const text = result.content[0].text;
    expect(text).toContain('no encontrada');
  });

  it('excludes items with allergen 1 (gluten) — Tarta excluded', () => {
    const exec = executors.get_menu(mockData);
    const result = exec({ category: 'all', exclude_allergens: [1] });
    const text = result.content[0].text;
    expect(text).toContain('Paella');
    expect(text).toContain('Ensalada');
    expect(text).not.toContain('Tarta');
  });

  it('returns "no dishes" message when all items are filtered out', () => {
    const exec = executors.get_menu(mockData);
    // Use category "Arroces" (only Paella) + exclude crustaceans (2) to remove Paella
    const result = exec({ category: 'Arroces', exclude_allergens: [2] });
    const text = result.content[0].text;
    expect(text).toContain('No hay platos');
  });

  it('dispatches agentikas:set-allergens event', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    const exec = executors.get_menu(mockData);
    exec({ category: 'all', exclude_allergens: [1, 7] });

    const customEvent = spy.mock.calls.find(
      ([evt]) => evt instanceof CustomEvent && evt.type === 'agentikas:set-allergens',
    );
    expect(customEvent).toBeDefined();
    const detail = (customEvent![0] as CustomEvent).detail;
    expect(detail.allergens).toEqual([1, 7]);

    spy.mockRestore();
  });
});

describe('check_availability executor', () => {
  it('returns open message for Monday', () => {
    const exec = executors.check_availability(mockData);
    // 2026-03-30 is a Monday
    const result = exec({ date: '2026-03-30', party_size: 4 });
    const text = result.content[0].text;
    expect(text).toContain('abierto');
  });

  it('returns closed message for Sunday', () => {
    const exec = executors.check_availability(mockData);
    // 2026-03-29 is a Sunday
    const result = exec({ date: '2026-03-29', party_size: 4 });
    const text = result.content[0].text;
    expect(text).toContain('cerrado');
  });
});

describe('make_reservation executor', () => {
  it('returns text containing reservation ID starting with RES-', () => {
    const exec = executors.make_reservation(mockData);
    const result = exec({
      guest_name: 'Juan',
      date: '2026-04-01',
      time: '20:00',
      party_size: 2,
    });
    const text = result.content[0].text;
    expect(text).toContain('RES-');
    expect(text).toContain('Juan');
  });

  it('returns error message when party_size is 0', () => {
    const exec = executors.make_reservation(mockData);
    const result = exec({
      guest_name: 'Juan',
      date: '2026-04-01',
      time: '20:00',
      party_size: 0,
    });
    const text = result.content[0].text;
    expect(text).toContain('entre 1 y 20');
  });

  it('returns error message for bad date format', () => {
    const exec = executors.make_reservation(mockData);
    const result = exec({
      guest_name: 'Juan',
      date: '01-04-2026',
      time: '20:00',
      party_size: 2,
    });
    const text = result.content[0].text;
    expect(text).toContain('Formato de fecha incorrecto');
  });
});

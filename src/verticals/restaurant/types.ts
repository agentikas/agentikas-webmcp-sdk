// @agentikas/webmcp-sdk — Restaurant domain types

export type Allergen =
  | "gluten" | "crustaceans" | "eggs" | "fish" | "peanuts" | "soy"
  | "milk" | "nuts" | "celery" | "mustard" | "sesame" | "sulphites"
  | "lupin" | "molluscs";

export type DietLabel = "vegetarian" | "vegan" | "gluten-free" | "pescatarian";

export interface AllergenInfo {
  id: number;
  name: string;
  es: string;
  icon: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  allergens: Allergen[];
  dietLabels: DietLabel[];
  available: boolean;
  imageUrl?: string;
  tags?: string[];
  highlight?: boolean;
  specialty?: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  order: number;
  items: MenuItem[];
}

export interface OpeningHours {
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

export interface RestaurantInfo {
  id: string;
  name: string;
  legalName?: string;
  description: string;
  shortDescription: string;
  foundedYear?: number;
  cuisine: string[];
  priceRange: "€" | "€€" | "€€€" | "€€€€";
  address: {
    streetAddress: string;
    locality: string;
    region: string;
    postalCode: string;
    country: string;
  };
  geo: {
    latitude: number;
    longitude: number;
  };
  contact: {
    phone: string;
    email?: string;
    whatsapp?: string;
    website: string;
  };
  openingHours: OpeningHours[];
  features: {
    hasTerraza: boolean;
    hasParking: boolean;
    isAccessible: boolean;
    acceptsReservations: boolean;
    acceptsGroups: boolean;
    hasPrivateRoom: boolean;
  };
  social?: {
    instagram?: string;
    facebook?: string;
    tripadvisor?: string;
  };
  images: {
    hero: string;
    logo: string;
    gallery?: string[];
  };
  heroHeadline?: string;
  heroSubheadline?: string;
  webTemplate?: string;
}

/** Data shape passed to restaurant tool factories and executors. */
export interface RestaurantData {
  restaurant: RestaurantInfo;
  allItems: MenuItem[];
}

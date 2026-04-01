// @agentikas/webmcp-sdk — Retail domain types

export interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  sizes: string[];
  color: string;
  inStock: boolean;
  imageUrl?: string;
  description?: string;
}

export interface RetailData {
  store: { name: string; currency: string; url?: string };
  products: Product[];
}

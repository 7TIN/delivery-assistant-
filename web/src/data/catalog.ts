import type { DeliveryLocation, GeoPoint, ItemCategory } from "@/types/contracts";

export type MerchantKind = "grocery" | "restaurant" | "electronics" | "pharmacy" | "other";

export interface MerchantCatalogItem {
  itemId: string;
  merchantId: string;
  merchantName: string;
  merchantKind: MerchantKind;
  itemName: string;
  category: ItemCategory;
  price: number;
  prepMinutes: number;
  merchantLocation: GeoPoint;
  description: string;
}

export interface DeliveryPreset {
  id: string;
  label: string;
  blurb: string;
  location: DeliveryLocation;
}

export const merchantCatalog: MerchantCatalogItem[] = [
  {
    itemId: "fresh-mart-essentials",
    merchantId: "m1",
    merchantName: "Fresh Mart Grocery",
    merchantKind: "grocery",
    itemName: "Weekly Essentials Pack",
    category: "grocery",
    price: 45.99,
    prepMinutes: 5,
    merchantLocation: { lat: 37.7849, lng: -122.4094 },
    description: "Pantry staples and produce bundled for a fast pickup.",
  },
  {
    itemId: "sakura-tonkotsu",
    merchantId: "m2",
    merchantName: "Sakura Ramen House",
    merchantKind: "restaurant",
    itemName: "Tonkotsu Ramen",
    category: "food",
    price: 16.5,
    prepMinutes: 20,
    merchantLocation: { lat: 37.7752, lng: -122.4183 },
    description: "Hot kitchen item with longer prep, useful for route balancing.",
  },
  {
    itemId: "techzone-hub",
    merchantId: "m3",
    merchantName: "TechZone Electronics",
    merchantKind: "electronics",
    itemName: "USB-C Hub Adapter",
    category: "electronics",
    price: 34.99,
    prepMinutes: 3,
    merchantLocation: { lat: 37.7899, lng: -122.4014 },
    description: "Fast handoff item from a high-confidence electronics merchant.",
  },
  {
    itemId: "city-pharmacy-vitamins",
    merchantId: "m4",
    merchantName: "City Pharmacy",
    merchantKind: "pharmacy",
    itemName: "Vitamin D Supplements",
    category: "other",
    price: 12.99,
    prepMinutes: 4,
    merchantLocation: { lat: 37.7831, lng: -122.4159 },
    description: "Small basket item that usually slots cleanly into a multi-stop run.",
  },
  {
    itemId: "green-bowl-acai",
    merchantId: "m5",
    merchantName: "Green Bowl Cafe",
    merchantKind: "restaurant",
    itemName: "Acai Bowl",
    category: "food",
    price: 13.5,
    prepMinutes: 10,
    merchantLocation: { lat: 37.778, lng: -122.412 },
    description: "Quick-prep fresh food order to contrast against the ramen stop.",
  },
  {
    itemId: "whole-basket-fruit",
    merchantId: "m6",
    merchantName: "Whole Basket Organics",
    merchantKind: "grocery",
    itemName: "Organic Fruit Box",
    category: "grocery",
    price: 29.99,
    prepMinutes: 5,
    merchantLocation: { lat: 37.787, lng: -122.405 },
    description: "Another grocery stop so we can test duplicate merchant categories.",
  },
];

export const deliveryPresets: DeliveryPreset[] = [
  {
    id: "market-st",
    label: "Market Street HQ",
    blurb: "Dense downtown delivery near the existing merchant cluster.",
    location: {
      lat: 37.7749,
      lng: -122.4194,
      address: "123 Market St, San Francisco, CA 94103",
    },
  },
  {
    id: "mission-bay",
    label: "Mission Bay Office",
    blurb: "Slightly longer final leg toward the southeast edge of the map.",
    location: {
      lat: 37.7718,
      lng: -122.3912,
      address: "1100 4th St, San Francisco, CA 94158",
    },
  },
  {
    id: "north-beach",
    label: "North Beach Apartment",
    blurb: "Pushes the route uphill and changes pickup ordering pressure.",
    location: {
      lat: 37.8067,
      lng: -122.4103,
      address: "700 Columbus Ave, San Francisco, CA 94133",
    },
  },
];

export const merchantCatalogById = new Map(
  merchantCatalog.map((item) => [
    item.merchantId,
    {
      merchantId: item.merchantId,
      merchantName: item.merchantName,
      merchantKind: item.merchantKind,
      merchantLocation: item.merchantLocation,
    },
  ]),
);

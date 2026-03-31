// @agentikas/webmcp-sdk — Restaurant tool factories (server-side, serializable)

import type { VerticalDefinition, ToolFactory } from "../../types";
import type { RestaurantData } from "./types";

const info: ToolFactory<RestaurantData> = ({ restaurant }) => ({
  name: "get_business_info",
  description: `Returns general information about ${restaurant.name}: location, opening hours, contact, cuisine type and features.`,
  input_schema: { type: "object", properties: {}, required: [] },
});

const menu: ToolFactory<RestaurantData> = ({ restaurant, allItems }) => {
  const categoryNames = [...new Set(allItems.map((i) => i.category))];
  return {
    name: "get_menu",
    description:
      `Returns the menu of ${restaurant.name}. Filter by category and/or exclude allergens.\n\n` +
      `Allergen numbers (EU 1169/2011): 1=Gluten, 2=Crustaceans, 3=Eggs, 4=Fish, 5=Peanuts, 6=Soy, ` +
      `7=Dairy, 8=Tree nuts, 9=Celery, 10=Mustard, 11=Sesame, 12=Sulphites, 13=Lupin, 14=Molluscs\n\n` +
      `Available categories: ${categoryNames.join(", ")}, all`,
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: 'Category to retrieve. Use "all" for the complete menu.' },
        exclude_allergens: { type: "array", description: "Allergen numbers to exclude (1-14).", items: { type: "number" } },
      },
      required: [],
    },
  };
};

const availability: ToolFactory<RestaurantData> = ({ restaurant }) => ({
  name: "check_availability",
  description: `Check table availability at ${restaurant.name} for a given date, time and party size.`,
  input_schema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Date in YYYY-MM-DD format." },
      time: { type: "string", description: "Time in HH:MM format." },
      party_size: { type: "number", description: "Number of guests (1-20)." },
    },
    required: ["date", "party_size"],
  },
});

const booking: ToolFactory<RestaurantData> = ({ restaurant }) => ({
  name: "make_reservation",
  description: `Make a table reservation at ${restaurant.name}.`,
  input_schema: {
    type: "object",
    properties: {
      guest_name: { type: "string", description: "Full name of the person making the reservation." },
      date: { type: "string", description: "Reservation date in YYYY-MM-DD format." },
      time: { type: "string", description: "Reservation time in HH:MM format." },
      party_size: { type: "number", description: "Number of guests (1-20)." },
      phone: { type: "string", description: "Contact phone number." },
      notes: { type: "string", description: "Optional: allergies, special occasions, etc." },
    },
    required: ["guest_name", "date", "time", "party_size"],
  },
});

export const restaurant: VerticalDefinition<RestaurantData> = {
  id: "restaurant",
  name: "Restaurant",
  tools: { info, menu, availability, booking },
  defaultTools: ["info", "menu", "availability", "booking"],
};

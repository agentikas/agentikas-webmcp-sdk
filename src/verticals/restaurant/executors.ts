// @agentikas/webmcp-sdk — Restaurant executors (Agentikas platform)
// Client-side execute functions that work with pre-loaded RestaurantData.

import type { ExecutorMap } from "../../types";
import type { RestaurantData } from "./types";
import { ALLERGENS, filterMenuItems, getNumericAllergens } from "./utils";

export const restaurantExecutors: ExecutorMap<RestaurantData> = {
  get_business_info: ({ restaurant }) => () => {
    const hours = restaurant.openingHours
      .map((h) => `  ${h.dayOfWeek.join(", ")}: ${h.opens} - ${h.closes}`)
      .join("\n");

    const features = [];
    if (restaurant.features.hasTerraza) features.push("Terraza");
    if (restaurant.features.hasParking) features.push("Parking");
    if (restaurant.features.isAccessible) features.push("Accesible");
    if (restaurant.features.acceptsReservations) features.push("Reservas disponibles");
    if (restaurant.features.acceptsGroups) features.push("Grupos bienvenidos");
    if (restaurant.features.hasPrivateRoom) features.push("Salon privado");

    return {
      content: [{
        type: "text" as const,
        text: `# ${restaurant.name}\n\n${restaurant.description}\n\n` +
          `## Direccion\n${restaurant.address.streetAddress}, ${restaurant.address.postalCode} ${restaurant.address.locality}\n\n` +
          `## Contacto\nTelefono: ${restaurant.contact.phone}${restaurant.contact.whatsapp ? `\nWhatsApp: ${restaurant.contact.whatsapp}` : ""}\n\n` +
          `## Horario\n${hours}\n\n` +
          `## Cocina\n${restaurant.cuisine.join(", ")}\n\n` +
          `## Precio medio\n${restaurant.priceRange}\n\n` +
          `## Caracteristicas\n${features.map((f) => `• ${f}`).join("\n")}`,
      }],
    };
  },

  get_menu: ({ restaurant, allItems }) => ({
    category = "all",
    exclude_allergens = [],
  }: {
    category?: string;
    exclude_allergens?: number[];
  }) => {
    const excluded = (exclude_allergens ?? []).map(Number);

    window.dispatchEvent(
      new CustomEvent("agentikas:set-allergens", { detail: { allergens: excluded } }),
    );

    const categoryNames = [...new Set(allItems.map((i) => i.category))];
    const cat = category.toLowerCase();
    const sourceItems = cat === "all"
      ? allItems
      : allItems.filter((item) => item.category.toLowerCase().includes(cat));

    if (cat !== "all" && sourceItems.length === 0) {
      return { content: [{ type: "text" as const, text: `Categoria "${category}" no encontrada. Disponibles: ${categoryNames.join(", ")}, all` }] };
    }

    const safe = filterMenuItems(sourceItems, { excludeAllergens: excluded });
    const totalRemoved = sourceItems.length - safe.length;

    if (safe.length === 0) {
      return { content: [{ type: "text" as const, text: `No hay platos sin los alergenos indicados (${excluded.map((n) => ALLERGENS[n]?.es ?? n).join(", ")}).` }] };
    }

    const grouped: [string, typeof safe][] = [];
    for (const item of safe) {
      const existing = grouped.find(([c]) => c === item.category);
      if (existing) existing[1].push(item);
      else grouped.push([item.category, [item]]);
    }

    const summary = grouped
      .map(([catName, items]) => {
        const itemList = items
          .map((i) => {
            const nums = getNumericAllergens(i);
            const al = nums.length > 0
              ? ` [${nums.map((a) => `${a}-${ALLERGENS[a]?.es}`).join(", ")}]`
              : "";
            return `  • ${i.name} — €${i.price.toFixed(2)}${i.highlight ? " *" : ""}${al}`;
          })
          .join("\n");
        return `## ${catName}\n${itemList}`;
      })
      .join("\n\n");

    const note = excluded.length > 0
      ? `\n\nFiltrado: ${totalRemoved} plato(s) ocultos con ${excluded.map((n) => ALLERGENS[n]?.es ?? n).join(", ")}.`
      : "";

    return { content: [{ type: "text" as const, text: `# Carta de ${restaurant.name}\n\n${summary}${note}` }] };
  },

  check_availability: ({ restaurant }) => ({ date, time, party_size }: { date: string; time?: string; party_size: number }) => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[new Date(date + "T12:00:00").getDay()];
    const isOpen = restaurant.openingHours.some((h) => h.dayOfWeek.includes(dayName));

    if (!isOpen) {
      return { content: [{ type: "text" as const, text: `${restaurant.name} esta cerrado ese dia.` }] };
    }

    return {
      content: [{
        type: "text" as const,
        text: `${restaurant.name} esta abierto el ${date}${time ? ` a las ${time}` : ""}. ` +
          `Para ${party_size} persona${party_size > 1 ? "s" : ""}, usa make_reservation o llama al ${restaurant.contact.phone}.`,
      }],
    };
  },

  make_reservation: ({ restaurant }) => ({ guest_name, date, time, party_size, phone, notes }: {
    guest_name: string; date: string; time: string; party_size: number; phone?: string; notes?: string;
  }) => {
    if (party_size < 1 || party_size > 20) {
      return { content: [{ type: "text" as const, text: "Comensales debe estar entre 1 y 20." }] };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { content: [{ type: "text" as const, text: "Formato de fecha incorrecto. Usa YYYY-MM-DD." }] };
    }

    const id = `RES-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const addr = `${restaurant.address.streetAddress}, ${restaurant.address.postalCode} ${restaurant.address.locality}`;

    return {
      content: [{
        type: "text" as const,
        text: `# Reserva Confirmada\n\n**Numero:** ${id}\n**Nombre:** ${guest_name}\n**Fecha:** ${date} a las ${time}\n` +
          `**Comensales:** ${party_size}\n` +
          (phone ? `**Telefono:** ${phone}\n` : "") +
          (notes ? `**Notas:** ${notes}\n` : "") +
          `\nTe esperamos en **${addr}**.`,
      }],
    };
  },
};

// @agentikas/webmcp-sdk — Restaurant executors (Agentikas platform)
// Safe with empty data — returns "no data available" messages.

import type { ExecutorMap } from "../../types";
import type { RestaurantData } from "./types";
import { ALLERGENS, filterMenuItems, getNumericAllergens } from "./utils";

export const restaurantExecutors: ExecutorMap<RestaurantData> = {
  get_business_info: (data) => () => {
    const r = (data as any)?.restaurant;
    if (!r) {
      return { content: [{ type: "text" as const, text: "No restaurant data available." }] };
    }

    const hours = (r.openingHours ?? [])
      .map((h: any) => `  ${h.dayOfWeek.join(", ")}: ${h.opens} - ${h.closes}`)
      .join("\n");

    const features = [];
    if (r.features?.hasTerraza) features.push("Terraza");
    if (r.features?.hasParking) features.push("Parking");
    if (r.features?.isAccessible) features.push("Accesible");
    if (r.features?.acceptsReservations) features.push("Reservas disponibles");
    if (r.features?.acceptsGroups) features.push("Grupos bienvenidos");
    if (r.features?.hasPrivateRoom) features.push("Salon privado");

    return {
      content: [{
        type: "text" as const,
        text: `# ${r.name}\n\n${r.description || ""}\n\n` +
          `## Direccion\n${r.address?.streetAddress || ""}, ${r.address?.postalCode || ""} ${r.address?.locality || ""}\n\n` +
          `## Contacto\nTelefono: ${r.contact?.phone || ""}${r.contact?.whatsapp ? `\nWhatsApp: ${r.contact.whatsapp}` : ""}\n\n` +
          (hours ? `## Horario\n${hours}\n\n` : "") +
          `## Cocina\n${(r.cuisine ?? []).join(", ")}\n\n` +
          `## Precio medio\n${r.priceRange || ""}\n\n` +
          (features.length > 0 ? `## Caracteristicas\n${features.map((f) => `• ${f}`).join("\n")}` : ""),
      }],
    };
  },

  get_menu: (data) => ({
    category = "all",
    exclude_allergens = [],
  }: {
    category?: string;
    exclude_allergens?: number[];
  }) => {
    const r = (data as any)?.restaurant;
    const allItems = (data as any)?.allItems ?? [];

    if (allItems.length === 0) {
      return { content: [{ type: "text" as const, text: "No menu data available." }] };
    }

    const excluded = (exclude_allergens ?? []).map(Number);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("agentikas:set-allergens", { detail: { allergens: excluded } }),
      );
    }

    const categoryNames = [...new Set(allItems.map((i: any) => i.category))];
    const cat = category.toLowerCase();
    const sourceItems = cat === "all"
      ? allItems
      : allItems.filter((item: any) => item.category.toLowerCase().includes(cat));

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

    return { content: [{ type: "text" as const, text: `# Carta${r?.name ? ` de ${r.name}` : ""}\n\n${summary}${note}` }] };
  },

  check_availability: (data) => ({ date, time, party_size }: { date: string; time?: string; party_size: number }) => {
    const r = (data as any)?.restaurant;
    if (!r) {
      return { content: [{ type: "text" as const, text: "No restaurant data available." }] };
    }

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[new Date(date + "T12:00:00").getDay()];
    const isOpen = (r.openingHours ?? []).some((h: any) => h.dayOfWeek.includes(dayName));

    if (!isOpen) {
      return { content: [{ type: "text" as const, text: `${r.name || "Restaurant"} esta cerrado ese dia.` }] };
    }

    return {
      content: [{
        type: "text" as const,
        text: `${r.name || "Restaurant"} esta abierto el ${date}${time ? ` a las ${time}` : ""}. ` +
          `Para ${party_size} persona${party_size > 1 ? "s" : ""}, usa make_reservation${r.contact?.phone ? ` o llama al ${r.contact.phone}` : ""}.`,
      }],
    };
  },

  make_reservation: (data) => ({ guest_name, date, time, party_size, phone, notes }: {
    guest_name: string; date: string; time: string; party_size: number; phone?: string; notes?: string;
  }) => {
    if (party_size < 1 || party_size > 20) {
      return { content: [{ type: "text" as const, text: "Comensales debe estar entre 1 y 20." }] };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { content: [{ type: "text" as const, text: "Formato de fecha incorrecto. Usa YYYY-MM-DD." }] };
    }

    const r = (data as any)?.restaurant;
    const id = `RES-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const addr = r?.address
      ? `${r.address.streetAddress}, ${r.address.postalCode} ${r.address.locality}`
      : "";

    return {
      content: [{
        type: "text" as const,
        text: `# Reserva Confirmada\n\n**Numero:** ${id}\n**Nombre:** ${guest_name}\n**Fecha:** ${date} a las ${time}\n` +
          `**Comensales:** ${party_size}\n` +
          (phone ? `**Telefono:** ${phone}\n` : "") +
          (notes ? `**Notas:** ${notes}\n` : "") +
          (addr ? `\nTe esperamos en **${addr}**.` : ""),
      }],
    };
  },
};

/**
 * Zonas a las que el local hace envíos. Agregar o sacar una acá alcanza:
 * aparece sola en el checkout y viaja en el pedido de WhatsApp.
 *
 * El costo queda sin precio a propósito. Mientras no esté definido, el
 * checkout dice que se coordina por WhatsApp en vez de inventar un número.
 * Para fijarlo, poner `cost` en pesos.
 */
export interface DeliveryZone {
  id: string;
  name: string;
  /** Costo del envío en pesos. Sin definir, se coordina por WhatsApp. */
  cost?: number;
  /** Aclaración corta, si la zona tiene alguna condición. */
  note?: string;
}

export const deliveryZones: DeliveryZone[] = [
  { id: "la-plata", name: "La Plata" },
  { id: "berisso", name: "Berisso" },
  { id: "ensenada", name: "Ensenada" },
];

export const deliveryAvailable = deliveryZones.length > 0;

export function zoneByName(name?: string) {
  return deliveryZones.find((z) => z.name === name);
}

/** Cómo se le cuenta el costo al cliente. */
export function zoneCostLabel(zone: DeliveryZone) {
  return zone.cost === undefined
    ? "Costo a coordinar por WhatsApp"
    : zone.cost === 0
      ? "Sin costo"
      : `Envío $${zone.cost.toLocaleString("es-AR")}`;
}

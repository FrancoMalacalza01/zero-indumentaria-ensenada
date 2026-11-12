/**
 * Las zonas a las que el local hace envíos.
 *
 * Se cargan desde el panel, no acá: antes esta lista vivía en el código y
 * agregar un pueblo era tocar un archivo y volver a publicar el sitio.
 *
 * El costo y la cuenta del envío gratis viven en `settingsMap.mjs`, que se
 * puede probar sin navegador, y la función `crear_pedido` de la base hace la
 * misma cuenta: la del servidor es la que manda, porque es la que cobra.
 */
import type { Settings, ZonaEnvio } from "./types";

export {
  costoEnvio,
  llegaAlEnvioGratis,
  faltaParaEnvioGratis,
  textoQuienPagaEnvio,
  textoNotaDeCambios,
} from "./settingsMap.mjs";

export function deliveryZones(settings: Settings): ZonaEnvio[] {
  return settings.envio.zonas;
}

export function deliveryAvailable(settings: Settings) {
  return settings.envio.zonas.length > 0;
}

export function zoneByName(settings: Settings, nombre?: string) {
  return settings.envio.zonas.find((z) => z.nombre === nombre);
}

/** Cómo se le cuenta el costo al cliente. */
export function zoneCostLabel(zona: ZonaEnvio) {
  return zona.costo === undefined
    ? "Costo a coordinar por WhatsApp"
    : zona.costo === 0
      ? "Sin costo"
      : `Envío $${zona.costo.toLocaleString("es-AR")}`;
}

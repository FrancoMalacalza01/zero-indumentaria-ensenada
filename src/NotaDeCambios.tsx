import { Link } from "./router";
import { RefreshCcw } from "lucide-react";
import { useStore } from "./Store";
import { textoNotaDeCambios } from "./delivery";

/**
 * Lo que hay que saber de un cambio, dicho en la ficha antes de comprar. El plazo sale de la
 * configuración (la misma de /devoluciones), así la ficha no promete uno distinto.
 */
export default function NotaDeCambios() {
  const { settings } = useStore();
  return (
    <p className="nota-cambios">
      <RefreshCcw size={14} aria-hidden /> {textoNotaDeCambios(settings)}{" "}
      <Link className="text-link" to="/devoluciones">
        Ver condiciones
      </Link>
    </p>
  );
}

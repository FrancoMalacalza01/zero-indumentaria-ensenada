import { useState } from "react";
import { slugDeMarca } from "./marcas.mjs";

/**
 * El nombre de la marca con su logo al lado. El logo es un archivo que carga el local en
 * `public/marcas/<marca>.png` (por ejemplo `mistral.png`, `brooksfield.png`); mientras no esté, se ve sólo el
 * nombre, que es lo que identifica a la marca de todos modos.
 */
export default function MarcaLogo({ marca, tamano = "md" }: { marca: string; tamano?: "sm" | "md" | "lg" }) {
  const [sinLogo, setSinLogo] = useState(false);
  const slug = slugDeMarca(marca);
  return (
    <span className={`marca-logo marca-${tamano} marca-${slug}`}>
      {!sinLogo && slug && (
        <img src={`/marcas/${slug}.png`} alt="" loading="lazy" onError={() => setSinLogo(true)} />
      )}
      <span className="marca-nombre">{marca}</span>
    </span>
  );
}

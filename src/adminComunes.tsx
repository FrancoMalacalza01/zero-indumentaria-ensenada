// Lo que comparten las pantallas del panel: formatos, listas y piezas chicas.
import type { ReactNode } from "react";
import type { Category, MovementReason, Order, Product } from "./types";

export const imagePattern =
  /^(https?:\/\/|data:image\/(jpeg|png|webp);base64,|\/)/i;

// Accesorios ya no se vende: no se ofrece como categoría ni aparece en el stock. Si en la base quedara un
// producto viejo de esa categoría, no se muestra acá (la tienda tampoco lo publica).
export const categories: Category[] = ["Hombre"];

export const addReasons: MovementReason[] = ["Ingreso", "Devolución"];

export const removeReasons: MovementReason[] = ["Rotura", "Ajuste"];

export const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

export const units = (product: Product) =>
  Object.values(product.stock || {}).reduce((sum, value) => sum + value, 0);

export const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });

export const orderStatuses: Order["status"][] = [
  "Pendiente",
  "Preparando",
  "Listo para retirar",
  "Completado",
];

/**
 * "Cancelado" y "Devuelto" no están en esa lista a propósito: los dos mueven
 * stock, así que no pueden ser un valor más de un desplegable. Se ponen desde
 * el botón de cancelar o desde la pestaña de devoluciones, que son los que
 * además devuelven las unidades.
 */
export const pagoEtiquetas: Record<string, { texto: string; clase: string }> = {
  sin_pago: { texto: "Sin pagar", clase: "pago-sin" },
  pendiente: { texto: "Pago en curso", clase: "pago-curso" },
  aprobado: { texto: "Pagado", clase: "pago-ok" },
  rechazado: { texto: "Pago rechazado", clase: "pago-mal" },
  devuelto: { texto: "Pago devuelto", clase: "pago-mal" },
};

export function Metric({
  icon,
  label,
  value,
  foot,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  foot: string;
}) {
  return (
    <div className="admin-metric">
      <div>
        <span>{label}</span>
        <span className="admin-metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </div>
  );
}

export function StatusBadge({ status }: { status: Order["status"] }) {
  return (
    <span
      className={`admin-status-badge ${status === "Completado" ? "is-completed" : status === "Pendiente" ? "is-pending" : ""}`}
    >
      <span />
      {status}
    </span>
  );
}

export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-empty">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

/** Las pestañas del panel. */
export type Tab =
  | "overview"
  | "sale"
  | "inventory"
  | "precios"
  | "stock"
  | "movements"
  | "orders"
  | "returns"
  | "reports"
  | "config";

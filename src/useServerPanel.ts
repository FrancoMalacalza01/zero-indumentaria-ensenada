/**
 * El panel conectado al servidor.
 *
 * Con sesión, el panel deja de ser una demo: lo que carga el dueño queda en
 * el servidor y sale publicado en la tienda. Sin sesión, todo sigue como
 * antes, en el navegador.
 *
 * Dos decisiones que importan:
 *
 * 1. El cambio se ve en pantalla primero y se manda después. Así el panel no
 *    se congela esperando la red. Pero si el envío falla, hay que decirlo con
 *    todas las letras: lo que está en pantalla NO está publicado.
 * 2. Después de cada guardado se recarga del servidor. Es la única forma de
 *    que dos personas trabajando a la vez no se pisen sin enterarse.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./Store";
import type { Session } from "./auth";
import {
  cargarPanel,
  publicarProducto,
  borrarProducto,
  guardarOrden,
  guardarMovimientos,
  guardarPedido,
  SesionVencida,
} from "./serverWrite";
import type { Movement, Order, Product } from "./types";

export type Estado = "cargando" | "al-dia" | "guardando" | "error";

export interface Panel {
  /** false cuando el panel trabaja en modo demo, sin servidor. */
  conectado: boolean;
  estado: Estado;
  /** El último error, en las palabras que dio el servidor. */
  error: string;
  /** Limpia el cartel de error sin tocar nada más. */
  olvidarError: () => void;
  /** Vuelve a traer todo del servidor. */
  recargar: () => void;
  publicar: (product: Product, position: number) => void;
  despublicarBorrando: (id: string) => void;
  publicarOrden: (products: Product[]) => void;
  publicarMovimientos: (movements: Movement[]) => void;
  publicarPedido: (order: Order) => void;
  /** Stock y movimientos de una sola tanda de cambios. */
  publicarStock: (products: Product[], movements: Movement[]) => void;
}

const SIN_SERVIDOR: Panel = {
  conectado: false,
  estado: "al-dia",
  error: "",
  olvidarError: () => {},
  recargar: () => {},
  publicar: () => {},
  despublicarBorrando: () => {},
  publicarOrden: () => {},
  publicarMovimientos: () => {},
  publicarPedido: () => {},
  publicarStock: () => {},
};

export function useServerPanel(
  session: Session | null,
  onSesionVencida: () => void,
): Panel {
  const { cargarDesdeServidor } = useStore();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState("");
  // Estas dos vienen nuevas en cada render del padre. Guardadas en una ref,
  // `traer` queda estable; si entraran como dependencia, el efecto se
  // volvería a disparar en cada render y el panel pediría todo sin parar.
  const cargarRef = useRef(cargarDesdeServidor);
  cargarRef.current = cargarDesdeServidor;
  const vencidaRef = useRef(onSesionVencida);
  vencidaRef.current = onSesionVencida;
  // El token se renueva solo; cada escritura usa el último que volvió.
  const vivaRef = useRef<Session | null>(session);
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);
  useEffect(() => {
    vivaRef.current = session;
  }, [session]);

  const traer = useCallback(async () => {
    const viva = vivaRef.current;
    if (!viva) return;
    setEstado("cargando");
    try {
      const { session: renovada, valor } = await cargarPanel(viva);
      vivaRef.current = renovada;
      if (!montadoRef.current) return;
      cargarRef.current(valor);
      setEstado("al-dia");
      setError("");
    } catch (err) {
      if (!montadoRef.current) return;
      if (err instanceof SesionVencida) {
        vencidaRef.current();
        return;
      }
      setEstado("error");
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo traer los datos del servidor",
      );
    }
  }, []);

  useEffect(() => {
    if (session) traer();
  }, [session, traer]);

  /**
   * Manda un cambio y después recarga.
   *
   * `tras` describe lo que se intentó, para que el error diga qué no se
   * guardó y no un "falló" pelado.
   */
  const mandar = useCallback(
    (tras: string, tarea: (s: Session) => Promise<{ session: Session }>) => {
      const viva = vivaRef.current;
      if (!viva) return;
      setEstado("guardando");
      setError("");
      tarea(viva)
        .then(({ session: renovada }) => {
          vivaRef.current = renovada;
          // Recargar es lo que confirma que quedó guardado de verdad, y
          // además trae lo que haya cambiado otro mientras tanto.
          return traer();
        })
        .catch((err) => {
          if (!montadoRef.current) return;
          if (err instanceof SesionVencida) {
            vencidaRef.current();
            return;
          }
          setEstado("error");
          setError(
            `${tras}: ${err instanceof Error ? err.message : "no se pudo guardar"}`,
          );
        });
    },
    [traer],
  );

  if (!session) return SIN_SERVIDOR;

  return {
    conectado: true,
    estado,
    error,
    olvidarError: () => setError(""),
    recargar: () => {
      traer();
    },
    publicar: (product, position) =>
      mandar(`No se publicó "${product.name}"`, (s) =>
        publicarProducto(s, product, position),
      ),
    despublicarBorrando: (id) =>
      mandar("No se borró el producto", (s) => borrarProducto(s, id)),
    publicarOrden: (products) =>
      mandar("No se guardó el orden de la lista", (s) =>
        guardarOrden(s, products),
      ),
    publicarMovimientos: (movements) =>
      mandar("No se guardó el historial", (s) =>
        guardarMovimientos(s, movements),
      ),
    publicarPedido: (order) =>
      mandar(`No se guardó el pedido ${order.id}`, (s) =>
        guardarPedido(s, order),
      ),
    publicarStock: (products, movements) =>
      mandar("No se guardó el stock", async (s) => {
        // Solo los productos que tocó esta tanda. Mandar los veinte porque
        // cambió uno es la forma más fácil de pisar lo que hizo otro.
        const tocados = new Set(movements.map((m) => m.productId));
        let viva = s;
        for (const product of products.filter((p) => tocados.has(p.id))) {
          const posicion = products.indexOf(product);
          ({ session: viva } = await publicarProducto(viva, product, posicion));
        }
        if (movements.length)
          ({ session: viva } = await guardarMovimientos(viva, movements));
        return { session: viva };
      }),
  };
}

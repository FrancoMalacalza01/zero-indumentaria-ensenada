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
  cancelarPedido,
  anularPagoPayway,
  cargarPanel,
  publicarProducto,
  borrarProducto,
  publicarAjustes,
  guardarOrden,
  guardarMovimientos,
  guardarPedido,
  SesionVencida,
} from "./serverWrite";
import type { AjustesHombre } from "./menOverrides.mjs";
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
  publicar: (product: Product, position: number, stockEsperado?: Record<string, number>) => void;
  despublicarBorrando: (id: string) => void;
  publicarOrden: (products: Product[]) => void;
  publicarMovimientos: (movements: Movement[]) => void;
  publicarPedido: (order: Order) => void;
  /** Stock y movimientos de una sola tanda de cambios. */
  publicarStock: (products: Product[], movements: Movement[]) => void;
  /** Cancela el pedido en el servidor y le devuelve el stock. */
  cancelar: (id: string) => void;
  /**
   * Habilita la compra de muchas fichas importadas de una vez: las guarda una por una (cada una
   * en su transacción) con el stock que traen, mostrando el avance. Se puede cortar con `detener`.
   */
  habilitarEnBloque: (
    fichas: Product[],
    posicionInicial: number,
    avance: (hechas: number, total: number) => void,
    detener: { current: boolean },
  ) => Promise<{ hechas: number; fallidas: { nombre: string; motivo: string }[]; detenido: boolean }>;
  /** Anula en Payway el pago de un pedido. Sólo `anulado` quiere decir que la plata volvió. */
  anularPagoPayway: (id: string) => Promise<{
    estado: "anulado" | "rechazado" | "incierto" | "error";
    mensaje: string;
  }>;
  /** Precios propios y bajas del catálogo de hombre, de las prendas indicadas. */
  publicarAjustes: (ids: string[], ajustes: AjustesHombre) => void;
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
  cancelar: () => {},
  habilitarEnBloque: async () => ({ hechas: 0, fallidas: [{ nombre: "", motivo: "No hay servidor conectado." }], detenido: false }),
  anularPagoPayway: async () => ({ estado: "error", mensaje: "No hay servidor conectado." }),
  publicarAjustes: () => {},
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
    publicar: (product, position, stockEsperado) =>
      mandar(`No se publicó "${product.name}"`, (s) =>
        publicarProducto(s, product, position, stockEsperado),
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
    habilitarEnBloque: async (fichas, posicionInicial, avance, detener) => {
      const fallidas: { nombre: string; motivo: string }[] = [];
      let hechas = 0;
      let siguiente = 0;
      let sesionVencida = false;
      // Tres a la vez: son cientos de llamadas y una por una tardaría mucho.
      const trabajar = async () => {
        while (!detener.current && !sesionVencida) {
          const i = siguiente++;
          if (i >= fichas.length) return;
          const ficha = fichas[i];
          const viva = vivaRef.current;
          if (!viva) return;
          try {
            const esperado = Object.fromEntries(ficha.sizes.map((t) => [t, 0]));
            const { session: renovada } = await publicarProducto(viva, ficha, posicionInicial + i, esperado);
            vivaRef.current = renovada;
            hechas++;
          } catch (err) {
            if (err instanceof SesionVencida) {
              sesionVencida = true;
              vencidaRef.current();
              return;
            }
            fallidas.push({ nombre: ficha.name, motivo: err instanceof Error ? err.message : "no se pudo guardar" });
          }
          avance(hechas + fallidas.length, fichas.length);
        }
      };
      await Promise.all([trabajar(), trabajar(), trabajar()]);
      // Recargar es lo que confirma lo que quedó guardado de verdad.
      await traer();
      return { hechas, fallidas, detenido: detener.current || sesionVencida };
    },
    anularPagoPayway: async (id) => {
      const viva = vivaRef.current;
      if (!viva) return { estado: "error", mensaje: "No hay sesión abierta." };
      try {
        const { session: renovada, valor } = await anularPagoPayway(viva, id);
        vivaRef.current = renovada;
        return valor;
      } catch (err) {
        if (err instanceof SesionVencida) vencidaRef.current();
        return { estado: "error", mensaje: "No pudimos anular el pago. Probá de nuevo." };
      }
    },
    cancelar: (id) =>
      mandar(`No se pudo cancelar el pedido ${id}`, (s) =>
        cancelarPedido(s, id),
      ),
    publicarAjustes: (ids, ajustes) =>
      mandar("No se guardaron los cambios del catálogo de hombre", (s) =>
        publicarAjustes(s, ids, ajustes),
      ),
    publicarStock: (products, movements) =>
      mandar("No se guardó el stock", async (s) => {
        // Solo los productos que tocó esta tanda. Mandar los veinte porque
        // cambió uno es la forma más fácil de pisar lo que hizo otro.
        const tocados = new Set(movements.map((m) => m.productId));
        let viva = s;
        for (const product of products.filter((p) => tocados.has(p.id))) {
          const posicion = products.indexOf(product);
          const anterior = { ...product.stock };
          for (const movimiento of movements.filter((m) => m.productId === product.id))
            anterior[movimiento.size] = (anterior[movimiento.size] || 0) - movimiento.delta;
          ({ session: viva } = await publicarProducto(viva, product, posicion, anterior));
        }
        if (movements.length)
          ({ session: viva } = await guardarMovimientos(viva, movements));
        return { session: viva };
      }),
  };
}

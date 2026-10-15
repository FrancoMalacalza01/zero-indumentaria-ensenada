/**
 * Prepara una imagen cargada desde el panel para guardarla.
 *
 * Las fotos salen del celular del dueño y pesan tres o cuatro megas cada
 * una. Se achican antes de guardarlas, porque lo que se guarda viaja: a la
 * base, al navegador de cada cliente y al `localStorage` de la demo, que
 * tiene unos pocos megas en total.
 *
 * Si el navegador no puede hacerlo (sin canvas, sin WebP), se queda con el
 * archivo original y pone un tope de tamaño: es mejor rechazar una foto
 * enorme que guardarla y que después no entre.
 */

const TIPOS = ["image/jpeg", "image/png", "image/webp"];

export async function prepararImagen(file: File, maxLado = 1400) {
  if (!TIPOS.includes(file.type))
    throw new Error("Elegí imágenes JPG, PNG o WebP.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No pudimos leer la imagen."));
    reader.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("imagen ilegible"));
      el.src = dataUrl;
    });
    const lado = Math.max(img.width, img.height);
    const escala = Math.min(1, maxLado / lado);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sin canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const salida = canvas.toDataURL("image/webp", 0.82);
    // Si el navegador no soporta WebP devuelve un PNG, que puede pesar más
    // que el original: en ese caso conviene quedarse con el original.
    if (salida.startsWith("data:image/webp") && salida.length < dataUrl.length)
      return salida;
  } catch {
    /* Sin canvas se usa el archivo tal cual. */
  }
  if (file.size > 1024 * 1024)
    throw new Error("La imagen debe pesar hasta 1 MB para poder guardarse.");
  return dataUrl;
}

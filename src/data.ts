import source from "./catalog.json";
import type { Product } from "./types";
const order = ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "U"];
const colors = [
  "Verde claro",
  "Celeste",
  "Azul marino",
  "Verde militar",
  "Ivory",
  "Crudo",
  "Marrón",
  "Beige",
  "Crudo",
  "Negro",
  "Azul marino",
  "Marrón",
];
const hex = [
  "#b8c1a9",
  "#a7b9c7",
  "#26384c",
  "#686d55",
  "#e3ddca",
  "#e5dfd2",
  "#7d5941",
  "#d7c5a2",
  "#e9e5dc",
  "#252525",
  "#26384c",
  "#78563e",
];
export const seedProducts: Product[] = source.map((p, index) => {
  const sizes = (p.sizes.length ? p.sizes : ["U"]).sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );
  return {
    id: String(p.id),
    name: p.name.split(" - ")[0],
    category: p.category as Product["category"],
    type: p.name.split(" ")[0],
    price: p.priceARS,
    image: p.image,
    color: colors[index],
    colorHex: hex[index],
    sizes,
    isNew: index < 10,
    active: true,
    description:
      "Un esencial Mistral para acompañarte todos los días. Elegí tu talle y consultá la disponibilidad de la sucursal antes de sumarlo a tu bolsa.",
    stock: {
      "La Plata": Object.fromEntries(
        sizes.map((s, i) => [
          s,
          (index + i) % 5 === 0 ? 0 : 3 + ((index + i) % 8),
        ]),
      ),
      Ensenada: Object.fromEntries(
        sizes.map((s, i) => [
          s,
          (index + i) % 4 === 0 ? 0 : 2 + ((index + i) % 6),
        ]),
      ),
    },
  };
});

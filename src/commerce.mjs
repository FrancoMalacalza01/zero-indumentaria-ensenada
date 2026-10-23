export function cartKey(item) {
  return `${item.productId}:${item.size}`;
}
export function prepareOrder(products, cart, delivery, customer, id, date) {
  if (!cart.length) return { error: "Tu bolsa está vacía." };
  const counts = new Map();
  for (const item of cart) {
    const key = cartKey(item);
    if (!Number.isInteger(item.quantity) || item.quantity < 1)
      return { error: "Revisá las cantidades de tu bolsa." };
    counts.set(key, (counts.get(key) || 0) + item.quantity);
  }
  for (const item of cart) {
    const product = products.find((p) => p.id === item.productId);
    if (!product?.active)
      return { error: "Un producto ya no está disponible. Revisá tu bolsa." };
    if ((product.stock?.[item.size] || 0) < counts.get(cartKey(item)))
      return {
        error: `No hay stock suficiente de ${product.name}, talle ${item.size}. Revisá tu bolsa.`,
      };
  }
  const items = cart.map((item) => {
    const p = products.find((p) => p.id === item.productId);
    return { ...item, name: p.name, price: p.price, image: p.image };
  });
  const nextProducts = products.map((p) => ({
    ...p,
    stock: Object.fromEntries(
      Object.entries(p.stock).map(([size, n]) => [
        size,
        n - (counts.get(`${p.id}:${size}`) || 0),
      ]),
    ),
  }));
  const order = {
    id,
    date,
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    delivery,
    customer: customer.trim() || "Cliente de demostración",
    status: "Pendiente",
  };
  return { products: nextProducts, order };
}

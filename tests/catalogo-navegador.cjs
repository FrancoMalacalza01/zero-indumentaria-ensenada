// Ejecutar con `pnpm dev` y luego `node tests/catalogo-navegador.cjs`.
// La conexión de Supabase se sustituye por un servidor simulado en memoria.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const context = await browser.newContext();
  let productos = [], stock = [], guardados = [];
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.hostname.endsWith('.supabase.co')) {
      let respuesta = [];
      if (url.pathname.endsWith('/rpc/guardar_producto_con_stock')) {
        const datos = req.postDataJSON(); guardados.push(datos);
        productos = productos.filter(p => p.id !== datos.p_producto.id).concat(datos.p_producto);
        stock = stock.filter(s => s.product_id !== datos.p_producto.id).concat(Object.entries(datos.p_stock || {}).map(([size, qty]) => ({ product_id: datos.p_producto.id, size, qty })));
        return route.fulfill({ status: 204, body: '' });
      }
      if (url.pathname.endsWith('/products')) respuesta = productos;
      if (url.pathname.endsWith('/stock')) respuesta = stock;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(respuesta) });
    }
    if (url.hostname !== '127.0.0.1' || req.resourceType() === 'image') return route.abort();
    return route.continue();
  });
  await context.addInitScript(() => localStorage.setItem('mistral-admin-session-v1', JSON.stringify({ accessToken:'demo', refreshToken:'demo', expiresAt:Date.now()+3600000, email:'demo@example.invalid', userId:'demo' })));
  const page = await context.newPage();
  page.on('pageerror', e => { throw e; });
  const base = process.env.SITE_URL || 'http://127.0.0.1:5174';
  await page.goto(`${base}/admin`, {waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Productos y stock'}).first().click();
  await page.getByLabel('Buscar productos').fill('Remera Logo Mini Bordada MC - 10182');
  const row = page.locator('tr').filter({hasText:'Remera Logo Mini Bordada MC - 10182'}).first();
  await row.getByRole('button',{name:'Editar',exact:true}).click();
  await page.getByLabel('Nombre del producto').fill('Prenda de prueba');
  await page.getByLabel('Marca', {exact:true}).fill('Marca prueba');
  await page.getByLabel('Stock talle M', {exact:true}).fill('2');
  await page.getByRole('button',{name:'Guardar cambios'}).click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForTimeout(1000);
  assert.equal(guardados.length, 1);
  assert.equal(guardados[0].p_producto.name, 'Prenda de prueba');
  assert.equal(guardados[0].p_producto.brand, 'Marca prueba');
  assert.equal(guardados[0].p_stock.M, 2);
  assert.equal(guardados[0].p_stock_esperado.M, 0);
  assert.ok(guardados[0].p_producto.images.length > 0);
  await page.goto(`${base}/hombre`, {waitUntil:'domcontentloaded'});
  await page.getByText('Prenda de prueba',{exact:true}).first().click();
  await page.getByRole('link',{name:'Elegir talle y comprar'}).click();
  await page.getByRole('button',{name:'M',exact:true}).click();
  await page.getByRole('button',{name:/Agregar a la bolsa/i}).click();
  await page.getByText('Prenda de prueba',{exact:true}).first().waitFor();
  await page.goto(`${base}/admin`, {waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Nuevo producto'}).click();
  await page.getByLabel('Nombre del producto').fill('Nuevo del local');
  await page.getByLabel('Marca',{exact:true}).fill('Marca nueva');
  await page.getByLabel('Tipo de producto').fill('Camisas');
  await page.getByLabel('Precio (ARS)',{exact:true}).fill('50000');
  await page.getByLabel('Nombre del color').fill('Azul');
  await page.getByLabel('O pegá el enlace de una imagen').fill('/images/product-fallback.svg');
  await page.getByLabel('Stock talle M',{exact:true}).fill('3');
  await page.getByRole('button',{name:'Crear producto'}).click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForTimeout(1000);
  assert.equal(guardados.length, 2);
  assert.equal(guardados[1].p_producto.name, 'Nuevo del local');
  assert.equal(guardados[1].p_stock.M, 3);
  await page.goto(`${base}/hombre`, {waitUntil:'domcontentloaded'});
  await page.getByText('Nuevo del local',{exact:true}).first().waitFor();
  console.log('OK: editar, guardar, recargar, comprar y agregar un producto nuevo');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

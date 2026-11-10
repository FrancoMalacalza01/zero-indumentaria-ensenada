#!/usr/bin/env python3
"""Baja de cada ficha de Mistral y de Brooksfield lo que la marca cuenta de la prenda.

Por prenda deja en `src/men-detalles.json`, por id del catálogo:

  composicion      "55% lino, 45% algodón" (el material), o null si la ficha no lo dice
  caracteristicas  ["Corte regular fit", "Cuello italiano", ...]
  cuidados         ["Lavar con agua tibia", ...]
  medidas          { nota, filas: [{ talle, medidas }] }, con las medidas de ESA prenda

No se inventa nada: lo que la ficha no trae, queda vacío. Los textos son de las
marcas. El color no se baja acá: ya está en `men-catalog.json`.

    python3 scripts/scrape-men-detalles.py

Necesita red hacia www.mistral.com.ar y www.brooksfieldstore.com. Baja unas 960
páginas con 4 pedidos a la vez: tarda varios minutos.
"""
import html
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

RAIZ = __file__.rsplit("/scripts/", 1)[0]
UA = "Mozilla/5.0 (compatible; zero-indumentaria-catalogo)"

TALLE = r"(?:(?:XXXXL|XXXL|XXL|XL|XS|S|M|L|[234]XL)(?:/\d{2})?|\d{2})"
INICIO = rf"(?:(?<=\s)|^)(?:-\s*)?(?:Talle\s+)?{TALLE}\s*:"
FILA = rf"(?:(?<=\s)|^)(?:-\s*)?(?:Talle\s+)?({TALLE})\s*:\s*(.+?)(?=\s*(?:\n|{INICIO}|Nota\b|Las medidas|$))"
CUIDADO = re.compile(
    r"^(lavar|lavado|usar jab|no (utilizar|usar|limpiar|exponer|retorcer|planchar|lavar|secar)|secar|planchar|"
    r"no exponer|centrifugar|lavá|no blanquear|blanquear)",
    re.I,
)
MATERIAL = r"\d{1,3}\s*%\s*[A-Za-zÁÉÍÓÚáéíóúñÑ]+"
COMPOSICION = re.compile(rf"({MATERIAL}(?:[\s,/y]+{MATERIAL})*)")


def normalizar_composicion(c):
    """Deja sólo el material ("60% algodón, 40% poliéster"), sin la frase que lo rodea."""
    if not c:
        return None
    if len(c) > 45 or "." in c.rstrip("."):
        m = COMPOSICION.search(c)
        if not m:
            return None
        c = m.group(1)
    c = re.sub(rf"({MATERIAL})\s+(?={MATERIAL})", r"\1, ", c)  # "55% lino 45% algodón" -> con coma
    c = re.sub(r"\s+,", ",", c).strip(" ,.;")
    return c[:1].upper() + c[1:] if c else None


def bajar(url):
    for intento in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "ignore")
        except Exception:
            time.sleep(1.5 * (intento + 1))
    return ""


def plano(s):
    s = re.sub(r"<(br|/p|/li|/div|/h\d)[^>]*>", "\n", s)
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"[ \t ]+", " ", s)


def sacar_json(s):
    # En Mistral la ficha viaja dentro de un JSON: < es "<", \/ es "/".
    s = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)
    return s.replace("\\/", "/").replace("\\n", "\n")


def medidas_de(texto):
    i = re.search(r"medidas en cm|medidas del producto", texto, re.I) or re.search(
        rf"{INICIO}\s*(?:ancho|pecho|largo|cintura|cadera|\d)", texto, re.I
    )
    if not i:
        return None
    trozo = texto[i.start() : i.start() + 3500]
    nota = ""
    m = re.search(r"medidas en cm\.?\s*\(([^)]*)\)", trozo, re.I)
    if m:
        nota = m.group(1).strip().capitalize()
    filas = []
    for t in re.finditer(FILA, trozo):
        medida = re.sub(r"\s+,", ",", t.group(2).replace("|", ",").replace(" - ", ", ")).strip(" ,.-\"}")
        if re.search(r"\d", medida):
            filas.append({"talle": t.group(1).upper(), "medidas": medida[:1].upper() + medida[1:]})
    return {"nota": nota, "filas": filas} if filas else None


def clasificar(lineas):
    comp, carac, cuid = None, [], []
    for raw in lineas:
        l = re.sub(r"^[\s•\-–·*]+", "", raw).strip(" .;")
        if not l or len(l) < 3 or len(l) > 110:
            continue
        if l.endswith(":") or re.match(r"(medidas|las medidas|nota|importante|talle\b|código|disponible en talles)", l, re.I) or "Código" in l:
            continue
        m = re.match(r"composici[oó]n\s*:?\s*(.+)", l, re.I)
        if m:
            comp = comp or m.group(1).strip(" .")
        elif CUIDADO.match(l):
            cuid.append(l[:1].upper() + l[1:])
        elif COMPOSICION.search(l) and comp is None and len(l) < 70:
            comp = COMPOSICION.search(l).group(1).strip()
            carac.append(l[:1].upper() + l[1:])
        else:
            carac.append(l[:1].upper() + l[1:])
    return normalizar_composicion(comp), carac, cuid


def mistral(pagina):
    t = sacar_json(pagina)
    m = re.search(r'"description": \{ "es": "(.*?)" \}', t, re.S)
    if not m:
        return None
    desc = plano(m.group(1))
    # Sin el título ("Remera Jersey MC - Código 10206") y antes de las medidas.
    desc = re.sub(r"^[^\n]*Código[^\n]*\n?", "", desc.strip(), count=1)
    corte = re.search(rf"medidas en cm|\bMedidas\b|Disponible en talles|{INICIO}\s*(?:ancho|pecho|largo|cintura|cadera|\d)", desc, re.I)
    cabeza = desc[: corte.start()] if corte else desc
    # Hay fichas con las características en renglones y otras con " - " en una línea.
    lineas = []
    for l in cabeza.split("\n"):
        lineas += re.split(r"\s+-\s+|\s*•\s*", l)
    comp, carac, cuid = clasificar(lineas)
    if comp is None:
        f = COMPOSICION.search(desc)
        comp = f.group(1).strip() if f else None
    return {"composicion": comp, "caracteristicas": carac, "cuidados": cuid, "medidas": medidas_de(desc)}


def brooksfield(pagina):
    bloques = re.findall(r'<div class="rte-content">(.*?)</div>', pagina, re.S)
    if not bloques:
        return None
    cuerpo = max(bloques, key=lambda b: (len(re.findall(r"<li", b)), len(b)))
    items = [plano(x) for x in re.findall(r"<li[^>]*>(.*?)</li>", cuerpo, re.S)]
    comp, carac, cuid = clasificar([i.strip() for i in items])
    return {"composicion": comp, "caracteristicas": carac, "cuidados": cuid, "medidas": medidas_de(plano(cuerpo))}


def uno(p):
    pid, marca, url = p
    pagina = bajar(url)
    if not pagina:
        return pid, None
    return pid, (mistral(pagina) if marca == "Mistral" else brooksfield(pagina))


if __name__ == "__main__":
    cat = json.load(open(f"{RAIZ}/src/men-catalog.json"))["products"]
    lista = [(p["id"], p["brand"], p["url"]) for p in cat if p["brand"] in ("Mistral", "Brooksfield") and p.get("url")]
    salida, vacias = {}, 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        for n, (pid, d) in enumerate(pool.map(uno, lista), 1):
            if d and (d["composicion"] or d["caracteristicas"] or d["cuidados"] or d["medidas"]):
                salida[pid] = d
            else:
                vacias += 1
            if n % 50 == 0:
                print(f"{n}/{len(lista)}", file=sys.stderr, flush=True)
    json.dump(salida, open(f"{RAIZ}/src/men-detalles.json", "w"), ensure_ascii=False, separators=(",", ":"))
    con_comp = sum(1 for d in salida.values() if d["composicion"])
    con_med = sum(1 for d in salida.values() if d["medidas"])
    print(f"{len(salida)} prendas con detalles ({con_comp} con composición, {con_med} con medidas); {vacias} sin nada")

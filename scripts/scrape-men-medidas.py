#!/usr/bin/env python3
"""Baja las medidas por talle que Mistral publica en la ficha de cada prenda.

Mistral carga la "guía de talles" en la descripción de cada producto: una lista
`Talle M: Ancho de pecho 54 cm, Largo total 74 cm`, medida con la prenda en
plano. Esto la copia a `src/men-medidas.json`, por id del catálogo, para
mostrarla en la ficha de la prenda. Las medidas son de la marca: no se inventa
ninguna, y si una ficha no trae la lista, esa prenda queda sin tabla.

    python3 scripts/scrape-men-medidas.py

Necesita red hacia www.mistral.com.ar. Tarda unos minutos: baja 209 páginas.
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


def bajar(url):
    for intento in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "ignore")
        except Exception:
            time.sleep(1.5 * (intento + 1))
    return ""


def limpiar(s):
    # La ficha viene dentro de un JSON: < es "<", \/ es "/".
    s = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)
    s = s.replace("\\/", "/").replace("\\n", "\n")
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"[ \t ]+", " ", s)


TALLE = r"(?:XXXXL|XXXL|XXL|XL|XS|S|M|L|[34]XL|\\d{2})"
# Una fila empieza en "Talle M:", "M :" o "- M:" y termina en el salto de línea,
# en la fila que sigue o en la nota. Las fichas de Mistral no usan un solo formato.
INICIO = rf"(?:(?<=\s)|^)(?:-\s*)?(?:Talle\s+)?{TALLE}\s*:"
FILA = rf"(?:(?<=\s)|^)(?:-\s*)?(?:Talle\s+)?({TALLE})\s*:\s*(.+?)(?=\s*(?:\n|{INICIO}|Nota\b|Las medidas|$))"


def medidas(pagina):
    texto = limpiar(pagina)
    # Casi todas dicen "Medidas en cm"; algunas sólo listan "- M: pecho 52 cm / largo 70 cm".
    i = re.search(r"medidas en cm", texto, re.I) or re.search(
        rf"{INICIO}\s*(?:ancho|pecho|largo|cintura|cadera|\d)", texto, re.I
    )
    if not i:
        return None
    trozo = texto[i.start() : i.start() + 3000]
    nota = ""
    m = re.search(r"medidas en cm\.?\s*\(([^)]*)\)", trozo, re.I)
    if m:
        nota = m.group(1).strip().capitalize()
    filas = []
    for t in re.finditer(FILA, trozo):
        medida = re.sub(r"\s+,", ",", t.group(2).replace("|", ",")).strip(" ,.-\"}")
        if not re.search(r"\d", medida):
            continue
        filas.append({"talle": t.group(1).upper(), "medidas": medida[:1].upper() + medida[1:]})
    if not filas:
        return None
    return {"nota": nota, "filas": filas}


def uno(p):
    pid, nombre, url = p
    return pid, nombre, medidas(bajar(url))


if __name__ == "__main__":
    cat = json.load(open(f"{RAIZ}/src/men-catalog.json"))["products"]
    lista = [(p["id"], p["name"], p["url"]) for p in cat if p["brand"] == "Mistral"]
    salida, sin = {}, []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for n, (pid, nombre, m) in enumerate(pool.map(uno, lista), 1):
            if m:
                salida[pid] = m
            else:
                sin.append(nombre)
            if n % 20 == 0:
                print(f"{n}/{len(lista)}", file=sys.stderr)
    json.dump(salida, open(f"{RAIZ}/src/men-medidas.json", "w"), ensure_ascii=False, indent=1)
    print(f"{len(salida)} prendas con medidas; {len(sin)} sin tabla")
    for n in sin:
        print("  sin tabla:", n)

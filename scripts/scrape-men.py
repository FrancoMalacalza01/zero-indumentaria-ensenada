"""Capture public men's catalogue metadata and image URLs from the source stores.

Requires lxml. Run from the repository root. Responses are cached under
research/cache so a failed run can resume without fetching the same page again.
"""

from __future__ import annotations

import concurrent.futures
import json
import re
import subprocess
import time
import urllib.request
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from lxml import html

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "research" / "cache"
OUT = ROOT / "src" / "men-catalog.json"
CACHE.mkdir(parents=True, exist_ok=True)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; catalogue-research/1.0)"}
MISTRAL = "https://www.mistral.com.ar/hombre/"
BROOKSFIELD = "https://www.brooksfieldstore.com/3-hombre-brooksfield"
MISTRAL_CATEGORIES = {
    "Remeras": "remeras",
    "Polos": "polos",
    "Sweaters": "sweaters",
    "Camisas": "camisas",
    "Buzos": "buzos",
    "Camperas": "camperas",
    "Jeans y pantalones": "jeans-y-pantalones",
    "Joggings": "joggings",
    "Bermudas y shorts": "bermudas-y-bermudas",
}


def fetch(url: str, key: str) -> bytes:
    path = CACHE / f"{key}.html"
    if path.exists():
        return path.read_bytes()
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=45) as response:
                body = response.read()
            path.write_bytes(body)
            return body
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1 + attempt * 2)
    raise AssertionError("unreachable")


def clean_url(url: str) -> str:
    if url.startswith("//"):
        url = "https:" + url
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def unique(values):
    return list(dict.fromkeys(value for value in values if value))


def unique_photos(values):
    images = {}
    for url in values:
        if not url:
            continue
        identity = re.sub(r"-(?:50|100|240|320|480|640|1024)-(?:0|1024)(?=\.[a-z]+$)", "", url)
        current = images.get(identity)
        if current is None or ("-1024-1024." in url and "-1024-1024." not in current):
            images[identity] = url
    return list(images.values())


def first(node, xpath: str):
    found = node.xpath(xpath)
    return found[0] if found else None


def first_text(node, xpath: str) -> str:
    found = first(node, xpath)
    return " ".join(found.text_content().split()) if found is not None else ""


def parse_mistral(raw: bytes, category: str = "") -> list[dict]:
    root = html.fromstring(raw)
    out = []
    for node in root.xpath("//*[contains(@class,'js-item-product') and @data-product-id]"):
        pid = node.get("data-product-id", "")
        if not pid:
            continue
        link = first(node, ".//a[contains(@class,'item-link') and @href]")
        if link is None:
            continue
        price_node = first(node, ".//*[contains(@class,'js-price-display') and @data-product-price]")
        price = int(price_node.get("data-product-price", "0")) / 100 if price_node is not None else 0
        photos = []
        for image in node.xpath(".//img"):
            source = image.get("data-src") or image.get("src") or ""
            if source.startswith(("//", "http")):
                photos.append(clean_url(source))
            srcset = image.get("data-srcset") or image.get("srcset") or ""
            if srcset:
                candidates = re.findall(r"(?:https?:)?//[^\s,]+", srcset)
                # Product variants below contain the complete gallery; the first
                # srcset candidate is only needed when the src is a placeholder.
                if not source.startswith(("//", "http")) and candidates:
                    photos.append(clean_url(candidates[0]))
        variants_node = first(node, ".//*[@data-variants]")
        variants = json.loads(variants_node.get("data-variants", "[]")) if variants_node is not None else []
        for variant in variants:
            if variant.get("image_url"):
                photos.append(clean_url(variant["image_url"]))
        append_node = first(node, ".//*[@data-append-images]")
        if append_node is not None:
            for image in json.loads(append_node.get("data-append-images", "[]")):
                candidates = re.findall(r"(?:https?:)?//[^\s,]+", image.get("thumbs", ""))
                # Use the 640px rendition where present.
                selected = next((u for u in candidates if "-640-0." in u), "")
                if selected:
                    photos.append(clean_url(selected))
        photos = unique_photos(photos)
        if not photos:
            continue
        out.append({
            "id": "m-" + pid,
            "brand": "Mistral",
            "category": category,
            "name": first_text(node, ".//*[contains(@class,'js-item-name')]") or link.get("title", ""),
            "priceARS": price,
            "url": clean_url(link.get("href", "")),
            "images": photos,
        })
    return out


def parse_brooksfield(raw: bytes) -> list[dict]:
    root = html.fromstring(raw)
    out = []
    for node in root.xpath("//*[contains(@class,'js-product-miniature') and @data-id-product]"):
        pid = node.get("data-id-product", "")
        link = first(node, ".//*[contains(@class,'product-title')]/a[@href]")
        if link is None:
            continue
        price_node = first(node, ".//*[contains(@class,'product-price') and @content]")
        photos = unique(clean_url(image.get("data-src") or image.get("src") or "")
                        for image in node.xpath(".//img[contains(@class,'product-thumbnail')]")
                        if (image.get("data-src") or "").startswith("http"))
        if not photos:
            continue
        out.append({
            "id": "b-" + pid,
            "brand": "Brooksfield",
            "category": first_text(node, ".//*[contains(@class,'product-category-name')]") or "Otros",
            "name": " ".join(link.text_content().split()),
            "reference": first_text(node, ".//*[contains(@class,'product-reference')]") or "",
            "priceARS": float(price_node.get("content", "0")) if price_node is not None else 0,
            "url": clean_url(link.get("href", "")),
            "images": photos,
        })
    return out


def get_mistral_page(spec):
    category, slug, page = spec
    base = MISTRAL if not slug else MISTRAL + slug + "/"
    return category, page, parse_mistral(fetch(base + f"?page={page}", f"m-{slug or 'all'}-{page}"), category)


def get_mistral_section(section):
    category, slug = section
    rows = []
    seen = set()
    for page in range(1, 30):
        _, _, products = get_mistral_page((category, slug, page))
        ids = {product["id"] for product in products}
        if not ids or ids <= seen:
            break
        rows.append((category, page, products))
        seen.update(ids)
        if len(ids) < 12:
            break
    return rows


def get_brooksfield_page(page: int):
    return page, parse_brooksfield(fetch(BROOKSFIELD + f"?page={page}", f"b-all-{page}"))


def get_brooksfield_gallery(product: dict):
    pid = product["id"]
    try:
        raw = fetch(product["url"], f"b-product-{pid}")
        root = html.fromstring(raw)
        gallery = unique(clean_url(value) for value in root.xpath("//*[@id='product-images-large']//*[@data-image-large-src]/@data-image-large-src"))
        return pid, gallery or product["images"]
    except Exception:
        return pid, product["images"]


def get_mistral_gallery(product: dict):
    pid = product["id"]
    try:
        raw = fetch(product["url"], f"m-product-{pid}")
        root = html.fromstring(raw)
        gallery = []
        for slide in root.xpath("//*[contains(@class,'js-product-slide') and @data-image]"):
            image = first(slide, ".//img")
            if image is None:
                continue
            srcset = image.get("data-srcset") or image.get("srcset") or ""
            candidates = re.findall(r"(?:https?:)?//[^\s,]+", srcset)
            selected = next((url for url in candidates if "-1024-1024." in url), "")
            selected = selected or image.get("src") or next(iter(candidates), "")
            if selected.startswith(("//", "http")):
                gallery.append(clean_url(selected))
        return pid, unique_photos(gallery) or product["images"]
    except Exception:
        return pid, product["images"]


def main():
    # The current men's listing has 18 pages at 12 products each. The category
    # pages may expose products not present in that listing, so take the union.
    sections = [("", "")] + list(MISTRAL_CATEGORIES.items())
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        m_pages = [row for rows in pool.map(get_mistral_section, sections) for row in rows]
    mistral = {}
    for category, page, products in m_pages:
        if products:
            print("Mistral", category or "Todos", page, len(products), flush=True)
        for product in products:
            old = mistral.get(product["id"])
            if old is None:
                mistral[product["id"]] = product
            elif category:
                old["category"] = category
                old["images"] = unique_photos(old["images"] + product["images"])

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for pid, gallery in pool.map(get_mistral_gallery, mistral.values()):
            mistral[pid]["images"] = gallery

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        b_pages = list(pool.map(get_brooksfield_page, range(1, 34)))
    brooksfield = {}
    for page, products in b_pages:
        if products:
            print("Brooksfield", page, len(products), flush=True)
        for product in products:
            brooksfield.setdefault(product["id"], product)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for pid, gallery in pool.map(get_brooksfield_gallery, brooksfield.values()):
            brooksfield[pid]["images"] = gallery

    products = list(mistral.values()) + list(brooksfield.values())
    for product in products:
        if not product["category"]:
            if product["brand"] == "Mistral" and product["name"].startswith("Parfum"):
                product["category"] = "Fragancias"
            elif product["brand"] == "Mistral" and product["name"].startswith(("Gorro", "Cap ")):
                product["category"] = "Accesorios"  # se descarta abajo: el local no vende Accesorios
            else:
                product["category"] = "Otros"
    # El local no vende la sección Accesorios: no entra al catálogo.
    products = [p for p in products if p["category"] != "Accesorios"]
    OUT.write_text(json.dumps({
        "capturedAt": date.today().isoformat(),
        "sources": [MISTRAL, BROOKSFIELD],
        "products": products,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    subprocess.run(["node", str(ROOT / "scripts" / "enrich-men-facets.mjs")], cwd=ROOT, check=True)
    print("TOTAL", len(mistral), len(brooksfield), len(products), OUT.stat().st_size)


if __name__ == "__main__":
    main()

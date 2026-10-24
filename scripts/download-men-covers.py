"""Save one optimized cover per captured men's product.

Requires Pillow. Full galleries remain linked to the original stores in
src/men-catalog.json, while the card covers load from this repository.
"""

import concurrent.futures
import io
import json
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "src" / "men-catalog.json"
DESTINATION = ROOT / "public" / "men-images"
DESTINATION.mkdir(parents=True, exist_ok=True)


def download(product):
    target = DESTINATION / (product["id"] + ".webp")
    if target.exists():
        try:
            with Image.open(target) as existing:
                if existing.width >= 300 and existing.height >= 350:
                    return product["id"], True
        except Exception:
            pass
    for url in product["images"][:3]:
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=35) as response:
                data = response.read()
            with Image.open(io.BytesIO(data)) as image:
                if image.width < 300 or image.height < 350:
                    continue
                image = image.convert("RGB")
                image.thumbnail((360, 432), Image.Resampling.LANCZOS)
                image.save(target, "WEBP", quality=74, method=4)
            return product["id"], True
        except Exception:
            continue
    return product["id"], False


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    complete = set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        for pid, ok in pool.map(download, catalog["products"]):
            if ok:
                complete.add(pid)
    for product in catalog["products"]:
        if product["id"] in complete:
            product["cover"] = "/men-images/" + product["id"] + ".webp"
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Saved {len(complete)} of {len(catalog['products'])} covers")
    print("Missing:", [p["id"] for p in catalog["products"] if p["id"] not in complete])


if __name__ == "__main__":
    main()

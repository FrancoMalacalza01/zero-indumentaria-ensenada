"""Download every catalog photo as a compact local WebP gallery.

Requires Pillow. Safe to rerun: valid files are reused, and the source URLs
remain in sourceImages for attribution and future refreshes.
"""

import concurrent.futures
import io
import json
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "src" / "men-catalog.json"
DESTINATION = ROOT / "public" / "men-gallery"
DESTINATION.mkdir(parents=True, exist_ok=True)


def download(item):
    product_id, index, url = item
    target = DESTINATION / f"{product_id}-{index:02d}.webp"
    if target.exists():
        try:
            with Image.open(target) as existing:
                existing.verify()
            return True
        except Exception:
            target.unlink()
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=35) as response:
                data = response.read()
            with Image.open(io.BytesIO(data)) as image:
                image = image.convert("RGB")
                image.thumbnail((600, 720), Image.Resampling.LANCZOS)
                image.save(target, "WEBP", quality=73, method=3)
            return True
        except Exception:
            if attempt < 2:
                time.sleep(attempt + 1)
    return False


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    items = [
        (product["id"], index, url)
        for product in catalog["products"]
        for index, url in enumerate(product.get("sourceImages", product["images"]))
    ]
    failed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
        for index, ok in enumerate(pool.map(download, items), 1):
            if not ok:
                failed.append(items[index - 1])
            if index % 500 == 0 or index == len(items):
                print(f"Downloaded {index}/{len(items)}; failed {len(failed)}", flush=True)
    for product in catalog["products"]:
        sources = product.get("sourceImages", product["images"])
        product["sourceImages"] = sources
        product["images"] = [
            f"/men-gallery/{product['id']}-{index:02d}.webp"
            if (DESTINATION / f"{product['id']}-{index:02d}.webp").exists()
            else url
            for index, url in enumerate(sources)
        ]
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("Missing photos:", failed, flush=True)


if __name__ == "__main__":
    main()

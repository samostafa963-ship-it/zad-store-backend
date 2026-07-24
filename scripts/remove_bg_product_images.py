"""
scripts/remove_bg_product_images.py

بيدور على كل المنتجات في MongoDB، ينزّل صورة كل منتج من رابطها
الحالي، يشيل الخلفية منها فعليًا باستخدام rembg، يحفظها PNG شفاف
في public/products/<productId>.png على سيرفرك نفسه، وبعدين يحدّث
حقل image في المنتج يشاور على الرابط الجديد بتاع سيرفرك.

تشغيله مرة واحدة:
    pip install rembg pymongo requests pillow python-dotenv
    python scripts/remove_bg_product_images.py

آمن للتشغيل أكتر من مرة: بيتخطى أي منتج صورته أصلاً بقت على
سيرفرك (يعني اتعالجت قبل كده)، وبيتخطى أي منتج مالوش صورة أصلاً.
"""

import os
import io
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
import requests
from PIL import Image
from rembg import remove

load_dotenv()

# دومين سيرفرك على Railway - الصور الجديدة هتتفتح من هنا
OWN_BASE_URL = "https://zad-backend-production-39a3.up.railway.app"

# فولدر المشروع الأساسي (اللي فيه public/) هو الفولدر اللي فوق scripts/
BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "public" / "products"

MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    raise SystemExit("❌ مفيش MONGO_URI في ملف .env")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
}


def already_processed(image_url):
    return isinstance(image_url, str) and OWN_BASE_URL in image_url


def download_bytes(url, redirects_left=5):
    resp = requests.get(url, headers=HEADERS, timeout=30, allow_redirects=True)
    resp.raise_for_status()
    content_type = resp.headers.get("content-type", "")
    if not content_type.startswith("image/"):
        raise ValueError(f"الرد مش صورة (content-type: {content_type or 'مش موجود'})")
    return resp.content


def main():
    client = MongoClient(MONGO_URI)
    db = client.get_default_database()
    products_col = db["products"]  # غيّر الاسم لو اسم الكوليكشن مختلف عندك
    print("✅ متصل بـ MongoDB")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    query = {"image": {"$exists": True, "$nin": ["", None, "no_image"]}}
    products = list(products_col.find(query))
    print(f"عدد المنتجات اللي عندها صورة: {len(products)}")

    processed = 0
    skipped = 0
    failed = 0

    for product in products:
        product_id = product["_id"]
        name = product.get("name", str(product_id))
        original_url = product.get("image")

        if already_processed(original_url):
            skipped += 1
            continue

        try:
            raw_bytes = download_bytes(original_url)

            # شيل الخلفية فعليًا - rembg بيرجع بايتس PNG شفاف
            output_bytes = remove(raw_bytes)

            # نتأكد إنها صورة PNG سليمة ونحفظها
            img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")
            out_path = OUTPUT_DIR / f"{product_id}.png"
            img.save(out_path, format="PNG")

            new_url = f"{OWN_BASE_URL}/products/{product_id}.png"
            products_col.update_one({"_id": product_id}, {"$set": {"image": new_url}})

            processed += 1
            print(f"✅ [{processed}] {name} → {new_url}")
        except Exception as err:
            failed += 1
            print(f"❌ فشل مع \"{name}\": {err}")

    print("\n──────── ملخص ────────")
    print(f"اتعالج (خلفية اتشالت): {processed}")
    print(f"اتخطى (متعالج قبل كده): {skipped}")
    print(f"فشل: {failed}")

    client.close()


if __name__ == "__main__":
    main()

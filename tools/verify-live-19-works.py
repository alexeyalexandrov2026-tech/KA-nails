import urllib.request
import re
import time
import sys

ts = int(time.time())
url = f"https://ka-nails.pages.dev/ru/gallery/?_cb={ts}"

req = urllib.request.Request(
    url,
    headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LiveAudit",
        "Cache-Control": "no-cache",
    },
)

with urllib.request.urlopen(req) as resp:
    content = resp.read().decode("utf-8")

# Let's define the 19 expected canonical photos and their mapped Russian strings
EXPECTATIONS = [
    ("work-01", "bordeaux-luxury-editorial.webp", "Bordeaux Luxury Editorial", "Глубокий винный / Бордо", "бордовый", "Классика"),
    ("work-02", "royal-cobalt-gloss.webp", "Royal Cobalt Gloss", "Королевский кобальт", "королевский синий", "Цвет"),
    ("work-03", "pastel-lilac-bliss.webp", "Pastel Lilac Bliss", "Нежная сирень / Лаванда", "пастельно-сиреневый", "Цвет"),
    ("work-04", "cornflower-sky-closeup.webp", "Cornflower Sky Macro", "Васильковый / Небесно-голубой", "нежно-голубого", "Цвет"),
    ("work-05", "french-yin-yang.webp", "Minimal French Contrast", "Полупрозрачный розовый / Белый", "Классический френч-педикюр", "Френч"),
    ("work-06", "french-bow-heart-art.webp", "French Bow & Heart Art", "Белый / Натуральный розовый", "бантами и сердечками", "Шиммер и детали"),
    ("work-07", "rose-quartz-shimmer.webp", "Rose Quartz Shimmer", "Розовый кварц / Шиммер", "розовый кварц", "Шиммер и детали"),
    ("work-08", "scarlet-red-lacquer.webp", "Classic Scarlet Lacquer", "Классический алый", "классический алый педикюр", "Классика"),
    ("work-09", "alabaster-pure-white.webp", "Alabaster Pure White", "Белоснежный алебастр", "белоснежный педикюр", "Классика"),
    ("work-10", "midnight-onyx-gloss.webp", "Midnight Onyx Gloss", "Глубокий черный оникс", "полуночный оникс", "Классика"),
    ("work-11", "champagne-platinum-glitter.webp", "Champagne Platinum Glitter", "Платина и шампань", "платиново-золотым глиттером", "Шиммер и детали"),
    ("work-12", "porcelain-nude-spa.webp", "Porcelain Nude Natural", "Фарфоровый нюд / Молочный", "Фарфоровый нюдовый педикюр", "Классика"),
    ("work-13", "peach-melon-cream.webp", "Peach Melon Cream", "Нежный персик / Коралл", "персиково-дынный", "Цвет"),
    ("work-14", "indigo-denim-gloss.webp", "Indigo Denim Gloss", "Глубокий деним / Индиго", "индиго деним", "Цвет"),
    ("work-15", "rose-shimmer-french.webp", "Rose Shimmer French", "Мерцающий розовый / Белый", "мерцающей розовой базой", "Френч"),
    ("work-16", "cornflower-blue-drape.webp", "Cornflower Blue Drape", "Васильковый / Небесный", "васильково-голубой", "Цвет"),
    ("work-17", "french-toe-ring-accent.webp", "French Toe-Ring Accent", "Нежный румянец / Белый", "серебряным кольцом на пальце", "Френч"),
    ("work-18", "deep-bordeaux-studio-portrait.webp", "Deep Bordeaux Studio Portrait", "Винный бордо", "глубокого винно-бордового", "Классика"),
    ("work-19", "restorative-aesthetic-transformation.webp", "Restorative Aesthetic Pedicure", "Алый лак / Эстетический уход", "Эстетическое преображение", "Эстетический уход"),
]

print("=" * 110)
print(f"{'ID':<8} | {'Filename':<40} | {'Title':<32} | {'Result':<10}")
print("=" * 110)

all_ok = True
for pid, filename, title, color, alt_substr, cat in EXPECTATIONS:
    art_m = re.search(rf'<article\s+id=[\'"]{pid}[\'"][^>]*>(.*?)</article>', content, re.DOTALL)
    if not art_m:
        print(f"{pid:<8} | {filename:<40} | {title:<32} | FAIL (article not found)")
        all_ok = False
        continue
    
    art = art_m.group(1)
    
    # Check filename in article image src
    slug = filename.replace(".webp", "")
    has_img = slug in art
    has_color = color.lower() in art.lower()
    has_alt = alt_substr.lower() in art.lower()
    has_cat = cat.lower() in art.lower()
    
    if has_img and has_color and has_alt and has_cat:
        print(f"{pid:<8} | {filename:<40} | {title:<32} | MATCH")
    else:
        print(f"{pid:<8} | {filename:<40} | {title:<32} | FAIL (img:{has_img}, col:{has_color}, alt:{has_alt}, cat:{has_cat})")
        all_ok = False

print("=" * 110)
if all_ok:
    print("ALL 19 CANONICAL WORKS PERFECTLY MATCHED ON LIVE PRODUCTION!")
    sys.exit(0)
else:
    print("SOME WORKS FAILED LIVE PRODUCTION MATCHING!")
    sys.exit(1)

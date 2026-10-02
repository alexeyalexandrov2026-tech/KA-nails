import sys
import time
import urllib.request
import re

ts = int(time.time())
base_url = "https://ka-nails.pages.dev"

EN_ENDPOINTS = ["/", "/services/", "/gallery/", "/contact/", "/book/"]
RU_ENDPOINTS = ["/ru/", "/ru/services/", "/ru/gallery/", "/ru/contact/", "/ru/book/"]
ALL_ENDPOINTS = EN_ENDPOINTS + RU_ENDPOINTS

forbidden_claims = [
    "Russian E-File Precision",
    "Japanese Structured BIAB",
    "Hospital-Grade Autoclave",
    "Structured BIAB Manicure",
    "Glazed Chrome & Micro-French",
    "Bespoke Tier Nail Art",
    "Reserve your chair",
    "BIAB",
    "Autoclave",
    "ultrasonic",
]

counterparts = {
    "/": "/ru/",
    "/services/": "/ru/services/",
    "/gallery/": "/ru/gallery/",
    "/contact/": "/ru/contact/",
    "/book/": "/ru/book/",
    "/ru/": "/",
    "/ru/services/": "/services/",
    "/ru/gallery/": "/gallery/",
    "/ru/contact/": "/contact/",
    "/ru/book/": "/book/",
}

all_clean = True

for ep in ALL_ENDPOINTS:
    url = f"{base_url}{ep}?_cb={ts}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; Chrome-Verification)",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            status = resp.status
            cf_ray = resp.headers.get("CF-RAY")
            is_ru = ep.startswith("/ru")
            expected_lang = "ru" if is_ru else "en"

            print(f"\n--- Checking {ep} (HTTP {status}, CF-RAY: {cf_ray}) ---")

            # 1. HTML lang check
            lang_match = re.search(r'<html[^>]*lang=["\']([^"\']+)["\']', content)
            actual_lang = lang_match.group(1) if lang_match else None
            if actual_lang == expected_lang:
                print(f"  [PASS] HTML lang is '{expected_lang}'")
            else:
                print(f"  [FAIL] Expected HTML lang '{expected_lang}', got '{actual_lang}'")
                all_clean = False

            # 2. Counterpart link check
            expected_counterpart = counterparts[ep]
            if f'href="{expected_counterpart}"' in content or f"href='{expected_counterpart}'" in content:
                print(f"  [PASS] Counterpart link '{expected_counterpart}' present")
            else:
                print(f"  [FAIL] Missing counterpart link '{expected_counterpart}'")
                all_clean = False

            # 3. Forbidden claims check
            for term in forbidden_claims:
                count = content.count(term)
                if count > 0:
                    print(f"  [FAIL] Forbidden claim found: '{term}' (count: {count})")
                    all_clean = False
                else:
                    print(f"  [PASS] 0 occurrences of '{term}'")

            # 4. Booking truth check
            if ep in ("/services/", "/book/"):
                if "Online booking is not available yet" in content:
                    print(f"  [PASS] Found honest booking status: 'Online booking is not available yet'")
                else:
                    print(f"  [FAIL] Missing honest booking status on {ep}")
                    all_clean = False

            if ep in ("/ru/services/", "/ru/book/"):
                if "Онлайн-запись пока недоступна." in content:
                    print(f"  [PASS] Found honest booking status: 'Онлайн-запись пока недоступна.'")
                else:
                    print(f"  [FAIL] Missing honest booking status on {ep}")
                    all_clean = False

            # 5. Localized content spot-checks
            if ep == "/":
                for term in ["Curated Pedicure Artistry", "Authentic Salon Portfolio", "Attentive Care"]:
                    if term in content:
                        print(f"  [PASS] Found EN hero badge: '{term}'")
                    else:
                        print(f"  [FAIL] Missing EN hero badge: '{term}'")
                        all_clean = False

            if ep == "/ru/":
                for term in ["Авторский педикюр", "Подлинное портфолио студии", "Внимательный уход"]:
                    if term in content:
                        print(f"  [PASS] Found RU hero badge: '{term}'")
                    else:
                        print(f"  [FAIL] Missing RU hero badge: '{term}'")
                        all_clean = False

                # Check that old English hero collage aria-labels are absent
                old_en_aria = [
                    "Bordeaux Luxury Editorial — Classic",
                    "Royal Cobalt Gloss — Color",
                    "Cornflower Sky Macro — Color",
                    "Pastel Lilac Bliss — Color",
                ]
                for term in old_en_aria:
                    if term in content:
                        print(f"  [FAIL] Found old English hero aria-label on /ru/: '{term}'")
                        all_clean = False
                    else:
                        print(f"  [PASS] 0 occurrences of old English hero aria-label: '{term}'")

                # Check that new Russian hero collage aria-labels are present
                new_ru_aria = [
                    "Открыть работу Bordeaux Luxury Editorial, категория: Классика",
                    "Открыть работу Royal Cobalt Gloss, категория: Цвет",
                    "Открыть работу Cornflower Sky Macro, категория: Цвет",
                    "Открыть работу Pastel Lilac Bliss, категория: Цвет",
                ]
                for term in new_ru_aria:
                    if term in content:
                        print(f"  [PASS] Found localized Russian hero aria-label: '{term}'")
                    else:
                        print(f"  [FAIL] Missing localized Russian hero aria-label: '{term}'")
                        all_clean = False

                # Check localized logo alt and lang="en" wrappers
                if 'alt="KA Nails Студия маникюра"' in content:
                    print(f"  [PASS] Found localized Russian logo alt: 'KA Nails Студия маникюра'")
                else:
                    print(f"  [FAIL] Missing localized Russian logo alt")
                    all_clean = False

                if 'lang="en"' in content:
                    print(f"  [PASS] Found lang='en' span wrappers for English titles")
                else:
                    print(f"  [FAIL] Missing lang='en' span wrappers")
                    all_clean = False

            # 6. Gallery 19 works check
            if ep in ("/gallery/", "/ru/gallery/"):
                articles = content.count("<article")
                if articles == 19:
                    print(f"  [PASS] Exactly 19 authentic work articles found in gallery")
                else:
                    print(f"  [WARN/FAIL] Expected 19 articles, found {articles}")
                    if articles < 19:
                        all_clean = False

            if ep == "/ru/gallery/":
                # Check semantic invariants for the 4 critical works
                invariants = [
                    ("work-03", "pastel-lilac-bliss", ["сирен", "лаванд"], ["френч", "ультратонким френчем"]),
                    ("work-04", "cornflower-sky-closeup", ["голуб"], ["лаванд", "сирен"]),
                    ("work-05", "french-yin-yang", ["френч"], ["индиго", "морская волна"]),
                    ("work-07", "rose-quartz-shimmer", ["розов", "кварц", "шиммер"], ["алый", "красный"]),
                ]
                for art_id, slug, must_have_any, must_not_have_any in invariants:
                    # Match article by ID
                    art_m = re.search(rf'<article\s+id=[\'"]{art_id}[\'"][^>]*>(.*?)</article>', content, re.DOTALL)
                    if not art_m:
                        print(f"  [FAIL] Missing article #{art_id} on /ru/gallery/")
                        all_clean = False
                        continue
                    art_text = art_m.group(1)
                    if slug not in art_text:
                        print(f"  [FAIL] Article #{art_id} does not contain slug {slug}")
                        all_clean = False
                    
                    has_expected = any(w.lower() in art_text.lower() for w in must_have_any)
                    if not has_expected:
                        print(f"  [FAIL] Article #{art_id} missing expected Russian terms {must_have_any}")
                        all_clean = False
                    else:
                        print(f"  [PASS] Article #{art_id} ({slug}) correctly contains {must_have_any}")

                    has_forbidden = any(w.lower() in art_text.lower() for w in must_not_have_any)
                    if has_forbidden:
                        print(f"  [FAIL] Article #{art_id} contains forbidden mismatched terms {must_not_have_any}")
                        all_clean = False
                    else:
                        print(f"  [PASS] Article #{art_id} ({slug}) 0 occurrences of {must_not_have_any}")

    except Exception as e:
        print(f"  [FAIL] Failed to fetch {ep}: {e}")
        all_clean = False

print("\n" + "=" * 60)
if all_clean:
    print("ALL 10 ROUTES VERIFIED: Production alias ka-nails.pages.dev is 100% clean and bilingual!")
    sys.exit(0)
else:
    print("SOME CHECKS FAILED: Stale or unlocalized content detected.")
    sys.exit(1)

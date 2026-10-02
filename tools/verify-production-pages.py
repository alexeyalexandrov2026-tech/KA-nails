import time
import urllib.request

ts = int(time.time())
endpoints = ["/", "/services/", "/gallery/", "/contact/", "/book/"]
base_url = "https://ka-nails.pages.dev"

forbidden = [
    "Russian E-File Precision",
    "Japanese Structured BIAB",
    "Hospital-Grade Autoclave",
    "Structured BIAB Manicure",
    "Glazed Chrome & Micro-French",
    "Bespoke Tier Nail Art",
    "Reserve your chair",
    "Russian",
    "Japanese",
    "BIAB",
    "Autoclave",
    "ultrasonic",
]

expected_home = [
    "Studio Portfolio",
    "19 Verified Works",
    "Curated Pedicure Artistry",
    "Authentic Salon Portfolio",
    "Attentive Care",
]

all_clean = True

for ep in endpoints:
    url = f"{base_url}{ep}?_cb={ts}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        },
    )
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode("utf-8")
        status = resp.status
        cf_ray = resp.headers.get("CF-RAY")
        print(f"\n--- Checking {ep} (HTTP {status}, CF-RAY: {cf_ray}) ---")

        for term in forbidden:
            count = content.count(term)
            if count > 0:
                print(f"  [FAIL] Forbidden term found: '{term}' (count: {count})")
                all_clean = False
            else:
                print(f"  [PASS] 0 occurrences of '{term}'")

        if ep == "/":
            for term in expected_home:
                count = content.count(term)
                if count == 0:
                    print(f"  [FAIL] Expected term missing: '{term}'")
                    all_clean = False
                else:
                    print(f"  [PASS] Found expected term: '{term}' (count: {count})")

        if ep in ("/services/", "/book/"):
            if "Online booking is not available yet" in content:
                print(f"  [PASS] Found honest booking status: 'Online booking is not available yet'")
            else:
                print(f"  [FAIL] Missing honest booking status on {ep}")
                all_clean = False

print("\n" + "=" * 50)
if all_clean:
    print("ALL CHECKS PASSED: Production alias ka-nails.pages.dev is 100% clean and up-to-date!")
else:
    print("SOME CHECKS FAILED: Stale content detected.")

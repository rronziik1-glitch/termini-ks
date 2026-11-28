"""Turn the OpenStreetMap export (scripts/data/osm-kosovo-raw.json) into Termini "unclaimed" listings.

Source: OpenStreetMap contributors, Open Database License (ODbL). Every page that shows these listings
must credit "© OpenStreetMap contributors". Only public facts are kept: name, type, city, address, phone,
position. No photos, no opening hours, no reviews.

Run:  python scripts/osm-to-listings.py   ->  scripts/data/listings-kosovo.json  (best first)
"""
import json
import math
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "data" / "osm-kosovo-raw.json"
OUT = HERE / "data" / "listings-kosovo.json"

# City centres (lat, lng). A place gets the nearest one if it is within 12 km.
CITIES = {
    "Prishtinë": (42.6629, 21.1655), "Prizren": (42.2139, 20.7397), "Pejë": (42.6591, 20.2883),
    "Gjakovë": (42.3803, 20.4308), "Ferizaj": (42.3702, 21.1553), "Gjilan": (42.4635, 21.4694),
    "Mitrovicë": (42.8914, 20.8660), "Vushtrri": (42.8231, 20.9675), "Podujevë": (42.9106, 21.1931),
    "Fushë Kosovë": (42.6381, 21.0961), "Lipjan": (42.5217, 21.1222), "Suharekë": (42.3586, 20.8253),
    "Rahovec": (42.3992, 20.6547), "Drenas": (42.6258, 20.8931), "Skënderaj": (42.7467, 20.7889),
    "Istog": (42.7808, 20.4875), "Kamenicë": (42.5781, 21.5803), "Viti": (42.3217, 21.3583),
    "Malishevë": (42.4831, 20.7461), "Deçan": (42.5397, 20.2886), "Klinë": (42.6211, 20.5778),
    "Obiliq": (42.6869, 21.0703), "Kaçanik": (42.2319, 21.2592), "Dragash": (42.0611, 20.6531),
    "Shtime": (42.4331, 21.0397), "Graçanicë": (42.6000, 21.1933),
}
MAIN = ["Prishtinë", "Gjakovë", "Prizren", "Pejë", "Ferizaj", "Gjilan", "Mitrovicë"]


def km(a, b):
    r = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def fold(s):
    return unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode()


def phone_e164(raw):
    if not raw:
        return ""
    first = re.split(r"[;,/]", raw)[0]
    d = re.sub(r"[^\d+]", "", first)
    if d.startswith("00"):
        d = "+" + d[2:]
    if d.startswith("+383") and len(d) == 12:
        return d
    if d.startswith("383") and len(d) == 11:
        return "+" + d
    if re.fullmatch(r"0[2-4]\d{7}", d):
        return "+383" + d[1:]
    if re.fullmatch(r"\+(377|386|381)\d{8}", d):     # old Vala / IPKO / Serbia codes still printed on signs
        return d
    return ""


def category(tags, name):
    n = fold(name)
    shop, amenity = tags.get("shop", ""), tags.get("amenity", "")
    if amenity == "dentist" or "dental" in n or "dentar" in n or "stomatolog" in n:
        return "dentist"
    if amenity == "car_wash" or "lavazh" in n or "car wash" in n:
        return "lavazh"
    if shop == "car_repair":
        return "lavazh" if ("lavazh" in n or "auto" in n) else ""
    if shop == "beauty":
        return "salon"
    if shop == "hairdresser":
        if re.search(r"barber|berber|frizer meshkuj|men", n):
            return "berber"
        if re.search(r"salon|sallon|beauty|hair|nails|studio|lady|femra", n):
            return "salon"
        return "berber"
    if amenity in ("clinic", "doctors"):
        # Public health centres (QKMF / AMF / QMF) are not private businesses.
        if re.search(r"\b(qkmf|amf|qmf|qendra kryesore|ambulant|spital|hospital)\b", n):
            return ""
        return "klinike"
    return ""


def slugify(s):
    s = fold(s).replace("ë", "e")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:40].strip("-")


def main():
    data = json.loads(RAW.read_text(encoding="utf-8"))
    out, seen = [], set()
    for el in data["elements"]:
        tags = el.get("tags", {})
        name = (tags.get("name:sq") or tags.get("name") or "").strip()
        if len(name) < 3 or len(name) > 60:
            continue
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lng = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lng is None:
            continue
        cat = category(tags, name)
        if not cat:
            continue
        near = min(CITIES.items(), key=lambda c: km((lat, lng), c[1]))
        if km((lat, lng), near[1]) > 12:
            continue
        city = near[0]
        street = " ".join(x for x in [tags.get("addr:street", ""), tags.get("addr:housenumber", "")] if x).strip()
        phone = phone_e164(tags.get("phone") or tags.get("contact:phone") or tags.get("contact:mobile") or "")
        key = (fold(name), city)
        if key in seen:
            continue
        seen.add(key)
        score = (3 if phone else 0) + (2 if city in MAIN else 0) + (1 if street else 0) + \
                {"berber": 3, "salon": 3, "dentist": 2, "klinike": 1, "lavazh": 1}[cat]
        out.append({
            "sourceId": f"osm:{el['type']}/{el['id']}", "name": name, "category": cat, "city": city,
            "address": street, "phone": phone, "lat": round(lat, 6), "lng": round(lng, 6), "_score": score,
        })
    out.sort(key=lambda x: (-x["_score"], x["city"], x["name"]))
    used = set()
    for x in out:
        base = slugify(f"{x['name']} {x['city']}") or "biznes"
        slug, n = base, 2
        while slug in used:
            slug, n = f"{base[:36]}-{n}", n + 1
        used.add(slug)
        x["slug"] = slug
        del x["_score"]
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter
    top = out[:100]
    print(len(out), "listings;", "top 100:", Counter(x["category"] for x in top), Counter(x["city"] for x in top).most_common(8),
          sum(1 for x in top if x["phone"]), "with phone")


if __name__ == "__main__":
    main()

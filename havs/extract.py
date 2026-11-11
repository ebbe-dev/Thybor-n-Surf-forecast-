"""Trækker surf-grejet ud af HAVS' produktfeed til et kompakt JSON-uddrag
til appen: id, navn, pris, førpris, url, miniaturebillede, kategori og de
egenskaber reglerne bruger (tykkelse, hætte, mm, længde, soft, varm)."""
import json, re, sys, collections
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding="utf-8")); items = d["products"]

def cats(it): return set(it["categories"])
def has(it, *names): return any(n in it["categories"] for n in names)
def thumb(url):
    if not url: return None
    return re.sub(r"\.(webp|jpg|jpeg|png)$", r"-t.\1", url, flags=re.I)
def mm_of(name):
    m = re.search(r"(\d(?:[.,]\d)?)\s*mm", name, re.I)
    if m: return float(m.group(1).replace(",", "."))
    m = re.search(r"\b(\d)\s*[/:]\s*(\d)\b", name)
    return float(m.group(1)) if m else None
def thick_of(name):
    m = re.search(r"\b(\d)\s*[/:]\s*(\d)(?:\s*[/:]\s*(\d))?", name)
    if m: return int(m.group(1))
    m = re.search(r"(\d)\s*mm", name, re.I)
    return int(m.group(1)) if m else None
def who_of(it):
    n = it["name"].lower(); c = cats(it)
    if any(k in c for k in ("Børn", "Våddragter til Børn", "Våddragter til Junior", "C-Skins Børn Våddragter", "Patagonia Børn")) or re.search(r"\b(kids?|junior|boys?|girls?|youth)\b", n): return "junior"
    if any(k in c for k in ("Kvinder", "Våddragter til Kvinder", "C-Skins Dame Våddragter")) or re.search(r"\b(women|womens|dame|ladies|wms)\b", n): return "dame"
    return "herre"
def length_of(name):
    m = re.search(r"(\d{1,2})\s*'\s*(\d{1,2})?", name)
    if not m: return None
    return int(m.group(1)) + (int(m.group(2)) if m.group(2) else 0) / 12

rows = []
for it in items:
    n = it["name"]; c = cats(it); cat = None; x = {}
    acc_sets = {"Accessories til Våddragter", "Rash Guards", "Rash & UV T-Shirts", "Neopren veste", "Neopren huer", "Neopren sko", "Neopren handsker", "Badeponchoer", "Badekåber", "Våddragts Pleje"}
    if has(it, "Våddragter", "Neoprendragter") and not (c & acc_sets) and not re.search(r"\b(vest|rash|uv|top|skin|towel|poncho|hood)\b", n, re.I):
        th = thick_of(n)
        if th: cat = "wetsuit"; x = {"thick": th, "hooded": bool(re.search(r"hood", n, re.I)), "who": who_of(it)}
    elif has(it, "Neopren handsker", "C-Skins Handsker", "Vinterbader handsker"):
        cat = "gloves"; x = {"mm": mm_of(n), "who": who_of(it)}
    elif has(it, "Neopren sko", "Solite Neopren Støvle", "C-Skins Sko", "Vinterbader sko") and not re.search(r"shoreline|beach sko|beach shoe", n, re.I):
        cat = "boots"; x = {"mm": mm_of(n), "who": who_of(it)}
    elif has(it, "Neopren huer") and re.search(r"hood", n, re.I) and not re.search(r"vest", n, re.I):
        cat = "hood"; x = {"mm": mm_of(n), "who": who_of(it)}
    elif has(it, "Dryrobe", "Dryrobe ponchoer", "Dryrobe jakker", "Surf Ponchoer", "Poncho", "Vinterbader Poncho", "Badeponchoer", "Vinterbadekåber", "Badejakker", "Havs Poncho") and not re.search(r"towel|håndklæde|kids|junior|børn", n, re.I) and who_of(it) != "junior":
        if re.search(r"cover|\bmat\b|bag|cushion|seat|\bhat\b|\bcap\b|sock|glove|pouch|strap|hanger|bottle|towel|håndklæde|frott", n, re.I): continue
        cat = "robe"; x = {"warm": bool(re.search(r"dryrobe (advance|lite)|long sleeve|sleeveless|swimmer coat|rig wear|chang(e|ing) robe|sherpa|fleece|waterproof", n, re.I))}
    elif has(it, "Patagonia Huer", "Havs Huer", "Lakor huer") or (has(it, "Huer") and not (c & {"Neopren huer", "Sauna Huer", "SaunaGut Huer"})):
        if re.search(r"hue|beanie", n, re.I): cat = "beanie"
    elif has(it, "Surfboards") and not has(it, "SUP Boards", "Paddleboards", "FCS Boardbags", "NSP Boardbags", "Bags & Covers"):
        ln = length_of(n)
        if ln: cat = "board"; x = {"len": round(ln, 2), "soft": bool(re.search(r"soft|foam|protech|p2|surftech", n, re.I) or has(it, "Soft Tops")), "kind": "long" if has(it, "Longboard", "NSP Longboard") or ln >= 8.5 else "fun" if has(it, "Mini Malibu", "Fun Shape") or ln >= 6.5 else "short"}
    elif has(it, "SUP Boards", "Paddleboards") and re.search(r"\bsup\b|paddleboard", n, re.I) and length_of(n) and not re.search(r"paddle\b|fin\b|leash|bag|pump", n, re.I):
        cat = "sup"; x = {"len": round(length_of(n), 2)}
    elif re.search(r"repair (kit|patch)", n, re.I) and has(it, "Surfing"):
        cat = "repair"
    elif has(it, "Surf Wax") and re.search(r"\bwax\b", n, re.I) and not re.search(r"box|comb|remover", n, re.I):
        cat = "wax"
    if not cat: continue
    price = it["price"]; old = it["old_price"]
    row = {"i": it["id"], "n": n, "p": round(price) if price is not None else None, "o": round(old) if old else None, "u": it["url"], "m": thumb(it["image"]), "c": cat}
    row.update({k: v for k, v in x.items() if v is not None})
    rows.append(row)

cnt = collections.Counter(r["c"] for r in rows)
print("uddrag:", len(rows), dict(cnt))
print("på tilbud i uddraget:", sum(1 for r in rows if r["o"]))
for c in cnt:
    ex = [r for r in rows if r["c"] == c][:3]
    for r in ex: print("  ", c, "|", r["n"], "|", r["p"], r["o"], {k: r[k] for k in r if k in ("thick", "hooded", "who", "mm", "len", "soft", "kind", "warm")})
txt = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
open(out, "w", encoding="utf-8").write(txt)
print("bytes", len(txt))

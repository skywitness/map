"""鐵路軌距（交通主題的擴充，2026-10-29）：各國主要的軌距與標準軌占鐵路長度的比例。

Natural Earth 的鐵路沒有軌距欄位，只能做國家層級（使用者決定，不畫換軌的國界）。

**資料**（使用者決定：CIA 世界概況為主，缺的用英文維基百科補）：
- CIA World Factbook 的 Transportation > Railways（公有領域；用 factbook/factbook.json 鏡像停刊後最後一次的 commit，
  跟石油主題同一個，sources/factbook.py）：每種軌距的公里數，例如「345 km (2018) 1.435-m gauge (345 km electrified)」，
  note 裡另外列的軌距（日本的 1.067 m、台灣的 0.762 m）也算。數字的單位、拼字不一（「1.067 m guage」「1.435 mm」），
  只認公尺數；沒寫軌距的「broad gauge」「standard gauge」依 MISSING_GAUGE 補，明顯的筆誤依 GAUGE_FIX 改。
  dual gauge（同一條線兩種軌距）不算進比例，只列在側欄。資料年份各國不同（2008–2023 年），寫在側欄。
- 2023 年起世界概況的歐洲各國、俄羅斯、阿根廷等只剩總長（德國、義大利只剩窄軌）：改用同一個鏡像 2022-12-29 的版本
  （OLD_COMMIT），快取在 .cache/factbook-2022-12-29/。
- 兩個版本都沒有的（亞美尼亞、南蘇丹）：英文維基百科「Rail transport in <國名>」導言資訊框的 gauge、gauge1… 欄位
  （CC BY-SA 4.0），快取在 .cache/wikipedia/rail/；資訊框沒有的照條目內文寫在 WIKI_PROSE。維基百科的 API 對這裡常回 429，
  照 Retry-After 等。只有軌距、沒有長度的，主要軌距用第一個，不算比例。

**軌距的分類**（CLASSES，src/topics/transport.ts 的 GAUGES 要一致）：標準軌 1,435 mm、俄規寬軌 1,520／1,524 mm、
印度寬軌 1,676 mm、伊比利寬軌 1,668 mm、愛爾蘭寬軌 1,600 mm、開普軌 1,067 mm、米軌 1,000 mm、其他（1,000 mm 以下的窄軌、
蘇格蘭軌 1,372 mm 等）。主要軌距是公里數最多的那一類。

**輸出**（public/data/topics/transport/）：gauge.json（主要軌距的代碼）、standard-share.json（標準軌占 %）、
gauge-detail.json（側欄：每國 [來源（factbook／factbook-2022／wikipedia）, 資料年份, [[軌距 mm, 公里或 null], …],
[[軌距 mm, 軌距 mm, 公里] 雙軌距…], 維基百科條目]）。年份照交通主題其他的快照指標寫 2026。
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, USER_AGENT, download, indicator_file, write_json
from sources.countries import from_alpha2
from sources.factbook import COMMIT, RAW, TLD_FIX

OUT = OUT_DIR / "topics" / "transport"
YEAR = 2026
# 有 Railways 欄位的 138 個檔（區域資料夾 → FIPS 代碼；2026-10-29 從整個版本庫找出來的，資料已經凍結）。
# codeload 的整包 zip 從這裡回 403，逐檔從 raw.githubusercontent.com 下載
RAIL_FILES = {
    "africa": "ag ao bc bn cf cg cm dj eg er et gb gh gv iv ke li ma mi ml mo mr mz ni od sf sg su to ts tz ug uv wa wz za zi",
    "australia-oceania": "as fj kt nz",
    "central-america-n-caribbean": "cs cu dr es gt ho pm sc",
    "central-asia": "aj am gg kg kz rs ti tx uz",
    "east-n-southeast-asia": "bm cb ch id ja kn ks la mg my rp th tw vm",
    "europe": "al au be bk bo bu da ei en ez fi fr gm gr hr hu im it kv lg lh lo ls lu md mj mk mn nl no pl po ri ro si sp sw sz uk up",
    "middle-east": "ir is iz jo le sa sy tu",
    "north-america": "ca mx us",
    "south-america": "ar bl br ci co ec pa pe uy ve",
    "south-asia": "bg ce in np pk",
}
# 2023 年 1 月起，世界概況的歐洲各國與俄羅斯、阿根廷、阿爾及利亞等只剩鐵路總長（約 35 國），德國、義大利只剩窄軌。這些國家改用
# 2022-12-29 的版本：之後第一次改版就拿掉了各軌距的公里數（2026-10-29 用部分 clone 逐檔二分搜尋各檔的修改歷史確認）
OLD_COMMIT = "61dadec0c9c9a38eb4c9665aa779977c47dd0481"
OLD_RAW = RAW.replace(COMMIT, OLD_COMMIT)
# 世界概況哪一版都沒有軌距、維基百科的資訊框也沒有的：維基百科條目內文寫的軌距（ISO3 → (mm, 條目)）
WIKI_PROSE = {
    "SSD": (1067, "Rail transport in South Sudan"),  # 巴巴努薩（蘇丹）到瓦烏的單線，蘇丹鐵路的 1,067 mm 支線
}
WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_CACHE = CACHE_DIR / "wikipedia" / "rail"

# 代碼 → (名稱, 判斷的函式)；src/topics/transport.ts 的 GAUGES 依同樣的順序
CLASSES = [
    (1, "standard", lambda mm: mm == 1435),
    (2, "russian", lambda mm: mm in (1520, 1524)),
    (3, "indian", lambda mm: mm == 1676),
    (4, "iberian", lambda mm: mm == 1668),
    (5, "irish", lambda mm: mm == 1600),
    (6, "cape", lambda mm: mm == 1067),
    (7, "metre", lambda mm: mm == 1000),
    (8, "other", lambda mm: True),
]

# 世界概況寫了分類、沒寫軌距的（ISO3, 欄位）→ mm；其他沒寫軌距的 standard gauge 都是 1,435
MISSING_GAUGE = {
    ("IND", "broad gauge"): 1676,  # 印度的寬軌是 1,676 mm（世界概況 2014 年只寫 broad gauge）
}
# 世界概況的軌距明顯寫錯的（ISO3, 寫的 mm）→ 改成的 mm
GAUGE_FIX = {
    ("CHE", 1200): 1000,  # 「1,630 km 1.200-m gauge」：瑞士的窄軌是雷蒂亞鐵路、馬特洪-哥達鐵路等的 1,000 mm 米軌
    ("ZAF", 1065): 1067,  # 「1.065-m gauge」：南非是 3 呎 6 吋的開普軌
    ("DZA", 1432): 1435,  # 「1.432-m gauge」：阿爾及利亞的幹線是標準軌（另有 1,055 mm 的窄軌，那個是對的）
    ("IMN", 1076): 1067,  # 「1.076-m gauge」：曼島的斯奈山登山鐵路是 3 呎 6 吋
}
# 各軌距加總不到總長的這個比例，就改看 2022-12-29 的版本（德國、義大利最新版只列了窄軌，漏掉標準軌）
MIN_COVERAGE = 0.5
# 世界概況的數字明顯錯的欄位（ISO3, 欄位）：不算
SKIP_FIELDS = {
    ("FRA", "narrow gauge"),  # 「-5 km」
}

_GAUGE = re.compile(r"([\d,]+(?:\.\d+)?)\s*(?:km)?\s*(?:\(\d{4}[^)]*\))?\s*(\d\.\d{2,3})(?:-(\d\.\d{2,3}))?[\s-]*m{1,2}\b", re.I)
_KM = re.compile(r"^\s*([\d,]+(?:\.\d+)?)\s*km")
_YEAR = re.compile(r"\((\d{4})\)")


def _mm(meters: str) -> int:
    """「1.067」→ 1067；「1.52」→ 1520"""
    return round(float(meters) * 1000)


def gauge_class(mm: int) -> int:
    return next(code for code, _, test in CLASSES if test(mm))


def _iso(d: dict) -> str | None:
    tld_text = d.get("Communications", {}).get("Internet country code", {}).get("text", "")
    tlds = re.findall(r"\.([a-z]{2})\b", tld_text)
    tld = "fr" if "fr" in tlds else (tlds[0] if len(tlds) == 1 else None)
    return from_alpha2(TLD_FIX.get(tld, (tld or "").upper())) if tld else None


def _parse(rail: dict, iso: str) -> tuple[dict[int, float], list[tuple[int, int, float]], list[int]]:
    """Railways 欄位 → ({mm: km}, [(mm, mm, km) 雙軌距], [資料年份…])"""
    gauges: dict[int, float] = defaultdict(float)
    dual: list[tuple[int, int, float]] = []
    years: list[int] = []
    texts = {}
    for key, field in rail.items():
        text = (field.get("text", "") if isinstance(field, dict) else str(field)).replace("<br>", " ; ")
        texts[key] = re.sub(r"<[^>]+>", " ", text)
        years += [int(y) for y in _YEAR.findall(texts[key])]
    for key, text in texts.items():
        if key == "total" or (iso, key) in SKIP_FIELDS:
            continue
        found = _GAUGE.findall(text)
        if found:
            for km, a, b in found:
                if b:
                    dual.append((_mm(a), _mm(b), float(km.replace(",", ""))))
                else:
                    mm = _mm(a)
                    gauges[GAUGE_FIX.get((iso, mm), mm)] += float(km.replace(",", ""))
            continue
        m = _KM.match(text)
        if not m:
            continue
        mm = MISSING_GAUGE.get((iso, key)) or (1435 if key == "standard gauge" else None)
        if mm:
            gauges[mm] += float(m.group(1).replace(",", ""))
        else:
            print(f"    {iso} 的 {key} 沒寫軌距，不算：{text[:60]}")
    # 中國只有一個 total 欄位，軌距寫在總長後面（「150,000 km (2021) 1.435-m gauge」）
    if not gauges and "total" in texts:
        for km, a, b in _GAUGE.findall(texts["total"]):
            if not b:
                gauges[_mm(a)] += float(km.replace(",", ""))
    return dict(gauges), dual, years


def factbook() -> dict[str, dict]:
    """ISO3 → {name, year, edition, gauges: {mm: km}, dual: [(mm, mm, km)]}；兩個版本都只有總長的 gauges 是空的"""
    out: dict[str, dict] = {}
    for region, codes in RAIL_FILES.items():
        for code in codes.split():
            path = download(f"{RAW}/{region}/{code}.json", "factbook", f"{region}-{code}.json")
            with open(path, encoding="utf-8") as f:
                d = json.load(f)
            rail = d.get("Transportation", {}).get("Railways")
            iso = _iso(d)
            if not rail or not iso:
                continue
            gauges, dual, years = _parse(rail, iso)
            edition = "latest"
            total = _KM.match(rail["total"].get("text", "")) if isinstance(rail.get("total"), dict) else None
            covered = sum(gauges.values()) + sum(km for *_, km in dual)
            if not gauges or (total and covered < MIN_COVERAGE * float(total.group(1).replace(",", ""))):
                try:
                    old_path = download(f"{OLD_RAW}/{region}/{code}.json", "factbook-2022-12-29", f"{region}-{code}.json")
                except urllib.error.HTTPError as err:
                    if err.code != 404:
                        raise
                    print(f"    {region}/{code} 在 2022-12-29 的版本還沒有")
                    old_path = None
                old = {}
                if old_path:
                    with open(old_path, encoding="utf-8") as f:
                        old = json.load(f).get("Transportation", {}).get("Railways") or {}
                old_gauges, old_dual, old_years = _parse(old, iso)
                if sum(old_gauges.values()) > covered:
                    gauges, dual, years, edition = old_gauges, old_dual, old_years, "2022-12-29"
            out[iso] = {
                "name": d.get("Government", {}).get("Country name", {}).get("conventional short form", {}).get("text"),
                "year": max(years) if years else None,
                "edition": edition,
                "gauges": gauges,
                "dual": dual,
            }
    return out


def _wikitext(title: str) -> str | None:
    """英文維基百科的條目原始碼（跟著重新導向）；快取，429 照 Retry-After 等"""
    WIKI_CACHE.mkdir(parents=True, exist_ok=True)
    cache = WIKI_CACHE / (re.sub(r"[^\w]+", "_", title) + ".txt")
    if cache.exists():
        text = cache.read_text(encoding="utf-8")
        return text or None
    params = {"action": "parse", "prop": "wikitext", "format": "json", "formatversion": "2", "redirects": "1", "page": title}
    url = f"{WIKI_API}?{urllib.parse.urlencode(params)}"
    for _ in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=60) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as err:
            if err.code != 429:
                raise
            time.sleep(int(err.headers.get("Retry-After") or 20) + 1)
    else:
        raise RuntimeError("英文維基百科一直回 429，稍後再跑")
    text = data.get("parse", {}).get("wikitext", "") if "error" not in data else ""
    cache.write_text(text, encoding="utf-8")
    time.sleep(1)
    return text or None


_RAILGAUGE = re.compile(r"\{\{\s*(?:RailGauge|Track gauge)\s*\|\s*([^}|]+)", re.I)
_CONVERT = re.compile(r"\{\{\s*convert\s*\|\s*([\d,.]+)\s*\|\s*km", re.I)
NAMED_GAUGES = {"sg": 1435, "standard": 1435, "ussr": 1520, "russian": 1520, "1520mm": 1520, "irish": 1600, "iberian": 1668, "indian": 1676, "cape": 1067, "metre": 1000, "1000mm": 1000, "sc": 1372}


def _gauge_mm(token: str) -> int | None:
    token = token.strip().lower().replace(" ", "").replace(",", "").replace("&nbsp;", "")
    if token in NAMED_GAUGES:
        return NAMED_GAUGES[token]
    m = re.match(r"^(\d+(?:\.\d+)?)mm$", token)
    if m:
        return round(float(m.group(1)))
    m = re.match(r"^(\d+)ft(\d+(?:\.\d+)?)?in$", token)  # 3ft6in
    if m:
        return round((int(m.group(1)) * 12 + float(m.group(2) or 0)) * 25.4)
    return None


def wikipedia(name: str) -> dict | None:
    """「Rail transport in <國名>」導言（第一個章節標題之前）的資訊框：{gauges: [(mm, km 或 None)…], title}；
    找不到軌距是 None。資訊框不一定是 Infobox rail network（亞美尼亞是別的），只看 gauge、gauge1… 欄位"""
    for title in (f"Rail transport in {name}", f"Rail transport in the {name}"):
        text = _wikitext(title)
        if not text:
            continue
        lead = text.split("\n==", 1)[0]
        fields = dict(re.findall(r"\|\s*(gauge\d*|gauge\d*length)\s*=\s*([^\n|][^\n]*)", lead))
        gauges: list[tuple[int, float | None]] = []
        for key in sorted((k for k in fields if re.fullmatch(r"gauge\d*", k)), key=lambda k: int(k[5:] or 0)):
            m = _RAILGAUGE.search(fields[key])
            mm = _gauge_mm(m.group(1)) if m else None
            if not mm or any(g == mm for g, _ in gauges):
                continue
            length = _CONVERT.search(fields.get(f"{key}length", ""))
            gauges.append((mm, float(length.group(1).replace(",", "")) if length else None))
        if gauges:
            return {"gauges": gauges, "title": title}
    return None


def build() -> None:
    fb = factbook()
    rows: dict[str, dict] = {}
    old = []
    for iso, d in fb.items():
        if d["gauges"]:
            src = "factbook" if d["edition"] == "latest" else "factbook-2022"
            rows[iso] = {"src": src, "year": d["year"], "gauges": list(d["gauges"].items()), "dual": d["dual"]}
            if src != "factbook":
                old.append(iso)
    missing = sorted((iso, d["name"]) for iso, d in fb.items() if not d["gauges"] and d["name"])
    print(f"  世界概況：{len(rows)} 國有各軌距的公里數（其中 {len(old)} 國用 2022-12-29 的版本：{' '.join(sorted(old))}），"
          f"{len(missing)} 國兩個版本都只有總長，查英文維基百科")
    not_found = []
    for iso, name in missing:
        if iso in WIKI_PROSE:
            mm, title = WIKI_PROSE[iso]
            rows[iso] = {"src": "wikipedia", "year": None, "gauges": [(mm, None)], "title": title, "dual": []}
            continue
        w = wikipedia(name)
        if not w:
            not_found.append(f"{iso} {name}")
            continue
        rows[iso] = {"src": "wikipedia", "year": None, "gauges": w["gauges"], "title": w["title"], "dual": []}
    if not_found:
        print(f"  維基百科也找不到軌距的（不畫）：{', '.join(not_found)}")

    main: dict[str, float] = {}
    share: dict[str, float] = {}
    detail: dict[str, list] = {}
    counts: dict[int, int] = defaultdict(int)
    for iso, r in sorted(rows.items()):
        # 每一種軌距都有長度才算比例、用長度最多的一類；維基百科只寫軌距（或只有部分長度）的，主要軌距是資訊框的第一個
        if all(km is not None for _, km in r["gauges"]):
            by_class: dict[int, float] = defaultdict(float)
            for mm, km in r["gauges"]:
                by_class[gauge_class(mm)] += km
            total = sum(by_class.values())
            code = max(by_class, key=lambda c: by_class[c])
            share[iso] = round(by_class.get(1, 0.0) / total * 100, 1)
        else:
            code = gauge_class(r["gauges"][0][0])
        main[iso] = code
        counts[code] += 1
        gauges = [[mm, None if km is None else round(km)] for mm, km in r["gauges"]]
        if all(km is not None for _, km in gauges):
            gauges.sort(key=lambda g: -g[1])
        detail[iso] = [r["src"], r["year"], gauges, [[a, b, round(km)] for a, b, km in r["dual"]], r.get("title")]
    write_json(OUT / "gauge.json", indicator_file("gauge", "", [YEAR], {c: [v] for c, v in main.items()}))
    write_json(OUT / "standard-share.json", indicator_file("standard-share", "%", [YEAR], {c: [v] for c, v in share.items()}))
    write_json(OUT / "gauge-detail.json", {"countries": detail})
    names = {code: name for code, name, _ in CLASSES}
    print(f"  {len(main)} 國（{len(share)} 國有標準軌的比例）：" + "、".join(f"{names[c]} {n}" for c, n in sorted(counts.items())))
    years = [r[1] for r in detail.values() if r[1]]
    print(f"  資料年份 {min(years)}–{max(years)}")
    for iso in ("TWN", "JPN", "CHN", "ESP", "FIN", "IND", "AUS", "IRL", "ARG", "CHE", "RUS", "GBR", "ARM", "SSD", "BRA", "USA"):
        if iso in detail:
            print(f"    {iso}：{names[main[iso]]}，標準軌 {share.get(iso)}%，{detail[iso][0]} {detail[iso][1]}，{detail[iso][2]}")


if __name__ == "__main__":
    build()

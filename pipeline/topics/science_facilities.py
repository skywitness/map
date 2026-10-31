"""大型科學設施（2026-10-31，製作手冊第十批 168）：核融合研究裝置、同步輻射光源、粒子加速器與對撞機，依年份出現。

- 資料（都是英文維基百科的固定版本，CC BY-SA 4.0，輸出的檔照 CC BY-SA 4.0）：
  - 「List of fusion experiments」（revid 1379837384）：托卡馬克、仿星器、雷射驅動三個表（199 列）；其他類型（磁鏡、
    Z 箍縮等）是條列、沒有年份與地點，不收。
  - 「List of synchrotron radiation facilities」（revid 1352120251）：同步輻射光源與自由電子雷射（93 列）。
  - 「List of accelerators in particle physics」（revid 1369387346）：使用者決定另外加的粒子對撞機與加速器（早期的迴旋
    加速器與同步加速器、固定靶加速器、正負電子／強子／電子–質子對撞機，98 列）；「Light sources」一節只連到上一個條目，
    「Hypothetical accelerators」是構想，不收。
- 位置：表裡的連結（裝置本身的條目，沒有座標再用機構、地點的條目）在 Wikidata 的座標（CC0，WDQS，存在 .cache/wikidata/）；
  連結是重新導向的，先讀英文維基的 action=raw 找到目標（.cache/wikipedia/redirects-science-facilities.json）。表裡沒有
  連結、或連結的條目沒有座標的，用 LOCATION_TITLES 手工對到機構或城市的條目。沒有地點的構想（DEMO、JA-DEMO、K-DEMO、
  EFPP、HiPER、非洲光源）不收。
- 狀態與年份：
  - 核融合：Status 欄（Operational、Shut down、Recycled〔改裝成別的裝置〕、Under construction、Planned、Cancelled）與
    Operation 欄的年份。取消的不收。
  - 同步輻射：Commissioned 是啟用年份，Decommissioned 是除役年份，空白當作還在運作（表裡約 60 列）。
  - 加速器：Years of operation 欄（「–present」是還在運作，「(planned)」是規劃中）。
  - 已關閉、停止年份不明的（例如「1962–?」）從啟用年份起就算已關閉（tooltip 寫明）；只有一個年份的（早期的雷射、迴旋加速器）
    當作那一年運作、之後關閉；沒有啟用年份、還在運作的只在最新一年出現。

輸出（public/data/topics/science-facilities/）：facilities.json（運作中與已關閉）、planned.json（興建中與規劃中）、
list.json（全部，左邊的清單）、各國運作中的設施數（operating.json、fusion.json、light.json、accelerators.json）。
"""
from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

from common import CACHE_DIR, OUT_DIR, USER_AGENT, download, indicator_file, now_iso, points_file, write_json
from sources.countries import from_name
from sources.wikidata_profiles import _rows, _sparql

OUT = OUT_DIR / "topics" / "science-facilities"
LAST = 2026
FIRST = 1928
ARTICLES = {
    "fusion": ("List_of_fusion_experiments", 1379837384),
    "light": ("List_of_synchrotron_radiation_facilities", 1352120251),
    "accel": ("List_of_accelerators_in_particle_physics", 1369387346),
}
REDIRECTS = CACHE_DIR / "wikipedia" / "redirects-science-facilities.json"

# 類別（前端 src/topics/science-facilities.ts 的 TYPES）：群組 g 與細類 t
GROUP = {"fusion": 1, "light": 2, "accel": 3}
SUBTYPE = {
    "Tokamak": 1, "Stellarator": 2, "Laser-driven": 3,  # 核融合
    "light": 4,  # 同步輻射光源與自由電子雷射
    "Cyclotrons": 5, "Other early accelerator types": 5, "Synchrotrons": 5,  # 早期的加速器
    "LHCb gas-target collisions": 6, "High intensity hadron accelerators (Meson and neutron sources)": 6,
    "Electron and low intensity hadron accelerators": 6,  # 固定靶
    "Electron–positron colliders": 7, "Hadron colliders": 7, "Electron–proton colliders": 7,  # 對撞機
}
# 狀態
OPERATING, CLOSED, CLOSED_UNKNOWN, PLANNED = 1, 2, 3, 4

# 表裡沒有連結、或連結的條目沒有座標：地點的文字（開頭比對）→ 英文維基條目
LOCATION_TITLES = {
    "University of California, Berkeley": "University of California, Berkeley",
    "Berkeley Rad Lab": "Lawrence Berkeley National Laboratory",
    "CERN": "CERN",
    "SLAC": "SLAC National Accelerator Laboratory",
    "Fermilab": "Fermi National Accelerator Laboratory",
    "Tokyo": "Tokyo",
    ":es:Instituto Nacional de Investigaciones Nucleares": "Mexico City",
    "Plasma Physics Laboratory (Saskatchewan)": "Saskatoon",
    "National Fusion Research Institute": "Daejeon",
    "National Nuclear Center of the Republic of Kazakhstan": "Kurchatov, Kazakhstan",
    "Energy Singularity": "Shanghai",
    "Southwest Jiaotong University": "Southwest Jiaotong University",
    "Joint Laboratory of High Power Laser and Physics": "Shanghai",
    "Knowledge Hub Aichi": "Seto, Aichi",
    "Ritsumeikan University": "Kusatsu, Shiga",
    "Sendai": "Sendai",
    "Oregon State University": "Oregon State University",
    "Forschungszentrum Jülich": "Forschungszentrum Jülich",
    "Jülich": "Forschungszentrum Jülich",
    "Middleton, MA": "Middleton, Massachusetts",
    "Physikalisches Institut der Universität Bonn": "University of Bonn",
    "Cornell University": "Cornell University",
    "Stanford, California": "Stanford, California",
    "LAL, Orsay": "Orsay",
    "Heliotron": "Kyoto University",  # 京都大學的 Heliotron-E、DR（表的地點欄空白）
}
# 只有名稱能判斷地點的（地點欄空白）
NAME_LOCATION = {"Heliotron-E": "Heliotron", "Heliotron-DR": "Heliotron"}
# 核融合表的國旗代碼 → ISO（Wikidata 查不到國家時用）
FLAGS = {"SOV": "RUS", "USA": "USA", "JP": "JPN", "UK": "GBR", "DEU": "DEU", "FRA": "FRA", "ITA": "ITA", "CHN": "CHN",
         "KOR": "KOR", "IND": "IND", "BRA": "BRA", "ESP": "ESP", "SUI": "CHE", "CHE": "CHE", "SWE": "SWE", "CAN": "CAN",
         "AUS": "AUS", "UKR": "UKR", "CZE": "CZE", "POR": "PRT", "PRT": "PRT", "KAZ": "KAZ", "MEX": "MEX", "BEL": "BEL",
         "NLD": "NLD", "POL": "POL", "IRN": "IRN", "EGY": "EGY", "ARG": "ARG", "CRI": "CRI", "PAK": "PAK", "RUS": "RUS"}
# 有通用中文名稱的設施（其他照原文）
ZH = {
    "ITER": "國際熱核融合實驗反應爐（ITER）", "JET (Joint European Torus)": "歐洲聯合環（JET）",
    "EAST (Experimental Advanced Superconducting Tokamak)": "全超導托卡馬克（EAST，東方超環）",
    "KSTAR (Korea Superconducting Tokamak Advanced Research)": "韓國超導托卡馬克（KSTAR）",
    "Wendelstein 7-X": "文德爾施泰因 7-X 仿星器", "National Ignition Facility (NIF)": "美國國家點火設施（NIF）",
    "Large Helical Device (LHD)": "大型螺旋裝置（LHD）", "Taiwan Light Source": "台灣光源（TLS）",
    "Taiwan Photon Source": "台灣光子源（TPS）", "Large Hadron Collider": "大型強子對撞機（LHC）",
    "Tevatron": "兆電子伏特加速器（Tevatron）", "Large Electron–Positron Collider": "大型正負電子對撞機（LEP）",
    "T-1 (Tokamak-1)": "T-1（第一台托卡馬克）", "Model A": "Model A（第一台仿星器）",
}


def _raw(group: str) -> str:
    title, rev = ARTICLES[group]
    name = f"{title.lower().replace('_', '-')}-{rev}.txt"
    url = f"https://en.wikipedia.org/w/index.php?title={title}&action=raw&oldid={rev}"
    return download(url, "wikipedia", name).read_text(encoding="utf-8")


def _strip_refs(t: str) -> str:
    t = re.sub(r"<ref[^>]*/>", "", t)
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    return re.sub(r"<!--.*?-->", "", t, flags=re.S)


def _tables(raw: str) -> list[tuple[list[str], list[str], list[list[str]]]]:
    """維基表格：[(所在的章節, 表頭, 各列的格子原文)]"""
    out = []
    sec: list[str] = []
    for m in re.finditer(r"(^(=+)\s*(.*?)\s*\2\s*$)|(^\{\|.*?^\|\})", raw, flags=re.M | re.S):
        if m.group(1):
            sec = sec[:len(m.group(2)) - 2] + [m.group(3)]
            continue
        header: list[str] = []
        rows = []
        for part in re.split(r"\n\|-[^\n]*", _strip_refs(m.group(4)))[1:]:
            part = part.rstrip("\n").removesuffix("|}").strip()
            if not part:
                continue
            if part.startswith("!"):
                header = [c.strip() for c in re.split(r"\n!|!!", "\n" + part[1:]) if c.strip()]
                continue
            cells = re.split(r"\n\||\|\|", "\n" + part.lstrip("|"))
            rows.append(cells[1:] if cells and cells[0] == "" else cells)
        out.append((list(sec), header, rows))
    return out


def _links(c: str) -> list[str]:
    return [m.group(1).strip() for m in re.finditer(r"\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]", c)]


def _text(c: str) -> str:
    c = re.sub(r'^\s*(?:[a-z-]+\s*=\s*"?[^"|]*"?\s*)+\|(?!\|)', "", c)
    if re.fullmatch(r'\s*(?:[a-z-]+\s*=\s*"[^"]*"\s*)+', c):
        return ""
    c = re.sub(r"\{\{flagicon\|[^}]*\}\}", "", c)
    c = re.sub(r"\{\{(?:no|yes|good|partial|CRecurring|n/a|active|planned|BLACK)\|([^}]*)\}\}", r"\1", c, flags=re.I)
    c = re.sub(r"\{\{val\|([^|}]*)(?:\|u=([^|}]*))?[^}]*\}\}", lambda m: m.group(1) + (" " + m.group(2) if m.group(2) else ""), c)
    c = re.sub(r"\{\{su\|b=([^|}]*)\|p=([^|}]*)\}\}", r"\1\2", c)
    c = re.sub(r"\{\{Anchor\|[^}]*\}\}", "", c, flags=re.I)
    c = re.sub(r"\[\[File:[^\]]*\]\]", "", c)
    c = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", c)
    c = re.sub(r"\[https?://\S+ ([^\]]*)\]", r"\1", c)
    c = re.sub(r"<br\s*/?>", " ", c)
    c = re.sub(r"<[^>]+>", "", c)
    c = re.sub(r"\{\{[^{}]*\}\}", "", c)
    c = c.replace("&nbsp;", " ").replace("'''", "").replace("''", "")
    return " ".join(c.split()).strip(" |")


def _records() -> list[dict]:
    recs: list[dict] = []

    def add(group: str, sub: str, name_c: str, loc_cs: list[str], **kw) -> None:
        recs.append({"group": group, "sub": sub, "name": _text(name_c), "links": _links(name_c) + [l for c in loc_cs for l in _links(c)],
                     "loc": ", ".join(t for t in (_text(c) for c in loc_cs) if t), **kw})

    for sec, header, rows in _tables(_raw("fusion")):
        h = [_text(x).split("|")[-1].strip() for x in header]
        for r in rows:
            if len(r) < 6:
                continue
            d = dict(zip(h, r))
            flag = re.search(r"\{\{flagicon\|([^}|]+)", d.get("Location", ""))
            add("fusion", sec[-1], d["Device name"], [d.get("Organisation", ""), d.get("Location", "")],
                years=_text(d.get("Operation", "")), status=_text(d.get("Status", "")), construction=_text(d.get("Construction", "")),
                flag=flag.group(1) if flag else None, org=_text(d.get("Organisation", "")))
    for _sec, _header, rows in _tables(_raw("light")):
        for r in rows:
            if len(r) < 6:
                continue
            r = r + [""] * 8
            add("light", "light", r[0], [r[1]], years=_text(r[5]), decom=_text(r[6]), country=_text(r[2]).strip("()"),
                gev=_text(r[3]), org=_text(r[1]))
    for sec, header, rows in _tables(_raw("accel")):
        h = [_text(x) for x in header]
        for r in rows:
            if len(r) < 3:
                continue
            d = dict(zip(h, r))
            add("accel", sec[-1], d["Accelerator"], [d["Location"]], years=_text(d.get("Years of operation", "")),
                org=_text(d["Location"]))
    return recs


def _norm(t: str) -> str:
    t = t.replace("_", " ").strip()
    return t[:1].upper() + t[1:]


def _redirects(titles: list[str]) -> dict[str, str | None]:
    """沒有對到 Wikidata 的標題：讀英文維基的 action=raw 看是不是重新導向（快取）"""
    cache = json.loads(REDIRECTS.read_text(encoding="utf-8")) if REDIRECTS.exists() else {}
    changed = False
    for t in titles:
        if t in cache or t.startswith(":"):
            continue
        url = "https://en.wikipedia.org/w/index.php?" + urllib.parse.urlencode({"title": t, "action": "raw", "redirect": "no"})
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=30) as r:
                body = r.read(3000).decode("utf-8", "replace")
            m = re.match(r"\s*#REDIRECT\s*\[\[([^\]|#]+)", body, re.I)
            cache[t] = m.group(1).strip() if m else None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                raise RuntimeError("英文維基回 429（太多請求），等幾分鐘再跑") from e
            cache[t] = f"HTTP {e.code}"
        changed = True
        time.sleep(3)
    if changed:
        REDIRECTS.parent.mkdir(parents=True, exist_ok=True)
        REDIRECTS.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding="utf-8")
    return {k: (v if v and not v.startswith("HTTP") else None) for k, v in cache.items()}


def _wikidata(titles: list[str], prefix: str) -> dict[str, dict]:
    """標題 → 座標與國家；快取檔名含標題清單的雜湊，清單變了才重查"""
    vals = " ".join(json.dumps(t, ensure_ascii=False) + "@en" for t in sorted(set(titles)))
    filename = f"{prefix}-{hashlib.sha1(vals.encode()).hexdigest()[:10]}.json"
    query = f"""SELECT ?title ?s ?c ?hq ?adm ?loc ?iso WHERE {{
  VALUES ?title {{ {vals} }}
  ?a schema:name ?title ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?s .
  OPTIONAL {{ ?s wdt:P625 ?c }}
  OPTIONAL {{ ?s wdt:P159/wdt:P625 ?hq }}
  OPTIONAL {{ ?s wdt:P131/wdt:P625 ?adm }}
  OPTIONAL {{ ?s wdt:P276/wdt:P625 ?loc }}
  OPTIONAL {{ ?s wdt:P17/wdt:P298 ?iso }}
}}"""
    info: dict[str, dict] = {}
    for r in _rows(_sparql(query, filename)):
        d = info.setdefault(r["title"]["value"], {"iso": set()})
        for k in ("c", "loc", "hq", "adm"):
            if k in r and k not in d:
                lon, lat = r[k]["value"].removeprefix("Point(").removesuffix(")").split()
                d[k] = (float(lon), float(lat))
        if "iso" in r:
            d["iso"].add(r["iso"]["value"])
    return info


def _years(text: str) -> tuple[int | None, int | None, bool, bool]:
    """(開始, 結束, 還在運作的寫法, 結束年份不明)"""
    ys = [int(y) for y in re.findall(r"(?<!\d)(1[89]\d\d|20\d\d)(?!\d)", text)]
    start = ys[0] if ys else None
    if re.search(r"present", text, re.I):
        return start, None, True, False
    ranged = re.search(r"(1[89]\d\d|20\d\d)\s*[–-]", text)
    if ranged and len(ys) >= 2:
        return start, ys[1], False, False
    if ranged:  # 「1962–」「1962–?」
        return start, None, "?" not in text and "unknown" not in text, "?" in text or "unknown" in text
    return start, start, False, "?" in text


def _state(r: dict) -> tuple[int, int | None, int | None] | None:
    """(狀態, 開始, 結束)；不收的回傳 None"""
    if r["group"] == "fusion":
        status = r["status"].lower()
        start, end, open_, unknown = _years(r["years"])
        if start is None:
            start = _years(r["construction"])[1] if r["construction"] else None
        if "cancel" in status:
            return None
        if "planned" in status or "construction" in status:
            return PLANNED, _years(r["years"])[0], None
        if "operational" in status:
            return OPERATING, start, None
        if "shut down" in status or "recycled" in status:
            if end is None or unknown or end == start and "?" in r["years"]:
                return CLOSED_UNKNOWN, start, None
            return CLOSED, start, end
        return None
    if r["group"] == "light":
        if re.search(r"design|proposed|conceptual", r["years"] + r["decom"], re.I):
            return PLANNED, None, None
        start = _years(r["years"])[0]
        end = _years(r["decom"])[0]
        return (CLOSED, start, end) if end else (OPERATING, start, None)
    if "planned" in r["years"].lower():
        return PLANNED, _years(r["years"])[0], None
    start, end, open_, unknown = _years(r["years"])
    if open_ or (end is None and not unknown):
        return OPERATING, start, None
    if unknown:
        return CLOSED_UNKNOWN, start, None
    return CLOSED, start, end


def build() -> None:
    recs = _records()
    counts = defaultdict(int)
    for r in recs:
        counts[r["group"]] += 1
    print(f"  英文維基：核融合 {counts['fusion']} 列、同步輻射 {counts['light']} 列、加速器與對撞機 {counts['accel']} 列")

    titles = sorted({_norm(t) for r in recs for t in r["links"]} | {_norm(t) for t in LOCATION_TITLES.values()})
    info = _wikidata(titles, "science-facilities-titles")
    redirect = _redirects([t for t in titles if t not in info])
    targets = sorted({_norm(v) for v in redirect.values() if v} - set(info))
    if targets:
        info.update(_wikidata(targets, "science-facilities-redirects"))

    def resolve(t: str) -> str | None:
        t = _norm(t)
        if t in info:
            return t
        v = redirect.get(t)
        return _norm(v) if v and _norm(v) in info else None

    def locate(r: dict) -> tuple[tuple[float, float], str | None, list[str]] | None:
        cands = [c for c in (resolve(t) for t in r["links"]) if c]
        key = NAME_LOCATION.get(r["name"]) or next((k for k in LOCATION_TITLES if r["loc"].startswith(k)), None)
        manual = resolve(LOCATION_TITLES[key]) if key else None
        order = cands + ([manual] if manual else [])
        for c in order:
            for k in ("c", "loc", "hq"):
                if k in info[c]:
                    return info[c][k], c, sorted({i for x in order for i in info[x]["iso"]})
        for c in order:
            if "adm" in info[c]:
                return info[c]["adm"], c, sorted({i for x in order for i in info[x]["iso"]})
        return None

    rows, skipped, unlocated, no_country = [], [], [], []
    for r in recs:
        st = _state(r)
        if st is None:
            skipped.append(r["name"])
            continue
        state, start, end = st
        where = locate(r)
        if not where:
            unlocated.append(r["name"])
            continue
        (lon, lat), _src, isos = where
        iso3 = None
        if r["group"] == "light" and r.get("country"):
            iso3 = {"US": "USA", "UK": "GBR", "Korea": "KOR", "South Korea": "KOR", "Taiwan": "TWN", "Russia": "RUS"}.get(
                r["country"]) or from_name(r["country"])
        if not iso3 and r.get("flag") and r["flag"] in FLAGS and r["flag"] != "SOV":
            iso3 = FLAGS[r["flag"]]
        if not iso3 and len(isos) == 1:
            iso3 = isos[0]
        if not iso3 and isos:
            iso3 = "CHE" if "CHE" in isos else isos[0]  # CERN 跨瑞士、法國，座標在瑞士
        if not iso3 and r.get("flag") in FLAGS:
            iso3 = FLAGS[r["flag"]]
        if not iso3:
            no_country.append(f"{r['name']}（{r['loc']}）")
            continue
        energy = r.get("gev") or ""
        rows.append({
            "lon": round(lon, 4), "lat": round(lat, 4), "g": GROUP[r["group"]], "t": SUBTYPE[r["sub"]], "st": state,
            "s": start, "e": end, "en": r["name"], "zh": ZH.get(r["name"]), "org": r["org"][:120] or None, "iso3": iso3,
            "gev": energy or None, "yr": LAST,
        })
    if no_country:
        raise RuntimeError("大型科學設施：對不到國家的（在 LOCATION_TITLES 補地點）：" + "；".join(no_country))
    print(f"  收 {len(rows)} 個（不收：取消 {len(skipped)} 個；沒有地點的構想 {len(unlocated)} 個：{'、'.join(unlocated)}）")
    by_state = defaultdict(int)
    for x in rows:
        by_state[x["st"]] += 1
    print(f"  運作中 {by_state[OPERATING]}、已關閉 {by_state[CLOSED]}、已關閉但年份不明 {by_state[CLOSED_UNKNOWN]}、"
          f"興建中或規劃中 {by_state[PLANNED]}")

    fields = ["lon", "lat", "g", "t", "st", "s", "e", "yr", "en", "zh", "org", "iso3", "gev"]
    scale = {"lon": 0.0001, "lat": 0.0001, "g": 1, "t": 1, "st": 1, "s": 1, "e": 1, "yr": 1}
    strings = ("org", "iso3", "gev")
    title_rev = "; ".join(f"“{t.replace('_', ' ')}” (revision {rev})" for t, rev in ARTICLES.values())
    attribution = {"license": "CC BY-SA 4.0",
                   "attribution": f"Wikipedia contributors, {title_rev}, https://en.wikipedia.org/; coordinates from Wikidata (CC0)"}
    built = [x for x in rows if x["st"] != PLANNED]
    write_json(OUT / "facilities.json", {**points_file(built, fields, scale, strings=strings), **attribution})
    write_json(OUT / "planned.json", {**points_file([x for x in rows if x["st"] == PLANNED], fields, scale, strings=strings),
                                      **attribution})
    write_json(OUT / "list.json", {**points_file(rows, fields, scale, strings=strings), **attribution})

    # 各國每年運作中的設施數（年份不明的不算）
    years = list(range(FIRST, LAST + 1))
    series: dict[str, dict[str, list[int]]] = {k: defaultdict(lambda: [0] * len(years)) for k in ("operating", "fusion", "light", "accelerators")}
    group_key = {1: "fusion", 2: "light", 3: "accelerators"}
    for x in built:
        if x["st"] == CLOSED_UNKNOWN:
            continue
        start = x["s"] if x["s"] is not None else LAST
        for i, y in enumerate(years):
            if start <= y and (x["e"] is None or y <= x["e"]):
                series["operating"][x["iso3"]][i] += 1
                series[group_key[x["g"]]][x["iso3"]][i] += 1
    for name, data in series.items():
        world = [sum(v[i] for v in data.values()) for i in range(len(years))]
        write_json(OUT / f"{name}.json", indicator_file(name, "個", years, {c: v for c, v in sorted(data.items())},
                                                       aggregates={"WLD": world}), quiet=True)
    i = years.index(LAST)
    top = sorted(series["operating"].items(), key=lambda kv: -kv[1][i])[:8]
    print(f"  {LAST} 年運作中 {sum(v[i] for v in series['operating'].values())} 個；" + "、".join(f"{c} {v[i]}" for c, v in top))
    print(f"  台灣：{[(x['en'], x['s'], x['st']) for x in rows if x['iso3'] == 'TWN']}")
    write_json(OUT / "manifest.json", {"topic": "science-facilities", "generatedAt": now_iso()})

"""武裝衝突主題：UCDP（Uppsala Conflict Data Program）26.1 版，CC BY 4.0。

死亡人數（UCDP GED，1989–2025，依事件發生的地點）：
- battle-deaths.json：以國家為一方的武裝衝突（state-based）的戰鬥死亡
- non-state-deaths.json：非國家衝突（non-state）的死亡；one-sided-deaths.json：單方面暴力（one-sided）的死亡
- organized-violence-deaths.json：三類合計；death-rate.json：三類合計每十萬人（人口用 UN WPP 2024）
- events-state.json、events-nonstate.json、events-onesided.json：地圖上的事件點（同一年、同一國、約 10 公里內合計
  25 人以上的事件併成一點，依時間軸只顯示那一年）

衝突（UCDP/PRIO ACD，1946–2025）：
- active-conflicts.json：所在地在這個國家的以國家為一方的武裝衝突數
- conflict-intensity.json：其中最高的強度（0 沒有、1 小型、2 戰爭）
- conflicts.json：側欄的衝突清單（每國每個衝突的名稱、雙方、類型、爭議、每年的強度）

**只算 UCDP 認定為活躍的事件**（GED 的 active_year）：同一個衝突（行為者）在那一年達到 25 人死亡的門檻。
GED 也收錄同一衝突在其他年份不到門檻的事件，全部加起來比 UCDP 公布的年度數字多約 0.4%；
只算活躍的事件時，世界合計跟 UCDP 的年度資料集（Battle-Related Deaths、Non-State、One-sided）與 UCDP 公布的數字一致
（2025 年 244,579 人：以國家為一方 153,643、非國家 14,483、單方面暴力 76,453）。
UCDP 自己的「Country-Year Dataset on Organized Violence within Country Borders」包含不到門檻的事件，
而且把加薩走廊與約旦河西岸算在以色列，所以沒有用它，改從 GED 自己加總（見 split_country）。

**國家歸屬**：GED 每起事件記的是當時的國家（Gleditsch–Ward 國家清單）。原則上照 GED 的國家（換成今天的 ISO 代碼），
只有事件落在「當時屬於那個國家、今天在地圖上分開畫」的地區時改算在今天的國家（SPLITS），例如 1991 年以前
記在蘇聯、發生在亞塞拜然的事件，記在以色列、發生在加薩走廊的事件。其他國界附近經緯度跟 GED 的國家不一致的事件
（1:50m 國界的誤差、跨境攻擊）照 GED 的國家：克里米亞的事件 GED 記在烏克蘭，地圖的國界把克里米亞畫在俄羅斯的形狀裡，
這裡照 GED 算烏克蘭。

**衝突的所在地**：ACD 的 location 依 UCDP 的定義是「被挑戰的國家」（國家間衝突是雙方政府的國家），不是戰鬥發生的地方。
這裡照 UCDP 的所在國計算，另外把爭議領土在今天的地圖上另成一國的衝突也算在那裡（TERRITORY，例如「Israel: Palestine」
也算在巴勒斯坦、1971 年「Pakistan: East Pakistan」也算在孟加拉），每國的附註會列出來。
"""
from __future__ import annotations

import gzip
import json
import math
from collections import defaultdict
from datetime import date

import numpy as np

from build_geo import load_countries
from common import OUT_DIR, indicator_file, now_iso, points_file, write_json
from sources import ucdp, wpp

OUT = OUT_DIR / "topics" / "conflict"
COUNTRIES_FILE = OUT_DIR / "countries.json"

TYPE_FILES = {ucdp.STATE_BASED: "battle-deaths", ucdp.NON_STATE: "non-state-deaths", ucdp.ONE_SIDED: "one-sided-deaths"}
EVENT_FILES = {ucdp.STATE_BASED: "events-state", ucdp.NON_STATE: "events-nonstate", ucdp.ONE_SIDED: "events-onesided"}
CELL_DEG = 0.1  # 事件點的合併範圍（約 11 公里）
MIN_POINT_DEATHS = 25  # 合併後不到 25 人的不畫（跟 UCDP 一年 25 人的門檻同一個數字），國家的合計仍然算

# GED 的國家 → [(今天地圖上分開畫的地區, 這一天以前的事件才改算；None 是一律改算)]
# 日期是 UCDP 開始把那個地區當成獨立國家的日子（之後 GED 會直接記成那一國，記在原本國家的是國界附近的事件，照 GED）。
# 大多是 Gleditsch–Ward 國家清單的日期；克羅埃西亞、斯洛維尼亞 GED 記在南斯拉夫到 1992-04-21（克羅埃西亞的事件
# 1992-04-29 起才記成 344），所以跟波士尼亞一樣用 1992-04-27（南斯拉夫聯盟共和國成立）。
SOVIET_END = date(1991, 12, 21)
YUGOSLAVIA_END = date(1992, 4, 27)
SPLITS: dict[str, list[tuple[str, date | None]]] = {
    "ISR": [("PSE", None)],  # 巴勒斯坦不在 GW 清單裡，加薩走廊與約旦河西岸的事件都記在以色列
    "MAR": [("ESH", None)],  # 西撒哈拉
    "SOM": [("_SOL", None)],  # 索馬利蘭（地圖上自己的形狀）
    "CYP": [("_CYN", None)],  # 北賽普勒斯
    "SRB": [("HRV", YUGOSLAVIA_END), ("SVN", YUGOSLAVIA_END), ("BIH", YUGOSLAVIA_END),
            ("MKD", date(1993, 4, 8)), ("MNE", date(2006, 6, 3)), ("XKX", date(2008, 2, 17))],
    "RUS": [(c, SOVIET_END) for c in ("UKR", "BLR", "MDA", "EST", "LVA", "LTU", "GEO", "ARM", "AZE",
                                       "KAZ", "UZB", "TKM", "KGZ", "TJK")],
    "ETH": [("ERI", date(1993, 5, 24))],
    "SDN": [("SSD", date(2011, 7, 9))],
    "IDN": [("TLS", date(2002, 5, 20))],
    "ZAF": [("NAM", date(1990, 3, 21))],
}
# GED 的一級行政區就寫明是巴勒斯坦的（點落在 1:50m 加薩海岸線外也照算）
PALESTINE_ADM1 = {"Gaza Strip", "West Bank"}

# ACD：爭議領土今天在地圖上另成一國的衝突（conflict_id → (UCDP 的 territory_name, 也算在這些國家)）。
# territory_name 用來核對，新版改了寫法會報錯。
TERRITORY: dict[int, tuple[str, tuple[str, ...]]] = {
    210: ("Estonia", ("EST",)),
    211: ("Latvia", ("LVA",)),
    212: ("Lithuania", ("LTU",)),
    213: ("Ukraine", ("UKR",)),
    217: ("Taiwan", ("TWN",)),
    228: ("Palestine", ("PSE",)),
    234: ("Palestine", ("PSE",)),
    238: ("Puerto Rico", ("PRI",)),
    275: ("Eritrea", ("ERI",)),
    282: ("Southern Sudan", ("SSD",)),
    298: ("Namibia", ("NAM",)),
    301: ("West Bank", ("PSE",)),
    312: ("East Pakistan", ("BGD",)),
    323: ("Northern Cyprus", ("_CYN",)),
    330: ("East Timor", ("TLS",)),
    331: ("Sahrawi Arab Democratic Republic (Western Sahara)", ("ESH",)),
    346: ("Malvinas/Falkland Islands", ("FLK",)),
    376: ("Nagorno-Karabakh", ("AZE",)),
    377: ("Azerbaijan", ("AZE",)),
    384: ("Slovenia", ("SVN",)),
    385: ("Croatia", ("HRV",)),
    412: ("Kosovo", ("XKX",)),
    426: ("Southern Lebanon", ("LBN",)),
    428: ("Sahrawi Arab Democratic Republic (Western Sahara)", ("ESH",)),
    14074: ("Somaliland", ("_SOL",)),
}

TYPE_NAMES = {1: ("殖民地外的衝突", "extrasystemic"), 2: ("國家間", "interstate"), 3: ("國內", "intrastate"),
              4: ("有外國介入的國內衝突", "internationalized intrastate")}


# ── 國家歸屬 ──────────────────────────────────────────────────────
def _inside(ring: np.ndarray, px: np.ndarray, py: np.ndarray) -> np.ndarray:
    """射線法，所有點一起算（ring 頭尾相同）"""
    xi, yi, xj, yj = ring[:-1, 0], ring[:-1, 1], ring[1:, 0], ring[1:, 1]
    out = np.zeros(len(px), dtype=bool)
    step = max(1, 2_000_000 // max(len(xi), 1))
    with np.errstate(divide="ignore", invalid="ignore"):
        for k in range(0, len(px), step):
            x, y = px[k : k + step, None], py[k : k + step, None]
            cross = ((yi > y) != (yj > y)) & (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
            out[k : k + step] = cross.sum(axis=1) % 2 == 1
    return out


def in_shape(geom: dict, px: np.ndarray, py: np.ndarray) -> np.ndarray:
    """點是否在地圖的這個國家形狀裡（MultiPolygon，含洞）"""
    hit = np.zeros(len(px), dtype=bool)
    for polygon in geom["coordinates"]:
        outer = np.asarray(polygon[0], dtype=float)
        sel = np.flatnonzero((px >= outer[:, 0].min()) & (px <= outer[:, 0].max())
                             & (py >= outer[:, 1].min()) & (py <= outer[:, 1].max()) & ~hit)
        if not len(sel):
            continue
        ins = _inside(outer, px[sel], py[sel])
        for hole in polygon[1:]:
            ins &= ~_inside(np.asarray(hole, dtype=float), px[sel], py[sel])
        hit[sel[ins]] = True
    return hit


def split_country(events: list[ucdp.Event], shapes: dict[str, dict]) -> tuple[list[str], dict[tuple[str, str], list[int]]]:
    """每起事件算在哪一國（ISO alpha-3）。回傳 (國家, {(GED 的國家, 改算的國家): [事件的年份…]})。"""
    iso3 = [ucdp.gw_iso3(e.gw) for e in events]
    moved: dict[tuple[str, str], list[int]] = defaultdict(list)
    px = np.asarray([e.lon for e in events])
    py = np.asarray([e.lat for e in events])
    for parent, children in SPLITS.items():
        idx = np.asarray([i for i, c in enumerate(iso3) if c == parent])
        if not len(idx):
            continue
        for child, until in children:
            hit = in_shape(shapes[child], px[idx], py[idx])
            for i in idx[hit]:
                e = events[i]
                if iso3[i] == parent and (until is None or e.start < until):
                    iso3[i] = child
                    moved[(parent, child)].append(e.year)
    for i, e in enumerate(events):
        if iso3[i] == "ISR" and e.adm_1 in PALESTINE_ADM1:
            iso3[i] = "PSE"
            moved[("ISR", "PSE")].append(e.year)
    return iso3, moved


# ── 事件點 ────────────────────────────────────────────────────────
def event_points(events: list[ucdp.Event], iso3: list[str], kind: int) -> list[dict]:
    """同一年、同一國、同一個 0.1° 網格的事件併成一點：位置是依死亡人數加權的平均，地名與衝突名稱取死亡最多的那起。"""
    groups: dict[tuple, dict] = {}
    for e, c in zip(events, iso3):
        if e.type != kind:
            continue
        key = (e.year, c, math.floor(e.lat / CELL_DEG), math.floor(e.lon / CELL_DEG))
        g = groups.get(key)
        if g is None:
            g = groups[key] = {"deaths": 0, "n": 0, "wx": 0.0, "wy": 0.0, "w": 0.0, "top": -1, "place": None, "name": None}
        g["deaths"] += e.deaths
        g["n"] += 1
        w = e.deaths + 0.5  # 0 人的事件也有一點權重
        g["wx"] += e.lon * w
        g["wy"] += e.lat * w
        g["w"] += w
        if e.deaths > g["top"]:
            g["top"], g["place"], g["name"] = e.deaths, e.place or e.adm_1 or None, e.conflict_name or None
    rows = []
    for (year, c, _cy, _cx), g in groups.items():
        if g["deaths"] < MIN_POINT_DEATHS:
            continue
        rows.append({
            "lon": round(g["wx"] / g["w"], 2), "lat": round(g["wy"] / g["w"], 2), "year": year,
            "deaths": g["deaths"], "n": g["n"], "iso3": c, "place": g["place"], "name": g["name"],
        })
    # 依年份排（年份差分），同一年大的排後面（畫在上面）
    rows.sort(key=lambda r: (r["year"], r["deaths"]))
    return rows


def _size(data: object) -> str:
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return f"{len(raw) / 1024:.0f} KB，gzip 後 {len(gzip.compress(raw, 9)) / 1024:.0f} KB"


# ── 衝突名稱 ──────────────────────────────────────────────────────
def conflict_name(rows: list[ucdp.ConflictYear], ged_names: dict[int, str]) -> str:
    """GED 有這個衝突就用 GED 的名稱（UCDP 自己的寫法，例如「Russia - Ukraine」「Algeria: Government」）；
    1989 年以前的衝突照同一個規則組出來：國家間衝突是所在國用「 - 」連起來，其他是「國家: 爭議」。"""
    cid = rows[0].conflict_id
    if cid in ged_names:
        return ged_names[cid]
    last = rows[-1]
    if last.type == 2:
        return " - ".join(p.strip() for p in last.location.split(","))
    what = {1: last.territory, 2: "Government", 3: f"Government/{last.territory}"}[last.incompatibility]
    return f"{last.location}: {what}"


# ── 附註 ──────────────────────────────────────────────────────────
def _years(years: list[int]) -> str:
    """[1949, 1950, 1954, 1958] →「1949–1950、1954、1958」"""
    ys = sorted(set(years))
    spans: list[list[int]] = []
    for y in ys:
        if spans and y == spans[-1][1] + 1:
            spans[-1][1] = y
        else:
            spans.append([y, y])
    return "、".join(f"{a}–{b}" if a != b else f"{a}" for a, b in spans)


def _years_en(years: list[int]) -> str:
    return _years(years).replace("、", ", ")


NAMES_ZH = {
    "ISR": "以色列", "PSE": "巴勒斯坦", "MAR": "摩洛哥", "ESH": "西撒哈拉", "SOM": "索馬利亞", "_SOL": "索馬利蘭",
    "CYP": "賽普勒斯", "_CYN": "北賽普勒斯", "SRB": "塞爾維亞（南斯拉夫）", "HRV": "克羅埃西亞", "SVN": "斯洛維尼亞",
    "BIH": "波士尼亞與赫塞哥維納", "MKD": "北馬其頓", "MNE": "蒙特內哥羅", "XKX": "科索沃", "RUS": "俄羅斯（蘇聯）",
    "UKR": "烏克蘭", "BLR": "白俄羅斯", "MDA": "摩爾多瓦", "EST": "愛沙尼亞", "LVA": "拉脫維亞", "LTU": "立陶宛",
    "GEO": "喬治亞", "ARM": "亞美尼亞", "AZE": "亞塞拜然", "KAZ": "哈薩克", "UZB": "烏茲別克", "TKM": "土庫曼",
    "KGZ": "吉爾吉斯", "TJK": "塔吉克", "ETH": "衣索比亞", "ERI": "厄利垂亞", "SDN": "蘇丹", "SSD": "南蘇丹",
    "IDN": "印尼", "TLS": "東帝汶", "ZAF": "南非", "NAM": "納米比亞",
}
NAMES_EN = {
    "ISR": "Israel", "PSE": "Palestine", "MAR": "Morocco", "ESH": "Western Sahara", "SOM": "Somalia",
    "_SOL": "Somaliland", "CYP": "Cyprus", "_CYN": "Northern Cyprus", "SRB": "Serbia (Yugoslavia)", "HRV": "Croatia",
    "SVN": "Slovenia", "BIH": "Bosnia and Herzegovina", "MKD": "North Macedonia", "MNE": "Montenegro", "XKX": "Kosovo",
    "RUS": "Russia (Soviet Union)", "UKR": "Ukraine", "BLR": "Belarus", "MDA": "Moldova", "EST": "Estonia",
    "LVA": "Latvia", "LTU": "Lithuania", "GEO": "Georgia", "ARM": "Armenia", "AZE": "Azerbaijan", "KAZ": "Kazakhstan",
    "UZB": "Uzbekistan", "TKM": "Turkmenistan", "KGZ": "Kyrgyzstan", "TJK": "Tajikistan", "ETH": "Ethiopia",
    "ERI": "Eritrea", "SDN": "Sudan", "SSD": "South Sudan", "IDN": "Indonesia", "TLS": "Timor-Leste",
    "ZAF": "South Africa", "NAM": "Namibia",
}


def ged_notes(moved: dict[tuple[str, str], list[int]], crimea: list[int], taiwan_events: int) -> tuple[dict, dict]:
    """死亡人數指標的附註：哪些事件從 GED 記的國家改算到今天的國家"""
    zh: dict[str, list[str]] = defaultdict(list)
    en: dict[str, list[str]] = defaultdict(list)
    children: dict[str, list[tuple[str, list[int]]]] = defaultdict(list)
    for (parent, child), years in sorted(moved.items()):
        n, span, span_en = len(years), _years(years), _years_en(years)
        if parent == "ISR":
            zh[child].append(f"UCDP GED 把加薩走廊與約旦河西岸的事件記在以色列（巴勒斯坦不在 UCDP 使用的 Gleditsch–Ward "
                             f"國家清單裡），這裡依 UCDP 標記的行政區與經緯度改算在巴勒斯坦（{span} 年共 {n:,} 起事件）。")
            en[child].append(f"UCDP GED codes events in the Gaza Strip and the West Bank under Israel (Palestine is not on "
                             f"the Gleditsch–Ward list of states UCDP uses); they are counted here under Palestine, based on "
                             f"UCDP's administrative units and coordinates ({n:,} events in {span_en}).")
            zh[parent].append("不含加薩走廊與約旦河西岸：UCDP 記在以色列的這些事件，這裡算在巴勒斯坦。")
            en[parent].append("Excludes the Gaza Strip and the West Bank: UCDP codes these events under Israel, "
                              "but they are counted here under Palestine.")
            continue
        p_zh, c_zh, p_en, c_en = NAMES_ZH[parent], NAMES_ZH[child], NAMES_EN[parent], NAMES_EN[child]
        zh[child].append(f"UCDP 記在{p_zh}、發生在今天{c_zh}的事件（{span} 年共 {n:,} 起），依經緯度算在{c_zh}。")
        en[child].append(f"Events UCDP codes under {p_en} that took place in what is now {c_en} ({n:,} events in "
                         f"{span_en}) are counted here under {c_en}, based on their coordinates.")
        children[parent].append((child, years))
    for parent, items in children.items():
        zh[parent].append("UCDP 記在這裡、發生在今天" + "、".join(f"{NAMES_ZH[c]}（{_years(ys)} 年）" for c, ys in items)
                          + "的事件，依經緯度算在那些國家。")
        en[parent].append("Events UCDP codes here that took place in what is now "
                          + ", ".join(f"{NAMES_EN[c]} ({_years_en(ys)})" for c, ys in items)
                          + " are counted under those countries, based on their coordinates.")
    if crimea:
        zh["UKR"].append(f"含克里米亞的事件（{_years(crimea)} 年共 {len(crimea):,} 起）：UCDP 記在烏克蘭，這裡照 UCDP。")
        en["UKR"].append(f"Includes events in Crimea ({len(crimea):,} in {_years_en(crimea)}), which UCDP codes under "
                         "Ukraine; they are counted here as UCDP codes them.")
    if taiwan_events:
        raise RuntimeError(f"GED 在台灣有 {taiwan_events} 起事件，要改寫台灣的附註")
    zh["TWN"].append("UCDP GED（1989–2025 年）在台灣沒有記錄任何以國家為一方的武裝衝突、非國家衝突或單方面暴力事件，所以每年都是 0。")
    en["TWN"].append("UCDP GED (1989–2025) records no events of state-based conflict, non-state conflict or one-sided "
                     "violence in Taiwan, so every year is 0.")
    return {k: "".join(v) for k, v in zh.items()}, {k: " ".join(v) for k, v in en.items()}


def acd_notes(added: dict[str, list[tuple[str, str, list[int]]]], taiwan: list[ucdp.ConflictYear]) -> tuple[dict, dict]:
    """衝突數、強度的附註：依爭議領土另外算進來的衝突，以及台灣、中國的說明"""
    zh: dict[str, list[str]] = defaultdict(list)
    en: dict[str, list[str]] = defaultdict(list)
    for iso3, items in sorted(added.items()):
        if iso3 == "TWN":
            continue
        parts_zh = [f"「{name}」（{_years(ys)} 年，UCDP 的所在國是 {loc}）" for name, loc, ys in items]
        parts_en = [f"“{name}” ({_years_en(ys)}; location in UCDP: {loc})" for name, loc, ys in items]
        zh[iso3].append("UCDP 的所在國是被挑戰的國家，不是戰鬥發生的地方；爭議領土在這裡的衝突也算進來："
                        + "、".join(parts_zh) + "。")
        en[iso3].append("UCDP's location is the state being challenged, not where the fighting took place; conflicts over "
                        "territory in this country are also counted here: " + "; ".join(parts_en) + ".")
    # 台灣：UCDP/PRIO ACD 裡跟台灣有關的衝突（建置時核對，資料變了就報錯）
    strait = sorted((r.year, r.intensity) for r in taiwan if r.conflict_id == 232)
    uprising = sorted((r.year, r.intensity) for r in taiwan if r.conflict_id == 217)
    located_in_taiwan = {r.conflict_id for r in taiwan if 713 in r.location_gw}
    start_217 = {r.start_date for r in taiwan if r.conflict_id == 217}
    if (strait != [(1949, 2), (1950, 1), (1954, 2), (1958, 2)] or uprising != [(1947, 2)]
            or located_in_taiwan != {232} or start_217 != {"1947-02-28"}
            or {r.incompatibility for r in taiwan if r.conflict_id == 232} != {3}):
        raise RuntimeError(f"UCDP 的台灣相關衝突變了：232 {strait}、217 {uprising} {start_217}、"
                           f"所在國含台灣的 {located_in_taiwan}，要改寫台灣的附註")
    zh["TWN"].append(
        "UCDP/PRIO 武裝衝突資料集裡，所在國含台灣的只有「China - Taiwan」（衝突編號 232，國家間衝突，雙方寫作 Government "
        "of China 與 Government of Taiwan，即中華人民共和國政府與在台灣的中華民國政府；爭議是政府與領土，領土寫 Taiwan strait）："
        "1949、1954、1958 年達到戰爭等級（一年 1,000 人以上戰鬥死亡），1950 年是小型衝突。"
        "另外 1947 年的「China: Taiwan」（衝突編號 217，UCDP 記錄的開始日期是 1947-02-28，即二二八事件；雙方是 "
        "Government of China，即當時的中華民國政府，與 Taiwanese insurgents，達到戰爭等級）UCDP 的所在國是中國，"
        "這裡依爭議領土（Taiwan）也算在台灣。"
        "1946–1949 年的國共內戰（Government of China 對 PLA）UCDP 記在中國。1958 年以後 UCDP 沒有記錄所在地在台灣的衝突。")
    en["TWN"].append(
        "In the UCDP/PRIO Armed Conflict Dataset, the only conflict located in Taiwan is “China - Taiwan” (conflict 232, "
        "interstate; the parties are written as Government of China and Government of Taiwan, i.e. the People's Republic "
        "of China and the Republic of China on Taiwan; incompatibility: government and territory, the territory given as "
        "Taiwan strait): war level (1,000 or more "
        "battle-related deaths in a year) in 1949, 1954 and 1958, and minor in 1950. The 1947 conflict “China: Taiwan” "
        "(conflict 217, starting 28 February 1947 in UCDP, i.e. the February 28 Incident; Government of China, i.e. the "
        "Republic of China government at the time, against Taiwanese insurgents; war level) is located in China in UCDP and is also counted here because the disputed territory is "
        "Taiwan. The Chinese Civil War of 1946–1949 (Government of China against the PLA) is located in China. UCDP "
        "records no conflict located in Taiwan after 1958.")
    zh["CHN"].append("1947 年的「China: Taiwan」（爭議領土 Taiwan）也算在台灣；1949–1958 年的「China - Taiwan」"
                     "是國家間衝突，兩邊都算。")
    en["CHN"].append("The 1947 conflict “China: Taiwan” (disputed territory: Taiwan) is also counted under Taiwan; "
                     "“China - Taiwan” (1949–1958) is interstate and counted under both.")
    return {k: "".join(v) for k, v in zh.items()}, {k: " ".join(v) for k, v in en.items()}


# ── 主程式 ────────────────────────────────────────────────────────
def build() -> None:
    with open(COUNTRIES_FILE, encoding="utf-8") as f:
        all_codes = sorted(json.load(f))  # 地圖上所有國家與地區：沒有事件的是 0，不是無資料
    shapes = load_countries()

    # ── GED：事件 → 國家 ──
    events_all = ucdp.ged_events()
    events = [e for e in events_all if e.active]
    first_year = min(e.year for e in events)
    last_year = max(e.year for e in events)
    years = list(range(first_year, last_year + 1))
    print(f"  UCDP GED {ucdp.VERSION}：{len(events_all):,} 起事件，活躍的（active_year）{len(events):,} 起，"
          f"{first_year}–{last_year}")
    iso3, moved = split_country(events, shapes)
    for (parent, child), ys in sorted(moved.items()):
        print(f"    {parent} → {child}：{len(ys):,} 起（{_years(ys)}）")
    unknown = sorted({c for c in iso3 if c not in all_codes})
    if unknown:
        raise RuntimeError(f"GED 的國家不在地圖的國家清單裡：{unknown}")

    # 克里米亞：GED 記在烏克蘭、地圖畫在俄羅斯形狀裡的事件（照 GED 算烏克蘭，只是附註）
    ukr = np.asarray([i for i, c in enumerate(iso3) if c == "UKR"])
    in_rus = in_shape(shapes["RUS"], np.asarray([events[i].lon for i in ukr]), np.asarray([events[i].lat for i in ukr]))
    crimea_box = [i for i in ukr[in_rus] if 32.4 <= events[i].lon <= 36.7 and 44.3 <= events[i].lat <= 46.3]
    crimea = [events[i].year for i in crimea_box]
    print(f"  克里米亞（GED 記在烏克蘭）：{len(crimea)} 起；其他記在烏克蘭、落在俄羅斯形狀裡的：{int(in_rus.sum()) - len(crimea)} 起")
    tw = in_shape(shapes["TWN"], np.asarray([e.lon for e in events_all]), np.asarray([e.lat for e in events_all]))
    taiwan_events = int(tw.sum()) + sum(1 for e in events_all if e.gw == 713)
    print(f"  台灣：GED 在台灣的事件 {taiwan_events} 起")

    deaths: dict[int, dict[str, dict[int, int]]] = {t: defaultdict(lambda: defaultdict(int)) for t in TYPE_FILES}
    world: dict[int, dict[int, int]] = {t: defaultdict(int) for t in TYPE_FILES}
    for e, c in zip(events, iso3):
        deaths[e.type][c][e.year] += e.deaths
        world[e.type][e.year] += e.deaths

    notes, notes_en = ged_notes(moved, crimea, taiwan_events)

    def series(by_year: dict[int, int]) -> list[float]:
        return [by_year.get(y, 0) for y in years]

    for t, name in TYPE_FILES.items():
        write_json(OUT / f"{name}.json", indicator_file(
            name, "人", years, {c: series(deaths[t].get(c, {})) for c in all_codes},
            aggregates={"WLD": series(world[t])}, notes=notes, notesEn=notes_en))
    total = {c: [sum(deaths[t].get(c, {}).get(y, 0) for t in TYPE_FILES) for y in years] for c in all_codes}
    world_total = [sum(world[t].get(y, 0) for t in TYPE_FILES) for y in years]
    write_json(OUT / "organized-violence-deaths.json", indicator_file(
        "organized-violence-deaths", "人", years, total, aggregates={"WLD": world_total}, notes=notes, notesEn=notes_en))
    for y in (1994, 2022, 2024, 2025):
        i = years.index(y)
        parts = "、".join(f"{TYPE_FILES[t]} {world[t][y]:,}" for t in TYPE_FILES)
        print(f"    世界 {y}：{world_total[i]:,} 人（{parts}）")

    # ── 每十萬人（WPP 2024 年中人口，千人；2024 年起是中推估） ──
    population = wpp.demographic(["TPopulation1July"], last_year=last_year)["TPopulation1July"]
    rate: dict[str, list[float | None]] = {}
    for c in all_codes:
        pop = population.get(c)
        if not pop:
            continue  # 地圖上有形狀、WPP 沒有人口的（索馬利蘭、北賽普勒斯、南極洲…）：無資料
        rate[c] = [round(total[c][i] / pop[y] * 100, 6) if pop.get(y) else None for i, y in enumerate(years)]
    world_rate = [round(world_total[i] / population["WLD"][y] * 100, 6) for i, y in enumerate(years)]
    rate_notes = {**notes, "_SOL": notes.get("_SOL", "") + "WPP 把索馬利蘭的人口算在索馬利亞，所以沒有每十萬人的死亡率。",
                  "_CYN": "WPP 把北賽普勒斯的人口算在賽普勒斯，所以沒有每十萬人的死亡率。"}
    rate_notes_en = {**notes_en,
                     "_SOL": (notes_en.get("_SOL", "") + " WPP counts Somaliland's population under Somalia, so there "
                              "is no rate per 100,000.").strip(),
                     "_CYN": "WPP counts Northern Cyprus's population under Cyprus, so there is no rate per 100,000."}
    write_json(OUT / "death-rate.json", indicator_file(
        "death-rate", "人／十萬人", years, rate, aggregates={"WLD": world_rate}, notes=rate_notes, notesEn=rate_notes_en))

    # ── 事件點 ──
    for t, name in EVENT_FILES.items():
        rows = event_points(events, iso3, t)
        data = points_file(rows, ["lon", "lat", "year", "deaths", "n", "iso3", "place", "name"],
                           {"lon": 0.01, "lat": 0.01, "year": 1, "deaths": 1, "n": 1}, delta=("year",))
        write_json(OUT / f"{name}.json", data)
        shown = sum(r["deaths"] for r in rows)
        all_deaths = sum(world[t].values())
        print(f"    {name}：{len(rows):,} 點，涵蓋 {shown / all_deaths:.1%} 的死亡（{_size(data)}）")

    # ── ACD：以國家為一方的武裝衝突 ──
    acd = ucdp.armed_conflicts()
    acd_years = list(range(min(r.year for r in acd), max(r.year for r in acd) + 1))
    by_conflict: dict[int, list[ucdp.ConflictYear]] = defaultdict(list)
    for r in sorted(acd, key=lambda r: (r.conflict_id, r.year)):
        by_conflict[r.conflict_id].append(r)
    ged_names = {e.conflict_id: e.conflict_name for e in events_all if e.type == ucdp.STATE_BASED}
    names = {cid: conflict_name(rows, ged_names) for cid, rows in by_conflict.items()}
    for cid, (territory, _codes) in TERRITORY.items():
        found = {r.territory for r in by_conflict.get(cid, [])}
        if found != {territory}:
            raise RuntimeError(f"ACD 衝突 {cid} 的爭議領土是 {found}，不是 {territory}，要檢查 TERRITORY")

    located: dict[str, dict[int, dict[int, int]]] = defaultdict(lambda: defaultdict(dict))  # 國家 → 年 → 衝突 → 強度
    added: dict[str, dict[int, list[int]]] = defaultdict(lambda: defaultdict(list))
    for r in acd:
        codes = {ucdp.gw_iso3(g) for g in r.location_gw}
        for c in TERRITORY.get(r.conflict_id, ("", ()))[1]:
            if c not in codes:
                added[c][r.conflict_id].append(r.year)
            codes.add(c)
        for c in codes:
            if c not in all_codes:
                raise RuntimeError(f"ACD 的國家 {c} 不在地圖的國家清單裡")
            located[c][r.year][r.conflict_id] = r.intensity
    count = {c: [len(located[c].get(y, {})) if c in located else 0 for y in acd_years] for c in all_codes}
    intensity = {c: [max(located[c].get(y, {}).values(), default=0) if c in located else 0 for y in acd_years]
                 for c in all_codes}
    added_list = {c: [(names[cid], by_conflict[cid][0].location, ys) for cid, ys in sorted(items.items())]
                  for c, items in added.items()}
    taiwan_rows = [r for r in acd if 713 in r.location_gw or r.conflict_id in (217,)]
    a_notes, a_notes_en = acd_notes(added_list, taiwan_rows)
    write_json(OUT / "active-conflicts.json", indicator_file(
        "active-conflicts", "個", acd_years, count, notes=a_notes, notesEn=a_notes_en))
    write_json(OUT / "conflict-intensity.json", indicator_file(
        "conflict-intensity", "", acd_years, intensity, notes=a_notes, notesEn=a_notes_en))
    for y in (1946, 1975, 1991, 2024, 2025):
        rows = [r for r in acd if r.year == y]
        by_type = defaultdict(int)
        for r in rows:
            by_type[TYPE_NAMES[r.type][1]] += 1
        print(f"    ACD {y}：{len(rows)} 個衝突、{sum(1 for r in rows if r.intensity == 2)} 個戰爭，{dict(by_type)}")

    # 側欄的衝突清單：每國每個衝突一列 [id, 名稱, 類型, 爭議, 甲方, 乙方, 爭議領土, [[年, 強度], …]]
    listing: dict[str, list[list]] = {}
    for c in sorted(located):
        ids = sorted({cid for y in located[c] for cid in located[c][y]})
        items = []
        for cid in ids:
            rows = by_conflict[cid]
            last = rows[-1]
            items.append([cid, names[cid], last.type, last.incompatibility, last.side_a, last.side_b, last.territory,
                          [[r.year, r.intensity] for r in rows]])
        items.sort(key=lambda it: (-it[7][-1][0], it[1]))  # 最近還活躍的排前面
        listing[c] = items
    write_json(OUT / "conflicts.json", {
        "fields": ["id", "name", "type", "incompatibility", "sideA", "sideB", "territory", "years"],
        "countries": listing,
    })
    # 印出 217 的開始日期（核對是不是 1947 年 2 月底的事件）
    print(f"  台灣檢查：衝突 217 開始於 {by_conflict[217][0].start_date}，232 開始於 {by_conflict[232][0].start_date}")

    write_json(OUT / "manifest.json", {
        "topic": "conflict",
        "generatedAt": now_iso(),
        "source": f"UCDP Georeferenced Event Dataset (GED) Global {ucdp.VERSION}; UCDP/PRIO Armed Conflict Dataset "
                  f"{ucdp.VERSION} ({ucdp.DOWNLOADS_PAGE}); UN World Population Prospects 2024 (population)",
        "license": ucdp.LICENSE,
        "citations": list(ucdp.CITATIONS.values()),
        "years": {"ged": [first_year, last_year], "acd": [acd_years[0], acd_years[-1]]},
        "events": {"all": len(events_all), "active": len(events)},
    })

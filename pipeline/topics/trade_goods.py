"""貿易的商品流向（貿易主題的擴充，2026-10-30，製作手冊第六批 98）：汽車、手機、藥品、黃金、鑽石、回收物、化肥等
16 種商品的出口、進口流向，格式跟全部商品、二手衣一樣（trade._write_item）。

使用者 2026-10-30 決定：
- 合併成「貿易」的一批商品流向（晶片、稀土、太陽能板、海鮮另外處理）。
- 以金額為主，回收物（廢紙、廢鐵）與化肥另加公噸（另一組指標 export-t、import-t）。
- 用網站已有的 BACI HS92 版（1995 年起）；HS92 分不開的新代碼另用較新的版本（年份較短）：
  純電車（870380）、手機（851712）、鋰電池（850760）用 HS17 版（2017 年起）；手機 2022 年起改用 HS22 版的
  851713＋851714（HS17 版換算回來的 2022 年起數字明顯偏高，見 build()）。

每個 BACI 版本只讀一次（HS92 約 2.4 GB、30 年，十幾分鐘），每一列依代碼的前 2、4、6 碼對到商品。
"""
from __future__ import annotations

import json
import re
import zipfile
from collections import defaultdict

from common import OUT_DIR, now_iso, write_json
from sources import baci
from topics.trade import _from_pairs, _write_item

OUT = OUT_DIR / "topics" / "trade"
PHONES_HS22 = ("851713", "851714")

# (id, 中文名, BACI 版本, HS 代碼（2、4、6 碼）, 要不要另算公噸)
GOODS: list[tuple[str, str, str, tuple[str, ...], bool]] = [
    ("cars", "乘用車（HS 8703）", "HS92", ("8703",), False),
    ("electric-cars", "純電動乘用車（HS 870380）", "HS17", ("870380",), False),
    ("aircraft", "飛機與直升機（HS 8802）", "HS92", ("8802",), False),
    ("computers", "電腦與伺服器（HS 8471）", "HS92", ("8471",), False),
    ("phones", "手機（HS17 851712；2022 年起 HS22 851713＋851714）", "HS17", ("851712",), False),
    ("lithium-batteries", "鋰離子電池（HS 850760）", "HS17", ("850760",), False),
    ("pharma", "藥品（HS 3004）", "HS92", ("3004",), False),
    ("toys", "玩具（HS 9501–9503）", "HS92", ("9501", "9502", "9503"), False),
    ("apparel", "成衣（第 61、62 章）", "HS92", ("61", "62"), False),
    ("footwear", "鞋（第 64 章）", "HS92", ("64",), False),
    ("gold", "黃金（非貨幣用，HS 7108）", "HS92", ("7108",), False),
    ("diamonds-rough", "鑽石原石（HS 710210、710231）", "HS92", ("710210", "710231"), False),
    ("diamonds-cut", "切磨好的鑽石（HS 710239）", "HS92", ("710239",), False),
    ("art", "藝術品與古董（第 97 章）", "HS92", ("97",), False),
    ("wine", "葡萄酒（HS 2204）", "HS92", ("2204",), False),
    ("whisky", "威士忌（HS 220830）", "HS92", ("220830",), False),
    ("human-hair", "人髮（HS 0501、6703）", "HS92", ("0501", "6703"), False),
    ("wigs", "假髮與假睫毛（HS 6704）", "HS92", ("6704",), False),
    ("logs", "原木（HS 4403）", "HS92", ("4403",), False),
    ("waste-paper", "廢紙（HS 4707）", "HS92", ("4707",), True),
    ("scrap-iron", "廢鋼鐵（HS 7204）", "HS92", ("7204",), True),
    ("fertilizers", "化肥合計（HS 3102–3105）", "HS92", ("3102", "3103", "3104", "3105"), True),
    ("fertilizers-n", "氮肥（HS 3102）", "HS92", ("3102",), True),
    ("fertilizers-p", "磷肥與複合肥（HS 3103、3105）", "HS92", ("3103", "3105"), True),
    ("fertilizers-k", "鉀肥（HS 3104）", "HS92", ("3104",), True),
]


def _read(hs: str, goods: list[tuple[str, tuple[str, ...], bool]]):
    """一次讀完一個 BACI 版本：{商品: {年: {(出口國, 進口國): [千美元, 公噸]}}}"""
    by_prefix: dict[bytes, list[str]] = defaultdict(list)
    for gid, codes, _ in goods:
        for c in codes:
            by_prefix[c.encode()].append(gid)
    out: dict[str, dict[int, dict]] = defaultdict(dict)
    with zipfile.ZipFile(baci._archive(hs)) as z:
        iso = baci._country_codes(z)
        members = sorted(n for n in z.namelist() if re.match(rf"BACI_{hs}_Y\d{{4}}_", n))
        for member in members:
            year = int(re.search(r"_Y(\d{4})_", member).group(1))
            cells: dict[tuple[str, bytes, bytes], list[float]] = defaultdict(lambda: [0.0, 0.0])
            with z.open(member) as raw:
                next(raw)
                for line in raw:
                    _, i, j, k, v, q = line.split(b",")
                    hits = by_prefix.get(k[:2]) or by_prefix.get(k[:4]) or by_prefix.get(k)
                    if not hits:
                        continue
                    # 同一列可能屬於好幾個商品（化肥合計與氮肥），前綴長度不同時也要都算到
                    gids = {*by_prefix.get(k[:2], ()), *by_prefix.get(k[:4], ()), *by_prefix.get(k, ())}
                    q = q.strip()
                    tonnes = float(q) if q and q != b"NA" else 0.0
                    for gid in gids:
                        cell = cells[(gid, i, j)]
                        cell[0] += float(v)
                        cell[1] += tonnes
            for (gid, i, j), (v, q) in cells.items():
                pairs = out[gid].setdefault(year, defaultdict(lambda: [0.0, 0.0]))
                cell = pairs[(iso.get(i), iso.get(j))]
                cell[0] += v
                cell[1] += q
            print(f"    {hs} {year}")
    return out


def build() -> None:
    items = []
    for hs in ("HS92", "HS17"):
        goods = [(g, codes, t) for g, _, version, codes, t in GOODS if version == hs]
        print(f"  讀取 BACI {hs}（{len(goods)} 種商品）…")
        data = _read(hs, goods)
        if hs == "HS17":
            # HS17 版 2022 年起的 851712 是 BACI 從 HS 2022 換算回來的，多了約 1,000 億美元（台灣從 4 億跳到 97 億），
            # 2022 年起改用 HS22 版的 851713（智慧型手機）＋851714（其他），兩個代碼合起來就是原本的 851712
            hs22 = _read("HS22", [("phones", PHONES_HS22, False)])["phones"]
            data["phones"] = {y: v for y, v in data["phones"].items() if y < 2022} | hs22
        for gid, codes, tonnes in goods:
            by_year = data[gid]
            _write_item(OUT, gid, {y: _from_pairs({p: c[0] for p, c in pairs.items()}) for y, pairs in by_year.items()})
            if tonnes:
                _write_item(OUT, gid, {y: _from_pairs({p: c[1] for p, c in pairs.items()}) for y, pairs in by_year.items()},
                            suffix="-t", unit="公噸")
            _summary(gid, by_year)
    for gid, label, hs, _, tonnes in GOODS:
        items.append({"id": gid, "label": label, "source": f"BACI {hs}", **({"tonnes": True} if tonnes else {})})

    # manifest.json 的 items：保留 trade 步驟寫的（全部商品、農產品、二手衣），換掉這裡的商品
    path = OUT / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"topic": "trade", "items": []}
    ids = {i["id"] for i in items}
    manifest["items"] = [i for i in manifest.get("items", []) if i["id"] not in ids] + items
    manifest["generatedAt"] = now_iso()
    write_json(path, manifest)


def _summary(gid: str, by_year: dict[int, dict]) -> None:
    last = max(by_year)
    exports: dict[str, float] = defaultdict(float)
    imports: dict[str, float] = defaultdict(float)
    for (e, i), (v, _) in by_year[last].items():
        if e:
            exports[e] += v
        if i:
            imports[i] += v
    world = sum(exports.values()) or 1
    top = lambda d: [(c, round(v / world * 100, 1)) for c, v in sorted(d.items(), key=lambda kv: -kv[1])[:5]]  # noqa: E731
    print(f"  {gid} {last} 年：全球 {world / 1e5:,.1f} 億美元；出口 {top(exports)}；進口 {top(imports)}；"
          f"台灣出口 {exports.get('TWN', 0) / 10:,.0f} 萬、進口 {imports.get('TWN', 0) / 10:,.0f} 萬美元")

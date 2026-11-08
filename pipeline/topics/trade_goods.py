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
    # 第二十二批 386（2026-11-05）：工業機器人，HS 2017 才有自己的代碼（HS92 併在 847989），2017 年起
    ("industrial-robots", "工業機器人（HS 847950）", "HS17", ("847950",), False),
    ("pharma", "藥品（HS 3004）", "HS92", ("3004",), False),
    # 第二十批 307（2026-11-04）：藥用、香料、殺蟲用的植物（含古柯葉、罌粟稈；不等於中藥材）
    ("medicinal-plants", "藥用植物（HS 1211）", "HS92", ("1211",), False),
    # 第二十九批 693（2026-11-08）：中藥材散在的其他章節，跟 1211 依 HS 章節註解互斥。植物萃取只取 130212（甘草）、130213（蛇麻）、
    # 130219（其他），不含鴉片汁 130211 與果膠、瓊脂這些食品添加物；角與鹿茸只取 050790（不含象牙 050710）；步驟 trade-tcm
    ("plant-extracts", "植物萃取物（HS 130212、130213、130219）", "HS92", ("130212", "130213", "130219"), False),
    ("animal-pharma", "製藥用動物原料（HS 0510）", "HS92", ("0510",), False),
    ("bird-nests", "燕窩與其他可食動物產品（HS 0410）", "HS92", ("0410",), False),
    ("horns-antlers", "角、鹿茸與其他未加工動物材料（HS 050790）", "HS92", ("050790",), False),
    # 第二十九批 703：乳香、沒藥、阿魏這類天然樹膠與樹脂（130190；不含阿拉伯膠 130120 與蟲膠 130110）
    ("resins", "天然樹膠與樹脂（HS 130190）", "HS92", ("130190",), False),
    ("toys", "玩具（HS 9501–9503）", "HS92", ("9501", "9502", "9503"), False),
    # 第二十四批 413（2026-11-06）：HS 第 95 章的鄰居，運動器材（不含運動服、運動鞋、自行車）與遊戲用品（實體的遊戲機、
    # 牌、桌遊，數位下載的遊戲不在貿易統計裡）；步驟 trade-leisure
    ("sports-goods", "運動器材（HS 9506）", "HS92", ("9506",), False),
    ("fitness-equipment", "健身與田徑器材（HS 950691）", "HS92", ("950691",), False),
    ("games", "遊戲機、撲克牌與桌遊（HS 9504）", "HS92", ("9504",), False),
    # 電視遊戲機：HS92 版的 950410 在 BACI 近年幾乎是 0（新版 HS 的 950450 換算回 HS92 時沒有歸到這裡），用 HS17 版（2017 年起）
    ("video-game-consoles", "電視遊戲機（HS 950450，2017 年起）", "HS17", ("950450",), False),
    ("playing-cards", "撲克牌與集換式卡牌（HS 950440）", "HS92", ("950440",), False),
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


def build_one(gid: str) -> None:
    """只做一種商品：讀一次它的 BACI 版本，寫流向檔，manifest 的 items 補上這一項（不必重讀其他商品）"""
    build_some([gid])


def build_some(gids: list[str]) -> None:
    """只做這幾種（只有金額的）商品：每個 BACI 版本讀一次，寫流向檔，manifest 的 items 換掉這幾項"""
    rows = [(g, l, h, c) for g, l, h, c, _ in GOODS if g in gids]
    for hs in sorted({h for _, _, h, _ in rows}):
        goods = [(g, c, False) for g, _, h, c in rows if h == hs]
        print(f"  讀取 BACI {hs}（{'、'.join(l for _, l, h, _ in rows if h == hs)}）…")
        data = _read(hs, goods)
        for gid, _, _ in goods:
            by_year = data[gid]
            _write_item(OUT, gid, {y: _from_pairs({p: c[0] for p, c in pairs.items()}) for y, pairs in by_year.items()})
            _summary(gid, by_year)
    added = [{"id": g, "label": l, "source": f"BACI {h}"} for g, l, h, _ in rows]
    path = OUT / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    # 照 GOODS 的順序換掉這幾項
    manifest["items"] = [i for i in manifest.get("items", []) if i["id"] not in gids] + added
    manifest["generatedAt"] = now_iso()
    write_json(path, manifest)


def build_medicinal_plants() -> None:
    """只做藥用植物（HS 1211，第二十批 307）：讀一次 BACI HS92，寫流向檔，manifest 的 items 補上這一項"""
    gid = "medicinal-plants"
    label, hs, codes = next((l, h, c) for g, l, h, c, _ in GOODS if g == gid)
    print(f"  讀取 BACI {hs}（HS 1211）…")
    by_year = _read(hs, [(gid, codes, False)])[gid]
    _write_item(OUT, gid, {y: _from_pairs({p: c[0] for p, c in pairs.items()}) for y, pairs in by_year.items()})
    _summary(gid, by_year)
    path = OUT / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["items"] = [i for i in manifest.get("items", []) if i["id"] != gid] + [{"id": gid, "label": label, "source": f"BACI {hs}"}]
    manifest["generatedAt"] = now_iso()
    write_json(path, manifest)


TCM_GOODS = ["plant-extracts", "animal-pharma", "bird-nests", "horns-antlers", "resins"]
# 「藥材類進口來自中國的比例」（第二十九批 703，候選 1595）：這幾種各自與合計；進口至少 50 萬美元（BACI 是千美元）才算
TCM_SHARE = ["medicinal-plants", *TCM_GOODS]
MIN_IMPORT = 500


def build_tcm() -> None:
    """第二十九批 693、703：讀一次 BACI HS92，寫五種商品的流向、各國藥材類進口來自中國的比例，並印出三層量級（說明用）"""
    rows = [(g, l, h, c) for g, l, h, c, _ in GOODS if g in TCM_SHARE]
    goods = [(g, c, False) for g, _, h, c in rows] + [("pharma-bulk", ("3003",), False), ("pharma", ("3004",), False)]
    print("  讀取 BACI HS92（藥材類與藥品）…")
    data = _read("HS92", goods)
    for gid in TCM_GOODS:
        by_year = data[gid]
        _write_item(OUT, gid, {y: _from_pairs({p: c[0] for p, c in pairs.items()}) for y, pairs in by_year.items()})
        _summary(gid, by_year)
    added = [{"id": g, "label": l, "source": f"BACI {h}"} for g, l, h, _ in rows if g in TCM_GOODS]
    path = OUT / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["items"] = [i for i in manifest.get("items", []) if i["id"] not in TCM_GOODS] + added
    manifest["generatedAt"] = now_iso()
    write_json(path, manifest)
    _china_share(data)
    last = max(data["pharma"])
    world = {g: sum(c[0] for c in data[g][last].values()) / 1e5 for g in ("medicinal-plants", "plant-extracts", "pharma-bulk", "pharma")}
    print(f"  三層量級 {last} 年（億美元）：" + "、".join(f"{g} {v:,.1f}" for g, v in world.items()))
    for g in ("pharma-bulk",):
        ex: dict[str, float] = defaultdict(float)
        for (e, _i), (v, _q) in data[g][last].items():
            if e:
                ex[e] += v
        print(f"    {g} 出口前五：" + "、".join(f"{c} {v / 1e5:,.2f} 億" for c, v in sorted(ex.items(), key=lambda kv: -kv[1])[:5]))


def _china_share(data: dict) -> None:
    from common import indicator_file
    series = {g: data[g] for g in TCM_SHARE}
    years = sorted(set().union(*(set(v) for v in series.values())))
    combined: dict[int, dict] = {}
    for y in years:
        pairs: dict = defaultdict(lambda: [0.0, 0.0])
        for g in TCM_SHARE:
            for p, c in series[g].get(y, {}).items():
                pairs[p][0] += c[0]
        combined[y] = pairs
    series = {"tcm-all": combined, **series}
    for gid, by_year in series.items():
        values: dict[str, list] = {}
        hints: dict[str, str] = {}
        hints_en: dict[str, str] = {}
        for k, y in enumerate(years):
            tot: dict[str, float] = defaultdict(float)
            chn: dict[str, float] = defaultdict(float)
            for (e, i), c in by_year.get(y, {}).items():
                if not i or i == "CHN":
                    continue
                tot[i] += c[0]
                if e == "CHN":
                    chn[i] += c[0]
            for i, t in tot.items():
                if t >= MIN_IMPORT:
                    values.setdefault(i, [None] * len(years))[k] = round(chn[i] / t * 100, 1)
                    if y == years[-1]:
                        hints[i] = f"{y} 年進口 {t / 100:,.0f} 萬美元，來自中國 {chn[i] / 100:,.0f} 萬"
                        hints_en[i] = f"Imports in {y}: US${t / 1000:,.1f} million, of which US${chn[i] / 1000:,.1f} million from China"
        write_json(OUT / "china-share" / f"{gid}.json", indicator_file(f"china-share-{gid}", "%", years, values, hints=hints, hintsEn=hints_en))
        lastv = {c: v[-1] for c, v in values.items() if v[-1] is not None}
        top = sorted(lastv.items(), key=lambda kv: -kv[1])
        print(f"  來自中國的比例 {gid} {years[-1]}：{len(lastv)} 國；" + "、".join(f"{c} {v}" for c, v in top[:12]) + " … "
              + "、".join(f"{c} {lastv[c]}" for c in ("TWN", "HKG", "KOR", "JPN", "USA", "DEU", "SGP", "MYS", "VNM") if c in lastv))

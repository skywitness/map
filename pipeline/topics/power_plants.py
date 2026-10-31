"""發電廠地圖主題：Global Energy Monitor 的 Global Integrated Power Tracker（GIPT，2026 年 9 月版，CC BY 4.0）。

地圖上的點（`points_file()`，一座電廠的同一種燃料一個點，機組的容量加總）：
- plants-operating.json：運轉中（預設打開）；plants-construction.json：興建中；plants-planned.json：規劃中
  （GEM 的 pre-construction 與 announced）；plants-retired.json：已退役與封存（mothballed）。後三個預設關閉，打開才下載。
- 四個圖層都只畫 MIN_MW（20 MW）以上的電廠：運轉中的 10.9 萬座裡有 7.4 萬座不到 20 MW（大多是 GEM 收錄的
  1 MW 以上地面型太陽能），只占運轉中容量的 3.5%，全畫的話檔案大三倍（約 7 MB）。20 MW 也是 GEM 規劃中
  太陽能與生質能的收錄門檻，運轉中跟規劃中的圖層才比得起來。國家統計含所有電廠。
- 經緯度量化到 0.001°（約 100 公尺），放大到街道層級時電廠的位置才不會偏掉一公里。
- 擱置（shelved）與取消（cancelled）的計畫不畫，也不算進統計。
- 檔案依容量由大到小排：前端不設 sortField，MapLibre 依資料順序畫，小電廠畫在大電廠上面，
  大電廠的圓才不會蓋住範圍裡的小電廠（比例符號地圖的慣例）。

國家統計（單一年份 2026，`indicator_file()`）：
- capacity.json：運轉中裝置容量（GW）；capacity/{燃料}.json：各燃料（含 renewables、fossil 合計）；
  share/{燃料}.json：占運轉中容量的比例（%，只算 GEM 收錄的總容量 SHARE_MIN_MW 以上的國家）；
  construction.json、planned.json：興建中、規劃中的容量（規劃中 = 籌備中 + 已宣布）。
- 「再生能源」合計不含純抽蓄水力（抽蓄是儲能，不是再生能源發電），水力本身含抽蓄。
- 跨國電廠（伊泰普、亞西雷塔、薩爾托格蘭德、鐵門一二號、卡里巴）GEM 的地圖檔只寫一個國家，
  統計依兩國的份額拆開（BINATIONAL）；地圖上的點仍算在 GEM 寫的國家。
- countries/{ISO}.json：側欄的各燃料容量（運轉中、興建中、規劃中）與最大的 10 座運轉中電廠（含主要業主）。

台灣：建置時印出 GEM 跟經濟部能源署「發電裝置容量」的對照，也寫進指標檔的附註（notes、notesEn）。

核電機組、儲能（抽蓄與電池）、各國最大的電廠在 power_plants_extra.py（2026-10-31，第十批 165）。
"""
from __future__ import annotations

import gzip
import json
from collections import defaultdict
from dataclasses import dataclass, field

from common import OUT_DIR, indicator_file, now_iso, points_file, write_json, write_layered_points
from sources import gem, moeaea_capacity
from sources.countries import from_name
from topics import power_plants_extra

OUT = OUT_DIR / "topics" / "power-plants"
YEAR = 2026  # GEM 2026 年 9 月版的狀態
MIN_MW = 20  # 地圖上的點只畫這個容量以上的電廠（國家統計含全部）
# 占比只算 GEM 收錄的總容量有這麼大的國家：小島國的柴油機組低於 GEM 的收錄門檻（燃油 50 MW），
# 只剩一兩座太陽能案場時會變成「100% 太陽能」（幾內亞比索 10 MW、吉里巴斯 4 MW）
SHARE_MIN_MW = 100

# GEM 的 asset-type → (代碼, id)；代碼與順序跟 src/topics/power-plants.ts 的 FUELS 一致
FUELS = {
    "coal": (1, "coal"),
    "oil/gas": (2, "oil-gas"),
    "nuclear": (3, "nuclear"),
    "hydropower": (4, "hydro"),
    "wind": (5, "wind"),
    "utility-scale solar": (6, "solar"),
    "bioenergy": (7, "bioenergy"),
    "geothermal": (8, "geothermal"),
}
FUEL_IDS = [fid for _, fid in FUELS.values()]
GROUPS = {"renewables": ["hydro", "wind", "solar", "bioenergy", "geothermal"], "fossil": ["coal", "oil-gas"]}
PUMPED = "pumped storage"  # GEM 的 tech-type；「conventional and pumped storage」是混合式，算再生能源

# plants-operating.json 收的電廠：這麼多 MW 以上（跟 src/topics/power-plants.ts 的 PLANT_MIN_MW 一致），其餘的在 -more.json
PLANT_IMPORTANT_MW = 200

# 狀態代碼（plants-planned、plants-retired 的 st 欄位；跟 src/topics/power-plants.ts 的 STATUS 一致）
STATUS = {"operating": 1, "construction": 2, "pre-construction": 3, "announced": 4, "retired": 5, "mothballed": 6}
# 地圖圖層：檔名 → (包含的狀態, 收錄門檻 MW)
LAYERS = {
    "operating": ({"operating"}, MIN_MW),
    "construction": ({"construction"}, MIN_MW),
    "planned": ({"pre-construction", "announced"}, MIN_MW),
    "retired": ({"retired", "mothballed"}, MIN_MW),
}
# 國家統計的狀態
STAT_GROUPS = {"operating": "operating", "construction": "construction", "pre-construction": "planned", "announced": "planned"}

# pycountry 查不到的 GEM 國名
COUNTRY_ALIASES = {
    "Bonaire, Sint Eustatius, and Saba": "BES",
    "Saint Helena, Ascension, and Tristan da Cunha": "SHN",
    "Virgin Islands (U.S.)": "VIR",
}

# 跨國電廠：GEM 的地圖檔只寫第一個國家，統計依份額拆開（project-id → 名稱的一部分（檢查用）、中英文名稱、份額）
BINATIONAL = {
    "L100000604073": ("Itaipu", "伊泰普水電廠", "Itaipu", {"BRA": 0.5, "PRY": 0.5}),
    "L100000604061": ("Yacyret", "亞西雷塔水電廠", "Yacyretá", {"ARG": 0.5, "PRY": 0.5}),
    "L100000604062": ("Salto Grande", "薩爾托格蘭德水電廠", "Salto Grande", {"ARG": 0.5, "URY": 0.5}),
    "L100000604099": ("Iron Gate I", "鐵門一號水電廠", "Iron Gate I", {"ROU": 0.5, "SRB": 0.5}),
    "L100000604100": ("Iron Gate II", "鐵門二號水電廠", "Iron Gate II", {"ROU": 0.5, "SRB": 0.5}),
    # 卡里巴水壩：北岸電廠在尚比亞（1,080 MW）、南岸在辛巴威（1,050 MW）
    "L100000604110": ("Kariba", "卡里巴水壩水電廠", "Kariba Dam", {"ZMB": 1080 / 2130, "ZWE": 1050 / 2130}),
}
COUNTRY_TEXT = {
    "BRA": ("巴西", "Brazil"), "PRY": ("巴拉圭", "Paraguay"), "ARG": ("阿根廷", "Argentina"), "URY": ("烏拉圭", "Uruguay"),
    "ROU": ("羅馬尼亞", "Romania"), "SRB": ("塞爾維亞", "Serbia"), "ZMB": ("尚比亞", "Zambia"), "ZWE": ("辛巴威", "Zimbabwe"),
}

FUEL_TEXT = {
    "coal": ("燃煤", "coal"), "oil-gas": ("燃氣與燃油", "gas and oil"), "nuclear": ("核能", "nuclear"),
    "hydro": ("水力（含抽蓄）", "hydro (incl. pumped storage)"), "wind": ("風力", "wind"), "solar": ("太陽能", "solar"),
    "bioenergy": ("生質能與廢棄物", "bioenergy and waste"), "geothermal": ("地熱", "geothermal"),
    "renewables": ("再生能源", "renewables"), "fossil": ("化石燃料", "fossil fuels"),
}


@dataclass
class Plant:
    """一座電廠（project-id）的同一種燃料、同一個圖層的機組"""
    units: list[gem.Unit] = field(default_factory=list)

    @property
    def mw(self) -> float:
        return sum(u.mw for u in self.units)

    @property
    def main(self) -> gem.Unit:
        return max(self.units, key=lambda u: u.mw)


def _size(data: object) -> str:
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return f"{len(raw) / 1024:.0f} KB，gzip {len(gzip.compress(raw, 9)) / 1024:.0f} KB"


def _gw(mw: float) -> float:
    return round(mw / 1000, 4)


def build() -> None:
    units = gem.units()
    iso_cache: dict[str, str | None] = {}

    def iso3(u: gem.Unit) -> str | None:
        if u.country not in iso_cache:
            iso_cache[u.country] = COUNTRY_ALIASES.get(u.country) or from_name(u.country)
        return iso_cache[u.country]

    units = [u for u in units if u.fuel in FUELS]
    missing = sorted({u.country for u in units if not iso3(u)})
    if missing:
        print(f"  查不到 ISO 代碼的國名：{missing}")
    print(f"  GEM GIPT（{gem.RELEASE}）：{len(units)} 個機組、{len({u.plant for u in units})} 座電廠")

    # 跨國電廠的份額：名稱對不上就不拆（GEM 改版換了編號）
    shares: dict[str, dict[str, float]] = {}
    names = {u.plant: u.name for u in units}
    for pid, (check, *_text, split) in BINATIONAL.items():
        if check.lower() in names.get(pid, "").lower():
            shares[pid] = split
        else:
            print(f"  跨國電廠 {pid}（{check}）對不到 GEM 的資料：{names.get(pid)}")

    def owners(u: gem.Unit) -> dict[str, float]:
        return shares.get(u.plant) or ({iso3(u): 1.0} if iso3(u) else {})

    # ── 國家統計 ──
    stats: dict[str, dict[str, dict[str, float]]] = {g: defaultdict(lambda: defaultdict(float)) for g in ("operating", "construction", "planned")}
    pumped: dict[str, float] = defaultdict(float)
    covered: set[str] = set()
    world: dict[str, dict[str, float]] = {g: defaultdict(float) for g in stats}
    for u in units:
        group = STAT_GROUPS.get(u.status)
        fid = FUELS[u.fuel][1]
        for code, share in owners(u).items():
            if u.status in STATUS:
                covered.add(code)
            if not group:
                continue
            stats[group][code][fid] += u.mw * share
            if group == "operating" and u.fuel == "hydropower" and u.tech == PUMPED:
                pumped[code] += u.mw * share
        if group:
            world[group][fid] += u.mw

    def fuel_total(by_fuel: dict[str, float], item: str, pumped_mw: float = 0.0) -> float:
        if item in GROUPS:
            total = sum(by_fuel.get(f, 0.0) for f in GROUPS[item])
            return total - pumped_mw if item == "renewables" else total
        return by_fuel.get(item, 0.0)

    operating = stats["operating"]
    op_total = {c: sum(v.values()) for c, v in operating.items() if sum(v.values()) > 0}
    world_op = sum(world["operating"].values())
    world_pumped = sum(pumped.values())
    notes, notes_en = taiwan_notes(units, iso3)
    bi_notes = binational_notes(shares)

    def with_notes(key: str) -> dict:
        """附註：台灣跟能源署的對照；跨國電廠所在的國家（只寫在跟水力有關的檔）"""
        zh: dict[str, str] = {}
        en: dict[str, str] = {}
        if key in ("total", "hydro", "renewables"):
            for code, text in bi_notes[0].items():
                zh[code], en[code] = text, bi_notes[1][code]
        if key in notes:
            zh["TWN"], en["TWN"] = notes[key], notes_en[key]
        return {"notes": zh, "notesEn": en} if zh else {}

    years = [YEAR]
    write_json(OUT / "capacity.json", indicator_file(
        "capacity", "GW", years, {c: [_gw(v)] for c, v in sorted(op_total.items())},
        aggregates={"WLD": [_gw(world_op)]}, **with_notes("total")))
    for item in FUEL_IDS + list(GROUPS):
        values, share_values = {}, {}
        for c in sorted(op_total):
            mw = fuel_total(operating[c], item, pumped.get(c, 0.0))
            values[c] = [_gw(mw)]
            if op_total[c] >= SHARE_MIN_MW:
                share_values[c] = [round(100 * mw / op_total[c], 2)]
        wmw = fuel_total(world["operating"], item, world_pumped)
        extra = with_notes(item)
        write_json(OUT / "capacity" / f"{item}.json", indicator_file(
            f"capacity-{item}", "GW", years, values, aggregates={"WLD": [_gw(wmw)]}, **extra), quiet=True)
        write_json(OUT / "share" / f"{item}.json", indicator_file(
            f"share-{item}", "%", years, share_values, aggregates={"WLD": [round(100 * wmw / world_op, 2)]}, **extra), quiet=True)
    print(f"  輸出 capacity/、share/ 各 {len(FUEL_IDS) + len(GROUPS)} 個檔（{len(op_total)} 國）")
    for group in ("construction", "planned"):
        values = {c: [_gw(sum(stats[group][c].values()))] for c in sorted(covered)}
        write_json(OUT / f"{group}.json", indicator_file(
            group, "GW", years, values, aggregates={"WLD": [_gw(sum(world[group].values()))]}))

    # ── 地圖上的點 ──
    layer_plants: dict[str, dict[tuple[str, int], Plant]] = {name: defaultdict(Plant) for name in LAYERS}
    for u in units:
        for name, (statuses, _min) in LAYERS.items():
            if u.status in statuses:
                layer_plants[name][(u.plant, FUELS[u.fuel][0])].units.append(u)
    for name, (statuses, min_mw) in LAYERS.items():
        plants = layer_plants[name]
        rows = []
        for (_pid, code), plant in plants.items():
            mw = plant.mw
            if mw < min_mw:
                continue
            main = plant.main
            starts = [u.start for u in plant.units if u.start]
            row = {
                "lon": main.lon, "lat": main.lat, "mw": round(mw, 1), "fuel": code,
                "start": min(starts) if starts else None,
                "last": max(starts) if starts and max(starts) != min(starts) else None,
                "name": main.name, "iso3": iso3(main),
            }
            if name == "retired":
                ends = [u.end for u in plant.units if u.end]
                row["ret"] = max(ends) if ends else None
            if len(statuses) > 1:
                by_status: dict[str, float] = defaultdict(float)
                for u in plant.units:
                    by_status[u.status] += u.mw
                row["st"] = STATUS[max(by_status, key=lambda s: by_status[s])]
            rows.append(row)
        rows.sort(key=lambda r: (-r["mw"], r["name"]))
        fields = ["lon", "lat", "mw", "fuel", "start", "last", "name", "iso3"]
        if name == "retired":
            fields.insert(6, "ret")
        if len(statuses) > 1:
            fields.insert(4, "st")
        scale = {"lon": 0.001, "lat": 0.001, "mw": 0.1, "fuel": 1, "start": 1, "last": 1, "ret": 1, "st": 1}
        if name == "operating":
            # 運轉中的 3 萬多座：PLANT_IMPORTANT_MW 以上的（約四分之一）在 plants-operating.json，地圖縮小時只畫它們
            # （src/topics/power-plants.ts 的 minValue），其餘的在 plants-operating-more.json，放大才下載（2026-10-31）。
            # rows 依容量由大到小排，兩份各自照樣排好
            data, _more = write_layered_points(OUT / f"plants-{name}.json", rows, lambda r: r["mw"] >= PLANT_IMPORTANT_MW,
                                               fields, scale, delta=("mw",))
        else:
            data = points_file(rows, fields, scale, delta=("mw",))
            write_json(OUT / f"plants-{name}.json", data, quiet=True)
        total = sum(p.mw for p in plants.values())
        kept = sum(r["mw"] for r in rows)
        print(f"  plants-{name}.json：{len(rows)} 座（共 {len(plants)} 座，{min_mw} MW 以上占容量 "
              f"{100 * kept / total:.1f}%），{_size(data)}")

    # ── 側欄：各國的燃料組成與最大的電廠 ──
    biggest: dict[str, list] = defaultdict(list)
    plant_count: dict[str, int] = defaultdict(int)
    for (pid, code), plant in layer_plants["operating"].items():
        main = plant.main
        split = shares.get(pid)
        for c, share in (split or ({iso3(main): 1.0} if iso3(main) else {})).items():
            plant_count[c] += 1
            biggest[c].append([
                main.name, code, round(plant.mw * share, 1), min((u.start for u in plant.units if u.start), default=None),
                gem.main_owner(main.owner), round(plant.mw, 1) if split else None,
            ])
    (OUT / "countries").mkdir(parents=True, exist_ok=True)
    for old in (OUT / "countries").glob("*.json"):
        old.unlink()
    written = 0
    for c in sorted(covered):
        mw = {}
        for fid in FUEL_IDS:
            row = [round(stats[g][c].get(fid, 0.0), 1) for g in ("operating", "construction", "planned")]
            if any(row):
                mw[fid] = row
        if not mw:
            continue
        top = sorted(biggest.get(c, []), key=lambda r: -r[2])[:10]
        out = {"status": ["operating", "construction", "planned"], "mw": mw, "plants": top, "count": plant_count.get(c, 0)}
        if pumped.get(c):
            out["pumped"] = round(pumped[c], 1)
        write_json(OUT / "countries" / f"{c}.json", out, quiet=True)
        written += 1
    print(f"  輸出 countries/ {written} 國")

    # ── 2026-10-31 擴充（第十批 165）：核電機組、儲能、各國最大的電廠 ──
    power_plants_extra.build_nuclear(units, iso3, OUT, YEAR)
    power_plants_extra.build_storage(units, iso3, OUT)
    power_plants_extra.build_largest(units, iso3, shares, FUELS, OUT, YEAR)

    # ── 檢查 ──
    print(f"  全球運轉中 {world_op / 1000:,.0f} GW；前 8 國：" + "、".join(
        f"{c} {v / 1000:,.0f}" for c, v in sorted(op_total.items(), key=lambda kv: -kv[1])[:8]))
    write_json(OUT / "manifest.json", {
        "topic": "power-plants",
        "generatedAt": now_iso(),
        "source": f"Global Energy Monitor, Global Integrated Power Tracker ({gem.RELEASE_TEXT} release); "
                  "Taiwan cross-check: Energy Administration, MOEA (installed capacity)",
    })


def binational_notes(shares: dict[str, dict[str, float]]) -> tuple[dict[str, str], dict[str, str]]:
    """跨國電廠所在國家的附註（中、英）"""
    zh: dict[str, list[str]] = defaultdict(list)
    en: dict[str, list[str]] = defaultdict(list)
    for pid, split in shares.items():
        _check, name_zh, name_en, _ = BINATIONAL[pid]
        for code, share in split.items():
            partners = [p for p in split if p != code]
            pz = "、".join(COUNTRY_TEXT[p][0] for p in partners)
            pe = " and ".join(COUNTRY_TEXT[p][1] for p in partners)
            pct = round(share * 100)
            zh[code].append(f"{name_zh}（與{pz}共有）算 {pct}%")
            en[code].append(f"{name_en} (shared with {pe}) counts {pct}%")
    return (
        {c: "跨國電廠依份額拆開：" + "；".join(v) + "。" for c, v in zh.items()},
        {c: "Cross-border plants are split by share: " + "; ".join(v) + "." for c, v in en.items()},
    )


def taiwan_notes(units: list[gem.Unit], iso3) -> tuple[dict[str, str], dict[str, str]]:
    """GEM 的台灣跟經濟部能源署「發電裝置容量」對照：key 是 total 或燃料 id，印出對照表，回傳附註（中、英）"""
    moea_all = moeaea_capacity.capacity()
    year = max(moea_all)
    moea = moea_all[year]
    gem_op: dict[str, float] = defaultdict(float)
    gem_moth: dict[str, float] = defaultdict(float)
    gem_ret: dict[str, float] = defaultdict(float)
    gem_pumped = 0.0
    for u in units:
        if iso3(u) != "TWN":
            continue
        fid = FUELS[u.fuel][1]
        if u.status == "operating":
            gem_op[fid] += u.mw
            if u.tech == PUMPED:
                gem_pumped += u.mw
        elif u.status == "mothballed":
            gem_moth[fid] += u.mw
        elif u.status == "retired":
            gem_ret[fid] += u.mw
    for k, fuels in GROUPS.items():
        for book in (gem_op, gem_moth):
            book[k] = sum(book[f] for f in fuels)
        for owner in moea.values():
            owner[k] = sum(owner[f] for f in fuels)
    # 再生能源不含純抽蓄水力（兩邊都扣掉）
    gem_op["renewables"] -= gem_pumped
    for owner in moea.values():
        owner["renewables"] -= owner["pumped"]
    gem_op["total"] = sum(gem_op[f] for f in FUEL_IDS)
    gem_moth["total"] = sum(gem_moth[f] for f in FUEL_IDS)

    print(f"  台灣對照（MW）：GEM {gem.RELEASE} 運轉中（封存） vs 能源署 {year} 年底 全國 = 台電 + 民營電廠 + 自用發電設備")
    for k in ["total", *FUEL_IDS]:
        m = moea
        print(f"    {k:10s} GEM {gem_op[k]:9,.0f}（{gem_moth[k]:6,.0f}）  能源署 {m['全國'][k]:9,.0f} = "
              f"{m['台電'][k]:,.0f} + {m['民營電廠'][k]:,.0f} + {m['自用發電設備'][k]:,.0f}")

    n = lambda v: f"{v:,.0f}"  # noqa: E731
    roc = year - 1911

    def moea_text(k: str) -> tuple[str, str]:
        m = moea
        return (
            f"能源署統計 {year} 年（民國 {roc} 年）底{FUEL_TEXT[k][0] if k != 'total' else '全國發電裝置容量'} "
            f"{n(m['全國'][k])} MW（台電 {n(m['台電'][k])}、民營電廠 {n(m['民營電廠'][k])}、自用發電設備 {n(m['自用發電設備'][k])}）",
            f"the Energy Administration reports {n(m['全國'][k])} MW of "
            f"{FUEL_TEXT[k][1] if k != 'total' else 'installed capacity'} at the end of {year} "
            f"(Taipower {n(m['台電'][k])}, independent producers {n(m['民營電廠'][k])}, self-generation {n(m['自用發電設備'][k])})",
        )

    # 各燃料差距的原因（數字都是建置時算的，原因依 GEM 的收錄門檻）
    why = {
        "total": (
            f"差距主要在太陽能：GEM 只收 1 MW 以上的地面型案場（{n(gem_op['solar'])} MW），能源署含屋頂型共 "
            f"{n(moea['全國']['solar'])} MW。另外 GEM 把 {n(gem_moth['total'])} MW 的機組列為封存（不算運轉中），"
            "小型的汽電共生、燃氣與水力機組也低於 GEM 的收錄門檻。",
            f"Most of the gap is solar: GEM only covers ground-mounted farms of 1 MW or more ({n(gem_op['solar'])} MW), "
            f"while the official figure of {n(moea['全國']['solar'])} MW includes rooftop systems. GEM also lists "
            f"{n(gem_moth['total'])} MW as mothballed (not operating), and small cogeneration, gas and hydro units fall below its thresholds.",
        ),
        "coal": (
            f"GEM 另有 {n(gem_moth['coal'])} MW 列為封存；其餘的差距是小型的燃煤汽電共生機組（GEM 只收 30 MW 以上）。",
            f"GEM lists another {n(gem_moth['coal'])} MW as mothballed; the rest of the gap is small coal cogeneration units "
            "(GEM covers units of 30 MW or more).",
        ),
        # 金門塔山、澎湖尖山等離島的柴油電廠 GEM 有收，差距不在離島
        "oil-gas": (
            "小型的燃氣、燃油汽電共生機組多半低於 GEM 的收錄門檻（50 MW）"
            + (f"；GEM 另有 {n(gem_moth['oil-gas'])} MW 列為封存。" if gem_moth["oil-gas"] else "。"),
            "Small gas- and oil-fired cogeneration units mostly fall below the GEM threshold of 50 MW"
            + (f"; GEM lists another {n(gem_moth['oil-gas'])} MW as mothballed." if gem_moth["oil-gas"] else "."),
        ),
        "nuclear": (
            f"核三廠 2 號機 2025 年 5 月停機後，台灣沒有運轉中的核電機組；GEM 列為退役的核電機組共 {n(gem_ret['nuclear'])} MW。",
            f"Taiwan has had no operating nuclear units since Maanshan unit 2 shut down in May 2025; GEM lists {n(gem_ret['nuclear'])} MW of retired nuclear units.",
        ),
        "hydro": (
            "兩者都含抽蓄水力（明潭、大觀二廠）；GEM 只收 30 MW 以上的水力電廠。",
            "Both include pumped storage (Mingtan, Taikuan II); GEM only covers hydro plants of 30 MW or more.",
        ),
        "wind": (
            "GEM 收 10 MW 以上的風場，資料是 2026 年 9 月的狀態，能源署是前一年底。",
            "GEM covers wind farms of 10 MW or more as of September 2026; the official figure is for the end of the previous year.",
        ),
        "solar": (
            "GEM 只收 1 MW 以上的地面型案場，不含屋頂型，所以少很多。",
            "GEM only covers ground-mounted farms of 1 MW or more, not rooftop systems, so its figure is much lower.",
        ),
        "bioenergy": (
            "能源署的數字是生質能加廢棄物（垃圾焚化廠）；GEM 只收 20 MW 以上的電廠。",
            "The official figure covers bioenergy plus waste (incinerators); GEM only covers plants of 20 MW or more.",
        ),
        "geothermal": ("", ""),
        "renewables": (
            "這裡的再生能源不含純抽蓄水力；差距主要在屋頂型太陽能（GEM 不收）。",
            "Renewables here exclude pure pumped storage; most of the gap is rooftop solar, which GEM does not cover.",
        ),
        "fossil": (
            "差距是 GEM 列為封存的機組與低於收錄門檻的小型機組。",
            "The gap is units GEM lists as mothballed plus small units below its thresholds.",
        ),
    }
    zh, en = {}, {}
    for k in ["total", *FUEL_IDS, *GROUPS]:
        mz, me = moea_text(k)
        label_zh = "" if k == "total" else FUEL_TEXT[k][0]
        label_en = "" if k == "total" else f" {FUEL_TEXT[k][1]}"
        gz = f"GEM（{gem.RELEASE_TEXT[-4:]} 年 9 月）台灣運轉中的{label_zh}電廠合計 {n(gem_op[k])} MW；{mz}。{why[k][0]}"
        ge = f"GEM ({gem.RELEASE_TEXT}) lists {n(gem_op[k])} MW of operating{label_en} capacity in Taiwan; {me}. {why[k][1]}"
        zh[k], en[k] = gz.strip(), ge.strip()
    return zh, en

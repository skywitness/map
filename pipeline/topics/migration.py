"""移民與難民主題：各國的國際移民、移居國外的人（僑民）與難民，點選國家畫出來源與去向的弧線。

- 移民：UN DESA International Migrant Stock 2024（1990–2024，每 5 年一筆，加上 2024 年），依目的地 × 來源國。
- 難民：UNHCR Refugee Population Statistics Database（1990 年起每年年底），難民加上其他需要國際保護的人。
- 人口（算比例、每千人）：UN WPP 2024，2024 年以後用推估值。
- 台灣：DESA 有台灣（依國籍統計外國人，含大陸地區人民），直接用；附註寫移民署的外僑居留人數與僑委會的海外台僑人數對照。
  UNHCR 沒有台灣（台灣沒有難民法，不是《難民公約》締約國）。

輸出：
- share.json（移民占人口比例）、immigrants.json（移民人數）、emigrants.json（僑民人數）
- refugees-hosted.json（收容的難民）、refugees-per-1000.json（每千人收容的難民）、refugees-origin.json（依來源國）
- flows/migrants/<年>.json、flows/refugees/<年>.json：每個國家前 15 大來源（import）與去向（export）
- foreign-workers.json（2026-10-29 擴充，製作手冊第五批 46，使用者決定；build_foreign_workers() 可以單獨跑）：
  勞動力裡外國出生者的比例，ILOSTAT 國際勞動移民統計的 EAP_TEAP_SEX_AGE_CBR_NB_A（依出生地，15 歲以上，CC BY 4.0）。
  台灣不在裡面：勞動部產業及社福移工人數（data.gov.tw 41881，只有最新一年）÷（主計總處人力資源調查的勞動力＋移工），
  假設人力資源調查的勞動力不含移工，附註寫明。
"""
from __future__ import annotations

import csv
import io
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, latest_year_span, now_iso, to_series, write_json, year_span
from sources import dgbas, ilostat, nia, ocac, undesa_ims, unhcr, wpp
from sources.countries import to_iso3

TOP_N = 15
REFUGEE_FROM = 1990
TAIWAN = "TWN"
ILO_FOREIGN_BORN = "EAP_TEAP_SEX_AGE_CBR_NB_A"
MOL_MIGRANT_WORKERS = "https://apiservice.mol.gov.tw/OdService/download/A17000000J-030123-Q5d"
FOREIGN_WITHIN = 5  # 隔幾年才有資料的國家多，地圖用 5 年內最近一年

Pairs = dict[tuple[str, str], float]  # (來源, 目的地) → 人數


def build() -> None:
    out = OUT_DIR / "topics" / "migration"
    refugee_last = unhcr.latest_year()
    population = wpp.demographic(["TPopulation1July"], last_year=refugee_last)["TPopulation1July"]  # 千人

    # ── 移民（UN DESA） ──
    years, matrix, data_type = undesa_ims.matrix()
    immigrants = {dest: _by_year(years, s) for (dest, origin), s in matrix.items() if dest and origin is None}
    emigrants = {origin: _by_year(years, s) for (dest, origin), s in matrix.items() if dest is None and origin}
    world = _by_year(years, matrix[(None, None)])
    share = {
        iso3: {y: n / (population[iso3][y] * 1000) * 100 for y, n in s.items() if population.get(iso3, {}).get(y)}
        for iso3, s in immigrants.items()
    }
    world_share = {y: n / (population["WLD"][y] * 1000) * 100 for y, n in world.items()}

    notes, notes_en = _migrant_notes(data_type, years[-1], matrix[(TAIWAN, "CHN")][-1] or 0)
    emigrant_notes, emigrant_notes_en = _emigrant_notes()
    write_json(out / "share.json", indicator_file(
        "share", "%", years, {c: to_series(s, years, 2) for c, s in share.items()},
        aggregates={"WLD": to_series(world_share, years, 2)}, notes=notes, notesEn=notes_en,
    ))
    write_json(out / "immigrants.json", indicator_file(
        "immigrants", "人", years, {c: to_series(s, years, 0) for c, s in immigrants.items()},
        aggregates={"WLD": to_series(world, years, 0)}, notes=notes, notesEn=notes_en,
    ))
    write_json(out / "emigrants.json", indicator_file(
        "emigrants", "人", years, {c: to_series(s, years, 0) for c, s in emigrants.items()},
        aggregates={"WLD": to_series(world, years, 0)}, notes=emigrant_notes, notesEn=emigrant_notes_en,
    ))
    for i, year in enumerate(years):
        pairs: Pairs = {
            (origin, dest): s[i]
            for (dest, origin), s in matrix.items()
            if dest and origin and s[i]
        }
        totals = {
            "export": {c: s.get(year) for c, s in emigrants.items()},
            "import": {c: s.get(year) for c, s in immigrants.items()},
        }
        _write_flows(out / "flows" / "migrants" / f"{year}.json", "migrants", year, pairs, totals)

    # ── 難民（UNHCR） ──
    by_year = unhcr.refugees(REFUGEE_FROM, refugee_last)
    hosted: dict[str, dict[int, float]] = defaultdict(dict)
    origin_totals: dict[str, dict[int, float]] = defaultdict(dict)
    world_refugees: dict[int, float] = {}
    for year, pairs_all in by_year.items():
        h: dict[str, float] = defaultdict(float)
        o: dict[str, float] = defaultdict(float)
        for (coo, coa), n in pairs_all.items():
            if coa:
                h[coa] += n
            if coo:
                o[coo] += n
        for c, n in h.items():
            hosted[c][year] = n
        for c, n in o.items():
            origin_totals[c][year] = n
        world_refugees[year] = sum(pairs_all.values())
        pairs = {(coo, coa): n for (coo, coa), n in pairs_all.items() if coo and coa}
        totals = {"export": dict(o), "import": dict(h)}
        _write_flows(out / "flows" / "refugees" / f"{year}.json", "refugees", year, pairs, totals)
    refugee_years = year_span(hosted)
    per_1000 = {
        c: {y: n / population[c][y] for y, n in s.items() if population.get(c, {}).get(y)}
        for c, s in hosted.items()
    }
    world_per_1000 = {y: n / population["WLD"][y] for y, n in world_refugees.items() if population["WLD"].get(y)}
    taiwan = {TAIWAN: "台灣不是《難民公約》締約國，也還沒有難民法，不在 UNHCR 的統計裡。"}
    taiwan_en = {TAIWAN: "Taiwan is not a party to the Refugee Convention and has no refugee law yet, so it is not in UNHCR's statistics."}
    for key, series, digits in [
        ("refugees-hosted", hosted, 0),
        ("refugees-origin", origin_totals, 0),
        ("refugees-per-1000", per_1000, 2),
    ]:
        world_series = world_per_1000 if key == "refugees-per-1000" else world_refugees
        write_json(out / f"{key}.json", indicator_file(
            key, "‰" if key == "refugees-per-1000" else "人", refugee_years,
            {c: to_series(s, refugee_years, digits) for c, s in series.items() if s},
            aggregates={"WLD": to_series(world_series, refugee_years, digits)},
            notes=taiwan, notesEn=taiwan_en,
        ))

    build_foreign_workers()
    write_json(out / "manifest.json", {
        "topic": "migration",
        "generatedAt": now_iso(),
        "source": "UN DESA International Migrant Stock 2024; UNHCR Refugee Population Statistics Database; UN WPP 2024",
        "migrantYears": years,
        "refugeeYears": [refugee_years[0], refugee_years[-1]],
    })
    print(f"  移民 {years[0]}–{years[-1]}（{len(immigrants)} 國），難民 {refugee_years[0]}–{refugee_years[-1]}")


def _by_year(years: list[int], series: list[float | None]) -> dict[int, float]:
    return {y: v for y, v in zip(years, series) if v is not None}


def _write_flows(path, item: str, year: int, pairs: Pairs, totals: dict[str, dict[str, float | None]]) -> None:
    """流向檔：export 是「從這國出去」（來源國 → 目的地），import 是「來到這國」；總額用指標檔的總數（含來源不明的）。"""
    by: dict[str, dict[str, dict[str, float]]] = {"export": defaultdict(dict), "import": defaultdict(dict)}
    for (origin, dest), n in pairs.items():
        if origin == dest:
            continue
        by["export"][origin][dest] = n
        by["import"][dest][origin] = n
    data: dict[str, object] = {"item": item, "year": year, "unit": "人", "scale": 1}
    for direction, countries in by.items():
        entries = {}
        for country, partners in sorted(countries.items()):
            total = totals[direction].get(country) or sum(partners.values())
            ranked = sorted(((p, v) for p, v in partners.items() if v >= 0.5), key=lambda kv: -kv[1])[:TOP_N]
            if ranked:
                entries[country] = [round(total), [[p, round(v)] for p, v in ranked]]
        data[direction] = entries
    write_json(path, data, quiet=True)


def _migrant_notes(data_type: dict[str, str], last_year: int, mainland: float) -> tuple[dict[str, str], dict[str, str]]:
    """依國籍（而不是出生地）統計的國家要說明；台灣另外附上移民署的外僑居留人數。"""
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    for iso3, kind in data_type.items():
        if kind.startswith("C"):
            notes[iso3] = "這個國家沒有出生地的統計，UN DESA 改用國籍：移民指住在這裡的外國人，不含已經歸化的人。"
            notes_en[iso3] = (
                "No data by country of birth; UN DESA uses citizenship instead, so migrants are foreign citizens living "
                "here and naturalised citizens are not counted."
            )
    residents = nia.foreign_residents()
    year = max(residents)
    latest = residents[year]
    top = sorted(((k, v) for k, v in latest.items() if k not in ("總計", "其他", "無國籍")), key=lambda kv: -kv[1])[:4]
    names_en = {"印尼": "Indonesia", "越南": "Vietnam", "菲律賓": "the Philippines", "泰國": "Thailand", "日本": "Japan"}
    notes[TAIWAN] = (
        f"UN DESA 依國籍統計台灣的外國人，含大陸地區人民（{last_year} 年約 {mainland / 10000:.0f} 萬人，多是大陸配偶）。"
        f"對照：移民署的外僑居留人數（持外僑居留證、不含大陸與港澳）{year} 年底 {latest['總計']:,} 人，"
        + "、".join(f"{k} {v:,}" for k, v in top)
        + "，多數是產業與社福移工。"
    )
    notes_en[TAIWAN] = (
        f"UN DESA counts foreign citizens in Taiwan, including residents from mainland China (about {mainland / 1000:.0f},000 "
        f"in {last_year}, mostly spouses). For comparison, the National Immigration Agency counted "
        f"{latest['總計']:,} foreign residents at the end of {year} (holders of alien resident certificates, excluding "
        "mainland China, Hong Kong and Macau): "
        + ", ".join(f"{names_en.get(k, k)} {v:,}" for k, v in top)
        + ", most of them migrant workers in industry and care."
    )
    return notes, notes_en


def _emigrant_notes() -> tuple[dict[str, str], dict[str, str]]:
    overseas = ocac.overseas_taiwanese()
    year = max(overseas)
    o = overseas[year]
    return (
        {TAIWAN: (
            "UN DESA 依各目的地國的普查與登記，統計出生於台灣（或持台灣籍）的人。"
            f"僑務委員會推估的海外臺灣僑民含在海外出生的後代，{year} 年底約 {o['合計'] / 10000:.1f} 萬人"
            f"（美國 {o['美國'] / 10000:.1f} 萬、印尼 {o['印尼'] / 10000:.1f} 萬、加拿大 {o['加拿大'] / 10000:.1f} 萬），定義不同，不能直接比。"
        )},
        {TAIWAN: (
            "UN DESA counts people born in (or citizens of) Taiwan, from censuses and registers of the destination countries. "
            "The Overseas Community Affairs Council's estimate of overseas Taiwanese includes descendants born abroad: "
            f"about {o['合計'] / 1e6:.2f} million at the end of {year} (United States {o['美國'] / 1e6:.2f} million, "
            f"Indonesia {o['印尼'] / 1e3:.0f},000, Canada {o['加拿大'] / 1e3:.0f},000), so the two are not comparable."
        )},
    )


def _ilo_foreign_born() -> dict[str, dict[int, float]]:
    """ILOSTAT：15 歲以上勞動力裡外國出生者的比例（%）"""
    path = download(ilostat.API.format(id=ILO_FOREIGN_BORN), "ilostat", f"{ILO_FOREIGN_BORN}.csv")
    cells: dict[tuple[str, int], dict[str, float]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["sex"] != "SEX_T" or row["classif1"] != "AGE_YTHADULT_YGE15" or not row["obs_value"]:
                continue
            if row.get("obs_status") == ilostat.UNRELIABLE or not (iso3 := to_iso3(row["ref_area"])):
                continue
            cells.setdefault((iso3, int(row["time"])), {})[row["classif2"]] = float(row["obs_value"])
    out: dict[str, dict[int, float]] = {}
    for (iso3, year), c in cells.items():
        if c.get("CBR_BIR_TOTAL") and "CBR_BIR_FOREIGN" in c:
            out.setdefault(iso3, {})[year] = c["CBR_BIR_FOREIGN"] / c["CBR_BIR_TOTAL"] * 100
    return out


def _taiwan_migrant_workers() -> tuple[int, float]:
    """(西元年, 產業及社福移工人數)：勞動部各縣市的總計加起來"""
    path = download(MOL_MIGRANT_WORKERS, "mol", "migrant-workers-by-county.csv")
    rows = list(csv.DictReader(io.StringIO(path.read_bytes().decode("utf-8-sig"))))
    years = {int(r["年度"]) for r in rows}
    if len(years) != 1:
        raise RuntimeError(f"勞動部移工人數的年度不只一個：{years}")
    return years.pop() + 1911, sum(float(r["總計"]) for r in rows)


def build_foreign_workers() -> None:
    out = OUT_DIR / "topics" / "migration"
    series = _ilo_foreign_born()
    year, workers = _taiwan_migrant_workers()
    header, table = dgbas._table("A040107010", 67, "0,8", "0,1")
    labour = dgbas._num(table[year][header.index("勞動力(千人)")]) * 1000
    share = workers / (labour + workers) * 100
    series[TAIWAN] = {year: share}
    years = latest_year_span(series, FOREIGN_WITHIN)
    note = (f"台灣不在 ILO 的資料裡，用勞動部的產業及社福移工人數（{year} 年 {workers:,.0f} 人）÷（主計總處人力資源調查的勞動力 "
            f"{labour / 1e4:,.0f} 萬人＋移工）自己算，假設人力資源調查的勞動力不含移工；只算移工，不含其他外國出生的人（例如新住民），"
            "跟其他國家依出生地的定義不同")
    note_en = (f"Taiwan is not in the ILO data; the share is migrant workers in industry and social welfare from the Ministry of Labor "
               f"({workers:,.0f} in {year}) divided by the labour force from DGBAS's Manpower Survey ({labour / 1e6:.2f} million) plus "
               "those workers, assuming the survey does not count them; it covers migrant workers only, not other foreign-born people "
               "such as immigrant spouses, so it differs from the place-of-birth definition used for other countries")
    write_json(out / "foreign-workers.json", indicator_file(
        "foreign-workers", "%", years, {c: to_series(v, years, 1) for c, v in series.items() if v},
        latestWithin=FOREIGN_WITHIN, notes={TAIWAN: note}, notesEn={TAIWAN: note_en},
    ))
    latest = {c: v[max(v)] for c, v in series.items() if max(v) >= years[-1] - FOREIGN_WITHIN}
    ranked = sorted((round(v, 1), c) for c, v in latest.items())
    print(f"  外國出生者占勞動力（{years[0]}–{years[-1]}，5 年內最近一年）：{len(latest)} 國，最高 {ranked[-5:]}，最低 {ranked[:3]}；"
          f"台灣 {year} 年 {share:.1f}%（移工 {workers:,.0f}、勞動力 {labour:,.0f}）")


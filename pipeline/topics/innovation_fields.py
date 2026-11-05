"""研發與創新：專利是哪些技術領域、創業投資金額（2026-11-05，製作手冊第二十二批 383；步驟 innovation-fields）。

- 專利的技術領域：WIPO 的 IP statistics 批次檔 wipo-data-patent-indicators.zip（CC BY 4.0，WIPO 網站條款；
  不用 WIPO 的標誌）的 dc_indicator_patent_4_publication_by_technology.csv：每年、每個受理局（office）、每個申請人
  國籍（origin）、35 個技術領域（tec_id，WIPO 依 IPC 對照的 Schmoch 分類）的**公告件數**，2000–2022 年。
  - 一國的件數 = 這個國籍的申請人在各受理局的公告加總（office = ** 不是全部受理局的合計，要排除，不然重複算）。
  - 占比的分母是 35 個領域的合計，不含 tec_id 0（未知，印度 2022 年占 7.4%）。一件專利可能跨好幾個領域，照 WIPO 的計法。
  - 那一年公告不到 MIN_COUNT 件的國家不算比例（件數太少，比例跳動大）。
  - 是公告不是申請，跟這個主題原本的「專利申請件數」（WDI 轉載 WIPO，到 2024 年）口徑不同。
  - 受理局：同一個檔依 office 加總（不分國籍），各國專利局一年公告幾件；EPO、PCT（WO）這類區域或國際受理局不在地圖上，寫在說明。
  - 中文名稱：檔裡的 field_zh 是簡體，這裡用自己寫的繁體（FIELDS）。
- 台灣：WIPO 沒有台灣。智慧財產局「發明專利新申請案件數依國際專利三階分類排行」（data.gov.tw 94266，政府資料開放授權條款）
  只有每年前 20 名的 IPC 次類，算不出 35 個領域的完整比例，只放在側欄（前 10 名）。
- 創業投資：OECD Data Explorer 的 Venture capital investments（DSD_VC@DF_VC_INV，CC BY 4.0），總額占 GDP 與美元，
  2002–2025 年、37 個經濟體（OECD 與幾個夥伴國），不含台灣（沒有可比的官方總量）。
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, to_series, write_json, year_span
from sources import oecd
from sources.countries import ISO3, from_alpha2


def to_iso3(code: str) -> str | None:
    """WIPO 的國籍與受理局是 ISO alpha-2；EP、WO（PCT）、EA、AP 這類區域或國際組織回傳 None"""
    iso3 = from_alpha2(code)
    return iso3 if iso3 in ISO3 else None

OUT = OUT_DIR / "topics" / "innovation"
PATENTS = "https://www.wipo.int/documents/d/ip-statistics/wipo-data-patent-indicators.zip"
TIPO_IPC = "https://tiponet.tipo.gov.tw/datagov/pt/152-107-001.csv"
MIN_COUNT = 100
# WIPO 的 35 個技術領域（tec_id → 前端的 id）；名稱寫在 src/topics/innovation.ts 的 PATENT_FIELDS
FIELDS = {
    1: "electrical-machinery", 2: "audio-visual", 3: "telecommunications", 4: "digital-communication",
    5: "basic-communication", 6: "computer-technology", 7: "it-management", 8: "semiconductors", 9: "optics",
    10: "measurement", 11: "biological-analysis", 12: "control", 13: "medical-technology", 14: "organic-chemistry",
    15: "biotechnology", 16: "pharmaceuticals", 17: "polymers", 18: "food-chemistry", 19: "basic-materials",
    20: "materials-metallurgy", 21: "surface-technology", 22: "nanotechnology", 23: "chemical-engineering",
    24: "environmental-technology", 25: "handling", 26: "machine-tools", 27: "engines", 28: "textile-paper-machines",
    29: "other-machines", 30: "thermal", 31: "mechanical-elements", 32: "transport", 33: "furniture-games",
    34: "other-consumer-goods", 35: "civil-engineering",
}


def _patents() -> tuple[dict[int, dict[str, dict[int, float]]], dict[str, dict[int, float]]]:
    """({年: {國籍: {領域: 件數}}}, {受理局: {年: 件數}})"""
    path = download(PATENTS, "wipo", "wipo-data-patent-indicators.zip")
    by_origin: dict[int, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    by_office: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    with zipfile.ZipFile(path) as z, z.open("dc_indicator_patent_4_publication_by_technology.csv") as f:
        for r in csv.DictReader(io.TextIOWrapper(f, "utf-8")):
            if r["office"] == "**" or r["origin"] == "**":
                continue
            year, tec, n = int(r["year"]), int(r["tec_id"]), float(r["count"])
            if tec in FIELDS:
                by_origin[year][r["origin"]][tec] += n
            by_office[r["office"]][year] += n
    return by_origin, by_office


def _taiwan_ipc() -> dict:
    path = download(TIPO_IPC, "tipo", "152-107-001.csv")
    with open(path, encoding="big5", errors="replace", newline="") as f:
        rows = list(csv.DictReader(f))
    last = max(int(r["年度"]) for r in rows)
    # [IPC 次類, 簡述的第一句（到第一個「（」或「；」為止）, 件數]
    top = [[r["國際專利分類（三階）"], re.split(r"[（；(]", r["分類內容簡述"])[0].strip(), int(r["件數"])]
           for r in rows if int(r["年度"]) == last][:10]
    return {"year": last + 1911, "source": "https://data.gov.tw/dataset/94266", "top": top}


def build() -> None:
    by_origin, by_office = _patents()
    years = sorted(by_origin)
    shares: dict[int, dict[str, dict[int, float]]] = {tec: defaultdict(dict) for tec in FIELDS}
    world: dict[int, dict[int, float]] = {tec: {} for tec in FIELDS}
    counts: dict[str, dict[int, dict[int, float]]] = defaultdict(dict)
    for y in years:
        total_world = sum(sum(f.values()) for f in by_origin[y].values())
        for tec in FIELDS:
            world[tec][y] = round(sum(f.get(tec, 0) for f in by_origin[y].values()) / total_world * 100, 3)
        for origin, fields in by_origin[y].items():
            iso3 = to_iso3(origin)
            total = sum(fields.values())
            if not iso3 or total < MIN_COUNT:
                continue
            counts[iso3][y] = dict(fields)
            for tec in FIELDS:
                shares[tec][iso3][y] = round(fields.get(tec, 0) / total * 100, 3)
    for tec, key in FIELDS.items():
        write_json(OUT / "patent-field" / f"{key}.json", indicator_file(
            f"patent-field/{key}", "%", years, {c: to_series(s, years) for c, s in sorted(shares[tec].items())},
            aggregates={"WLD": to_series(world[tec], years)},
        ), quiet=True)
    # 側欄：每國最近一年 35 個領域的件數與世界的比例（算 RTA）
    last = years[-1]
    write_json(OUT / "patent-fields.json", {
        "year": last,
        "fields": list(FIELDS.values()),
        "world": [world[t][last] for t in FIELDS],
        "countries": {c: [round(ys[last].get(t, 0)) for t in FIELDS] for c, ys in sorted(counts.items()) if last in ys},
        "taiwan": _taiwan_ipc(),
    })
    def top(c: str) -> list:
        f = counts[c][last]
        total = sum(f.values())
        return [(FIELDS[t], round(v / total * 100, 1)) for t, v in sorted(f.items(), key=lambda kv: -kv[1])[:3]]
    print(f"  專利的技術領域 {years[0]}–{last}：{sum(1 for c in counts if last in counts[c])} 國（{MIN_COUNT} 件以上）；"
          f"瑞典 {round(sum(counts['SWE'][last].values()))} 件 {top('SWE')}；以色列 {top('ISR')}；中國 {round(sum(counts['CHN'][last].values()))} {top('CHN')}")

    office = {c: s for o, s in by_office.items() if (c := to_iso3(o))}
    o_years = sorted({y for s in office.values() for y in s})
    write_json(OUT / "patent-office.json", indicator_file(
        "patent-office", "件", o_years, {c: to_series(s, o_years, 0) for c, s in sorted(office.items())},
    ))
    regional = {o: round(s[last]) for o, s in by_office.items() if not to_iso3(o) and last in s}
    print(f"  受理局：{len(office)} 個國家的專利局；{last} 年中國 {office['CHN'][last]:,.0f}、美國 {office['USA'][last]:,.0f}、"
          f"日本 {office['JPN'][last]:,.0f}、南韓 {office['KOR'][last]:,.0f}；區域與國際的 {regional}")

    gdp, _ = oecd.series("OECD.SDD.TPS,DSD_VC@DF_VC_INV,1.0", BUSINESS_DEVELOPMENT_STAGE="_T", UNIT_MEASURE="PT_B1GQ")
    usd, _ = oecd.series("OECD.SDD.TPS,DSD_VC@DF_VC_INV,1.0", BUSINESS_DEVELOPMENT_STAGE="_T", UNIT_MEASURE="USD_EXC")
    for key, data, unit, digits, factor in (("vc-gdp", gdp, "%", 4, 1), ("vc-usd", usd, "美元", 0, 1e6)):
        vy = year_span(data)
        write_json(OUT / f"{key}.json", indicator_file(
            key, unit, vy, {c: to_series({y: v * factor for y, v in s.items()}, vy, digits) for c, s in sorted(data.items())},
        ))
        lastv = {c: s[max(s)] for c, s in data.items()}
        print(f"  創業投資（{key}）{vy[0]}–{vy[-1]}：{len(data)} 個；最高 {sorted(lastv.items(), key=lambda kv: -kv[1])[:5]}")

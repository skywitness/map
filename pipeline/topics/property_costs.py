"""營建成本、地價與房屋稅（新主題，2026-11-07，製作手冊第二十五批 472，候選 1123、1124；經濟的「不動產」）。

- 新建住宅的營建價格與成本指數：Eurostat `sts_copi_a`（Construction producer prices or costs, new residential buildings，
  CC BY 4.0），cpa2_1=CPA_F41001_X_410014、unit=I21（2021＝100）；PRC_PRR 是建商的售價（含利潤，36 國）、
  COST 是工料成本（27 國），分成兩個子項目，不混在同一個色階。英國照 NONCOMMERCIAL 不收。
  「扣掉一般物價」是 I21 ÷ 世界銀行 WDI 的消費者物價指數（FP.CPI.TOTL，換成 2021＝100）× 100。
  台灣：主計總處的營造工程物價指數沒有找到可以直接下載的開放檔（總體統計資料庫的表沒查到代碼），先留空。
- 地方政府的經常性財產稅：OECD `DSD_DASHBOARD@PROP_TAX_REV`（Subnational government recurrent property tax revenue，
  R114；OECD 資料條款）。只有地方（S1313）、州（S1312）與兩者合計（S13M）三種，**沒有中央政府**，
  聯邦制的國家用 S13M、其他用 S1313。單位用占 GDP（PT_B1GQ）與每人 PPP 美元（USD_PPP_PS）。
  台灣：財政部「全國賦稅收入實徵淨額日曆年別－按稅目別分」（i0421，千元）的房屋稅加地價稅（都是地方稅）
  ÷ 主計總處的名目 GDP（百萬元）；每人 PPP 美元沒有（世界銀行沒有台灣的 PPP）。
- 台灣的側欄：稅目（房屋稅、地價稅、土地增值稅、契稅、房地合一稅）與內政部「歷年土地筆數面積公告地價統計」
  （data.gov.tw 25074，2026-01-01 的縣市公告地價總額與面積，政府資料開放授權條款第 1 版）。

輸出 public/data/topics/property-costs/：construction/{price,cost}.json、construction-real/{price,cost}.json、
property-tax.json、property-tax-pc.json、detail.json（側欄）、taiwan.json、manifest.json。
"""

from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import dgbas, eurostat, mof, oecd, worldbank
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "property-costs"
FIRST = 2000
CPA = "CPA_F41001_X_410014"
KINDS = {"price": "PRC_PRR", "cost": "COST"}
PROP_FLOW = "OECD.CFE.RDG,DSD_DASHBOARD@PROP_TAX_REV,1.1"
LAND_URL = ("https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/ECC2F1DE-BBAA-48B3-9171-46A3339AA25D/"
            "resource/1A44E910-9AE3-4A10-B118-3E8B27094F16/download")
TW_TAXES = {"房屋稅": "house", "地價稅": "land", "土地增值稅": "increment", "契稅": "deed", "房地合一稅合計": "consolidated"}


def _construction() -> tuple[list[int], dict[str, dict[str, dict[int, float]]], dict[str, dict[int, float]]]:
    """(年份, {kind: {iso3: {年: I21}}}, {iso3: {年: CPI 2021=100}})"""
    data = {k: eurostat.series("sts_copi_a", indic_bt=v, unit="I21", freq="A", cpa2_1=CPA, s_adj="NSA")
            for k, v in KINDS.items()}
    last = max(max(v) for d in data.values() for v in d.values())
    cpi_raw, _ = worldbank.fetch("FP.CPI.TOTL", FIRST, last)
    cpi = {k: {y: v[y] / v[2021] * 100 for y in v} for k, v in cpi_raw.items() if v.get(2021)}
    return list(range(FIRST, last + 1)), data, cpi


def _property_tax() -> tuple[dict[str, dict[int, float]], dict[str, dict[int, float]], dict[str, str]]:
    """({iso3: {年: 占 GDP %}}, {iso3: {年: 每人 PPP 美元}}, {iso3: 用的 SECTOR})"""
    by: dict[tuple[str, str, str], dict[int, float]] = defaultdict(dict)
    for r in oecd.rows(PROP_FLOW, "all"):
        if r["OBS_VALUE"] and r["UNIT_MEASURE"] in ("PT_B1GQ", "USD_PPP_PS"):
            by[(r["REF_AREA"], r["SECTOR"], r["UNIT_MEASURE"])][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    gdp: dict[str, dict[int, float]] = {}
    pc: dict[str, dict[int, float]] = {}
    sector: dict[str, str] = {}
    for area in sorted({a for a, _, _ in by}):
        iso3 = to_iso3(area)
        if not iso3:
            continue
        s = "S13M" if (area, "S13M", "PT_B1GQ") in by else "S1313"
        sector[iso3] = s
        gdp[iso3] = by.get((area, s, "PT_B1GQ"), {})
        pc[iso3] = by.get((area, s, "USD_PPP_PS"), {})
    return gdp, pc, sector


def _taiwan_taxes() -> tuple[dict[int, float], dict[int, dict[str, float]]]:
    """({年: 房屋稅＋地價稅占 GDP %}, {年: {稅目: 億元}})"""
    taxes = mof.table("i0421", 89, cols=60)
    gdp = {y: v["GDP"] for y, v in dgbas.gdp_by_industry().items() if "GDP" in v}
    share = {}
    detail = {}
    for y, row in taxes.items():
        if y in gdp and "房屋稅" in row and "地價稅" in row:
            share[y] = round((row["房屋稅"] + row["地價稅"]) / 1000 / gdp[y] * 100, 3)
        detail[y] = {key: round(row[k] / 1e5, 1) for k, key in TW_TAXES.items() if k in row}  # 千元 → 億元
    return share, detail


def _land_prices() -> dict:
    path = download(LAND_URL, "moi", "land-price-25074.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    out = []
    for r in rows:
        zh, _, en = r["CityCounty"].partition("/")
        out.append({
            "name": zh, "nameEn": en.replace("_", " "),
            "parcels": int(r["LandNumberofRecord"]), "ha": round(float(r["LandArea_Ha"]), 1),
            "total": round(float(r["Announcement_of_Land_price_Thousand"]) / 1e5, 1),  # 千元 → 億元
        })
    return {"date": rows[0]["Date"], "counties": out}


def build() -> None:
    years, cons, cpi = _construction()
    for kind, data in cons.items():
        nominal = {k: [round(v[y], 1) if y in v else None for y in years] for k, v in data.items()}
        real = {k: [round(v[y] / cpi[k][y] * 100, 1) if y in v and y in cpi.get(k, {}) else None for y in years]
                for k, v in data.items()}
        noval = {"TWN": "主計總處的營造工程物價指數沒有找到可以直接下載的開放資料"}
        noval_en = {"TWN": "No downloadable open data found for DGBAS’s construction cost index"}
        write_json(OUT / "construction" / f"{kind}.json",
                   indicator_file("construction", "2021=100", years, nominal, latestWithin=0, noValue=noval,
                                  noValueEn=noval_en, license="CC BY 4.0"))
        write_json(OUT / "construction-real" / f"{kind}.json",
                   indicator_file("construction-real", "2021=100", years, {k: v for k, v in real.items() if any(real[k])},
                                  latestWithin=0, noValue=noval, noValueEn=noval_en, license="CC BY 4.0"))

    gdp, pc, sector = _property_tax()
    tw_share, tw_detail = _taiwan_taxes()
    tax_years = list(range(FIRST, max(max(v) for v in gdp.values() if v) + 1))
    tax = {k: [round(v[y], 3) if y in v else None for y in tax_years] for k, v in gdp.items() if v}
    tax["TWN"] = [tw_share.get(y) for y in tax_years]
    write_json(OUT / "property-tax.json", indicator_file("property-tax", "%", tax_years, tax, latestWithin=0))
    per = {k: [round(v[y], 1) if y in v else None for y in tax_years] for k, v in pc.items() if v}
    write_json(OUT / "property-tax-pc.json", indicator_file(
        "property-tax-pc", "PPP 美元", tax_years, per, latestWithin=0,
        noValue={"TWN": "世界銀行沒有台灣的購買力平價，換不成 PPP 美元"},
        noValueEn={"TWN": "The World Bank has no PPP conversion factor for Taiwan"}))

    # 側欄：名目營建價格、成本與消費者物價（2021＝100）
    detail = {}
    for k in sorted(set(cons["price"]) | set(cons["cost"])):
        d = {kind: [round(cons[kind][k][y], 1) if y in cons[kind].get(k, {}) else None for y in years] for kind in KINDS}
        d["cpi"] = [round(cpi[k][y], 1) if y in cpi.get(k, {}) else None for y in years]
        detail[k] = d
    write_json(OUT / "detail.json", {"years": years, "detail": detail, "sector": sector})

    last = max(tw_detail)
    write_json(OUT / "taiwan.json", {
        "taxYear": last, "taxes": tw_detail[last],
        "share": {str(y): tw_share[y] for y in sorted(tw_share) if y >= FIRST},
        "land": _land_prices(),
    })
    for k in ("TUR", "BGR", "DEU", "FRA"):
        print(f"  {k} 2025 營建價格 {cons['price'].get(k, {}).get(years[-1])}，扣物價 "
              f"{round(cons['price'][k][years[-1]] / cpi[k][years[-1]] * 100, 1) if k in cons['price'] and years[-1] in cpi.get(k, {}) else None}")
    print(f"  台灣 {last} 年房屋稅＋地價稅占 GDP {tw_share.get(last)}%")
    write_json(OUT / "manifest.json", {"topic": "property-costs", "generatedAt": now_iso(), "sources": [
        "Eurostat sts_copi_a", "World Bank FP.CPI.TOTL", "OECD DSD_DASHBOARD@PROP_TAX_REV",
        "財政部 i0421", "主計總處 國內各業生產", "內政部 data.gov.tw 25074"]})

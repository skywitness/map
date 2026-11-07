"""零售業的規模與電子商務（新主題，2026-11-07，製作手冊第二十五批 473，候選 1132、1133；經濟的「消費與零售」）。

- 電子商務營業額占總營業額：Eurostat `isoc_ec_evaln2`（10 人以上的企業，indic_is=E_ETURN、unit=PC_TURN，CC BY 4.0），
  子項目「全部行業」（nace_r2=C10-S951_X_K，不含金融業）與「零售業」（G47）。英國照 NONCOMMERCIAL 不收。
- 零售業的規模：Eurostat `sbs_ovw_act`（Enterprises by detailed NACE Rev. 2 activity，2021–2024，441 萬個值，
  用 statistics 1.0 API 只抓 nace_r2=G47 的 NETTUR_MEUR、ENT_NR、EMP_NR），除以世界銀行 WDI 的人口（SP.POP.TOTL）：
  每人一年的零售營業額（歐元）、每萬人幾家零售企業、每家幾個人。
  台灣：主計總處 110 年（2021）工商及服務業普查「批發及零售業、住宿及餐飲業企業單位經營概況－按細行業別分」
  （data.gov.tw 111892，mp02143a110.xml，政府資料開放授權條款第 1 版）的「零售業」減掉「汽機車及其零配件、用品零售業」
  （Eurostat 的 G47 不含汽機車，台灣的行業標準把它放在零售業），營業收入用 Eurostat `ert_bil_eur_a` 2021 年的
  歐元兌新台幣換算，人口用戶政司 2021 年底的戶籍人口；放在 2021 年，hint 寫普查年。台灣沒有企業的電子商務占比
  （經濟部的網路銷售統計在 www.moea.gov.tw，從雲端 403），側欄另寫普查裡「電子購物及郵購業」占零售營業額的比例。

輸出 public/data/topics/retail/：ecommerce/{all,retail}.json、retail-sales.json、retail-firms.json、retail-size.json、
detail.json、taiwan.json、manifest.json。
"""

from __future__ import annotations

import gzip
import xml.etree.ElementTree as ET

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import eurostat, ris, worldbank

OUT = OUT_DIR / "topics" / "retail"
NACE = {"all": "C10-S951_X_K", "retail": "G47"}
TW_URL = "https://ws.dgbas.gov.tw/001/Upload/461/relfile/11525/233674/mp02143a110.xml"
TW_YEAR = 2021
MOTOR = "汽機車及其零配件、用品零售業"
# 側欄列的台灣零售業細項（第二層，加上便利商店、百貨公司、電子購物這幾個大家熟悉的第三層）
TW_ROWS = {
    "綜合商品零售業": "general", "連鎖便利商店": "convenience", "百貨公司": "department",
    "食品、飲料及菸草製品零售業": "food", "布疋及服飾品零售業": "clothing", "家用器具及用品零售業": "household",
    "藥品、醫療用品及化粧品零售業": "pharmacy", "文教育樂用品零售業": "leisure", "建材零售業": "building",
    "燃料及相關產品零售業": "fuel", "資訊及通訊設備零售業": "ict", "其他專賣零售業": "other",
    "其他非店面零售業": "nonstore", "電子購物及郵購業": "online", "直銷業": "direct",
}


def _eur_twd(year: int) -> float:
    path = download(eurostat.URL.format(dataset="ert_bil_eur_a"), "eurostat", "ert_bil_eur_a.tsv.gz")
    with gzip.open(path, "rt", encoding="utf-8") as f:
        years = [int(h) for h in f.readline().rstrip("\n").split("\t")[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            if cells[0] == "A,AVG,NAC,TWD":
                vals = {y: float(c.split(" ")[0]) for y, c in zip(years, cells[1:]) if c.strip().split(" ")[0] not in (":", "")}
                return vals[year]
    raise RuntimeError("Eurostat ert_bil_eur_a 沒有 TWD")


def _taiwan() -> dict:
    path = download(TW_URL, "dgbas", "mp02143a110.xml")
    rows = {}
    for rec in ET.parse(path).getroot():
        cells = [(c.text or "").strip() for c in rec]
        rows.setdefault(cells[0], [int(cells[1]), int(cells[2]), int(cells[4])])  # 家數、從業員工、營業收入（千元）
    retail, motor = rows["零售業"], rows[MOTOR]
    firms, people, revenue = (retail[i] - motor[i] for i in range(3))
    return {
        "firms": firms, "people": people, "revenue": revenue * 1000,  # 元
        "rows": {key: rows[name] for name, key in TW_ROWS.items()},
    }


def build() -> None:
    # ── 電子商務 ──
    eyears: list[int] = []
    ecom = {}
    for item, nace in NACE.items():
        ecom[item] = eurostat.series("isoc_ec_evaln2", size_emp="GE10", nace_r2=nace, indic_is="E_ETURN",
                                     unit="PC_TURN", freq="A")
        eyears = sorted({y for v in ecom[item].values() for y in v} | set(eyears))
    eyears = list(range(eyears[0], eyears[-1] + 1))
    noval = {"TWN": "沒有台灣的資料（經濟部的網路銷售統計從這裡連不上）"}
    noval_en = {"TWN": "No data for Taiwan (the Ministry of Economic Affairs’ online sales statistics could not be reached)"}
    for item, data in ecom.items():
        write_json(OUT / "ecommerce" / f"{item}.json", indicator_file(
            "ecommerce", "%", eyears, {k: [round(v[y], 2) if y in v else None for y in eyears] for k, v in data.items()},
            latestWithin=0, noValue=noval, noValueEn=noval_en, license="CC BY 4.0"))

    # ── 零售業的規模 ──
    sbs = {ind: eurostat.json_series("sbs_ovw_act", nace_r2="G47", indic_sbs=ind, freq="A")
           for ind in ("NETTUR_MEUR", "ENT_NR", "EMP_NR")}
    syears = sorted({y for v in sbs["NETTUR_MEUR"].values() for y in v})
    pop, _ = worldbank.fetch("SP.POP.TOTL", syears[0], syears[-1])
    tw = _taiwan()
    tw_pop = sum(ris.county_population(TW_YEAR).values())
    rate = _eur_twd(TW_YEAR)
    hint = {"TWN": f"台灣是 {TW_YEAR} 年工商普查（零售業扣掉汽機車零售）"}
    hint_en = {"TWN": f"Taiwan: {TW_YEAR} industry and commerce census (retail excluding motor vehicles)"}

    def per(fn) -> dict[str, list[float | None]]:
        out = {}
        for k in sbs["NETTUR_MEUR"].keys() | sbs["ENT_NR"].keys():
            row = [fn(k, y) for y in syears]
            if any(v is not None for v in row):
                out[k] = row
        return out

    def sales(k: str, y: int) -> float | None:
        v, p = sbs["NETTUR_MEUR"].get(k, {}).get(y), pop.get(k, {}).get(y)
        return round(v * 1e6 / p) if v and p else None

    def firms(k: str, y: int) -> float | None:
        v, p = sbs["ENT_NR"].get(k, {}).get(y), pop.get(k, {}).get(y)
        return round(v / p * 1e4, 1) if v and p else None

    def size(k: str, y: int) -> float | None:
        e, n = sbs["EMP_NR"].get(k, {}).get(y), sbs["ENT_NR"].get(k, {}).get(y)
        return round(e / n, 2) if e and n else None

    ty = syears.index(TW_YEAR)
    for name, fn, unit, tw_value in (
        ("retail-sales", sales, "歐元", round(tw["revenue"] / rate / tw_pop)),
        ("retail-firms", firms, "家/萬人", round(tw["firms"] / tw_pop * 1e4, 1)),
        ("retail-size", size, "人", round(tw["people"] / tw["firms"], 2)),
    ):
        values = per(fn)
        values["TWN"] = [tw_value if i == ty else None for i in range(len(syears))]
        write_json(OUT / f"{name}.json", indicator_file(name, unit, syears, values, latestWithin=len(syears) - 1 - ty,
                                                          hints=hint, hintsEn=hint_en, license="CC BY 4.0"))

    # ── 側欄 ──
    detail = {}
    for k in set(ecom["all"]) | set(sbs["NETTUR_MEUR"]):
        d: dict[str, object] = {}
        for item in NACE:
            if k in ecom[item]:
                d[item] = [round(ecom[item][k][y], 2) if y in ecom[item][k] else None for y in eyears]
        last = max(sbs["NETTUR_MEUR"].get(k, {}) or [0])
        if last:
            d["sbs"] = {"year": last, "turnover": sbs["NETTUR_MEUR"][k][last],
                        "firms": sbs["ENT_NR"].get(k, {}).get(last), "people": sbs["EMP_NR"].get(k, {}).get(last)}
        detail[k] = d
    write_json(OUT / "detail.json", {"years": eyears, "detail": detail})
    write_json(OUT / "taiwan.json", {
        "year": TW_YEAR, "firms": tw["firms"], "people": tw["people"], "revenue": tw["revenue"],
        "rate": rate, "population": tw_pop,
        "rows": {k: {"firms": v[0], "people": v[1], "revenue": v[2] * 1000} for k, v in tw["rows"].items()},
    })
    print(f"  台灣 {TW_YEAR} 年零售業（扣汽機車）{tw['firms']:,} 家、{tw['people']:,} 人、營業收入 {tw['revenue'] / 1e12:.3f} 兆元，"
          f"每人 {tw['revenue'] / rate / tw_pop:,.0f} 歐元（{rate}）；電子購物及郵購業占 "
          f"{tw['rows']['online'][2] * 1000 / tw['revenue'] * 100:.1f}%")
    write_json(OUT / "manifest.json", {"topic": "retail", "generatedAt": now_iso(), "sources": [
        "Eurostat isoc_ec_evaln2, sbs_ovw_act, ert_bil_eur_a", "World Bank SP.POP.TOTL",
        "主計總處 110 年工商及服務業普查", "內政部戶政司 ODRP019"]})

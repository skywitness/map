"""環境稅收與環境保護支出（新主題，2026-11-07，製作手冊第二十五批 500＋501，候選 1169、1170；環境的新小類「環境治理」）。

使用者 2026-11-07 決定 501「環境保護支出」放進 500 當指標與側欄。
- OECD「Environmentally related tax revenue」（OECD.ENV.EPI,DSD_ERTR@DF_ERTR,1.0，CC BY 4.0）：維度
  FREQ.REF_AREA.MEASURE.CATEGORY.DOMAIN.UNIT_MEASURE.ACTIVITY，key「A..TAXREV._T+CAT_ENE+CAT_TRA+CAT_POL+CAT_RES._T.PT_B1GQ+PT_TAX_REV._Z」
  （全量 276 MB 不抓）：環境相關稅收占 GDP（PT_B1GQ，依稅基：全部、能源、運輸、污染、資源）與占總稅收（PT_TAX_REV）。
  沒有台灣。0 的國家（汶萊、柬埔寨、緬甸…）多半是沒申報，說明寫明。
- Eurostat「National expenditure on environmental protection」（env_epea_neep，CC BY 4.0）：sector＝S1（全經濟）、
  unit＝PC_GDP 的 TOT_CEP_EP（合計的代碼不是 TOTAL）畫地圖；側欄用 MIO_EUR 的 8 個不重疊的用途：CEP01 空氣與氣候、
  CEP0301 污水、CEP0401 廢棄物、CEP0501 土壤與水、CEP0502 生物多樣性與景觀、CEP06 噪音與輻射、
  CEP0701_03_05_07_09 研發、CEP08_EP 跨領域與其他（加起來等於合計；2023 年 EU27 是 3,688.52 億歐元）。英國照規則不收。
輸出 public/data/topics/env-taxes/：tax-gdp/{item}.json、tax-share.json、expenditure.json（%）、expenditure-detail.json（側欄）。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat, oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "env-taxes"
FLOW = "OECD.ENV.EPI,DSD_ERTR@DF_ERTR,1.0"
KEY = "A..TAXREV._T+CAT_ENE+CAT_TRA+CAT_POL+CAT_RES._T.PT_B1GQ+PT_TAX_REV._Z"
CATEGORIES = {"_T": "all", "CAT_ENE": "energy", "CAT_TRA": "transport", "CAT_POL": "pollution", "CAT_RES": "resources"}
CEPA = ["CEP01", "CEP0301", "CEP0401", "CEP0501", "CEP0502", "CEP06", "CEP0701_03_05_07_09", "CEP08_EP"]
FIRST = 1994


def build() -> None:
    data: dict[tuple[str, str], dict[str, dict[int, float]]] = {}
    for r in oecd.rows(FLOW, KEY):
        if not r["OBS_VALUE"]:
            continue
        iso3 = to_iso3(r["REF_AREA"])
        if not iso3:
            continue
        data.setdefault((r["CATEGORY"], r["UNIT_MEASURE"]), {}).setdefault(iso3, {})[int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    last = max(y for s in data[("_T", "PT_B1GQ")].values() for y in s)
    years = list(range(FIRST, last + 1))
    lic = "CC BY 4.0"
    for cat, item in CATEGORIES.items():
        series = data.get((cat, "PT_B1GQ"), {})
        write_json(OUT / "tax-gdp" / f"{item}.json", indicator_file(
            "tax-gdp", "%", years, {k: [round(s[y], 2) if y in s else None for y in years] for k, s in series.items()}, license=lic))
    share = data[("_T", "PT_TAX_REV")]
    write_json(OUT / "tax-share.json", indicator_file(
        "tax-share", "%", years, {k: [round(s[y], 2) if y in s else None for y in years] for k, s in share.items()}, license=lic))

    exp = eurostat.json_series("env_epea_neep", sector="S1", unit="PC_GDP", env_pa="TOT_CEP_EP")
    eyears = sorted({y for s in exp.values() for y in s})
    write_json(OUT / "expenditure.json", indicator_file(
        "expenditure", "%", eyears, {k: [s.get(y) for y in eyears] for k, s in exp.items()}, license=lic))
    parts = {code: eurostat.json_series("env_epea_neep", sector="S1", unit="MIO_EUR", env_pa=code) for code in CEPA}
    detail: dict[str, dict[str, list[float | None]]] = {}
    for iso3 in exp:
        rows = {}
        for y in eyears:
            row = [parts[c].get(iso3, {}).get(y) for c in CEPA]
            if sum(v is not None for v in row) >= 3:
                rows[str(y)] = [round(v, 1) if v is not None else None for v in row]
        if rows:
            detail[iso3] = rows
    write_json(OUT / "expenditure-detail.json", {"items": CEPA, "countries": detail})
    print(f"  OECD 環境稅 {len(data[('_T', 'PT_B1GQ')])} 國 {years[0]}–{last}；Eurostat 環保支出 {len(exp)} 國 {eyears[0]}–{eyears[-1]}，側欄 {len(detail)} 國")

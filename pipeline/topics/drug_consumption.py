"""各國吃多少藥（2026-11-03，製作手冊第十九批 297；醫藥分類的藥物組，新主題）。

**資料**：OECD Pharmaceutical consumption（`OECD.ELS.HD,HEALTH_PHMC@DF_PHMC_CONSUM,1.1`）：每千人每天的定義每日劑量
（DDD per 1,000 inhabitants per day），34 個 ATC 類別、1980–2025 年、約 34 國。挑 8 類（`CLASSES`）。
OECD 資料條款可用。
**範圍不同**：各國的資料有的只算健保給付、有的含醫院，OECD 的狀態碼 D（定義不同）很多；說明裡寫明。
沒有美國；日本只有抗生素。
**台灣**：沒有 DDD。健保署「抗憂鬱藥物使用人數」（data.gov.tw 146577，政府資料開放授權）只有人數，指標不同，
只放在抗憂鬱劑的說明，不混進 DDD 的序列（製作手冊）。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import countries, oecd

OUT = OUT_DIR / "topics" / "drug-consumption"
FLOW = "OECD.ELS.HD,HEALTH_PHMC@DF_PHMC_CONSUM,1.1"
# 指標 id → ATC 代碼
CLASSES = {
    "antidepressants": "N06A",
    "anxiolytics": "N05B",
    "hypnotics": "N05C",
    "dementia": "N06D",
    "lipid": "C10",
    "raas": "C09",
    "diabetes": "A10",
    "antibiotics": "J01",
}


def build() -> None:
    data: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for r in oecd.rows(FLOW, "all"):
        if r["UNIT_MEASURE"] != "DDD_10P3HB" or r["OBS_VALUE"] == "":
            continue
        if iso3 := countries.to_iso3(r["REF_AREA"]):
            data[r["PHARMACEUTICAL"]][iso3][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    for name, code in CLASSES.items():
        series = data[code]
        if not series:
            raise RuntimeError(f"OECD 藥品消費沒有 {code}")
        years = year_span(series)
        values = {c: to_series(s, years, 1) for c, s in sorted(series.items())}
        values = {c: v for c, v in values.items() if any(x is not None for x in v)}
        write_json(OUT / f"{name}.json", indicator_file(name, "DDD／千人／日", years, values))
        latest = sorted(((s[max(s)], c, max(s)) for c, s in series.items()), reverse=True)
        print(f"  {name}（{code}）：{len(values)} 國，{years[0]}–{years[-1]}；最高 {latest[:3]}；最低 {latest[-2:]}")
    write_json(OUT / "manifest.json", {
        "topic": "drug-consumption", "generatedAt": now_iso(),
        "source": "OECD Health Statistics, Pharmaceutical consumption (DDD per 1,000 inhabitants per day)",
        "license": "OECD terms",
    })


if __name__ == "__main__":
    build()

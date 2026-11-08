"""樂園業的營業額、附加價值、家數與就業（新主題，2026-11-08，製作手冊第二十七批 633，候選 1374、1375；步驟 amusement-industry）。

- **Eurostat `sbs_ovw_act`**（Enterprises by detailed NACE Rev. 2 activity，CC BY 4.0）的 NACE **R9321**「Activities of amusement
  parks and theme parks」，2021–2024：淨營業額（NETTUR_MEUR）、附加價值（AV_MEUR）、企業家數（ENT_NR）、從業人數（EMP_NR，
  含自營者，不是員工數）。用 statistics 1.0 API 篩選後下載（同零售業 retail.py）。這個資料集的 geo 沒有英國；科索沃照規則不收。
- **OECD SDBS**（`OECD.SDD.TPS,DSD_SDBSBSC_ISIC4@DF_SDBS_ISIC4`，ISIC Rev. 4 R9321，CC BY 4.0）只補 Eurostat 沒有的國家
  （南韓、紐西蘭、哥斯大黎加、英國、以色列）：營業額 TUTT、附加價值 VALU 是本國貨幣（百萬），用 Eurostat `ert_bil_eur_a`
  當年的歐元年平均匯率換成歐元；家數 ENTR、從業人數 EMPN 直接用。
- 每家幾個人＝從業人數 ÷ 家數：手冊說這個比值把「幾座大型主題樂園」跟「一堆小遊樂場」分開。
- 陷阱（手冊）：各國把什麼算進 R9321 差很多（法國 5,049 家、丹麥 188 家，法國把大量流動遊樂場算進來），營業額高不代表主題
  樂園大；馬爾他、波蘭的部分數字是機密（Eurostat 不給值）；OECD 的年份對不齊（英國停在 2019 年）。
- 台灣：財政部的稅務行業只到 3 位數「932 娛樂及休閒服務業」，沒有 4 位數的遊樂園業 → 留白。
"""
from __future__ import annotations

import gzip

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import eurostat, oecd

OUT = OUT_DIR / "topics" / "amusement-industry"
OECD_FLOW = "OECD.SDD.TPS,DSD_SDBSBSC_ISIC4@DF_SDBS_ISIC4,"
OECD_KEY = "A..TUTT+VALU+ENTR+EMPN.R9321._T."
YEARS = list(range(2019, 2025))
NOVALUE = {"TWN": "台灣沒有遊樂園業的統計"}
NOVALUE_EN = {"TWN": "No statistics for amusement parks in Taiwan"}
NOTES = {"TWN": "財政部的營利事業銷售額只分到 3 位數的「932 娛樂及休閒服務業」，沒有 4 位數的遊樂園業；"
                "主計總處的工商普查有 4 位數但 5 年一次"}
NOTES_EN = {"TWN": "The Ministry of Finance’s business sales data stop at the 3-digit “932 amusement and recreation activities”; "
                   "the DGBAS census has 4-digit industries but only every five years"}


def _fx() -> dict[str, dict[int, float]]:
    """歐元的年平均匯率（1 歐元 = 幾單位本國貨幣）"""
    path = download(eurostat.URL.format(dataset="ert_bil_eur_a"), "eurostat", "ert_bil_eur_a.tsv.gz")
    out: dict[str, dict[int, float]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        years = [int(h) for h in f.readline().rstrip("\n").split("\t")[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            parts = cells[0].split(",")
            if parts[:3] == ["A", "AVG", "NAC"]:
                out[parts[3]] = {y: float(c.split(" ")[0]) for y, c in zip(years, cells[1:]) if c.strip().split(" ")[0] not in (":", "")}
    return out


CURRENCY = {"KOR": "KRW", "NZL": "NZD", "CRI": "CRC", "GBR": "GBP", "ISR": "ILS"}


def _oecd(skip: set[str]) -> dict[str, dict[str, dict[int, float]]]:
    """OECD 補的國家：{指標: {iso3: {年: 值}}}，金額換成百萬歐元"""
    fx = _fx()
    out: dict[str, dict[str, dict[int, float]]] = {m: {} for m in ("TUTT", "VALU", "ENTR", "EMPN")}
    for r in oecd.rows(OECD_FLOW, OECD_KEY):
        iso3, m = r["REF_AREA"], r["MEASURE"]
        if iso3 in skip or not r["OBS_VALUE"] or m not in out:
            continue
        year = int(r["TIME_PERIOD"][:4])
        v = float(r["OBS_VALUE"])
        if m in ("TUTT", "VALU"):
            if r["UNIT_MEASURE"] != "XDC" or r["UNIT_MULT"] != "6":
                raise RuntimeError(f"OECD SDBS {iso3} {m} 的單位是 {r['UNIT_MEASURE']}×10^{r['UNIT_MULT']}")
            rate = fx.get(CURRENCY[iso3], {}).get(year)
            if not rate:
                continue
            v = v / rate
        out[m].setdefault(iso3, {})[year] = v
    return out


def build() -> None:
    eu = {ind: eurostat.json_series("sbs_ovw_act", nace_r2="R9321", indic_sbs=ind, freq="A")
          for ind in ("NETTUR_MEUR", "AV_MEUR", "ENT_NR", "EMP_NR")}
    have = set().union(*eu.values())
    extra = _oecd(have)
    merged = {
        "turnover": {**eu["NETTUR_MEUR"], **extra["TUTT"]},
        "value-added": {**eu["AV_MEUR"], **extra["VALU"]},
        "enterprises": {**eu["ENT_NR"], **extra["ENTR"]},
        "employed": {**eu["EMP_NR"], **extra["EMPN"]},
    }
    hints = {k: "OECD（本國貨幣按歐元年平均匯率換算）" for k in CURRENCY}
    hints_en = {k: "OECD (converted at the annual average euro rate)" for k in CURRENCY}
    units = {"turnover": "百萬歐元", "value-added": "百萬歐元", "enterprises": "家", "employed": "人"}
    digits = {"turnover": 2, "value-added": 2, "enterprises": 0, "employed": 0}
    for name, data in merged.items():
        values = {k: [round(v[y], digits[name]) if y in v else None for y in YEARS] for k, v in sorted(data.items())
                  if any(y in v for y in YEARS)}
        money = name in ("turnover", "value-added")
        write_json(OUT / f"{name}.json", indicator_file(
            name, units[name], YEARS, values, latestWithin=len(YEARS) - 1, noValue=NOVALUE, noValueEn=NOVALUE_EN,
            notes=NOTES, notesEn=NOTES_EN, license="CC BY 4.0",
            **({"hints": {k: h for k, h in hints.items() if k in values},
                "hintsEn": {k: h for k, h in hints_en.items() if k in values}} if money else {})))
        last = sorted(((k, max(y for y in YEARS if y in v), v[max(y for y in YEARS if y in v)]) for k, v in data.items()
                       if any(y in v for y in YEARS)), key=lambda t: -t[2])
        print(f"  {name}：{len(values)} 國；" + "、".join(f"{k} {y} {v:,.{digits[name]}f}" for k, y, v in last[:10]))
    size = {}
    for k in merged["enterprises"].keys() & merged["employed"].keys():
        e, n = merged["employed"][k], merged["enterprises"][k]
        row = [round(e[y] / n[y], 1) if y in e and y in n and n[y] else None for y in YEARS]
        if any(v is not None for v in row):
            size[k] = row
    write_json(OUT / "size.json", indicator_file("size", "人/家", YEARS, dict(sorted(size.items())), latestWithin=len(YEARS) - 1,
                                                 noValue=NOVALUE, noValueEn=NOVALUE_EN, notes=NOTES, notesEn=NOTES_EN, license="CC BY 4.0"))
    last = sorted(((k, next(v for v in reversed(r) if v is not None)) for k, r in size.items()), key=lambda t: -t[1])
    print("  每家幾個人：" + "、".join(f"{k} {v}" for k, v in last[:12]) + " … " + "、".join(f"{k} {v}" for k, v in last[-5:]))
    write_json(OUT / "manifest.json", {"topic": "amusement-industry", "generatedAt": now_iso(), "sources": [
        "Eurostat sbs_ovw_act（NACE R9321）、ert_bil_eur_a", "OECD SDBS（ISIC Rev. 4 R9321）"]})

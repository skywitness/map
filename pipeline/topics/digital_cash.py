"""數位：離不開現金的人（2026-11-05，製作手冊第二十二批 381；步驟 digital-cash，輸出到 topics/digital/）。

- 資料：World Bank Global Findex Database 2025 的整份 CSV（跟數位支付、手機持有同一個檔，topics/digital_extra.py 的
  FINDEX，CC BY 4.0），15 歲以上、全體（group == all）：
  - 只用現金：付水電費（fin31d）、領薪水（fin34c）、賣農產品收錢（fin43c），2014、2017、2021、2022、2024 年；
    網購貨到付現（fin27b），2021 年起。分母都是 15 歲以上的全體（不是有付水電費的人），各指標不能相加。
  - 在店裡付現金的主要原因（fin25e4a–e，只有 2024 年）：商家只收現金、用卡或手機比較貴、不信任卡或手機付款、
    就是習慣付現金、其他。
  - 各國用自己最新的一年（latestWithin 3，2021–2024）。Findex 以中低所得經濟體為主，高所得國家很多沒有問這幾題。
- 台灣：Findex 2025 有台灣這一列，但現金題組是空的（NA）。側欄改列數位發展部「國內各場域行動支付滲透率」
  （data.gov.tw 128268，政府資料開放授權條款，最新的 2024 年，24 個場域；檔案是 Big5 編碼的 CSV），不上地圖。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, to_series, write_json, year_span
from topics.digital_extra import FINDEX

OUT = OUT_DIR / "topics" / "digital"
WITHIN = 3
CASH = {"utilities": "fin31d", "wages": "fin34c", "agriculture": "fin43c", "cod": "fin27b"}
REASONS = {"merchant": "fin25e4a", "cost": "fin25e4b", "trust": "fin25e4c", "habit": "fin25e4d", "other": "fin25e4e"}
TW_VENUES = "https://www-api.moda.gov.tw/OpenData/Files/18774"  # 2024 年度
TW_YEAR = 2024
NOTES = {
    "KEN": ("肯亞只用現金付水電費的比例很低，是因為大家用 M-Pesa 這類手機錢包付，不是因為刷卡普及。",
            "Few Kenyans pay utility bills only in cash because they pay with mobile money such as M-Pesa, not because cards are common."),
}


def _findex() -> dict[str, dict[str, dict[int, float]]]:
    path = download(FINDEX, "worldbank", "GlobalFindexDatabase2025.csv")
    data: dict[str, dict[str, dict[int, float]]] = {k: defaultdict(dict) for k in [*CASH.values(), *REASONS.values()]}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["group"] != "all":
                continue
            for k in data:
                v = r.get(k, "NA")
                if v not in ("", "NA"):
                    data[k][r["codewb"]][int(r["year"])] = round(float(v) * 100, 2)
    return data


def _taiwan_venues() -> list[list]:
    path = download(TW_VENUES, "moda", f"mobile-payment-venues-{TW_YEAR}.csv")
    with open(path, encoding="big5", newline="") as f:
        rows = list(csv.DictReader(f))
    out = []
    for r in rows:
        if int(r["調查年度"]) != TW_YEAR:
            raise RuntimeError(f"數位部行動支付滲透率：年度 {r['調查年度']} 不是 {TW_YEAR}")
        out.append([r["場域名稱"], float(r["滲透率百分比"].rstrip("%"))])
    if len(out) != 24:
        raise RuntimeError(f"數位部行動支付滲透率：{len(out)} 個場域，應該是 24 個")
    return sorted(out, key=lambda v: -v[1])


def build() -> None:
    data = _findex()
    for key, code in CASH.items():
        series = dict(data[code])
        world = series.pop("WLD", {})
        series = {c: s for c, s in series.items() if len(c) == 3 and s}
        years = [y for y in year_span(series) if y >= 2014]
        notes = {c: zh for c, (zh, _en) in NOTES.items()} if key == "utilities" else {}
        notes_en = {c: en for c, (_zh, en) in NOTES.items()} if key == "utilities" else {}
        write_json(OUT / "cash" / f"{key}.json", indicator_file(
            f"cash-{key}", "%", years, {c: to_series(s, years, 2) for c, s in sorted(series.items())},
            aggregates={"WLD": to_series(world, years, 2)} if world else {}, latestWithin=WITHIN,
            notes=notes, notesEn=notes_en,
        ))
        latest = {c: (max(s), s[max(s)]) for c, s in series.items() if max(s) >= years[-1] - WITHIN + 1}
        top = sorted(latest.items(), key=lambda kv: -kv[1][1])
        print(f"  只用現金（{key}，{code}）：{years[0]}–{years[-1]}，{len(latest)} 個經濟體；最高 {[(c, y, v) for c, (y, v) in top[:5]]}；"
              f"最低 {[(c, y, v) for c, (y, v) in top[-5:]]}")
    reasons: dict[str, list] = {}
    for key, code in REASONS.items():
        series = {c: s for c, s in data[code].items() if len(c) == 3 and c != "WLD" and 2024 in s}
        write_json(OUT / "cash-reason" / f"{key}.json", indicator_file(
            f"cash-reason-{key}", "%", [2024], {c: [s[2024]] for c, s in sorted(series.items())},
        ))
        for c, s in series.items():
            reasons.setdefault(c, [None] * len(REASONS))[list(REASONS).index(key)] = s[2024]
        top = sorted(series.items(), key=lambda kv: -kv[1][2024])
        print(f"  付現金的原因（{key}）：{len(series)} 個；最高 {[(c, s[2024]) for c, s in top[:4]]}；最低 {[(c, s[2024]) for c, s in top[-3:]]}")
    venues = _taiwan_venues()
    write_json(OUT / "cash-detail.json", {
        "reasons": dict(sorted(reasons.items())),
        "taiwan": {"year": TW_YEAR, "source": "https://data.gov.tw/dataset/128268", "venues": venues},
    })
    print(f"  台灣的行動支付滲透率（{TW_YEAR}）：{venues[:3]} … {venues[-2:]}")

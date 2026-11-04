"""疾病與死因：糖尿病盛行率（2026-11-04 補回；輸出到 topics/disease/）。

- 原本用 WHO GHO 轉載的 NCD-RisC 估計（NCD_DIABETES_PREVALENCE_AGESTD）；使用者 2026-11-04 決定只在 GHO 的指標不用，
  拿掉了（DESIGN.md 第 8 節第 367 點）。同一天改用 NCD-RisC 自己公布的檔補回來。
- 資料：NCD-RisC《Worldwide trends in diabetes prevalence and treatment from 1990 to 2022》（Lancet 2024;404:2077–93）的
  各國年齡標準化估計（https://ncdrisc.org/downloads/dm-2024/NCD_RisC_Lancet_2024_Diabetes_age_standardised_countries.csv ）
  與全球估計（…_world.csv）。200 個國家與地區（含台灣），1990–2022 年，**只有男女分開**，沒有兩性合計（不自己合成）。
  欄位「Prevalence of diabetes (18+ years)」是 18 歲以上的比例（0–1），附 95% 不確定區間。糖尿病的定義：空腹血糖
  7.0 mmol/L 以上、糖化血色素 6.5% 以上，或正在服藥；年齡標準化用 WHO 標準人口。
- 下載：ncdrisc.org 從 cloud 經代理伺服器回 HTTP 421（伺服器的 IPv6／SNI 設定問題），本機 session 下載放在 map-plan 的
  `data/ncdrisc/`（README 有網址、SHA-256 與核對）；重跑前複製到 `pipeline/.cache/ncdrisc/`（快取裡有就不下載）。
- 授權：論文是 CC BY 4.0，網站的下載檔沒有另外寫授權、頁尾是 All Rights Reserved。使用者 2026-11-04 決定比照平均身高
  主題照用：非商業、註明 NCD-RisC 與論文，NCD-RisC 要求就撤下（DESIGN.md 第 8 節第 12、71 點）。
"""
from __future__ import annotations

import csv

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import ncdrisc

OUT = OUT_DIR / "topics" / "disease" / "diabetes"
PATH = "dm-2024/NCD_RisC_Lancet_2024_Diabetes_age_standardised_{}.csv"
COL = "Prevalence of diabetes (18+ years)"
SEXES = {"Men": "male", "Women": "female"}


def _rows(kind: str) -> list[dict[str, str]]:
    with open(ncdrisc._download(PATH.format(kind)), encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def build() -> None:
    rows = _rows("countries")
    if len(rows) != 13200:
        raise RuntimeError(f"NCD-RisC 糖尿病：{len(rows)} 列，應該是 200 國 × 男女 × 33 年 = 13,200 列")
    est: dict[str, dict[str, dict[int, tuple[float, float, float]]]] = {s: {} for s in SEXES.values()}
    for r in rows:
        if r["Age"] != "Age-standardised":
            raise RuntimeError(f"NCD-RisC 糖尿病：不是年齡標準化的列 {r['Age']}")
        sex = SEXES[r["Sex"]]
        v = tuple(float(r[c]) * 100 for c in (COL, f"{COL} lower 95% uncertainty interval", f"{COL} upper 95% uncertainty interval"))
        est[sex].setdefault(r["ISO"], {})[int(r["Year"])] = v
    world: dict[str, dict[int, float]] = {s: {} for s in SEXES.values()}
    for r in _rows("world"):
        world[SEXES[r["Sex"]]][int(r["Year"])] = float(r[COL]) * 100
    years = sorted({y for s in est.values() for c in s.values() for y in c})
    last = years[-1]
    for sex, data in est.items():
        hints = {c: f"{last} 年 95% 不確定區間 {s[last][1]:.1f}–{s[last][2]:.1f}%" for c, s in data.items() if last in s}
        hints_en = {c: f"{last}: 95% uncertainty interval {s[last][1]:.1f}–{s[last][2]:.1f}%" for c, s in data.items() if last in s}
        write_json(OUT / f"{sex}.json", indicator_file(
            "diabetes", "%", years, {c: to_series({y: v[0] for y, v in s.items()}, years, 1) for c, s in sorted(data.items())},
            aggregates={"WLD": to_series(world[sex], years, 1)}, hints=hints, hintsEn=hints_en,
            license="論文 CC BY 4.0，資料檔未另外標示授權"))
        top = sorted(((s[last][0], c) for c, s in data.items()), reverse=True)
        print(f"  糖尿病（{sex}）：{len(data)} 國，{years[0]}–{last}；世界 {world[sex][last]:.1f}%；台灣 {data['TWN'][last][0]:.1f}%；"
              f"最高 {[(c, round(v, 1)) for v, c in top[:3]]}，最低 {[(c, round(v, 1)) for v, c in top[-3:]]}")

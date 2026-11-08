"""一天的時間怎麼用：休閒、睡眠與無酬家務（2026-11-04，製作手冊第二十一批 345，合併 882、887）。

- OECD Time use（OECD.WISE.INE 的 DSD_TIME_USE@DF_TIME_USE，Gender Data Portal；CC BY 4.0）：35 國，5 大類
  （有酬工作或上學 PAW、無酬工作 UPW、個人照顧 PCA〔含睡眠〕、休閒 LEI、其他 OTH），男女與合計，分鐘／天；
  資料流沒有年份（各國的調查年份不同，OECD 的中繼資料頁 403，查不到），所以這個主題不分年份。
  OBS_STATUS 是 D（Definition differs）的國家，tooltip 寫「定義跟其他國家不同」。有酬工作只寫在附註，不畫地圖。
- Eurostat HETUS 2020 波次（tus_20age，CC BY 4.0；11 國都是 EU、EFTA 或候選國，沒有只准非商業的部分）：
  睡覺（AC01）、上下班通勤（AC910，全人口平均，不是上班族）、看電視（AC821），TIME_SP（全人口平均的時間，
  不是有做的人的時間 PTP_TIME），值是「8:49」這種字串，換成分鐘。2000、2010 波次的分類不同、又有英國（只准非商業），不用。
- OECD How's Life 的 Current well-being（OECD.WISE.WDP 的 DSD_HSL@DF_HSL_CWB；CC BY 4.0）：4_1 Time off（休閒加個人照顧，
  小時／天）、4_4 時間運用滿意度（0–10 分）、7_2 社交互動的時間（小時／週），取各國最近一年，年份寫在 tooltip。
- 台灣：主計總處的時間運用調查只有 2000 與 2004 年，之後沒有再辦，標無資料。
"""
from __future__ import annotations

import gzip

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import oecd
from sources.eurostat import _iso3

OUT = OUT_DIR / "topics" / "time-use"
YEAR = 2026  # 不分年份（timeless）的主題放一個年份
TIME_USE = "OECD.WISE.INE,DSD_TIME_USE@DF_TIME_USE,1.0"
HSL = "OECD.WISE.WDP,DSD_HSL@DF_HSL_CWB,1.0"
HETUS = "https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/tus_20age/?format=TSV&compressed=true"
OECD_MEASURES = {"leisure": "LEI", "personal-care": "PCA", "unpaid-work": "UPW"}
# 2026-11-08（製作手冊第二十七批 653，候選 1431）加打遊戲（電腦、主機、手機遊戲）
HETUS_ACTS = {"sleep": "AC01", "commute": "AC910", "tv": "AC821", "gaming": "AC733-735"}
HSL_MEASURES = {"time-off": "4_1", "time-satisfaction": "4_4", "social-time": "7_2"}
NO_TAIWAN = {"TWN": "台灣的時間運用調查（主計總處）最近一次是 2004 年，之後沒有再辦"}
NO_TAIWAN_EN = {"TWN": "Taiwan’s last time-use survey (DGBAS) was in 2004"}
NAMES = {"PAW": ("有酬工作或上學", "paid work or study"), "UPW": ("無酬工作", "unpaid work"),
         "PCA": ("個人照顧（含睡眠）", "personal care incl. sleep"), "LEI": ("休閒", "leisure"), "OTH": ("其他", "other")}


def _hm(minutes: float) -> str:
    return f"{int(minutes // 60)}:{int(round(minutes % 60)):02d}"


def build() -> None:
    rows = oecd.rows(TIME_USE)
    data: dict[tuple[str, str, str], float] = {}
    differs: set[str] = set()
    for r in rows:
        if r["OBS_VALUE"] and len(r["REF_AREA"]) == 3:
            data[(r["REF_AREA"], r["MEASURE"], r["SEX"])] = float(r["OBS_VALUE"])
            if r["OBS_STATUS"] == "D":
                differs.add(r["REF_AREA"])
    areas = sorted({a for a, _, _ in data})
    hints = {a: "這一國的分類定義跟其他國家不同（OECD 標註）" for a in differs}
    hints_en = {a: "Definitions differ from other countries (OECD flag)" for a in differs}
    notes = {a: "一天 1,440 分鐘：" + "、".join(f"{NAMES[m][0]} {_hm(data[(a, m, '_T')])}" for m in NAMES if (a, m, "_T") in data)
             + "（小時:分）" for a in areas}
    notes_en = {a: "A day’s 1,440 minutes: " + ", ".join(f"{NAMES[m][1]} {_hm(data[(a, m, '_T')])}" for m in NAMES
                                                          if (a, m, "_T") in data) + " (h:mm)" for a in areas}
    for ind, m in OECD_MEASURES.items():
        values = {a: [data[(a, m, "_T")]] for a in areas if (a, m, "_T") in data}
        write_json(OUT / f"{ind}.json", indicator_file(ind, "分鐘／天", [YEAR], values, hints=hints, hintsEn=hints_en,
                                                       notes=notes, notesEn=notes_en, noValue=NO_TAIWAN, noValueEn=NO_TAIWAN_EN))
    gap = {a: [data[(a, "UPW", "F")] - data[(a, "UPW", "M")]] for a in areas if (a, "UPW", "F") in data and (a, "UPW", "M") in data}
    gap_hints = {a: f"女性 {_hm(data[(a, 'UPW', 'F')])}、男性 {_hm(data[(a, 'UPW', 'M')])}" for a in gap}
    gap_hints_en = {a: f"Women {_hm(data[(a, 'UPW', 'F')])}, men {_hm(data[(a, 'UPW', 'M')])}" for a in gap}
    write_json(OUT / "unpaid-gap.json", indicator_file("unpaid-gap", "分鐘／天", [YEAR], gap, hints=gap_hints, hintsEn=gap_hints_en,
                                                       noValue=NO_TAIWAN, noValueEn=NO_TAIWAN_EN))
    print(f"  OECD 時間運用：{len(areas)} 國，定義不同 {sorted(differs)}；休閒 "
          f"{sorted(((data[(a, 'LEI', '_T')], a) for a in areas))[:3]}…{sorted(((data[(a, 'LEI', '_T')], a) for a in areas))[-3:]}")

    path = download(HETUS, "eurostat", "tus_20age.tsv.gz")
    hetus: dict[tuple[str, str], float] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        dims = f.readline().rstrip("\n").split("\t")[0].split("\\")[0].split(",")
        for line in f:
            cells = line.rstrip("\n").split("\t")
            key = dict(zip(dims, cells[0].split(",")))
            if key["sex"] != "T" or key["age"] != "TOTAL" or key["unit"] != "TIME_SP" or key["acl18"] not in HETUS_ACTS.values():
                continue
            iso3, cell = _iso3(key["geo"]), cells[1].strip().split(" ")[0]
            if iso3 and ":" in cell and cell != ":":
                h, mnt = cell.split(":")
                hetus[(iso3, key["acl18"])] = int(h) * 60 + int(mnt)
    for ind, act in HETUS_ACTS.items():
        values = {a: [v] for (a, k), v in sorted(hetus.items()) if k == act}
        write_json(OUT / f"{ind}.json", indicator_file(ind, "分鐘／天", [YEAR], values, noValue=NO_TAIWAN, noValueEn=NO_TAIWAN_EN,
                                                       license="CC BY 4.0"))
        print(f"  HETUS {ind}：{sorted((v[0], a) for a, v in values.items())}")

    hsl = oecd.rows(HSL, ".4_1+4_4+7_2.....")
    latest: dict[tuple[str, str], tuple[int, float]] = {}
    for r in hsl:
        if r["SEX"] != "_T" or r["AGE"] != "_T" or r["EDUCATION_LEV"] != "_T" or not r["OBS_VALUE"] or len(r["REF_AREA"]) != 3:
            continue
        k, y = (r["REF_AREA"], r["MEASURE"]), int(r["TIME_PERIOD"][:4])
        if k not in latest or y > latest[k][0]:
            latest[k] = (y, float(r["OBS_VALUE"]))
    for ind, m in HSL_MEASURES.items():
        picked = {a: yv for (a, k), yv in latest.items() if k == m}
        values = {a: [round(v, 2)] for a, (_, v) in sorted(picked.items())}
        write_json(OUT / f"{ind}.json", indicator_file(
            ind, "", [YEAR], values, hints={a: f"{y} 年的調查" for a, (y, _) in picked.items()},
            hintsEn={a: f"Survey year {y}" for a, (y, _) in picked.items()}, noValue=NO_TAIWAN, noValueEn=NO_TAIWAN_EN))
        print(f"  How's Life {ind}：{len(values)} 國 {sorted((round(v, 2), a, y) for a, (y, v) in picked.items())[:3]}…"
              f"{sorted((round(v, 2), a, y) for a, (y, v) in picked.items())[-3:]}")
    write_json(OUT / "manifest.json", {"topic": "time-use", "generatedAt": now_iso(), "source": "OECD (CC BY 4.0); Eurostat (CC BY 4.0)"})

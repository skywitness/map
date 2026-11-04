"""法定退休年齡與退休後的日子（2026-11-04，製作手冊第二十一批 346）。

- OECD Pensions at a Glance 的資料庫（OECD.ELS.SPD；CC BY 4.0）：
  - DF_DPS：CRPLF22（現在的退休年齡）與 FRPLF22（未來的退休年齡），男女，只有 2024 年。定義是 22 歲進入勞動市場、
    職涯不中斷的人可以領全額年金的年齡，不是各國法條上的年齡，也不是最早可以退休的年齡；沙烏地 47、土耳其 52
    這種低值是因為那些制度看繳費年數，不是年齡。「未來」是今天 22 歲進入勞動市場的人依現行法律退休的年齡。
  - DF_DEC：ELMEA（實際退出勞動市場的平均年齡）與 EYLME（退出後的預期年數），男女，1970 年起；有些國家最近一年很舊
    （印尼、南非、印度只到 2000 年代），設 latestWithin 5 年。OECD、EU27 等合計放 aggregates。
- 台灣不在 OECD 的資料裡：用《勞工保險條例》第 58 條（全國法規資料庫）：保險年資滿 15 年、年滿 60 歲可以請領
  老年年金，2009 年施行後第十年（2018）提高一歲、之後每兩年提高一歲到 65 歲為止，所以 2024 年是 64 歲、2026 年起
  65 歲，男女相同。這是請領老年年金的年齡，跟 OECD 的「領全額年金」最接近；勞動基準法第 54 條的 65 歲是雇主可以
  強制退休的年齡，寫在附註。台灣沒有實際退出年齡的可比數字。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "retirement"
DPS = "OECD.ELS.SPD,DSD_PAG@DF_DPS,1.0"
DEC = "OECD.ELS.SPD,DSD_PAG@DF_DEC,1.0"
SEXES = {"M": "men", "F": "women"}
TAIWAN_NOTE = ("勞工保險條例第 58 條：保險年資滿 15 年、年滿 60 歲可以請領老年年金，2018 年起逐步提高，2024 年 64 歲、"
               "2026 年起 65 歲（男女相同）；勞動基準法第 54 條的 65 歲是雇主可以強制退休的年齡。台灣不在 OECD 的資料裡，"
               "定義不完全相同",
               "Labour Insurance Act, Art. 58: an old-age pension can be claimed at 60 with 15 years of contributions, rising "
               "from 2018 to 64 in 2024 and 65 from 2026 (same for women and men); the 65 in Art. 54 of the Labour Standards Act "
               "is the age at which employers may require retirement. Taiwan is not in the OECD data, so definitions differ somewhat")


def build() -> None:
    rows = oecd.rows(DPS)
    for measure, ind, tw in (("CRPLF22", "retirement-age", 64), ("FRPLF22", "future-retirement-age", 65)):
        for sex, item in SEXES.items():
            values, aggregates = {}, {}
            for r in rows:
                if r["MEASURE"] != measure or r["SEX"] != sex or not r["OBS_VALUE"]:
                    continue
                iso3 = to_iso3(r["REF_AREA"])
                (values if iso3 else aggregates)[iso3 or r["REF_AREA"]] = [float(r["OBS_VALUE"])]
            values["TWN"] = [tw]
            write_json(OUT / f"{ind}-{item}.json", indicator_file(
                f"{ind}-{item}", "歲", [2024], values, aggregates=aggregates,
                notes={"TWN": TAIWAN_NOTE[0]}, notesEn={"TWN": TAIWAN_NOTE[1]}))
            print(f"  {ind}-{item}：{len(values)} 國，{sorted((v[0], c) for c, v in values.items())[:4]}…"
                  f"{sorted((v[0], c) for c, v in values.items())[-4:]}；合計 {aggregates}")
    dec = oecd.rows(DEC)
    for measure, ind in (("ELMEA", "exit-age"), ("EYLME", "years-after-exit")):
        for sex, item in SEXES.items():
            series: dict[str, dict[int, float]] = {}
            groups: dict[str, dict[int, float]] = {}
            for r in dec:
                if r["MEASURE"] != measure or r["SEX"] != sex or r["AGE"] != "_Z" or not r["OBS_VALUE"]:
                    continue
                y = int(r["TIME_PERIOD"][:4])
                if y > 2030:  # 2054、2065、2084 的推估不收
                    continue
                iso3 = to_iso3(r["REF_AREA"])
                (series.setdefault(iso3, {}) if iso3 else groups.setdefault(r["REF_AREA"], {}))[y] = float(r["OBS_VALUE"])
            years = sorted({y for s in series.values() for y in s})
            write_json(OUT / f"{ind}-{item}.json", indicator_file(
                f"{ind}-{item}", "歲" if measure == "ELMEA" else "年", years,
                {c: to_series(s, years, 1) for c, s in sorted(series.items())},
                aggregates={g: to_series(s, years, 1) for g, s in groups.items()}, latestWithin=5,
                noValue={"TWN": "台灣沒有可以跟 OECD 比較的實際退出勞動市場年齡"},
                noValueEn={"TWN": "No figure for Taiwan comparable with the OECD’s effective exit age"}))
            last = {c: (max(s), s[max(s)]) for c, s in series.items()}
            print(f"  {ind}-{item}：{len(series)} 國，{years[0]}–{years[-1]}；最近一年舊的 {sorted((y, c) for c, (y, _) in last.items())[:5]}；"
                  f"{sorted((v, c) for c, (y, v) in last.items() if y >= 2020)[:4]}…{sorted((v, c) for c, (y, v) in last.items() if y >= 2020)[-4:]}")
    write_json(OUT / "manifest.json", {"topic": "retirement", "generatedAt": now_iso(), "source": "OECD Pensions at a Glance (CC BY 4.0)"})

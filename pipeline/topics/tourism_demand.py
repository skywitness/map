"""觀光：歐洲人怎麼旅遊（2026-11-04，製作手冊第二十一批 352–356）。

Eurostat 的觀光需求調查（居民一夜以上的私人與公務旅次，CC BY 4.0；geo 都是 EU、EFTA 與候選國，沒有英國），
2012 年起（不旅遊的原因只有 2013、2015、2019、2022、2025 年）。全部用 purpose = TOTAL、duration = N_GE1（一夜以上）。
- 352 住哪裡（tour_dem_ttac，c_dest = WORLD）：最多旅次用的住宿方式（類別）、住旅館的比例、不用付錢的住宿（自有度假屋、
  親友家）的比例。
- 353 待幾天（tour_dem_ttls）：4 夜以上的旅次占全部的比例，國內（DOM）與出國（FOR）分開。
- 354 沒有去旅遊（tour_dem_npsex，sex = T）：一年沒有一夜以上個人旅遊的人口比例（PC_POP），最主要的原因
  （沒旅遊的人裡比例最高的原因，PC_POP_NPT；「其他」不算）。
- 355 怎麼去、怎麼訂：出國旅次搭飛機的比例（tour_dem_tttr，c_dest = FOR）、出國旅次跟團（包套）的比例與網路訂的比例
  （tour_dem_ttpw，c_dest = FOR，2020 年起）。
- 356 一年幾趟、幾夜、花多少：每個居民一年的旅次（國內加出國，tour_dem_tttot ÷ UN WPP 人口）與出國旅次、
  旅遊參與率（tour_dem_tosex 的 PC_POP，c_dest = WORLD）、出國每趟平均夜數（tour_dem_tntot ÷ tttot）、
  出國每趟平均花費（tour_dem_extot 的 AVG_TRP、TOTXDUR，歐元）。
台灣：
- 交通部觀光署「歷年國人旅遊狀況調查」（政府資料開放授權條款）的逐筆樣本：各年的變數名稱不一樣，開放資料只有變數名稱、
  沒有選項代碼的說明，所以只用 2024 年（113 年）出國樣本旅次裡能從資料本身確定意義的兩題：停留夜數（vq21a，數字）
  與出境交通工具（vq22，1 是飛機：填了子題「搭乘的飛機」的幾乎都是 1），用出國樣本旅次權數 w 加權。
- 「歷年國人出國旅遊重要指標統計表」：出國人次 ÷ 人口、平均停留夜數。出國人次含一日來回，平均夜數是全部出國人次的平均。
- 住宿方式、跟團、網路訂購的選項代碼說明不在開放資料裡，不算；不旅遊的原因調查沒有問，標明沒有。
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, to_series, write_json
from sources import wpp
from topics.tourism_flows import _geo, eurostat

OUT = OUT_DIR / "topics" / "tourism"
SURVEY_URL = "https://media.taiwan.net.tw/od/01_PRD/%E6%AD%B7%E5%B9%B4%E5%9C%8B%E4%BA%BA%E6%97%85%E9%81%8A%E7%8B%80%E6%B3%81%E8%AA%BF%E6%9F%A5.zip"
KEY_URL = "https://media.taiwan.net.tw/od/01_PRD/%E5%9C%8B%E4%BA%BA%E5%87%BA%E5%9C%8B%E6%97%85%E9%81%8A%E9%87%8D%E8%A6%81%E6%8C%87%E6%A8%99%E7%B5%B1%E8%A8%88%E8%A1%A8.csv"
ACCOMMOD = {"R_HOT": 1, "R_APT": 2, "R_CAMP": 3, "NR_OWN": 4, "NR_RF": 5, "R_OTH": 6, "NR_OTH": 6}
REASONS = {"FIN": 1, "HLTH": 2, "LTIME_WRK_STU": 3, "LTIME_FAM": 4, "NINT": 5, "SAFE": 6}
TW_SURVEY_YEAR = 2024


def _series(ds: str, value_key: dict[str, str], **fixed: str) -> dict[str, dict[int, float]]:
    """依 fixed 篩選、以 value_key 的維度值當分組（回傳 {分組值: {iso3: {年: 值}}} 的扁平版用 key 'iso3|分組'）"""
    _, _, rows = eurostat(ds)
    out: dict[str, dict[int, float]] = defaultdict(dict)
    for key, vals in rows:
        if any(key.get(k) != v for k, v in fixed.items()):
            continue
        iso3 = _geo(key["geo"])
        if not iso3:
            continue
        group = "|".join(key[d] for d in value_key) if value_key else ""
        for p, v in vals.items():
            out[f"{iso3}|{group}"][int(p[:4])] = v
    return out


def _split(flat: dict[str, dict[int, float]]) -> dict[str, dict[str, dict[int, float]]]:
    out: dict[str, dict[str, dict[int, float]]] = defaultdict(dict)
    for k, s in flat.items():
        iso3, group = k.split("|", 1)
        out[iso3][group] = s
    return out


def _ratio(num: dict[str, dict[int, float]], den: dict[str, dict[int, float]], scale: float = 100) -> dict[str, dict[int, float]]:
    return {c: {y: v / den[c][y] * scale for y, v in s.items() if den.get(c, {}).get(y)} for c, s in num.items()}


def _taiwan_survey() -> dict[str, float]:
    z = zipfile.ZipFile(download(SURVEY_URL, "twtourism", "survey.zip"))
    name = next(n for n in z.namelist() if re.match(rf"^{TW_SURVEY_YEAR - 1911}.*出國.*旅次\.csv$", n))
    rows = list(csv.DictReader(io.StringIO(z.read(name).decode("utf-8-sig"))))
    # 確認 vq22 = 1 是飛機：填了子題「搭乘的飛機」（vq22_1）的幾乎都是 1（2024 年 3,107 筆裡 3 筆沒填、別的代碼 3 筆有填）
    consistent = sum(1 for r in rows if (r["vq22"] == "1") == bool(r["vq22_1"].strip()))
    if consistent < len(rows) * 0.98:
        raise RuntimeError("國人旅遊狀況調查的 vq22 代碼跟預期不同")
    w = sum(float(r["w"]) for r in rows)
    long = sum(float(r["w"]) for r in rows if int(r["vq21a"]) >= 4)
    air = sum(float(r["w"]) for r in rows if r["vq22"] == "1")
    return {"long": long / w * 100, "air": air / w * 100, "n": len(rows)}


def _taiwan_key() -> dict[int, dict[str, float]]:
    rows = list(csv.reader(open(download(KEY_URL, "twtourism", "key.csv"), encoding="utf-8-sig")))
    out = {}
    for r in rows[1:]:
        if not r[0].strip().isdigit():
            continue
        y = int(r[0]) + 1911
        out[y] = {"trips": float(r[1].replace(",", "")), "nights": float(r[2])}
    return out


def _write(name: str, unit: str, data: dict[str, dict[int, float]], digits: int, years: list[int], **extra) -> None:
    write_json(OUT / f"{name}.json", indicator_file(name, unit, years, {c: to_series(s, years, digits) for c, s in sorted(data.items()) if s}, **extra))


def build() -> None:
    base = dict(purpose="TOTAL", duration="N_GE1", unit="NR")
    # 352 住宿
    acc = _split(_series("tour_dem_ttac", ["accommod"], c_dest="WORLD", **base))
    main: dict[str, dict[int, float]] = defaultdict(dict)
    hotel: dict[str, dict[int, float]] = defaultdict(dict)
    free: dict[str, dict[int, float]] = defaultdict(dict)
    acc_hints, acc_hints_en = {}, {}
    for c, groups in acc.items():
        for y, total in groups.get("TOTAL", {}).items():
            if not total:
                continue
            shares = defaultdict(float)
            for code, cat in ACCOMMOD.items():
                shares[cat] += groups.get(code, {}).get(y, 0)
            if sum(shares.values()) < total * 0.5:
                continue
            main[c][y] = max(shares, key=lambda k: shares[k])
            hotel[c][y] = groups.get("R_HOT", {}).get(y, 0) / total * 100
            if "TOT_NR" in groups and y in groups["TOT_NR"]:
                free[c][y] = groups["TOT_NR"][y] / total * 100
    no_tw_acc = {"TWN": "台灣的國人旅遊狀況調查有問住宿方式，但開放資料沒有選項代碼的說明，沒有算"}
    no_tw_acc_en = {"TWN": "Taiwan’s travel survey asks about accommodation, but the open data lacks the code labels, so it is not computed"}
    years = sorted({y for s in main.values() for y in s})
    _write("main-accommodation", "類別", main, 0, years, noValue=no_tw_acc, noValueEn=no_tw_acc_en)
    _write("hotel-share", "%", hotel, 1, years, noValue=no_tw_acc, noValueEn=no_tw_acc_en)
    _write("free-accommodation-share", "%", free, 1, years, noValue=no_tw_acc, noValueEn=no_tw_acc_en)
    # 353 待幾天
    tw = _taiwan_survey()
    for dest, name in (("DOM", "long-trips-domestic"), ("FOR", "long-trips-abroad")):
        dur = _split(_series("tour_dem_ttls", ["duration"], c_dest=dest, purpose="TOTAL", unit="NR"))
        share = {c: {y: g["N_GE4"][y] / g["N_GE1"][y] * 100 for y in g.get("N_GE4", {}) if g.get("N_GE1", {}).get(y)} for c, g in dur.items()}
        extra = {}
        if dest == "FOR":
            share["TWN"] = {TW_SURVEY_YEAR: tw["long"]}
            extra = dict(notes={"TWN": f"交通部觀光署 {TW_SURVEY_YEAR} 年國人旅遊狀況調查的出國樣本旅次（{tw['n']:,} 筆，加權）"},
                         notesEn={"TWN": f"Tourism Administration travel survey, {TW_SURVEY_YEAR} outbound trip sample ({tw['n']:,} trips, weighted)"})
        else:
            extra = dict(noValue={"TWN": "台灣的國內旅遊多半是一日遊，這一題只算了出國"},
                         noValueEn={"TWN": "Only trips abroad were computed for Taiwan"})
        yrs = sorted({y for s in share.values() for y in s})
        _write(name, "%", share, 1, yrs, **extra)
    # 354 沒有去旅遊
    np_ = _split(_series("tour_dem_npsex", ["reason", "unit"], sex="T"))
    no_trip: dict[str, dict[int, float]] = defaultdict(dict)
    reason: dict[str, dict[int, float]] = defaultdict(dict)
    for c, g in np_.items():
        for y, v in g.get("TOTAL|PC_POP", {}).items():
            no_trip[c][y] = v
            cand = {cat: g.get(f"{code}|PC_POP_NPT", {}).get(y) for code, cat in REASONS.items()}
            cand = {k: v for k, v in cand.items() if v is not None}
            if cand:
                reason[c][y] = max(cand, key=lambda k: cand[k])
    no_tw = {"TWN": "台灣的國人旅遊狀況調查只問有旅遊的人，沒有問沒去旅遊的原因"}
    no_tw_en = {"TWN": "Taiwan’s travel survey does not ask why people did not travel"}
    yrs = sorted({y for s in no_trip.values() for y in s})
    _write("no-trip", "%", no_trip, 1, yrs, noValue=no_tw, noValueEn=no_tw_en)
    _write("no-trip-reason", "類別", reason, 0, yrs, noValue=no_tw, noValueEn=no_tw_en)
    # 355 怎麼去、怎麼訂
    tr = _split(_series("tour_dem_tttr", ["tra_mode"], c_dest="FOR", **base))
    air = {c: {y: g["AIR"][y] / g["TOTAL"][y] * 100 for y in g.get("AIR", {}) if g.get("TOTAL", {}).get(y)} for c, g in tr.items()}
    air["TWN"] = {TW_SURVEY_YEAR: tw["air"]}
    yrs = sorted({y for s in air.values() for y in s})
    _write("air-share-abroad", "%", air, 1, yrs,
           notes={"TWN": f"交通部觀光署 {TW_SURVEY_YEAR} 年國人旅遊狀況調查的出國樣本旅次（加權）"},
           notesEn={"TWN": f"Tourism Administration travel survey, {TW_SURVEY_YEAR} outbound trips (weighted)"})
    pw = _split(_series("tour_dem_ttpw", ["trip_arr", "yn_web"], c_dest="FOR", **base))
    pack = {c: {y: g["PACK|TOTAL"][y] / g["TOTAL|TOTAL"][y] * 100 for y in g.get("PACK|TOTAL", {}) if g.get("TOTAL|TOTAL", {}).get(y)} for c, g in pw.items()}
    web = {c: {y: g["TOTAL|YES_WEB"][y] / g["TOTAL|TOTAL"][y] * 100 for y in g.get("TOTAL|YES_WEB", {}) if g.get("TOTAL|TOTAL", {}).get(y)} for c, g in pw.items()}
    no_tw_pw = {"TWN": "台灣的國人旅遊狀況調查有問安排方式與網路訂購，但開放資料沒有選項代碼的說明，沒有算"}
    no_tw_pw_en = {"TWN": "Taiwan’s travel survey asks about package tours and online booking, but the open data lacks the code labels"}
    yrs = sorted({y for s in pack.values() for y in s})
    _write("package-share-abroad", "%", pack, 1, yrs, noValue=no_tw_pw, noValueEn=no_tw_pw_en)
    _write("web-booked-abroad", "%", web, 1, yrs, noValue=no_tw_pw, noValueEn=no_tw_pw_en)
    # 356 一年幾趟、幾夜、花多少
    pop = wpp.demographic(["TPopulation1July"], last_year=2025)["TPopulation1July"]
    trips = _split(_series("tour_dem_tttot", ["c_dest"], **base))
    nights = _split(_series("tour_dem_tntot", ["c_dest"], **base))
    per_res, abroad_per_res, nights_abroad = defaultdict(dict), defaultdict(dict), defaultdict(dict)
    for c, g in trips.items():
        for y, v in g.get("WORLD", {}).items():
            if pop.get(c, {}).get(y):
                per_res[c][y] = v / (pop[c][y] * 1000)
        for y, v in g.get("FOR", {}).items():
            if pop.get(c, {}).get(y):
                abroad_per_res[c][y] = v / (pop[c][y] * 1000)
            n = nights.get(c, {}).get("FOR", {}).get(y)
            if n and v:
                nights_abroad[c][y] = n / v
    key = _taiwan_key()
    for y, k in key.items():
        if pop.get("TWN", {}).get(y):
            abroad_per_res["TWN"][y] = k["trips"] / (pop["TWN"][y] * 1000)
        nights_abroad["TWN"][y] = k["nights"]
    tw_trip_note = ("交通部觀光署「國人出國旅遊重要指標統計表」：出國人次（含一日來回）與平均停留夜數；歐洲是一夜以上的出國旅次",
                    "Tourism Administration key outbound indicators: departures (including same-day trips) and average nights; European figures are trips of one night or more")
    part = _split(_series("tour_dem_tosex", ["c_dest", "unit"], duration="N_GE1", sex="T"))
    participation = {c: g.get("WORLD|PC_POP", {}) for c, g in part.items() if g.get("WORLD|PC_POP")}
    spend_rows = _split(_series("tour_dem_extot", ["statinfo", "expend"], purpose="TOTAL", duration="N_GE1", c_dest="FOR", unit="EUR"))
    spend = {c: g.get("AVG_TRP|TOTXDUR", {}) for c, g in spend_rows.items() if g.get("AVG_TRP|TOTXDUR")}
    yrs = sorted({y for s in per_res.values() for y in s} | {y for s in abroad_per_res.values() for y in s if y >= 2012})
    _write("trips-per-resident", "趟／人", per_res, 2, yrs,
           noValue={"TWN": "台灣的國內旅遊次數是調查估計的旅次，含一日遊，跟歐洲的一夜以上旅次不能比"},
           noValueEn={"TWN": "Taiwan’s domestic trips include day trips, not comparable with Europe’s overnight trips"})
    _write("trips-abroad-per-resident", "趟／人", {c: {y: v for y, v in s.items() if y >= 2012} for c, s in abroad_per_res.items()}, 2, yrs,
           notes={"TWN": tw_trip_note[0]}, notesEn={"TWN": tw_trip_note[1]})
    _write("nights-per-trip-abroad", "夜", {c: {y: v for y, v in s.items() if y >= 2012} for c, s in nights_abroad.items()}, 1, yrs,
           notes={"TWN": tw_trip_note[0]}, notesEn={"TWN": tw_trip_note[1]})
    _write("participation", "%", participation, 1, yrs,
           noValue={"TWN": "台灣的國人旅遊狀況調查有國內旅遊比率，但含一日遊，跟歐洲的一夜以上不同"},
           noValueEn={"TWN": "Taiwan’s survey reports a travel rate that includes day trips, unlike Europe’s overnight measure"})
    _write("spend-per-trip-abroad", "歐元", spend, 0, yrs,
           noValue={"TWN": "台灣的出國花費（每人每次 47,802 元，2019 年）含國際機票，歐洲的不含耐久財、算法不同，沒有換成歐元比較"},
           noValueEn={"TWN": "Taiwan’s outbound spending per trip (NT$47,802 in 2019) is defined differently, so it is not converted for comparison"})
    y = 2025
    def show(d, k=y):
        return sorted(((round(s[k], 1), c) for c, s in d.items() if k in s), reverse=True)
    print(f"  住宿 {y}：旅館比例 {show(hotel)[:5]}…{show(hotel)[-3:]}；最多的類別 {sorted((c, s[y]) for c, s in main.items() if y in s)}")
    print(f"  台灣 2024：4 夜以上 {tw['long']:.1f}%、搭飛機 {tw['air']:.1f}%（{tw['n']} 筆）")
    print(f"  沒旅遊 {y}：{show(no_trip)[:6]}…{show(no_trip)[-5:]}；原因 {sorted((c, s[y]) for c, s in reason.items() if y in s)}")
    print(f"  出國搭飛機 {y}：{show(air)[:6]}…{show(air)[-4:]}")
    print(f"  跟團 {y}：{show(pack)[:6]}…{show(pack)[-4:]}；網路 {show(web)[:5]}")
    print(f"  每人旅次 {y}：{show(per_res)[:5]}…{show(per_res)[-3:]}；出國 {show(abroad_per_res)[:5]}；參與率 {show(participation)[:3]}…{show(participation)[-3:]}")
    print(f"  出國夜數 {y}：{show(nights_abroad)[:4]}…{show(nights_abroad)[-3:]}；台灣 {nights_abroad['TWN'].get(2019)}；花費 {show(spend)[:4]}…{show(spend)[-3:]}")

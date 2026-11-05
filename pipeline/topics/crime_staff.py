"""警察、法官與監所管理員（2026-11-05，製作手冊第二十二批 390；步驟 crime-staff，輸出 topics/crime/，
前端 src/topics/justice-staff.ts 併在「各國治安與司法」）。

- Eurostat crim_just_job（CC BY 4.0）：isco08 = OC5412（警察）、OC2612A（職業法官）、PRISA（成人監所管理員）、
  PRISJ（少年矯正機構職員），2008–2024，unit = P_HTHAB（每十萬人）與 NR（人數），sex = T／F／M。
- Eurostat 的條款：歐盟、EFTA、候選國以外只准非商業使用，英國各地區（UKC-L、UKM、UKN）與科索沃（潛在候選國）不收。
  這個資料集沒有喬治亞。
- ISCO-08 5412 只算「police officers」這個職業，憲兵（義大利的 Carabinieri、法國的 Gendarmerie）、邊防等各國歸類不同；
  多國最新的年份很舊（塞爾維亞 2015、北馬其頓 2017、挪威 2014），用 latestWithin，tooltip 寫年份。
- 女性比例 = 女性人數 ÷ 合計人數（同一年都有的年份）。
- 少年矯正機構職員各國的範圍差很多（波蘭、瑞典每十萬人 40 多，其他國家個位數），只放側欄、不畫地圖。
- UNODC 的全球警察人數不准轉載與改作，不用；台灣沒有找到警察、法官、監所管理員人數的開放資料，不畫。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, to_series, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "crime"
EXCLUDED = {"XKX"}  # 英國各地區是 UKC-L 這類代碼，series() 不收（不在 extra_geos）
WITHIN = 10
OCCUPATIONS = {"police": "OC5412", "judges": "OC2612A", "prison-staff": "PRISA", "juvenile-staff": "PRISJ"}
MAPPED = ("police", "judges", "prison-staff")
NO_TW = {
    "zh": "Eurostat 只有歐洲；台灣的警察、法官、監所管理員人數沒有找到開放資料",
    "en": "Eurostat covers Europe only; no open data found for Taiwan",
}


def _series(occupation: str, sex: str, unit: str) -> dict[str, dict[int, float]]:
    data = eurostat.series("crim_just_job", freq="A", isco08=occupation, sex=sex, unit=unit)
    return {c: s for c, s in data.items() if c not in EXCLUDED}


def build() -> None:
    detail: dict[str, dict[str, list]] = {}
    for key, code in OCCUPATIONS.items():
        rate = _series(code, "T", "P_HTHAB")
        total = _series(code, "T", "NR")
        female = _series(code, "F", "NR")
        share = {
            c: {y: female[c][y] / t[y] * 100 for y in t if y in female.get(c, {}) and t[y] > 0}
            for c, t in total.items()
        }
        share = {c: s for c, s in share.items() if s}
        for c, s in rate.items():
            y = max(s)
            sh = share.get(c, {})
            sy = max((yy for yy in sh if yy <= y), default=None)
            # [年, 每十萬人, 人數, 女性比例（%）, 女性比例的年份]
            detail.setdefault(c, {})[key] = [
                y, round(s[y], 2), total.get(c, {}).get(y), None if sy is None else round(sh[sy], 1), sy,
            ]
        if key not in MAPPED:
            print(f"  {key}（只放側欄）：{len(rate)} 國")
            continue
        years = latest_year_span(rate, WITHIN)
        write_json(OUT / "staff" / f"{key}.json", indicator_file(
            f"staff-{key}", "人/十萬人", years, {c: to_series(s, years, 2) for c, s in sorted(rate.items())},
            latestWithin=WITHIN, noValue={"TWN": NO_TW["zh"]}, noValueEn={"TWN": NO_TW["en"]},
        ), quiet=True)
        share_years = latest_year_span(share, WITHIN)
        write_json(OUT / "staff-female" / f"{key}.json", indicator_file(
            f"staff-female-{key}", "%", share_years, {c: to_series(s, share_years, 1) for c, s in sorted(share.items())},
            latestWithin=WITHIN, noValue={"TWN": NO_TW["zh"]}, noValueEn={"TWN": NO_TW["en"]},
        ), quiet=True)
        latest = sorted(((c, max(s), s[max(s)]) for c, s in rate.items()), key=lambda t: -t[2])
        latest_share = sorted(((c, max(s), s[max(s)]) for c, s in share.items()), key=lambda t: -t[2])
        print(f"  {key}：{len(rate)} 國 {years[0]}–{years[-1]}；最多 {[(c, y, round(v, 1)) for c, y, v in latest[:6]]}；"
              f"最少 {[(c, y, round(v, 1)) for c, y, v in latest[-4:]]}；女性比例 {len(share)} 國，"
              f"最高 {[(c, y, round(v, 1)) for c, y, v in latest_share[:4]]}，最低 {[(c, y, round(v, 1)) for c, y, v in latest_share[-3:]]}")
    write_json(OUT / "staff-detail.json", detail)

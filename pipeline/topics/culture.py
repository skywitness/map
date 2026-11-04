"""文化：電影院、文化工作者、遺產保存的公共支出（2026-11-04，製作手冊第二十一批 371、374、375）。

UNESCO 統計研究所（UIS）的公開 API（https://api.uis.unesco.org/api/public/data/indicators?indicator=…，免登入免金鑰；
UIS 資料是 CC BY-SA 4.0，資料檔同樣授權，見 DESIGN.md 第 8 節第 115 點）：
- 371 220174「Total number of indoor cinemas」：室內電影院家數，1995–2017（之後 UIS 沒有再收）；每十萬人用 UN WPP。
- 374 CE.RA.CULOCC1.1.OV.ILOSTAT.1：文化職業的就業人數占總就業的比例（UIS 依 ILOSTAT 的職業分類算），2010–2016。
- 375 HEXPCSTPPPCAP.HER.PU：每人花在文化與自然遺產保存的公共支出（購買力平價美元，固定價格），2017–2024。
年份很零散，資料檔設 latestWithin。台灣都不在 UIS 裡：電影院等本機 session 從文化部統計下載，文化工作者、遺產支出沒有。
"""
from __future__ import annotations

import json

from common import OUT_DIR, download, indicator_file, to_series, write_json
from sources import wpp
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "culture"
URL = "https://api.uis.unesco.org/api/public/data/indicators?indicator={}"


def _uis(code: str) -> dict[str, dict[int, float]]:
    data = json.loads(download(URL.format(code), "uis", f"{code}.json").read_text(encoding="utf-8"))
    out: dict[str, dict[int, float]] = {}
    for r in data["records"]:
        iso3 = to_iso3(r["geoUnit"])
        if iso3 and r["value"] is not None:
            out.setdefault(iso3, {})[int(r["year"])] = float(r["value"])
    return out


def build() -> None:
    cinemas = _uis("220174")
    years = sorted({y for s in cinemas.values() for y in s})
    pop = wpp.demographic(["TPopulation1July"], last_year=max(years))["TPopulation1July"]
    per100k = {c: {y: v / pop[c][y] * 100 for y, v in s.items() if pop.get(c, {}).get(y)} for c, s in cinemas.items()}
    tw = {"TWN": "台灣不在 UNESCO 的資料裡；文化部統計的電影院家數還在整理"}
    tw_en = {"TWN": "Taiwan is not in the UNESCO data; Ministry of Culture cinema counts have not been added yet"}
    write_json(OUT / "cinemas.json", indicator_file("cinemas", "家", years, {c: to_series(s, years, 0) for c, s in sorted(cinemas.items())},
                                                    latestWithin=10, noValue=tw, noValueEn=tw_en, license="CC BY-SA 4.0"))
    write_json(OUT / "cinemas-per-100k.json", indicator_file(
        "cinemas-per-100k", "家／十萬人", years, {c: to_series(s, years, 2) for c, s in sorted(per100k.items()) if s},
        latestWithin=10, noValue=tw, noValueEn=tw_en, license="CC BY-SA 4.0"))
    jobs = _uis("CE.RA.CULOCC1.1.OV.ILOSTAT.1")
    jy = sorted({y for s in jobs.values() for y in s})
    no_tw = {"TWN": "台灣不在 UNESCO 的資料裡"}
    no_tw_en = {"TWN": "Taiwan is not in the UNESCO data"}
    write_json(OUT / "culture-jobs.json", indicator_file("culture-jobs", "%", jy, {c: to_series(s, jy, 2) for c, s in sorted(jobs.items())},
                                                         latestWithin=7, noValue=no_tw, noValueEn=no_tw_en, license="CC BY-SA 4.0"))
    heritage = _uis("HEXPCSTPPPCAP.HER.PU")
    hy = sorted({y for s in heritage.values() for y in s})
    write_json(OUT / "heritage-spending.json", indicator_file(
        "heritage-spending", "購買力平價美元／人", hy, {c: to_series(s, hy, 2) for c, s in sorted(heritage.items())},
        latestWithin=8, noValue=no_tw, noValueEn=no_tw_en, license="CC BY-SA 4.0"))
    write_json(OUT / "manifest.json", {"topic": "culture", "source": "UNESCO Institute for Statistics (CC BY-SA 4.0)"})
    def last(d):
        return sorted(((round(s[max(s)], 2), c, max(s)) for c, s in d.items() if s), reverse=True)
    print(f"  電影院：{len(cinemas)} 國，{years[0]}–{years[-1]}；每十萬人 {last(per100k)[:8]}…{last(per100k)[-4:]}")
    print(f"  家數 {last(cinemas)[:6]}；美國 {cinemas.get('USA', {}).get(max(cinemas.get('USA', {0: 0})))}")
    print(f"  文化工作者：{len(jobs)} 國，{jy[0]}–{jy[-1]}；{last(jobs)[:6]}…{last(jobs)[-4:]}")
    print(f"  遺產支出：{len(heritage)} 國，{hy[0]}–{hy[-1]}；{last(heritage)[:6]}…{last(heritage)[-4:]}")

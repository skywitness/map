"""多少人靠水吃飯：漁業與養殖的就業人數（2026-11-07，製作手冊第二十七批 550，候選 1238；擴充「海洋與漁業」；
步驟 fish-jobs，輸出 topics/oceans/）。

資料：FAO FishStat 的就業資料（FI_Employment_2026.1.0.zip，https://www.fao.org/fishery/static/Data/ ，免登入；
FishStat 的 API 清單沒有列這個資料集，但靜態路徑在）。授權 CC BY 4.0（zip 裡 ReadMe.txt 的 TERMS OF USE 段，跟產量的
GlobalProduction 同一段）。主表 EMPLOY_NUMBER.csv：國家 × 工作場域（A 養殖、I 內陸捕撈、C 海洋沿岸、D 遠洋、M 海洋其他、
U 未分）× 全職／兼職／臨時／不明 × 性別（F、M、U）× 年（1995–2024），人數。手冊寫的加工（P）與自給（S）代碼表有、資料裡沒有。
國家照產量（sources/fishstat.py）的做法：代碼表的 ISO3，桑吉巴併進坦尚尼亞，已不存在的國家不放。

- FAO 已經替缺報的年份估了值（STATUS I＝imputed、E＝estimated，2024 年約一半的列）：照 FAO 的數字用，這裡不再內插；
  印度 2022–2024 年都是 16,867,624（同一個估計值）。
- 女性比例只算有寫性別的人（F÷(F＋M)），有寫性別的不到全國的一半時不放。
- 每千人：除以 WPP 2024 的年中人口（跟人均漁業產量同一份）。
輸出 fish-jobs/<子項目>.json（total、aquaculture、inland、marine）、fish-jobs-per-1000.json、fish-women.json、
fish-jobs-detail.json（側欄：最新一年各工作場域依性別、全職兼職的組成）。
"""
from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict

from common import download, indicator_file, write_json
from sources import fishstat, wpp
from sources.countries import to_iso3
from topics.oceans import OUT

URL = "https://www.fao.org/fishery/static/Data/FI_Employment_2026.1.0.zip"
ITEMS = {"total": None, "aquaculture": {"A"}, "inland": {"I"}, "marine": {"C", "D", "M"}}
AREAS = ["A", "I", "C", "D", "M", "U"]
MIN_GENDER_SHARE = 0.5


def _rows(z: zipfile.ZipFile, name: str):
    with z.open(name) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig", newline=""))


def build() -> None:
    path = download(URL, "fishstat", URL.rsplit("/", 1)[1])
    with zipfile.ZipFile(path) as z:
        iso_of: dict[str, str | None] = {}
        for r in _rows(z, "CL_FI_COUNTRY_GROUPS.csv"):
            iso_of[r["UN_Code"]] = to_iso3(r["ISO3_Code"])
        iso_of.update(fishstat.MERGE)
        # {(iso3, 年): {(場域, 職別, 性別): 人}}
        data: dict[tuple[str, int], dict[tuple[str, str, str], float]] = defaultdict(lambda: defaultdict(float))
        skipped: set[str] = set()
        for r in _rows(z, "EMPLOY_NUMBER.csv"):
            code = r["COUNTRY.UN_CODE"]
            iso = iso_of.get(code)
            if not iso:
                skipped.add(code)
                continue
            if not r["VALUE"]:
                continue
            data[(iso, int(r["PERIOD"]))][(r["WORKAREA.CODE"], r["OCCUPATION.CODE"], r["GENDER.CODE"])] += float(r["VALUE"])
    years = sorted({y for _c, y in data})
    countries = sorted({c for c, _y in data})
    population = wpp.demographic(["TPopulation1July"], last_year=years[-1])["TPopulation1July"]

    def series(fn) -> dict[str, list[float | None]]:
        out = {}
        for c in countries:
            s = [fn(data[(c, y)]) if (c, y) in data else None for y in years]
            if any(v is not None for v in s):
                out[c] = s
        return out

    def total(cells, areas=None) -> float:
        return sum(v for (a, _o, _g), v in cells.items() if areas is None or a in areas)

    world = {}
    for item, areas in ITEMS.items():
        vals = series(lambda cells, areas=areas: round(total(cells, areas)))
        world[item] = [sum(vals[c][i] or 0 for c in vals) for i in range(len(years))]
        write_json(OUT / "fish-jobs" / f"{item}.json", indicator_file(
            f"fish-jobs/{item}", "人", years, vals, aggregates={"WLD": world[item]}, license="CC BY 4.0"), quiet=True)

    def per_1000(c: str, i: int) -> float | None:
        cells = data.get((c, years[i]))
        pop = population.get(c, {}).get(years[i])
        return round(total(cells) / pop, 2) if cells and pop else None  # WPP 的人口是千人

    per = {c: [per_1000(c, i) for i in range(len(years))] for c in countries}
    per = {c: s for c, s in per.items() if any(v is not None for v in s)}
    write_json(OUT / "fish-jobs-per-1000.json", indicator_file("fish-jobs-per-1000", "人／千人", years, per, license="CC BY 4.0"))

    def women(cells) -> float | None:
        f = sum(v for (_a, _o, g), v in cells.items() if g == "F")
        m = sum(v for (_a, _o, g), v in cells.items() if g == "M")
        t = total(cells)
        return round(f / (f + m) * 100, 1) if t and (f + m) >= MIN_GENDER_SHARE * t else None

    write_json(OUT / "fish-women.json", indicator_file("fish-women", "%", years, series(women), license="CC BY 4.0"))

    detail = {}
    for c in countries:
        y = max((y for cc, y in data if cc == c), default=None)
        if y is None:
            continue
        cells = data[(c, y)]
        by_area = []
        for a in AREAS:
            n = total(cells, {a})
            if n:
                by_area.append([a, round(n), round(sum(v for (aa, _o, g), v in cells.items() if aa == a and g == "F")),
                                round(sum(v for (aa, _o, g), v in cells.items() if aa == a and g == "M"))])
        occ = {o: round(sum(v for (_a, oo, _g), v in cells.items() if oo == o)) for o in ("1", "2", "3", "4")}
        detail[c] = {"year": y, "areas": by_area, "occ": [occ["1"], occ["2"], occ["3"], occ["4"]]}
    write_json(OUT / "fish-jobs-detail.json", {"countries": detail})

    last = len(years) - 1
    tot = {c: s[last] for c, s in series(lambda cells: round(total(cells))).items() if s[last]}
    print(f"  {years[0]}–{years[-1]}，{len(countries)} 國或地區；略過的代碼 {sorted(skipped)}")
    print(f"  {years[-1]} 年世界 {world['total'][last]:,}：養殖 {world['aquaculture'][last]:,}、內陸 {world['inland'][last]:,}、海洋 {world['marine'][last]:,}")
    print("  人數：" + "、".join(f"{c} {v:,}" for c, v in sorted(tot.items(), key=lambda kv: -kv[1])[:14]))
    wv = series(women)
    at = lambda d, c: (d.get(c) or [None] * len(years))[last]  # noqa: E731
    for c in ("TWN", "EGY", "PRK", "JPN", "KOR", "HKG", "MAC", "NOR", "ISL", "USA"):
        print(f"  {c}：{tot.get(c)}、每千人 {at(per, c)}、女性 {at(wv, c)}%")
    top_per = sorted(((s[last], c) for c, s in per.items() if s[last] is not None), reverse=True)[:12]
    print("  每千人最多：" + "、".join(f"{c} {v}" for v, c in top_per))
    top_w = sorted(((s[last], c) for c, s in wv.items() if s[last] is not None), reverse=True)[:12]
    print(f"  女性比例有值 {sum(1 for s in wv.values() if s[last] is not None)} 國；最高：" + "、".join(f"{c} {v}" for v, c in top_w))

"""電競：多少人上網玩遊戲、訂閱遊戲服務（2026-11-06，製作手冊第二十四批 424；步驟 gaming-eu，輸出 topics/esports/）。

- Eurostat `isoc_ci_ac_i`（Individuals - internet activities）的 I_IUPDG「上網玩或下載遊戲」，16–74 歲全部人口的比例
  （分母不是上網的人），大約兩年一次；`isoc_ec_ibgs`（Internet purchases - goods or services, 2020 onwards）的
  I_BGAMSS「有付費的遊戲串流訂閱」，2025 年起。CC BY 4.0；英國、科索沃由 sources/eurostat.py 統一排除。
- 只有歐洲約 35 國，台灣沒有可比的全國資料（data.gov.tw 沒有玩遊戲人口比例的資料集）。
- 2021 年以前的 I_IUGM 把遊戲、圖片、影片、音樂混在一起，跟 I_IUPDG 不能接成一條線，不用。
- 2026-11-08（製作手冊第二十七批 653，候選 1427、1429、1430）：
  - 遊戲出版的營業額：Eurostat `cult_ent_val`（文化部門企業的附加價值與營業額，2011–2020）NACE J58.21「Publishing of
    computer games」的 V12110（營業額，百萬歐元），各國最近一年。J58.21 只算遊戲出版，遊戲程式設計歸在 J62，所以會低估；
    賽普勒斯很高，手冊說是稅籍效應，說明照寫但不下因果結論。
  - 誰在玩：同一個 I_IUPDG 的 16–24 歲（Y16_24）與 65–74 歲（Y65_74），子項目切換，各國最新一年。
  - 台灣上市過的遊戲：數位發展部「遊戲軟體分級」（data.gov.tw 6400，政府資料開放授權條款第 1 版；www-api.moda.gov.tw 的
    robots.txt 是 404）11,219 筆，依平台、級別、上市年份統計成台灣的清單。廠商是台灣代理商不是原開發商，不拿來算原產國；
    上市日期 2019 年以後幾乎沒有新資料、2050 年的明顯錯誤，年份只算到 2018 年。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "esports"


def _write(name: str, dataset: str, indic: str) -> None:
    raw = eurostat.series(dataset, indic_is=indic, unit="PC_IND", ind_type="IND_TOTAL")
    years = sorted({y for s in raw.values() for y in s})
    # 電競主題沒有時間軸（timeless），只輸出最新一年
    last = years[-1]
    values = {k: [round(s[last], 1)] for k, s in sorted(raw.items()) if last in s}
    write_json(OUT / f"{name}.json", indicator_file(name, "%", [last], values, license="CC BY 4.0"))
    ranked = sorted(((s[last], k) for k, s in raw.items() if last in s), reverse=True)
    print(f"  {name}：{years[0]}–{last}，{last} 年 {len(ranked)} 國；最高 {[(round(v, 1), k) for v, k in ranked[:8]]}；"
          f"最低 {[(round(v, 1), k) for v, k in ranked[-5:]]}")


def _publishing() -> None:
    raw = eurostat.json_series("cult_ent_val", indic_sb="V12110", unit="MIO_EUR", nace_r2="J5821")
    latest = {k: (max(s), s[max(s)]) for k, s in raw.items() if s}
    last = max(y for y, _ in latest.values())
    values = {k: [round(v, 1)] for k, (y, v) in sorted(latest.items())}
    hints = {k: f"{y} 年的數字" for k, (y, _) in latest.items() if y != last}
    hints_en = {k: f"Figure for {y}" for k, (y, _) in latest.items() if y != last}
    write_json(OUT / "game-publishing.json", indicator_file("game-publishing", "百萬歐元", [last], values, hints=hints, hintsEn=hints_en,
                                                            license="CC BY 4.0"))
    ranked = sorted(((v, k, y) for k, (y, v) in latest.items()), reverse=True)
    print(f"  遊戲出版營業額（J58.21）：{len(values)} 國；{[(round(v, 1), k, y) for v, k, y in ranked[:10]]}")


def _ages() -> None:
    for item, code in (("young", "Y16_24"), ("old", "Y65_74")):
        raw = eurostat.series("isoc_ci_ac_i", indic_is="I_IUPDG", unit="PC_IND", ind_type=code)
        latest = {k: (max(s), s[max(s)]) for k, s in raw.items() if s}
        last = max(y for y, _ in latest.values())
        values = {k: [round(v, 1)] for k, (y, v) in sorted(latest.items())}
        hints = {k: f"{y} 年的數字" for k, (y, _) in latest.items() if y != last}
        hints_en = {k: f"Figure for {y}" for k, (y, _) in latest.items() if y != last}
        write_json(OUT / "gaming-age" / f"{item}.json", indicator_file(f"gaming-age-{item}", "%", [last], values, hints=hints, hintsEn=hints_en,
                                                                       license="CC BY 4.0"))
        ranked = sorted(((v, k, y) for k, (y, v) in latest.items()), reverse=True)
        print(f"  上網玩遊戲 {code}：{len(values)} 國；最高 {[(round(v, 1), k, y) for v, k, y in ranked[:8]]}；最低 {[(round(v, 1), k, y) for v, k, y in ranked[-4:]]}")


RATINGS = "https://www-api.moda.gov.tw/File/Get/adi/zh-tw/luEB5e2gWwkOVE0"
TW_BOX = (119.3, 21.8, 122.1, 25.4)


def _taiwan_ratings() -> None:
    import csv
    import io
    from collections import Counter

    from common import download, points_file, write_points

    rows = list(csv.DictReader(io.StringIO(download(RATINGS, "moda", "game-ratings-6400.csv").read_text(encoding="utf-8-sig"))))
    plat = Counter((r.get("遊戲平台") or "").strip() or "未填" for r in rows)
    level = Counter((r.get("級別") or "").strip() or "未填" for r in rows)
    years = Counter(int(r["上市日期"][:4]) for r in rows if (r.get("上市日期") or "")[:4].isdigit())
    bad = sum(v for y, v in years.items() if y > 2026)
    decades = Counter((y // 5) * 5 for y, v in years.items() for _ in range(v) if y <= 2018)
    after = sum(v for y, v in years.items() if 2018 < y <= 2026)
    out = []
    lon, lat = (TW_BOX[0] + TW_BOX[2]) / 2, (TW_BOX[1] + TW_BOX[3]) / 2
    for g, counter in (("p", plat), ("r", level)):
        for name, n in counter.most_common():
            out.append({"lon": lon, "lat": lat, "g": g, "name": name, "n": n})
    for y, n in sorted(decades.items()):
        out.append({"lon": lon, "lat": lat, "g": "y", "name": f"{y}–{y + 4}", "n": n})
    write_points(OUT / "taiwan-ratings.json", points_file(out, ["lon", "lat", "g", "name", "n"], {"lon": 0.01, "lat": 0.01}, strings=("g",)),
                 ("name",))
    # 指標本身國家不上色（layer none），放一個空的指標檔
    write_json(OUT / "taiwan-ratings-map.json", indicator_file("taiwan-ratings-map", "", [2026], {}, license="政府資料開放授權條款第 1 版"))
    peak = max((y for y in years if y <= 2018), key=lambda y: years[y])
    print(f"  台灣遊戲分級：{len(rows):,} 筆；平台 {plat.most_common(10)}；級別 {level.most_common()}；"
          f"年份 {min(years)}–2018，最多 {peak} 年 {years[peak]}；2019–2026 共 {after}；2027 年以後（錯誤）{bad}")


def build() -> None:
    _write("gaming-online", "isoc_ci_ac_i", "I_IUPDG")
    _write("gaming-subscriptions", "isoc_ec_ibgs", "I_BGAMSS")
    _publishing()
    _ages()
    _taiwan_ratings()

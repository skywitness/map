"""外食與喝一杯：餐廳、速食、咖啡館、酒吧與冰淇淋店的密度（2026-11-04，製作手冊第二十一批 342）。

- 資料：OpenStreetMap 經 QLever（sources/osm_qlever.py；ODbL，© OpenStreetMap contributors），每個國家有幾個
  amenity = restaurant、fast_food、cafe、bar、pub、ice_cream（node、way、relation 都算），2026 年 11 月的快照。
  只算固定店面的標籤，夜市與攤販（amenity=marketplace）不算。
- 每十萬人用聯合國 WPP 2024 的 2026 年推估人口（台灣也在 WPP 裡）。
- **只畫 OSM 覆蓋良好的國家**（sources/osm_coverage.py 的名單，用 OSM 餐飲店 ÷ 住宿及餐飲業就業人數判斷）；
  其他國家寫原因不畫。OSM 的店家密度同時在量「OSM 畫得多完整」，覆蓋良好的國家之間也還有差別，只能看大概。
- 餐廳與速食的界線各國的繪圖者判斷不一，所以另外有兩者合計（預設）；bar 與 pub 是文化性的標籤（日本的居酒屋
  常標成 pub），合在一起算「酒吧與酒館」。
- 各國的店數寫在 tooltip；資料檔是 OSM 的衍生資料，依 ODbL 1.0 分享。
- 第二十四批 414（2026-11-06）：不賣酒的飲料店依「賣什麼」分：手搖飲（cuisine=bubble_tea）、茶館（cuisine=tea）、
  茶葉行（shop=tea）、咖啡豆與器材行（shop=coffee），每百萬人。cuisine 只算完全等於這個值的（「bubble_tea;coffee」
  這種多值的不算）。中國的手搖飲實際上有十幾萬家，OSM 上標的只是很小一部分，而且中國不在覆蓋良好的名單裡。
- 414 的台灣官方對照（2026-11-07 補）：經濟部商業發展署「商業登記（依營業項目別）－飲料店業」（data.gov.tw 32685，
  政府資料開放授權條款第 1 版），data.gcis.nat.gov.tw 從 cloud 只回「系統忙碌中」，由本機 session 下載放在 map-plan 的
  data/gcis/beverage-shops-32685.csv；重跑時複製到 pipeline/.cache/gcis/（沒有就略過這段）。只算登記狀態「核准設立」，
  依地址的前 3 個字分縣市（台→臺）。只有商業登記（獨資、合夥），沒有公司登記；所有飲料店業都算，不只手搖飲。
  寫在手搖飲指標台灣的滑過說明。
"""
from __future__ import annotations

import csv

from common import CACHE_DIR, OUT_DIR, indicator_file, now_iso, write_json
from sources import osm_coverage, osm_qlever, wpp

OUT = OUT_DIR / "topics" / "dining"
YEAR = 2026
MIN_POPULATION = 100  # 千人；人口不到 10 萬的地方一兩家店就差很多，不畫（店數照樣寫）
# 指標 id → (要加總的 amenity 值, 中文名, 英文名)
INDICATORS = {
    "eat-out": (("restaurant", "fast_food"), "餐廳與速食店", "restaurants and fast-food outlets"),
    "restaurants": (("restaurant",), "餐廳", "restaurants"),
    "fast-food": (("fast_food",), "速食店", "fast-food outlets"),
    "cafes": (("cafe",), "咖啡館", "cafés"),
    "bars": (("bar", "pub"), "酒吧與酒館", "bars and pubs"),
    "ice-cream": (("ice_cream",), "冰淇淋店", "ice-cream shops"),
    "nightclubs": (("nightclub",), "夜店", "nightclubs"),
    # 第二十四批 414（2026-11-06）：不賣酒的飲料店依「賣什麼」分，標籤寫成 key=value（沒寫 key 的是 amenity）。
    # 同一家店可能同時是 amenity=cafe 與 cuisine=bubble_tea，跟咖啡館重複算，各指標的數字不能相加
    "bubble-tea": (("cuisine=bubble_tea",), "手搖飲店", "bubble tea shops"),
    "tea-houses": (("cuisine=tea",), "茶館", "tea houses"),
    "tea-shops": (("shop=tea",), "茶葉行", "tea shops"),
    "coffee-shops": (("shop=coffee",), "咖啡豆與器材行", "coffee bean and equipment shops"),
}
# 這幾種店比較少，用每百萬人（其他是每十萬人）
PER_MILLION = {"bubble-tea", "tea-houses", "tea-shops", "coffee-shops"}
# 各國的「喝一杯」場所類型（第二十一批 367）：bar、pub、biergarten 每十萬人合計不到 LOW_DRINK 算低密度；
# 啤酒花園占三者 BEER_GARDEN_SHARE 以上算啤酒花園；其他看 pub 與 bar 哪個多
DRINK_TYPES = {"bar": 1, "pub": 2, "biergarten": 3, "low": 4}
LOW_DRINK = 10
BEER_GARDEN_SHARE = 0.15


GCIS_FILE = CACHE_DIR / "gcis" / "beverage-shops-32685.csv"
COUNTY_EN = {"臺北市": "Taipei", "新北市": "New Taipei", "桃園市": "Taoyuan", "臺中市": "Taichung", "臺南市": "Tainan",
             "高雄市": "Kaohsiung", "基隆市": "Keelung", "新竹市": "Hsinchu City", "嘉義市": "Chiayi City",
             "新竹縣": "Hsinchu County", "苗栗縣": "Miaoli", "彰化縣": "Changhua", "南投縣": "Nantou", "雲林縣": "Yunlin",
             "嘉義縣": "Chiayi County", "屏東縣": "Pingtung", "宜蘭縣": "Yilan", "花蓮縣": "Hualien", "臺東縣": "Taitung",
             "澎湖縣": "Penghu", "金門縣": "Kinmen", "連江縣": "Lienchiang"}


def _taiwan_beverage_shops() -> tuple[str, str] | None:
    """商業登記的飲料店業：核准設立的家數與前三大縣市（台灣滑過說明用）"""
    if not GCIS_FILE.exists():
        print(f"  沒有 {GCIS_FILE}（map-plan 的 data/gcis/），台灣的官方對照略過")
        return None
    by: dict[str, int] = {}
    with open(GCIS_FILE, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["登記狀態"].strip() == "核准設立":
                county = r["商業地址"].strip()[:3].replace("台", "臺")
                by[county] = by.get(county, 0) + 1
    total = sum(by.values())
    top = sorted(by.items(), key=lambda kv: -kv[1])[:3]
    print(f"  台灣商業登記的飲料店業：核准設立 {total:,} 家；{top}")
    zh = (f"經濟部商業登記的「飲料店業」核准設立 {total:,} 家（{'、'.join(f'{c} {n:,}' for c, n in top)} 最多；"
          "只含獨資、合夥商號，不含公司登記；所有飲料店都算，不只手搖飲）")
    en = (f"Taiwan's business registry lists {total:,} beverage shops in operation (most in "
          f"{', '.join(f'{COUNTY_EN.get(c, c)} {n:,}' for c, n in top)}; sole proprietorships and partnerships only, "
          "not companies; all beverage shops, not only bubble tea)")
    return zh, en


def build() -> None:
    counts = {tag: osm_qlever.counts(*(tag.split("=") if "=" in tag else ("amenity", tag)))
              for tags, *_ in INDICATORS.values() for tag in tags}
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items()
           if c != "WLD" and YEAR in s}
    cov = osm_coverage.coverage()
    covered = osm_coverage.well_covered()
    tw_official = _taiwan_beverage_shops()
    for ind, (tags, zh, en) in INDICATORS.items():
        n = {c: sum(counts[t].get(c, 0) for t in tags) for c in set().union(*(counts[t] for t in tags)) | covered}
        values, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}
        for c in sorted(set(n) | set(cov)):
            if c not in pop:
                continue
            count = n.get(c, 0)
            hints[c] = f"OpenStreetMap 上有 {count:,} 家{zh}"
            hints_en[c] = f"{count:,} {en} on OpenStreetMap"
            if c == "TWN" and ind == "bubble-tea" and tw_official:
                hints[c] += f"；{tw_official[0]}"
                hints_en[c] += f"; {tw_official[1]}"
            if c not in covered:
                no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
            elif pop[c] < MIN_POPULATION:
                no_value[c] = "人口不到 10 萬，一兩家店就差很多，不畫"
                no_value_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
            else:
                # 人口是千人：每十萬人 = 店數 ÷ 千人 × 100，每百萬人 × 1000
                values[c] = [round(count / pop[c] * (1000 if ind in PER_MILLION else 100), 1)]
        write_json(OUT / f"{ind}.json", indicator_file(
            ind, "家／百萬人" if ind in PER_MILLION else "家／十萬人", [YEAR], values, hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en,
            license="ODbL 1.0"))
        top = sorted(((v[0], c) for c, v in values.items()), reverse=True)
        print(f"  {ind}：{len(values)} 國；最多 {top[:6]}；台灣 {values.get('TWN')}（{n.get('TWN')} 家）；"
              f"美國 {values.get('USA')}、日本 {values.get('JPN')}、南韓 {values.get('KOR')}")
    _drink_types(counts, pop, cov, covered)
    write_json(OUT / "manifest.json", {"topic": "dining", "generatedAt": now_iso(),
                                       "source": "© OpenStreetMap contributors (ODbL 1.0), via QLever"})


def _drink_types(counts: dict, pop: dict, cov: dict, covered: set) -> None:
    """367：各國最典型的喝一杯場所（類別）"""
    biergarten = osm_qlever.counts("amenity", "biergarten")
    values, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}
    for c in sorted(set(counts["bar"]) | set(counts["pub"]) | covered):
        if c not in pop:
            continue
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
            continue
        if pop[c] < MIN_POPULATION:
            continue
        d = {k: src.get(c, 0) / pop[c] * 100 for k, src in (("bar", counts["bar"]), ("pub", counts["pub"]), ("biergarten", biergarten))}
        total = sum(d.values())
        if total < LOW_DRINK:
            kind = DRINK_TYPES["low"]
        elif d["biergarten"] >= total * BEER_GARDEN_SHARE:
            kind = DRINK_TYPES["biergarten"]
        else:
            kind = DRINK_TYPES["pub"] if d["pub"] > d["bar"] else DRINK_TYPES["bar"]
        values[c] = [kind]
        hints[c] = f"每十萬人：酒吧 {d['bar']:.1f}、酒館 {d['pub']:.1f}、啤酒花園 {d['biergarten']:.2f} 家"
        hints_en[c] = f"Per 100,000: bars {d['bar']:.1f}, pubs {d['pub']:.1f}, beer gardens {d['biergarten']:.2f}"
    write_json(OUT / "drink-type.json", indicator_file(
        "drink-type", "類別", [YEAR], values, hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en,
        license="ODbL 1.0"))
    from collections import Counter
    print(f"  喝一杯類型：{len(values)} 國 {Counter(v[0] for v in values.values())}；"
          f"啤酒花園 {sorted(c for c, v in values.items() if v[0] == 3)}；台灣 {values.get('TWN')}、日本 {values.get('JPN')}、美國 {values.get('USA')}")

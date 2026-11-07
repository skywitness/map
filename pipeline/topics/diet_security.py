"""飲食的擴充：吃不飽的人、吃的東西靠不靠進口、吃得夠不夠與多單調（2026-11-07，製作手冊第二十七批 562，
候選 1268、1269、1270；步驟 diet-security，輸出 topics/diet/）。

資料：FAOSTAT 糧食安全指標（FS，飲食主題已經在下載的同一個 zip；CC BY 4.0），sources/faostat.py 的 suite_rows()。
年份是三年平均（「2023-2025」），跟「營養不足人口比例」一樣記在中間那一年。
- 210091 中度或嚴重糧食不安全（FIES 量尺，直接問人；PoU 是供給推估的模型值）；210091F／M 男女寫在 tooltip。
- 210401 嚴重糧食不安全；「<0.5」記成 0.25、tooltip 寫「不到 0.5%」。
- 21035 穀物進口依賴度（負值是淨出口：巴拉圭 −1894% 是出口量約為國內用量的 19 倍）；發散色、分段門檻。
- 21033 食物進口占商品出口（小島國會到幾千 %，最高一級是 200% 以上，tooltip 寫真值）。
- 21010 熱量供給充足度（供給 ÷ 需求基準；超過 100% 不代表吃太多，高所得國家多半是浪費掉的）。
- 21012 穀物、根莖與薯類占熱量（全部加起來，跟「主要主食占熱量」只算最大的那一類不同）。
- 210090 等的年值、城鄉與 21031 熱量波動只有區域合計，不用（手冊的陷阱）。
台灣：FIES 沒有台灣（受訪國不含台灣），210091、210401 寫原因；21035、21033、21010、21012 FAOSTAT 有台灣。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, to_series, write_json, year_span
from sources import faostat

OUT = OUT_DIR / "topics" / "diet"
ITEMS = {
    "food-insecurity": "210091",
    "food-insecurity-severe": "210401",
    "cereal-import-dependency": "21035",
    "food-imports-share": "21033",
    "energy-adequacy": "21010",
    "energy-staples-share": "21012",
}
SEX = {"F": "210091F", "M": "210091M"}
BELOW = "<0.5"
TAIWAN_FIES = ("FAO 的糧食不安全經驗量表（FIES）沒有在台灣調查；衛福部國民營養調查的題目不同，對不起來",
               "FAO’s Food Insecurity Experience Scale is not surveyed in Taiwan; Taiwan’s nutrition survey asks different questions")


def _middle(year: str) -> int:
    first, last = (int(y) for y in year.split("-"))
    return (first + last) // 2


def build() -> None:
    wanted = set(ITEMS.values()) | set(SEX.values())
    data: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    below: dict[str, set[str]] = defaultdict(set)
    for r in faostat.suite_rows("FS", wanted):
        y = _middle(r.year)
        if r.value == BELOW:
            data[r.item][r.area][y] = 0.25
            below[r.item].add(r.area)
            continue
        try:
            data[r.item][r.area][y] = float(r.value)
        except ValueError:
            continue
    for key, item in ITEMS.items():
        series = {a: s for a, s in data[item].items() if a != "WLD"}
        years = year_span(series)
        hints, hints_en = {}, {}
        if item == "210091":
            for a in series:
                f, m = data[SEX["F"]].get(a, {}), data[SEX["M"]].get(a, {})
                if f and m:
                    y = max(set(f) & set(m), default=None)
                    if y:
                        hints[a] = f"女性 {f[y]:.1f}%、男性 {m[y]:.1f}%（{y - 1}–{y + 1} 年平均）"
                        hints_en[a] = f"women {f[y]:.1f}%, men {m[y]:.1f}% ({y - 1}–{y + 1} average)"
        for a in below[item]:
            hints[a] = "不到 0.5%"
            hints_en[a] = "Below 0.5%"
        no_value = {"TWN": TAIWAN_FIES[0]} if item in ("210091", "210401") else {}
        no_value_en = {"TWN": TAIWAN_FIES[1]} if item in ("210091", "210401") else {}
        write_json(OUT / f"{key}.json", indicator_file(
            key, "%", years, {a: to_series(s, years, 1) for a, s in sorted(series.items())},
            aggregates={"WLD": to_series(data[item].get("WLD", {}), years, 1)},
            hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en, license="CC BY 4.0"))
        last = years[-1]
        top = sorted(((s[last], a) for a, s in series.items() if last in s), reverse=True)
        print(f"  {key}（{item}）：{years[0]}–{last}，{len(top)} 國；{top[:6]} … {top[-5:]}；台灣 {series.get('TWN', {}).get(last)}；"
              f"世界 {data[item].get('WLD', {}).get(last)}")
        if item == "210091":
            gap = sorted(((data[SEX['F']][a][last] - data[SEX['M']][a][last], a) for a in series
                          if last in data[SEX['F']].get(a, {}) and last in data[SEX['M']].get(a, {})), reverse=True)
            print(f"    女性減男性：{gap[:5]} … {gap[-3:]}；女性比較高的 {sum(1 for g, _ in gap if g > 0)} / {len(gap)}")
        if item == "21035":
            print(f"    淨出口（<0）{sum(1 for v, _ in top if v < 0)} 國；100% 的 {sum(1 for v, _ in top if v >= 100)} 國")
        if item == "21033":
            print(f"    200% 以上 {[(a, v) for v, a in top if v >= 200]}")
        for a in ("JPN", "KOR", "CHN", "USA", "IND", "DEU", "SGP"):
            print(f"    {a} {series.get(a, {}).get(last)}", end="")
        print()

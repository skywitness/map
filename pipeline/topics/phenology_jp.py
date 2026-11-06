"""各國氣溫與降雨：日本的櫻花開花與楓葉紅葉（2026-11-06，製作手冊第二十四批 418；步驟 phenology-jp，輸出 topics/temperature/）。

- 資料：日本氣象廳「生物季節観測累年値ファイル（CSV）」（www.data.jma.go.jp/sakura/data/ruinenchi/，Shift_JIS），
  102 個氣象台、測候所每年一筆，1953–2025：004 さくらの開花、005 さくらの満開、015 かえでの紅葉、013 いちょうの黄葉。
  授權：氣象廳網站的內容依「公共データ利用規約（第1.0版）」可以自由利用、可以商用，要註明出處與加工（數值資料本身
  不受著作權保護）。2026-11-06 讀 robots.txt：www.data.jma.go.jp、www.jma.go.jp 都是 404（沒有限制）。
- 值是「月日」四位數（326 是 3 月 26 日），0 是沒有觀測。日期換成「那一季的第幾天」（用平年 2001 年算，閏年不差一天）：
  櫻花有前一年 12 月就開的（沖繩、奄美的寒緋櫻，記在下一年），算成負的；楓葉、銀杏有拖到隔年 1 月的，算成大於 365。
- 每個值後面的標記：6、7 是「代替種目」（北海道多半是蝦夷山櫻、千島櫻，沖繩是寒緋櫻；不是染井吉野），8、9 是正規種目；
  不同樹種不能直接比，只能各站看自己的趨勢，tooltip 寫出那一年是不是代替種目。檔案最後的「平年値」也一起輸出。
- 站的位置：氣象廳 AMeDAS 的站表（www.jma.go.jp/bosai/amedas/const/amedastable.json）依站名對（同名的取氣象台，type A）；
  南大東島在站表叫「南大東」。站名是日文漢字，換成台灣的寫法（稚内 → 稚內、鹿児島 → 鹿兒島）。
- 2020 年底氣象廳把植物的觀測項目砍到 6 種，這四種都還在測；有些站中途停測，那幾年沒有點。
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
from collections import Counter

from common import OUT_DIR, download, indicator_file, points_file, write_json

OUT = OUT_DIR / "topics" / "temperature"
BASE = "https://www.data.jma.go.jp/sakura/data/ruinenchi/"
STATIONS = "https://www.jma.go.jp/bosai/amedas/const/amedastable.json"
FIRST, LAST = 1953, 2025
# (檔名, 欄位前綴, 中文, 前一年 12 月算負的；否則隔年 1–2 月算大於 365)
ITEMS = [("004", "b", "櫻花開花", True), ("005", "f", "櫻花滿開", True), ("015", "m", "楓葉紅葉", False), ("013", "g", "銀杏黃葉", False)]
ALIAS = {"南大東島": "南大東"}
# 日文新字體 → 台灣的寫法（這 102 個站名用到的）
KANJI = str.maketrans("内沢帯広倶浜横豊厳児徳与国瀬静関", "內澤帶廣俱濱橫豐嚴兒德與國瀨靜關")


def _day(mmdd: int, prev_december: bool) -> int:
    m, d = divmod(mmdd, 100)
    doy = dt.date(2001, m, d).timetuple().tm_yday
    if prev_december and m >= 11:
        return doy - 365
    if not prev_december and m <= 2:
        return doy + 365
    return doy


def build() -> None:
    table = json.loads(download(STATIONS, "jma", "amedastable.json").read_text(encoding="utf-8"))
    by_name: dict[str, list[tuple[str, dict]]] = {}
    for code, s in table.items():
        by_name.setdefault(s["kjName"], []).append((code, s))

    stations: dict[str, dict] = {}
    counts: dict[str, dict[int, int]] = {}
    for fname, key, zh, prev_dec in ITEMS:
        raw = download(BASE + f"{fname}.csv", "jma", f"phenology-{fname}.csv").read_bytes().decode("shift_jis")
        rows = list(csv.reader(io.StringIO(raw)))
        header = rows[1]
        years = [int(h) for h in header[2::2] if h.isdigit()]
        if years[0] != FIRST or years[-1] < LAST:
            raise RuntimeError(f"生物季節觀測 {fname}：年份 {years[0]}–{years[-1]}，跟預期的 {FIRST}–{LAST} 不同")
        normal_col = header.index("平年値")
        n_year = Counter()
        for r in rows[2:]:
            if not r or not r[0].isdigit():
                continue
            name = r[1].replace("　", "").strip()
            cand = by_name.get(ALIAS.get(name, name), [])
            if len(cand) > 1:
                cand = [c for c in cand if c[1]["type"] == "A"]
            if len(cand) != 1:
                raise RuntimeError(f"生物季節觀測：站名 {name} 在 AMeDAS 站表對不到（{cand}）")
            s = cand[0][1]
            st = stations.setdefault(r[0], {
                "lon": round(s["lon"][0] + s["lon"][1] / 60, 3), "lat": round(s["lat"][0] + s["lat"][1] / 60, 3),
                "n": name.translate(KANJI), "nj": name, "ne": s["enName"], "id": int(r[0])})
            for i, y in enumerate(years):
                if y > LAST:
                    continue
                v, mark = r[2 + 2 * i], r[3 + 2 * i]
                if v and v != "0":
                    st[f"{key}{y}"] = _day(int(v), prev_dec)
                    if mark in ("6", "7"):
                        st[f"{key}s{y}"] = 1  # 代替種目
                    n_year[y] += 1
            normal = r[normal_col]
            if normal and normal != "0":
                st[f"{key}n"] = _day(int(normal), prev_dec)
        counts[key] = dict(n_year)
        last = {y: n for y, n in n_year.items() if y >= LAST - 4}
        print(f"  {zh}：{len(n_year)} 年有資料，近年每年 {last} 站")

    rows = sorted(stations.values(), key=lambda s: -s["lat"])
    fields = ["lon", "lat", "id", "n", "nj", "ne"]
    for _, key, _, _ in ITEMS:
        fields += [f"{key}n"] + [f"{key}{y}" for y in range(FIRST, LAST + 1)] + [f"{key}s{y}" for y in range(FIRST, LAST + 1)]
    fields = [f for f in fields if any(f in s for s in rows)]  # 都沒有值的欄位（某一年沒有代替種目）不放
    write_json(OUT / "phenology.json", points_file(rows, fields, {"lon": 0.001, "lat": 0.001}))
    for (_, key, zh, _), ind in zip(ITEMS, ("sakura-bloom", "sakura-full", "maple-red", "ginkgo-yellow")):
        write_json(OUT / f"{ind}-stations.json", indicator_file(
            ind, "站", list(range(FIRST, LAST + 1)), {"JPN": [counts[key].get(y) for y in range(FIRST, LAST + 1)]}))

    def show(key: str, name: str) -> str:
        s = next(x for x in rows if x["nj"] == name)
        return " ".join(f"{y}:{s.get(f'{key}{y}')}" for y in (1953, 2000, 2020, 2021, 2023, 2024, 2025)) + f" 平年 {s.get(key + 'n')}"
    print(f"  {len(rows)} 站；東京開花 {show('b', '東京')}；京都 {show('b', '京都')}；東京紅葉 {show('m', '東京')}")
    subs = sorted({s["nj"] for s in rows if s.get(f"bs{LAST}")})
    print(f"  {LAST} 年櫻花開花是代替種目的站：{len(subs)} 站 {subs}")

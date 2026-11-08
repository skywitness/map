"""串流平台各國在看什麼（2026-11-08，製作手冊第二十七批 659，候選 1441；步驟 netflix，輸出 topics/online-video/）。

- 資料：Netflix Top 10（https://www.netflix.com/tudum/top10）的各國每週前十名（all-weeks-countries.tsv）與全球每週前十名
  （all-weeks-global.tsv，電影、劇集 × 英語、非英語）。netflix.com 的 robots.txt 不准程式抓，使用者 2026-11-08 用瀏覽器存檔，
  放在 skywitness/map-plan 的 `data/netflix/`（私人 repo），重跑前複製到 `.cache/netflix/`，這裡核對 SHA-256。
- 授權：查不到；使用者 2026-11-07 決定照 JODI 的前例：註明出處、只准非商業、**網站只放算好的數值，不轉載原始檔**
  （TSV 不放進網站或公開 repo，也不列片名）。
- 算法：最近 52 週，每一國每週的電影與劇集前十名裡，有幾成同一週也在全球前十名（同一類、英語或非英語任一榜）。
  比例高的國家跟著全球走，比例低的國家看自己的東西。全球榜以英語片為主，這個算法對英語市場有利；只有 Netflix 一個平台。
"""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, indicator_file, write_json
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "online-video"
COUNTRIES = CACHE_DIR / "netflix" / "all-weeks-countries.tsv"
GLOBAL = CACHE_DIR / "netflix" / "all-weeks-global.tsv"
SHA = {COUNTRIES: "d6698c67ac18798b9cdf30dc3e3a3783838f436f2b58032862ea6646c3fd80c3",
       GLOBAL: "6afc7a40643f25884e904cadaf869de09fe0539fb21f46b79e0196e58f3e4efd"}
WEEKS = 52


def _rows(path):
    if not path.exists():
        raise RuntimeError(f"沒有 {path}：請把 map-plan 的 data/netflix/{path.name} 複製到這裡")
    if hashlib.sha256(path.read_bytes()).hexdigest() != SHA[path]:
        raise RuntimeError(f"{path} 的 SHA-256 跟 map-plan 的 README 不一樣，先看過再改")
    with open(path, encoding="utf-8", newline="") as f:
        yield from csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE)


def build() -> None:
    glob: dict[tuple[str, str], set[str]] = defaultdict(set)  # (週, films|tv) → 片名
    for r in _rows(GLOBAL):
        kind = "films" if r["category"].startswith("Films") else "tv"
        glob[(r["week"], kind)].add(f"{r['show_title']}|{r['season_title']}")
    rows = list(_rows(COUNTRIES))
    last = max(r["week"] for r in rows)
    first = (dt.date.fromisoformat(last) - dt.timedelta(weeks=WEEKS - 1)).isoformat()
    hit: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0])  # (ISO3, films|tv) → [在全球榜, 全部]
    for r in rows:
        if r["week"] < first:
            continue
        iso = from_alpha2(r["country_iso2"])
        if not iso:
            continue
        kind = "films" if r["category"] == "Films" else "tv"
        key = f"{r['show_title']}|{r['season_title']}"
        h = hit[(iso, kind)]
        h[1] += 1
        h[0] += key in glob[(r["week"], kind)]
    countries = sorted({c for c, _ in hit})
    out = {}
    for item in ("all", "films", "tv"):
        values = {}
        for c in countries:
            kinds = ("films", "tv") if item == "all" else (item,)
            a = sum(hit[(c, k)][0] for k in kinds)
            n = sum(hit[(c, k)][1] for k in kinds)
            if n:
                values[c] = [round(a / n * 100, 1)]
        out[item] = values
        write_json(OUT / "netflix-global" / f"{item}.json", indicator_file(
            f"netflix-global-{item}", "%", [int(last[:4])], values, license="Netflix Top 10（只放算好的數值，非商業）"))
    ranked = sorted(((v[0], c) for c, v in out["all"].items()), reverse=True)
    print(f"  Netflix（{first}–{last}，{WEEKS} 週）：{len(out['all'])} 國；跟著全球走 {ranked[:8]}；看自己的 {ranked[-10:]}；"
          f"台灣 {out['all'].get('TWN')}、日本 {out['all'].get('JPN')}、匈牙利 {out['all'].get('HUN')}")
    print(f"    電影 台灣 {out['films'].get('TWN')}、劇集 台灣 {out['tv'].get('TWN')}；電影最低 {sorted((v[0], c) for c, v in out['films'].items())[:5]}；"
          f"劇集最低 {sorted((v[0], c) for c, v in out['tv'].items())[:5]}")

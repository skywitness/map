"""中醫的研究（新主題，2026-11-08，製作手冊第二十九批 700、709 的論文部分；候選 1613–1618；步驟 tcm-research，輸出 topics/tcm-research/）。

- 資料：OpenAlex（CC0）的群組查詢（作者機構所在國 × 出版年，2000–2025，期刊論文、回顧、會議論文，不含撤回），題名與摘要含
  traditional chinese medicine（片語）、acupuncture、ayurveda、homeopathy、kampo，與全部論文（分母）。
  OpenAlex 的匿名額度是整個出口 IP 共用，cloud 常被擋（2026-11-08 也是 429），所以由本機 session 查好放在 map-plan 的
  data/openalex-tcm/（14 個檔，檔名照 sources/openalex.py 的快取格式）；重跑前複製到 .cache/openalex/，檔名前面加 `tcm-`
  （不覆蓋「學術論文」主題自己的快取）。**這一步不連網**：檔案不齊就報錯。
- 計數：一篇有幾國作者就每國各算一篇（各國相加大於總數）；沒有任何作者有國家資料的不算進各國。
- 指標：各國每年的篇數（子項目五種體系，時間軸 2000–2025）；占全國論文的比例（每萬篇，2000–2025 合計，只算全部論文
  至少 10 萬篇的國家）；中醫論文的開放取用比例（2000–2025 合計，只算中醫論文至少 100 篇的國家）。
- 限制（說明裡寫）：英文關鍵詞，韓醫、藏醫、漢方的其他寫法抓不到，各體系不是公平比較；中文期刊大多不在 OpenAlex。
  療效一律不談：這只是「有幾篇論文以它為題」。
"""
from __future__ import annotations

import shutil

from common import CACHE_DIR, OUT_DIR, indicator_file, write_json
from sources import openalex as oa

OUT = OUT_DIR / "topics" / "tcm-research"
YEARS = (2000, 2025)
SRC = OUT_DIR.parent.parent.parent / "map-plan" / "data" / "openalex-tcm"  # 本機 session 放的地方（有的話先複製）
SYSTEMS = {"tcm": "tcm-papers", "acupuncture": "acupuncture-papers", "ayurveda": "ayurveda-papers", "homeopathy": "homeopathy-papers",
           "kampo": "kampo-papers"}
NAMES = list(SYSTEMS.values()) + ["tcm-oa", "allsources-papers"]
MIN_ALL = 100_000  # 占全國論文的比例：全部論文至少 10 萬篇（手冊：小國的分母不穩）
MIN_TCM = 100  # 開放取用比例：中醫論文至少 100 篇
LICENSE = "CC0（OpenAlex）"


def _load(name: str):
    cache = CACHE_DIR / "openalex"
    for part in ("top", "bottom"):
        target = cache / f"tcm-{name}-{part}.json"
        if not target.exists():
            src = SRC / f"{name}-{part}.json"
            if not src.exists():
                raise RuntimeError(f"沒有 {target}：請把 map-plan 的 data/openalex-tcm/{name}-{part}.json 複製到這裡（這一步不連網）")
            cache.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, target)
    return oa.by_year_country(f"tcm-{name}", YEARS, base=oa.BASE_ALL)


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    data = {n: _load(n) for n in NAMES}
    years = list(range(YEARS[0], YEARS[1] + 1))
    total = lambda counts, c: sum(counts.get(c, {}).values())  # noqa: E731
    (OUT / "papers").mkdir(exist_ok=True)
    for item, name in SYSTEMS.items():
        counts, totals, unknown = data[name]
        write_json(OUT / "papers" / f"{item}.json", indicator_file(
            "papers", "篇", years, {c: [v.get(y, 0) for y in years] for c, v in sorted(counts.items())}, license=LICENSE), quiet=True)
        top = sorted(counts, key=lambda c: -total(counts, c))
        print(f"  {item}：{sum(totals.values()):,} 篇、{len(counts)} 國；沒有國家資料 {sum(unknown.values()):,}（"
              f"{sum(unknown.values()) / sum(totals.values()):.0%}）；2000 年 {totals[2000]:,}、2010 年 {totals[2010]:,}、2020 年 {totals[2020]:,}、"
              f"2024 年 {totals[2024]:,}、2025 年 {totals[2025]:,}；" + "、".join(f"{c} {total(counts, c):,}" for c in top[:15])
              + f"；TWN {total(counts, 'TWN')}（第 {top.index('TWN') + 1 if 'TWN' in top else '-'}）")
    # 占全國論文的比例（每萬篇）
    allc = data["allsources-papers"][0]
    (OUT / "share").mkdir(exist_ok=True)
    for item in ("tcm", "acupuncture"):
        counts = data[SYSTEMS[item]][0]
        vals, hints, hints_en = {}, {}, {}
        for c in counts:
            denom = total(allc, c)
            if denom < MIN_ALL:
                continue
            num = total(counts, c)
            vals[c] = [round(num / denom * 10000, 2)]
            hints[c] = f"2000–2025 年：{num:,} 篇／全部論文 {denom:,} 篇"
            hints_en[c] = f"2000–2025: {num:,} of {denom:,} papers"
        write_json(OUT / "share" / f"{item}.json", indicator_file("share", "每萬篇", [YEARS[1]], {c: v for c, v in sorted(vals.items())},
                                                                  hints=hints, hintsEn=hints_en, license=LICENSE), quiet=True)
        top = sorted(vals.items(), key=lambda kv: -kv[1][0])
        print(f"  占比 {item}：{len(vals)} 國；" + "、".join(f"{c} {v[0]}" for c, v in top[:15]) + "；…" +
              "、".join(f"{c} {v[0]}" for c, v in top[-5:]) + f"；TWN {vals.get('TWN')}（第 {[c for c, _ in top].index('TWN') + 1}）")
    # 中醫論文的開放取用比例
    tcm, tcm_oa = data["tcm-papers"][0], data["tcm-oa"][0]
    vals, hints, hints_en = {}, {}, {}
    for c in tcm:
        n = total(tcm, c)
        if n < MIN_TCM:
            continue
        k = total(tcm_oa, c)
        vals[c] = [round(k / n * 100, 1)]
        hints[c] = f"2000–2025 年：開放取用 {k:,} 篇／中醫論文 {n:,} 篇"
        hints_en[c] = f"2000–2025: {k:,} open access of {n:,} papers"
    write_json(OUT / "oa.json", indicator_file("oa", "%", [YEARS[1]], {c: v for c, v in sorted(vals.items())}, hints=hints,
                                               hintsEn=hints_en, license=LICENSE))
    top = sorted(vals.items(), key=lambda kv: -kv[1][0])
    t_all = sum(data["tcm-papers"][1].values())
    t_oa = sum(data["tcm-oa"][1].values())
    print(f"  開放取用：全部 {t_oa:,}／{t_all:,}（{t_oa / t_all:.1%}）；{len(vals)} 國；" + "、".join(f"{c} {v[0]}" for c, v in top[:12])
          + "；…" + "、".join(f"{c} {v[0]}" for c, v in top[-6:]) + f"；TWN {vals.get('TWN')}、CHN {vals.get('CHN')}、USA {vals.get('USA')}、JPN {vals.get('JPN')}")
    union = set(data["tcm-papers"][0]) | set(data["acupuncture-papers"][0])
    union4 = union | set(data["ayurveda-papers"][0]) | set(data["homeopathy-papers"][0])
    print(f"  聯集：中醫＋針灸 {len(union)} 國，加上阿育吠陀與順勢療法 {len(union4)} 國")

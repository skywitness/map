"""核能的擴充：核燃料循環，誰能濃縮鈾、做燃料、再處理（2026-11-08，製作手冊第二十七批 624，候選 1362；
步驟 nuclear-fuel-cycle，輸出 topics/nuclear-fuel-cycle/，併進「核能」）。

- **歐洲的數量**：Eurostat `nrg_inf_nuc`（CC BY 4.0，2009–2025；表裡有英國，`sources.eurostat.series` 一律不收）：
  濃縮能力（CAP_EN，tSWU）、新燃料元件的產能與產量（PRDCAP_FF、PRD_FF，tHM）、退出爐心的燃料的燃耗度（BAA_IRRADF，GWd/tHM）；
  再處理（CAP_UP、PRD_UP）與 MOX 燃料（PRDCAP_MOXF、PRD_MOXF）只有法國，寫在說明。值是 0 的不畫。
- **全世界有沒有**：英文維基（CC BY-SA 4.0，只取事實，固定版本，讀 /wiki/…?oldid= 的 HTML；/w/ 與 Special:Export 被 robots.txt 禁止）：
  「Enriched uranium」（revid 1377480731）的「Global enrichment facilities」一節列的現在有濃縮設施的 14 國、過去有濃縮計畫的國家；
  「Nuclear reprocessing」（revid 1379213282）的「List of sites」表（各國的再處理場，含已經關閉的）。
  手冊說逐座補座標的工作量大（表上沒有連結），這裡只做到國家：類別圖（濃縮＋再處理、只有濃縮、只有再處理、過去有濃縮）
  與表上的再處理場數（含關閉的）。手冊的陷阱：俄羅斯占世界濃縮能力約一半但不在 Eurostat 裡，所以全世界只能看有沒有。
- 台灣：沒有濃縮、燃料製造或再處理設施。
"""
from __future__ import annotations

import html
import re
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "nuclear-fuel-cycle"
ENRICH_REV = 1377480731
REPRO_REV = 1379213282
ENRICH_URL = f"https://en.wikipedia.org/wiki/Enriched_uranium?oldid={ENRICH_REV}"
REPRO_URL = f"https://en.wikipedia.org/wiki/Nuclear_reprocessing?oldid={REPRO_REV}"
YEAR = 2026
EUROSTAT = {"license": "CC BY 4.0", "attribution": "Eurostat"}
WIKI = {"license": "CC BY-SA 4.0", "attribution": "English Wikipedia, “Enriched uranium” and “Nuclear reprocessing”"}
NAME_FIX = {"UK": "GBR", "USA": "USA", "the United Kingdom": "GBR", "the United States": "USA", "the Netherlands": "NLD"}
TAIWAN = ("台灣沒有濃縮、燃料製造或再處理設施，核燃料全部進口", "Taiwan has no enrichment, fuel fabrication or reprocessing facilities; all nuclear fuel is imported")


def _iso(name: str) -> str:
    name = name.strip()
    c = NAME_FIX.get(name) or from_name(name)
    if not c:
        raise RuntimeError(f"維基的國名對不到：{name!r}")
    return c


def _text(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", fragment))).strip()


def _enrichment() -> tuple[set[str], set[str]]:
    s = download(ENRICH_URL, "wikipedia", f"enriched-uranium-{ENRICH_REV}.html").read_text(encoding="utf-8")
    i = s.find('id="Global_enrichment_facilities"')
    text = _text(s[i:i + 6000])
    m = re.search(r"known to operate enrichment facilities: (.+?)\.\[", text)
    p = re.search(r"had enrichment programs in the past include (.+?),", text)
    if not m or not p:
        raise RuntimeError("維基「Enriched uranium」的濃縮國家那一句找不到（版本換了？）")
    now = {_iso(x) for x in re.split(r", (?:and )?|, and | and ", m.group(1)) if x.strip()}
    past = {_iso(x) for x in re.split(r" and |, ", p.group(1)) if x.strip()} - now
    return now, past


def _reprocessing() -> dict[str, list[tuple[str, str]]]:
    s = download(REPRO_URL, "wikipedia", f"nuclear-reprocessing-{REPRO_REV}.html").read_text(encoding="utf-8")
    i = s.find('id="List_of_sites"')
    t0 = s.find("<table", i)
    table = s[t0:s.find("</table>", t0)]
    sites: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)[1:]:
        cells = [re.sub(r"\[\d+\]|\[[a-z]\]", "", _text(c)) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, re.S)]
        if len(cells) < 6:
            continue
        country = cells[0].split(",")[0]
        period = cells[5].split('"')[0].strip()
        sites[_iso(country)].append((cells[1], period))
    return sites


def build() -> None:
    now, past = _enrichment()
    sites = _reprocessing()
    cat = {}
    for c in sorted(now | past | set(sites)):
        if c in now:
            cat[c] = [1 if c in sites else 2]
        elif c in sites:
            cat[c] = [3]
        else:
            cat[c] = [4]
    nv = {"noValue": {"TWN": TAIWAN[0]}, "noValueEn": {"TWN": TAIWAN[1]}}
    write_json(OUT / "fuel-cycle.json", indicator_file("fuel-cycle", "", [YEAR], cat, **nv, **WIKI))
    write_json(OUT / "reprocessing-sites.json", indicator_file(
        "reprocessing-sites", "座", [YEAR], {c: [len(v)] for c, v in sorted(sites.items())}, **nv, **WIKI))
    print(f"  濃縮（現在）{len(now)} 國：{sorted(now)}；過去：{sorted(past)}")
    print(f"  再處理場 {sum(len(v) for v in sites.values())} 座：" + "、".join(f"{c} {len(v)}" for c, v in sorted(sites.items(), key=lambda x: -len(x[1]))))
    for c, v in sorted(sites.items()):
        print(f"    {c}：" + "；".join(f"{n}（{p}）" for n, p in v))
    print("  類別：" + "、".join(f"{c}={v[0]}" for c, v in cat.items()))

    for name, (pt, unit, label) in {
        "enrichment-capacity": ("CAP_EN", "TSWU", "tSWU"),
        "fuel-fabrication": ("PRDCAP_FF", "THM", "tHM"),
        "fuel-production": ("PRD_FF", "THM", "tHM"),
        "burnup": ("BAA_IRRADF", "GWD_THM", "GWd/tHM"),
    }.items():
        s = eurostat.series("nrg_inf_nuc", plant_tec=pt, unit=unit)
        s = {c: {y: v for y, v in x.items() if v > 0} for c, x in s.items()}
        s = {c: x for c, x in s.items() if x}
        years = sorted({y for x in s.values() for y in x})
        write_json(OUT / f"{name}.json", indicator_file(
            name, label, years, {c: [round(x[y], 2) if y in x else None for y in years] for c, x in sorted(s.items())}, **nv, **EUROSTAT))
        print(f"  {name} {years[0]}–{years[-1]}：2024 " + "、".join(f"{c} {x.get(2024)}" for c, x in sorted(s.items(), key=lambda kv: -(kv[1].get(2024) or 0))))

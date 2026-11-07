"""量子處理器（2026-11-07，製作手冊第二十五批 516，候選 1215；擴充「大型科學設施」〔科技・研發與創新〕）。

英文維基「List of quantum processors」固定版本（revid 1380988323，2026-11-07 讀，CC BY-SA 4.0，只引用事實：製造商、名稱、
架構、量子位元數、發表日期）。手冊寫的 /w/index.php?action=raw 被 robots.txt 禁止，讀 /wiki/…?oldid= 的 HTML。
三個表（閘道型、量子退火、類比）。表裡沒有國家欄：製造商條目在 Wikidata（QLever）的國家（P17），沒有條目或沒有 P17 的
（Alpine Quantum Technologies、Quantware、IQM、Oxford Quantum Circuits、SaxonQ、Quandela、SpinQ、RIKEN、Rigetti、QuEra、
QuTech at TU Delft）依總部所在國手工對照。條目自己說有些只在記者會發表、沒有實際展示，說明寫明。沒有台灣的製造商。
輸出 public/data/topics/science-facilities/quantum/{processors,qubits}.json：每年累計發表的處理器數、到那一年為止最多的量子位元數。
"""

from __future__ import annotations

import html
import re

from common import OUT_DIR, download, indicator_file, write_json

OUT = OUT_DIR / "topics" / "science-facilities" / "quantum"
REVID = 1380988323
URL = f"https://en.wikipedia.org/wiki/List_of_quantum_processors?oldid={REVID}"
# 製造商 → 國家（Wikidata P17：IBM、Google、Intel、IonQ、HRL、Atom Computing 美國，D-Wave、Xanadu 加拿大，
# Quantinuum、M Squared Lasers 英國，中國科學院、中國科大 中國；其他依總部手工對照）
COUNTRY = {
    "IBM": "USA", "Rigetti": "USA", "Google": "USA", "Intel": "USA", "IonQ": "USA", "Atom Computing": "USA",
    "HRL Laboratories, LLC": "USA", "QuEra": "USA", "D-Wave": "CAN", "Xanadu": "CAN", "Quantinuum": "GBR",
    "Oxford Quantum Circuits": "GBR", "M Squared Lasers": "GBR", "USTC": "CHN", "CAS": "CHN", "SpinQ": "CHN",
    "Alpine Quantum Technologies": "AUT", "QuTech at TU Delft": "NLD", "Quantware": "NLD", "IQM": "FIN",
    "SaxonQ": "DEU", "Quandela": "FRA", "RIKEN": "JPN",
}
FIRST, LAST = 2011, 2026


def _clean(c: str) -> str:
    c = re.sub(r"<style.*?</style>|<sup.*?</sup>", "", c, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()


def build() -> None:
    page = download(URL, "wikipedia", f"List_of_quantum_processors-{REVID}.html").read_text(encoding="utf-8")
    rows = []
    for table in re.findall(r'<table class="[^"]*wikitable[^"]*".*?</table>', page, re.S):
        head = [_clean(h) for h in re.findall(r"<th[^>]*>(.*?)</th>", re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)[0], re.S)]
        qi = next(i for i, h in enumerate(head) if h.startswith("Qubits"))
        di = next(i for i, h in enumerate(head) if h.startswith("Release"))
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)[1:]:
            c = [_clean(x) for x in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)]
            if len(c) <= max(qi, di):
                continue
            year = re.search(r"(20\d\d)", c[di])
            qubits = re.match(r"([\d,]+)", c[qi])
            rows.append({"maker": c[0], "name": c[1], "arch": c[2], "year": int(year.group(1)) if year else None,
                         "qubits": int(qubits.group(1).replace(",", "")) if qubits else None})
    unknown = sorted({r["maker"] for r in rows} - set(COUNTRY))
    if unknown:
        raise RuntimeError(f"量子處理器：沒有對到國家的製造商 {unknown}")
    years = list(range(FIRST, LAST + 1))
    count: dict[str, list[int]] = {}
    best: dict[str, list[int | None]] = {}
    dated = [r for r in rows if r["year"]]
    for iso3 in sorted({COUNTRY[r["maker"]] for r in dated}):
        mine = [r for r in dated if COUNTRY[r["maker"]] == iso3]
        count[iso3] = [sum(1 for r in mine if r["year"] <= y) for y in years]
        best[iso3] = [max((r["qubits"] for r in mine if r["year"] <= y and r["qubits"]), default=None) for y in years]
    extra = {"license": "CC BY-SA 4.0",
             "attribution": f"Wikipedia contributors, “List of quantum processors” (revision {REVID}), https://en.wikipedia.org/"}
    write_json(OUT / "processors.json", indicator_file("quantum/processors", "processors", years, count, **extra))
    write_json(OUT / "qubits.json", indicator_file("quantum/qubits", "qubits", years,
                                                    {k: v for k, v in best.items() if any(v)}, **extra))
    print(f"  量子處理器：{len(rows)} 列（有年份 {len(dated)}）；2026 累計 {[(k, v[-1]) for k, v in sorted(count.items(), key=lambda kv: -kv[1][-1])]}；"
          f"最多位元 {[(k, v[-1]) for k, v in sorted(best.items(), key=lambda kv: -(kv[1][-1] or 0))]}")

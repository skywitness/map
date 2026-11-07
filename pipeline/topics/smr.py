"""小型模組化反應爐（SMR）的設計案（2026-11-07，製作手冊第二十五批 532，候選 1210；擴充「核能」）。

英文維基「List of small modular reactor designs」固定版本（revid 1382956151，2026-11-07 讀；CC BY-SA 4.0，只引用事實：
名稱、功率、堆型、設計者、國家、狀態）。手冊寫的 /w/index.php?action=raw 被 robots.txt 禁止，讀 /wiki/…?oldid= 的 HTML。
狀態用表格每一列的底色（維基的圖例：#fcfcfc 設計中、#EECC44 申請執照、#22EE22 已取得執照、#CCEE66 已取得執照且興建中、
#D7E 運轉中、#cccccc 已取消、#ffdddd 已退役；沒有底色或底色寫壞的當設計中）。「Country」是設計者的國家、不是蓋的地點；
兩國合作的（United States/Japan、Canada, United Kingdom…）兩國各算一件，International 不算。
輸出 public/data/topics/smr/designs/{active,advanced}.json：active 是沒有取消或退役的設計案數，advanced 是已經申請執照以上
（申請執照、取得執照、興建中、運轉中）的件數；附註列出這一國的設計案。
"""

from __future__ import annotations

import html
import re
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "smr"
REVID = 1382956151
URL = f"https://en.wikipedia.org/wiki/List_of_small_modular_reactor_designs?oldid={REVID}"
YEAR = 2026
STATUS = {"#fcfcfc": "design", "#eecc44": "seeking", "#22ee22": "licensed", "#ccee66": "construction",
          "#d7e": "operational", "#cccccc": "canceled", "#ffdddd": "retired"}
STATUS_ZH = {"design": "設計中", "seeking": "申請執照", "licensed": "已取得執照", "construction": "興建中",
             "operational": "運轉中", "canceled": "已取消", "retired": "已退役"}
STATUS_EN = {"design": "in design", "seeking": "seeking a licence", "licensed": "licensed", "construction": "under construction",
             "operational": "operating", "canceled": "cancelled", "retired": "retired"}
ADVANCED = {"seeking", "licensed", "construction", "operational"}
ALIAS = {"United States": "USA", "Czech Republic": "CZE", "Czechia": "CZE", "South Korea": "KOR", "Russia": "RUS"}


def _clean(c: str) -> str:
    c = re.sub(r"<style.*?</style>|<sup.*?</sup>|<link[^>]*>", "", c, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()


def build() -> None:
    page = download(URL, "wikipedia", f"List_of_small_modular_reactor_designs-{REVID}.html").read_text(encoding="utf-8")
    table = re.findall(r'<table class="[^"]*wikitable[^"]*".*?</table>', page, re.S)[1]
    rows = []
    for attrs, body in re.findall(r"<tr([^>]*)>(.*?)</tr>", table, re.S)[1:]:
        cells = [_clean(x) for x in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", body, re.S)]
        if len(cells) < 6:
            continue
        bg = re.search(r"background(?:-color)?:\s*(#[0-9A-Fa-f]*)", attrs)
        status = STATUS.get(bg.group(1).lower(), "design") if bg else "design"
        # MWe 欄的開頭有時混進模板的殘字（CAP200 的 `200"}},…>>200`），取最後一段
        power = cells[1].split(">>")[-1]
        rows.append({"name": cells[0], "mwe": power, "type": cells[2], "producer": cells[3], "country": cells[4], "status": status})
    if len(rows) < 90:
        raise RuntimeError(f"SMR 表只讀到 {len(rows)} 列")
    by: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        for c in re.split(r"\s*/\s*|\s*,\s*", r["country"]):
            if c == "International":
                continue
            iso3 = ALIAS.get(c) or from_name(c)
            if not iso3:
                raise RuntimeError(f"SMR：國名對不到 {c}")
            by[iso3].append(r)
    extra = {"license": "CC BY-SA 4.0",
             "attribution": f"Wikipedia contributors, “List of small modular reactor designs” (revision {REVID}), https://en.wikipedia.org/"}
    notes, notes_en = {}, {}
    for iso3, rs in sorted(by.items()):
        notes[iso3] = "；".join(f"{r['name']}（{STATUS_ZH[r['status']]}）" for r in rs)
        notes_en[iso3] = "; ".join(f"{r['name']} ({STATUS_EN[r['status']]})" for r in rs)
    for item, keep in (("active", lambda r: r["status"] not in ("canceled", "retired")), ("advanced", lambda r: r["status"] in ADVANCED)):
        data = {k: [sum(1 for r in rs if keep(r))] for k, rs in sorted(by.items())}
        data = {k: v for k, v in data.items() if v[0]}
        write_json(OUT / "designs" / f"{item}.json", indicator_file(f"designs/{item}", "designs", [YEAR], data, notes=notes, notesEn=notes_en, **extra))
        print(f"  SMR {item}：{len(data)} 國 {sorted(((v[0], k) for k, v in data.items()), reverse=True)}")
    from collections import Counter
    print(f"  {len(rows)} 個設計案；狀態 {Counter(r['status'] for r in rows)}")
    print(f"  運轉中 {[r['name'] for r in rows if r['status'] == 'operational']}；興建中 {[r['name'] for r in rows if r['status'] == 'construction']}")

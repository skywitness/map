"""颱風的左側欄（第十二批順序 191，L3，2026-10-31）：在已經做好的路徑檔（tracks.json、tracks-jma.json）的紀錄多加兩欄，
不必重新下載 IBTrACS（333 MB）。

- id：路徑在檔裡的順序（0 起）。地圖的線圖層用它分組（LinesOverlayDef.groupField），清單「讀線」也用它，
  清單滑過、點一列時標出地圖上的那一條。
- tw：中央氣象署颱風資料庫「颱風警報列表」（1958 年起有發布颱風警報的颱風）：2 是「侵台颱風」
  （侵臺路徑分類有值：颱風中心登陸台灣，或沒有登陸但陸上有災情）、1 是有發警報但不算侵台（含只發海上警報的），
  其他是 null。對應方式：警報列表的編號對到「颱風列表」的中英文名稱，再對路徑紀錄的同一年（或前一年，
  12 月底生成的）同一個中文名稱，對不到中文的用英文名稱。

typhoons.py 重新產生路徑檔時也呼叫 add_columns()，兩條路做出來的一樣。
"""
from __future__ import annotations

import json

from common import OUT_DIR, write_json

OUT = OUT_DIR / "topics" / "typhoons"


def _key(name: str | None) -> str:
    return "".join(ch for ch in (name or "").upper() if ch.isalpha())


def _taiwan() -> tuple[dict[tuple[int, str], int], dict[tuple[int, str], int]]:
    """(年, 中文名) → tw、(年, 英文名的字母) → tw"""
    from topics.typhoons import cwa_list

    names = {c["id"]: c for c in cwa_list("typhoon_list", "get_typhoon")}
    # 同一年的優先；前一年的（路徑紀錄的年份是 12 月底生成的那一年）只補同一年沒有的
    exact: dict[tuple[str, int, str], int] = {}
    prev: dict[tuple[str, int, str], int] = {}
    for c in cwa_list("warning_typhoon_list", "get_warning_typhoon"):
        year = int(c["id"][:4])
        tw = 2 if (c.get("official_path_category") or "").strip() not in ("", "0") else 1
        info = names.get(c["id"], c)
        for kind, name in (("zh", (c.get("cht_name") or info.get("cht_name") or "").strip()),
                           ("en", _key(c.get("eng_name") or info.get("eng_name")))):
            if name:
                exact[(kind, year, name)] = max(exact.get((kind, year, name), 0), tw)
                prev[(kind, year - 1, name)] = max(prev.get((kind, year - 1, name), 0), tw)
    both = {**prev, **exact}
    by_zh = {(y, n): v for (kind, y, n), v in both.items() if kind == "zh"}
    by_en = {(y, n): v for (kind, y, n), v in both.items() if kind == "en"}
    return by_zh, by_en


def add_columns(data: dict, taiwan: tuple[dict, dict] | None = None) -> tuple[int, int]:
    """路徑檔（lines_file 的格式）的紀錄加上 id、tw 兩欄（已經有就覆蓋）；回傳（侵台、有發警報）的條數"""
    by_zh, by_en = taiwan or _taiwan()
    rec = data["records"]
    fields: list[str] = rec["fields"]
    cols = rec["columns"]
    n = len(cols[0])
    col = {f: cols[i] for i, f in enumerate(fields)}
    years, acc = [], 0
    for v in col["year"]:
        if v is not None:
            acc = acc + v if "year" in rec["delta"] else v
        years.append(acc)
    tw: list[int | None] = []
    for i in range(n):
        y, zh, name = years[i], col["zh"][i], col["name"][i]
        v = by_zh.get((y, zh)) if zh else None
        if v is None and name and col["basin"][i] == "WP":
            v = next((by_en[(y, _key(part))] for part in str(name).split("/") if (y, _key(part)) in by_en), None)
        tw.append(v)
    for f, values in (("id", list(range(n))), ("tw", tw)):
        if f in fields:
            cols[fields.index(f)] = values
        else:
            fields.append(f)
            cols.append(values)
        rec["scale"][f] = 1
    return sum(1 for v in tw if v == 2), sum(1 for v in tw if v == 1)


def build() -> None:
    taiwan = _taiwan()
    for name in ("tracks.json", "tracks-jma.json"):
        path = OUT / name
        data = json.loads(path.read_text(encoding="utf-8"))
        hit, warned = add_columns(data, taiwan)
        write_json(path, data)
        print(f"  {name}：{len(data['lines'])} 條，侵台 {hit}、有發警報（不算侵台）{warned}")


if __name__ == "__main__":
    build()

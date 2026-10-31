"""太空的左側欄（第十二批順序 193，L5，2026-10-31）：GCAT 的入軌發射逐次清單（同一個來源、同一個授權，CC BY 4.0）。

launch-list.json（點檔，點在發射場）：每一次入軌發射（LaunchCode 第一個字是 O，成功與失敗都算，跟「每年入軌發射次數」一樣）：
- y、md：發射的年份與月 × 100 + 日（UTC）；排序照 GCAT 的 Launch_Tag（同一年依發射時間）。
- r：火箭（LV_Type）；m：主要酬載（Mission，沒有的用 Flight）；s、sz：發射場的英文短名稱與中文名稱（常用的幾個）；
- c：國家（發射業者所屬的國家，跟指標一樣：蘇聯算俄羅斯）；ok：1 成功、0 失敗、null 不明（LaunchCode 的第二個字 S、F）。
發射場沒有經緯度的（GCAT 標了問號的代碼先去掉問號；再沒有就往 Parent 找）不畫，也不列。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, points_file, write_json
from sources import gcat

OUT = OUT_DIR / "topics" / "space"
# 常用發射場的中文名稱（GCAT 的英文短名稱 → 中文）；沒列的照英文
SITE_ZH = {
    "Plesetsk": "普列謝茨克", "Canaveral": "卡納維爾角", "Baykonur": "拜科努爾", "Vandenberg": "范登堡",
    "Kourou": "庫魯（圭亞那太空中心）", "Jiuquan": "酒泉", "Kennedy": "甘迺迪太空中心", "Xichang": "西昌", "Taiyuan": "太原",
    "Kapustin Yar": "卡普斯京亞爾", "Sriharikota": "斯里赫里戈塔", "Tanegashima": "種子島", "Mahia": "馬希亞半島",
    "Wenchang": "文昌", "Pt Arguello": "阿圭洛角", "Kirimati": "聖誕島附近（海上發射）", "Wallops MARS": "沃勒普斯島",
    "Wallops I": "沃勒普斯島", "Kagoshima": "鹿兒島（內之浦）", "Hainan CLS": "海南商業航天發射場", "Huang Hai": "黃海（海上發射）",
    "Vostochniy": "東方", "Semnan": "塞姆南", "Palmachim": "帕爾馬希姆", "Starbase": "星際基地", "Yasniy": "亞斯尼",
    "San Marco": "聖馬可平台", "Kwajalein": "瓜加林", "Naro": "羅老", "Uchinoura": "內之浦", "Tonghae": "舞水端里",
    "China Lake": "中國湖", "Woomera": "烏美拉", "Shahroud": "沙赫魯德", "Kodiak": "科迪亞克", "Yangjiang": "陽江（海上發射）",
    "Edwards AFB": "愛德華空軍基地", "Svobodniy": "斯沃博德內", "Sohae": "西海衛星發射場", "Mojave": "莫哈韋",
    "Hammaguir": "哈馬吉爾", "Alcantara": "阿爾坎塔拉", "Barents Sea": "巴倫支海（潛艦發射）", "Kii": "紀伊太空港",
    "Andoya": "安德島", "East China Sea": "東海（海上發射）",
}
MONTHS = {m: i + 1 for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}


def _site(sites: dict[str, dict[str, str]], code: str) -> tuple[tuple[float, float] | None, str]:
    """發射場代碼 →（經緯度、英文短名稱）；沒有經緯度的往 Parent 找"""
    code = code.rstrip("?")
    first = sites.get(code, {})
    # 英文短名稱只有兩個字母的是縮寫（KY = Kapustin Yar），改用 ShortName
    short_e = first.get("ShortEName")
    name = short_e if short_e not in (None, "", "-") and len(short_e) > 2 else first.get("ShortName") or code
    seen: set[str] = set()
    while code and code not in seen:
        seen.add(code)
        s = sites.get(code)
        if not s:
            break
        try:
            return (float(s["Longitude"]), float(s["Latitude"])), name
        except ValueError:
            code = s.get("Parent") if s.get("Parent") not in ("-", "") else ""
    return None, name


def _text(v: str | None) -> str | None:
    v = (v or "").strip()
    return None if v in ("", "-") else v


def build() -> None:
    orgs = gcat.orgs()
    mapper = gcat.StateMapper(orgs)
    sites = gcat.sites()
    rows, missing = [], Counter()
    for r in sorted((r for r in gcat.launches() if r["LaunchCode"].startswith("O")), key=lambda r: float(r["Launch_JD"])):
        y = gcat.year(r["Launch_Date"])
        parts = r["Launch_Date"].split()
        md = MONTHS.get(parts[1][:3], 0) * 100 + int(parts[2]) if len(parts) >= 3 and parts[2].isdigit() else None
        coord, name = _site(sites, r["Launch_Site"])
        if coord is None:
            missing[r["Launch_Site"]] += 1
            continue
        state = mapper.org_state(r["Agency"].split("/")[0])
        ok = {"S": 1, "F": 0}.get(r["LaunchCode"][1:2])
        rows.append({"lon": coord[0], "lat": coord[1], "y": y, "md": md, "r": _text(r["LV_Type"]),
                     "m": _text(r["Mission"]) or _text(r["Flight"]), "s": name, "sz": SITE_ZH.get(name),
                     "c": mapper.iso3(state) if state else None, "ok": ok})
    write_json(OUT / "launch-list.json", points_file(
        rows, ["lon", "lat", "y", "md", "r", "m", "s", "sz", "c", "ok"],
        {"lon": 0.01, "lat": 0.01, "y": 1, "md": 1, "ok": 1}, delta=("y",), strings=("r", "s", "sz", "c")))
    last = max(r["y"] for r in rows)
    print(f"  入軌發射 {len(rows):,} 次（{last} 年 {sum(1 for r in rows if r['y'] == last)} 次，失敗 {sum(1 for r in rows if r['ok'] == 0)} 次）；"
          f"發射場沒有經緯度、不列的 {dict(missing)}")
    no_zh = Counter(r["s"] for r in rows if not r["sz"])
    print(f"  沒有中文名稱的發射場（次數多的）：{no_zh.most_common(8)}")


if __name__ == "__main__":
    build()

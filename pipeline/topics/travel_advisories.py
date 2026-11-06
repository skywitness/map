"""旅遊警示：美國、加拿大與台灣各自怎麼看世界（2026-11-06，製作手冊第二十四批 420；步驟 travel-advisories）。

三個政府的現況快照（每筆有發布日期，沒有歷史），每次重跑就是最新的：
- 美國國務院領事事務局 `cadataapi.state.gov/api/TravelAdvisories`（218 筆，Title 含「Level N」，Category 是 ISO alpha-2）。
  條款：使用者 2026-11-05 請本機 session 用瀏覽器讀 www.state.gov 與 travel.state.gov 的著作權頁（map-plan 的
  data/statedept/README.md）：沒有標著作權的資訊是公有領域，可以不經許可轉載，希望註明國務院領事事務局。
- 加拿大全球事務部 `data.international.gc.ca/travel-voyage/index-alpha-eng.json`（230 國，advisory-state 0–3），
  open.canada.ca 的資料集「Country Travel Advice and Advisories」是 Open Government Licence – Canada。
- 台灣外交部領事事務局「國外旅遊警示分級表」RSS（data.gov.tw 116026，政府資料開放授權條款第 1 版）：標題是
  「第N級：○○ - 中文名 - English name」，混了國家與次區域（泰國的 7 府、美國的夏威夷州…）。國家那一筆是「只有
  中文名與英文國名兩段、英文認得出國家」的；其他依中文名開頭的國名歸到那一國，寫在 hints，不畫。
  中國大陸、香港、澳門不在外交部的名單裡，用陸委會「中國大陸及香港、澳門旅遊警示」（data.gov.tw 42627，
  www.mac.gov.tw 的 CSV；robots.txt 只禁 /public）最新一筆「陸港澳」的燈號（灰、黃、橙、紅＝第一到第四級）。
- 2026-11-06 讀過 robots.txt：cadataapi.state.gov、data.international.gc.ca 是 404（沒有限制），www.boca.gov.tw 只禁 ZoomEye。
- 三家的級距定義不同（台灣第四級「儘速離境」是叫已經在當地的人走），不能當同一把尺；「幾家勸你別去」用各家的
  「重新考慮或避免前往」以上：美國 Level 3–4、加拿大 avoid non-essential travel 以上、台灣第三級以上。
"""
from __future__ import annotations

import csv
import io
import json
import re
import xml.etree.ElementTree as ET
from collections import Counter

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import boca
from sources.countries import from_alpha2, from_name

OUT = OUT_DIR / "topics" / "travel-advisories"
US = "https://cadataapi.state.gov/api/TravelAdvisories"
CA = "https://data.international.gc.ca/travel-voyage/index-alpha-eng.json"
TW = "https://www.boca.gov.tw/sp-trwa-rss-1.xml"
MAC = ("https://www.mac.gov.tw/big5/data/134_%E8%A1%8C%E6%94%BF%E9%99%A2%E5%A4%A7%E9%99%B8%E5%A7%94%E5%93%A1%E6%9C%83"
       "%E8%87%AA103%E5%B9%B49%E6%9C%881%E6%97%A5%E8%B5%B7%E7%99%BC%E5%B8%83%E4%B8%AD%E5%9C%8B%E5%A4%A7%E9%99%B8%E5%8F%8A"
       "%E9%A6%99%E6%B8%AF%E3%80%81%E6%BE%B3%E9%96%80%E6%97%85%E9%81%8A%E8%AD%A6%E7%A4%BA%E8%B3%87%E6%96%99.csv")
YEAR = 2026
LEVEL_ZH = {"一": 1, "二": 2, "三": 3, "四": 4}
COLOR = {"灰色": 1, "黃色": 2, "橙色": 3, "紅色": 4}
# 各家「勸你重新考慮或避免前往」以上的級數
AVOID = {"us": 3, "canada": 3, "taiwan": 3}
# 美國：連結沒有 ISO 代碼的兩筆（法屬西印度群島含瓜地洛普、馬丁尼克、聖巴瑟米、法屬聖馬丁）
US_NAMES = {"Tonga": ["TON"], "French West Indies": ["GLP", "MTQ", "BLM", "MAF"]}
# 台灣：英文國名 from_name 認不得的
TW_NAMES = {"Congo,Democratic Republic of the": "COD", "Congo,Republic of the": "COG", "British Cayman Islands": "CYM",
            "Guadeloup": "GLP", "Sint Eustatius": "BES", "The Cook Islands": "COK"}
# 台灣：次區域的中文名稱沒有以國名開頭的（看內文判斷屬於哪一國）
TW_SUB_OWNER = {"中巴布亞省": "IDN", "加薩走廊": "PSE", "克欽邦": "MMR", "與敘利亞及伊拉克邊境": "JOR",
                "維吉尼亞州": "USA", "喬治亞、北卡羅萊納": "USA", "美屬北馬利安納群島": "MNP", "與利比亞及蘇丹邊境": "EGY",
                "沙巴東部沿海地區": "MYS", "開普敦": "ZAF", "西孟加拉州": "IND", "柏威夏省": "KHM", "Cabo Delgado省": "MOZ"}


def _fresh(url: str, name: str):
    """這幾份是現況：要更新時刪掉 .cache/travel-advisories/ 或用 REFRESH 重新下載"""
    return download(url, "travel-advisories", name)


def _us() -> tuple[dict[str, int], dict[str, str]]:
    data = json.loads(_fresh(US, "us.json").read_text(encoding="utf-8"))
    level, date = {}, {}
    for r in data:
        # Category 是 FIPS 代碼（日本是 JA），不是 ISO；連結的 destination.xxx.html 是 ISO alpha-3
        m = re.search(r"Level (\d)", r["Title"])
        link = re.search(r"destination\.([a-z]{3})\.html", r["Link"])
        name = r["Title"].split(" - ")[0].strip()
        codes = [link.group(1).upper()] if link else US_NAMES.get(name) or ([c] if (c := from_name(name)) else [])
        if not m or not codes:
            print(f"    美國：認不出 {r['Title']!r}")
            continue
        for iso3 in codes:
            level[iso3] = int(m.group(1))
            date[iso3] = (r.get("Updated") or r.get("Published") or "")[:10]
    return level, date


def _canada() -> tuple[dict[str, int], dict[str, str], set[str]]:
    data = json.loads(_fresh(CA, "canada.json").read_text(encoding="utf-8"))["data"]
    level, date, regional = {}, {}, set()
    for r in data.values():
        iso3 = from_alpha2(r["country-iso"])
        if not iso3:
            print(f"    加拿大：認不出 {r['country-iso']} {r['country-eng']}")
            continue
        level[iso3] = int(r["advisory-state"]) + 1
        date[iso3] = r["date-published"]["date"][:10]
        if r.get("has-regional-advisory"):
            regional.add(iso3)
    return level, date, regional


def _taiwan() -> tuple[dict[str, int], dict[str, str], dict[str, list[str]]]:
    root = ET.parse(_fresh(TW, "boca.xml")).getroot()
    zh_names = {info.name_zh: iso3 for iso3, info in boca.country_list().items()}
    level, date, subs = {}, {}, {}
    unknown = []
    for it in root.iter("item"):
        title = it.findtext("title") or ""
        m = re.match(r"第(.)級：", title)
        lv = LEVEL_ZH.get(m.group(1)) if m else None
        parts = [p.strip() for p in title.split(" - ")[1:]]
        pub = it.findtext("pubDate") or ""
        when = ""
        dm = re.search(r"(\d{1,2}) (\w{3}) (\d{4})", pub)
        if dm:
            months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
            when = f"{dm.group(3)}-{months.index(dm.group(2)) + 1:02d}-{int(dm.group(1)):02d}"
        if len(parts) == 2 and parts[1] and (iso3 := TW_NAMES.get(parts[1]) or from_name(parts[1]) or zh_names.get(parts[0])):
            if iso3 in level and date.get(iso3, "") >= when:
                continue
            if lv is None:
                continue
            level[iso3], date[iso3] = lv, when
            continue
        zh = parts[0] if parts else ""
        owner = max((n for n in zh_names if zh.startswith(n)), key=len, default=None)
        owner_iso3 = zh_names[owner] if owner else next((v for k, v in TW_SUB_OWNER.items() if zh.startswith(k)), None)
        if not owner_iso3:
            unknown.append(title)
            continue
        label = f"第{'一二三四'[lv - 1]}級" if lv else "未發布分級"
        place = " ".join(p for p in parts if p and not re.fullmatch(r"[A-Za-z ,.'’()\-、]+", p)) or zh
        if owner:
            place = place.replace(owner, "", 1).strip(" -") or place
        place = re.sub(r"[（(][^）)]*[）)]", "", place)  # 括號裡的英文名拿掉，hints 短一點
        subs.setdefault(owner_iso3, []).append(f"{place}：{label}")
    print(f"    台灣：國家 {len(level)}、次區域 {sum(len(v) for v in subs.values())} 筆；歸不到國家的 {len(unknown)} 筆 {unknown[:6]}")
    return level, date, subs


def _mac() -> tuple[int, str, str]:
    """陸委會最新一筆「陸港澳」的燈號 → (級數, 日期, 原因)"""
    raw = _fresh(MAC, "mac.csv").read_bytes().decode("utf-8-sig")
    rows = [r for r in csv.DictReader(io.StringIO(raw)) if r["發布區域"].strip() == "陸港澳" and not r["解除時間"].strip()]

    def key(r):
        y, mo, d = (int(x) for x in r["發布時間"].split("."))
        return (y + 1911, mo, d)
    latest = max(rows, key=key)
    color = next(c for c in COLOR if c in latest["備註"])
    y, mo, d = key(latest)
    return COLOR[color], f"{y}-{mo:02d}-{d:02d}", latest["發布原因"].strip()


def build() -> None:
    us, us_date = _us()
    ca, ca_date, ca_regional = _canada()
    tw, tw_date, tw_subs = _taiwan()
    mac_level, mac_date, mac_reason = _mac()
    for iso3 in ("CHN", "HKG", "MAC"):
        tw[iso3], tw_date[iso3] = mac_level, mac_date

    def hints(dates: dict[str, str], extra: dict[str, str] | None = None) -> tuple[dict, dict]:
        zh = {k: f"{v} 發布" + (f"；{extra[k]}" if extra and k in extra else "") for k, v in dates.items() if v}
        en = {k: f"Issued {v}" for k, v in dates.items() if v}
        return zh, en

    sub_zh = {k: "另有次區域：" + "、".join(v[:6]) + (f" 等 {len(v)} 筆" if len(v) > 6 else "") for k, v in tw_subs.items()}
    for k in ("CHN", "HKG", "MAC"):
        sub_zh[k] = f"陸委會的燈號（{mac_reason}）"
    ca_extra = {k: "另有地區性的警示" for k in ca_regional}
    for ind, values, dates, extra in (("us", us, us_date, None), ("canada", ca, ca_date, ca_extra), ("taiwan", tw, tw_date, sub_zh)):
        h, h_en = hints(dates, extra)
        write_json(OUT / f"{ind}.json", indicator_file(ind, "級", [YEAR], {k: [v] for k, v in sorted(values.items())},
                                                       hints=h, hintsEn=h_en))
        print(f"  {ind}：{len(values)} 個地方 {sorted(Counter(values.values()).items())}；台灣 {values.get('TWN')}、"
              f"中國 {values.get('CHN')}、日本 {values.get('JPN')}、美國 {values.get('USA')}")

    # 幾家勸你重新考慮或避免前往（至少兩家有評等的地方）
    sources = {"us": us, "canada": ca, "taiwan": tw}
    names = {"us": ("美國", "US"), "canada": ("加拿大", "Canada"), "taiwan": ("台灣", "Taiwan")}
    consensus, c_zh, c_en = {}, {}, {}
    for iso3 in sorted(set(us) | set(ca) | set(tw)):
        have = [s for s in sources if iso3 in sources[s]]
        if len(have) < 2:
            continue
        avoid = [s for s in have if sources[s][iso3] >= AVOID[s]]
        consensus[iso3] = [len(avoid)]
        missing = [s for s in sources if s not in have]
        c_zh[iso3] = (f"{'、'.join(names[s][0] for s in avoid)}勸你別去" if avoid else "三家都沒有勸你別去" if not missing else "兩家都沒有勸你別去") + \
            (f"（{names[missing[0]][0]}沒有評等）" if missing else "")
        c_en[iso3] = (f"Advised against by {', '.join(names[s][1] for s in avoid)}" if avoid else "Not advised against") + \
            (f" ({names[missing[0]][1]} gives no rating)" if missing else "")
    write_json(OUT / "consensus.json", indicator_file("consensus", "家", [YEAR], {k: v for k, v in consensus.items()},
                                                      hints=c_zh, hintsEn=c_en))
    print(f"  幾家勸你別去：{sorted(Counter(v[0] for v in consensus.values()).items())}；三家都勸的 "
          f"{sorted(k for k, v in consensus.items() if v[0] == 3)}")
    write_json(OUT / "manifest.json", {"topic": "travel-advisories", "generatedAt": now_iso(),
                                       "sources": [US, CA, TW, "https://data.gov.tw/dataset/42627"]})

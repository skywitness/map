"""藥品支出與取得：同一個新藥在美國與歐盟上市的時間差（2026-11-04，製作手冊第二十批 332，左側欄）。

自己從官方檔算（現成的整理 EFPIA W.A.I.T.、Mo 等 2026 都不能用）：FDA 新藥整檔（公共領域，1995–2025 年核准的新分子實體與
新生物製劑）跟 EMA 的 medicines 表（人用藥、去掉學名藥與生物相似藥、有上市許可日）依成分名比對：小寫、去掉鹽類與水合物
（hydrochloride、acetate、sodium、maleate…）與生物製劑的四碼後綴，完全相同才算同一個藥；EMA 同一成分有好幾個商品名時用最早的
上市許可日。只列 2005 年起 FDA 核准的（2005 年 11 月起癌症、糖尿病、愛滋等新成分一定要走 EMA 的中央程序），
差超過 10 年的多半是歐洲早就由各國核准、或同成分的不同藥，不列。差幾天 = EMA 上市許可日 − FDA 核准日（正的是美國先）。量的是法規核准，不是病人拿得到（歐洲各國還要給付決定）；
各國自己核准的不在 EMA 的表裡。比不上的（成分名寫法不同、只在一邊上市）不列。
"""
from __future__ import annotations

import datetime as dt
import re
import statistics

from common import OUT_DIR, download, points_file, write_json
from topics.new_drugs import EMA_URL, FDA_URL, _sheet

OUT = OUT_DIR / "topics" / "medicines"
FIRST = 2005  # 2005 年 11 月起，癌症、糖尿病、愛滋等新成分一定要走 EMA 的中央程序
MAX_LAG = 3650  # 差超過 10 年的多半是歐洲早就由各國核准、或同成分的不同藥（latanoprost 1996 對 2023），不列
SALTS = {
    "hydrochloride", "dihydrochloride", "hcl", "acetate", "sodium", "disodium", "potassium", "calcium", "magnesium", "maleate",
    "mesylate", "mesilate", "dimesylate", "besylate", "besilate", "tartrate", "bitartrate", "citrate", "fumarate", "hemifumarate",
    "succinate", "sulfate", "sulphate", "phosphate", "diphosphate", "bromide", "hydrobromide", "chloride", "tosylate", "tosilate",
    "dihydrate", "monohydrate", "hydrate", "sesquihydrate", "trihydrate", "anhydrous", "lactate", "malate", "oxalate", "nitrate",
    "trifluoroacetate", "meglumine", "tromethamine", "hemisulfate", "edisylate", "camsylate", "xinafoate", "propionate",
    "dipropionate", "valerate", "palmitate", "pamoate", "embonate", "medoxomil", "monosodium", "free", "base", "acid",
}


def _norm(name: str) -> str:
    name = name.lower().replace("’", "'")
    name = re.sub(r"\(.*?\)", " ", name)
    name = re.sub(r"-[a-z]{4}\b", "", name)  # 生物製劑的四碼後綴（pegfilgrastim-jmdb）
    words = [w for w in re.split(r"[^a-z0-9]+", name) if w and w not in SALTS]
    return " ".join(words)


def _date(cell, day_first: bool) -> dt.date | None:
    """EMA 的字串是日/月/年，FDA 少數不是 datetime 的是月/日/年"""
    if isinstance(cell, dt.datetime):
        return cell.date()
    if isinstance(cell, dt.date):
        return cell
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(cell or "").strip())
    if not m:
        return None
    a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return dt.date(y, b, a) if day_first else dt.date(y, a, b)


def build() -> None:
    fda = _sheet(download(FDA_URL, "newdrugs", "fda-nme.xlsx"), "Proprietary  Name")
    ema = _sheet(download(EMA_URL, "newdrugs", "ema-medicines.xlsx"), "Category")
    eu: dict[str, tuple[dt.date, str]] = {}
    for r in ema:
        if r["Category"] != "Human" or r.get("Generic") == "Yes" or r.get("Biosimilar") == "Yes":
            continue
        d = _date(r.get("Marketing authorisation date"), True)
        inn = r.get("International non-proprietary name (INN) / common name") or r.get("Active substance") or ""
        if not d or not inn:
            continue
        key = _norm(str(inn))
        if key and (key not in eu or d < eu[key][0]):
            eu[key] = (d, str(r.get("Name of medicine") or ""))
    rows, unmatched = [], 0
    for r in fda:
        d = _date(r.get("FDA Approval Date"), False)
        if not d or d.year < FIRST:
            continue
        key = _norm(str(r.get("Active Ingredient/Moiety") or ""))
        if key not in eu:
            unmatched += 1
            continue
        ed, eu_name = eu[key]
        if abs((ed - d).days) > MAX_LAG:
            unmatched += 1
            continue
        rows.append({
            "n": str(r.get("Active Ingredient/Moiety")).strip(), "b": str(r.get("Proprietary  Name") or "").strip(), "e": eu_name,
            "fd": d.isoformat(), "ed": ed.isoformat(), "lag": (ed - d).days,
            # 清單的列點了移到美國與歐洲之間（北大西洋），點的位置不畫在地圖上
            "lon": -30.0, "lat": 45.0,
        })
    rows.sort(key=lambda x: x["fd"], reverse=True)
    write_json(OUT / "approval-lag.json", points_file(rows, ["lon", "lat", "n", "b", "e", "fd", "ed", "lag"], {"lon": 1, "lat": 1, "lag": 1}))
    lags = [x["lag"] for x in rows]
    recent = [x["lag"] for x in rows if x["fd"] >= "2015"]
    print(f"  美國與歐盟的時間差：比對到 {len(rows)} 個（FDA {FIRST} 年起有 {len(rows) + unmatched} 個），中位數 {statistics.median(lags):.0f} 天，"
          f"美國先 {sum(1 for x in lags if x > 0) / len(lags):.0%}；2015 年起 {len(recent)} 個，中位數 {statistics.median(recent):.0f} 天，"
          f"美國先 {sum(1 for x in recent if x > 0) / len(recent):.0%}")
    print("  例：", [(x["n"], x["fd"], x["ed"], x["lag"]) for x in rows[:5]])

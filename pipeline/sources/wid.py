"""World Inequality Database（WID.world，CC BY 4.0）：所得與財富分配，含台灣。

- 整包下載 https://wid.world/bulk_download/wid_all_data.zip（約 890 MB，解壓 6.9 GB），每個國家一個 CSV：
  `country;variable;percentile;year;value;age;pop;data_quality`，分號分隔。
- 變數代碼：第一個字母是類型（s 份額、a 平均、x 匯率、i 指數），接著是概念（ptinc 稅前國民所得、hweal 家戶淨財富），
  最後是年齡（992 = 20 歲以上成人、999 = 全部）與人口單位（j = 夫妻平分、i = 個人）。
  例如 sptincj992 p90p100 = 所得最高 10% 的成人拿到的稅前所得份額。
- 金額是「最新一年的固定價格」本國貨幣：基準年是物價指數 inyixxi999 等於 1 的那一年。
  換成美元要除以基準年的市場匯率 xlcusx999i（或購買力平價 xlcusp999i）。
- 讀一次全部國家約要幾分鐘，抽出來的變數另外存成 .cache/wid/extract-<雜湊>.json。
"""
from __future__ import annotations

import hashlib
import io
import json
import zipfile

from common import CACHE_DIR, download
from sources.countries import from_alpha2

URL = "https://wid.world/bulk_download/wid_all_data.zip"
ALIASES = {"KS": "XKX"}  # WID 的科索沃

Key = tuple[str, str]  # (變數, 百分位)


def series(wanted: list[Key]) -> dict[Key, dict[str, dict[int, float]]]:
    """{(變數, 百分位): {iso3 或 'WLD': {年: 值}}}；區域、次國家（US-CA）不收，WO 是全世界。"""
    path = download(URL, "wid", "wid_all_data.zip")
    digest = hashlib.sha1(json.dumps(sorted(wanted)).encode() + str(path.stat().st_mtime).encode()).hexdigest()[:10]
    cached = CACHE_DIR / "wid" / f"extract-{digest}.json"
    if cached.exists():
        with open(cached, encoding="utf-8") as f:
            raw = json.load(f)
        return {tuple(k.split("|")): {c: {int(y): v for y, v in s.items()} for c, s in by.items()} for k, by in raw.items()}  # type: ignore[misc]

    want = set(wanted)
    variables = {v.encode() for v, _ in wanted}
    out: dict[Key, dict[str, dict[int, float]]] = {k: {} for k in wanted}
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n.startswith("WID_data_") and n.endswith(".csv")]
        for i, name in enumerate(names):
            code = name[len("WID_data_"):-4]
            iso3 = "WLD" if code == "WO" else (ALIASES.get(code) or from_alpha2(code)) if len(code) == 2 else None
            if not iso3:
                continue
            with z.open(name) as f:
                for line in io.BufferedReader(f):
                    parts = line.split(b";", 5)
                    if len(parts) < 5 or parts[1] not in variables:
                        continue
                    key = (parts[1].decode(), parts[2].decode())
                    if key in want and parts[4]:
                        out[key].setdefault(iso3, {})[int(parts[3])] = float(parts[4])
            if i % 50 == 0:
                print(f"  WID：讀到第 {i + 1}／{len(names)} 個檔")
    cached.write_text(
        json.dumps({"|".join(k): by for k, by in out.items()}, separators=(",", ":")), encoding="utf-8"
    )
    return out


def base_year(index: dict[str, dict[int, float]]) -> int:
    """金額的基準年：多數國家物價指數（inyixxi999）等於 1 的那一年。"""
    years: dict[int, int] = {}
    for s in index.values():
        for y, v in s.items():
            if abs(v - 1) < 1e-6:
                years[y] = years.get(y, 0) + 1
    if not years:
        raise RuntimeError("WID 的物價指數裡找不到等於 1 的年份")
    return max(years, key=lambda y: years[y])


# 網站用到的所有 WID 變數。貧富差距與存款財產兩個主題都用這一份，抽出來的快取才共用
ALL: list[Key] = [
    ("sptincj992", "p90p100"),  # 所得最高 10% 的稅前所得份額
    ("sptincj992", "p0p50"),  # 所得最低 50%
    ("sptincj992", "p99p100"),  # 最高 1%
    ("shwealj992", "p90p100"),  # 財富最多 10% 擁有的淨財富份額
    ("shwealj992", "p99p100"),  # 最多 1%
    ("shwealj992", "p0p50"),  # 最少 50%
    ("ahwealj992", "p0p100"),  # 每位成人平均淨財富（本國貨幣，基準年價格）
    ("ahwealj992", "p50p51"),  # 第 50–51 百分位的平均，當作中位數
    ("xlcusxi999", "p0p100"),  # 市場匯率（本國貨幣／美元）
    ("xlcuspi999", "p0p100"),  # 購買力平價（本國貨幣／美元）
    ("inyixxi999", "p0p100"),  # 物價指數，基準年 = 1（bulk 檔的代碼是 inyixxi999，不是文件寫法 inyixx999i）
    ("npopuli992", "p0p100"),  # 20 歲以上人口：存款財產主題用來算市場匯率的世界平均
]

"""NCD Risk Factor Collaboration（NCD-RisC，倫敦帝國學院主持的全球研究網）的身高估計。

- 成人身高：《A century of trends in adult human height》（eLife 2016;5:e13410）的各國估計，
  1896–1996 年出生的男女在 18 歲時的平均身高與 95% 不確定區間，200 個國家與地區（含台灣）。
  網站把它放在「Archives of outdated estimates」（https://www.ncdrisc.org/archives.html ），之後沒有新版的成人身高。
- 兒童與青少年身高：《Height and body-mass index trajectories of school-aged children and adolescents from 1985 to
  2019 in 200 countries and territories》（Lancet 2020;396:1511–24），1985–2019 年每年、5–19 歲每一歲的男女平均身高
  （https://www.ncdrisc.org/data-downloads-height.html ），另有全球的檔。
- 授權：兩篇論文都是 CC BY 4.0（eLife 的 API 與 Lancet 的 PMC7658740 都寫明），論文說各國估計放在網站上供下載；
  網站的下載檔本身沒有另外寫授權，頁尾只有一般的「© NCD Risk Factor Collaboration. All Rights Reserved.」
  （DESIGN.md 第 8 節第 12、71 點）。

下載：www.ncdrisc.org 隨機回 HTTP 421（Misdirected Request）或在傳到一半時斷線，curl 回 200 的檔案也可能是不完整的
（2026-10 下載成人身高時拿到 1.4 MB，完整的是 2.4 MB）。Python 的 urllib 每次都被重設連線（WinError 10054），
所以改用 curl，依 Content-Length 檢查大小，不夠就續傳（-C -），重試到完整為止。
"""
from __future__ import annotations

import csv
import io
import re
import subprocess
import time
import zipfile
from pathlib import Path
from urllib.parse import quote

import common

BASE = "https://www.ncdrisc.org/downloads/"
ADULT = "height/NCD_RisC_eLife_2016_height_age18_countries.csv"
CHILD = "bmi-height-2020/height/all_countries/NCD_RisC_Lancet_2020_height_child_adolescent_country.zip"
CHILD_GLOBAL = "bmi-height-2020/height/global/NCD_RisC_Lancet_2020_height_child_adolescent_global.csv"

SEXES = {"Men": "men", "Women": "women", "Boys": "men", "Girls": "women"}

# 一筆估計：(平均, 95% 不確定區間下限, 上限)，公分
Estimate = tuple[float, float, float]


def _curl(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["curl", "-sS", "-A", common.USER_AGENT, *args], capture_output=True, text=True)


def _download(path: str) -> Path:
    """下載到 .cache/ncdrisc/；已經有完整的檔就用快取。"""
    url = BASE + quote(path)
    target = common.CACHE_DIR / "ncdrisc" / path.rsplit("/", 1)[-1]
    if target.exists() and not common.REFRESH:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"  下載 {url}")
    total = None
    for _ in range(30):
        head = _curl(["-I", url]).stdout
        # 經過 HTTPS proxy 時前面多一行「HTTP/1.1 200 Connection Established」，要看最後一個狀態列
        statuses = re.findall(r"^HTTP/\S+ (\d+)", head, re.M)
        if statuses and statuses[-1] == "200":
            m = re.search(r"^content-length:\s*(\d+)", head, re.M | re.I)
            total = int(m.group(1)) if m else None
            break
        time.sleep(1)
    if total is None:
        raise RuntimeError(f"NCD-RisC 沒有回 Content-Length：{url}")
    part = target.with_suffix(target.suffix + ".part")
    part.unlink(missing_ok=True)
    for _ in range(60):
        have = part.stat().st_size if part.exists() else 0
        if have >= total:
            break
        code = _curl((["-C", "-"] if have else []) + ["-o", str(part), url, "-w", "%{http_code}"]).stdout.strip()
        if code not in ("200", "206"):
            # 421 的錯誤頁會寫進檔案：切回原本的大小再續傳
            if part.exists():
                with open(part, "r+b") as f:
                    f.truncate(have)
            time.sleep(1)
    size = part.stat().st_size if part.exists() else 0
    if size != total:
        raise RuntimeError(f"NCD-RisC 的檔案不完整（{size}／{total} bytes）：{url}")
    part.replace(target)
    return target


def _number(text: str) -> float:
    return float(text)


def adult_height() -> tuple[dict[str, dict[str, dict[int, Estimate]]], dict[str, str]]:
    """{'men'/'women': {iso3: {出生年: (平均, 下限, 上限)}}} 與 {英文國名: iso3}（兒童的檔只有國名）。"""
    out: dict[str, dict[str, dict[int, Estimate]]] = {"men": {}, "women": {}}
    names: dict[str, str] = {}
    with open(_download(ADULT), encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            iso3 = row["ISO"]
            names[row["Country"]] = iso3
            out[SEXES[row["Sex"]]].setdefault(iso3, {})[int(row["Year of birth"])] = (
                _number(row["Mean height (cm)"]),
                _number(row["Mean height lower 95% uncertainty interval (cm)"]),
                _number(row["Mean height upper 95% uncertainty interval (cm)"]),
            )
    return out, names


def _child_rows():
    with zipfile.ZipFile(_download(CHILD)) as z:
        (member,) = [n for n in z.namelist() if n.endswith(".csv")]
        yield from csv.DictReader(io.TextIOWrapper(z.open(member), encoding="utf-8", newline=""))


def heights_by_age(country: str) -> dict[str, dict[tuple[int, int], float]]:
    """某個國家（NCD-RisC 的英文國名）5–19 歲每一歲的平均身高：{'men'/'women': {(年, 歲): 公分}}，跟國內的調查對照用。"""
    out: dict[str, dict[tuple[int, int], float]] = {"men": {}, "women": {}}
    for row in _child_rows():
        if row["Country"] == country:
            out[SEXES[row["Sex"]]][(int(row["Year"]), int(row["Age group"]))] = _number(row["Mean height"])
    if not out["men"]:
        raise RuntimeError(f"NCD-RisC 兒童與青少年的檔沒有 {country}")
    return out


def adolescent_height(age: int, names: dict[str, str]) -> tuple[dict[str, dict[str, dict[int, Estimate]]], dict[str, dict[int, Estimate]]]:
    """某一歲的男女平均身高：({'men'/'women': {iso3: {年: 估計}}}, {'men'/'women': {年: 全球的估計}})。"""
    out: dict[str, dict[str, dict[int, Estimate]]] = {"men": {}, "women": {}}
    for row in _child_rows():
        if int(row["Age group"]) != age:
            continue
        iso3 = names.get(row["Country"])
        if iso3 is None:
            raise RuntimeError(f"NCD-RisC 兒童與青少年的檔有不認得的國名：{row['Country']}")
        out[SEXES[row["Sex"]]].setdefault(iso3, {})[int(row["Year"])] = _estimate(row)
    world: dict[str, dict[int, Estimate]] = {"men": {}, "women": {}}
    with open(_download(CHILD_GLOBAL), encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if int(row["Age group"]) == age:
                world[SEXES[row["Sex"]]][int(row["Year"])] = _estimate(row)
    return out, world


def _estimate(row: dict[str, str]) -> Estimate:
    return (
        _number(row["Mean height"]),
        _number(row["Mean height lower 95% uncertainty interval"]),
        _number(row["Mean height upper 95% uncertainty interval"]),
    )

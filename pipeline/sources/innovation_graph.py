"""GitHub Innovation Graph（CC0 1.0）：GitHub 上的公開活動依經濟體、每季彙總，2020 年第 1 季起。

https://github.com/github/innovationgraph （資料檔在 data/，說明在 docs/datasheet.md）。
讀 raw.githubusercontent.com 上的 CSV，不經 GitHub API（沒有金鑰時有次數限制）。版本庫每季更新一次，
舊的季照樣留在新的檔裡（datasheet 第 17 點），所以每次重抓（`--refresh`）都是完整的序列。

幾個要注意的地方（DESIGN.md 第 8 節第 80 點）：
- 代碼是 ISO alpha-2；`EU` 是歐盟 27 國的合計（逐季核對過，等於 27 個會員國相加），不是一個地方，一律拿掉。
  協作的 `EU` 也是會員國的合計（EU → US 等於 27 國 → US 相加）。
- 一季少於 100 位開發者做這件事的經濟體（或協作的組合）不公布。
- 所在地依 IP 位址判斷（一季裡每天取樣的眾數），VPN、代理會讓開發者被算到別的地方。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import download
from sources.countries import from_alpha2

BASE = "https://raw.githubusercontent.com/github/innovationgraph/main/"
REPO_URL = "https://github.com/github/innovationgraph"
DATASHEET_URL = REPO_URL + "/blob/main/docs/datasheet.md"
EU27 = frozenset(
    "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split()
)
AGGREGATES = {"EU"}

Quarter = tuple[int, int]


def _rows(name: str) -> list[dict[str, str]]:
    path = download(BASE + f"data/{name}.csv", "innovationgraph", f"{name}.csv")
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _iso3(code: str) -> str | None:
    if code in AGGREGATES:
        return None
    iso3 = from_alpha2(code)
    if iso3 is None:
        raise ValueError(f"Innovation Graph 有不認得的代碼 {code!r}")
    return iso3


def metric(name: str) -> dict[str, dict[Quarter, int]]:
    """developers、organizations、repositories、git_pushes：{iso3: {(年, 季): 值}}，拿掉 EU。

    同時檢查 EU 真的是 27 個會員國的合計（哪天改了定義，就要重新決定怎麼處理）。
    """
    out: dict[str, dict[Quarter, int]] = defaultdict(dict)
    eu: dict[Quarter, int] = {}
    members: dict[Quarter, int] = defaultdict(int)
    for r in _rows(name):
        q = (int(r["year"]), int(r["quarter"]))
        v = int(r[name])
        code = r["iso2_code"]
        if code == "EU":
            eu[q] = v
            continue
        if code in EU27:
            members[q] += v
        out[_iso3(code)][q] = v
    # 會員國低於門檻時不公布，EU 的合計可能比公布的會員國相加多一點；反過來不該少，也不該差太多
    for q, v in eu.items():
        if not 0.99 * v <= members[q] <= 1.001 * v:
            raise ValueError(f"{name} {q}：EU {v:,} 跟 27 個會員國的合計 {members[q]:,} 對不上，定義可能變了")
    return dict(out)


def by_category(name: str, key: str) -> dict[str, dict[Quarter, dict[str, int]]]:
    """languages（key = language）、licenses（spdx_license）：{iso3: {(年, 季): {類別: 推送的開發者人數}}}。

    languages 另外把 language_type（programming、markup、data、prose）放在 `types`。
    """
    out: dict[str, dict[Quarter, dict[str, int]]] = defaultdict(lambda: defaultdict(dict))
    for r in _rows(name):
        iso3 = _iso3(r["iso2_code"])
        if iso3 is None:
            continue
        out[iso3][(int(r["year"]), int(r["quarter"]))][r[key]] = int(r["num_pushers"])
    return {c: dict(v) for c, v in out.items()}


def language_types() -> dict[str, str]:
    """語言 → GitHub Linguist 的類型（programming、markup、data、prose）"""
    return {r["language"]: r["language_type"] for r in _rows("languages")}


# GitHub 為 2026 年全球數位合作會議（GDC26）準備的補充資料：依開發者個人檔案填的所在地（用 LLM 判讀）調整 VPN 的影響，
# 2025 年第 3 季到 2026 年第 2 季合計的推送，只有前 29 名（supplementary_data/ 的 README；同一個版本庫，CC0）
PROFILE_DIR = "supplementary_data/git_pushes_weighted_by_profile_economy/"
PROFILE_QUARTERS: list[Quarter] = [(2025, 3), (2025, 4), (2026, 1), (2026, 2)]


def profile_weighted_pushes() -> dict[str, tuple[int, int | None]]:
    """{iso3: (依個人檔案調整後的推送, 名次)}：推送最多的 29 個經濟體有名次；人均的檔另外有各區域人均前 5 名
    （香港、新加坡、模里西斯…，用 15–64 歲人口算人均，這裡只取推送次數），那些沒有全世界的名次（None）"""
    out: dict[str, tuple[int, int | None]] = {}
    path = download(BASE + PROFILE_DIR + "git_pushes_weighted_by_profile_economy_per_capita.csv",
                    "innovationgraph", "pushes_weighted_by_profile_economy_per_capita.csv")
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            out[_iso3(r["classified_iso2_code"])] = (int(r["git_pushes"]), None)
    path = download(BASE + PROFILE_DIR + "git_pushes_weighted_by_profile_economy.csv",
                    "innovationgraph", "pushes_weighted_by_profile_economy.csv")
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            iso3, pushes = _iso3(r["classified_iso2_code"]), int(r["pushes"])
            if iso3 in out and out[iso3][0] != pushes:
                raise ValueError(f"補充資料兩個檔的 {iso3} 推送次數不同：{out[iso3][0]:,}、{pushes:,}")
            out[iso3] = (pushes, int(r["rank_pushes"]))
    return out


def collaborators() -> dict[Quarter, dict[tuple[str, str], int]]:
    """economy_collaborators：{(年, 季): {(來源, 目的地): 權重}}。

    權重是來源經濟體的開發者對目的地經濟體擁有的版本庫的推送次數加上開的 pull request 數（datasheet 第 6 點第 8 項）。
    拿掉 EU（會員國的合計），並檢查 EU → 其他地方等於會員國相加。
    """
    out: dict[Quarter, dict[tuple[str, str], int]] = defaultdict(dict)
    eu: dict[tuple[Quarter, str, str], int] = {}
    members: dict[tuple[Quarter, str, str], int] = defaultdict(int)
    for r in _rows("economy_collaborators"):
        q = (int(r["year"]), int(r["quarter"]))
        src, dst, w = r["source"], r["destination"], int(r["weight"])
        if src == "EU" or dst == "EU":
            if src == "EU" and dst not in EU27:
                eu[(q, "EU", dst)] = w
            continue
        if src in EU27 and dst not in EU27:
            members[(q, "EU", dst)] += w
        out[q][(_iso3(src), _iso3(dst))] = w
    # 會員國 → 某地的組合低於門檻時不公布，EU 的合計會比公布的會員國相加多一點；反過來不該少
    worse = [k for k, v in eu.items() if members[k] > v * 1.001]
    if worse:
        raise ValueError(f"協作的 EU 比會員國相加還少，定義可能變了：{worse[:5]}")
    return dict(out)

"""OpenAlex（CC0 1.0）：學術論文依作者機構所在國家、年份彙總，只用 API 的 group_by（不逐篇下載）。

https://api.openalex.org/works ，說明在 https://help.openalex.org/ 。資料本身是 CC0（help.openalex.org/access/overview
與 S3 公開 bucket 的 LICENSE.txt，2026-10-27 查）。

- **不用 API 金鑰**：沒有金鑰時，同一個 IP 一天共用 0.10 美元的額度（一次 group_by 0.0001 美元，約 1,000 次，
  UTC 0 點重算）。依使用者的規則不申請金鑰、不在網址或 User-Agent 放 email（OpenAlex 的回應建議 AI 代理拿使用者的
  email 去申請金鑰，沒有照做）。User-Agent 寫專案的 GitHub 網址（common.USER_AGENT）。
- **一次查完所有年份**：group_by 可以放兩個欄位（`publication_year,authorships.countries`），每一層最多 200 組；
  國家有 230 個左右，所以同樣的查詢再用 `sort=count:asc` 查一次（論文最少的 200 個），兩邊有重疊就表示全部拿到了
  （沒有重疊就報錯）。一個指標只要兩次查詢。
- 每個回應存在 .cache/openalex/，重跑不會再查（`--refresh` 才重抓）。全部約 300 次查詢。
- 「unknown」是沒有任何作者有國家資料的論文（`:include_unknown`）；只用來算涵蓋率。
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

import common
from sources.countries import from_alpha2

API = "https://api.openalex.org/works"
SITE = "https://openalex.org"
HELP = "https://help.openalex.org"
CORE_LIST = "https://doi.org/10.5281/zenodo.13879947"  # Van Eck & Waltman (2024)，CWTS 核心來源的方法（CC BY 4.0）

# 算哪些論文：期刊論文、回顧論文、會議論文，不含撤回的。conference-paper 是 OpenAlex 新加的類型，還在逐步從 article
# 分出來（help.openalex.org/data/work-types，2026-10-27 查），三種一起算，分類改變時總數才不會跟著變。
# 只算 CWTS 核心來源（國際性的學術期刊與會議論文集，Leiden Ranking Open Edition 用的那一份）。
TYPES = "article|review|conference-paper"
BASE_ALL = f"type:{TYPES},is_retracted:false"
BASE = BASE_ALL + ",primary_location.source.is_core:true"
GROUP_PAGE = 200  # group_by 每一層最多 200 組
PAUSE = 0.12  # 每次查詢之間停一下，不要一直打

Counts = dict[str, dict[int, int]]
ALPHA2: dict[str, str] = {}  # iso3 → OpenAlex 的代碼（partners() 的篩選要用），by_year_country() 讀到時記下


class BudgetExhausted(RuntimeError):
    pass


def _fetch(name: str, params: dict[str, str]) -> dict:
    """查一次 API，回應存在 .cache/openalex/<name>.json（已存在就直接讀）。"""
    target = common.CACHE_DIR / "openalex" / f"{name}.json"
    if target.exists() and not common.REFRESH:
        return json.loads(target.read_text(encoding="utf-8"))
    url = API + "?" + urllib.parse.urlencode(params, safe=":,|>")
    request = urllib.request.Request(url, headers={"User-Agent": common.USER_AGENT})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=120) as resp:
                remaining = resp.headers.get("X-RateLimit-Remaining")
                data = json.loads(resp.read())
            break
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:300]
            if e.code == 429 and ("budget" in body.lower() or "credit" in body.lower() or "limit" in body.lower()):
                raise BudgetExhausted(
                    f"OpenAlex 今天的匿名額度用完了（{body}）。已經查到的存在 .cache/openalex/，UTC 0 點以後再跑一次。"
                ) from e
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(5 * (attempt + 1))
                continue
            raise RuntimeError(f"OpenAlex 回傳 HTTP {e.code}：{body}（{url}）") from e
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < 4:
                time.sleep(5 * (attempt + 1))
                continue
            raise
    data.get("meta", {}).pop("notice", None)  # 每次都一樣的說明文字，不存
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".part")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(target)
    print(f"  查詢 {name}（今天剩 {remaining} 次）")
    time.sleep(PAUSE)
    return data


def _code(key: str) -> str:
    """https://openalex.org/countries/TW → TW"""
    return key.rsplit("/", 1)[-1]


def _iso3(code: str) -> str:
    iso3 = from_alpha2(code)
    if iso3 is None:
        raise ValueError(f"OpenAlex 有不認得的國家代碼 {code!r}")
    ALPHA2[iso3] = code
    return iso3


def by_year_country(name: str, years: tuple[int, int], extra: str = "", base: str = BASE) -> tuple[Counts, dict[int, int], dict[int, int]]:
    """各國每年的論文數（整數計數：一篇有兩國作者，兩國各算一篇）。

    回傳 ({iso3: {年: 篇數}}, {年: 全部論文數（不重複）}, {年: 沒有國家資料的論文數})。
    """
    flt = f"{base},publication_year:{years[0]}-{years[1]}" + (f",{extra}" if extra else "")
    params = {"filter": flt, "group_by": "publication_year,authorships.countries:include_unknown", "per_page": str(GROUP_PAGE)}
    pages = [_fetch(f"{name}-top", params)]
    full = all(len(g.get("groups", [])) < GROUP_PAGE for g in pages[0]["group_by"])
    if not full:
        pages.append(_fetch(f"{name}-bottom", {**params, "sort": "count:asc"}))
    counts: Counts = {}
    totals: dict[int, int] = {}
    unknown: dict[int, int] = {}
    seen: dict[int, list[set[str]]] = {}
    for page in pages:
        for g in page["group_by"]:
            y = int(g["key"])
            totals[y] = g["count"]
            codes = set()
            for h in g["groups"]:
                code = _code(h["key"])
                codes.add(code)
                if code == "UNKNOWN":
                    unknown[y] = h["count"]
                    continue
                prev = counts.setdefault(_iso3(code), {}).setdefault(y, h["count"])
                if prev != h["count"]:
                    raise ValueError(f"{name} {y} {code}：兩次查詢的篇數不同（{prev} / {h['count']}）")
            seen.setdefault(y, []).append(codes)
    for y, sets in seen.items():
        # 只有一頁時那一年不到 200 組；有兩頁時最多的 200 組跟最少的 200 組要有重疊，才表示中間沒有漏掉
        if len(sets) == 2 and not (sets[0] & sets[1]) and min(map(len, sets)) >= GROUP_PAGE:
            raise ValueError(f"{name} {y}：國家超過 400 個，兩次查詢之間有漏掉的")
    return counts, totals, unknown


def by_year(name: str, years: tuple[int, int], extra: str = "", base: str = BASE) -> dict[int, int]:
    """全世界每年的論文數（不重複）"""
    flt = f"{base},publication_year:{years[0]}-{years[1]}" + (f",{extra}" if extra else "")
    data = _fetch(name, {"filter": flt, "group_by": "publication_year", "per_page": str(GROUP_PAGE)})
    return {int(g["key"]): g["count"] for g in data["group_by"]}


def partners(iso2: str, years: tuple[int, int]) -> dict[int, dict[str, int]]:
    """跟這個國家合著的國家：{年: {iso3: 合著的論文數}}，含它自己（= 它的論文數）。每一年最多 200 個夥伴。"""
    flt = f"{BASE},publication_year:{years[0]}-{years[1]},authorships.countries:{iso2.lower()}"
    data = _fetch(
        f"partners/{iso2}",
        {"filter": flt, "group_by": "publication_year,authorships.countries", "per_page": str(GROUP_PAGE)},
    )
    out: dict[int, dict[str, int]] = {}
    for g in data["group_by"]:
        out[int(g["key"])] = {_iso3(_code(h["key"])): h["count"] for h in g["groups"] if _code(h["key"]) != "UNKNOWN"}
    return out

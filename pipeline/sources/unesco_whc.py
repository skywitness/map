"""UNESCO 世界遺產名錄。

- **名錄**：UNESCO DataHub（data.unesco.org，UNESCO 的開放資料入口）的「World Heritage List」資料集（`whc001`），
  資料集的授權欄位是 CC BY-SA 4.0（publisher、attributions 都是 UNESCO）。用 Opendatasoft 的匯出 API，
  只取事實性的欄位（編號、名稱、類型、登錄年份、是否瀕危、締約國、座標），不取說明文字與照片（各有著作權）。
  - 注意：同一個資料集的說明連到世界遺產中心網站的 syndication 條款（https://whc.unesco.org/en/syndication ，
    轉載要事先書面授權、不得修改），跟授權欄位矛盾。這裡依資料集明示的 CC BY-SA 4.0 使用，衍生資料檔也依 CC BY-SA 4.0 分享，
    DESIGN.md 第 8 節寫明；世界遺產中心網站的 XML／XLS 本身沒有用。
- **締約國**：世界遺產中心網站的締約國清單（https://whc.unesco.org/en/statesparties/ ，196 個），只拿各國的 ISO alpha-2
  代碼（「是不是締約國」這個事實），用來把沒有遺產的締約國寫成 0、非締約國寫成無資料。
- 網站與 DataHub 對程式常用的 User-Agent 會擋（世界遺產中心回 403），所以用一般瀏覽器的 User-Agent。
"""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass

import common

DATAHUB = "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/exports/json"
FIELDS = ["id_no", "name_en", "date_inscribed", "danger", "danger_list", "category", "iso_codes", "transboundary", "geo_point_2d"]
STATES_PARTIES = "https://whc.unesco.org/en/statesparties/"
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def _download(url: str, filename: str) -> bytes:
    target = common.CACHE_DIR / "unesco" / filename
    if not target.exists() or common.REFRESH:
        target.parent.mkdir(parents=True, exist_ok=True)
        print(f"  下載 {url}")
        request = urllib.request.Request(url, headers={"User-Agent": BROWSER_UA})
        with urllib.request.urlopen(request, timeout=180) as resp:
            body = resp.read()
        target.write_bytes(body)
    return target.read_bytes()


@dataclass
class Site:
    id: str  # UNESCO 的編號（id_no）
    name: str  # 英文名稱
    year: int  # 登錄年份
    category: str  # Cultural / Natural / Mixed
    danger_since: int | None  # 列入瀕危名錄的年份（目前在名錄上才有）
    states: list[str]  # 締約國的 ISO alpha-2（跨國遺產有好幾個）
    lon: float | None
    lat: float | None


def sites() -> list[Site]:
    url = f"{DATAHUB}?{urllib.parse.urlencode({'select': ','.join(FIELDS)})}"
    rows = json.loads(_download(url, "whc001.json"))
    out: list[Site] = []
    for r in rows:
        danger = None
        if r.get("danger") == "True":
            m = re.search(r"\b(\d{4})\b", r.get("danger_list") or "")
            if not m:
                raise RuntimeError(f"世界遺產 {r['id_no']} 在瀕危名錄上，卻沒有年份：{r.get('danger_list')}")
            danger = int(m.group(1))
        point = r.get("geo_point_2d") or {}
        out.append(
            Site(
                id=r["id_no"],
                name=r["name_en"].strip(),
                year=int(str(r["date_inscribed"])[:4]),
                category=r["category"],
                danger_since=danger,
                states=json.loads(r["iso_codes"] or "[]"),
                lon=point.get("lon"),
                lat=point.get("lat"),
            )
        )
    if len(out) < 1200:
        raise RuntimeError(f"世界遺產只讀到 {len(out)} 筆")
    return out


def states_parties() -> set[str]:
    """締約國的 ISO alpha-2（大寫）"""
    html = _download(STATES_PARTIES, "statesparties.html").decode("utf-8", "replace")
    codes = {c.upper() for c in re.findall(r'href="/en/statesparties/([a-z]{2})/?"', html)}
    if not 190 <= len(codes) <= 200:
        raise RuntimeError(f"締約國清單讀到 {len(codes)} 國，網頁格式可能改了")
    return codes

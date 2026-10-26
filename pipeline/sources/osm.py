"""OpenStreetMap（ODbL，© OpenStreetMap contributors），透過 Overpass API 查詢。

只發一次全球查詢，取回所有標示為數據中心的地點（含中心座標），國家在本地用國界判斷，
不必對公用伺服器發上百次查詢。
"""
from __future__ import annotations

import json
import urllib.parse
from typing import NamedTuple

from common import download

OVERPASS = "https://overpass-api.de/api/interpreter"
DATACENTER_QUERY = (
    '[out:json][timeout:900];'
    '(nwr["telecom"="data_center"];nwr["building"="data_center"];);'
    'out center tags qt;'
)


class Place(NamedTuple):
    osm_id: str
    lon: float
    lat: float
    name: str
    operator: str


def datacenters() -> tuple[list[Place], str]:
    """回傳 (所有數據中心, OSM 資料時間戳)。同時有兩個標籤的同一個物件只算一次。"""
    url = f"{OVERPASS}?data={urllib.parse.quote(DATACENTER_QUERY)}"
    path = download(url, "osm", "datacenters.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    places = []
    for e in data["elements"]:
        point = e if e["type"] == "node" else e.get("center")
        if not point:
            continue
        tags = e.get("tags", {})
        places.append(Place(
            f"{e['type']}/{e['id']}", point["lon"], point["lat"],
            tags.get("name", ""), tags.get("operator", ""),
        ))
    return places, data.get("osm3s", {}).get("timestamp_osm_base", "")


# ── 連鎖品牌與便利商店（便利商店與連鎖品牌主題，pipeline/topics/chain_stores.py） ──────────────
# 這幾個查詢比數據中心大很多（全球的便利商店約 80 萬個物件），照 Overpass 公用伺服器的使用規範：
# - 拆成 27 個小查詢（每個品牌一個、名稱比對每種店型一個、便利商店 12 個經度帶），一個查完才送下一個，中間停幾秒；
# - 只查必要的欄位（CSV 輸出，不要整份標籤）、POST、User-Agent 寫專案網址（common.USER_AGENT）；
# - 被拒絕（429）、伺服器忙（502）、逾時（504）時等一下再試，等待時間加倍，輪流換另一台伺服器。
# overpass-api.de 忙碌時的說明頁寫它是給瀏覽器與人工操作的工具用，自動化、大量使用請自架；這裡是一次性的建置，
# 結果存在 .cache/osm/，之後重跑不會再查。private.coffee（https://overpass.private.coffee/）明文允許自動化使用
# （沒有流量限制，要最佳化查詢、不要同時送很多個），但它的閘道 2 分鐘就逾時，2026-10-26 也一直沒有回應，只當備援。
BULK_ENDPOINTS = [OVERPASS, "https://overpass.private.coffee/api/interpreter"]
CSV_COLUMNS = ["::type", "::id", "::lat", "::lon", "brand:wikidata", "brand", "name", "shop", "amenity"]
RETRY_WAITS = [30, 60, 120, 240, 480, 900, 900, 900]  # 秒
PAUSE = 5  # 兩個查詢之間停幾秒


class Feature(NamedTuple):
    osm_id: str  # node/123、way/456
    lon: float
    lat: float
    wikidata: str
    brand: str
    name: str
    shop: str
    amenity: str


def _csv_lines(text: str) -> list[str]:
    """Overpass 的 CSV 一個物件一行，但值裡的換行不會跳脫（有些店名標了兩行）：不是 node／way／relation 開頭、
    也不是表頭或 out count 的那一行，是上一行的值斷開的，接回去（換行換成空白）。"""
    out: list[str] = []
    for i, line in enumerate(text.rstrip("\n").split("\n")):
        if i == 0 or line.split("\t", 1)[0] in ("node", "way", "relation", "count"):
            out.append(line)
        elif out:
            out[-1] += " " + line
    return out


def _overpass_csv(body: str, filename: str) -> tuple[list[Feature], str]:
    """送一個 CSV 輸出的 Overpass 查詢（body 是 union 裡的敘述），回傳 (所有物件, OSM 資料時間戳)。

    CSV 輸出沒有 JSON 那種錯誤訊息的欄位（remark），查到一半逾時或記憶體不夠時只會少了後面的資料，
    所以最後多一行 `out count`，筆數對得上才算成功；對不上就等一下重查。時間戳另外存在 <檔名>.stamp。
    """
    import csv
    import io
    import time
    import urllib.error
    import urllib.request

    from common import CACHE_DIR, REFRESH, USER_AGENT

    target = CACHE_DIR / "osm" / filename
    stamp_file = target.with_name(target.name + ".stamp")
    columns = ",".join(c if c.startswith("::") else f'"{c}"' for c in CSV_COLUMNS + ["::count"])
    # 用預設的記憶體上限（512 MiB）與 10 分鐘的時限：伺服器忙的時候，要求的時限與記憶體越大越容易被拒絕
    query = f'[out:csv({columns};true;"\\t")][timeout:600];({body});out center qt;out count;'
    if not target.exists() or REFRESH:
        target.parent.mkdir(parents=True, exist_ok=True)
        data = urllib.parse.urlencode({"data": query}).encode()
        for attempt, wait in enumerate([0, *RETRY_WAITS]):
            if wait:
                print(f"  {wait} 秒後重試（第 {attempt} 次）")
                time.sleep(wait)
            # 主要用 overpass-api.de，每第三次改試備援；備援的閘道 2 分鐘就逾時，不必等更久
            endpoint = BULK_ENDPOINTS[1 if attempt % 3 == 2 else 0]
            print(f"  查詢 Overpass（{endpoint.split('/')[2]}）：{filename}")
            request = urllib.request.Request(endpoint, data=data, headers={"User-Agent": USER_AGENT})
            started = time.time()
            try:
                with urllib.request.urlopen(request, timeout=900 if endpoint == OVERPASS else 180) as resp:
                    text = resp.read().decode("utf-8")
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ConnectionError) as e:
                print(f"  Overpass 失敗（{time.time() - started:.0f} 秒）：{e}")
                continue
            rows = _csv_lines(text)
            last = rows[-1].split("\t") if rows else []
            count = last[len(CSV_COLUMNS)] if len(last) > len(CSV_COLUMNS) and last[0] == "count" else ""
            if count.isdigit() and int(count) == len(rows) - 2:
                tmp = target.with_suffix(".part")
                tmp.write_text(text, encoding="utf-8")
                tmp.replace(target)
                stamp = urllib.request.Request(endpoint.replace("/interpreter", "/timestamp"), headers={"User-Agent": USER_AGENT})
                try:
                    with urllib.request.urlopen(stamp, timeout=60) as resp:
                        stamp_file.write_text(resp.read().decode("utf-8").strip(), encoding="utf-8")
                except (urllib.error.URLError, TimeoutError):
                    stamp_file.write_text(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), encoding="utf-8")
                print(f"  {len(rows) - 2} 個物件（{time.time() - started:.0f} 秒）")
                time.sleep(PAUSE)
                break
            print(f"  Overpass 回傳不完整（{len(rows) - 2} 筆，count={count!r}）：{text[-300:]!r}")
        else:
            raise RuntimeError(f"Overpass 查詢一直失敗：{filename}")

    lines = _csv_lines(target.read_text(encoding="utf-8"))
    header = lines[0].split("\t")
    assert header[: len(CSV_COLUMNS)] == [c.replace("::", "@") for c in CSV_COLUMNS], header
    out: list[Feature] = []
    n = len(CSV_COLUMNS)
    for row in csv.reader(io.StringIO("\n".join(lines[1:])), delimiter="\t", quoting=csv.QUOTE_NONE):
        if len(row) < n or row[0] == "count" or not row[2] or not row[3]:
            continue  # out count 那一行、沒有座標的物件（成員都不完整的關係）
        out.append(Feature(f"{row[0]}/{row[1]}", float(row[3]), float(row[2]), *row[4:n]))
    stamp = stamp_file.read_text(encoding="utf-8").strip() if stamp_file.exists() else ""
    return out, stamp


def wikidata_features(name: str, qids: list[str]) -> tuple[list[Feature], str]:
    """標了這些 brand:wikidata 的所有物件（一個品牌一個查詢，檔名 brand_<name>.tsv）。
    QID 用完全相同的值查（有索引，很快）；同一個物件標了兩個以上的 QID（`Q1;Q2`）會漏掉，這種標法很少見。"""
    return _overpass_csv("".join(f'nwr["brand:wikidata"="{q}"];' for q in qids), f"brand_{name}.tsv")


def name_features(key: str, value: str, pattern: str) -> tuple[list[Feature], str]:
    """這種店型（key=value）裡沒有 brand:wikidata、name 或 brand 以 pattern 開頭（不分大小寫）的物件。
    一種店型一個查詢（檔名 names_<value>.tsv），同一種店型的品牌合在一起，伺服器只要掃一次。"""
    body = "".join(f'nwr["{key}"="{value}"][!"brand:wikidata"]["{tag}"~"^({pattern})",i];' for tag in ("name", "brand"))
    return _overpass_csv(body, f"names_{value}.tsv")


# 便利商店（shop=convenience）全球約 80 萬個物件，切成 12 個 30° 的經度帶，每個查詢都不大
CONVENIENCE_BANDS = [(w, w + 30) for w in range(-180, 180, 30)]


def convenience_features() -> tuple[list[Feature], str]:
    """所有 shop=convenience 的物件（含品牌與名稱：便利商店品牌的名稱比對、側欄的品牌排行用）。"""
    out: list[Feature] = []
    stamps = []
    for west, east in CONVENIENCE_BANDS:
        features, stamp = _overpass_csv(f'nwr["shop"="convenience"](-90,{west},90,{east});', f"convenience_{west}_{east}.tsv")
        # 剛好在經度帶邊界上的點兩邊都會查到，只算一次
        out.extend(f for f in features if west <= f.lon < east or (east == 180 and f.lon == 180))
        stamps.append(stamp)
    return out, min((s for s in stamps if s), default="")

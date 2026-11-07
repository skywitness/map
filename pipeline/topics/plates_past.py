"""兩億年前的鄰居是誰、國土在 5 億年前屬於哪個古大陸（2026-11-07，製作手冊第二十七批 543，候選 1226、1227；擴充「板塊漂移」；
步驟 plates-past，輸出到 topics/plates/）。

資料同板塊漂移主題：Merdith 等 2021 全板塊模型 v1.2.4（CC BY 4.0），pyGPlates；國界切到板塊上的方法同 topics/plates.py
的 country_features()（今天的國界被帶回去，不是「當時有這個國家」）。

- 那時的鄰居（neighbours.json，側欄）：5–250 百萬年前每 500 萬年，把各國重建後的國土（多邊形的頂點，國界簡化到約 40 公里）
  轉成單位球上的點，用 k-d 樹算國與國最近的距離（大圓距離，公里）。列「那時在 300 公里內、今天相隔 1,000 公里以上」的國家
  （今天就相鄰的不算，不然永遠是同一塊板塊上的鄰國），每個時間點最多 4 國，依那時的距離排。
- 5 億年前屬於哪個古大陸（paleocontinent.json，類別）：模型 500 百萬年前的旋轉樹只有 4 個根（各自相對於古地磁框架移動）：
  岡瓦納（701）、勞倫西亞（101）、波羅地（302）、西伯利亞（401）。岡瓦納底下再把常說的邊緣地塊分出來：
  阿瓦隆尼亞（315）、華北（601）、華南（602 與其子板塊）。每一國取國土面積最大的那一類；國土的地殼在模型裡比 5 億年年輕的
  （日本、紐西蘭、菲律賓、印尼大部分）是「那時還沒有這塊地殼」。
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict

import numpy as np
from scipy.spatial import cKDTree

from common import indicator_file, write_json
from topics import plates as merdith

OUT = merdith.OUT
R_KM = 6371.0088
NEAR_KM = 300  # 那時在這個距離內算鄰居
FAR_KM = 1000  # 今天相隔這個距離以上才列（今天就相鄰的不算）
SEARCH_KM = 1000  # k-d 樹找的範圍（要 ≥ FAR_KM，今天的距離才判斷得出來）
KEEP = 4
# 南極洲包著極點，在經緯度上切板塊時東南極的面積不完整（5 億年前的古大陸會算成「沒有地殼」），兩個輸出都不放
SKIP = {"ATA"}
CONTINENT_TIME = 500.0
YEAR = 2026
# 類別代碼（前端 plates.ts 的 PALEO_CATEGORIES）
GONDWANA, LAURENTIA, BALTICA, SIBERIA, NORTH_CHINA, SOUTH_CHINA, AVALONIA, NONE = 1, 2, 3, 4, 5, 6, 7, 8
ROOTS = {701: GONDWANA, 70: GONDWANA, 101: LAURENTIA, 302: BALTICA, 401: SIBERIA}
# 岡瓦納底下的地塊：板塊編號出現在旋轉樹的路徑上就算那一塊（照這個順序找，先找到的先算）
TERRANES = [(315, AVALONIA), (601, NORTH_CHINA), (602, SOUTH_CHINA)]


def unit(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    a, b = np.radians(lat), np.radians(lon)
    return np.column_stack([np.cos(a) * np.cos(b), np.cos(a) * np.sin(b), np.sin(a)])


def distances(recon_feats: list) -> dict[str, dict[str, float]]:
    """各國之間最近的距離（公里）：國土多邊形的頂點轉成單位球上的點，用 k-d 樹找每一國到其他國最近的點，NEAR_KM 以內的才留"""
    import pygplates

    pts, owner = [], []
    for r in recon_feats:
        geom = r.get_reconstructed_geometry()
        if not isinstance(geom, pygplates.PolygonOnSphere):
            continue
        code = r.get_feature().get_name()
        for p in geom.get_points():
            pts.append(p.to_lat_lon())
            owner.append(code)
    arr = np.array(pts)
    xyz = unit(arr[:, 0], arr[:, 1])
    own = np.array(owner)
    tree = cKDTree(xyz)
    chord = 2 * math.sin(SEARCH_KM / R_KM / 2)
    out: dict[str, dict[str, float]] = defaultdict(dict)
    for i, js in enumerate(tree.query_ball_point(xyz, chord)):
        a = own[i]
        for j in js:
            b = own[j]
            if a == b:
                continue
            d = 2 * R_KM * math.asin(min(1.0, float(np.linalg.norm(xyz[i] - xyz[j])) / 2))
            if d < out[a].get(b, 1e9):
                out[a][b] = d
    return out


def neighbours(m: dict, feats: list) -> dict[str, list]:
    """那時的鄰居：那時在 NEAR_KM 以內、今天相隔 FAR_KM 以上的國家（今天就相鄰的不算），每個時間點最多 KEEP 國"""
    import pygplates

    by_time: dict[int, dict[str, dict[str, float]]] = {}
    for t in merdith.TIMES:
        recon = []
        pygplates.reconstruct(feats, m["rotation"], recon, float(t))
        by_time[t] = distances(recon)
    today = by_time[0]
    out: dict[str, list] = defaultdict(list)
    for t in merdith.TIMES:
        if t == 0:
            continue
        for code, near in by_time[t].items():
            past = sorted(
                ((o, d) for o, d in near.items() if d <= NEAR_KM and today.get(code, {}).get(o, 1e9) >= FAR_KM),
                key=lambda x: x[1],
            )[:KEEP]
            past = [(o, d) for o, d in past if o not in SKIP]
            if past and code not in SKIP:
                out[code].append([-t, [[str(o), int(round(d / 10) * 10)] for o, d in past]])
    return out


def paleocontinents(m: dict, feats: list) -> dict[str, int]:
    tree = m["rotation"].get_reconstruction_tree(CONTINENT_TIME)

    def classify(pid: int) -> int:
        chain = [pid]
        while True:
            e = tree.get_edge(pid)
            if e is None or e.get_fixed_plate_id() == 0:
                break
            pid = e.get_fixed_plate_id()
            chain.append(pid)
        root = ROOTS.get(chain[-1])
        if root is None:
            raise ValueError(f"5 億年前的旋轉樹有沒看過的根：{chain}")
        if root == GONDWANA:
            for plate, cat in TERRANES:
                if plate in chain:
                    return cat
        return root

    area: dict[str, Counter] = defaultdict(Counter)
    for f in feats:
        code = f.get_name()
        if code in SKIP:
            continue
        a = f.get_geometry().get_area()
        begin, _end = f.get_valid_time()
        cat = classify(f.get_reconstruction_plate_id()) if begin >= CONTINENT_TIME else NONE
        area[code][cat] += a
    return {code: c.most_common(1)[0][0] for code, c in area.items()}


def build() -> None:
    m = merdith.model()
    feats = merdith.country_features(m)
    nb = neighbours(m, feats)
    write_json(OUT / "neighbours.json", {"times": [-t for t in merdith.TIMES], "countries": dict(sorted(nb.items()))})
    by_time = {c: dict((t, v) for t, v in rows) for c, rows in nb.items()}
    print(f"  有那時的鄰居的國家：{len(nb)}")
    for c in ("IND", "USA", "BRA", "TWN", "AUS", "GBR", "MDG", "CAN", "ARG", "ZAF"):
        print(f"  {c}：−50 {by_time.get(c, {}).get(-50)}；−100 {by_time.get(c, {}).get(-100)}；−150 {by_time.get(c, {}).get(-150)}；−180 {by_time.get(c, {}).get(-180)}；−200 {by_time.get(c, {}).get(-200)}；−250 {by_time.get(c, {}).get(-250)}")
    cont = paleocontinents(m, feats)
    write_json(OUT / "paleocontinent.json", indicator_file(
        "paleocontinent", "category", [YEAR], {c: [v] for c, v in sorted(cont.items())}, license="CC BY 4.0"))
    groups: dict[int, list[str]] = defaultdict(list)
    for c, v in cont.items():
        groups[v].append(c)
    for k in sorted(groups):
        print(f"  古大陸 {k}：{len(groups[k])} 國 {sorted(groups[k])[:70]}")
    print(f"  台灣 {cont.get('TWN')}、日本 {cont.get('JPN')}、中國 {cont.get('CHN')}、英國 {cont.get('GBR')}")

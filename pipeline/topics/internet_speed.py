"""網路速度主題：Speedtest by Ookla 的固網與行動網路下載、上傳速度與延遲，依 z16 圖塊的位置歸到國家。

- 資料：`sources/ookla.py`（AWS Open Data 上的 Ookla Open Data，CC BY-NC-SA 4.0），每年只取第 3 季（7–9 月），
  2019–2026 年共 8 季：同一個季節年年可比，最新的 2026 年第 3 季也在裡面（不必另外混一季別的季節）。
- 歸國：圖塊中心用 `geoindex.countries_at()`（Natural Earth 1:10m 的國界；1:10m 也沒有形狀的台灣離島，馬祖、
  烏坵、東沙等，geoindex 用矩形範圍補回台灣，`geoindex.ISLANDS`），再照人口主題的網格（`population_grid`）
  把法國海外省、波奈、克里米亞、西撒哈拉、直布羅陀、吐瓦魯、托克勞依聯合國的劃分拆開。
  約 2,200 萬個不重複的圖塊，第一次約 20 秒（1:50m 時約 10 分鐘），結果存在 `.cache/ookla/tile-countries-v<ASSIGN_VERSION>.npz`，
  之後只算新出現的圖塊（geoindex 或這裡的歸國規則改了，要把 ASSIGN_VERSION 加一）。
- 彙總（各國、世界）：
  - 中位數（地圖上的值）：每個圖塊的平均值依測試次數加權的中位數，也就是把每一次測試都當成它所在圖塊的平均值，
    再取所有測試的中位數。圖塊裡的差異看不到，所以跟「真正逐次測試的中位數」不完全一樣（多半略高）。
  - 平均：依測試次數加權的平均，等於所有測試的平均（圖塊平均 × 測試次數 = 圖塊裡的總和），會被少數很快的線路拉高，
    只寫在側欄。
  - 測試次數不到 MIN_TESTS 的國家不給值（樣本太少），測試次數不到 FEW_TESTS 的在 tooltip 註明樣本少；
    一個圖塊就占 MAX_TILE_SHARE 以上測試的也不給值；Ookla 2026 年不再提供的地方（REMOVED）之後的季不給值。
"""
from __future__ import annotations

import re
import time

import numpy as np

from common import CACHE_DIR, OUT_DIR, ROOT, indicator_file, now_iso, write_json
from sources import ookla

YEARS = list(range(2019, 2027))
QUARTER = 3
# 圖塊歸國的快取版本：2 是 geoindex 修好換日線之後（2026-10-27，見 geoindex._wrapped），
# 3 是 geoindex 改用 1:10m 國界之後（2026-10-27，台灣離島的矩形範圍也移到 geoindex.ISLANDS）
ASSIGN_VERSION = 3


def tile_ids(t: dict[str, np.ndarray]) -> np.ndarray:
    return (t["y"].astype(np.uint32) << 16) | t["x"].astype(np.uint32)


def _assign(ids: np.ndarray) -> np.ndarray:
    """z16 圖塊（id = y << 16 | x）→ 國家代碼（字串陣列，沒有國家的是 ''）"""
    import geoindex
    from topics.population_grid import OVERRIDES, PARTS

    x = (ids & 0xFFFF).astype(np.uint16)
    y = (ids >> 16).astype(np.uint16)
    lon, lat = ookla.tile_centers(x, y)
    out = np.empty(len(ids), dtype=object)
    step = 1_000_000
    started = time.perf_counter()
    for s in range(0, len(ids), step):
        out[s : s + step] = [c or "" for c in geoindex.countries_at(lon[s : s + step], lat[s : s + step])]
        print(f"    歸國 {min(s + step, len(ids)):,}/{len(ids):,}（{time.perf_counter() - started:.0f} 秒）", flush=True)
    out = out.astype("U4")

    def box(area: tuple[float, float, float, float]) -> np.ndarray:
        x0, y0, x1, y1 = area
        return (lon >= x0) & (lon <= x1) & (lat >= y0) & (lat <= y1)

    for source, parts in PARTS.items():
        for target, area in parts.items():
            out[(out == source) & box(area)] = target
    for source, target, area in OVERRIDES:
        out[(out == (source or "")) & box(area)] = target
    return out


def tile_countries(ids: np.ndarray) -> np.ndarray:
    """ids 各自的國家代碼；結果快取在 .cache/ookla/，只算新出現的圖塊"""
    cache = CACHE_DIR / "ookla" / f"tile-countries-v{ASSIGN_VERSION}.npz"
    known_ids = np.zeros(0, np.uint32)
    known_codes = np.zeros(0, "U4")
    if cache.exists():
        with np.load(cache) as z:
            known_ids, known_codes = z["ids"], z["codes"]
    unique = np.unique(ids)
    missing = np.setdiff1d(unique, known_ids, assume_unique=True)
    if len(missing):
        print(f"  {len(missing):,} 個圖塊還沒歸國，用 geoindex 判斷")
        codes = _assign(missing)
        all_ids = np.concatenate([known_ids, missing])
        all_codes = np.concatenate([known_codes, codes])
        order = np.argsort(all_ids)
        known_ids, known_codes = all_ids[order], all_codes[order]
        cache.parent.mkdir(parents=True, exist_ok=True)
        np.savez(cache, ids=known_ids, codes=known_codes)
    return known_codes[np.searchsorted(known_ids, ids)]


def weighted_medians(groups: np.ndarray, values: np.ndarray, weights: np.ndarray, n: int) -> np.ndarray:
    """各組依 weights 加權的中位數：排序後第一個累積權重到一半的值（沒有資料的組是 NaN）"""
    order = np.lexsort((values, groups))
    g, v = groups[order], values[order]
    cw = np.cumsum(weights[order].astype(np.int64))
    ks = np.arange(n)
    starts, ends = np.searchsorted(g, ks, "left"), np.searchsorted(g, ks, "right")
    out = np.full(n, np.nan)
    has = ends > starts
    base = np.where(starts > 0, cw[np.maximum(starts - 1, 0)], 0)
    total = cw[np.maximum(ends - 1, 0)] - base
    # 累積權重 × 2 ≥ 總權重的第一個位置；cw 整體遞增，所以全域搜尋落在同一組裡
    target = base + (total + 1) // 2
    idx = np.searchsorted(cw, target, "left")
    out[has] = v[idx[has]]
    return out




def aggregate(groups: np.ndarray, t: dict[str, np.ndarray], n: int) -> dict[str, np.ndarray]:
    """各組的測試次數、圖塊數與下載、上傳、延遲的中位數，下載另算平均（等於所有測試的平均）"""
    w = t["tests"].astype(np.int64)
    tests = np.bincount(groups, weights=w, minlength=n)
    top = np.zeros(n)
    np.maximum.at(top, groups, w)  # 測試最多的那個圖塊
    out = {"tests": tests, "tiles": np.bincount(groups, minlength=n).astype(np.float64), "top": top}
    for key, col, scale in (("d", "d", 1000), ("u", "u", 1000), ("lat", "lat", 1)):
        out[key] = weighted_medians(groups, t[col].astype(np.float64) / scale, w, n)
    with np.errstate(invalid="ignore", divide="ignore"):
        out["dMean"] = np.bincount(groups, weights=t["d"].astype(np.float64) / 1000 * w, minlength=n) / tests
    return out


# ── 輸出 ───────────────────────────────────────────────────────────

MIN_TESTS = 1000  # 一季的測試不到這個數，不給速度（src/topics/internet-speed.ts 的 MIN_TESTS 要一樣）
FEW_TESTS = 10_000  # 不到這個數的季，tooltip 註明樣本少
# 一個圖塊（約 600 m）就占這個比例以上的測試時也不給值：可能是業者或少數人在同一個地方一直測，
# 例如 2026 年第 3 季賴比瑞亞的行動網路 1,758 次測試有 42% 在同一個圖塊，中位數 339 Mbps，排在卡達、科威特、阿聯之後
MAX_TILE_SHARE = 0.3
# Ookla 2026-04-16 起「supported regions have been updated」（README 的 Change Log），這些地方之後的季幾乎沒有測試：
# 國家 → 第一個沒有資料的季（年, 季）。只剩國界附近零星圖塊（1:50m 國界的誤差）的殘值，也不給值。
# 新的一季又有大量測試、或其他國家的測試突然少了九成以上時 build() 會報錯，要人工確認再改這裡。
REMOVED = {
    "RUS": (2025, 4),
    "CUB": (2026, 1),
    "IRN": (2026, 1),
    "SYR": (2026, 1),
    "BLR": (2026, 2),
}
KIND_TEXT = {"fixed": ("固網", "fixed broadband"), "mobile": ("行動網路", "mobile")}
ROUND = {"d": 1, "u": 1, "lat": 0, "dMean": 1}


def _quarter(q: tuple[int, int], lang: str) -> str:
    return f"{q[0]} 年第 {q[1]} 季" if lang == "zh" else f"Q{q[1]} {q[0]}"


def _years_text(years: list[int], lang: str) -> str:
    return ("、" if lang == "zh" else ", ").join(str(y) for y in years)


def check_topic() -> None:
    """主題設定（src/topics/internet-speed.ts）的 MIN_TESTS 要跟這裡一樣（指標說明裡寫這個數）"""
    text = (ROOT / "src" / "topics" / "internet-speed.ts").read_text(encoding="utf-8")
    found = re.search(r"export const MIN_TESTS = (\d+);", text)
    if not found or int(found.group(1)) != MIN_TESTS:
        raise ValueError(f"src/topics/internet-speed.ts 的 MIN_TESTS 跟 pipeline 的 {MIN_TESTS} 不同")


def build() -> None:
    from sources import tw_mobile_speed

    check_topic()
    out = OUT_DIR / "topics" / "internet-speed"
    by_kind: dict[str, list[dict[str, np.ndarray]]] = {}
    world: dict[str, list[dict[str, np.ndarray]]] = {}
    codes_all: dict[tuple[str, int], np.ndarray] = {}
    for kind in ookla.KINDS:
        for year in YEARS:
            codes_all[(kind, year)] = tile_countries(tile_ids(ookla.tiles(kind, year, QUARTER)))
    names = sorted({c for codes in codes_all.values() for c in np.unique(codes)} - {""})
    sorted_names = np.array(names)
    for kind in ookla.KINDS:
        by_kind[kind], world[kind] = [], []
        for year in YEARS:
            t = ookla.tiles(kind, year, QUARTER)
            codes = codes_all[(kind, year)]
            # 沒有國家的圖塊（離海岸太遠的小島、船上）歸到最後一組，只算進全世界
            groups = np.where(codes == "", len(names), np.searchsorted(sorted_names, codes))
            by_kind[kind].append(aggregate(groups, t, len(names) + 1))
            world[kind].append(aggregate(np.zeros(len(codes), np.int64), t, 1))
    index = {c: i for i, c in enumerate(names)}
    check_removed(by_kind, index)

    def series(kind: str, key: str, i: int) -> list[float | None]:
        """第 i 個國家的歷年值；測試太少、或 Ookla 已經不提供的季是 None（測試次數、圖塊數照列）"""
        vals: list[float | None] = []
        for y, a in zip(YEARS, by_kind[kind]):
            if key in ("tests", "tiles"):
                vals.append(int(a[key][i]))
                continue
            gone = names[i] in REMOVED and (y, QUARTER) >= REMOVED[names[i]]
            v = a[key][i]
            ok = a["tests"][i] >= MIN_TESTS and a["top"][i] <= MAX_TILE_SHARE * a["tests"][i] and np.isfinite(v)
            vals.append(round(float(v), ROUND[key]) if ok and not gone else None)
        return vals

    def world_series(kind: str, key: str) -> list[float]:
        return [int(a[key][0]) if key in ("tests", "tiles") else round(float(a[key][0]), ROUND[key]) for a in world[kind]]

    taiwan = tw_mobile_speed.official()
    for kind in ookla.KINDS:
        notes, notes_en, hints, hints_en = notes_for(kind, by_kind, index, taiwan)
        # 測試次數只在側欄（countries/）：多一個「測試次數」指標，控制列在英文 1280px、中文 1024px 寬時會換行
        for indicator, key, unit in (("download", "d", "Mbps"), ("upload", "u", "Mbps"), ("latency", "lat", "毫秒")):
            values = {c: series(kind, key, i) for c, i in index.items()}
            values = {c: v for c, v in values.items() if any(x is not None and x > 0 for x in v)}
            write_json(
                out / indicator / f"{kind}.json",
                indicator_file(
                    f"{indicator}-{kind}",
                    unit,
                    YEARS,
                    values,
                    aggregates={"WLD": world_series(kind, key)},
                    notes={c: n for c, n in notes.items() if c in values},
                    notesEn={c: n for c, n in notes_en.items() if c in values},
                    hints={c: n for c, n in hints.items() if c in values},
                    hintsEn={c: n for c, n in hints_en.items() if c in values},
                ),
            )
        latest = sum(1 for i in index.values() if series(kind, "d", i)[-1] is not None)
        print(f"  {KIND_TEXT[kind][0]}：{latest} 個國家與地區有 {YEARS[-1]} 年第 {QUARTER} 季的速度")

    keys = ("d", "dMean", "u", "lat", "tests", "tiles")
    written = 0
    for c, i in index.items():
        if not any(a["tests"][i] for k in ookla.KINDS for a in by_kind[k]):
            continue
        detail: dict[str, object] = {"years": YEARS, "minTests": MIN_TESTS}
        for kind in ookla.KINDS:
            detail[kind] = {key: series(kind, key, i) for key in keys}
        if c == "TWN":
            detail["official"] = taiwan
        write_json(out / "countries" / f"{c}.json", detail, quiet=True)
        written += 1
    print(f"  countries/：{written} 個檔")
    write_json(
        out / "world.json",
        {"years": YEARS, "minTests": MIN_TESTS, **{k: {key: world_series(k, key) for key in keys} for k in ookla.KINDS}},
    )
    write_json(
        out / "manifest.json",
        {
            "topic": "internet-speed",
            "generatedAt": now_iso(),
            "source": "Speedtest by Ookla Global Fixed and Mobile Network Performance Maps (AWS Open Data), "
            f"Q{QUARTER} {YEARS[0]}–{YEARS[-1]}; Taiwan comparison: NCC 4G measurement (press release of 2022-04-27), "
            "Ministry of Digital Affairs 5G measurement (data.gov.tw 161791, CC0)",
            "sourceUrl": ookla.INFO_URL,
            "license": "CC BY-NC-SA 4.0 (adapted from Ookla Open Data; these data files are shared under the same licence)",
            "attribution": ookla.citation(f"Q{QUARTER} {YEARS[0]} – Q{QUARTER} {YEARS[-1]} (third quarter of each year)"),
            "method": "Country and world values: tests-weighted median of zoom-16 tile averages (download, upload, "
            "latency) and tests-weighted mean of download; tiles assigned to countries by their centre point "
            f"(Natural Earth 1:10m). Quarters with fewer than {MIN_TESTS} tests have no speed values.",
        },
    )


def check_removed(by_kind: dict[str, list[dict[str, np.ndarray]]], index: dict[str, int]) -> None:
    """REMOVED 的國家之後真的幾乎沒有測試；其他國家沒有突然少了九成以上（Ookla 又拿掉了別的地方）"""
    problems = []
    for kind, rows in by_kind.items():
        for j in range(1, len(YEARS)):
            for c, i in index.items():
                before, now = rows[j - 1]["tests"][i], rows[j]["tests"][i]
                gone = c in REMOVED and (YEARS[j], QUARTER) >= REMOVED[c]
                if gone and now > 0.05 * max(before, 1) and now > 5 * MIN_TESTS:
                    problems.append(f"{kind} {c} {YEARS[j]}：REMOVED 但有 {int(now):,} 次測試")
                if not gone and before >= 20_000 and now < 0.1 * before:
                    problems.append(f"{kind} {c} {YEARS[j]}：測試從 {int(before):,} 次掉到 {int(now):,} 次")
    if problems:
        raise ValueError("Ookla 涵蓋的地方變了，確認後改 REMOVED：\n" + "\n".join(problems))


def notes_for(
    kind: str, by_kind: dict[str, list[dict[str, np.ndarray]]], index: dict[str, int], taiwan: list[dict[str, object]]
) -> tuple[dict[str, str], dict[str, str], dict[str, str], dict[str, str]]:
    """附註（側欄）與 tooltip 的短註：樣本少的季、Ookla 不再提供的地方、克里米亞、台灣的離島與官方量測"""
    kz, ke = KIND_TEXT[kind]
    notes: dict[str, list[str]] = {}
    notes_en: dict[str, list[str]] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    rows = by_kind[kind]
    for c, i in index.items():
        gone_from = REMOVED.get(c)
        shown = [y for y in YEARS if not gone_from or (y, QUARTER) < gone_from]
        few = [y for y, a in zip(YEARS, rows) if y in shown and MIN_TESTS <= a["tests"][i] < FEW_TESTS]
        none = [y for y, a in zip(YEARS, rows) if y in shown and 0 < a["tests"][i] < MIN_TESTS]
        piled = [
            y for y, a in zip(YEARS, rows)
            if y in shown and a["tests"][i] >= MIN_TESTS and a["top"][i] > MAX_TILE_SHARE * a["tests"][i]
        ]
        if piled:
            share = max(a["top"][i] / a["tests"][i] for y, a in zip(YEARS, rows) if y in piled)
            notes.setdefault(c, []).append(
                f"{_years_text(piled, 'zh')} 年第 3 季的{kz}測試有 {MAX_TILE_SHARE:.0%} 以上（最多 {share:.0%}）集中在同一個"
                "約 600 m 的圖塊，可能是業者或少數人在同一個地方一直測，不能代表全國，不給速度。"
            )
            notes_en.setdefault(c, []).append(
                f"In Q3 {_years_text(piled, 'en')} over {MAX_TILE_SHARE:.0%} of {ke} tests (up to {share:.0%}) came from a single "
                "tile about 600 m across, probably an operator or a few people testing repeatedly in one place, so no speed "
                "values are given."
            )
        if gone_from:
            hints[c] = f"Ookla {_quarter(gone_from, 'zh')}起沒有這裡的資料"
            hints_en[c] = f"Not in Ookla’s data from {_quarter(gone_from, 'en')}"
            notes.setdefault(c, []).append(
                f"Ookla 2026 年 4 月更新了資料涵蓋的地區（README 的變更紀錄寫依適用的法律與內部政策），"
                f"這裡{_quarter(gone_from, 'zh')}起幾乎沒有測試（只剩國界附近的零星圖塊），之後的季不給值。"
            )
            notes_en.setdefault(c, []).append(
                "Ookla changed the regions it covers in 2026 (its README cites applicable laws and internal policies); "
                f"from {_quarter(gone_from, 'en')} there are almost no tests here (only stray tiles near the border), "
                "so later quarters have no values."
            )
        elif few:
            hints[c] = f"{_years_text(few, 'zh')} 年第 3 季的測試不到 1 萬次，數值較不穩定"
            hints_en[c] = f"Fewer than 10,000 tests in Q3 {_years_text(few, 'en')}; values less reliable"
        if none:
            notes.setdefault(c, []).append(
                f"{_years_text(none, 'zh')} 年第 3 季的{kz}測試不到 {MIN_TESTS:,} 次，樣本太少，不給速度（測試次數照列）。"
            )
            notes_en.setdefault(c, []).append(
                f"Fewer than {MIN_TESTS:,} {ke} tests in Q3 {_years_text(none, 'en')}: too few for speed values "
                "(test counts still shown)."
            )
    if "UKR" in index:
        notes.setdefault("UKR", []).append(
            "克里米亞的測試照聯合國的劃分算在烏克蘭（跟人口網格一樣；地圖的國界把克里米亞畫在俄羅斯的形狀裡）。"
        )
        notes_en.setdefault("UKR", []).append(
            "Tests in Crimea count for Ukraine, following the UN (as in the population grid; the map’s borders draw "
            "Crimea inside Russia)."
        )
    notes.setdefault("TWN", []).append(
        "台灣的離島（澎湖、馬祖、蘭嶼、綠島、東沙、烏坵）在 1:50m 國界沒有形狀，依範圍補回台灣；金門在國界裡。"
    )
    notes_en.setdefault("TWN", []).append(
        "Taiwan’s outlying islands (Penghu, Matsu, Orchid Island, Green Island, Pratas, Wuqiu) have no shapes in the "
        "1:50m borders and are added by their extent; Kinmen is within the border."
    )
    if kind == "mobile":
        last = [r for r in taiwan if r["agency"] == "moda"][-1]
        downs = [o[1] for o in last["operators"]]  # type: ignore[union-attr]
        notes["TWN"].append(
            "官方的行動上網定點量測是另一種量法：NCC 2021 年 4G 全國平均下載 122.53 Mbps、上傳 24.92 Mbps；"
            f"數位發展部 {last['year']} 年 5G 各業者 22 縣市的平均下載 {min(downs):.0f}–{max(downs):.0f} Mbps。"
            "專業人員在固定地點用測試手機量每家業者，Ookla 是使用者自己的手機、4G 與 5G 混在一起，不能直接相比，對照見側欄。"
        )
        notes_en["TWN"].append(
            "Official fixed-site mobile measurements use a different method: NCC’s 2021 4G national mean was 122.53 Mbps "
            f"down and 24.92 Mbps up; the Ministry of Digital Affairs’ {last['year']} 5G results averaged "
            f"{min(downs):.0f}–{max(downs):.0f} Mbps down across 22 counties, depending on the operator. Staff measure "
            "each operator at fixed sites with test phones, while Ookla tests come from users’ own phones mixing 4G and "
            "5G, so they are not directly comparable; see the side panel."
        )
    else:
        notes["TWN"].append("台灣近年沒有官方的固網速率量測可以對照（行動網路的對照見「行動網路」）。")
        notes_en["TWN"].append("Taiwan has no recent official fixed broadband speed measurement to compare with (see Mobile).")
    return (
        {c: "".join(v) for c, v in notes.items()},
        {c: " ".join(v) for c, v in notes_en.items()},
        hints,
        hints_en,
    )

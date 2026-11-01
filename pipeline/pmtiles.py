"""PMTiles 的共用函式（製作手冊第十六批 263，2026-11-01）：大的線與面圖層用 tippecanoe 切成向量圖磚，
包成一個 `.pmtiles` 檔放在 `public/pmtiles/`，前端（src/map/pmtiles.ts）用 HTTP Range 只讀看得到的那一塊。

**tippecanoe**（felt/tippecanoe，BSD 授權，LICENSE.md：「Copyright (c) 2022, Protomaps LLC / Copyright (c) 2014, Mapbox Inc.」）：
cloud session 不能編譯外部下載的程式（2026-11-01 試過被擋），所以由使用者電腦上的本機 session 安裝（macOS 用
`brew install tippecanoe`，或照 felt/tippecanoe 的 README 編譯）、跑這裡的函式，把 `.pmtiles` 推上來。
沒有 tippecanoe 時 `build()` 報錯並寫清楚怎麼做。

**檔名**：`<名稱>-<內容雜湊 8 碼>.pmtiles`，內容變了網址就變，瀏覽器與 service worker 的快取不會拿到舊檔；
同一個名稱的舊檔一起刪掉。前端從 `public/pmtiles/index.json`（名稱 → 檔名、圖層、縮放範圍、大小）找檔名。

**大小**：單檔不能超過 GitHub 的 100 MB，這裡設 95 MB，超過就報錯（請簡化或分檔）。整個 Pages 網站上限 1 GB。
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from common import ROOT, now_iso

# 手冊寫 public/tiles/，但那裡是人口、暖化網格圖磚的資料夾（.gitignore 忽略、部署時產生並快取整個資料夾），
# 所以 PMTiles 另外放 public/pmtiles/（要提交進 git）
TILES_DIR = ROOT / "public" / "pmtiles"
INDEX = TILES_DIR / "index.json"
# tippecanoe 的輸出先放這裡（.gitignore 忽略的快取資料夾），算出雜湊再搬到 TILES_DIR
WORK_DIR = ROOT / "pipeline" / ".cache" / "pmtiles"
MAX_BYTES = 95 * 1024 * 1024
# 驗證過的版本（World View Data 用 v2.80.0；2026-11-01 最新的標籤是 2.79.0）
MIN_VERSION = (2, 70, 0)


def tippecanoe_version() -> tuple[int, int, int] | None:
    exe = shutil.which("tippecanoe")
    if not exe:
        return None
    out = subprocess.run([exe, "--version"], capture_output=True, text=True)
    text = (out.stdout + out.stderr).strip()
    parts = [int(x) for x in text.split()[-1].lstrip("v").split(".")[:3] if x.isdigit()]
    return tuple(parts + [0] * (3 - len(parts)))  # type: ignore[return-value]


def _require_tippecanoe() -> str:
    version = tippecanoe_version()
    if version is None:
        raise RuntimeError(
            "找不到 tippecanoe：cloud session 不能編譯外部下載的程式，請在使用者電腦上的本機 session 安裝"
            "（macOS：brew install tippecanoe；或照 https://github.com/felt/tippecanoe 的 README 編譯 2.79.0 以後的版本）再跑這一步")
    if version < MIN_VERSION:
        raise RuntimeError(f"tippecanoe {'.'.join(map(str, version))} 太舊，要 {'.'.join(map(str, MIN_VERSION))} 以後的版本")
    return shutil.which("tippecanoe")  # type: ignore[return-value]


def _relative(path: Path) -> str:
    """repo 裡的路徑寫成相對於根目錄、用斜線（Windows 的 MSYS2 版 tippecanoe 也讀得懂）"""
    path = Path(path).resolve()
    return path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else path.as_posix()


def _read_index() -> dict:
    if INDEX.exists():
        return json.loads(INDEX.read_text(encoding="utf-8"))
    return {}


def build(
    name: str,
    geojson: Path,
    layer: str,
    *,
    min_zoom: int,
    max_zoom: int,
    keep: list[str],
    polygons: bool = False,
    extra_args: list[str] | None = None,
) -> Path:
    """把 GeoJSON（FeatureCollection，或一行一個 feature 的 GeoJSONSeq）切成 PMTiles，寫到 public/pmtiles/<名稱>-<雜湊>.pmtiles。

    - name：檔名的前段與 index.json 的鍵，例如 "admin0-10m"、"adm1"。
    - layer：向量圖磚裡的圖層名稱（前端 source-layer 用）。
    - min_zoom、max_zoom：切到哪幾級；超過 max_zoom 前端會放大最後一級（overzoom），不必切到 18。
    - keep：要留的屬性（其他的丟掉，檔案才小）；前端要依國家或行政區上色、標出的屬性（例如 iso3）要在裡面，
      並在前端設 promoteId。
    - polygons：面（國界、行政區界）加 --no-simplification-of-shared-nodes，相鄰的面簡化後邊界還是貼在一起
      （tippecanoe 的 README 寫 --detect-shared-borders 已經不建議用〔DEPRECATED〕，改用這個「faster and more correct」）。
    回傳寫出的檔案路徑；index.json 記下檔名、圖層、縮放範圍、大小與產生時間。
    """
    exe = _require_tippecanoe()
    TILES_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    # tippecanoe 把整個指令列寫進檔案的 metadata（generator_options），沒給 -n、-N 時 name、description 也是輸出的路徑：
    # 在 repo 根目錄跑、路徑都用相對的（斜線），argv[0] 只寫 tippecanoe，輸出到固定的位置（不用亂數命名的暫存資料夾），
    # 公開的檔案裡才不會有使用者電腦的資料夾，同樣的輸入在同一版 tippecanoe 也切出同樣的檔（檔名的雜湊不變）。
    # 2026-11-01 本機 session 第一次切 countries-10m 時寫進了暫存資料夾的完整路徑
    out = WORK_DIR / f"{name}.pmtiles"
    args = ["tippecanoe", "-o", _relative(out), "--force", "--quiet", "-n", name, "-N", name, "-l", layer]
    args += ["-Z", str(min_zoom), "-z", str(max_zoom)]
    for prop in keep:
        args += ["-y", prop]
    if polygons:
        # 國界、行政區：每個面都要在（依代碼上色、點選），不丟、不合併 feature；相鄰的面在交會點之間簡化成一樣的線
        # （--no-simplification-of-shared-nodes，取代 DEPRECATED 的 --detect-shared-borders）；小島不換成小方塊。
        # 圖磚可能超過預設的 500 KB，所以不設上限（低縮放級別的圖磚由 min_zoom 控制）
        args += ["--no-simplification-of-shared-nodes", "--no-tiny-polygon-reduction", "--no-tile-size-limit"]
    else:
        # 線與點：圖磚太大時先丟最密的地方，還是太大就多切幾級
        args += ["--drop-densest-as-needed", "--extend-zooms-if-still-dropping"]
    args += extra_args or []
    args.append(_relative(geojson))
    subprocess.run(args, executable=exe, cwd=ROOT, check=True)
    data = out.read_bytes()
    out.unlink()
    if len(data) > MAX_BYTES:
        raise RuntimeError(f"{name}.pmtiles 有 {len(data) / 1e6:.1f} MB，超過 {MAX_BYTES / 1e6:.0f} MB：請簡化或分檔")
    digest = hashlib.sha256(data).hexdigest()[:8]
    target = TILES_DIR / f"{name}-{digest}.pmtiles"
    for old in TILES_DIR.glob(f"{name}-*.pmtiles"):
        if old != target:
            old.unlink()
    target.write_bytes(data)
    index = _read_index()
    index[name] = {
        "file": target.name,
        "layer": layer,
        "minzoom": min_zoom,
        "maxzoom": max_zoom,
        "bytes": len(data),
        "generatedAt": now_iso(),
    }
    # 換行一律 LF（Windows 的 write_text 預設換成 CRLF，2026-11-01 本機 session 發現）
    INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(f"  輸出 {target.relative_to(ROOT)}（{len(data) / 1e6:.2f} MB，{layer}，z{min_zoom}–{max_zoom}）")
    return target

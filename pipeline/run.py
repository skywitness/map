"""資料管線入口。

    python pipeline/run.py               # 全部重建
    python pipeline/run.py geo population # 只跑指定步驟
    python pipeline/run.py --refresh ...  # 忽略下載快取，重新抓原始資料

新增主題：在 topics/ 放一支有 build() 的模組，並加進 STEPS。
"""
from __future__ import annotations

import argparse
import importlib
import time

import common

STEPS = {
    "geo": "build_geo",
    "population": "topics.population",
    "population-grid": "topics.population_grid",  # 要先有 geo 的國界；第一次會下載 460 MB
    # 人口密度的 1 km 網格圖磚（不進版本控制，部署時產生）；第一次會下載 12 期、共 5.8 GB
    "population-density-tiles": "topics.population_density_tiles",
    "income": "topics.income",
    "sectors": "topics.sectors",
    "agriculture": "topics.agriculture",
    "electricity": "topics.electricity",
    "industry": "topics.industry",
    "ai": "topics.ai",
    "transport": "topics.transport",
    "climate": "topics.climate",
    "military": "topics.military",
    "digital": "topics.digital",
    "health": "topics.health",
    "disease": "topics.disease",  # 第一次會向 WHO 查 24 年的死因資料（約 15 分鐘、40 MB）
    "diet": "topics.diet",  # 第一次會下載約 130 MB（FAOSTAT 糧食平衡表新舊兩版、糧食安全指標）
    "education": "topics.education",
    "tourism": "topics.tourism",
    "trade": "topics.trade",  # 第一次會下載約 1.2 GB（BACI、FAOSTAT 詳細貿易矩陣）
    "language": "topics.language",
    "compact": "compact",  # 把還沒壓縮的舊指標檔改成差分編碼（各主題輸出時已經會壓縮）
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("steps", nargs="*", help=f"要執行的步驟（{', '.join(STEPS)}），預設全部")
    parser.add_argument("--refresh", action="store_true", help="重新下載原始資料")
    args = parser.parse_args()
    unknown = [s for s in args.steps if s not in STEPS]
    if unknown:
        parser.error(f"未知的步驟：{', '.join(unknown)}")
    common.REFRESH = args.refresh

    for step in args.steps or STEPS:
        print(f"[{step}]")
        started = time.perf_counter()
        importlib.import_module(STEPS[step]).build()
        print(f"  完成，{time.perf_counter() - started:.1f} 秒")


if __name__ == "__main__":
    main()

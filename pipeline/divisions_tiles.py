"""行政區界的圖磚（製作手冊第十六批 265）：divisions 步驟產生的 GeoJSON 切成 PMTiles（tippecanoe，本機 session 跑）。

第一級 `divisions1`（1–9 級）、第二級依洲 `divisions2-<洲>`（3–10 級，美洲分北美與拉丁美洲，共 6 份），寫到 public/pmtiles/，index.json 記檔名。
要先跑 divisions（同一份輸入，id 才對得上 public/data/divisions/ 的 JSON）。
"""
from __future__ import annotations


def build() -> None:
    import divisions

    divisions.build_tiles()

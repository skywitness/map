"""世界遺產的照片（2026-11-06，城2）：現有的 sites.json 補上 Wikidata 的 P18 照片、Commons 的攝影者與授權。
世界遺產的名錄（UNESCO DataHub）在雲端抓不到，所以另外一個步驟，不必重跑 world-heritage（topics/world_heritage.py 的 build_photos）"""
from topics.world_heritage import build_photos


def build() -> None:
    build_photos()

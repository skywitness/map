"""新主題「上網看影片的人」（2026-11-08，製作手冊第二十七批 657，候選 1439、1444、1456；步驟 online-video，輸出 topics/online-video/）。

Eurostat `isoc_ci_ac_i`（Individuals - internet activities，CC BY 4.0；英國、科索沃由 sources/eurostat.py 統一排除），
16–74 歲全部人口的比例（分母不是上網的人）：
- I_IUVSS 看影片分享平台（YouTube 這類；2021 年才開始問），子項目：全部、16–24 歲（Y16_24）、65–74 歲（Y65_74）。
  Eurostat 沒有單獨問「短影音」，這是最接近的代理指標，說明寫明。
- I_IUVOD 看商業的隨選影音（Netflix 這類）、I_IUSTV 看電視台的網路直播或回看。
- I_IUMUSS 上網聽音樂（網路電台、音樂串流），**2019 年以後停問**。
台灣與歐洲以外沒有可比的資料。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "online-video"


def _write(path, name: str, indic: str, ind_type: str = "IND_TOTAL", first: int | None = None) -> None:
    raw = eurostat.series("isoc_ci_ac_i", indic_is=indic, unit="PC_IND", ind_type=ind_type)
    years = sorted({y for s in raw.values() for y in s if first is None or y >= first})
    values = {k: [round(s[y], 1) if y in s else None for y in years] for k, s in sorted(raw.items()) if any(y in s for y in years)}
    write_json(path, indicator_file(name, "%", years, values, latestWithin=4, license="CC BY 4.0"))
    last = {k: (max(y for y in s if y in years), s[max(y for y in s if y in years)]) for k, s in raw.items() if any(y in s for y in years)}
    ranked = sorted(((v, k, y) for k, (y, v) in last.items()), reverse=True)
    print(f"  {name}（{indic} {ind_type}）：{years[0]}–{years[-1]}，{len(values)} 國；最高 {[(round(v, 1), k, y) for v, k, y in ranked[:8]]}；"
          f"最低 {[(round(v, 1), k, y) for v, k, y in ranked[-5:]]}")


def build() -> None:
    _write(OUT / "video-sharing" / "all.json", "video-sharing-all", "I_IUVSS", first=2021)
    _write(OUT / "video-sharing" / "young.json", "video-sharing-young", "I_IUVSS", "Y16_24", first=2021)
    _write(OUT / "video-sharing" / "old.json", "video-sharing-old", "I_IUVSS", "Y65_74", first=2021)
    _write(OUT / "vod.json", "vod", "I_IUVOD")
    _write(OUT / "live-tv.json", "live-tv", "I_IUSTV")
    _write(OUT / "music.json", "music", "I_IUMUSS")

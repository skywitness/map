"""關鍵礦產：台灣現存的礦業權（2026-11-06，製作手冊第二十二批 382 留下的部分；步驟 minerals-rights-tw，輸出 topics/minerals/）。

- 經濟部地質調查及礦業管理中心「現存礦業權清冊」（政府資料開放平臺 126847，政府資料開放授權條款第 1 版），CSV 的下載網址
  是資料集頁面上列的 `www.gsmma.gov.tw/uploads/…`（2026-11-06 讀過 robots.txt：只禁 /admin）。製表日 2025-03-05，112 筆
  （手冊寫 123 筆）。只有地名、沒有座標，所以不畫點，放關鍵礦產的台灣側欄：各礦種幾個礦區、各縣市幾個礦區、陸上的礦區面積。
- 一個礦區常登記好幾種礦（例如「石棉礦 蛇紋石 滑石礦 寶石礦」），各礦種都算一次，加起來會大於礦區數。
- 海域的 5 個石油天然氣礦區（所在地寫「其他台灣海峽…」「其他台灣北方海域…」）面積欄是 4,319,900–14,602,000，跟陸上礦區的
  公頃對不上（台灣海峽第一礦區若是公頃，比台灣本島還大好幾倍），不加進面積。
- 礦業權人有自然人（姓名已遮一個字），只做彙總，不輸出業者名稱。原檔有幾個字變成「?」（例如「三金?業」），不影響彙總。
"""
from __future__ import annotations

import csv
import io
from collections import Counter

from common import OUT_DIR, download, write_json

OUT = OUT_DIR / "topics" / "minerals"
URL = "https://www.gsmma.gov.tw/uploads/1741594407442ZdXNLrbn.csv"
OFFSHORE = "其他"


def build() -> None:
    raw = download(URL, "gsmma", "mining-rights-126847.csv").read_text(encoding="utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(raw)))
    if not rows or "礦種" not in rows[0]:
        raise RuntimeError("現存礦業權清冊的欄位變了")
    minerals: Counter = Counter()
    counties: Counter = Counter()
    onshore_area = 0.0
    offshore = 0
    for r in rows:
        for m in r["礦種"].split():
            minerals[m[:-1] if m.endswith("礦") and len(m) > 2 else m] += 1  # 「滑石礦」→「滑石」，「金礦」照舊
        place = r["礦區所在地"].strip()
        if place.startswith(OFFSHORE):
            offshore += 1
            counties["海域"] += 1
        else:
            counties[place[:3].replace("台", "臺")] += 1
            onshore_area += float(r["礦區面積(公頃)"] or 0)
    date = rows[0]["製表日期"]
    out = {
        "date": f"{date[:4]}-{date[4:6]}-{date[6:]}",
        "rights": len(rows),
        "offshore": offshore,
        "onshoreArea": round(onshore_area, 1),
        "minerals": minerals.most_common(),
        "counties": counties.most_common(),
    }
    write_json(OUT / "mining-rights-tw.json", out)
    print(f"  {out['date']}：{len(rows)} 個礦區（海域 {offshore}），陸上 {onshore_area:,.1f} 公頃")
    print(f"  礦種 {minerals.most_common(12)}")
    print(f"  縣市 {counties.most_common()}")

"""Kew 的 World Checklist of Vascular Plants（WCVP，CC BY 3.0；製作手冊第二十九批 692、702 共用）。

- `https://sftp.kew.org/pub/data-repositories/WCVP/wcvp_dwca.zip`（Darwin Core Archive，約 88 MB；robots.txt 404 視為不限制）。
  `eml.xml` 的 `<intellectualRights>`：「This work is licensed under a Creative Commons Attribution 3.0 Unported (CC BY 3.0) License.」
  引用：「The World Checklist of Vascular Plants (WCVP). Facilitated by the Royal Botanic Gardens, Kew.」
- 名字對到接受的種（`accepted_species()`）：同名的接受種直接用；異名照 acceptedNameUsageID 走到接受名，接受名是變種、亞種時
  取它的種（parentNameUsageID）。
- 分布（`native_regions()`）：wcvp_distribution.csv 的 TDWG 第三級地區，只算原生（establishmentMeans 空白、occurrenceStatus 空白；
  introduced 與 Doubtful 不算）。
- 第三級地區 → 國家：用 TDWG 第四級地區的 ISO 代碼（tdwg/wgsrpd 的 level4.geojson）。一個第三級地區跨好幾國時每一國都算，
  但 DROP 裡大國只占一小塊的不算（CHS「中國東南」含金門、馬祖與澳門，照手冊只算中國；FRA 含海峽群島、IRE 含北愛爾蘭、
  MOR 含休達與梅利利亞、NFK 含澳洲本土的代碼、HAI 含波多黎各的代碼：那些國家各有自己的第三級地區）。
"""
from __future__ import annotations

import csv
import io
import json
import zipfile
from collections import defaultdict

from common import download
from sources.countries import from_alpha2

URL = "https://sftp.kew.org/pub/data-repositories/WCVP/wcvp_dwca.zip"
LEVEL4 = "https://raw.githubusercontent.com/tdwg/wgsrpd/master/geojson/level4.geojson"
DROP = {("CHS", "TW"), ("CHS", "MO"), ("FRA", "UK"), ("IRE", "UK"), ("MOR", "ES"), ("NFK", "AU"), ("HAI", "PR")}
ISO_FIX = {"UK": ["GBR"], "YU": ["SRB", "MNE"], "TP": ["TLS"]}
ISO_SKIP = {"AN", "SP", "PI", "UM"}  # 荷屬安地列斯（已解散）、南沙、西沙、美國本土外小島嶼


def _rows(name: str):
    z = zipfile.ZipFile(download(URL, "wcvp", "wcvp_dwca.zip"))
    with z.open(name) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"), delimiter="|", quoting=csv.QUOTE_NONE)


def license_text() -> str:
    z = zipfile.ZipFile(download(URL, "wcvp", "wcvp_dwca.zip"))
    eml = z.read("eml.xml").decode("utf-8")
    start = eml.index("<intellectualRights>")
    import re
    return " ".join(re.sub(r"<[^>]+>", " ", eml[start:eml.index("</intellectualRights>")]).split()).replace(" .", ".")


def _norm(a: str) -> str:
    return "".join(ch for ch in a if ch.isalnum() or ch in "()&")


def accepted_species(names: set[str], authors: dict[str, list[str]] | None = None) -> dict[str, tuple[str, str]]:
    """{「屬名 種小名」: (接受的種的 taxonid, 接受的種名)}；對不上的不在結果裡。
    authors：名字 → 原文裡學名後面的字（含命名人）；同名的有好幾筆（不同命名人）時，挑命名人寫在原文裡的那一筆"""
    hits: dict[str, list[tuple[str, str, str, str, str]]] = defaultdict(list)  # 名字 → [(id, rank, status, accepted id, 命名人)]
    rows: dict[str, tuple[str, str, str, str, str]] = {}  # taxonid → (名字, rank, status, accepted id, parent id)
    need: set[str] = set()
    for r in _rows("wcvp_taxon.csv"):
        sci = r["scientfiicname"].replace("× ", "").replace("×", "")  # 雜交種：藥典寫 Chrysanthemum morifolium，WCVP 寫 Chrysanthemum × morifolium
        binom = f"{r['genus']} {r['specificepithet']}".replace("× ", "").replace("×", "")
        if sci in names or (r["taxonrank"] in ("Variety", "Subspecies", "Form") and binom in names):
            key = sci if sci in names else binom
            hits[key].append((r["taxonid"], r["taxonrank"], r["taxonomicstatus"], r["acceptednameusageid"], r["scientfiicnameauthorship"]))
            need.add(r["acceptednameusageid"])
    for r in _rows("wcvp_taxon.csv"):
        if r["taxonid"] in need:
            rows[r["taxonid"]] = (r["scientfiicname"], r["taxonrank"], r["taxonomicstatus"], r["acceptednameusageid"], r["parentnameusageid"])
    parents = {p[4] for p in rows.values() if p[1] != "Species"}
    for r in _rows("wcvp_taxon.csv"):
        if r["taxonid"] in parents:
            rows[r["taxonid"]] = (r["scientfiicname"], r["taxonrank"], r["taxonomicstatus"], r["acceptednameusageid"], r["parentnameusageid"])
    out: dict[str, tuple[str, str]] = {}
    for name, cands in hits.items():
        # 命名人寫在原文裡的優先，再來是名字本身是接受的種、最後是異名與變種
        texts = [_norm(t) for t in (authors or {}).get(name, [])]
        cands.sort(key=lambda c: (not (c[4] and any(t.startswith(_norm(c[4])) for t in texts)), c[1] != "Species", c[2] != "Accepted"))
        for tid, rank, status, acc, _author in cands:
            target = rows.get(acc)
            if not target:
                continue
            tname, trank, tstatus, _, tparent = target
            if tstatus != "Accepted":
                continue
            if trank != "Species":
                p = rows.get(tparent)
                if not p or p[1] != "Species":
                    continue
                acc, tname = tparent, p[0]
            out[name] = (acc, tname)
            break
    return out


def region_iso3() -> dict[str, list[str]]:
    """TDWG 第三級地區 → ISO3（照 DROP、ISO_FIX）"""
    data = json.loads(download(LEVEL4, "wcvp", "level4.geojson").read_text(encoding="utf-8"))
    raw: dict[str, set[str]] = defaultdict(set)
    for f in data["features"]:
        p = f["properties"]
        raw[p["Level3_cod"]].add(p["ISO_Code"])
    out: dict[str, list[str]] = {}
    for l3, isos in raw.items():
        codes = []
        for iso in sorted(isos):
            if (l3, iso) in DROP or iso in ISO_SKIP or not iso:
                continue
            for c in ISO_FIX.get(iso) or [from_alpha2(iso)]:
                if c and c not in codes:
                    codes.append(c)
        out[l3] = codes
    return out


def native_regions(ids: set[str]) -> dict[str, set[str]]:
    """{taxonid: {原生的 TDWG 第三級地區}}"""
    out: dict[str, set[str]] = defaultdict(set)
    for r in _rows("wcvp_distribution.csv"):
        if r["coreid"] in ids and not r["establishmentmeans"] and not r["occurrencestatus"]:
            out[r["coreid"]].add(r["locationid"].removeprefix("TDWG:"))
    return out

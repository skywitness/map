"""Epoch AI（https://epoch.ai/data，CC BY）：AI 運算叢集與重要 AI 模型。

- GPU clusters：已知的 AI 運算叢集，含所在國家、啟用日期、H100 等效數。
  Epoch 估計只涵蓋全球 AI 算力的一部分（公開可查的叢集），中國等地的叢集可能低報。
- Notable AI models：重要 AI 模型，含開發機構所屬國家（多個機構時以逗號分隔）。
"""
from __future__ import annotations

import csv
from datetime import date
from typing import NamedTuple

from common import download
from sources.countries import from_name

CLUSTERS_URL = "https://epoch.ai/data/gpu_clusters.csv"
MODELS_URL = "https://epoch.ai/data/notable_ai_models.csv"


class Cluster(NamedTuple):
    name: str
    country: str  # ISO alpha-3
    owner: str
    sector: str
    start: date
    h100e: float
    superseded_by: str


class Model(NamedTuple):
    name: str
    organization: str
    countries: frozenset[str]
    published: date


def _date(text: str) -> date | None:
    try:
        return date.fromisoformat(text.strip()[:10])
    except ValueError:
        return None


def clusters() -> list[Cluster]:
    path = download(CLUSTERS_URL, "epoch", "gpu_clusters.csv")
    out: list[Cluster] = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            iso3 = from_name(row["Country"])
            start = _date(row["First Operational Date"])
            if not iso3 or not start or not row["H100 equivalents"] or row["Decommissioned Date (if applicable)"]:
                continue
            out.append(Cluster(
                row["Name"], iso3, row["Owner"], row["Sector"], start,
                float(row["H100 equivalents"]), row["Superseded by"].strip(),
            ))
    return out


def models() -> list[Model]:
    path = download(MODELS_URL, "epoch", "notable_ai_models.csv")
    out: list[Model] = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            published = _date(row["Publication date"])
            countries = frozenset(c for name in row["Country (of organization)"].split(",") if (c := from_name(name)))
            if published and countries:
                out.append(Model(row["Model"], row["Organization"], countries, published))
    return out


def operational_at(all_clusters: list[Cluster], when: date) -> list[Cluster]:
    """某個日期時正在運作的叢集。分期擴建的叢集，後一期上線後前一期就不再重複計算。"""
    live = [c for c in all_clusters if c.start <= when]
    names = {c.name for c in live}
    return [c for c in live if not (c.superseded_by and c.superseded_by in names)]

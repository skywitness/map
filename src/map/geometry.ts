import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { geoArea, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

export type CountryGeometry = Feature<Polygon | MultiPolygon>;

export interface CountryFeature {
  /** ISO alpha-3（pipeline/build_geo.py 已把 id 換掉） */
  iso3: string;
  feature: CountryGeometry;
  /** 放比例圓的位置：取最大那塊陸地的中心，避免法國的圓跑到海上（法屬圭亞那） */
  anchor: [number, number];
}

/** 專題世界地圖慣例不畫南極洲，把版面留給有人住的地方 */
const HIDDEN = new Set(['ATA']);

export function toCountryFeatures(topo: Topology): CountryFeature[] {
  const collection = feature(
    topo,
    topo.objects.countries as GeometryCollection,
  ) as unknown as FeatureCollection<Polygon | MultiPolygon>;

  return collection.features
    .filter((f) => !HIDDEN.has(String(f.id)))
    .map((f) => ({ iso3: String(f.id), feature: f, anchor: mainlandCentroid(f) }));
}

function mainlandCentroid(f: CountryGeometry): [number, number] {
  if (f.geometry.type === 'Polygon') return geoCentroid(f);
  let largest: Polygon | null = null;
  let largestArea = -1;
  for (const coordinates of f.geometry.coordinates) {
    const polygon: Polygon = { type: 'Polygon', coordinates };
    const area = geoArea(polygon);
    if (area > largestArea) {
      largestArea = area;
      largest = polygon;
    }
  }
  return geoCentroid(largest ?? f);
}

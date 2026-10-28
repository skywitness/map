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

/**
 * world-atlas 的國界是給 D3 的球面幾何用的，跨 180° 經線的國家（斐濟、俄羅斯遠東）座標會從 179.9 跳到 −179.9。
 * MapLibre 把座標當平面處理，會畫出一條橫越整個地圖的邊，所以把每個 ring 的經度展開成連續的（可以超過 ±180）。
 */
export function unwrapAntimeridian(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.MultiPolygon {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return {
    type: 'MultiPolygon',
    coordinates: polygons.map((polygon) =>
      polygon.map((ring) => {
        let offset = 0;
        return ring.map(([lon, lat], i) => {
          if (i > 0) {
            const prev = ring[i - 1][0];
            if (lon - prev > 180) offset -= 360;
            else if (prev - lon > 180) offset += 360;
          }
          return [lon + offset, lat];
        });
      }),
    ),
  };
}

interface LocatorPolygon {
  iso3: string;
  /** 經度展開成連續的環（unwrapAntimeridian），可能超出 ±180° */
  rings: number[][][];
  box: [number, number, number, number];
}

const locators = new WeakMap<CountryFeature[], (lon: number, lat: number) => string | null>();

/**
 * 任一經緯度在哪一國（地圖的 1:50m 國界，2026-10-28 起，地球的另一邊查游標的對蹠點）：不必畫在畫面上，
 * 地球儀背面的點也查得到。環先展開成連續的經度，點的經度再試 ±360°；先比範圍再用射線法（奇偶規則，洞自然扣掉）。
 * 同一份國界回傳同一個函式。南極洲不在地圖的國家裡（HIDDEN），查不到
 */
export function countryLocator(countries: CountryFeature[]): (lon: number, lat: number) => string | null {
  const cached = locators.get(countries);
  if (cached) return cached;
  const polygons: LocatorPolygon[] = [];
  for (const c of countries) {
    for (const rings of unwrapAntimeridian(c.feature.geometry).coordinates) {
      let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [x, y] of rings[0]) {
        w = Math.min(w, x);
        e = Math.max(e, x);
        s = Math.min(s, y);
        n = Math.max(n, y);
      }
      polygons.push({ iso3: c.iso3, rings, box: [w, s, e, n] });
    }
  }
  const inside = (rings: number[][][], x: number, y: number) => {
    let odd = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
      }
    }
    return odd;
  };
  const locate = (lon: number, lat: number) => {
    for (const p of polygons) {
      const [w, s, e, n] = p.box;
      if (lat < s || lat > n) continue;
      for (const x of [lon, lon - 360, lon + 360]) {
        if (x >= w && x <= e && inside(p.rings, x, lat)) return p.iso3;
      }
    }
    return null;
  };
  locators.set(countries, locate);
  return locate;
}

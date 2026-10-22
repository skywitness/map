import { memo, useMemo } from 'react';
import { geoPath, type GeoProjection } from 'd3-geo';
import type { AirportsData, RailwaysData } from '../topics/types';
import type { Tokens } from '../theme/tokens';

export interface LayerVisibility {
  railways: boolean;
  largeAirports: boolean;
  mediumAirports: boolean;
}

// 中型機場有兩千多座，世界全圖時會蓋住鐵路，預設關閉
export const DEFAULT_LAYERS: LayerVisibility = { railways: true, largeAirports: true, mediumAirports: false };

/** 把差分編碼的鐵路還原成經緯度 MultiLineString */
export function decodeRailways(data: RailwaysData): GeoJSON.MultiLineString {
  const q = data.quantum;
  const coordinates = data.lines.map((flat) => {
    const line: [number, number][] = [];
    let x = 0;
    let y = 0;
    for (let i = 0; i < flat.length; i += 2) {
      x += flat[i];
      y += flat[i + 1];
      line.push([x * q, y * q]);
    }
    return line;
  });
  return { type: 'MultiLineString', coordinates };
}

interface OverlayLayersProps {
  projection: GeoProjection;
  railways: GeoJSON.MultiLineString | null;
  airports: AirportsData | null;
  layers: LayerVisibility;
  tokens: Tokens;
  hoveredAirport: number | null;
}

/**
 * 鐵路是一條很長的 path，機場是幾千個圓點。縮放時只改外層 <g> 的 transform，
 * 圓點大小用 CSS 變數 --k 抵銷縮放，所以這個元件不必在每次縮放時重畫。
 */
export const OverlayLayers = memo(function OverlayLayers(props: OverlayLayersProps) {
  const { projection, railways, airports, layers, tokens, hoveredAirport } = props;

  const railPath = useMemo(
    () => (railways ? (geoPath(projection)(railways) ?? '') : ''),
    [projection, railways],
  );

  const points = useMemo(() => {
    if (!airports) return [];
    return airports.rows.flatMap((row, index) => {
      const p = projection([row[0], row[1]]);
      return p ? [{ index, x: p[0], y: p[1], large: row[2] === 1, iso3: row[6] }] : [];
    });
  }, [projection, airports]);

  return (
    <g className="overlays">
      {layers.railways && railPath && <path d={railPath} className="rail-lines" stroke={tokens.ink} />}
      {points.map((p) =>
        (p.large ? layers.largeAirports : layers.mediumAirports) ? (
          <circle
            key={p.index}
            data-airport={p.index}
            data-iso3={p.iso3}
            className={p.large ? 'airport airport-large' : 'airport airport-medium'}
            cx={p.x}
            cy={p.y}
            fill={tokens.hues.orange}
            stroke={p.index === hoveredAirport ? tokens.ink : tokens.surface}
          />
        ) : null,
      )}
    </g>
  );
});

interface LayerControlsProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
  hasRailways: boolean;
  hasAirports: boolean;
  tokens: Tokens;
}

/** 圖層開關，同時當作圖例 */
export function LayerControls({ layers, onChange, hasRailways, hasAirports, tokens }: LayerControlsProps) {
  const toggle = (key: keyof LayerVisibility) => onChange({ ...layers, [key]: !layers[key] });
  return (
    <fieldset className="legend map-layers">
      <legend className="legend-title">圖層</legend>
      {hasRailways && (
        <label>
          <input type="checkbox" checked={layers.railways} onChange={() => toggle('railways')} />
          <svg width="18" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="17" y2="5" stroke={tokens.ink} strokeWidth="1.2" />
          </svg>
          鐵路
        </label>
      )}
      {hasAirports && (
        <>
          <label>
            <input type="checkbox" checked={layers.largeAirports} onChange={() => toggle('largeAirports')} />
            <svg width="18" height="10" aria-hidden="true">
              <circle cx="9" cy="5" r="4" fill={tokens.hues.orange} />
            </svg>
            大型機場
          </label>
          <label>
            <input type="checkbox" checked={layers.mediumAirports} onChange={() => toggle('mediumAirports')} />
            <svg width="18" height="10" aria-hidden="true">
              <circle cx="9" cy="5" r="2.5" fill={tokens.hues.orange} />
            </svg>
            中型機場（有定期航班）
          </label>
        </>
      )}
    </fieldset>
  );
}

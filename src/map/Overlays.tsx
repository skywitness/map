import type { RailwaysData } from '../topics/types';
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

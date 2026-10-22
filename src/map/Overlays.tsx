import type { RailwaysData } from '../topics/types';
import { MAP_TOKENS, type Tokens } from '../theme/tokens';

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

/** 圖層的圖例：畫面上的開關與匯出的圖片共用 */
export interface LayerKey {
  key: keyof LayerVisibility;
  source: 'railways' | 'airports';
  label: string;
  /** 線（鐵路）或圓點（機場），size 是線寬或半徑（px） */
  shape: 'line' | 'dot';
  size: number;
}

export const LAYER_KEYS: LayerKey[] = [
  { key: 'railways', source: 'railways', label: '鐵路', shape: 'line', size: 1.2 },
  { key: 'largeAirports', source: 'airports', label: '大型機場', shape: 'dot', size: 4 },
  { key: 'mediumAirports', source: 'airports', label: '中型機場（有定期航班）', shape: 'dot', size: 2.5 },
];

/** 線用介面的文字色（圖例卡片跟著深淺色切換），機場點跟地圖上一樣用地圖色 */
export function layerKeyColor(k: LayerKey, tokens: Tokens): string {
  return k.shape === 'line' ? tokens.ink : MAP_TOKENS.hues.orange;
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
  const keys = LAYER_KEYS.filter((k) => (k.source === 'railways' ? hasRailways : hasAirports));
  return (
    <fieldset className="legend map-layers">
      <legend className="legend-title">圖層</legend>
      {keys.map((k) => (
        <label key={k.key}>
          <input type="checkbox" checked={layers[k.key]} onChange={() => toggle(k.key)} />
          <svg width="18" height="10" aria-hidden="true">
            {k.shape === 'line' ? (
              <line x1="1" y1="5" x2="17" y2="5" stroke={layerKeyColor(k, tokens)} strokeWidth={k.size} />
            ) : (
              <circle cx="9" cy="5" r={k.size} fill={layerKeyColor(k, tokens)} />
            )}
          </svg>
          {k.label}
        </label>
      ))}
    </fieldset>
  );
}

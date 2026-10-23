import { tr, useLang, useT, type Text } from '../i18n';
import type { RailwaysData } from '../topics/types';
import { MAP_TOKENS, type Tokens } from '../theme/tokens';

export interface LayerVisibility {
  railways: boolean;
  largeAirports: boolean;
  mediumAirports: boolean;
  /** 地形陰影（有地形圖層的主題才有） */
  hillshade: boolean;
}

// 中型機場有兩千多座，世界全圖時會蓋住鐵路，預設關閉
export const DEFAULT_LAYERS: LayerVisibility = { railways: true, largeAirports: true, mediumAirports: false, hillshade: true };

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
  source: 'railways' | 'airports' | 'terrain';
  label: Text;
  /** 線（鐵路）、圓點（機場）或陰影色塊（地形陰影），size 是線寬或半徑（px） */
  shape: 'line' | 'dot' | 'shade';
  size: number;
}

export const LAYER_KEYS: LayerKey[] = [
  { key: 'railways', source: 'railways', label: { zh: '鐵路', en: 'Railways' }, shape: 'line', size: 1.2 },
  {
    key: 'largeAirports',
    source: 'airports',
    label: { zh: '大型機場', en: 'Large airports' },
    shape: 'dot',
    size: 4,
  },
  {
    key: 'mediumAirports',
    source: 'airports',
    label: { zh: '中型機場（有定期航班）', en: 'Medium airports (scheduled flights)' },
    shape: 'dot',
    size: 2.5,
  },
  { key: 'hillshade', source: 'terrain', label: { zh: '地形陰影', en: 'Hillshade' }, shape: 'shade', size: 5 },
];

/** 陰影色塊：左上亮、右下暗（光源在西北方，跟地圖上的地形陰影一樣） */
export const SHADE_KEY: [string, string] = ['#f4f1ea', '#6b6355'];

/** 線用介面的文字色（圖例卡片跟著深淺色切換），機場點跟地圖上一樣用地圖色 */
export function layerKeyColor(k: LayerKey, tokens: Tokens): string {
  return k.shape === 'line' ? tokens.ink : MAP_TOKENS.hues.orange;
}

interface LayerControlsProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
  hasRailways: boolean;
  hasAirports: boolean;
  hasTerrain?: boolean;
  tokens: Tokens;
}

/** 圖層開關，同時當作圖例 */
export function LayerControls({ layers, onChange, hasRailways, hasAirports, hasTerrain = false, tokens }: LayerControlsProps) {
  const t = useT();
  const lang = useLang();
  const toggle = (key: keyof LayerVisibility) => onChange({ ...layers, [key]: !layers[key] });
  const has = { railways: hasRailways, airports: hasAirports, terrain: hasTerrain };
  const keys = LAYER_KEYS.filter((k) => has[k.source]);
  return (
    <fieldset className="legend map-layers">
      <legend className="legend-title">{t.layers}</legend>
      {keys.map((k) => (
        <label key={k.key}>
          <input type="checkbox" checked={layers[k.key]} onChange={() => toggle(k.key)} />
          <svg width="18" height="10" aria-hidden="true">
            {k.shape === 'line' ? (
              <line x1="1" y1="5" x2="17" y2="5" stroke={layerKeyColor(k, tokens)} strokeWidth={k.size} />
            ) : k.shape === 'shade' ? (
              <>
                <defs>
                  <linearGradient id="shade-key" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={SHADE_KEY[0]} />
                    <stop offset="1" stopColor={SHADE_KEY[1]} />
                  </linearGradient>
                </defs>
                <rect x="2" y="0" width="14" height="10" rx="2" fill="url(#shade-key)" />
              </>
            ) : (
              <circle cx="9" cy="5" r={k.size} fill={layerKeyColor(k, tokens)} />
            )}
          </svg>
          {tr(k.label, lang)}
        </label>
      ))}
    </fieldset>
  );
}

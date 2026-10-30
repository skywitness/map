import { useId, type CSSProperties, type PointerEvent } from 'react';
import { NO_DATA_HATCH_INK } from '../map/worldMapLayers';
import { MAP_TOKENS } from '../theme/tokens';
import { VIEW_W, type WorldShapes } from './shapes';

export interface Bubble {
  iso3: string;
  r: number;
  color: string;
}

interface SvgWorldProps {
  shapes: WorldShapes;
  /** 國家的顏色；null 是沒有資料（灰底加斜線，跟主地圖一樣）、undefined 是不上色（只畫陸地） */
  fill: (iso3: string) => string | null | undefined;
  bubbles?: Bubble[];
  selected: string | null;
  /** 別的小地圖滑到的國家，這裡也框起來（小地圖並排） */
  hovered?: string | null;
  onHover: (iso3: string | null, e?: PointerEvent) => void;
  onSelect: (iso3: string) => void;
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
}

/** 陸地沒上色時的顏色（比例圓的指標）：跟主地圖世界視角的陸地差不多 */
const LAND = '#ece9e1';

/**
 * 分析檢視的一張世界地圖（SVG）：海、國家（依 fill 上色，沒資料的畫斜線）、比例圓、選取與滑到的國家外框。
 * 滑鼠事件掛在整張 svg 上，用 data-iso3 認出是哪一國
 */
export function SvgWorld({ shapes, fill, bubbles, selected, hovered, onHover, onSelect, ariaLabel, className, style }: SvgWorldProps) {
  const hatch = `${useId().replace(/:/g, '')}-hatch`;
  const pick = (e: { target: EventTarget }) => (e.target as Element).closest('[data-iso3]')?.getAttribute('data-iso3') ?? null;
  const outline = (iso3: string | null | undefined, cls: string) => {
    const c = iso3 ? shapes.countries.find((x) => x.iso3 === iso3) : undefined;
    const b = iso3 ? bubbles?.find((x) => x.iso3 === iso3) : undefined;
    const at = iso3 ? shapes.anchors.get(iso3) : undefined;
    return (
      <>
        {c && <path className={cls} d={c.d} />}
        {b && at && <circle className={cls} cx={at[0]} cy={at[1]} r={b.r} />}
      </>
    );
  };
  return (
    <svg
      className={`svg-world${className ? ` ${className}` : ''}`}
      style={style}
      viewBox={`0 0 ${VIEW_W} ${shapes.height}`}
      role="img"
      aria-label={ariaLabel}
      onPointerMove={(e) => onHover(pick(e), e)}
      onPointerLeave={() => onHover(null)}
      onClick={(e) => {
        const iso3 = pick(e);
        if (iso3) onSelect(iso3);
      }}
    >
      <defs>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={MAP_TOKENS.noData} />
          <line x1="0" y1="0" x2="0" y2="6" stroke={NO_DATA_HATCH_INK} strokeWidth="1.2" />
        </pattern>
      </defs>
      <path className="svg-world-sea" d={shapes.sphere} />
      <g className="svg-world-countries">
        {shapes.countries.map(({ iso3, d }) => {
          const color = fill(iso3);
          return <path key={iso3} data-iso3={iso3} d={d} fill={color === null ? `url(#${hatch})` : (color ?? LAND)} />;
        })}
      </g>
      {bubbles && (
        <g className="svg-world-bubbles">
          {bubbles.map(({ iso3, r, color }) => {
            const at = shapes.anchors.get(iso3);
            return at ? <circle key={iso3} data-iso3={iso3} cx={at[0]} cy={at[1]} r={r} fill={color} /> : null;
          })}
        </g>
      )}
      {hovered && hovered !== selected && outline(hovered, 'svg-world-hover')}
      {selected && outline(selected, 'svg-world-selected')}
    </svg>
  );
}

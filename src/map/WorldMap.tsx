import { memo, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { IndicatorDef } from '../topics/types';
import type { Tokens } from '../theme/tokens';
import type { CountryFeature } from './geometry';
import { BubbleLegend, ChoroplethLegend } from './Legend';
import { bubbleScale, choroplethScale } from './scales';
import { useElementSize } from './useElementSize';

interface WorldMapProps {
  countries: CountryFeature[];
  indicator: IndicatorDef;
  /** 目前年份的數值，只放有資料的國家 */
  values: Map<string, number>;
  /** 比例圓用：所有年份中的最大值 */
  bubbleMax: number;
  tokens: Tokens;
  selected: string | null;
  onSelect: (iso3: string | null) => void;
  renderTooltip: (iso3: string) => ReactNode;
  ariaLabel: string;
  /** 新資料載入中，先調淡舊畫面 */
  dimmed?: boolean;
}

interface Shape {
  iso3: string;
  d: string;
  /** 投影後的面積（px²），太小的國家另外畫一個點，才看得到也點得到 */
  area: number;
  anchor: [number, number];
}

const PADDING = 12;
const TINY_AREA = 6;
const MAX_ZOOM = 12;

export function WorldMap(props: WorldMapProps) {
  const { countries, indicator, values, bubbleMax, tokens, selected, onSelect, renderTooltip, ariaLabel, dimmed } =
    props;
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const size = useElementSize(containerRef);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hover, setHover] = useState<{ iso3: string; x: number; y: number } | null>(null);

  // 投影只跟版面大小有關；縮放用 <g transform>，不重算路徑
  const geo = useMemo(() => {
    if (!size) return null;
    const projection = geoEqualEarth().fitExtent(
      [
        [PADDING, PADDING],
        [size.width - PADDING, size.height - PADDING],
      ],
      { type: 'FeatureCollection', features: countries.map((c) => c.feature) },
    );
    const path = geoPath(projection);
    const shapes: Shape[] = countries.map((c) => ({
      iso3: c.iso3,
      d: path(c.feature) ?? '',
      area: path.area(c.feature),
      anchor: projection(c.anchor) ?? [0, 0],
    }));
    return { sphere: path({ type: 'Sphere' }) ?? '', shapes, byIso: new Map(shapes.map((s) => [s.iso3, s])) };
  }, [countries, size]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .on('zoom', (event: { transform: ZoomTransform }) => setTransform(event.transform));
    select(svg).call(behavior);
    zoomRef.current = behavior;
    return () => {
      select(svg).on('.zoom', null);
    };
  }, []);

  useEffect(() => {
    if (!size || !zoomRef.current) return;
    const extent: [[number, number], [number, number]] = [
      [0, 0],
      [size.width, size.height],
    ];
    zoomRef.current.extent(extent).translateExtent(extent);
  }, [size]);

  const colorScale = indicator.layer.kind === 'choropleth' ? choroplethScale(indicator.layer.scale, tokens) : null;
  const radius = useMemo(() => bubbleScale(bubbleMax, size?.width ?? 1000), [bubbleMax, size]);

  const fills = useMemo(() => {
    if (!geo) return [];
    return geo.shapes.map((s) => {
      const v = values.get(s.iso3);
      if (v === undefined) return 'url(#no-data)';
      return colorScale ? colorScale(v) : tokens.land;
    });
  }, [geo, values, colorScale, tokens]);

  const bubbles = useMemo(() => {
    if (!geo || indicator.layer.kind !== 'bubble') return [];
    return geo.shapes
      .filter((s) => values.has(s.iso3))
      .map((s) => ({ iso3: s.iso3, x: s.anchor[0], y: s.anchor[1], r: radius(values.get(s.iso3)!) }))
      .sort((a, b) => b.r - a.r); // 大圓先畫，小圓疊在上面才點得到
  }, [geo, indicator.layer.kind, values, radius]);

  const tinyMarkers = useMemo(() => {
    if (!geo || indicator.layer.kind !== 'choropleth') return [];
    // 只替有資料的小國畫點；沒資料的無人小島（赫德島等）畫了只是雜訊
    return geo.shapes.flatMap((shape, index) =>
      shape.area < TINY_AREA && values.has(shape.iso3) ? [{ shape, index }] : [],
    );
  }, [geo, indicator.layer.kind, values]);

  const isoFromEvent = (e: { target: EventTarget }) =>
    (e.target as Element).closest?.('[data-iso3]')?.getAttribute('data-iso3') ?? null;

  const onPointerMove = (e: PointerEvent) => {
    const iso3 = isoFromEvent(e);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!iso3 || !rect) return setHover(null);
    setHover({ iso3, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const zoomBy = (factor: number) => {
    if (svgRef.current && zoomRef.current) zoomRef.current.scaleBy(select(svgRef.current), factor);
  };
  const resetZoom = () => {
    if (svgRef.current && zoomRef.current) zoomRef.current.transform(select(svgRef.current), zoomIdentity);
  };

  const k = transform.k;
  const selectedShape = selected ? geo?.byIso.get(selected) : undefined;
  const hoverShape = hover ? geo?.byIso.get(hover.iso3) : undefined;

  return (
    <div ref={containerRef} className={`map${dimmed ? ' is-dimmed' : ''}`}>
      <svg
        ref={svgRef}
        width={size?.width ?? 0}
        height={size?.height ?? 0}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onSelect(isoFromEvent(e))}
      >
        <defs>
          <pattern id="no-data" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill={tokens.land} />
            <line x1="0" y1="0" x2="0" y2="5" stroke={tokens.noDataLine} strokeWidth="1" />
          </pattern>
        </defs>
        {geo && (
          <g transform={transform.toString()}>
            <path d={geo.sphere} className="sphere" fill={tokens.surface} stroke={tokens.grid} />
            <CountryShapes shapes={geo.shapes} fills={fills} stroke={tokens.countryBorder} />
            {tinyMarkers.map(({ shape, index }) => (
              <circle
                key={shape.iso3}
                data-iso3={shape.iso3}
                className="tiny-marker"
                cx={shape.anchor[0]}
                cy={shape.anchor[1]}
                r={3.5 / k}
                fill={fills[index]}
                stroke={tokens.inkMuted}
              />
            ))}
            {bubbles.map((b) => (
              <circle
                key={b.iso3}
                data-iso3={b.iso3}
                className="bubble"
                cx={b.x}
                cy={b.y}
                r={b.r / k}
                fill={tokens.accent}
                stroke={b.iso3 === selected || b.iso3 === hover?.iso3 ? tokens.ink : tokens.surface}
              />
            ))}
            {selectedShape && <path d={selectedShape.d} className="outline outline-selected" stroke={tokens.ink} />}
            {hoverShape && hoverShape !== selectedShape && (
              <path d={hoverShape.d} className="outline" stroke={tokens.ink} />
            )}
          </g>
        )}
      </svg>

      <div className="map-zoom" role="group" aria-label="縮放">
        <button type="button" onClick={() => zoomBy(1.6)} aria-label="放大">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label="縮小">
          −
        </button>
        <button type="button" onClick={resetZoom} aria-label="重設縮放" disabled={k === 1 && transform.x === 0}>
          ⟲
        </button>
      </div>

      <div className="map-legend">
        {colorScale ? (
          <ChoroplethLegend indicator={indicator} scale={colorScale} />
        ) : (
          <BubbleLegend indicator={indicator} radius={radius} tokens={tokens} />
        )}
      </div>

      {hover && size && (
        <MapTooltip x={hover.x} y={hover.y} width={size.width} height={size.height}>
          {renderTooltip(hover.iso3)}
        </MapTooltip>
      )}
    </div>
  );
}

/** 國家形狀單獨 memo：縮放、hover 時不重畫 240 條路徑，只有換年份（fills 變了）才更新 */
const CountryShapes = memo(function CountryShapes({
  shapes,
  fills,
  stroke,
}: {
  shapes: Shape[];
  fills: string[];
  stroke: string;
}) {
  return (
    <g className="countries">
      {shapes.map((s, i) => (
        <path key={s.iso3} d={s.d} data-iso3={s.iso3} fill={fills[i]} stroke={stroke} />
      ))}
    </g>
  );
});

interface MapTooltipProps {
  x: number;
  y: number;
  width: number;
  height: number;
  children: ReactNode;
}

function MapTooltip({ x, y, width, height, children }: MapTooltipProps) {
  const flipX = x > width - 260;
  const flipY = y > height - 140;
  return (
    <div
      className="map-tooltip"
      role="status"
      style={{
        left: x + (flipX ? -14 : 14),
        top: y + (flipY ? -14 : 14),
        transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
      }}
    >
      {children}
    </div>
  );
}

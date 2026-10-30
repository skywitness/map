import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import { defineMessages, useLang } from '../i18n';
import type { PersonalRoute } from '../lib/personalRoutes';
import { routeProfile, type RouteProfile } from '../lib/routeProfile';
import { MAP_TOKENS } from '../theme/tokens';

/**
 * 我的路線的高度剖面（2026-10-30 起，賽車；使用者：「像 OpenRunner 一樣」）：地圖下緣一條，橫軸距離、縱軸海拔，
 * 面依坡度上色（5 級，坡度越陡越深）。滑過或用左右鍵時，畫一條直線與一個點、寫出距離、海拔、坡度、累計爬升，
 * onHover 把那一點的經緯度交給 App，地圖上同一個位置放一個圓點。
 */
interface Props {
  route: PersonalRoute;
  onHover: (at: { lon: number; lat: number } | null) => void;
  onClose: () => void;
}

/** 坡度（絕對值，%）的分級與顏色：橘色循序色由淺到深 */
const GRADE_STOPS = [3, 6, 9, 12];
const GRADE_COLORS = [MAP_TOKENS.sequential[1], MAP_TOKENS.sequential[2], MAP_TOKENS.sequential[3], MAP_TOKENS.sequential[5], MAP_TOKENS.sequential[6]];
const gradeClass = (g: number) => GRADE_STOPS.filter((s) => Math.abs(g) >= s).length;

const TEXT = defineMessages({
  zh: {
    close: '關閉高度剖面',
    loading: '計算高度中…',
    failed: '取不到這條路線的海拔',
    km: (v: string) => `${v} km`,
    m: (v: string) => `${v} m`,
    summary: (len: string, gain: string, loss: string, min: string, max: string) => `${len} km · 爬升 ${gain} m · 下降 ${loss} m · 海拔 ${min}–${max} m`,
    fromFile: '海拔：路線檔',
    fromDem: '海拔：AWS Terrain Tiles 地形圖磚',
    grade: '坡度',
    distance: '距離',
    elevation: '海拔',
    slope: '坡度',
    climb: '累計爬升',
    aria: (name: string, summary: string) => `${name}的高度剖面：${summary}。用左右鍵移動`,
  },
  en: {
    close: 'Close elevation profile',
    loading: 'Working out elevations…',
    failed: 'Elevation is not available for this route',
    km: (v: string) => `${v} km`,
    m: (v: string) => `${v} m`,
    summary: (len: string, gain: string, loss: string, min: string, max: string) =>
      `${len} km · ${gain} m up · ${loss} m down · elevation ${min}–${max} m`,
    fromFile: 'Elevation: route file',
    fromDem: 'Elevation: AWS Terrain Tiles',
    grade: 'Gradient',
    distance: 'Distance',
    elevation: 'Elevation',
    slope: 'Gradient',
    climb: 'Climbed so far',
    aria: (name: string, summary: string) => `Elevation profile of ${name}: ${summary}. Use the arrow keys to move along it`,
  },
});

const HEIGHT = 110;
const PAD = { left: 44, right: 10, top: 8, bottom: 20 };

export function RouteProfilePanel({ route, onHover, onClose }: Props) {
  const lang = useLang();
  const t = TEXT[lang];
  const [profile, setProfile] = useState<RouteProfile | null | undefined>(undefined);
  const [index, setIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(600);
  const plotRef = useRef<HTMLDivElement>(null);
  const nf = (v: number, digits = 0) => v.toLocaleString(lang === 'zh' ? 'zh-TW' : 'en', { maximumFractionDigits: digits, minimumFractionDigits: digits });

  useEffect(() => {
    let cancelled = false;
    setProfile(undefined);
    setIndex(null);
    routeProfile(route).then(
      (p) => !cancelled && setProfile(p),
      () => !cancelled && setProfile(null),
    );
    return () => {
      cancelled = true;
    };
  }, [route]);

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(200, el.clientWidth)));
    ro.observe(el);
    setWidth(Math.max(200, el.clientWidth));
    return () => ro.disconnect();
  }, [profile]);

  // 換路線或關掉時地圖上的點拿掉
  useEffect(() => () => onHover(null), [onHover]);

  const chart = useMemo(() => {
    if (!profile) return null;
    const x = scaleLinear().domain([0, profile.length / 1000]).range([PAD.left, width - PAD.right]);
    const span = Math.max(20, profile.max - profile.min);
    const y = scaleLinear()
      .domain([profile.min - span * 0.08, profile.max + span * 0.08])
      .range([HEIGHT - PAD.bottom, PAD.top])
      .nice(4);
    const n = profile.dist.length;
    const px = (i: number) => x(profile.dist[i] / 1000);
    const py = (i: number) => y(profile.ele[i]);
    const base = HEIGHT - PAD.bottom;
    // 坡度相同的一段一個面（顏色依坡度）；短於全長約 0.5% 的一段併進前一段，不會變成一條一條
    const cls = Array.from(profile.grade, gradeClass);
    const minRun = Math.max(2, Math.round(n / 200));
    const runs: [number, number, number][] = []; // [起, 迄, 級]
    for (let i = 0; i < n; ) {
      let j = i;
      while (j + 1 < n && cls[j + 1] === cls[i]) j++;
      const last = runs[runs.length - 1];
      if (last && j - i + 1 < minRun) last[1] = j;
      else runs.push([i, j, cls[i]]);
      i = j + 1;
    }
    const areas = runs.map(([s, e, c]) => {
      const end = Math.min(e + 1, n - 1);
      let d = `M${px(s).toFixed(1)},${base}`;
      for (let j = s; j <= end; j++) d += `L${px(j).toFixed(1)},${py(j).toFixed(1)}`;
      d += `L${px(end).toFixed(1)},${base}Z`;
      return { d, color: GRADE_COLORS[c] };
    });
    let line = '';
    for (let i = 0; i < n; i++) line += `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(i).toFixed(1)}`;
    const xTicks = x.ticks(Math.max(2, Math.floor(width / 90)));
    const yTicks = y.ticks(3);
    return { x, y, px, py, areas, line, xTicks, yTicks, base };
  }, [profile, width]);

  const setAt = (i: number | null) => {
    setIndex(i);
    onHover(i === null || !profile ? null : { lon: profile.lon[i], lat: profile.lat[i] });
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!profile || !chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const km = chart.x.invert(e.clientX - rect.left);
    const d = Math.min(profile.length, Math.max(0, km * 1000));
    // 取樣點等距：直接算最近的一點
    const n = profile.dist.length;
    const i = Math.round((d / Math.max(1, profile.length)) * (n - 1));
    setAt(Math.min(n - 1, Math.max(0, i)));
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!profile) return;
    const n = profile.dist.length;
    const step = Math.max(1, Math.round(n / 100));
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const from = index ?? (e.key === 'ArrowRight' ? -step : n - 1 + step);
      setAt(Math.min(n - 1, Math.max(0, from + (e.key === 'ArrowRight' ? step : -step))));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (index !== null) setAt(null);
      else onClose();
    }
  };

  const summary = profile ? t.summary(nf(profile.length / 1000, 1), nf(profile.gain), nf(profile.loss), nf(profile.min), nf(profile.max)) : '';
  const tipLeft = chart && index !== null ? Math.min(Math.max(chart.px(index) + 10, 0), width - 170) : 0;
  const flipTip = chart && index !== null && chart.px(index) > width - 180;

  return (
    <section className="route-profile" aria-label={route.name}>
      <header className="route-profile-head">
        <div className="route-profile-title">
          <strong translate="no">{route.name}</strong>
          {profile && <span>{summary}</span>}
        </div>
        {profile && (
          <ul className="chart-legend route-profile-legend" aria-label={t.grade}>
            <li>{t.grade}</li>
            {GRADE_COLORS.map((c, k) => (
              <li key={c}>
                <span className="chart-legend-box" style={{ background: c }} aria-hidden="true" />
                {k === 0 ? `< ${GRADE_STOPS[0]}%` : k === GRADE_COLORS.length - 1 ? `≥ ${GRADE_STOPS[k - 1]}%` : `${GRADE_STOPS[k - 1]}–${GRADE_STOPS[k]}%`}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="route-profile-close" onClick={onClose} aria-label={t.close} title={t.close}>
          ×
        </button>
      </header>
      <div className="chart-plot route-profile-plot" ref={plotRef}>
        {profile === undefined && <p className="route-profile-status">{t.loading}</p>}
        {profile === null && <p className="route-profile-status">{t.failed}</p>}
        {profile && chart && (
          <>
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={t.aria(route.name, summary)}
              tabIndex={0}
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setAt(null)}
              onKeyDown={onKey}
              onBlur={() => setAt(null)}
            >
              {chart.yTicks.map((v) => (
                <g key={`y${v}`}>
                  <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={chart.y(v)} y2={chart.y(v)} />
                  <text className="chart-tick" x={PAD.left - 6} y={chart.y(v) + 4} textAnchor="end">
                    {nf(v)}
                  </text>
                </g>
              ))}
              {chart.areas.map((a, k) => (
                <path key={k} d={a.d} fill={a.color} stroke="none" />
              ))}
              <path className="route-profile-line" d={chart.line} />
              <line className="chart-axis" x1={PAD.left} x2={width - PAD.right} y1={chart.base} y2={chart.base} />
              {chart.xTicks.map((v) => (
                <text key={`x${v}`} className="chart-tick" x={chart.x(v)} y={chart.base + 14} textAnchor="middle">
                  {t.km(nf(v, v % 1 ? 1 : 0))}
                </text>
              ))}
              {index !== null && (
                <>
                  <line className="chart-pointer" x1={chart.px(index)} x2={chart.px(index)} y1={PAD.top} y2={chart.base} />
                  <circle className="route-profile-dot" cx={chart.px(index)} cy={chart.py(index)} r={4.5} />
                </>
              )}
            </svg>
            {index !== null && (
              <div
                className="chart-tooltip route-profile-tip"
                aria-hidden="true"
                style={flipTip ? { left: Math.max(0, chart.px(index) - 180) } : { left: tipLeft }}
              >
                <div>
                  <span>{t.distance}</span> {t.km(nf(profile.dist[index] / 1000, 2))}
                </div>
                <div>
                  <span>{t.elevation}</span> {t.m(nf(profile.ele[index]))}
                </div>
                <div>
                  <span>{t.slope}</span> {nf(profile.grade[index], 1)}%
                </div>
                <div>
                  <span>{t.climb}</span> {t.m(nf(profile.climb[index]))}
                </div>
              </div>
            )}
            <p className="route-profile-source">{profile.source === 'file' ? t.fromFile : t.fromDem}</p>
          </>
        )}
      </div>
    </section>
  );
}

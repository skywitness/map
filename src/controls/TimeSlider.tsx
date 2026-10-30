import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '../i18n';
import { useHotkeys } from './hotkeys';

interface TimeSliderProps {
  years: number[];
  year: number;
  projectionFrom?: number;
  /** 推估年份換一種稱呼（例如「規劃中」），之前的年份不標「估計值」（指標的 projectionLabel） */
  projectionLabel?: { tag: string; from: (year: number) => string };
  /** 這一年以前多半是估計值（資料檔的 estimatesBefore）：沒有推估年份時，之前的年份標「估計值」 */
  estimatesBefore?: number;
  /** 年份不是「那一年的資料」時（指標的 timeAxis，例如平均身高的「出生年」）：寫在年份上面，也是拉桿的名稱 */
  axis?: { label: string; year: (year: number) => string; tick?: (year: number) => string };
  onChange: (year: number) => void;
  /** 拉桿背後淡淡畫的走勢（世界的總量、平均或各國中位數，跟 years 一一對應，app/trend.ts） */
  trend?: (number | null)[] | null;
  /** 開始、停止播放時通知（App 在地圖上疊大大的年份） */
  onPlayingChange?: (playing: boolean) => void;
}

const PLAY_INTERVAL_MS = 120;

export function TimeSlider({
  years,
  year,
  projectionFrom,
  projectionLabel,
  estimatesBefore,
  axis,
  onChange,
  trend,
  onPlayingChange,
}: TimeSliderProps) {
  const first = years[0];
  const last = years[years.length - 1];
  /** 刻度與目前的值：有 axis.tick 時照它寫（各國在讀什麼的月份），沒有是數字本身 */
  const tick = (y: number) => (axis?.tick ? axis.tick(y) : y);
  const [playing, setPlaying] = useState(false);
  const t = useT();
  const yearRef = useRef(year);
  yearRef.current = year;

  useEffect(() => onPlayingChange?.(playing), [playing, onPlayingChange]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      // 年份不一定連續（例如移民存量每 5 年一筆），播放時跳到資料裡的下一個年份
      const next = years.find((y) => y > yearRef.current);
      if (next === undefined) {
        setPlaying(false);
        return;
      }
      onChange(next);
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, years, onChange]);

  const togglePlay = () => {
    if (!playing && year >= last) onChange(first);
    setPlaying((p) => !p);
  };

  /** 鍵盤 ←/→：跳到資料裡的上一個／下一個年份（年份不一定連續） */
  const stepYear = (delta: number) => {
    setPlaying(false);
    const i = years.indexOf(yearRef.current);
    const next = years[Math.min(years.length - 1, Math.max(0, i + delta))];
    if (next !== undefined && next !== yearRef.current) onChange(next);
  };

  useHotkeys({ ArrowLeft: () => stepYear(-1), ArrowRight: () => stepYear(1), ' ': togglePlay }, first !== last);

  // 「2026 起為推估」離頭尾太近時（手機上拉桿短）：標籤本身往內移，不超出拉桿（會蓋到右邊的年份），
  // 跟頭尾的年份疊在一起時藏起被蓋到的那個年份
  const ticksRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const ticks = ticksRef.current;
    const middle = ticks?.querySelector<HTMLElement>('.tick-projection');
    if (!ticks || !middle) return;
    const ends = [ticks.firstElementChild, ticks.lastElementChild] as HTMLElement[];
    const check = () => {
      middle.style.translate = '';
      const box = ticks.getBoundingClientRect();
      let m = middle.getBoundingClientRect();
      const shift = m.right > box.right ? box.right - m.right : m.left < box.left ? box.left - m.left : 0;
      if (shift) {
        middle.style.translate = `${shift}px`;
        m = middle.getBoundingClientRect();
      }
      for (const end of ends) {
        end.style.visibility = 'visible';
        const r = end.getBoundingClientRect();
        if (r.right + 6 > m.left && r.left - 6 < m.right) end.style.visibility = 'hidden';
      }
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(ticks);
    return () => observer.disconnect();
  }, [first, last, projectionFrom, projectionLabel, t]);

  if (first === last) {
    return (
      <div className="time-slider is-single">
        <span className="time-single-note">{t.singleSnapshot}</span>
        <output className="time-year">
          {axis && <span className="time-axis">{axis.label}</span>}
          {tick(year)}
        </output>
      </div>
    );
  }

  const projected = projectionFrom !== undefined && year >= projectionFrom;
  const projectionPct =
    projectionFrom !== undefined ? ((projectionFrom - first) / (last - first)) * 100 : 100;
  const projectionText =
    projectionFrom === undefined
      ? null
      : projectionLabel
        ? projectionLabel.from(projectionFrom)
        : t.projectionFrom(projectionFrom);

  return (
    <div className="time-slider">
      <button
        type="button"
        className="play"
        onClick={togglePlay}
        aria-label={playing ? t.pause : t.play}
        title={playing ? t.pause : t.playTitle}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="time-track">
        {trend && <TrendArea years={years} values={trend} projectionFrom={projectionFrom} />}
        <input
          type="range"
          min={first}
          max={last}
          step={1}
          value={year}
          aria-label={axis?.label ?? t.yearSlider}
          aria-valuetext={axis ? axis.year(year) : t.yearValue(year, projected)}
          onChange={(e) => {
            setPlaying(false);
            onChange(Number(e.target.value));
          }}
          style={{ '--projection-pct': `${projectionPct}%` } as CSSProperties}
        />
        <div className="time-ticks" aria-hidden="true" ref={ticksRef}>
          <span style={{ left: '0%' }}>{tick(first)}</span>
          {projectionFrom !== undefined && projectionFrom < last && (
            <span className="tick-projection" style={{ left: `${projectionPct}%` }}>
              {projectionText}
            </span>
          )}
          {/* 只有最後一年是推估時（例如就業主題的 2025 年），兩個標籤合成一個，免得疊在一起 */}
          <span style={{ left: '100%' }}>{projectionFrom === last ? projectionText : tick(last)}</span>
        </div>
      </div>
      <output className="time-year">
        {axis && <span className="time-axis">{axis.label}</span>}
        <span key={year} className="year-roll">
          {tick(year)}
        </span>
        {projectionFrom !== undefined && (!projectionLabel || projected) && (
          <span className={`year-tag${projected ? ' is-projected' : ''}`}>
            {projected ? (projectionLabel?.tag ?? t.projected) : t.estimated}
          </span>
        )}
        {projectionFrom === undefined && estimatesBefore !== undefined && year < estimatesBefore && (
          <span className="year-tag">{t.estimated}</span>
        )}
      </output>
    </div>
  );
}

/**
 * 拉桿背後的走勢（2026-10-30）：淡淡的面積加一條細線，推估的年份更淡；不能點、螢幕閱讀器不唸（只是裝飾，
 * 數字在側欄與排名表）。x 跟拉桿的圓鈕對齊（左右各縮進圓鈕的半徑，styles.css 的 .time-trend）；
 * y 用最小到最大（下面多留 15%）：看的是形狀（哪幾年變化大），從 0 起算的話變化小的指標（母親的平均生育年齡
 * 27–29 歲）整條是一塊平平的長方形
 */
function TrendArea({ years, values, projectionFrom }: { years: number[]; values: (number | null)[]; projectionFrom?: number }) {
  const first = years[0];
  const last = years[years.length - 1];
  const present = values.filter((v): v is number => v != null);
  const hi = Math.max(...present);
  const min = Math.min(...present);
  if (!(hi > min)) return null;
  const lo = min - (hi - min) * 0.15;
  const x = (y: number) => ((y - first) / (last - first)) * 1000;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 96;
  // 連續有值的幾段各畫一塊；推估之前、之後分開（推估的那塊淡一點），在推估的第一年接起來
  const runs: { points: [number, number][]; projected: boolean }[] = [];
  let run: [number, number][] = [];
  let runProjected = false;
  const flush = () => {
    if (run.length > 1) runs.push({ points: run, projected: runProjected });
    run = [];
  };
  values.forEach((v, i) => {
    const year = years[i];
    if (v == null || year === undefined) return flush();
    const projected = projectionFrom !== undefined && year >= projectionFrom;
    if (projected !== runProjected && run.length) {
      const joint = run[run.length - 1];
      flush();
      run = [joint];
    }
    runProjected = projected;
    run.push([x(year), y(v)]);
  });
  flush();
  return (
    <svg className="time-trend" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
      {runs.map(({ points, projected }, i) => {
        const line = points.map(([px, py], j) => `${j ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('');
        const area = `${line}L${points[points.length - 1][0].toFixed(1)},100L${points[0][0].toFixed(1)},100Z`;
        return (
          <g key={i} className={projected ? 'is-projected' : undefined}>
            <path className="time-trend-area" d={area} />
            <path className="time-trend-line" d={line} />
          </g>
        );
      })}
    </svg>
  );
}

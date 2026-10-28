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
  axis?: { label: string; year: (year: number) => string };
  onChange: (year: number) => void;
  /** 開始、停止播放時通知（App 在地圖上疊大大的年份） */
  onPlayingChange?: (playing: boolean) => void;
}

const PLAY_INTERVAL_MS = 120;

export function TimeSlider({ years, year, projectionFrom, projectionLabel, estimatesBefore, axis, onChange, onPlayingChange }: TimeSliderProps) {
  const first = years[0];
  const last = years[years.length - 1];
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
          {year}
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
          <span style={{ left: '0%' }}>{first}</span>
          {projectionFrom !== undefined && projectionFrom < last && (
            <span className="tick-projection" style={{ left: `${projectionPct}%` }}>
              {projectionText}
            </span>
          )}
          {/* 只有最後一年是推估時（例如就業主題的 2025 年），兩個標籤合成一個，免得疊在一起 */}
          <span style={{ left: '100%' }}>{projectionFrom === last ? projectionText : last}</span>
        </div>
      </div>
      <output className="time-year">
        {axis && <span className="time-axis">{axis.label}</span>}
        {year}
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

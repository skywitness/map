import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '../i18n';
import { useHotkeys } from './hotkeys';

interface TimeSliderProps {
  years: number[];
  year: number;
  projectionFrom?: number;
  /** 推估年份換一種稱呼（例如「規劃中」），之前的年份不標「估計值」（指標的 projectionLabel） */
  projectionLabel?: { tag: string; from: (year: number) => string };
  onChange: (year: number) => void;
}

const PLAY_INTERVAL_MS = 120;

export function TimeSlider({ years, year, projectionFrom, projectionLabel, onChange }: TimeSliderProps) {
  const first = years[0];
  const last = years[years.length - 1];
  const [playing, setPlaying] = useState(false);
  const t = useT();
  const yearRef = useRef(year);
  yearRef.current = year;

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

  if (first === last) {
    return (
      <div className="time-slider is-single">
        <span className="time-single-note">{t.singleSnapshot}</span>
        <output className="time-year">{year}</output>
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
          aria-label={t.yearSlider}
          aria-valuetext={t.yearValue(year, projected)}
          onChange={(e) => {
            setPlaying(false);
            onChange(Number(e.target.value));
          }}
          style={{ '--projection-pct': `${projectionPct}%` } as CSSProperties}
        />
        <div className="time-ticks" aria-hidden="true">
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
        {year}
        {projectionFrom !== undefined && (!projectionLabel || projected) && (
          <span className={`year-tag${projected ? ' is-projected' : ''}`}>
            {projected ? (projectionLabel?.tag ?? t.projected) : t.estimated}
          </span>
        )}
      </output>
    </div>
  );
}

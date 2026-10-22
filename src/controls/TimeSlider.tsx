import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '../i18n';
import { useHotkeys } from './hotkeys';

interface TimeSliderProps {
  years: number[];
  year: number;
  projectionFrom?: number;
  onChange: (year: number) => void;
}

const PLAY_INTERVAL_MS = 120;

export function TimeSlider({ years, year, projectionFrom, onChange }: TimeSliderProps) {
  const first = years[0];
  const last = years[years.length - 1];
  const [playing, setPlaying] = useState(false);
  const t = useT();
  const yearRef = useRef(year);
  yearRef.current = year;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const next = yearRef.current + 1;
      if (next > last) {
        setPlaying(false);
        return;
      }
      onChange(next);
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, last, onChange]);

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
          {projectionFrom !== undefined && (
            <span className="tick-projection" style={{ left: `${projectionPct}%` }}>
              {t.projectionFrom(projectionFrom)}
            </span>
          )}
          <span style={{ left: '100%' }}>{last}</span>
        </div>
      </div>
      <output className="time-year">
        {year}
        {projectionFrom !== undefined && (
          <span className={`year-tag${projected ? ' is-projected' : ''}`}>{projected ? t.projected : t.estimated}</span>
        )}
      </output>
    </div>
  );
}

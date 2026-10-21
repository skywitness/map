import { useEffect, useRef, useState, type CSSProperties } from 'react';

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

  const projected = projectionFrom !== undefined && year >= projectionFrom;
  const projectionPct =
    projectionFrom !== undefined ? ((projectionFrom - first) / (last - first)) * 100 : 100;

  return (
    <div className="time-slider">
      <button
        type="button"
        className="play"
        onClick={togglePlay}
        aria-label={playing ? '暫停' : '播放'}
        title={playing ? '暫停' : '播放歷年變化'}
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
          aria-label="年份"
          aria-valuetext={`${year} 年${projected ? '（推估值）' : ''}`}
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
              {projectionFrom} 起為推估
            </span>
          )}
          <span style={{ left: '100%' }}>{last}</span>
        </div>
      </div>
      <output className="time-year">
        {year}
        {projectionFrom !== undefined && (
          <span className={`year-tag${projected ? ' is-projected' : ''}`}>{projected ? '推估值' : '估計值'}</span>
        )}
      </output>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useT } from '../i18n';
import {
  atDate,
  atDayOfYear,
  atMinuteOfDay,
  dateInputValue,
  dayKey,
  dayOfYear,
  daysInYear,
  formatClock,
  formatDay,
  minuteOfDay,
  viewerOffsetText,
} from '../lib/clock';
import { seasonMoments } from '../lib/solar';
import { useHotkeys } from './hotkeys';

/**
 * 時刻主題（TopicDefinition.clock，晝夜與季節）的時間控制，取代年份的時間軸，一樣是一行：
 * [▶] [一天｜一年] [拉桿] [日期與時間（點一下選日期）] [現在]
 * 手機（520px 以下）：一天｜一年換成一顆切換的按鈕、日期寫成 6/21、拉桿的刻度不寫字，375px 寬也是一行。
 *
 * - 拉桿的意思跟著「一天｜一年」：一天是那一天的 0:00–24:00（每格 5 分鐘），一年是 1/1–12/31（時間不變）。
 *   播放也是：一天每格 10 分鐘、一年每格 2 天，每 80 ms 一格（每秒 12.5 次，地圖上的晝夜界線跟著動），到尾端接回開頭，
 *   按暫停才停。使用者要求減少動態效果時每秒一格、一格一小時（一年模式一週），不做連續的掃動，也不自動播放。
 * - 播放時每一格只交給 onPreview（App 放在 state，不寫網址）；停下來才 onChange 寫進網址。
 *   分頁在背景時暫停計時（回到分頁接著播）。
 * - 「現在」：回到現在（網址拿掉 time），之後每分鐘更新（App.tsx）；現在時按鈕是按下的樣子。
 * - 日期與時間是使用者電腦的時區；點日期用瀏覽器的日期選擇器（透明的 <input type="date"> 蓋在上面）。
 */
interface MomentControlProps {
  /** 畫面上的這一刻（播放中是播放到的那一刻） */
  time: number;
  /** 網址沒有 time：跟著現在走 */
  live: boolean;
  /** 使用者選了某一刻（拖拉桿、選日期、方向鍵、播放停下來） */
  onChange: (time: number) => void;
  /** 播放中的每一格（不寫網址） */
  onPreview: (time: number | null) => void;
  /** 回到現在 */
  onLive: () => void;
  onPlayingChange?: (playing: boolean) => void;
  /** 版面選單關掉了時間軸：不顯示，但照樣掛著 */
  hidden?: boolean;
}

type Mode = 'day' | 'year';

const PLAY_INTERVAL_MS = 80;
const REDUCED_INTERVAL_MS = 1000;
/** 播放一格走多少：一天模式幾分鐘、一年模式幾天 */
const STEP = { day: 10, year: 2 };
const REDUCED_STEP = { day: 60, year: 7 };
const SLIDER_STEP_MIN = 5;

/** 一天模式往前走 minutes 分鐘，過了午夜接回同一天的開頭 */
function stepDay(ms: number, minutes: number): number {
  return atMinuteOfDay(ms, (((minuteOfDay(ms) + minutes) % 1440) + 1440) % 1440);
}

/** 一年模式往前走 days 天，過了年底接回同一年的開頭 */
function stepYear(ms: number, days: number): number {
  const n = daysInYear(new Date(ms).getFullYear());
  return atDayOfYear(ms, ((((dayOfYear(ms) - 1 + days) % n) + n) % n) + 1);
}

export function MomentControl({ time, live, onChange, onPreview, onLive, onPlayingChange, hidden }: MomentControlProps) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('day');
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef(time);
  timeRef.current = time;

  useEffect(() => onPlayingChange?.(playing), [playing, onPlayingChange]);

  // 播放：每一格只交給 onPreview；分頁在背景時不計時
  useEffect(() => {
    if (!playing) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = reduced ? REDUCED_STEP : STEP;
    let cursor = timeRef.current;
    let timer: number | undefined;
    const tick = () => {
      cursor = mode === 'day' ? stepDay(cursor, step.day) : stepYear(cursor, step.year);
      onPreview(cursor);
    };
    const start = () => {
      if (timer === undefined) timer = window.setInterval(tick, reduced ? REDUCED_INTERVAL_MS : PLAY_INTERVAL_MS);
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [playing, mode, onPreview]);

  /** 停下來：播放到的那一刻寫進網址 */
  const stop = () => {
    if (!playing) return;
    setPlaying(false);
    onPreview(null);
    onChange(timeRef.current);
  };
  const togglePlay = () => (playing ? stop() : setPlaying(true));
  const choose = (ms: number) => {
    if (playing) {
      setPlaying(false);
      onPreview(null);
    }
    onChange(ms);
  };
  const stepBy = (sign: 1 | -1) => choose(mode === 'day' ? stepDay(timeRef.current, sign * 60) : stepYear(timeRef.current, sign));

  useHotkeys({ ArrowLeft: () => stepBy(-1), ArrowRight: () => stepBy(1), ' ': togglePlay });

  const year = new Date(time).getFullYear();
  const total = daysInYear(year);
  // 一年模式的刻度：春分、夏至、秋分、冬至（使用者時區的那一天）
  const seasons = useMemo(() => {
    const s = seasonMoments(year);
    return [s.march, s.june, s.september, s.december].map((ms) => dayOfYear(ms));
  }, [year]);
  const seasonNames = [t.marchEquinox, t.juneSolstice, t.septemberEquinox, t.decemberSolstice];

  const sliderValue = mode === 'day' ? minuteOfDay(time) : dayOfYear(time);
  const pct = (v: number, min: number, max: number) => `${((v - min) / (max - min)) * 100}%`;
  const day = formatDay(dayKey(time));
  // 手機上的短日期「6/21」（不是今年時加年份）
  const d = new Date(time);
  const shortDay = `${d.getFullYear() === new Date().getFullYear() ? '' : `${d.getFullYear()}/`}${d.getMonth() + 1}/${d.getDate()}`;
  const clock = formatClock(time);

  return (
    <div className="time-slider moment-control" hidden={hidden}>
      <button
        type="button"
        className="play"
        onClick={togglePlay}
        aria-label={playing ? t.pause : mode === 'day' ? t.playDay : t.playYear}
        title={playing ? t.pause : mode === 'day' ? t.playDay : t.playYear}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="moment-mode" role="radiogroup" aria-label={t.momentMode}>
        {(['day', 'year'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={`segment${mode === m ? ' is-active' : ''}`}
            onClick={() => setMode(m)}
            title={m === 'day' ? t.modeDayTitle : t.modeYearTitle}
          >
            {m === 'day' ? t.modeDay : t.modeYear}
          </button>
        ))}
      </div>
      {/* 手機上換成一顆切換的按鈕（styles.css 依寬度顯示其中一種），拉桿才放得下 */}
      <button
        type="button"
        className="moment-mode-chip"
        onClick={() => setMode((m) => (m === 'day' ? 'year' : 'day'))}
        aria-label={`${t.momentMode}: ${mode === 'day' ? t.modeDay : t.modeYear}`}
        title={mode === 'day' ? t.modeDayTitle : t.modeYearTitle}
      >
        {mode === 'day' ? t.modeDay : t.modeYear}
        <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
          <path d="M2 3.5h6M6 1.5l2 2-2 2M8 6.5H2M4 4.5l-2 2 2 2" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </button>
      <div className="time-track">
        <input
          type="range"
          min={mode === 'day' ? 0 : 1}
          max={mode === 'day' ? 1440 - SLIDER_STEP_MIN : total}
          step={mode === 'day' ? SLIDER_STEP_MIN : 1}
          value={mode === 'day' ? Math.floor(sliderValue / SLIDER_STEP_MIN) * SLIDER_STEP_MIN : sliderValue}
          aria-label={mode === 'day' ? t.timeOfDay : t.dayOfYear}
          aria-valuetext={mode === 'day' ? clock : day}
          onChange={(e) => {
            const v = Number(e.target.value);
            choose(mode === 'day' ? atMinuteOfDay(timeRef.current, v) : atDayOfYear(timeRef.current, v));
          }}
          style={{ '--projection-pct': '100%' } as CSSProperties}
        />
        <div className="time-ticks moment-ticks" aria-hidden="true">
          {mode === 'day'
            ? [0, 6, 12, 18, 24].map((h) => (
                <span key={h} style={{ left: pct(h * 60, 0, 1440 - SLIDER_STEP_MIN) }}>
                  {t.hourTick(h)}
                </span>
              ))
            : seasons.map((d, i) => (
                <span key={d} className="moment-season" style={{ left: pct(d, 1, total) }}>
                  {seasonNames[i]}
                </span>
              ))}
        </div>
      </div>
      <label className="moment-when" title={t.pickDate}>
        <span className="moment-day">{day}</span>
        <span className="moment-day-short">{shortDay}</span>
        <span className="moment-clock">{clock}</span>
        <span className="moment-zone">{viewerOffsetText(time)}</span>
        <input
          type="date"
          className="moment-date"
          aria-label={t.pickDate}
          min="1900-01-01"
          max="2100-12-31"
          value={dateInputValue(time)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.();
            } catch {
              // 不支援或不在使用者操作裡：照瀏覽器原本的行為
            }
          }}
          onChange={(e) => {
            const next = atDate(timeRef.current, e.target.value);
            if (next !== null) choose(next);
          }}
        />
      </label>
      <button
        type="button"
        className={`moment-now${live && !playing ? ' is-active' : ''}`}
        aria-pressed={live && !playing}
        onClick={() => {
          if (playing) {
            setPlaying(false);
            onPreview(null);
          }
          onLive();
        }}
        title={t.nowTitle}
      >
        {t.now}
      </button>
    </div>
  );
}

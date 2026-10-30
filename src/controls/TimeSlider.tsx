import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '../i18n';
import { useHotkeys } from './hotkeys';
import { useDismiss } from './useDismiss';

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
  /** 版面選單關掉了時間軸：不顯示，但照樣掛著（← → 換年份、空白鍵播放照樣能用） */
  hidden?: boolean;
}

/** 1× 時每一年停多久；0.5× 是兩倍、2× 是一半 */
const PLAY_INTERVAL_MS = 120;
const SPEEDS = [0.5, 1, 2] as const;
type Speed = (typeof SPEEDS)[number];
/** 速度與循環記在這台裝置（每個主題都一樣）；播放的年份範圍只在目前的指標有效 */
const PLAYBACK_KEY = 'playback';

function readPlayback(): { speed: Speed; loop: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYBACK_KEY) ?? '{}') as { speed?: number; loop?: boolean };
    return { speed: SPEEDS.find((s) => s === saved.speed) ?? 1, loop: saved.loop === true };
  } catch {
    return { speed: 1, loop: false };
  }
}

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
  hidden,
}: TimeSliderProps) {
  const first = years[0];
  const last = years[years.length - 1];
  /** 刻度與目前的值：有 axis.tick 時照它寫（各國在讀什麼的月份），沒有是數字本身 */
  const tick = (y: number) => (axis?.tick ? axis.tick(y) : y);
  const [playing, setPlaying] = useState(false);
  const t = useT();
  const yearRef = useRef(year);
  yearRef.current = year;
  // 播放設定（2026-10-30）：速度、循環、只播一段年份
  const [playback, setPlayback] = useState(readPlayback);
  const changePlayback = (patch: Partial<{ speed: Speed; loop: boolean }>) => {
    const next = { ...playback, ...patch };
    setPlayback(next);
    try {
      localStorage.setItem(PLAYBACK_KEY, JSON.stringify(next));
    } catch {
      // 無痕模式等存不了：這次照樣用
    }
  };
  const [range, setRange] = useState<[number, number] | null>(null);
  // 換指標（年份不同）時範圍回到全部
  useEffect(() => setRange(null), [first, last]);
  const from = range && years.includes(range[0]) ? range[0] : first;
  const to = range && years.includes(range[1]) && range[1] > from ? range[1] : last;

  useEffect(() => onPlayingChange?.(playing), [playing, onPlayingChange]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      // 年份不一定連續（例如移民存量每 5 年一筆），播放時跳到資料裡的下一個年份；到了範圍的最後一年停下或從頭再播
      const next = years.find((y) => y > yearRef.current && y <= to);
      if (next !== undefined) onChange(next);
      else if (playback.loop) onChange(from);
      else setPlaying(false);
    }, PLAY_INTERVAL_MS / playback.speed);
    return () => window.clearInterval(timer);
  }, [playing, years, onChange, from, to, playback]);

  const togglePlay = () => {
    if (!playing && (year < from || year >= to)) onChange(from);
    setPlaying((p) => !p);
  };

  /**
   * 鍵盤 ←/→：跳到資料裡的上一個／下一個年份（年份不一定連續）。目前的年份不在資料裡時（拖到兩屆奧運之間、
   * 網址寫的年份）跳到它後面／前面最近的一個，不會卡住（2026-10-30 修：從 1964 按右鍵原本停在 1965）
   */
  const stepYear = (delta: number) => {
    setPlaying(false);
    const current = yearRef.current;
    const next = delta > 0 ? years.find((y) => y > current) : [...years].reverse().find((y) => y < current);
    if (next !== undefined && next !== current) onChange(next);
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
      <div className="time-slider is-single" hidden={hidden}>
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
    <div className="time-slider" hidden={hidden}>
      <button
        type="button"
        className="play"
        onClick={togglePlay}
        aria-label={playing ? t.pause : t.play}
        title={playing ? t.pause : t.playTitle}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <PlaybackMenu
        years={years}
        tick={tick}
        speed={playback.speed}
        loop={playback.loop}
        from={from}
        to={to}
        onSpeed={(speed) => changePlayback({ speed })}
        onLoop={(loop) => changePlayback({ loop })}
        onRange={(f, l) => setRange(f === first && l === last ? null : [f, l])}
      />
      <div className="time-track">
        {trend && <TrendArea years={years} values={trend} projectionFrom={projectionFrom} />}
        {(from !== first || to !== last) && (
          // 只播一段年份時在軌道上標出那一段（左右縮進圓鈕的半徑，跟走勢一樣）
          <span
            className="time-range"
            aria-hidden="true"
            style={{ '--from': (from - first) / (last - first), '--to': (to - first) / (last - first) } as CSSProperties}
          />
        )}
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
          // 拉桿有焦點時方向鍵原本由瀏覽器一次加減 1 年（會停在沒有資料的年份），改成跳到資料裡的上一個／下一個年份
          onKeyDown={(e) => {
            const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
            if (!delta || years.length < 2) return;
            e.preventDefault();
            e.stopPropagation();
            stepYear(delta);
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

/**
 * 播放設定（2026-10-30）：速度 0.5×／1×／2×、循環播放、只播一段年份。按鈕上寫目前的速度；
 * Esc 或點外面關閉
 */
function PlaybackMenu({
  years,
  tick,
  speed,
  loop,
  from,
  to,
  onSpeed,
  onLoop,
  onRange,
}: {
  years: number[];
  tick: (year: number) => string | number;
  speed: Speed;
  loop: boolean;
  from: number;
  to: number;
  onSpeed: (speed: Speed) => void;
  onLoop: (loop: boolean) => void;
  onRange: (from: number, to: number) => void;
}) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), [buttonRef, popoverRef], buttonRef);
  const ranged = from !== years[0] || to !== years[years.length - 1];
  return (
    <div className="playback">
      <button
        ref={buttonRef}
        type="button"
        className={`playback-button${speed !== 1 || loop || ranged ? ' is-set' : ''}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={t.playSettings}
        title={t.playSettings}
        onClick={() => setOpen((o) => !o)}
      >
        {speed}×{loop && <span aria-hidden="true"> ↻</span>}
      </button>
      {open && (
        <div ref={popoverRef} id={id} className="playback-popover" role="dialog" aria-label={t.playSettings}>
          <div className="playback-row">
            <span className="playback-label">{t.playSpeed}</span>
            <div className="playback-speeds" role="radiogroup" aria-label={t.playSpeed}>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={s === speed}
                  className={`segment${s === speed ? ' is-active' : ''}`}
                  onClick={() => onSpeed(s)}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
          <label className="playback-row playback-check">
            <input type="checkbox" checked={loop} onChange={(e) => onLoop(e.target.checked)} />
            {t.playLoop}
          </label>
          <div className="playback-row">
            <span className="playback-label">{t.playRange}</span>
            <span className="playback-range">
              <select aria-label={t.playRangeFrom} value={from} onChange={(e) => onRange(Number(e.target.value), to)}>
                {years
                  .filter((y) => y < to)
                  .map((y) => (
                    <option key={y} value={y}>
                      {tick(y)}
                    </option>
                  ))}
              </select>
              –
              <select aria-label={t.playRangeTo} value={to} onChange={(e) => onRange(from, Number(e.target.value))}>
                {years
                  .filter((y) => y > from)
                  .map((y) => (
                    <option key={y} value={y}>
                      {tick(y)}
                    </option>
                  ))}
              </select>
            </span>
          </div>
          {ranged && (
            <button type="button" className="playback-reset" onClick={() => onRange(years[0], years[years.length - 1])}>
              {t.playRangeAll}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

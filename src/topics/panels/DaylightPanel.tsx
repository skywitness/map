import { useMemo } from 'react';
import { EChart, escapeHtml, type ChartOption } from '../../charts/EChart';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { dayKey, dayParts, daysInYear, formatDay, monthDayOfYear } from '../../lib/clock';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { clockDate, offsetText, seasonMoments, sunDay, type SunDay } from '../../lib/solar';
import { Skeleton } from '../../panels/Skeleton';
import type { Tokens } from '../../theme/tokens';
import {
  capitalOf,
  duration,
  offsetAt,
  placeName,
  polarPlaceOf,
  riseSetText,
  sunOn,
  type CapitalsFile,
  type Place,
} from '../daylight';
import { CAPITAL_ROLES } from '../profiles';
import type { PanelExtraProps } from '../types';

const TEXT = defineMessages({
  zh: {
    forCapital: (name: string) => `以首都${name}計算`,
    forTown: (name: string) => `以${name}計算`,
    where: (lat: string, lon: string, zone: string, offset: string) => `${lat}、${lon}・時區 ${zone}（標準時間 ${offset}）`,
    north: (v: string) => `北緯 ${v}°`,
    south: (v: string) => `南緯 ${v}°`,
    east: (v: string) => `東經 ${v}°`,
    west: (v: string) => `西經 ${v}°`,
    others: (list: string) => `另有${list}；國家的數值都以這裡計算。`,
    otherItem: (name: string, role: string) => (role ? `${role}${name}` : name),
    listSep: '、',
    today: (day: string) => `${day}`,
    todayDetail: (length: string, noon: string) => `白天 ${length}・正午太陽高度 ${noon}`,
    yearTitle: (year: number) => `${year} 年的白天長度`,
    chartAria: (name: string, year: number) => `${name} ${year} 年每一天的白天長度`,
    hours: (h: number) => `${h} 小時`,
    seasonsTitle: '春分、夏至、秋分、冬至',
    seasonsNote: '日期是當地的日期；白天長度用那一天算。',
    march: '春分',
    june: '夏至',
    september: '秋分',
    december: '冬至',
    longest: '一年中白天最長',
    shortest: '一年中白天最短',
    polarTitle: '極晝與極夜',
    polarInside: (name: string, lat: string) => `國土有一部分在極圈內，以${name}（${lat}）為例：`,
    polarCapital: '首都在極圈內：',
    midnightSun: (from: string, to: string, days: number) => `極晝（太陽整天不落）${from}–${to}，${days} 天`,
    polarNight: (from: string, to: string, days: number) => `極夜（太陽整天不升）${from}–${to}，${days} 天`,
    noPolar: '這一年沒有極晝或極夜。',
  },
  en: {
    forCapital: (name) => `For the capital, ${name}`,
    forTown: (name) => `For ${name}`,
    where: (lat, lon, zone, offset) => `${lat}, ${lon} · time zone ${zone} (standard time ${offset})`,
    north: (v) => `${v}°N`,
    south: (v) => `${v}°S`,
    east: (v) => `${v}°E`,
    west: (v) => `${v}°W`,
    others: (list) => `Other capitals: ${list}. Country values use this one.`,
    otherItem: (name, role) => (role ? `${name} (${role})` : name),
    listSep: ', ',
    today: (day) => day,
    todayDetail: (length, noon) => `Day ${length} · noon sun ${noon}`,
    yearTitle: (year) => `Day length through ${year}`,
    chartAria: (name, year) => `Day length in ${name} on each day of ${year}`,
    hours: (h) => `${h} h`,
    seasonsTitle: 'Equinoxes and solstices',
    seasonsNote: 'Dates are local; day length is for that day.',
    march: 'March equinox',
    june: 'June solstice',
    september: 'September equinox',
    december: 'December solstice',
    longest: 'longest day of the year',
    shortest: 'shortest day of the year',
    polarTitle: 'Midnight sun and polar night',
    polarInside: (name, lat) => `Part of the country lies inside a polar circle; for example ${name} (${lat}):`,
    polarCapital: 'The capital lies inside a polar circle:',
    midnightSun: (from, to, days) => `Midnight sun ${from} – ${to}, ${days} days`,
    polarNight: (from, to, days) => `Polar night ${from} – ${to}, ${days} days`,
    noPolar: 'No midnight sun or polar night this year.',
  },
});

/** 一年裡第 i 天（0 起算）的 YYYYMMDD */
function keyOfDay(year: number, index: number): number {
  const d = new Date(Date.UTC(year, 0, 1 + index));
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/** 一個地點一整年每一天的太陽 */
function yearOf(p: Place, year: number): SunDay[] {
  return Array.from({ length: daysInYear(year) }, (_, i) => sunOn(p, keyOfDay(year, i)));
}

/** 極晝、極夜的期間：從這一年開始的連續幾天（跨年的接到隔年） */
function polarRuns(p: Place, year: number): { kind: 'day' | 'night'; from: number; to: number; days: number }[] {
  const n = daysInYear(year);
  // 看兩年，跨年的極夜（11 月底到隔年 1 月）才接得起來；只留在這一年開始的（1 月 1 日就在極夜裡的算前一年的）
  const days = [...yearOf(p, year), ...yearOf(p, year + 1)];
  const keys = [...Array.from({ length: n }, (_, i) => keyOfDay(year, i)), ...Array.from({ length: daysInYear(year + 1) }, (_, i) => keyOfDay(year + 1, i))];
  const runs: { kind: 'day' | 'night'; from: number; to: number; days: number }[] = [];
  let i = 0;
  while (i < n) {
    const kind = days[i].polar;
    if (!kind || (i === 0 && sunDay(p.lat, p.lon, year - 1, 12, 31, p.std).polar === kind)) {
      // 1 月 1 日接著前一年的極夜：跳過這一段
      if (kind) while (i < n && days[i].polar === kind) i++;
      else i++;
      continue;
    }
    let j = i;
    while (j + 1 < days.length && days[j + 1].polar === kind) j++;
    runs.push({ kind, from: keys[i], to: keys[j], days: j - i + 1 });
    i = j + 1;
  }
  return runs;
}

function latText(text: (typeof TEXT)['zh'], lat: number, lon: number): [string, string] {
  const a = fixed(Math.abs(lat), 2);
  const b = fixed(Math.abs(lon), 2);
  return [lat >= 0 ? text.north(a) : text.south(a), lon >= 0 ? text.east(b) : text.west(b)];
}

function chartOption(p: Place, year: number, days: SunDay[], selected: number, tokens: Tokens, text: (typeof TEXT)['zh']): ChartOption {
  const hours = days.map((d) => Math.round((d.dayLength / 60) * 100) / 100);
  const categories = days.map((_, i) => String(i + 1));
  // 每個月 1 日的位置寫月份
  const monthStarts = new Set(Array.from({ length: 12 }, (_, m) => Math.round((Date.UTC(year, m, 1) - Date.UTC(year, 0, 1)) / 86_400_000)));
  const monthLabel = (i: number) => {
    const m = new Date(Date.UTC(year, 0, 1 + i)).getUTCMonth();
    return tr({ zh: `${m + 1}月`, en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m] });
  };
  const selectedIndex = Math.max(0, Math.min(days.length - 1, selected));
  return {
    animation: false,
    grid: { left: 4, right: 12, top: 18, bottom: 4, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: tokens.axis, width: 1 } },
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      textStyle: { color: tokens.ink, fontSize: 12 },
      extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.12); border-radius: 6px;',
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const i = (list[0] as { dataIndex?: number }).dataIndex ?? 0;
        const d = days[i];
        return (
          `<div class="tt-head">${escapeHtml(monthDayOfYear(year, i + 1))}</div>` +
          `<div class="tt-row"><span class="tt-key" style="background:${tokens.accent}"></span><strong>${escapeHtml(duration(d.dayLength))}</strong></div>` +
          `<div class="tt-row"><span class="tt-name">${escapeHtml(riseSetText(p, d))}</span></div>`
        );
      },
    },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: false,
      axisLine: { lineStyle: { color: tokens.axis } },
      axisTick: { show: false },
      axisLabel: {
        color: tokens.inkMuted,
        fontSize: 11,
        interval: (index: number) => monthStarts.has(index) && new Date(Date.UTC(year, 0, 1 + index)).getUTCMonth() % 2 === 0,
        formatter: (_value: string, index: number) => monthLabel(index),
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 24,
      interval: 6,
      splitLine: { lineStyle: { color: tokens.grid, width: 1 } },
      axisLabel: { color: tokens.inkMuted, fontSize: 11, formatter: (v: number) => text.hours(v) },
    },
    series: [
      {
        type: 'line',
        data: hours,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 7,
        color: tokens.accent,
        lineStyle: { width: 2, color: tokens.accent },
        areaStyle: { color: tokens.accent, opacity: 0.1 },
        emphasis: { disabled: true },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: tokens.inkMuted, type: 'solid', width: 1 },
          data: [
            // 選定的那一天
            {
              xAxis: String(selectedIndex + 1),
              label: {
                show: true,
                position: 'end',
                formatter: monthDayOfYear(year, selectedIndex + 1),
                color: tokens.inkSecondary,
                fontSize: 11,
              },
              lineStyle: { color: tokens.ink, width: 1.5 },
            },
            // 12 小時（春分、秋分時全世界都接近這個長度）
            { yAxis: 12, label: { show: false }, lineStyle: { color: tokens.inkMuted, type: [4, 3], width: 1 } },
          ],
        },
      },
    ],
  };
}

export default function DaylightPanel({ topic, iso3, at, tokens, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, loading } = useJson<CapitalsFile>(`topics/${topic.id}/capitals.json`);
  const place = data ? capitalOf(data, iso3) : null;
  const polar = data ? polarPlaceOf(data, iso3) : null;
  const day = at?.day ?? dayKey(Date.now());
  const [year] = dayParts(day);

  const days = useMemo(() => (place ? yearOf(place, year) : null), [place?.lat, place?.lon, place?.std, year]);
  const option = useMemo(
    () => (place && days ? chartOption(place, year, days, dayIndex(day), tokens, text) : null),
    // place 的經緯度、days 變了才重算；text 跟著 lang
    [days, day, tokens, lang],
  );
  const seasons = useMemo(() => {
    if (!place) return null;
    const s = seasonMoments(year);
    const list = [
      { name: text.march, ms: s.march },
      { name: text.june, ms: s.june },
      { name: text.september, ms: s.september },
      { name: text.december, ms: s.december },
    ];
    return list.map(({ name, ms }) => {
      const [y, m, d] = clockDate(ms, offsetAt(place, ms));
      const key = y * 10000 + m * 100 + d;
      return { name, key, sun: sunOn(place, key) };
    });
  }, [place?.lat, place?.lon, place?.std, place?.zone, year, lang]);
  const runs = useMemo(() => {
    const p = polar ?? (place && days?.some((d) => d.polar) ? place : null);
    return p ? { place: p, runs: polarRuns(p, year), isCapital: p === place } : null;
  }, [polar?.lat, place?.lat, days, year]);

  if (loading) {
    return (
      <section className="panel-section" aria-busy="true">
        <span className="visually-hidden">{t.loading}</span>
        <Skeleton width="45%" height={15} />
        <Skeleton height={200} style={{ marginTop: 8 }} />
      </section>
    );
  }
  if (!place || !days || !seasons) return null;

  const name = placeName(place);
  const [lat, lon] = latText(text, place.lat, place.lon);
  const today = sunOn(place, day);
  const others = data?.others[iso3] ?? [];
  const longest = Math.max(...seasons.map((s) => s.sun.dayLength));
  const shortest = Math.min(...seasons.map((s) => s.sun.dayLength));
  const runText = (r: { kind: 'day' | 'night'; from: number; to: number; days: number }) => {
    // 跨年的寫出隔年的年份（formatDay 不是今年時會加年份；選的是今年以外的年份時兩頭都有年份）
    const from = formatDay(r.from);
    const to = formatDay(r.to);
    return r.kind === 'day' ? text.midnightSun(from, to, r.days) : text.polarNight(from, to, r.days);
  };

  return (
    <section className="panel-section daylight-panel">
      <h3>{place.capital ? text.forCapital(name) : text.forTown(name)}</h3>
      <p className="note">{text.where(lat, lon, place.zone, offsetText(place.std))}</p>
      {others.length > 0 && (
        <p className="note">
          {text.others(
            others.map(([zh, en, role]) => text.otherItem(lang === 'en' ? en : zh, role && CAPITAL_ROLES[role] ? tr(CAPITAL_ROLES[role], lang) : '')).join(text.listSep),
          )}
        </p>
      )}

      <dl className="daylight-today">
        <dt>{formatDay(day)}</dt>
        <dd>{riseSetText(place, today)}</dd>
        <dd>{text.todayDetail(duration(today.dayLength), `${fixed(today.noonElevation, 1)}°`)}</dd>
      </dl>

      <h3>{text.yearTitle(year)}</h3>
      {option && <EChart option={option} height={200} ariaLabel={text.chartAria(countryName, year)} />}

      <h3>{text.seasonsTitle}</h3>
      <ul className="daylight-seasons">
        {seasons.map((s) => (
          <li key={s.name}>
            <span className="daylight-season-name">{s.name}</span>
            <span className="daylight-season-day">{formatDay(s.key)}</span>
            <strong>{duration(s.sun.dayLength)}</strong>
            {(s.sun.dayLength === longest || s.sun.dayLength === shortest) && longest !== shortest && (
              <span className="stat-meta">{s.sun.dayLength === longest ? text.longest : text.shortest}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="note">{text.seasonsNote}</p>

      {runs && (
        <>
          <h3>{text.polarTitle}</h3>
          <p className="note">
            {runs.isCapital ? text.polarCapital : text.polarInside(placeName(runs.place), latText(text, runs.place.lat, runs.place.lon)[0])}
          </p>
          {runs.runs.length > 0 ? (
            <ul className="daylight-polar">
              {runs.runs.map((r) => (
                <li key={`${r.kind}${r.from}`}>{runText(r)}</li>
              ))}
            </ul>
          ) : (
            <p className="note">{text.noPolar}</p>
          )}
        </>
      )}
    </section>
  );
}

/** YYYYMMDD 是那一年的第幾天（0 起算） */
function dayIndex(day: number): number {
  const [y, m, d] = dayParts(day);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000);
}

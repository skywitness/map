import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, type Text } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

/** 兩條線：與美國、與中國的一致度（pipeline/topics/un_votes.py 的 agree/USA.json、agree/CHN.json） */
const LINES: { id: 'USA' | 'CHN'; name: Text; label: Text; hue: Hue }[] = [
  { id: 'USA', name: { zh: '美國', en: 'the US' }, label: { zh: '與美國', en: 'With the US' }, hue: 'blue' },
  { id: 'CHN', name: { zh: '中國', en: 'China' }, label: { zh: '與中國', en: 'With China' }, hue: 'orange' },
];

const TEXT = defineMessages({
  zh: {
    title: (names: string[]) => `與${names.join('、')}的投票一致度`,
    self: (name: string) => `${name}本身是比較對象。`,
    none: (name: string) => `沒有跟${name}都參加的表決。`,
    ideal: (year: number, value: string, low: string, high: string, votes: number | null) =>
      `${year} 年的理想點 ${value}（90% 可信區間 ${low} 到 ${high}）` +
      (votes != null ? `，根據參加的 ${votes} 次表決估計。` : '。'),
    chartAria: (country: string, names: string[]) => `${country}歷年與${names.join('、')}的投票一致度`,
  },
  en: {
    title: (names) => `Voting agreement with ${names.join(' and ')}`,
    self: (name) => `${name.charAt(0).toUpperCase()}${name.slice(1)} is the country compared with.`,
    none: (name) => `No votes in which both this country and ${name} took part.`,
    ideal: (year, value, low, high, votes) =>
      `Ideal point in ${year}: ${value} (90% credible interval ${low} to ${high})` +
      (votes != null ? `, estimated from the ${votes} votes it took part in.` : '.'),
    chartAria: (country, names) => `Voting agreement of ${country} with ${names.join(' and ')} over time`,
  },
});

export default function UnVotesPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const files = useMemo(
    () => [
      ...LINES.map((l) => `topics/${topic.id}/agree/${l.id}.json`),
      `topics/${topic.id}/ideal-point.json`,
      `topics/${topic.id}/intervals/ideal-point-low.json`,
      `topics/${topic.id}/intervals/ideal-point-high.json`,
      `topics/${topic.id}/votes.json`,
    ],
    [topic.id],
  );
  const loaded = useJsonMany<IndicatorData>(files);

  const view = useMemo(() => {
    const [usa, chn, ideal, low, high, votes] = loaded;
    if (!usa || !chn || !ideal) return null;

    // 兩條線對齊到「與美國」的年份（1946 起）；「與中國」從 1971 年開始，之前是 null
    const years = usa.years;
    const aligned = (data: IndicatorData) => {
      const own = data.values[iso3];
      if (!own) return null;
      const index = new Map(data.years.map((y, i) => [y, i]));
      const values = years.map((y) => (index.has(y) ? own[index.get(y)!] : null));
      return values.some((v) => v != null) ? values : null;
    };
    const series = [aligned(usa), aligned(chn)];
    const shown = LINES.flatMap((l, i) => (series[i] ? [{ line: l, values: series[i]! }] : []));
    const missing = LINES.filter((_l, i) => !series[i]).map((l) =>
      l.id === iso3 ? text.self(tr(l.name, lang)) : text.none(tr(l.name, lang)),
    );

    let option: ChartSpec | null = null;
    if (shown.length) {
      const indicator = topic.indicators.find((i) => i.id === 'agree-usa')!;
      // x 軸只畫這個國家有投票紀錄的年份（台灣只有 1946–1971，不必留一大段空白）
      const has = (i: number) => shown.some((s) => s.values[i] != null);
      const first = years.findIndex((_y, i) => has(i));
      let last = years.length - 1;
      while (last > first && !has(last)) last--;
      const base = timeSeriesOption({
        years: years.slice(first, last + 1),
        lines: shown.map(({ line, values }) => ({
          name: tr(line.label, lang),
          values: values.slice(first, last + 1),
          color: tokens.hues[line.hue],
        })),
        year,
        indicator,
        tokens,
      });
      // 時間軸的年份不在 x 軸上（台灣選 2024 年、理想點的 2025 年）時 timeSeriesOption 不畫垂直參考線。
      // 固定 0–100%，各國的圖才能互相比較
      option = { ...base, y: { ...base.y, min: 0, max: 100 } };
    }

    // 理想點與 90% 可信區間：時間軸那一年，沒有的話用之前最近一年（例如台灣是 1971 年）
    let idealText: string | null = null;
    const own = ideal.values[iso3];
    if (own) {
      const at = latestIndexAtOrBefore(ideal.years, year, (i) => own[i] != null);
      const lo = low?.values[iso3]?.[at];
      const hi = high?.values[iso3]?.[at];
      if (at >= 0 && lo != null && hi != null) {
        const format = topic.indicators.find((i) => i.id === 'ideal-point')!.format;
        idealText = text.ideal(ideal.years[at], format(own[at]!), format(lo), format(hi), votes?.values[iso3]?.[at] ?? null);
      }
    }
    // 從來沒有投票紀錄的地方（觀察員、屬地）：數值卡片已經寫了主題的 noValue，這裡不重複
    if (!shown.length && !idealText) return null;
    const names = (shown.length ? shown.map((s) => s.line) : LINES).map((l) => tr(l.name, lang));
    return { option, names, missing, idealText };
  }, [loaded, iso3, year, topic, tokens, lang, text]);

  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title(view.names)}</h3>
      {view.option && <Chart spec={view.option} height={200} ariaLabel={text.chartAria(countryName, view.names)} />}
      {view.missing.length > 0 && <p className="note">{view.missing.join(lang === 'en' ? ' ' : '')}</p>}
      {view.idealText && <p className="note">{view.idealText}</p>}
    </section>
  );
}

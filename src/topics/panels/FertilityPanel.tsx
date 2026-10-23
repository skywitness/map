import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber, formatLargeTick } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 生育率與高齡化主題的側欄：人口金字塔（WPP 五歲年齡組，男左女右）。
 * 資料是 pipeline/topics/fertility.py 的 countries/<ISO3>.json，1950–2100 每年一筆，
 * values 的鍵是性別加年齡組的起始歲數（m0、f65、m100…），fetchJson() 已經把差分編碼還原。
 * 長條的比例尺用這個國家 1950–2100 年最大的一組，拖動時間軸時看得出人口變多或變少。
 */
interface PyramidFile {
  years: number[];
  projectionFrom?: number;
  /** 各年齡組的起始歲數：0、5 … 95、100（100 歲以上） */
  ages: number[];
  values: Record<string, (number | null)[]>;
}

const percent = (v: number) => fixed(v, 1);

const TEXT = defineMessages({
  zh: {
    title: (year: number) => `人口金字塔（${year} 年）`,
    men: '男性',
    women: '女性',
    age: (start: number, last: boolean) => (last ? `${start}+` : `${start}–${start + 4}`),
    summary: (young: number, working: number, old: number, support: number | null) =>
      `0–14 歲 ${percent(young)}%、15–64 歲 ${percent(working)}%、65 歲以上 ${percent(old)}%` +
      (support === null ? '。' : `；每 ${fixed(support, 1)} 位青壯年（15–64 歲）對 1 位老人。`),
    bar: (sex: string, age: string, value: number) => `${sex} ${age} 歲：${formatLargeNumber(value)} 人`,
    scale: '長條的長度以 1950–2100 年最大的一組為準，拖動時間軸可以看出人口變多或變少。',
    chartAria: (country: string, year: number, summary: string) =>
      `${country} ${year} 年的人口金字塔，男性在左、女性在右。${summary}`,
    noCountry: '沒有這個國家的年齡別人口。',
  },
  en: {
    title: (year) => `Population pyramid (${year})`,
    men: 'Men',
    women: 'Women',
    age: (start, last) => (last ? `${start}+` : `${start}–${start + 4}`),
    summary: (young, working, old, support) =>
      `Aged 0–14: ${percent(young)}%, 15–64: ${percent(working)}%, 65+: ${percent(old)}%` +
      (support === null ? '.' : `; ${fixed(support, 1)} people of working age (15–64) for every person aged 65+.`),
    bar: (sex, age, value) => `${sex} aged ${age}: ${formatLargeNumber(value)}`,
    scale: 'Bar lengths are scaled to the largest group in 1950–2100, so moving the time slider shows the population growing or shrinking.',
    chartAria: (country, year, summary) =>
      `Population pyramid of ${country} in ${year}, men on the left and women on the right. ${summary}`,
    noCountry: 'No population by age for this country.',
  },
});

/** 比例尺的上限：取 1、1.5、2、2.5、3、4、5、6、8 × 10ⁿ 裡第一個不小於最大值的 */
function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(max));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * exp >= max) ?? 10;
  return step * exp;
}

const ROW = 10; // 每一組長條的高度（px）
const GAP = 2;

export default function FertilityPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<PyramidFile>(`topics/${topic.id}/countries/${iso3}.json`);

  // 整個國家所有年份最大的一組，當成固定的比例尺
  const scaleMax = useMemo(() => {
    if (!data) return 1;
    let max = 0;
    for (const series of Object.values(data.values)) for (const v of series) if (v !== null && v > max) max = v;
    return niceCeil(max);
  }, [data]);

  const view = useMemo(() => {
    if (!data) return null;
    let index = data.years.indexOf(year);
    if (index < 0) index = year < data.years[0] ? 0 : data.years.length - 1;
    const shownYear = data.years[index];
    const rows = data.ages.map((start, k) => ({
      start,
      label: text.age(start, k === data.ages.length - 1),
      men: data.values[`m${start}`]?.[index] ?? 0,
      women: data.values[`f${start}`]?.[index] ?? 0,
    }));
    const sum = (from: number, to: number) =>
      rows.filter((r) => r.start >= from && r.start < to).reduce((s, r) => s + r.men + r.women, 0);
    const total = sum(0, Infinity);
    if (total <= 0) return null;
    const young = sum(0, 15);
    const working = sum(15, 65);
    const old = sum(65, Infinity);
    return {
      shownYear,
      projected: data.projectionFrom !== undefined && shownYear >= data.projectionFrom,
      rows: [...rows].reverse(), // 最老的在上面
      summary: text.summary((young / total) * 100, (working / total) * 100, (old / total) * 100, old > 0 ? working / old : null),
    };
  }, [data, year, text]);

  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!view) return <p className="empty">{t.loading}</p>;

  const men = tokens.hues.blue;
  const women = tokens.hues.orange;
  const opacity = view.projected ? 0.6 : 1;
  const columns = '1fr 44px 1fr';
  const key = (color: string) => (
    <span
      aria-hidden="true"
      style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color, opacity, marginRight: 6 }}
    />
  );

  return (
    <section className="panel-section">
      <h3>
        {text.title(view.shownYear)}
        {view.projected && <span className="muted"> · {t.projected}</span>}
      </h3>
      <p className="note">{view.summary}</p>
      <div role="img" aria-label={text.chartAria(countryName, view.shownYear, view.summary)} style={{ marginTop: 10 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: tokens.inkSecondary, marginBottom: 6 }}
        >
          <span>
            {key(men)}
            {text.men}
          </span>
          <span>
            {key(women)}
            {text.women}
          </span>
        </div>
        {view.rows.map((r) => (
          <div
            key={r.start}
            style={{ display: 'grid', gridTemplateColumns: columns, alignItems: 'stretch', height: ROW, marginBottom: GAP }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', background: tokens.grid + '40' }}>
              <div
                title={text.bar(text.men, r.label, r.men)}
                style={{ width: `${Math.min(100, (r.men / scaleMax) * 100)}%`, background: men, opacity }}
              />
            </div>
            <div style={{ textAlign: 'center', fontSize: 10, lineHeight: `${ROW}px`, color: tokens.inkMuted }}>{r.label}</div>
            <div style={{ display: 'flex', background: tokens.grid + '40' }}>
              <div
                title={text.bar(text.women, r.label, r.women)}
                style={{ width: `${Math.min(100, (r.women / scaleMax) * 100)}%`, background: women, opacity }}
              />
            </div>
          </div>
        ))}
        <div
          aria-hidden="true"
          style={{ display: 'grid', gridTemplateColumns: columns, fontSize: 11, color: tokens.inkMuted, marginTop: 4 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{formatLargeTick(scaleMax)}</span>
            <span>0</span>
          </div>
          <span />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>0</span>
            <span>{formatLargeTick(scaleMax)}</span>
          </div>
        </div>
      </div>
      <p className="note">{text.scale}</p>
    </section>
  );
}

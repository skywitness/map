import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import { rankOf, valuesAt } from '../../panels/stats';
import type { IndicatorData, PanelExtraProps } from '../types';

/** taiwan.json（pipeline/topics/pisa.py）：臺灣 PISA 國家研究中心公布的歷屆分數與名次、各次的參加國數 */
interface TaiwanFile {
  source: string;
  participants: Record<string, number>;
  domains: Record<Domain, { ranks: Record<string, number>; scores: Record<string, number> }>;
}

type Domain = 'math' | 'reading' | 'science';
const DOMAINS: Domain[] = ['math', 'reading', 'science'];

const TEXT = defineMessages({
  zh: {
    title: '三個科目的歷次分數',
    domain: { math: '數學', reading: '閱讀', science: '科學' } as Record<Domain, string>,
    oecd: 'OECD 23 國平均',
    chartAria: (country: string, domain: string) => `${country}歷次 PISA 的${domain}平均分數與 OECD 23 國平均`,
    summary: (year: number, parts: string[]) => `${year} 年：${parts.join('、')}。`,
    part: (domain: string, score: number, diff: number) =>
      `${domain} ${fixed(score, 0)} 分（比 OECD 23 國平均${diff >= 0 ? '高' : '低'} ${fixed(Math.abs(diff), 0)} 分）`,
    tableCaption: (country: string) => `${country}歷次 PISA 三個科目的平均分數與名次`,
    colYear: '年',
    rank: (r: number) => `（第 ${r}）`,
    rankNote:
      '括號裡的名次只在參加 2025 年的國家與經濟體之間排（含只有部分地區參加的北京上海江蘇浙江等）；沒有參加 2025 年的（2009、2012 年的上海、列支敦斯登、俄羅斯等）不在資料裡，早年的名次可能比官方公布的前面。',
    oecdNote:
      'OECD 23 國平均是 PISA 2000 起每一次都參加的 23 個 OECD 國家，前後才能比較（臺灣 PISA 國家研究中心也用這個平均）；2025 年 38 個會員國的平均是數學 463、閱讀 461、科學 482 分。',
    twTitle: '臺灣 PISA 國家研究中心公布的名次',
    twCaption: '臺灣 PISA 國家研究中心公布的臺灣歷屆名次與參加國數',
    twRank: (r: number, n: number) => `${r}／${n}`,
    twNote:
      '官方名次含當年所有的參加者（例如 2009、2012 年第一名的上海），分母是那一次的參加國與經濟體數；分數跟 OECD 的表四捨五入後完全一樣。',
    none: '沒有參加 PISA 2025（只參加過之前幾次的國家不在資料裡，見頁尾）。',
  },
  en: {
    title: 'Scores in all three subjects',
    domain: { math: 'Mathematics', reading: 'Reading', science: 'Science' },
    oecd: 'OECD average (23)',
    chartAria: (country, domain) => `Mean PISA ${domain.toLowerCase()} score for ${country} by cycle, with the average of 23 OECD countries`,
    summary: (year, parts) => `${year}: ${parts.join('; ')}.`,
    part: (domain, score, diff) =>
      `${domain.toLowerCase()} ${fixed(score, 0)} (${fixed(Math.abs(diff), 0)} points ${diff >= 0 ? 'above' : 'below'} the OECD-23 average)`,
    tableCaption: (country) => `Mean scores and ranks for ${country} in each PISA cycle, by subject`,
    colYear: 'Year',
    rank: (r) => ` (#${r})`,
    rankNote:
      'Ranks in brackets are among the countries and economies in PISA 2025 only (including partial participants such as Beijing-Shanghai-Jiangsu-Zhejiang); those that did not take part in 2025 (Shanghai in 2009 and 2012, Liechtenstein, Russia and others) are not in the data, so early ranks can be higher than the official ones.',
    oecdNote:
      'The OECD-23 average covers the 23 OECD countries that took part in every cycle since 2000, so it can be compared over time (Taiwan’s PISA National Center uses it too). In 2025 the average of all 38 members was 463 in mathematics, 461 in reading and 482 in science.',
    twTitle: "Ranks published by Taiwan's PISA National Center",
    twCaption: "Taiwan's ranks and the number of participants in each cycle, as published by Taiwan's PISA National Center",
    twRank: (r, n) => `${r} of ${n}`,
    twNote:
      'Official ranks include every participant in that cycle (Shanghai ranked first in 2009 and 2012, for example); the second number is the number of participating countries and economies. The scores match the OECD tables exactly after rounding.',
    none: 'Did not take part in PISA 2025 (countries that took part only in earlier cycles are not in the data; see the footer).',
  },
});

/** 分數在 400–600 之間：y 軸不從 0 開始，起伏才看得出來 */
function zoomY(option: ChartSpec): ChartSpec {
  return { ...option, y: { ...option.y, zero: false } };
}

export default function PisaPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useMemo(() => DOMAINS.map((d) => `topics/${topic.id}/mean/${d}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(files);
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const data = loaded as IndicatorData[];
    const indicator = topic.indicators.find((i) => i.id === 'mean')!;
    const charts = DOMAINS.flatMap((domain, i) => {
      const d = data[i];
      const own = d.values[iso3];
      if (!own?.some((v) => v != null)) return [];
      // 從這個國家第一次參加的那一年開始畫
      const start = own.findIndex((v) => v != null);
      const option = zoomY(
        timeSeriesOption({
          years: d.years.slice(start),
          lines: [
            { name: countryName, values: own.slice(start), color: tokens.accent },
            { name: text.oecd, values: (d.aggregates?.OECD23 ?? []).slice(start), color: tokens.context },
          ],
          year,
          indicator,
          tokens,
          sparse: true,
        }),
      );
      return [{ domain, option }];
    });

    // 選的年份（或之前最近一次）三個科目的分數，跟 OECD 23 國平均比
    const cycles = [...new Set(data.flatMap((d) => d.years))].sort((a, b) => a - b);
    const shown = [...cycles].reverse().find((y) => y <= year && data.some((d) => d.values[iso3]?.[d.years.indexOf(y)] != null));
    const parts =
      shown === undefined
        ? []
        : DOMAINS.flatMap((domain, i) => {
            const d = data[i];
            const k = d.years.indexOf(shown);
            const v = k < 0 ? null : d.values[iso3]?.[k];
            const avg = k < 0 ? null : d.aggregates?.OECD23?.[k];
            return v == null || avg == null ? [] : [text.part(text.domain[domain], v, v - avg)];
          });

    // 每一次的分數與名次（名次在這份資料裡有那一次成績的參加者之間排）
    const rows = [...cycles].reverse().flatMap((y) => {
      const cells = data.map((d) => {
        const k = d.years.indexOf(y);
        const v = k < 0 ? null : d.values[iso3]?.[k];
        return v == null ? null : { score: v, rank: rankOf(valuesAt(d, k), iso3) };
      });
      return cells.some(Boolean) ? [{ year: y, cells }] : [];
    });

    return { charts, summary: shown === undefined ? '' : text.summary(shown, parts), rows };
  }, [loaded, iso3, year, topic, tokens, text, countryName]);

  if (!view) return <p className="empty">{t.loading}</p>;
  // 只有部分地區參加的國家（中國、烏克蘭…）上面的數值卡片已經寫了原因
  if (!view.rows.length) return topic.noValue?.[iso3] ? null : <p className="note">{text.none}</p>;
  const twYears = taiwan ? Object.keys(taiwan.participants).sort((a, b) => Number(b) - Number(a)) : [];
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {view.summary && <p className="note">{view.summary}</p>}
      {view.charts.map(({ domain, option }) => (
        <div key={domain}>
          <h4>{text.domain[domain]}</h4>
          <Chart spec={option} height={150} ariaLabel={text.chartAria(countryName, text.domain[domain])} />
        </div>
      ))}
      <table className="mini-table" aria-label={text.tableCaption(countryName)}>
        <thead>
          <tr>
            <th scope="col">{text.colYear}</th>
            {DOMAINS.map((d) => (
              <th key={d} scope="col" className="num">
                {text.domain[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((r) => (
            <tr key={r.year}>
              <th scope="row">{r.year}</th>
              {r.cells.map((c, i) => (
                <td key={DOMAINS[i]} className="num">
                  {c ? `${fixed(c.score, 0)}${c.rank ? text.rank(c.rank) : ''}` : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.rankNote}</p>
      <p className="note">{text.oecdNote}</p>
      {taiwan && (
        <>
          <h4>{text.twTitle}</h4>
          <table className="mini-table" aria-label={text.twCaption}>
            <thead>
              <tr>
                <th scope="col">{text.colYear}</th>
                {DOMAINS.map((d) => (
                  <th key={d} scope="col" className="num">
                    {text.domain[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {twYears.map((y) => (
                <tr key={y}>
                  <th scope="row">{y}</th>
                  {DOMAINS.map((d) => {
                    const r = taiwan.domains[d].ranks[y];
                    return (
                      <td key={d} className="num">
                        {r ? text.twRank(r, taiwan.participants[y]) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.twNote}</p>
        </>
      )}
    </section>
  );
}

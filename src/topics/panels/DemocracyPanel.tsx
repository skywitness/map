import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, type Lang, type Text } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue, Tokens } from '../../theme/tokens';
import { COMPULSORY_VOTING } from '../laws';
import type { IndicatorData, PanelExtraProps } from '../types';
import { TopicLink } from './TopicLink';

/** 三項指數（id 跟 democracy.ts 的指標一致），線的顏色依圖表類別色的順序 */
const INDICES: { id: string; label: Text; hue: Hue }[] = [
  { id: 'electoral-democracy', label: { zh: '選舉民主', en: 'Electoral democracy' }, hue: 'blue' },
  { id: 'liberal-democracy', label: { zh: '自由民主', en: 'Liberal democracy' }, hue: 'orange' },
  { id: 'free-expression', label: { zh: '言論自由', en: 'Freedom of expression' }, hue: 'aqua' },
];

const TEXT = defineMessages({
  zh: {
    title: '三項指數對照',
    interval: (year: number, parts: string[]) =>
      `${year} 年的估計值與 68% 可信區間：${parts.join('、')}。區間重疊的國家，高低不一定有意義。`,
    part: (label: string, value: string, low: string, high: string) => `${label} ${value}（${low}–${high}）`,
    chartAria: (country: string) => `${country}歷年的選舉民主、自由民主與言論自由指數`,
    current: (label: string, year: number, value: string, low: string, high: string) =>
      `${label}：${year} 年 ${value}（68% 可信區間 ${low}–${high}）。`,
  },
  en: {
    title: 'The three indices compared',
    interval: (year, parts) =>
      `Estimates for ${year} with 68% credible intervals: ${parts.join('; ')}. Where intervals overlap, countries may not really differ.`,
    part: (label, value, low, high) => `${label.toLowerCase()} ${value} (${low}–${high})`,
    chartAria: (country) => `Electoral democracy, liberal democracy and freedom of expression indices in ${country} over time`,
    current: (label, year, value, low, high) => `${label}: ${value} in ${year} (68% credible interval ${low}–${high}).`,
  },
});

const index = (v: number) => fixed(v, 2);

export default function DemocracyPanel(props: PanelExtraProps) {
  // 投票率與選舉制度（2026-11-05）：先列歷次選舉，再接三項指數
  const elections = props.indicator.id === 'turnout' || props.indicator.id === 'electoral-system';
  return (
    <>
      {elections && <Elections {...props} />}
      <Indices {...props} />
    </>
  );
}

function Indices({ topic, indicator, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  // 每項指數三個檔：估計值、68% 可信區間的下限與上限（pipeline/topics/democracy.py 的 intervals/）
  const files = useMemo(
    () =>
      INDICES.flatMap((d) => [
        `topics/${topic.id}/${d.id}.json`,
        `topics/${topic.id}/intervals/${d.id}-low.json`,
        `topics/${topic.id}/intervals/${d.id}-high.json`,
      ]),
    [topic.id],
  );
  const loaded = useJsonMany<IndicatorData>(files);

  const view = useMemo(() => {
    const main = INDICES.map((_d, i) => loaded[i * 3]);
    if (!main.every(Boolean)) return null;
    const own = main.map((d) => d!.values[iso3]);
    if (!own.every(Boolean)) return null;
    const years = main[0]!.years;
    const indicator = topic.indicators.find((i) => i.id === 'electoral-democracy')!;
    const base = timeSeriesOption({
      years,
      lines: INDICES.map((d, i) => ({ name: tr(d.label, lang), values: own[i]!, color: tokens.hues[d.hue] })),
      year,
      indicator,
      tokens,
    });
    // 固定 0–1，各國的圖才能互相比較（圖例放不下一列時自己換行，Chart.tsx）
    const option: ChartSpec = { ...base, y: { ...base.y, min: 0, max: 1 } };

    // 可信區間：三項指數都有值的最近一年（不晚於時間軸的年份）
    let interval: string | null = null;
    const at = latestIndexAtOrBefore(years, year, (i) => own.every((s) => s![i] != null));
    const bounds = INDICES.map((_d, i) => [loaded[i * 3 + 1]?.values[iso3]?.[at], loaded[i * 3 + 2]?.values[iso3]?.[at]]);
    if (at >= 0 && bounds.every(([lo, hi]) => lo != null && hi != null)) {
      interval = text.interval(
        years[at],
        INDICES.map((d, i) => text.part(tr(d.label, lang), index(own[i]![at]!), index(bounds[i][0]!), index(bounds[i][1]!))),
      );
    }
    return { option, interval };
  }, [loaded, iso3, year, topic, tokens, lang, text]);

  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <Chart spec={view.option} height={220} ariaLabel={text.chartAria(countryName)} />
      {view.interval && <p className="note">{view.interval}</p>}
      <CurrentInterval topicId={topic.id} indicator={indicator} iso3={iso3} year={year} />
    </section>
  );
}

/**
 * 目前的指標不是上面三項之一（2026-10-30 加的參與式、審議式、平等民主、公民自由、政治貪腐）時，
 * 另外寫這一項的估計值與 68% 可信區間
 */
function CurrentInterval({ topicId, indicator, iso3, year }: { topicId: string; indicator: PanelExtraProps['indicator']; iso3: string; year: number }) {
  const lang = useLang();
  const extra = indicator.layer.kind === 'choropleth' && !INDICES.some((d) => d.id === indicator.id);
  const files = useMemo(
    () => (extra ? ['', '-low', '-high'].map((s) => (s ? `topics/${topicId}/intervals/${indicator.id}${s}.json` : `topics/${topicId}/${indicator.id}.json`)) : []),
    [extra, topicId, indicator.id],
  );
  const [main, low, high] = useJsonMany<IndicatorData>(files);
  if (!extra || !main || !low || !high) return null;
  const own = main.values[iso3];
  if (!own) return null;
  const at = latestIndexAtOrBefore(main.years, year, (i) => own[i] != null);
  const lo = low.values[iso3]?.[at];
  const hi = high.values[iso3]?.[at];
  if (at < 0 || lo == null || hi == null) return null;
  return <p className="note">{TEXT[lang].current(tr(indicator.label, lang), main.years[at], index(own[at]!), index(lo), index(hi))}</p>;
}

/**
 * 歷次全國選舉（pipeline/topics/democracy.py 的 elections.json）：每國一列一場
 * [年, 選舉類型的位元（v2eltype_0–7）, 投票率, 占投票年齡人口, 13 類選舉制度（v2elloelsy）]
 */
type Election = [number, number, number | null, number | null, number | null];
interface ElectionsFile {
  /** 跟上一次一字不差、沒有採用的投票率的年份 */
  repeated: Record<string, number[]>;
  countries: Record<string, Election[]>;
}

/** 位元 i 是 v2eltype_i（pipeline 的 ELECTION_TYPES） */
const ELECTION_TYPES: Text[] = [
  { zh: '國會', en: 'legislative' },
  { zh: '國會第二輪', en: 'legislative runoff' },
  { zh: '上議院', en: 'upper chamber' },
  { zh: '上議院第二輪', en: 'upper chamber runoff' },
  { zh: '制憲議會', en: 'constituent assembly' },
  { zh: '制憲議會第二輪', en: 'constituent assembly runoff' },
  { zh: '總統', en: 'presidential' },
  { zh: '總統第二輪', en: 'presidential runoff' },
];
/** v2elloelsy 的 13 類（pipeline 的 ELECTORAL_SYSTEM_DETAIL） */
const SYSTEM_DETAIL: Text[] = [
  { zh: '單一選區相對多數制', en: 'first-past-the-post' },
  { zh: '單一選區兩輪投票制', en: 'two-round system' },
  { zh: '選擇投票制（排序複選）', en: 'alternative vote' },
  { zh: '複數選區全額連記制', en: 'block vote' },
  { zh: '政黨全額連記制', en: 'party block vote' },
  { zh: '並立制（單一選區與比例代表分開計算）', en: 'parallel (single-member districts and PR counted separately)' },
  { zh: '聯立制（比例代表補償席次）', en: 'mixed-member proportional' },
  { zh: '名單比例代表制（小選區）', en: 'list PR, small districts' },
  { zh: '名單比例代表制（大選區）', en: 'list PR, large districts' },
  { zh: '單記可讓渡投票制', en: 'single transferable vote' },
  { zh: '單記非讓渡投票制', en: 'single non-transferable vote' },
  { zh: '限制連記制', en: 'limited vote' },
  { zh: '波達計數法', en: 'Borda count' },
];

const ELECTION_TEXT = defineMessages({
  zh: {
    title: '歷次全國選舉',
    types: (names: string[]) => `${names.join('、')}選舉`,
    registered: '登記選舉人',
    vap: '投票年齡人口',
    chartAria: (country: string) => `${country}歷次全國選舉的投票率（登記選舉人與投票年齡人口）`,
    latest: (year: number, types: string, value: string | null, vap: string | null) =>
      `最近一次是 ${year} 年的${types}` +
      (value ? `，投票率 ${value}${vap ? `（占投票年齡人口 ${vap}）` : ''}` : '') +
      '。',
    system: (year: number, name: string) => `${year} 年國會選舉用的是${name}。`,
    compulsory: (label: string) => `強制投票：${label}。`,
    compulsoryLink: '「法律與制度」的強制投票圖',
    repeated: (years: number[]) => `V-Dem v16 給 ${years.join('、')} 年的投票率跟上一次選舉一字不差（兩種分母都一樣），看起來是沿用，沒有採用。`,
    note: '只畫有投票率的選舉，x 軸只有選舉的年份。同一年有兩場以上時是比較高的那場；國會與總統同一天選時是總統選舉的投票率。投票年齡人口的投票率可能超過 100%（選舉人名冊或人口估計的問題）。',
  },
  en: {
    title: 'National elections',
    types: (names) => `${names.join(', ')} election`,
    registered: 'Registered voters',
    vap: 'Voting-age population',
    chartAria: (country) => `Turnout in national elections in ${country} (registered voters and voting-age population)`,
    latest: (year, types, value, vap) =>
      `The most recent was the ${year} ${types}` +
      (value ? `, with turnout of ${value}${vap ? ` (${vap} of the voting-age population)` : ''}` : '') +
      '.',
    system: (year, name) => `Electoral system in the ${year} legislative election: ${name}.`,
    compulsory: (label) => `Compulsory voting: ${label.toLowerCase()}.`,
    compulsoryLink: 'Compulsory voting map in the Laws topic',
    repeated: (years) => `V-Dem v16 gives exactly the same turnout for ${years.join(', ')} as for the previous election (both denominators), which looks carried over, so it is not used.`,
    note: 'Only elections with a turnout figure are plotted, and the x axis lists only election years. Where there were two or more elections in a year, the higher turnout is used; where legislative and presidential elections fell on the same day, the presidential turnout. Turnout of the voting-age population can exceed 100% (problems with the register or population estimates).',
  },
});

const typesOf = (mask: number, lang: Lang) =>
  ELECTION_TYPES.filter((_t, i) => mask & (1 << i)).map((t) => tr(t, lang));

function electionsChart(list: Election[], tokens: Tokens, lang: Lang): ChartSpec {
  const text = ELECTION_TEXT[lang];
  const rows = list.filter((e) => e[2] != null || e[3] != null);
  const top = Math.max(100, ...rows.map((e) => Math.max(e[2] ?? 0, e[3] ?? 0)));
  const colors = [tokens.hues.blue, tokens.hues.orange];
  return {
    x: { type: 'category', labels: rows.map((e) => String(e[0])) },
    y: { format: (v) => `${fixed(v, 0)}%`, min: 0, max: Math.ceil(top / 10) * 10 },
    series: [
      { type: 'line', name: text.registered, values: rows.map((e) => e[2]), color: colors[0], dots: true },
      { type: 'line', name: text.vap, values: rows.map((e) => e[3]), color: colors[1], dots: true, dashed: true },
    ],
    tooltip: (i) => {
      const e = rows[i];
      if (!e) return null;
      const types = typesOf(e[1], lang);
      return {
        head: types.length ? `${e[0]} · ${text.types(types)}` : String(e[0]),
        rows: [
          ...(e[2] != null ? [{ color: colors[0], value: `${fixed(e[2], 1)}%`, name: text.registered }] : []),
          ...(e[3] != null ? [{ color: colors[1], value: `${fixed(e[3], 1)}%`, name: text.vap }] : []),
        ],
      };
    },
  };
}

function Elections({ iso3, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = ELECTION_TEXT[lang];
  const file = useJson<ElectionsFile>('topics/democracy/elections.json').data;
  const compulsory = useJson<IndicatorData>('topics/laws/compulsory-voting.json').data;
  const view = useMemo(() => {
    const list = file?.countries[iso3];
    if (!list?.length) return null;
    const withTurnout = list.filter((e) => e[2] != null || e[3] != null);
    const last = list[list.length - 1];
    const lastSystem = [...list].reverse().find((e) => e[4] != null);
    const pct = (v: number | null) => (v == null ? null : `${fixed(v, 1)}%`);
    const types = typesOf(last[1], lang);
    return {
      chart: withTurnout.length >= 2 ? electionsChart(list, tokens, lang) : null,
      latest: types.length ? text.latest(last[0], text.types(types), pct(last[2]), pct(last[3])) : null,
      system: lastSystem ? text.system(lastSystem[0], tr(SYSTEM_DETAIL[lastSystem[4]!], lang)) : null,
      repeated: file?.repeated[iso3] ? text.repeated(file.repeated[iso3]) : null,
    };
  }, [file, iso3, tokens, lang, text]);
  const compulsoryLabel = useMemo(() => {
    const values = compulsory?.values[iso3];
    const v = values ? [...values].reverse().find((x) => x != null) : undefined;
    const category = COMPULSORY_VOTING.find((c) => c.value === v);
    return category ? tr(category.label, lang) : null;
  }, [compulsory, iso3, lang]);
  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {view.latest && <p>{view.latest}</p>}
      {view.system && <p>{view.system}</p>}
      {view.chart && <Chart spec={view.chart} height={200} ariaLabel={text.chartAria(countryName)} />}
      {view.repeated && <p className="note">{view.repeated}</p>}
      {compulsoryLabel && (
        <p>
          {text.compulsory(compulsoryLabel)}{' '}
          <TopicLink topic="laws" ind="compulsory-voting" iso3={iso3}>
            {text.compulsoryLink}
          </TopicLink>
        </p>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}

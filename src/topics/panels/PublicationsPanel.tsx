import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT, type Lang } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { fixed, formatPercent } from '../../lib/format';
import { flowSelection } from '../../map/flows';
import { MIN_PAPERS, paperCount, TOP10_LAST } from '../publications';
import type { FlowFile, PanelExtraProps } from '../types';

/**
 * 學術論文的側欄（pipeline/topics/publications.py）：
 * - 歷年的論文數：核心來源（地圖用的）與 OpenAlex 的全部來源對照
 * - 選定那一年的論文數、國際合著、開放取用、高被引，跟全世界對照
 * - 開放取用與國際合著比例的變化（虛線是全世界）
 * - 26 個學科的分布、主要合著國家（讀流向檔）
 * 都是全部領域（不跟著子項目換）。
 */

/** countries/<ISO3>.json 與 world.json：從 first 年起每年一個值 */
interface PubFile {
  first: number;
  papers: (number | null)[];
  allSources: (number | null)[];
  international: (number | null)[];
  openAccess: (number | null)[];
  top10: (number | null)[];
  /** OpenAlex 的學科 id → 每年的篇數 */
  fields: Record<string, (number | null)[]>;
  /** 只有 world.json：沒有作者國家的論文 */
  unknown?: number[];
}

/** 26 個學科（OpenAlex 的 field）：名稱與所屬的領域（子項目的 id） */
const FIELDS: Record<string, { zh: string; en: string; domain: string }> = {
  '11': { zh: '農業與生物科學', en: 'Agricultural and biological sciences', domain: 'life' },
  '12': { zh: '藝術與人文', en: 'Arts and humanities', domain: 'social' },
  '13': { zh: '生化、遺傳與分子生物學', en: 'Biochemistry, genetics and molecular biology', domain: 'life' },
  '14': { zh: '商業、管理與會計', en: 'Business, management and accounting', domain: 'social' },
  '15': { zh: '化學工程', en: 'Chemical engineering', domain: 'physical' },
  '16': { zh: '化學', en: 'Chemistry', domain: 'physical' },
  '17': { zh: '資訊科學', en: 'Computer science', domain: 'physical' },
  '18': { zh: '決策科學', en: 'Decision sciences', domain: 'social' },
  '19': { zh: '地球與行星科學', en: 'Earth and planetary sciences', domain: 'physical' },
  '20': { zh: '經濟、計量經濟與財務', en: 'Economics, econometrics and finance', domain: 'social' },
  '21': { zh: '能源', en: 'Energy', domain: 'physical' },
  '22': { zh: '工程', en: 'Engineering', domain: 'physical' },
  '23': { zh: '環境科學', en: 'Environmental science', domain: 'physical' },
  '24': { zh: '免疫與微生物學', en: 'Immunology and microbiology', domain: 'life' },
  '25': { zh: '材料科學', en: 'Materials science', domain: 'physical' },
  '26': { zh: '數學', en: 'Mathematics', domain: 'physical' },
  '27': { zh: '醫學', en: 'Medicine', domain: 'health' },
  '28': { zh: '神經科學', en: 'Neuroscience', domain: 'life' },
  '29': { zh: '護理', en: 'Nursing', domain: 'health' },
  '30': { zh: '藥理、毒理與藥劑學', en: 'Pharmacology, toxicology and pharmaceutics', domain: 'life' },
  '31': { zh: '物理與天文', en: 'Physics and astronomy', domain: 'physical' },
  '32': { zh: '心理學', en: 'Psychology', domain: 'social' },
  '33': { zh: '社會科學', en: 'Social sciences', domain: 'social' },
  '34': { zh: '獸醫', en: 'Veterinary science', domain: 'health' },
  '35': { zh: '牙醫', en: 'Dentistry', domain: 'health' },
  '36': { zh: '醫事專業', en: 'Health professions', domain: 'health' },
};
const DOMAIN_ORDER = ['physical', 'health', 'life', 'social'];
/** 列出的學科、合著國家數；流向檔每個國家存前 15 名 */
const FIELDS_SHOWN = 10;
const PARTNERS_SHOWN = 8;

const TEXT = defineMessages({
  zh: {
    historyTitle: '歷年的論文數',
    historyAria: (country: string) => `${country}歷年的論文數，核心來源與 OpenAlex 全部來源`,
    core: '核心期刊與會議',
    all: 'OpenAlex 全部來源',
    historyNote: (share: string) =>
      `地圖只算核心來源（國際性的學術期刊與會議論文集）。全部來源另外含非核心的期刊（多半是本國語言出版的）、典藏庫與其他來源的期刊論文、回顧論文與會議論文；最新一年核心來源占 ${share}。`,
    historyNoteNone: '地圖只算核心來源（國際性的學術期刊與會議論文集）。全部來源另外含非核心的期刊（多半是本國語言出版的）、典藏庫與其他來源。',
    tableTitle: (y: number) => `${y} 年的論文`,
    tableAria: (country: string, y: number) => `${country} ${y} 年的論文數、國際合著、開放取用與高被引比例，跟全世界對照`,
    colItem: '項目',
    colHere: '這裡',
    colWorld: '全世界',
    rowCore: '論文數（核心來源）',
    rowAll: '論文數（全部來源）',
    rowIntl: '國際合著',
    rowOa: '開放取用',
    rowTop10: '高被引（前 10%）',
    tableNote: (min: number, last: number) =>
      `各國用整數計數，全世界是不重複的篇數。比例要有 ${min} 篇以上才算；國際合著的全世界比例不算沒有作者國家的論文；高被引只到 ${last} 年。`,
    sharesTitle: '開放取用與國際合著',
    sharesAria: (country: string) => `${country}歷年的開放取用與國際合著比例，跟全世界對照`,
    oa: '開放取用',
    intl: '國際合著',
    worldOf: (name: string) => `全世界${name}`,
    sharesNote: '開放取用是現在看得到免費全文的比例，舊論文後來放上典藏庫的也算。',
    fieldsTitle: (y: number) => `${y} 年的學科`,
    fieldsAria: (country: string) => `${country}論文最多的學科`,
    fieldsNote: (domains: string) =>
      `依 OpenAlex 自動分類的主要主題，占有分類的論文的比例。四個領域：${domains}。`,
    domainShare: (name: string, here: string, world: string) => `${name} ${here}（全世界 ${world}）`,
    partnersTitle: (y: number) => `${y} 年的主要合著國家`,
    partnersAria: (country: string) => `${country}的主要合著國家`,
    partnersTotal: (total: string) => `國際合著的論文 ${total}`,
    partnersNote: '占這國國際合著論文的比例；一篇論文可以有好幾個國家的作者，所以加起來超過 100%。',
    papers: (n: string) => `${n} 篇`,
    none: '沒有資料。',
    noPartners: '這一年沒有國際合著的論文。',
    listSep: '、',
  },
  en: {
    historyTitle: 'Papers over time',
    historyAria: (country) => `Papers by year in ${country}, core sources and all OpenAlex sources`,
    core: 'Core journals and proceedings',
    all: 'All OpenAlex sources',
    historyNote: (share) =>
      `The map counts core sources only (international scientific journals and proceedings). All sources add non-core journals (mostly in national languages), repositories and other sources of articles, reviews and conference papers; core sources made up ${share} in the latest year.`,
    historyNoteNone:
      'The map counts core sources only (international scientific journals and proceedings). All sources add non-core journals (mostly in national languages), repositories and other sources.',
    tableTitle: (y) => `Papers in ${y}`,
    tableAria: (country, y) => `Papers, international co-authorship, open access and highly cited shares in ${country}, ${y}, compared with the world`,
    colItem: 'Measure',
    colHere: 'Here',
    colWorld: 'World',
    rowCore: 'Papers (core sources)',
    rowAll: 'Papers (all sources)',
    rowIntl: 'International co-authorship',
    rowOa: 'Open access',
    rowTop10: 'Highly cited (top 10%)',
    tableNote: (min, last) =>
      `Countries use full counting; the world counts each paper once. Shares need at least ${min} papers; the world co-authorship share leaves out papers with no author country; highly cited runs to ${last}.`,
    sharesTitle: 'Open access and international co-authorship',
    sharesAria: (country) => `Open access and international co-authorship shares in ${country} over time, compared with the world`,
    oa: 'Open access',
    intl: 'International',
    worldOf: (name) => `World: ${name.toLowerCase()}`,
    sharesNote: 'Open access is the share with a free full text available now, including older papers later added to repositories.',
    fieldsTitle: (y) => `Fields, ${y}`,
    fieldsAria: (country) => `Fields with the most papers in ${country}`,
    fieldsNote: (domains) => `By primary topic as classified automatically by OpenAlex, as a share of classified papers. The four domains: ${domains}.`,
    domainShare: (name, here, world) => `${name} ${here} (world ${world})`,
    partnersTitle: (y) => `Main co-author countries, ${y}`,
    partnersAria: (country) => `Main co-author countries of ${country}`,
    partnersTotal: (total) => `Internationally co-authored papers: ${total}`,
    partnersNote: 'Shares are of the country’s internationally co-authored papers; a paper can have authors in several countries, so they add up to more than 100%.',
    papers: (n) => `${n} papers`,
    none: 'No data.',
    noPartners: 'No internationally co-authored papers this year.',
    listSep: '; ',
  },
});

function share(part: number | null | undefined, whole: number | null | undefined, min = 0): number | null {
  return part != null && whole && whole >= min ? (part / whole) * 100 : null;
}

function fieldName(id: string, lang: Lang): string {
  return FIELDS[id]?.[lang] ?? id;
}

export default function PublicationsPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const base = `topics/${topic.id}`;
  const own = useJson<PubFile>(`${base}/countries/${iso3}.json`);
  const world = useJson<PubFile>(`${base}/world.json`).data;
  const countries = useJson<CountryTable>('countries.json').data;
  const data = own.data;

  const view = useMemo(() => {
    if (!data || !world) return null;
    const years = data.papers.map((_, i) => data.first + i);
    const y = Math.min(Math.max(year, years[0]), years[years.length - 1]);
    const index = y - data.first;
    const papersIndicator = topic.indicators.find((i) => i.id === 'papers')!;
    const oaIndicator = topic.indicators.find((i) => i.id === 'open-access')!;
    const history = timeSeriesOption({
      years,
      lines: [
        { name: text.core, values: data.papers, color: tokens.hues.blue },
        { name: text.all, values: data.allSources, color: tokens.hues.orange, dashed: true },
      ],
      year: y,
      indicator: papersIndicator,
      tokens,
    });
    const own = (part: (number | null)[]) => part.map((v, i) => share(v ?? 0, data.papers[i], MIN_PAPERS));
    const worldIntl = world.international.map((v, i) => share(v, (world.papers[i] ?? 0) - (world.unknown?.[i] ?? 0)));
    const worldOa = world.openAccess.map((v, i) => share(v, world.papers[i]));
    const sharesBase = timeSeriesOption({
      years,
      lines: [
        { name: text.oa, values: own(data.openAccess), color: tokens.hues.green },
        { name: text.worldOf(text.oa), values: worldOa, color: tokens.hues.green, dashed: true },
        { name: text.intl, values: own(data.international), color: tokens.hues.violet },
        { name: text.worldOf(text.intl), values: worldIntl, color: tokens.hues.violet, dashed: true },
      ],
      year: y,
      indicator: oaIndicator,
      tokens,
    });
    // 四條線的圖例在側欄的寬度會排成兩行（Chart.tsx 的圖例自己換行）
    const shares = sharesBase;
    return { y, index, history, shares, worldIntl, worldOa };
  }, [data, world, year, topic, tokens, text]);

  const flowYear = view?.y ?? null;
  const flows = useJson<FlowFile>(flowYear ? `${base}/flows/${flowYear}.json` : null).data;

  if (own.loading) return <p className="empty">{t.loading}</p>;
  if (!data || !world || !view) return own.error ? <p className="note">{t.noData}</p> : null;

  const { y, index } = view;
  const count = (v: number) => text.papers(fixed(v, 0));
  const fmt = (v: number | null | undefined) => (v == null ? '—' : paperCount(v));
  const pct = (v: number | null) => (v == null ? '—' : formatPercent(v, 1));
  const papers = data.papers[index];
  const lastCore = data.papers[data.papers.length - 1];
  const lastAll = data.allSources[data.allSources.length - 1];
  const top10Ok = y <= TOP10_LAST;

  const rows: { label: string; here: string; world: string }[] = [
    { label: text.rowCore, here: fmt(papers), world: fmt(world.papers[index]) },
    { label: text.rowAll, here: fmt(data.allSources[index]), world: fmt(world.allSources[index]) },
    {
      label: text.rowIntl,
      here: pct(share(data.international[index] ?? 0, papers, MIN_PAPERS)),
      world: pct(view.worldIntl[index]),
    },
    { label: text.rowOa, here: pct(share(data.openAccess[index] ?? 0, papers, MIN_PAPERS)), world: pct(view.worldOa[index]) },
    {
      label: text.rowTop10,
      here: top10Ok ? pct(share(data.top10[index] ?? 0, papers, MIN_PAPERS)) : '—',
      world: top10Ok ? pct(share(world.top10[index], world.papers[index])) : '—',
    },
  ];

  // 學科：這一年各學科的篇數，占有分類的論文的比例
  const fieldValues = (file: PubFile) =>
    Object.entries(file.fields)
      .map(([id, values]) => [id, values[index] ?? 0] as [string, number])
      .filter(([, v]) => v > 0);
  const ownFields = fieldValues(data).sort((a, b) => b[1] - a[1]);
  const classified = ownFields.reduce((sum, [, v]) => sum + v, 0);
  const worldFields = fieldValues(world);
  const worldClassified = worldFields.reduce((sum, [, v]) => sum + v, 0);
  const domainLabels = new Map(topic.dimension?.options.map((o) => [o.id, o.label]) ?? []);
  const domainSum = (list: [string, number][], domain: string) =>
    list.filter(([id]) => FIELDS[id]?.domain === domain).reduce((sum, [, v]) => sum + v, 0);
  const domains = DOMAIN_ORDER.map((d) =>
    text.domainShare(
      domainLabels.get(d) ?? d,
      formatPercent((domainSum(ownFields, d) / classified) * 100, 0),
      formatPercent((domainSum(worldFields, d) / worldClassified) * 100, 0),
    ),
  ).join(text.listSep);

  const sel = flows && flows.year === y ? flowSelection(flows, iso3, 'export') : null;

  return (
    <>
      <section className="panel-section">
        <h3>{text.historyTitle}</h3>
        <Chart spec={view.history} height={210} ariaLabel={text.historyAria(countryName)} />
        <p className="note">
          {lastCore && lastAll ? text.historyNote(formatPercent((lastCore / lastAll) * 100, 0)) : text.historyNoteNone}
        </p>
      </section>
      <section className="panel-section">
        <h3>{text.tableTitle(y)}</h3>
        <table className="mini-table dev-table" aria-label={text.tableAria(countryName, y)}>
          <thead>
            <tr>
              <th scope="col">{text.colItem}</th>
              <th scope="col" className="num">
                {text.colHere}
              </th>
              <th scope="col" className="num">
                {text.colWorld}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td className="num">{r.here}</td>
                <td className="num">{r.world}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">{text.tableNote(MIN_PAPERS, TOP10_LAST)}</p>
      </section>
      <section className="panel-section">
        <h3>{text.sharesTitle}</h3>
        <Chart spec={view.shares} height={230} ariaLabel={text.sharesAria(countryName)} />
        <p className="note">{text.sharesNote}</p>
      </section>
      <section className="panel-section">
        <h3>{text.fieldsTitle(y)}</h3>
        {classified > 0 ? (
          <>
            <BarList
              items={ownFields.slice(0, FIELDS_SHOWN).map(([id, v]) => ({ key: id, label: fieldName(id, lang), value: v }))}
              total={classified}
              format={count}
              ariaLabel={text.fieldsAria(countryName)}
            />
            <p className="note">{text.fieldsNote(domains)}</p>
          </>
        ) : (
          <p className="empty">{text.none}</p>
        )}
      </section>
      <section className="panel-section">
        <h3>{text.partnersTitle(y)}</h3>
        {!flows || flows.year !== y ? (
          <p className="empty">{t.loading}</p>
        ) : sel && sel.links.length > 0 ? (
          <>
            <p className="panel-year-note">{text.partnersTotal(count(sel.total))}</p>
            <BarList
              items={sel.links
                .slice(0, PARTNERS_SHOWN)
                .map((l) => ({ key: l.iso3, label: nameOf(l.iso3, countries, lang), value: l.value }))}
              total={sel.total}
              format={count}
              ariaLabel={text.partnersAria(countryName)}
            />
            <p className="note">{text.partnersNote}</p>
          </>
        ) : (
          <p className="empty">{text.noPartners}</p>
        )}
      </section>
    </>
  );
}

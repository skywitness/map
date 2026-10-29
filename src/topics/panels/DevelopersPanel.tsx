import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { defineMessages, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber, formatLargeTick, formatPercent } from '../../lib/format';
import { flowSelection, flowText } from '../../map/flows';
import type { FlowDirection, FlowFile, PanelExtraProps } from '../types';

/**
 * 開發者與開源的側欄（pipeline/topics/developers.py）：
 * - 每一季的開發者帳號數與推送次數（地圖每年只取第 1 季，這裡每一季都畫）
 * - 選定那一季的開發者、組織、公開版本庫、推送，跟全世界對照
 * - 最多人用的程式語言、授權條款（推送到這種版本庫的開發者人數）
 * - 跨經濟體協作：這裡的開發者主要貢獻給誰、外來協作者主要來自哪裡（讀流向檔）
 */

/** countries/<ISO3>.json 與 world.json */
interface DevFile {
  /** 第一季（[年, 季]），之後每一季一個值 */
  first: [number, number];
  /** 地圖取每年的第幾季 */
  quarter: number;
  developers: (number | null)[];
  organizations: (number | null)[];
  repositories: (number | null)[];
  pushes: (number | null)[];
  /** 每年（地圖那一季）前幾名：[名稱, 推送到這種版本庫的開發者人數] */
  languages: Record<string, [string, number][]>;
  /** 那一季所有公布的程式語言人數加總（一個人用好幾種語言會重複計算） */
  languageTotal: Record<string, number>;
  licenses: Record<string, [string, number][]>;
  licenseTotal: Record<string, number>;
}

type Metric = 'developers' | 'organizations' | 'repositories' | 'pushes';
const METRICS: Metric[] = ['developers', 'organizations', 'repositories', 'pushes'];
/** 列出的協作對象數；流向檔每個經濟體存前 15 名 */
const SHOWN = 8;
/**
 * 程式語言、授權條款的人數加總不到這個數時不寫占比：GitHub 不公布不到 100 人的語言，
 * 開發者少的地方被拿掉的語言比例高，占比會明顯偏高（用美國的分布縮小模擬，2 萬時大語言約高估一成多）
 */
const SHARE_MIN = 20_000;

const TEXT = defineMessages({
  zh: {
    chartTitle: '每一季的開發者與推送',
    chartAria: (country: string) => `${country}每一季的開發者帳號數與 git 推送次數`,
    devSeries: '開發者帳號（季底）',
    pushSeries: '推送次數（這一季）',
    quarter: (y: number, q: number) => `${y} 年第 ${q} 季`,
    chartNote: '地圖每年只取第 1 季；開發者是季底的帳號數，含已經不活躍的帳號。',
    tableTitle: (when: string) => `${when}的 GitHub 活動`,
    tableAria: (country: string, when: string) => `${country}${when}的開發者、組織、公開版本庫與推送次數，跟全世界對照`,
    colItem: '項目',
    colHere: '這裡',
    colWorld: '全世界',
    colShare: '占全世界',
    developers: '開發者帳號',
    organizations: '組織',
    repositories: '公開版本庫',
    pushes: '推送次數',
    tableNote: '組織是公司、學校、社群等在 GitHub 上的群組，依成員所在地的眾數歸到經濟體；版本庫含已經不維護的。全世界是各經濟體相加（不到 100 人的不公布，所以是下限）。',
    langTitle: '最多人用的程式語言',
    langAria: (country: string) => `${country}最多人用的程式語言`,
    licenseTitle: '最多人用的授權條款',
    licenseAria: (country: string) => `${country}最多人用的授權條款`,
    people: (n: string) => `${n} 人`,
    langNote: (when: string) =>
      `${when}推送到有這種語言的版本庫的開發者人數（依 GitHub Linguist 的分類，不含 HTML、CSS 等標記語言）。占比是各程式語言人數的加總裡占多少：一個人用好幾種語言、一個版本庫有好幾種語言時會重複計算。`,
    licenseNote: (when: string) =>
      `${when}推送到用這種授權條款的版本庫的開發者人數，只算有授權檔的版本庫。「其他或無法辨識」是找到授權檔但認不出來，或有好幾種授權。`,
    noShare: (min: string) => `人數加總不到 ${min}，不寫占比（GitHub 不公布不到 100 人的項目，人少的地方占比會偏高）。`,
    noassertion: '其他或無法辨識',
    none: '沒有公布的資料（一季不到 100 人的項目不公布）。',
    collabTitle: '跨經濟體協作',
    collabTotal: (when: string, total: string) => `${when} · 合計 ${total}`,
    contributions: (n: string) => `${n} 次`,
    collabNone: '沒有公布的協作（一季少於 100 位開發者參與的組合不公布）。',
    rest: (total: string, share: string) => `其他經濟體合計 ${total}（${share}）。`,
    collabNote: '推送次數加上開的 PR 數。版本庫的所在地是有管理權限成員的所在地眾數，香港、新加坡、美國可能含經由 VPN 連線的開發者。',
    listAria: (country: string, title: string) => `${country}${title}`,
  },
  en: {
    chartTitle: 'Developers and pushes by quarter',
    chartAria: (country) => `Developer accounts and git pushes in ${country} by quarter`,
    devSeries: 'Developer accounts (end of quarter)',
    pushSeries: 'Pushes (during quarter)',
    quarter: (y, q) => `Q${q} ${y}`,
    chartNote: 'The map uses Q1 of each year only. Developers are accounts at the end of the quarter, including inactive ones.',
    tableTitle: (when) => `GitHub activity, ${when}`,
    tableAria: (country, when) => `Developers, organizations, public repositories and pushes in ${country}, ${when}, compared with the world`,
    colItem: 'Measure',
    colHere: 'Here',
    colWorld: 'World',
    colShare: 'Share',
    developers: 'Developer accounts',
    organizations: 'Organizations',
    repositories: 'Public repositories',
    pushes: 'Pushes',
    tableNote:
      'Organizations are GitHub groups of companies, schools, communities and so on, assigned to the most common location of their members; repositories include unmaintained ones. The world is the sum of economies (those under 100 are not published, so it is a lower bound).',
    langTitle: 'Most used programming languages',
    langAria: (country) => `Most used programming languages in ${country}`,
    licenseTitle: 'Most used licences',
    licenseAria: (country) => `Most used licences in ${country}`,
    people: (n) => `${n} developers`,
    langNote: (when) =>
      `Developers who pushed to a repository containing the language in ${when} (GitHub Linguist's classification, excluding markup such as HTML and CSS). The share is of the sum across programming languages, so a person using several languages, or a repository with several, counts more than once.`,
    licenseNote: (when) =>
      `Developers who pushed to a repository under the licence in ${when}; only repositories with a licence file count. “Other or unidentified” means a licence file that could not be identified, or several licences.`,
    noShare: (min) => `The sum is under ${min}, so no shares are shown (GitHub does not publish items under 100 developers, which inflates shares where there are few).`,
    noassertion: 'Other or unidentified',
    none: 'Nothing published (items under 100 developers in a quarter are not published).',
    collabTitle: 'Collaboration across economies',
    collabTotal: (when, total) => `${when} · Total ${total}`,
    contributions: (n) => `${n} contributions`,
    collabNone: 'No collaboration published (pairs with fewer than 100 developers in a quarter are not published).',
    rest: (total, share) => `Other economies: ${total} (${share}).`,
    collabNote:
      "Pushes plus pull requests opened. A repository's location is the most common location of its members with triage access or above; Hong Kong, Singapore and the US may include developers connecting through VPNs.",
    listAria: (country, title) => `${title}: ${country}`,
  },
});

/** 第 i 季是哪一年的第幾季 */
function quarterAt(first: [number, number], i: number): [number, number] {
  const n = first[0] * 4 + (first[1] - 1) + i;
  return [Math.floor(n / 4), (n % 4) + 1];
}

function quarterlyOption(
  data: DevFile,
  selected: number,
  lines: { name: string; values: (number | null)[]; color: string }[],
  label: (y: number, q: number) => string,
): ChartSpec {
  const quarters = data.developers.map((_, i) => quarterAt(data.first, i));
  return {
    x: {
      type: 'category',
      labels: quarters.map(([y]) => String(y)),
      // 只在第 1 季寫年份，隔一年寫一次
      showLabel: (i) => quarters[i][1] === 1 && quarters[i][0] % 2 === 0,
    },
    y: { format: formatLargeTick },
    series: lines.map((line) => ({ type: 'line', name: line.name, values: line.values, color: line.color })),
    refs: [{ x: selected }],
    tooltip: (i) => {
      const rows = lines.flatMap((l) => (l.values[i] == null ? [] : [{ color: l.color, value: formatLargeNumber(l.values[i]!), name: l.name }]));
      return rows.length ? { head: label(...quarters[i]), rows } : null;
    },
  };
}

export default function DevelopersPanel({ topic, iso3, year, countryName, tokens, indicator }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const base = `topics/${topic.id}`;
  const own = useJson<DevFile>(`${base}/countries/${iso3}.json`);
  const world = useJson<DevFile>(`${base}/world.json`).data;
  const countries = useJson<CountryTable>('countries.json').data;
  const data = own.data;

  // 時間軸的年份 → 那一年地圖用的那一季；超出資料範圍時取最接近的
  const view = useMemo(() => {
    if (!data || !world) return null;
    const n = data.developers.length;
    const firstYear = data.first[0] + (data.quarter >= data.first[1] ? 0 : 1);
    const lastYear = quarterAt(data.first, n - 1)[0] - (quarterAt(data.first, n - 1)[1] >= data.quarter ? 0 : 1);
    const y = Math.min(Math.max(year, firstYear), lastYear);
    const index = (y - data.first[0]) * 4 + (data.quarter - data.first[1]);
    const option = quarterlyOption(
      data,
      index,
      [
        { name: text.devSeries, values: data.developers, color: tokens.hues.blue },
        { name: text.pushSeries, values: data.pushes, color: tokens.hues.orange },
      ],
      text.quarter,
    );
    return { y, index, option };
  }, [data, world, year, tokens, text]);

  const flowYear = view?.y ?? null;
  const flows = useJson<FlowFile>(flowYear ? `${base}/flows/${flowYear}.json` : null).data;

  if (own.loading) return <p className="empty">{t.loading}</p>;
  if (!data || !world || !view) return own.error ? <p className="note">{t.noData}</p> : null;

  const { y, index } = view;
  const when = indicator.timeAxis?.year(y) ?? String(y);
  const fmt = (v: number | null | undefined) => (v == null ? '—' : formatLargeNumber(v));
  const minShare = formatLargeNumber(SHARE_MIN);
  // 清單裡的人數、次數寫完整的數字：「5 萬」「4 萬」看不出 45,359 跟 41,966 只差一點
  const people = (v: number) => text.people(fixed(v, 0));

  const ranking = (
    title: string,
    items: [string, number][] | undefined,
    total: number | undefined,
    aria: string,
    note: string,
    label: (key: string) => string,
  ) => (
    <section className="panel-section">
      <h3>{title}</h3>
      {items?.length ? (
        <>
          <BarList
            items={items.map(([key, value]) => ({ key, label: label(key), value }))}
            total={total !== undefined && total >= SHARE_MIN ? total : undefined}
            format={people}
            ariaLabel={aria}
            properNouns
          />
          {total !== undefined && total < SHARE_MIN && <p className="note">{text.noShare(minShare)}</p>}
          <p className="note">{note}</p>
        </>
      ) : (
        <p className="empty">{text.none}</p>
      )}
    </section>
  );

  const collabLayer = (id: string) => topic.indicators.find((i) => i.id === id)?.layer;
  const contributions = (v: number) => text.contributions(fixed(v, 0));
  const collab = (direction: FlowDirection, layerId: string) => {
    const title = flowText(collabLayer(layerId), lang)[direction].main;
    if (!flows || flows.year !== y) return <p key={direction} className="empty">{t.loading}</p>;
    const sel = flowSelection(flows, iso3, direction);
    if (sel.links.length === 0) {
      return (
        <div key={direction} className="panel-subsection">
          <h4>{title}</h4>
          <p className="empty">{text.collabNone}</p>
        </div>
      );
    }
    const shown = sel.links.slice(0, SHOWN);
    const rest = sel.total - shown.reduce((sum, l) => sum + l.value, 0);
    return (
      <div key={direction} className="panel-subsection">
        <h4>{title}</h4>
        <p className="panel-year-note">{text.collabTotal(when, contributions(sel.total))}</p>
        <BarList
          items={shown.map((l) => ({ key: l.iso3, label: nameOf(l.iso3, countries, lang), value: l.value }))}
          total={sel.total}
          format={contributions}
          ariaLabel={text.listAria(countryName, title)}
        />
        {rest > 0 && <p className="note">{text.rest(contributions(rest), formatPercent((rest / sel.total) * 100, 1))}</p>}
      </div>
    );
  };

  return (
    <>
      <section className="panel-section">
        <h3>{text.chartTitle}</h3>
        <Chart spec={view.option} height={210} ariaLabel={text.chartAria(countryName)} />
        <p className="note">{text.chartNote}</p>
      </section>
      <section className="panel-section">
        <h3>{text.tableTitle(when)}</h3>
        <table className="mini-table dev-table" aria-label={text.tableAria(countryName, when)}>
          <thead>
            <tr>
              <th scope="col">{text.colItem}</th>
              <th scope="col" className="num">
                {text.colHere}
              </th>
              <th scope="col" className="num">
                {text.colWorld}
              </th>
              <th scope="col" className="num">
                {text.colShare}
              </th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const here = data[m][index];
              const all = world[m][index];
              return (
                <tr key={m}>
                  <th scope="row">{text[m]}</th>
                  <td className="num">{fmt(here)}</td>
                  <td className="num">{fmt(all)}</td>
                  <td className="num">{here != null && all ? formatPercent((here / all) * 100, here / all < 0.1 ? 2 : 1) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="note">{text.tableNote}</p>
      </section>
      {ranking(
        text.langTitle,
        data.languages[String(y)],
        data.languageTotal[String(y)],
        text.langAria(countryName),
        text.langNote(when),
        (k) => k,
      )}
      {ranking(
        text.licenseTitle,
        data.licenses[String(y)],
        data.licenseTotal[String(y)],
        text.licenseAria(countryName),
        text.licenseNote(when),
        (k) => (k === 'NOASSERTION' ? text.noassertion : k),
      )}
      <section className="panel-section">
        <h3>{text.collabTitle}</h3>
        {collab('export', 'collab-out')}
        {collab('import', 'collab-in')}
        <p className="note">{text.collabNote}</p>
      </section>
    </>
  );
}

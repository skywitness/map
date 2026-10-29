import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { Chart } from '../../charts/Chart';
import { latestIndexAtOrBefore, stackedAreaOption } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Lang } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed, formatLargeTick } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import { VIOLENCE_TYPES, intensityLabel } from '../conflict';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 武裝衝突的側欄：三類組織性暴力的死亡人數（堆疊面積圖＋當年的長條），
 * 以及所在國是這裡的以國家為一方的武裝衝突（UCDP/PRIO ACD，名稱照 UCDP 的英文原文）。
 */

/** pipeline/topics/conflict.py 的 conflicts.json：每國每個衝突一列 */
type ConflictRow = [
  id: number,
  name: string,
  type: number,
  incompatibility: number,
  sideA: string,
  sideB: string,
  territory: string,
  years: [number, number][],
];
interface ConflictsFile {
  fields: string[];
  countries: Record<string, ConflictRow[]>;
}

/** 三類的死亡人數檔（跟 conflict.ts 的指標同一個檔），順序跟 VIOLENCE_TYPES 一樣 */
const TYPE_FILES = ['battle-deaths', 'non-state-deaths', 'one-sided-deaths'];
/** 圖表用介面的類別色（深淺色模式都驗證過），色相跟地圖上的點一致：紅、琥珀、紫 */
const TYPE_HUES: Hue[] = ['red', 'yellow', 'violet'];
/** 衝突清單先列幾個，其餘收在「顯示其餘」 */
const SHOWN = 6;

const n0 = (v: number) => fixed(v, 0);

const TEXT = defineMessages({
  zh: {
    deathsTitle: '組織性暴力的死亡人數',
    chartAria: (country: string) => `${country}歷年三類組織性暴力的死亡人數堆疊面積圖`,
    byType: (year: number) => `${year} 年各類的死亡人數`,
    listAria: (country: string, year: number) => `${country}${year} 年各類組織性暴力的死亡人數`,
    noDeaths: '1989–2025 年 UCDP GED 沒有記錄這裡的組織性暴力死亡。',
    beforeGed: '死亡人數從 1989 年開始（UCDP GED）。',
    deaths: (n: number) => `${n0(n)} 人`,
    conflictsTitle: (year: number) => `${year} 年的以國家為一方的武裝衝突`,
    noConflicts: (year: number) => `${year} 年 UCDP 沒有記錄所在國是這裡的以國家為一方的武裝衝突。`,
    historyTitle: (n: number) => `1946 年起所在國是這裡的衝突（${n} 個）`,
    noHistory: '1946–2025 年 UCDP 沒有記錄所在國是這裡的以國家為一方的武裝衝突。',
    more: (n: number) => `顯示其餘 ${n} 個`,
    years: (spans: string) => `${spans} 年`,
    wars: (spans: string) => `戰爭：${spans}`,
    sides: '雙方',
    note: '衝突名稱與雙方照 UCDP 的英文原文；所在國是 UCDP 定義的「被挑戰的國家」，爭議領土在今天另成一國的也算進來，不一定是戰鬥發生的地方。死亡人數是 UCDP 的最佳估計，偏保守。',
  },
  en: {
    deathsTitle: 'Deaths from organized violence',
    chartAria: (country) => `Stacked area chart of deaths from the three types of organized violence in ${country} over time`,
    byType: (year) => `Deaths by type, ${year}`,
    listAria: (country, year) => `Deaths from organized violence by type in ${country}, ${year}`,
    noDeaths: 'UCDP GED records no deaths from organized violence here in 1989–2025.',
    beforeGed: 'Death counts start in 1989 (UCDP GED).',
    deaths: (n) => `${n0(n)}`,
    conflictsTitle: (year) => `State-based armed conflicts, ${year}`,
    noConflicts: (year) => `UCDP records no state-based armed conflict located here in ${year}.`,
    historyTitle: (n) => `Conflicts located here since 1946 (${n})`,
    noHistory: 'UCDP records no state-based armed conflict located here in 1946–2025.',
    more: (n) => `Show ${n} more`,
    years: (spans) => spans,
    wars: (spans) => `war: ${spans}`,
    sides: 'Parties',
    note: "Conflict and party names are UCDP's original English. The location is the state being challenged, as UCDP defines it, plus conflicts over territory that is a separate country today; it is not necessarily where the fighting took place. Deaths are UCDP best estimates and are conservative.",
  },
});

/** ACD 的衝突類型與爭議 */
const CONFLICT_TYPES: Record<number, { zh: string; en: string }> = {
  1: { zh: '殖民地外的衝突', en: 'Extrasystemic' },
  2: { zh: '國家間衝突', en: 'Interstate' },
  3: { zh: '國內衝突', en: 'Intrastate' },
  4: { zh: '有外國介入的國內衝突', en: 'Internationalized intrastate' },
};
const INTENSITY_SHORT: Record<number, { zh: string; en: string }> = {
  1: { zh: '小型衝突', en: 'Minor' },
  2: { zh: '戰爭', en: 'War' },
};
const INCOMPATIBILITY: Record<number, { zh: string; en: string }> = {
  1: { zh: '爭議：領土', en: 'over territory' },
  2: { zh: '爭議：政府', en: 'over government' },
  3: { zh: '爭議：政府與領土', en: 'over government and territory' },
};

/** [1949, 1950, 1954] →「1949–1950、1954」 */
function spans(years: number[], separator: string): string {
  const out: [number, number][] = [];
  for (const y of [...years].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && y === last[1] + 1) last[1] = y;
    else out.push([y, y]);
  }
  return out.map(([a, b]) => (a === b ? String(a) : `${a}–${b}`)).join(separator);
}

export default function ConflictPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useMemo(() => TYPE_FILES.map((f) => `topics/${topic.id}/${f}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(files);
  const { data: conflicts, error } = useJson<ConflictsFile>(`topics/${topic.id}/conflicts.json`);
  const separator = tr({ zh: '、', en: ', ' }, lang);

  const deaths = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const years = loaded[0]!.years;
    const own = loaded.map((d) => d!.values[iso3] ?? years.map(() => null));
    const any = own.some((s) => s.some((v) => (v ?? 0) > 0));
    const series = VIOLENCE_TYPES.map((type, i) => ({ name: tr(type.label, lang), values: own[i], color: tokens.hues[TYPE_HUES[i]] }));
    const option = any
      ? stackedAreaOption({
          years,
          series,
          year: Math.min(Math.max(year, years[0]), years[years.length - 1]),
          format: (v) => tr({ zh: `${n0(v)} 人`, en: n0(v) }, lang),
          formatTick: formatLargeTick,
          tokens,
        })
      : null;
    // 時間軸在 1989 年以前（衝突數的指標從 1946 年開始）：不畫目前年份的直線，免得看起來像 1989 年
    if (option && year < years[0]) option.refs = [];
    const index = year < years[0] ? -1 : latestIndexAtOrBefore(years, year, () => true);
    const items =
      index >= 0
        ? VIOLENCE_TYPES.map((type, i) => ({
            key: type.id,
            label: tr(type.label, lang),
            value: own[i][index] ?? 0,
            color: tokens.hues[TYPE_HUES[i]],
          }))
        : [];
    return { option, any, items, shownYear: index >= 0 ? years[index] : null, first: years[0] };
  }, [loaded, iso3, year, tokens, lang]);

  const list = useMemo(() => {
    if (!conflicts) return null;
    const rows = conflicts.countries[iso3] ?? [];
    const active = rows
      .map((row) => ({ row, intensity: row[7].find(([y]) => y === year)?.[1] }))
      .filter((r): r is { row: ConflictRow; intensity: number } => r.intensity !== undefined)
      .sort((a, b) => b.intensity - a.intensity || a.row[1].localeCompare(b.row[1]));
    return { rows, active };
  }, [conflicts, iso3, year]);

  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!deaths || !list) return <p className="empty">{t.loading}</p>;

  const total = deaths.items.reduce((sum, i) => sum + i.value, 0);

  return (
    <section className="panel-section">
      <h3>{text.deathsTitle}</h3>
      {deaths.any && deaths.option ? (
        <>
          <Chart spec={deaths.option} height={220} ariaLabel={text.chartAria(countryName)} />
          {deaths.shownYear !== null ? (
            <>
              <h4>{text.byType(deaths.shownYear)}</h4>
              <BarList
                items={deaths.items}
                format={text.deaths}
                total={total}
                ariaLabel={text.listAria(countryName, deaths.shownYear)}
              />
            </>
          ) : (
            <p className="note">{text.beforeGed}</p>
          )}
        </>
      ) : (
        <p className="empty">{text.noDeaths}</p>
      )}

      <h3>{text.conflictsTitle(year)}</h3>
      {list.active.length > 0 ? (
        <ul className="plain-list">
          {list.active.map(({ row, intensity }) => (
            <li key={row[0]}>
              <span className="plain-title" translate="no">
                {row[1]}
              </span>
              <span className="plain-meta">{conflictMeta(row, lang, intensity)}</span>
              <span className="plain-meta" translate="no">
                {row[4]} – {row[5]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">{text.noConflicts(year)}</p>
      )}

      {list.rows.length > 0 ? (
        <>
          <h3>{text.historyTitle(list.rows.length)}</h3>
          <ConflictHistory rows={list.rows} separator={separator} text={text} lang={lang} />
        </>
      ) : (
        <p className="empty">{text.noHistory}</p>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}

/** 衝突的類型與爭議（有給強度的話放最前面）：「戰爭 · 國家間衝突 · 爭議：領土」 */
function conflictMeta(row: ConflictRow, lang: Lang, intensity?: number): string {
  return [
    intensity !== undefined ? tr(INTENSITY_SHORT[intensity] ?? intensityLabel(intensity), lang) : null,
    tr(CONFLICT_TYPES[row[2]] ?? String(row[2]), lang),
    tr(INCOMPATIBILITY[row[3]] ?? '', lang),
  ]
    .filter(Boolean)
    .join(' · ');
}

function ConflictHistory({
  rows,
  separator,
  text,
  lang,
}: {
  rows: ConflictRow[];
  separator: string;
  text: (typeof TEXT)['zh'];
  lang: Lang;
}) {
  const item = (row: ConflictRow) => {
    const all = row[7].map(([y]) => y);
    const wars = row[7].filter(([, i]) => i === 2).map(([y]) => y);
    return (
      <li key={row[0]}>
        <span className="plain-title" translate="no">
          {row[1]}
        </span>
        <span className="plain-meta">{conflictMeta(row, lang)}</span>
        <span className="plain-meta">
          {[text.years(spans(all, separator)), wars.length ? text.wars(spans(wars, separator)) : null].filter(Boolean).join(' · ')}
        </span>
        <span className="plain-meta" translate="no">
          {row[4]} – {row[5]}
        </span>
      </li>
    );
  };
  return (
    <>
      <ul className="plain-list">{rows.slice(0, SHOWN).map(item)}</ul>
      {rows.length > SHOWN && (
        <details>
          <summary className="note">{text.more(rows.length - SHOWN)}</summary>
          <ul className="plain-list">{rows.slice(SHOWN).map(item)}</ul>
        </details>
      )}
    </>
  );
}

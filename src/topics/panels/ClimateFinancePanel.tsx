import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { formatLargeNumber } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 氣候資金的側欄（2026-11-07，第二十五批 481）：這一國的綠色氣候基金計畫（核定年、這一國分到的金額、用途、狀態），
 * 依核定年由新到舊；資料是 pipeline/topics/climate_finance.py 輸出的 country-projects.json。
 * 條款要求轉載附「First published by the Green Climate Fund」與可以點的 https://greenclimate.fund 連結
 */
type Row = [string, string, number, number, string, string, number];
interface ProjectsFile {
  fields: string[];
  countries: Record<string, Row[]>;
}

const SHOWN = 30;

const TEXT = defineMessages({
  zh: {
    title: (n: number) => `綠色氣候基金的計畫（${n} 件）`,
    themes: { adaptation: '調適', mitigation: '減緩', crosscutting: '跨領域' } as Record<string, string>,
    status: {
      implementing: '執行中',
      approved: '已核定、還沒開始',
      completed: '已完成',
      lapsed: '已失效',
      discontinued: '已中止',
    } as Record<string, string>,
    amount: (v: string) => `${v} 美元`,
    multi: (n: number) => `（${n} 國的計畫，這是這一國分到的部分）`,
    more: (n: number) => `另外還有 ${n} 件。`,
    none: '這個國家沒有綠色氣候基金的計畫。',
    credit: 'First published by the Green Climate Fund',
    nc: '只准非商業使用。',
  },
  en: {
    title: (n: number) => `Green Climate Fund projects (${n})`,
    themes: { adaptation: 'Adaptation', mitigation: 'Mitigation', crosscutting: 'Cross-cutting' } as Record<string, string>,
    status: {
      implementing: 'Under implementation',
      approved: 'Approved, not started',
      completed: 'Completed',
      lapsed: 'Lapsed',
      discontinued: 'Discontinued',
    } as Record<string, string>,
    amount: (v: string) => `US$${v}`,
    multi: (n: number) => ` (${n}-country project; this country’s share)`,
    more: (n: number) => `${n} more not shown.`,
    none: 'No Green Climate Fund projects in this country.',
    credit: 'First published by the Green Climate Fund',
    nc: 'Non-commercial use only.',
  },
});

export default function ClimateFinancePanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const data = useJson<ProjectsFile>(`topics/${topic.id}/country-projects.json`).data;
  if (!data) return <p className="empty">{t.loading}</p>;
  const rows = data.countries[iso3] ?? [];
  return (
    <section className="panel-section">
      {rows.length ? (
        <>
          <h3>{text.title(rows.length)}</h3>
          <ul className="note">
            {rows.slice(0, SHOWN).map(([ref, name, year, gcf, theme, status, n]) => (
              <li key={ref}>
                <a href={`https://www.greenclimate.fund/project/${ref}`} target="_blank" rel="noopener noreferrer">
                  {ref}
                </a>{' '}
                {name} · {year} · {text.amount(formatLargeNumber(gcf))}
                {n > 1 ? text.multi(n) : ''} · {text.themes[theme] ?? theme} · {text.status[status] ?? status}
              </li>
            ))}
          </ul>
          {rows.length > SHOWN && <p className="note">{text.more(rows.length - SHOWN)}</p>}
        </>
      ) : (
        <p className="empty">{text.none}</p>
      )}
      <p className="note">
        <a href="https://greenclimate.fund" target="_blank" rel="noopener noreferrer">
          {text.credit}
        </a>
        {' · '}
        {text.nc}
      </p>
    </section>
  );
}

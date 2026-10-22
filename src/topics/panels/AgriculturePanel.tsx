import { BarList } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { formatLargeNumber, intlDollars, usd } from '../../lib/format';
import type { PanelExtraProps } from '../types';

interface YearTop {
  total: number;
  /** [品項代碼, 數值]，由大到小 */
  top: [number, number][];
}

interface AgricultureFile {
  production: Record<string, YearTop>;
  exports: Record<string, YearTop>;
  imports: Record<string, YearTop>;
}

const TEXT = defineMessages({
  zh: {
    production: '主要農產品（依產值）',
    productionNote: '2014–2016 年固定價格。右側為占農業總產值比重。',
    exports: '主要出口農產品',
    exportsNote: '右側為占農產品出口總額比重。',
    imports: '主要進口農產品',
    importsNote: '右側為占農產品進口總額比重。',
    total: (year: number, total: string) => `${year} 年 · 合計 ${total}`,
    noCountry: '沒有這個國家的農業資料。',
  },
  en: {
    production: 'Main products (by value)',
    productionNote: 'Constant 2014–2016 prices. The right column is the share of gross agricultural production value.',
    exports: 'Main agricultural exports',
    exportsNote: 'The right column is the share of total agricultural exports.',
    imports: 'Main agricultural imports',
    importsNote: 'The right column is the share of total agricultural imports.',
    total: (year, total) => `${year} · Total ${total}`,
    noCountry: 'No agricultural data for this country.',
  },
});

const SECTIONS = [
  { key: 'production', note: 'productionNote', format: intlDollars },
  { key: 'exports', note: 'exportsNote', format: usd },
  { key: 'imports', note: 'importsNote', format: usd },
] as const;

const SHOWN = 8;

/** 品項名稱：pipeline 從 FAOSTAT 產生，中文 items.json、英文 items.en.json */
const ITEM_FILES = { zh: 'items.json', en: 'items.en.json' };

export default function AgriculturePanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<AgricultureFile>(`topics/${topic.id}/countries/${iso3}.json`);
  const names = useJson<Record<string, string>>(`topics/${topic.id}/${ITEM_FILES[lang]}`);
  if (error) return <p className="empty">{text.noCountry}</p>;
  // 切換語言時，新語言的品項名稱到之前先顯示載入中，不混用兩種語言
  if (!data || !names.data || names.loading) return <p className="empty">{t.loading}</p>;

  return (
    <section className="panel-section">
      {SECTIONS.map(({ key, note, format: currency }) => {
        const byYear = data[key];
        const shownYear = latestYear(byYear, year);
        if (shownYear === null) return null;
        const entry = byYear[shownYear];
        const format = (v: number) => currency(formatLargeNumber(v));
        const title = text[key];
        return (
          <div key={key} className="panel-subsection">
            <h3>{title}</h3>
            <p className="panel-year-note">
              {text.total(shownYear, format(entry.total))}
              {shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
            </p>
            <BarList
              items={entry.top.slice(0, SHOWN).map(([code, value]) => ({
                key: String(code),
                label: names.data![code] ?? String(code),
                value,
              }))}
              total={entry.total}
              format={format}
              ariaLabel={`${countryName} · ${title}`}
            />
            <p className="note">{text[note]}</p>
          </div>
        );
      })}
    </section>
  );
}

function latestYear(byYear: Record<string, YearTop>, year: number): number | null {
  const years = Object.keys(byYear).map(Number).filter((y) => y <= year);
  return years.length ? Math.max(...years) : null;
}

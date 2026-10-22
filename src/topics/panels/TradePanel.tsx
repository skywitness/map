import { BarList } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { formatLargeNumber, formatPercent, usd } from '../../lib/format';
import { flowSelection, flowText } from '../../map/flows';
import { flowPath, type FlowDirection, type FlowFile, type PanelExtraProps } from '../types';

/** 側欄列出的夥伴數；流向檔每個國家存前 15 名 */
const SHOWN = 10;

const TEXT = defineMessages({
  zh: {
    noYear: '沒有這一年的貿易資料。',
    noData: (year: number) => `沒有 ${year} 年的資料。`,
    total: (year: number, total: string) => `${year} 年 · 合計 ${total}`,
    rest: (total: string, share: string, direction: FlowDirection) =>
      `其他夥伴合計 ${total}（${share}）。右側為占${direction === 'export' ? '出口' : '進口'}總額比重。`,
    listAria: (country: string, title: string) => `${country}${title}`,
  },
  en: {
    noYear: 'No trade data for this year.',
    noData: (year) => `No data for ${year}.`,
    total: (year, total) => `${year} · Total ${total}`,
    rest: (total, share, direction) =>
      `Other partners: ${total} (${share}). The right column is the share of total ${direction === 'export' ? 'exports' : 'imports'}.`,
    listAria: (country, title) => `${title} of ${country}`,
  },
});

/** 主要出口對象與進口來源：長條直接寫出金額與占比 */
export default function TradePanel({ topic, iso3, year, item, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const indicator = topic.indicators.find((i) => i.layer.kind === 'flow');
  const path = indicator ? flowPath(topic, indicator, item, year) : null;
  const { data, error } = useJson<FlowFile>(path);
  const countries = useJson<CountryTable>('countries.json').data;
  if (error) return <p className="empty">{text.noYear}</p>;
  if (!data || data.year !== year || (item !== null && data.item !== item)) return <p className="empty">{t.loading}</p>;

  const format = (v: number) => usd(formatLargeNumber(v));
  return (
    <section className="panel-section">
      {(['export', 'import'] as FlowDirection[]).map((direction) => {
        const flows = flowSelection(data, iso3, direction);
        const title = flowText(lang)[direction].main;
        if (flows.links.length === 0) {
          return (
            <div key={direction} className="panel-subsection">
              <h3>{title}</h3>
              <p className="empty">{text.noData(year)}</p>
            </div>
          );
        }
        const shown = flows.links.slice(0, SHOWN);
        const rest = flows.total - shown.reduce((sum, l) => sum + l.value, 0);
        return (
          <div key={direction} className="panel-subsection">
            <h3>{title}</h3>
            <p className="panel-year-note">{text.total(year, format(flows.total))}</p>
            <BarList
              items={shown.map((l) => ({
                key: l.iso3,
                label: nameOf(l.iso3, countries, lang),
                value: l.value,
              }))}
              total={flows.total}
              format={format}
              ariaLabel={text.listAria(countryName, title)}
            />
            {rest > 0 && (
              <p className="note">{text.rest(format(rest), formatPercent((rest / flows.total) * 100, 1), direction)}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}

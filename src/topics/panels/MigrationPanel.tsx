import { BarList } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { formatLargeNumber, formatPercent } from '../../lib/format';
import { flowSelection, flowText } from '../../map/flows';
import type { FlowDirection, FlowFile, IndicatorData, PanelExtraProps } from '../types';

/** 每一份清單列出的國家數；流向檔每個國家存前 15 名 */
const SHOWN = 8;

const TEXT = defineMessages({
  zh: {
    migrants: '移民',
    refugees: '難民',
    people: (n: string) => `${n} 人`,
    total: (year: number, total: string) => `${year} 年 · 合計 ${total}`,
    nearest: (year: number) => `（沒有這一年的資料，顯示 ${year} 年）`,
    none: '沒有資料。',
    rest: (total: string, share: string) => `其他國家合計 ${total}（${share}）。`,
    listAria: (country: string, title: string) => `${country}${title}`,
  },
  en: {
    migrants: 'Migrants',
    refugees: 'Refugees',
    people: (n) => `${n} people`,
    total: (year, total) => `${year} · Total ${total}`,
    nearest: (year) => ` (no data for this year; showing ${year})`,
    none: 'No data.',
    rest: (total, share) => `Other countries: ${total} (${share}).`,
    listAria: (country, title) => `${title}: ${country}`,
  },
});

/** 資料裡不晚於 year 的最近一年；year 比第一年還早時用第一年 */
function yearAtOrBefore(years: number[] | undefined, year: number): number | null {
  if (!years?.length) return null;
  return [...years].reverse().find((y) => y <= year) ?? years[0];
}

/** 移民的來源與去向、難民的來源與去向：長條直接寫出人數與占比 */
export default function MigrationPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const countries = useJson<CountryTable>('countries.json').data;
  // 移民每 5 年一筆、難民每年都有，各自找最接近的一年
  const migrantYears = useJson<IndicatorData>(`topics/${topic.id}/immigrants.json`).data?.years;
  const refugeeYears = useJson<IndicatorData>(`topics/${topic.id}/refugees-hosted.json`).data?.years;
  const migrantYear = yearAtOrBefore(migrantYears, year);
  const refugeeYear = yearAtOrBefore(refugeeYears, year);
  const migrants = useJson<FlowFile>(migrantYear ? `topics/${topic.id}/flows/migrants/${migrantYear}.json` : null).data;
  const refugees = useJson<FlowFile>(refugeeYear ? `topics/${topic.id}/flows/refugees/${refugeeYear}.json` : null).data;
  const layerOf = (id: string) => topic.indicators.find((i) => i.id === id)?.layer;

  const format = (v: number) => text.people(formatLargeNumber(v));
  const section = (heading: string, file: FlowFile | null | undefined, wanted: number | null, layerId: string) => {
    if (!file || file.year !== wanted) return <p className="empty">{t.loading}</p>;
    const labels = flowText(layerOf(layerId), lang);
    return (['import', 'export'] as FlowDirection[]).map((direction) => {
      const flows = flowSelection(file, iso3, direction);
      const title = labels[direction].main;
      if (flows.links.length === 0) {
        return (
          <div key={`${heading}-${direction}`} className="panel-subsection">
            <h3>{title}</h3>
            <p className="empty">{text.none}</p>
          </div>
        );
      }
      const shown = flows.links.slice(0, SHOWN);
      const rest = flows.total - shown.reduce((sum, l) => sum + l.value, 0);
      return (
        <div key={`${heading}-${direction}`} className="panel-subsection">
          <h3>{title}</h3>
          <p className="panel-year-note">
            {text.total(file.year, format(flows.total))}
            {file.year !== year && text.nearest(file.year)}
          </p>
          <BarList
            items={shown.map((l) => ({ key: l.iso3, label: nameOf(l.iso3, countries, lang), value: l.value }))}
            total={flows.total}
            format={format}
            ariaLabel={text.listAria(countryName, title)}
          />
          {rest > 0.5 && <p className="note">{text.rest(format(rest), formatPercent((rest / flows.total) * 100, 1))}</p>}
        </div>
      );
    });
  };

  return (
    <section className="panel-section">
      {section(text.migrants, migrants, migrantYear, 'origins')}
      {section(text.refugees, refugees, refugeeYear, 'refugee-flows')}
    </section>
  );
}

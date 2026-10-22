import { BarList } from '../../charts/BarList';
import { zhName, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { formatLargeNumber, formatPercent } from '../../lib/format';
import { FLOW_TEXT, flowSelection } from '../../map/flows';
import { flowPath, type FlowDirection, type FlowFile, type PanelExtraProps } from '../types';

/** 側欄列出的夥伴數；流向檔每個國家存前 15 名 */
const SHOWN = 10;

/** 主要出口對象與進口來源：長條直接寫出金額與占比 */
export default function TradePanel({ topic, iso3, year, item, countryName }: PanelExtraProps) {
  const indicator = topic.indicators.find((i) => i.layer.kind === 'flow');
  const path = indicator ? flowPath(topic, indicator, item, year) : null;
  const { data, error } = useJson<FlowFile>(path);
  const countries = useJson<CountryTable>('countries.json').data;
  if (error) return <p className="empty">沒有這一年的貿易資料。</p>;
  if (!data || data.year !== year || (item !== null && data.item !== item)) return <p className="empty">載入中…</p>;

  const format = (v: number) => `${formatLargeNumber(v)} 美元`;
  return (
    <section className="panel-section">
      {(['export', 'import'] as FlowDirection[]).map((direction) => {
        const flows = flowSelection(data, iso3, direction);
        const title = `主要${FLOW_TEXT[direction].partners}`;
        if (flows.links.length === 0) {
          return (
            <div key={direction} className="panel-subsection">
              <h3>{title}</h3>
              <p className="empty">沒有 {year} 年的資料。</p>
            </div>
          );
        }
        const shown = flows.links.slice(0, SHOWN);
        const rest = flows.total - shown.reduce((sum, l) => sum + l.value, 0);
        return (
          <div key={direction} className="panel-subsection">
            <h3>{title}</h3>
            <p className="panel-year-note">
              {year} 年 · 合計 {format(flows.total)}
            </p>
            <BarList
              items={shown.map((l) => ({
                key: l.iso3,
                label: zhName(l.iso3, countries),
                value: l.value,
              }))}
              total={flows.total}
              format={format}
              ariaLabel={`${countryName}${title}`}
            />
            {rest > 0 && (
              <p className="note">
                其他夥伴合計 {format(rest)}（{formatPercent((rest / flows.total) * 100, 1)}）。右側為占{direction === 'export' ? '出口' : '進口'}總額比重。
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}

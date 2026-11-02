import { BarList } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { formatLargeNumber, formatPercent, usd } from '../../lib/format';
import { flowSelection, flowText } from '../../map/flows';
import { SERVICES_INDICATORS } from '../trade';
import { flowPath, itemFor, type FlowDirection, type FlowFile, type PanelExtraProps } from '../types';
import { TradeServices } from './TradeServices';

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

/**
 * 貿易主題的側欄：服務出口的指標先畫這一國服務出口組成的堆疊圖（2026-11-02，製作手冊第十七批 271），
 * 再列主要出口對象與進口來源（商品）
 */
export default function TradePanel(props: PanelExtraProps) {
  if (!SERVICES_INDICATORS.includes(props.indicator.id)) return <TradeFlows {...props} />;
  return (
    <>
      <section className="panel-section">
        <TradeServices topicId={props.topic.id} iso3={props.iso3} year={props.year} />
      </section>
      <TradeFlows {...props} />
    </>
  );
}

/** 主要出口對象與進口來源：長條直接寫出金額與占比 */
function TradeFlows({ topic, indicator: current, iso3, year, item, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  // 目前的指標是流向圖就用它（貿易的金額、公噸各一組），否則用主題的第一個流向圖（例如貿易依存度）
  const indicator = current.layer.kind === 'flow' ? current : topic.indicators.find((i) => i.layer.kind === 'flow');
  // 子項目換成流向圖指標自己的（服務出口的「服務類別」不是商品，沒有那個商品的流向檔，改用預設的全部商品）
  const flowItem = indicator ? itemFor(topic, indicator, item) : item;
  const path = indicator ? flowPath(topic, indicator, flowItem, year) : null;
  const { data, error } = useJson<FlowFile>(path);
  const countries = useJson<CountryTable>('countries.json').data;
  if (error) return <p className="empty">{text.noYear}</p>;
  // 檔名沒有 {item} 的流向圖（1962 年起的長期流向，只有全部商品）不看子項目，跟地圖的 flows.ts 一樣
  const usesItem = indicator?.layer.kind === 'flow' && indicator.layer.file.includes('{item}');
  if (!data || data.year !== year || (usesItem && flowItem !== null && data.item !== flowItem)) return <p className="empty">{t.loading}</p>;

  // 流向圖指標自己的格式（貿易、半導體是美元，石油、天然氣與煤是公噸）
  const format = (v: number) => (indicator ? indicator.format(v) : usd(formatLargeNumber(v)));
  return (
    <section className="panel-section">
      {(['export', 'import'] as FlowDirection[]).map((direction) => {
        const flows = flowSelection(data, iso3, direction);
        const title = flowText(indicator?.layer, lang)[direction].main;
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

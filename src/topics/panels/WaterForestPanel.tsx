import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 各國水資源與森林的側欄（2026-11-07，第二十五批 496）：只有台灣，台灣自來水公司的漏水率、售水率與水價
 * （pipeline/topics/water_tw_utility.py 輸出的 tw-water.json）。其他國家不畫
 */
interface TwWater {
  /** [西元年, 漏水率 %, 售水率 %] */
  leak: [number, number, number][];
  /** [西元年, 平均水價, 單位銷售成本, 單位銷售盈虧（元／立方公尺）, 給水投資報酬率 %] */
  price: [number, number, number, number, number][];
}

const LEAK_YEARS = [2004, 2008, 2012, 2016, 2020, 2022, 2023, 2024, 2025];

const TEXT = defineMessages({
  zh: {
    title: '台灣自來水公司的漏水率與水價',
    leakHead: ['年', '漏水率', '售水率'],
    priceHead: ['年', '平均水價', '單位成本', '每度盈虧'],
    unit: '水價與成本是元／立方公尺（度）。',
    note: '台水的漏水率分母是供水量，跟國際常用的無收益水量口徑不同；不含臺北市（臺北自來水事業處）。售水率是售水量÷供水量。2024 年的單位成本照原表（跟盈虧對不起來）。',
  },
  en: {
    title: 'Taiwan Water Corporation: leakage and water prices',
    leakHead: ['Year', 'Leakage', 'Billed share'],
    priceHead: ['Year', 'Avg. price', 'Unit cost', 'Profit per m³'],
    unit: 'Prices and costs are NT$ per cubic metre.',
    note: 'Leakage is measured against water supplied, which differs from the non-revenue water used internationally; Taipei City (served by its own utility) is not included. The billed share is water sold ÷ water supplied. The 2024 unit cost is as published (it does not match the reported loss).',
  },
});

export default function WaterForestPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<TwWater>(iso3 === 'TWN' ? `topics/${topic.id}/tw-water.json` : null);
  if (iso3 !== 'TWN' || !data) return null;
  const leak = data.leak.filter(([y]) => LEAK_YEARS.includes(y));
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <table className="mini-table">
        <thead>
          <tr>
            {text.leakHead.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leak.map(([y, rate, billed]) => (
            <tr key={y}>
              <td>{y}</td>
              <td>{fixed(rate, 2)}%</td>
              <td>{fixed(billed, 2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="mini-table">
        <thead>
          <tr>
            {text.priceHead.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.price.map(([y, avg, cost, pnl]) => (
            <tr key={y}>
              <td>{y}</td>
              <td>{fixed(avg, 2)}</td>
              <td>{fixed(cost, 2)}</td>
              <td>{pnl > 0 ? '+' : ''}{fixed(pnl, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.unit}</p>
      <p className="note">{text.note}</p>
    </section>
  );
}

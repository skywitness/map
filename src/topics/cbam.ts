import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 碳邊境調整機制（CBAM）會課到誰（新主題，2026-11-07，製作手冊第二十五批 482，候選 1141；環境的「碳與氣候政策」）：
 * 歐盟從各國進口的 CBAM 產品（鋼鐵、鋁、水泥、化肥、電力、氫，HS 近似）占這一國對歐盟出口的比例與金額
 * （Eurostat Comext DS-045409，pipeline/topics/cbam.py）
 */
const EUR = { zh: '歐元', en: 'euros' };
const eur = (v: number) => tr({ zh: formatLargeNumber(v) + ' 歐元', en: '€' + formatLargeNumber(v) });
const EXEMPT = { zh: '沒有資料（歐盟成員國不算；英國照網站的規則不收）', en: 'No data (EU members are not counted; the UK is excluded under the site’s rules)' };

export const cbam: TopicDefinition = {
  id: 'cbam',
  title: { zh: '碳邊境調整機制（CBAM）會課到誰', en: 'Who the EU carbon border tax hits' },
  shortTitle: { zh: '碳邊境調整', en: 'CBAM' },
  defaultIndicator: 'share',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: 'Eurostat Comext：EU trade since 1988 by HS2-4-6 and CN8（DS-045409）', en: 'Eurostat Comext: EU trade since 1988 by HS2-4-6 and CN8 (DS-045409)' },
      url: 'https://ec.europa.eu/eurostat/comext/newxtweb/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '歐盟執委會：Carbon Border Adjustment Mechanism（涵蓋的部門與時程）', en: 'European Commission: Carbon Border Adjustment Mechanism (sectors and timeline)' },
      url: 'https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en',
      license: { zh: '歐盟執委會網站（重製需註明出處）', en: 'European Commission website (reuse with attribution)' },
    },
  ],
  note: {
    zh: '歐盟的碳邊境調整機制（CBAM）對進口的水泥、鋼鐵、鋁、化肥、電力、氫課碳價：2023 年 10 月到 2025 年是過渡期，只要申報產品裡的排放；2026 年 1 月 1 日起進入正式課徵，進口商要買 CBAM 憑證（歐盟執委會 CBAM 頁）。這裡用歐盟 27 國的進口統計（Eurostat Comext）看各國的出口有多少會被課到。CBAM 的範圍是法規附件一的 CN8 稅號清單，這裡用 HS 近似：水泥 2523、鋼鐵 72 整章、鋁 76 章扣掉家用器具 7615、化肥 2808、2814、3102、3105、電力 2716、氫 280410；HS 73 的鋼鐵製品只有一部分在清單裡，沒有算，所以金額與比例都是近似值。冰島、列支敦斯登、挪威、瑞士跟歐盟碳排放交易體系連結，不課 CBAM；歐盟成員國之間的貿易不算；英國照網站的規則不收。分母是歐盟統計的、從這一國進口的總額，跟各國自己的出口統計會有差。',
    en: 'The EU’s Carbon Border Adjustment Mechanism (CBAM) puts a carbon price on imported cement, iron and steel, aluminium, fertilisers, electricity and hydrogen: October 2023 to 2025 was a transitional period requiring only reporting of embedded emissions, and from 1 January 2026 the definitive regime applies and importers must buy CBAM certificates (European Commission CBAM page). EU-27 import statistics (Eurostat Comext) show how much of each country’s exports is affected. CBAM covers the CN8 codes in Annex I of the regulation; this uses HS approximations: cement 2523, iron and steel all of chapter 72, aluminium chapter 76 less household articles 7615, fertilisers 2808, 2814, 3102 and 3105, electricity 2716 and hydrogen 280410. Only some steel articles in HS 73 are covered, and they are left out, so values and shares are approximate. Iceland, Liechtenstein, Norway and Switzerland are linked to the EU Emissions Trading System and exempt; trade between EU members is not counted; the UK is excluded under the site’s rules. The denominator is total EU imports from the country as the EU records them, which can differ from the country’s own export statistics.',
  },
  indicators: [
    {
      id: 'share',
      label: { zh: 'CBAM 產品占對歐盟出口', en: 'CBAM goods as a share of exports to the EU' },
      description: { zh: 'CBAM 涵蓋的六類產品（鋼鐵、鋁、水泥、化肥、電力、氫）占這一國對歐盟出口的比例（歐盟的進口統計，HS 近似）。2025 年巴林 80.5%、不丹 80.2%、莫三比克 77.3%、蒙特內哥羅 65.2%、新喀里多尼亞 64.2%，這些國家的對歐出口幾乎都是鋁、鐵合金或電力；埃及 22.3%、俄羅斯 17.6%、阿聯 17.3%、烏克蘭 11.7%、波士尼亞 11.2%；土耳其 7.3%、印度 5.9%、南非 5.9%、南韓 5.6%、台灣 4.3%、巴西 3.9%、日本 1.6%、中國 1.4%、美國 0.6%。', en: 'The six product groups CBAM covers (iron and steel, aluminium, cement, fertilisers, electricity and hydrogen) as a share of the country’s exports to the EU (EU import statistics, HS approximation). In 2025 Bahrain (80.5%), Bhutan (80.2%), Mozambique (77.3%), Montenegro (65.2%) and New Caledonia (64.2%) were highest, their EU exports being almost all aluminium, ferro-alloys or electricity; Egypt 22.3%, Russia 17.6%, the UAE 17.3%, Ukraine 11.7%, Bosnia and Herzegovina 11.2%; Turkey 7.3%, India 5.9%, South Africa 5.9%, South Korea 5.6%, Taiwan 4.3%, Brazil 3.9%, Japan 1.6%, China 1.4%, the US 0.6%.' },
      unit: '%',
      file: 'share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 20, 50] } },
      format: (v) => fixed(v, 1) + '%',
      formatTick: (v) => v + '%',
      missing: EXEMPT,
    },
    {
      id: 'value',
      label: { zh: '出口到歐盟的 CBAM 產品', en: 'CBAM goods exported to the EU' },
      description: { zh: '歐盟從這一國進口的 CBAM 產品金額（歐元）。2025 年合計約 631 億（不含英國與不課的國家）：中國 78.5 億、土耳其 75.2 億、俄羅斯 49.1 億、印度 41.2 億、南韓 38.7 億、埃及 27.6 億、烏克蘭 25.5 億；台灣 19.65 億，其中鋼鐵 18.4 億。子項目看各類：鋼鐵中國 42.0 億最多，鋁中國 32.7 億、水泥土耳其 4.4 億、化肥俄羅斯 19.8 億、電力蒙特內哥羅 2.5 億；氫幾乎沒有進口。', en: 'Value of CBAM goods the EU imported from the country (euros). In 2025 the total was about €63.1 billion (excluding the UK and exempt countries): China €7.85 billion, Turkey 7.52 billion, Russia 4.91 billion, India 4.12 billion, South Korea 3.87 billion, Egypt 2.76 billion and Ukraine 2.55 billion; Taiwan €1.97 billion, of which steel 1.84 billion. By group: China leads in steel (€4.20 billion) and aluminium (3.27 billion), Turkey in cement (437 million), Russia in fertilisers (1.98 billion) and Montenegro in electricity (253 million); hydrogen imports are negligible.' },
      unit: EUR,
      file: 'value/{item}.json',
      dimension: {
        label: { zh: '產品', en: 'Goods' },
        options: [
          { id: 'all', label: { zh: '全部六類', en: 'All six sectors' } },
          { id: 'steel', label: { zh: '鋼鐵', en: 'Iron and steel' } },
          { id: 'aluminium', label: { zh: '鋁', en: 'Aluminium' } },
          { id: 'cement', label: { zh: '水泥', en: 'Cement' } },
          { id: 'fertilisers', label: { zh: '化肥', en: 'Fertilisers' } },
          { id: 'electricity', label: { zh: '電力', en: 'Electricity' } },
          { id: 'hydrogen', label: { zh: '氫', en: 'Hydrogen' } },
        ],
        defaultOption: 'all',
      },
      layer: { kind: 'bubble', legendValues: [1e8, 1e9, 5e9] },
      format: eur,
      formatTick: (v) => formatLargeTick(v),
      missing: EXEMPT,
    },
  ],
};

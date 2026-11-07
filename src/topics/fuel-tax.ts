import type { Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 燃料稅占油價的比例（2026-11-05 做在「電價與油價」，製作手冊第二十三批 404；pipeline/topics/fuel_tax.py）。
 * 2026-11-07 第二十七批 585 開交通的小類「交通政策與投資」時搬過來，成為獨立的主題；舊網址的指標由 redirects.ts 的
 * INDICATOR_MOVES 轉過來，指標 id 不變。
 */
/** 稅占油價的比例（第二十三批 404）：只有歐盟國家 */
function taxShare(id: string, label: Text, description: Text): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: '%',
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [40, 45, 50, 55, 60] } },
    format: (v) => `${fixed(v, 1)}%`,
    formatTick: (v) => `${fixed(v, 0)}%`,
    missing: { zh: '不在歐盟 Weekly Oil Bulletin 裡', en: 'Not in the EU Weekly Oil Bulletin' },
  };
}

export const fuelTax: TopicDefinition = {
  id: 'fuel-tax',
  title: { zh: '油價裡的燃料稅', en: 'Fuel taxes in pump prices' },
  shortTitle: { zh: '燃料稅', en: 'Fuel taxes' },
  defaultIndicator: 'gasoline-tax-share',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: '歐盟執委會 Weekly Oil Bulletin（含稅與未稅零售價的歷史檔、各國加值稅率）', en: 'European Commission, Weekly Oil Bulletin (price history with and without taxes; VAT rates)' },
      url: 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '歐盟執委會每週一公布各會員國汽柴油的含稅與未稅零售價，這裡取年平均，含稅價減未稅價就是稅（貨物稅、加值稅與其他間接稅）；加值稅用同一份資料的稅率表另外拆出來。只有歐盟 27 國，2005 年起。油價本身（含稅、換成美元，含台灣與 G20）在「電價與油價」主題。',
    en: 'Every Monday the European Commission publishes petrol and diesel retail prices with and without taxes for each member state; these are annual averages, and the taxed price minus the untaxed price is the tax (excise, VAT and other indirect taxes); VAT is separated out using the rate table in the same file. EU-27 only, from 2005. Pump prices themselves (with taxes, in US dollars, including Taiwan and the G20) are in the “Electricity and fuel prices” topic.',
  },
  indicators: [
    // 燃料稅占油價的比例（2026-11-05，製作手冊第二十三批 404；pipeline/topics/fuel_tax.py）：Weekly Oil Bulletin 的含稅與未稅價
    taxShare(
      'gasoline-tax-share',
      { zh: '汽油價格裡稅占幾成（歐盟）', en: 'Taxes as a share of the petrol price (EU)' },
      {
        zh: '95 無鉛汽油的零售價裡，貨物稅、加值稅與其他間接稅合計占幾成（歐盟 Weekly Oil Bulletin 每週的含稅價與未稅價，年平均，2005 年起，歐盟 27 國）。2025 年芬蘭 61.7%、德國 60.9%、希臘 60.0%、愛爾蘭 59.8%、義大利 59.5% 最高，保加利亞 46.0%、賽普勒斯 48.2%、匈牙利 48.7%、西班牙 49.0% 最低。稅多半是每公升定額，原油漲價時比例就下降：2026 年（到 10 月）德國降到 53.0%。滑過看含稅與未稅的每公升價格。台灣不在這份資料裡（貨物稅、營業稅、石油基金、空污費沒有現成的比例統計）。',
        en: 'Share of the retail price of 95-octane petrol taken by excise duty, VAT and other indirect taxes (EU Weekly Oil Bulletin, weekly prices with and without taxes, annual averages from 2005, 27 EU countries). In 2025 Finland (61.7%), Germany (60.9%), Greece (60.0%), Ireland (59.8%) and Italy (59.5%) were highest and Bulgaria (46.0%), Cyprus (48.2%), Hungary (48.7%) and Spain (49.0%) lowest. Duties are mostly a fixed amount per litre, so the share falls when crude prices rise: Germany’s dropped to 53.0% in 2026 (to October). Hover for prices per litre with and without taxes. Taiwan is not covered (there is no ready-made share for its commodity tax, business tax, petroleum fund and air pollution fee).',
      },
    ),
    taxShare(
      'diesel-tax-share',
      { zh: '柴油價格裡稅占幾成（歐盟）', en: 'Taxes as a share of the diesel price (EU)' },
      {
        zh: '柴油零售價裡稅占幾成（歐盟 Weekly Oil Bulletin，年平均，2005 年起，歐盟 27 國）。多數國家柴油的貨物稅比汽油低：2025 年義大利 56.0%、斯洛維尼亞 55.2%、愛爾蘭 55.1% 最高，保加利亞 43.4%、西班牙 44.0%、賽普勒斯 44.2% 最低；德國 53.8%（汽油 60.9%）。',
        en: 'Share of the retail price of diesel taken by taxes (EU Weekly Oil Bulletin, annual averages from 2005, 27 EU countries). Most countries tax diesel less than petrol: in 2025 Italy (56.0%), Slovenia (55.2%) and Ireland (55.1%) were highest and Bulgaria (43.4%), Spain (44.0%) and Cyprus (44.2%) lowest; Germany 53.8% (petrol 60.9%).',
      },
    ),
    // 2026-11-06 拆開：加值稅 = 含稅價 × 稅率 ÷（100 ＋ 稅率），其餘是燃料稅與其他間接稅（fuel_tax.py 的 _vat()）
    {
      ...taxShare(
        'gasoline-excise-share',
        { zh: '汽油價格裡的燃料稅與其他稅（歐盟）', en: 'Excise and other taxes in the petrol price (EU)' },
        {
          zh: '95 無鉛汽油的零售價裡，扣掉加值稅以後的燃料稅（貨物稅）與其他間接稅占幾成（歐盟 Weekly Oil Bulletin，年平均）。加值稅占含稅價的比例 = 稅率 ÷（100 ＋ 稅率），用同一份資料的各國加值稅率表算，其餘的稅就是這一項；加值稅率是比例，燃料稅多半是每公升定額，國家之間的差別主要在這一項。2025 年德國 44.9%、芬蘭 42.4%、荷蘭 41.5%、義大利 41.5% 最高，匈牙利 27.5%、保加利亞 29.4%、波蘭 30.5% 最低。滑過看稅怎麼拆。',
          en: 'Share of the retail price of 95-octane petrol taken by excise duty and other indirect taxes once VAT is set aside (EU Weekly Oil Bulletin, annual averages). VAT’s share of the taxed price is rate ÷ (100 + rate), using the VAT rate history in the same file; the remaining tax is this indicator. VAT is proportional while excise is mostly a fixed amount per litre, so this is where countries differ most. In 2025 Germany (44.9%), Finland (42.4%), the Netherlands (41.5%) and Italy (41.5%) were highest and Hungary (27.5%), Bulgaria (29.4%) and Poland (30.5%) lowest. Hover for the split.',
        },
      ),
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 30, 35, 40, 45] } },
    },
    {
      ...taxShare(
        'diesel-excise-share',
        { zh: '柴油價格裡的燃料稅與其他稅（歐盟）', en: 'Excise and other taxes in the diesel price (EU)' },
        {
          zh: '柴油零售價裡扣掉加值稅以後的燃料稅與其他間接稅占幾成（算法同汽油）。2025 年馬爾他 39.0%、義大利 38.0%、德國 37.9%、法國 37.7% 最高，匈牙利 25.3%、瑞典 25.7%、西班牙 26.6%、愛沙尼亞 26.6% 最低。',
          en: 'Share of the retail price of diesel taken by excise duty and other indirect taxes once VAT is set aside (same method as petrol). In 2025 Malta (39.0%), Italy (38.0%), Germany (37.9%) and France (37.7%) were highest and Hungary (25.3%), Sweden (25.7%), Spain (26.6%) and Estonia (26.6%) lowest.',
        },
      ),
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 30, 35, 40, 45] } },
    },
  ],
};

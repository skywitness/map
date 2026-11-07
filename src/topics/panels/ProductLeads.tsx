import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber, usd } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 產業結構與工業的「商品的世界出口市占」「世界出口第一的品項數」的側欄（2026-11-07，第二十五批 446；
 * pipeline/topics/industry_products.py）
 */

/** product-share-top/<商品>.json：每年的世界出口額（美元）與前 10 大出口國 [國家, 市占 %, 出口額] */
interface ShareTopFile {
  world: Record<string, number>;
  top: Record<string, [string, number, number][]>;
}

const SHARE_TEXT = defineMessages({
  zh: {
    title: '前 10 大出口國',
    year: (year: number, world: string) => `${year} 年 · 世界出口 ${world}`,
    label: (name: string, value: string) => `${name} · ${value}`,
    notInTop: '這個國家不在前 10 名；市占與名次見上方的數值卡片。',
    note: '台灣沒有向聯合國申報，台灣的數字來自貿易夥伴的申報。',
  },
  en: {
    title: 'Top 10 exporters',
    year: (year: number, world: string) => `${year} · world exports ${world}`,
    label: (name: string, value: string) => `${name} · ${value}`,
    notInTop: 'This country is not in the top 10; see the cards above for its share and rank.',
    note: 'Taiwan does not report to the UN; its figures come from its partners’ reports.',
  },
});

export function ProductShareTop({ topic, iso3, year, item, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = SHARE_TEXT[lang];
  const product = item ?? 'wrenches';
  const { data } = useJson<ShareTopFile>(`topics/${topic.id}/product-share-top/${product}.json`);
  const countries = useJson<CountryTable>('countries.json').data;
  if (!data) return null;
  const years = Object.keys(data.top).map(Number).sort((a, b) => a - b);
  const shown = [...years].reverse().find((y) => y <= year) ?? years[0];
  const rows = data.top[String(shown)] ?? [];
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <p className="panel-year-note">
        {text.year(shown, usd(formatLargeNumber(data.world[String(shown)] ?? 0)))}
        {shown !== year && <span className="muted">{t.yearMissing(year)}</span>}
      </p>
      <BarList
        items={rows.map(([c, share, value]) => ({
          key: c,
          label: text.label(c === iso3 ? countryName : nameOf(c, countries, lang), usd(formatLargeNumber(value))),
          value: share,
        }))}
        format={(v) => `${fixed(v, v < 1 ? 2 : 1)}%`}
        ariaLabel={text.title}
      />
      {!rows.some(([c]) => c === iso3) && <p className="note">{text.notInTop}</p>}
      <p className="note">{text.note}</p>
    </section>
  );
}

/** HS 的 21 類（依章），跟 pipeline 的 SECTIONS 同順序 */
const HS_SECTIONS: Text[] = [
  { zh: '活動物與動物產品', en: 'Live animals and animal products' },
  { zh: '植物產品', en: 'Vegetable products' },
  { zh: '動植物油脂', en: 'Animal and vegetable fats and oils' },
  { zh: '調製食品、飲料與菸草', en: 'Prepared foods, beverages and tobacco' },
  { zh: '礦產品（含燃料）', en: 'Mineral products (incl. fuels)' },
  { zh: '化學品', en: 'Chemicals' },
  { zh: '塑膠與橡膠', en: 'Plastics and rubber' },
  { zh: '皮革、毛皮與其製品', en: 'Hides, leather and furs' },
  { zh: '木材與木製品', en: 'Wood and wood products' },
  { zh: '紙漿、紙與印刷品', en: 'Pulp, paper and printed matter' },
  { zh: '紡織品與成衣', en: 'Textiles and clothing' },
  { zh: '鞋、帽與傘', en: 'Footwear, headgear and umbrellas' },
  { zh: '石材、陶瓷與玻璃', en: 'Stone, ceramics and glass' },
  { zh: '珠寶與貴金屬', en: 'Jewellery and precious metals' },
  { zh: '卑金屬及其製品（鋼鐵、銅、鋁、工具…）', en: 'Base metals and articles (steel, copper, aluminium, tools…)' },
  { zh: '機械與電機設備', en: 'Machinery and electrical equipment' },
  { zh: '運輸設備', en: 'Transport equipment' },
  { zh: '光學與精密儀器、鐘錶、樂器', en: 'Optical and precision instruments, clocks, musical instruments' },
  { zh: '武器與彈藥', en: 'Arms and ammunition' },
  { zh: '雜項製品（家具、玩具、燈具…）', en: 'Miscellaneous manufactures (furniture, toys, lamps…)' },
  { zh: '藝術品與古董', en: 'Works of art and antiques' },
];

/**
 * 台灣 2015 年起是世界第一的品項（product-leads-taiwan.json 的代碼）。名稱照 HS 1992 的節名寫：8548 同時含電池廢料與
 * 未列名的機器電氣零件，不能只寫其中一種。pipeline 多了新的代碼時這裡要補
 */
const TW_LEADS: Record<string, Text> = {
  '1903': { zh: '樹薯澱粉製品（粉圓等片狀、粒狀、珍珠狀製品）', en: 'Tapioca products (flakes, grains, pearls)' },
  '2824': { zh: '鉛的氧化物（含紅丹）', en: 'Lead oxides (incl. red lead)' },
  '2907': { zh: '酚類與酚醇', en: 'Phenols and phenol-alcohols' },
  '4017': { zh: '硬質橡膠及其製品', en: 'Hard rubber and articles thereof' },
  '4107': { zh: '牛、馬皮革（鞣製後再加工）', en: 'Bovine and equine leather, further prepared' },
  '7006': { zh: '加工的平板玻璃（彎曲、磨邊、鑽孔…）', en: 'Worked flat glass (bent, edge-worked, drilled…)' },
  '7221': { zh: '不鏽鋼熱軋條及桿（盤捲）', en: 'Hot-rolled stainless-steel bars and rods in coils' },
  '7410': { zh: '銅箔（厚度 0.15 公厘以下）', en: 'Copper foil (0.15 mm or thinner)' },
  '7611': { zh: '鋁製大型貯槽（300 公升以上）', en: 'Aluminium tanks and vats over 300 litres' },
  '8003': { zh: '錫條、錫桿、型材與錫線', en: 'Tin bars, rods, profiles and wire' },
  '8523': { zh: '空白的錄製媒體（光碟、磁帶…）', en: 'Unrecorded recording media (discs, tapes…)' },
  '8524': { zh: '已錄製的唱片、磁帶與光碟', en: 'Recorded records, tapes and discs' },
  '8542': { zh: '積體電路', en: 'Integrated circuits' },
  '8548': { zh: '電池的廢料，與未列名的機器電氣零件', en: 'Battery waste and scrap; electrical parts of machinery n.e.s.' },
};

/** product-leads-sections/<年>.json：{國家: {門檻: [[類別序號, 項數], …]}} */
type SectionsFile = Record<string, Record<string, [number, number][]>>;
/** product-leads-taiwan.json：{年: [[代碼, 市占 %, 出口額], …]} */
type TaiwanLeadsFile = Record<string, [string, number, number][]>;

const LEADS_TEXT = defineMessages({
  zh: {
    title: (threshold: string) => `${threshold}的品項在哪幾類`,
    year: (year: number, n: number) => `${year} 年 · 共 ${n} 項`,
    count: (v: number) => `${fixed(v, 0)} 項`,
    none: (year: number) => `${year} 年沒有符合的品項。`,
    taiwan: (year: number) => `台灣 ${year} 年是世界最大出口國的品項`,
    taiwanItem: (code: string, name: string, value: string) => `${code} ${name} · ${value}`,
    taiwanNote:
      '依 Harvard Atlas 的 HS 1992 四位碼，台灣的數字來自貿易夥伴的申報。8548 在 HS 1992 同時含電池的廢料與未列名的機器電氣零件，Atlas 的數字分不出是哪一種。',
  },
  en: {
    title: (threshold: string) => `Products by section: ${threshold}`,
    year: (year: number, n: number) => `${year} · ${n} in all`,
    count: (v: number) => `${fixed(v, 0)}`,
    none: (year: number) => `No products met the threshold in ${year}.`,
    taiwan: (year: number) => `Products where Taiwan was the largest exporter in ${year}`,
    taiwanItem: (code: string, name: string, value: string) => `${code} ${name} · ${value}`,
    taiwanNote:
      'Harvard Atlas HS 1992 four-digit headings; Taiwan’s figures come from its partners’ reports. In HS 1992, 8548 covers both battery waste and scrap and electrical parts of machinery not specified elsewhere; Atlas does not separate them.',
  },
});

export function ProductLeadsSections({ topic, indicator, iso3, year, item }: PanelExtraProps) {
  const lang = useLang();
  const text = LEADS_TEXT[lang];
  const threshold = item ?? 'first';
  const shown = Math.min(Math.max(year, 1995), 2024);
  const { data } = useJson<SectionsFile>(`topics/${topic.id}/product-leads-sections/${shown}.json`);
  const { data: taiwan } = useJson<TaiwanLeadsFile>(iso3 === 'TWN' ? `topics/${topic.id}/product-leads-taiwan.json` : null);
  if (!data) return null;
  const rows = data[iso3]?.[threshold] ?? [];
  const total = rows.reduce((s, [, n]) => s + n, 0);
  const label = indicator.dimension?.options.find((o) => o.id === threshold)?.label ?? threshold;
  const twRows = threshold === 'first' ? taiwan?.[String(shown)] : undefined;
  return (
    <>
      <section className="panel-section">
        <h3>{text.title(label)}</h3>
        {rows.length === 0 ? (
          <p className="empty">{text.none(shown)}</p>
        ) : (
          <>
            <p className="panel-year-note">{text.year(shown, total)}</p>
            <BarList
              items={rows.map(([i, n]) => ({ key: String(i), label: tr(HS_SECTIONS[i]), value: n }))}
              format={text.count}
              ariaLabel={text.title(label)}
            />
          </>
        )}
      </section>
      {twRows && twRows.length > 0 && (
        <section className="panel-section">
          <h3>{text.taiwan(shown)}</h3>
          <BarList
            items={twRows.map(([code, share, value]) => ({
              key: code,
              label: text.taiwanItem(code, TW_LEADS[code] ? tr(TW_LEADS[code]) : '', usd(formatLargeNumber(value))),
              value: share,
            }))}
            format={(v) => `${fixed(v, 1)}%`}
            max={100}
            ariaLabel={text.taiwan(shown)}
          />
          <p className="note">{text.taiwanNote}</p>
        </section>
      )}
    </>
  );
}

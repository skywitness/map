import { BarList } from '../../charts/BarList';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber, usd } from '../../lib/format';
import { EXPORT_GROUPS } from '../industry';
import type { PanelExtraProps } from '../types';

interface Series {
  years: number[];
  values: Record<string, (number | null)[]>;
}

interface IndustryFile {
  production?: Series;
  exports?: Series;
  /** 只有台灣：主計總處 25 個製造業細項（新臺幣百萬元） */
  detail?: Series & { unit: string };
}

const CATEGORIES: { id: string; label: Text }[] = [
  { id: 'machinery', label: { zh: '機械、電子與運輸設備', en: 'Machinery, electronics and transport equipment' } },
  { id: 'chemicals', label: { zh: '化學與製藥', en: 'Chemicals and pharmaceuticals' } },
  { id: 'food', label: { zh: '食品、飲料與菸草', en: 'Food, beverages and tobacco' } },
  { id: 'textiles', label: { zh: '紡織、成衣與皮革', en: 'Textiles, clothing and leather' } },
  { id: 'other', label: { zh: '其他製造業', en: 'Other manufacturing' } },
];

/** 主計總處製造業細項的英文名稱（資料檔裡用中文名稱當鍵） */
const DETAIL_NAMES: { zh: string; en: string }[] = [
  { zh: '食品及飼品', en: 'Food and animal feed' },
  { zh: '飲料及菸草', en: 'Beverages and tobacco' },
  { zh: '紡織業', en: 'Textiles' },
  { zh: '成衣及服飾品', en: 'Clothing and accessories' },
  { zh: '皮革、毛皮及其製品', en: 'Leather and fur products' },
  { zh: '木竹製品', en: 'Wood and bamboo products' },
  { zh: '紙漿、紙及紙製品', en: 'Pulp and paper products' },
  { zh: '印刷及資料儲存媒體複製業', en: 'Printing and reproduction of recorded media' },
  { zh: '石油及煤製品', en: 'Petroleum and coal products' },
  { zh: '化學材料及肥料', en: 'Chemical materials and fertilisers' },
  { zh: '其他化學製品', en: 'Other chemical products' },
  { zh: '藥品及醫用化學製品', en: 'Pharmaceuticals and medicinal chemicals' },
  { zh: '橡膠製品', en: 'Rubber products' },
  { zh: '塑膠製品', en: 'Plastic products' },
  { zh: '非金屬礦物製品', en: 'Non-metallic mineral products' },
  { zh: '基本金屬', en: 'Basic metals' },
  { zh: '金屬製品', en: 'Fabricated metal products' },
  { zh: '電子零組件', en: 'Electronic components' },
  { zh: '電腦、電子產品及光學製品', en: 'Computers, electronic and optical products' },
  { zh: '電力設備及配備', en: 'Electrical equipment' },
  { zh: '機械設備', en: 'Machinery and equipment' },
  { zh: '汽車及其零件', en: 'Motor vehicles and parts' },
  { zh: '其他運輸工具及其零件', en: 'Other transport equipment and parts' },
  { zh: '家具', en: 'Furniture' },
  { zh: '其他', en: 'Other manufacturing' },
];
const DETAIL_EN = new Map(DETAIL_NAMES.map((n) => [n.zh, n.en]));

const TEXT = defineMessages({
  zh: {
    noCountry: '沒有這個國家的工業資料。',
    production: '製造業組成（生產面）',
    productionAria: (country: string) => `${country}製造業組成`,
    noProduction: '沒有製造業組成資料。',
    detail: (year: number, n: number) => `台灣製造業細項（${year} 年，前 ${n} 大）`,
    detailAria: '台灣製造業細項',
    /** 新臺幣百萬元 → 億元 */
    twd: (millions: number) => `${fixed(millions / 100, 0)} 億元`,
    detailNote: '資料：行政院主計總處各業 GDP（名目，新臺幣）。右側為占製造業比重。',
    exports: '商品出口結構',
    exportsTotal: (total: string) => `出口總額 ${total}`,
    exportsAria: (country: string) => `${country}商品出口結構`,
    exportsNote:
      '資料：Harvard Atlas of Economic Complexity，依 HS 商品分類歸類，不含服務出口。「未分類商品」是申報時沒有細分產品別的出口（HS 98–99 章）。',
    noExports: '沒有出口資料。',
  },
  en: {
    noCountry: 'No industry data for this country.',
    production: 'Manufacturing composition (output)',
    productionAria: (country) => `Manufacturing composition of ${country}`,
    noProduction: 'No manufacturing composition data.',
    detail: (year, n) => `Taiwan's manufacturing industries (${year}, top ${n})`,
    detailAria: "Taiwan's manufacturing industries",
    /** 新臺幣百萬元 → 十億元 */
    twd: (millions) => `NT$${fixed(millions / 1000, 0)}B`,
    detailNote: 'Data: DGBAS GDP by industry (nominal, NT$). The right column is the share of manufacturing.',
    exports: 'Goods export structure',
    exportsTotal: (total) => `Total exports ${total}`,
    exportsAria: (country) => `Goods export structure of ${country}`,
    exportsNote:
      'Data: Harvard Atlas of Economic Complexity, grouped by HS product codes, excluding services. "Unspecified goods" are exports declared without a product breakdown (HS chapters 98–99).',
    noExports: 'No export data.',
  },
});

const DETAIL_SHOWN = 12;

export default function IndustryPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<IndustryFile>(`topics/${topic.id}/countries/${iso3}.json`);
  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  const production = pick(data.production, year, CATEGORIES.map((c) => c.id));
  const exports = pick(data.exports, year, EXPORT_GROUPS.map((g) => g.id));
  const detail = data.detail ? pick(data.detail, year, Object.keys(data.detail.values)) : null;
  const exportTotal = exports ? Object.values(exports.values).reduce<number>((s, v) => s + (v ?? 0), 0) : 0;

  return (
    <section className="panel-section">
      <h3>{text.production}</h3>
      {production ? (
        <>
          <YearNote shown={production.year} wanted={year} />
          <BarList
            items={CATEGORIES.map((c) => ({ key: c.id, label: tr(c.label, lang), value: production.values[c.id] ?? 0 }))
              .sort((a, b) => b.value - a.value)}
            format={(v) => `${fixed(v, 1)}%`}
            max={100}
            ariaLabel={text.productionAria(countryName)}
          />
        </>
      ) : (
        <p className="empty">{text.noProduction}</p>
      )}

      {detail && (
        <>
          <h4>{text.detail(detail.year, DETAIL_SHOWN)}</h4>
          <BarList
            items={Object.entries(detail.values)
              .map(([name, v]) => ({ key: name, label: lang === 'en' ? (DETAIL_EN.get(name) ?? name) : name, value: v ?? 0 }))
              .sort((a, b) => b.value - a.value)
              .slice(0, DETAIL_SHOWN)}
            total={Object.values(detail.values).reduce<number>((sum, v) => sum + (v ?? 0), 0)}
            format={text.twd}
            ariaLabel={text.detailAria}
          />
          <p className="note">{text.detailNote}</p>
        </>
      )}

      <h3>{text.exports}</h3>
      {exports ? (
        <>
          <YearNote shown={exports.year} wanted={year} />
          <p className="panel-figure">{text.exportsTotal(usd(formatLargeNumber(exportTotal)))}</p>
          <BarList
            items={EXPORT_GROUPS.map((g) => ({ key: g.id, label: tr(g.label, lang), value: exports.values[g.id] ?? 0 }))
              .filter((i) => i.value > 0)
              .sort((a, b) => b.value - a.value)}
            total={exportTotal}
            format={(v) => usd(formatLargeNumber(v))}
            ariaLabel={text.exportsAria(countryName)}
          />
          <p className="note">{text.exportsNote}</p>
        </>
      ) : (
        <p className="empty">{text.noExports}</p>
      )}
    </section>
  );
}

/** 取 year 當年（或之前最近一年）各項目都有值的資料 */
function pick(series: Series | undefined, year: number, keys: string[]) {
  if (!series) return null;
  const index = latestIndexAtOrBefore(series.years, year, (i) => keys.some((k) => series.values[k]?.[i] != null));
  if (index < 0) return null;
  return {
    year: series.years[index],
    values: Object.fromEntries(keys.map((k) => [k, series.values[k]?.[index] ?? null])),
  };
}

function YearNote({ shown, wanted }: { shown: number; wanted: number }) {
  const t = useT();
  return (
    <p className="panel-year-note">
      {t.year(shown)}
      {shown !== wanted && <span className="muted">{t.yearMissing(wanted)}</span>}
    </p>
  );
}

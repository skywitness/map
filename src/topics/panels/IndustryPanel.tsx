import { BarList } from '../../charts/BarList';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
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

const CATEGORIES = [
  { id: 'machinery', label: '機械、電子與運輸設備' },
  { id: 'chemicals', label: '化學與製藥' },
  { id: 'food', label: '食品、飲料與菸草' },
  { id: 'textiles', label: '紡織、成衣與皮革' },
  { id: 'other', label: '其他製造業' },
];

const DETAIL_SHOWN = 12;

export default function IndustryPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const { data, error } = useJson<IndustryFile>(`topics/${topic.id}/countries/${iso3}.json`);
  if (error) return <p className="empty">沒有這個國家的工業資料。</p>;
  if (!data) return <p className="empty">載入中…</p>;

  const production = pick(data.production, year, CATEGORIES.map((c) => c.id));
  const exports = pick(data.exports, year, EXPORT_GROUPS.map((g) => g.id));
  const detail = data.detail ? pick(data.detail, year, Object.keys(data.detail.values)) : null;

  return (
    <section className="panel-section">
      <h3>製造業組成（生產面）</h3>
      {production ? (
        <>
          <YearNote shown={production.year} wanted={year} />
          <BarList
            items={CATEGORIES.map((c) => ({ key: c.id, label: c.label, value: production.values[c.id] ?? 0 }))
              .sort((a, b) => b.value - a.value)}
            format={(v) => `${fixed(v, 1)}%`}
            max={100}
            ariaLabel={`${countryName}製造業組成`}
          />
        </>
      ) : (
        <p className="empty">沒有製造業組成資料。</p>
      )}

      {detail && (
        <>
          <h4>
            台灣製造業細項（{detail.year} 年，前 {DETAIL_SHOWN} 大）
          </h4>
          <BarList
            items={Object.entries(detail.values)
              .map(([name, v]) => ({ key: name, label: name, value: v ?? 0 }))
              .sort((a, b) => b.value - a.value)
              .slice(0, DETAIL_SHOWN)}
            total={Object.values(detail.values).reduce<number>((sum, v) => sum + (v ?? 0), 0)}
            format={(v) => `${fixed(v / 100, 0)} 億元`}
            ariaLabel="台灣製造業細項"
          />
          <p className="note">資料：行政院主計總處各業 GDP（名目，新臺幣）。右側為占製造業比重。</p>
        </>
      )}

      <h3>商品出口結構</h3>
      {exports ? (
        <>
          <YearNote shown={exports.year} wanted={year} />
          <p className="panel-figure">
            出口總額 {formatLargeNumber(Object.values(exports.values).reduce<number>((s, v) => s + (v ?? 0), 0))} 美元
          </p>
          <BarList
            items={EXPORT_GROUPS.map((g) => ({ key: g.id, label: g.label, value: exports.values[g.id] ?? 0 }))
              .filter((i) => i.value > 0)
              .sort((a, b) => b.value - a.value)}
            total={Object.values(exports.values).reduce<number>((s, v) => s + (v ?? 0), 0)}
            format={(v) => `${formatLargeNumber(v)} 美元`}
            ariaLabel={`${countryName}商品出口結構`}
          />
          <p className="note">
            資料：Harvard Atlas of Economic Complexity，依 HS 商品分類歸類，不含服務出口。「未分類商品」是申報時沒有細分產品別的出口（HS 98–99 章）。
          </p>
        </>
      ) : (
        <p className="empty">沒有出口資料。</p>
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
  return (
    <p className="panel-year-note">
      {shown} 年{shown !== wanted && <span className="muted">（{wanted} 年無資料，顯示最近一年）</span>}
    </p>
  );
}

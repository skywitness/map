import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';

/** fertilizer/detail.json（pipeline/topics/industry_fertilizer.py）：每國最近一年三種養分的 [產量, 施用, 進口, 出口]（公噸養分量） */
interface FertilizerDetail {
  year: number;
  nutrients: string[];
  countries: Record<string, (number | null)[][]>;
}

const TEXT = defineMessages({
  zh: {
    title: (year: number) => `化肥的產量、施用與進出口（${year} 年）`,
    caption: (country: string, year: number) => `${country} ${year} 年化肥的產量、農業施用量、進口與出口（公噸養分量）`,
    nutrient: '養分',
    names: ['氮（N）', '磷（P₂O₅）', '鉀（K₂O）'],
    cols: ['產量', '施用', '進口', '出口'],
    note: '公噸養分量；FAOSTAT 標成「外部機構提供」的數字沒有用，「—」是沒有資料。產量、施用與進出口加減不一定對得上（庫存、轉口、工業用）。',
  },
  en: {
    title: (year) => `Fertilizer production, use and trade (${year})`,
    caption: (country, year) => `Fertilizer production, agricultural use, imports and exports in ${country}, ${year} (tonnes of nutrient)`,
    nutrient: 'Nutrient',
    names: ['Nitrogen (N)', 'Phosphate (P₂O₅)', 'Potash (K₂O)'],
    cols: ['Production', 'Use', 'Imports', 'Exports'],
    note: 'Tonnes of nutrient; figures FAOSTAT marks as supplied by external organisations are not used, and a dash means no data. Production, use and trade need not add up (stocks, re-exports, industrial use).',
  },
});

/** 產業結構與工業的化肥指標：這一國三種養分的四欄表（2026-11-05，製作手冊第二十二批 384） */
export function FertilizerTable({ topicId, iso3, countryName }: { topicId: string; iso3: string; countryName: string }) {
  const lang = useLang();
  const text = TEXT[lang];
  const data = useJson<FertilizerDetail>(`topics/${topicId}/fertilizer/detail.json`).data;
  const rows = data?.countries[iso3];
  if (!data || !rows) return null;
  const n = (v: number | null) => (v == null ? '—' : fixed(v, 0));
  return (
    <>
      <h3>{text.title(data.year)}</h3>
      <table className="mini-table" aria-label={text.caption(countryName, data.year)}>
        <thead>
          <tr>
            <th scope="col">{text.nutrient}</th>
            {text.cols.map((c) => (
              <th key={c} scope="col" className="num">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={data.nutrients[i]}>
              <th scope="row">{text.names[i]}</th>
              {row.map((v, j) => (
                <td key={j} className="num">
                  {n(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.note}</p>
    </>
  );
}

import { useMemo, useState } from 'react';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { countryName } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { CASTLE_TYPES } from '../castles';
import type { WorldPanelProps } from '../types';

/**
 * 城堡與要塞的統計（2026-11-06，城5，參考 thecastlemap.com 的 statistics 與 how-many 頁；pipeline/topics/castles.py 的
 * castles-stats.json）：四類各幾座、各世紀蓋了幾座（依類型疊起來的橫條）、各國的名單數量跟 Wikidata 全部的數量並列、
 * 每百萬人幾座。名單是挑過的，所以不畫成國家的顏色，只在這裡列出、寫清楚。
 */
interface CastleStats {
  snapshot: string;
  total: number;
  undated: number;
  approx: number;
  categories: number[];
  popYear: number;
  /** [ISO3, 名單上幾座, Wikidata 全部幾項, 人口, [四類各幾座], 最有名的（中文）, 最有名的（英文）] */
  countries: [string, number, number | null, number | null, number[], string, string][];
  /** [世紀的代碼, [四類各幾座]]：'bc' 西元前、'1' 1–499 年、'500' 500–999 年、'1000' 起每世紀 */
  centuries: [string, number[]][];
}

const TEXT = defineMessages({
  zh: {
    intro: (total: string, date: string) => `名單共 ${total} 座（Castle Map，${date} 下載）：`,
    dated: (undated: string, approx: string) => `${undated} 座沒有建造年份，${approx} 座的年份是約略的。`,
    centuries: '各世紀蓋了幾座',
    centuriesNote: '依建造的年份，疊起來的顏色是類型（遺址是今天的狀態，當年蓋的可能是城堡或要塞）。',
    century: (key: string) =>
      key === 'bc' ? '西元前' : key === '1' ? '1–499 年' : key === '500' ? '500–999 年' : `${Number(key) / 100 + 1} 世紀`,
    countries: '各國：名單 vs Wikidata',
    countriesNote:
      '名單只收有照片、維基條目、夠多語言版的，所以遠少於 Wikidata 全部的城堡、要塞、堡壘、城館、宮殿與日本城（同一項屬於好幾類只算一次；依 Wikidata 寫的國家，跟名單依座標判斷的可能不同）。比例越低，表示那一國還有很多沒進名單的。',
    colCountry: '國家',
    colList: '名單',
    colWikidata: 'Wikidata',
    colShare: '收了',
    top: (name: string) => `最有名：${name}`,
    showAll: (n: number) => `看全部 ${n} 國`,
    showLess: '只看前 20 國',
    taiwan: (n: number, wd: string) => `台灣：名單上 ${n} 座，Wikidata 有 ${wd} 項，都是要塞、砲台與遺址。`,
    perMillion: '每百萬人幾座',
    perMillionNote: (year: number) => `人口 100 萬以上的國家，人口是聯合國《世界人口展望 2024》的 ${year} 年推估。`,
    colPer: '每百萬人',
    caption: (name: string) => `${name}：各類型的座數`,
    unknown: '—',
    seg: (type: string, n: string) => `${type} ${n} 座`,
    bar: (label: string, segs: string[]) => `${label}：${segs.join('、')}`,
  },
  en: {
    intro: (total, date) => `${total} landmarks in the list (Castle Map, downloaded ${date}): `,
    dated: (undated, approx) => `${undated} have no founding year and ${approx} have an approximate one.`,
    centuries: 'Founded by century',
    centuriesNote: 'By founding year, stacked by type (ruin is the state today; it may have been built as a castle or fortress).',
    century: (key) =>
      key === 'bc' ? 'BCE' : key === '1' ? '1–499' : key === '500' ? '500–999' : `${ordinal(Number(key) / 100 + 1)} c.`,
    countries: 'By country: the list vs Wikidata',
    countriesNote:
      'The list keeps only landmarks with a photo, a Wikipedia article and enough language editions, so it is far smaller than everything Wikidata holds as castles, fortresses, forts, châteaux, palaces and Japanese castles (an item in several classes counts once; Wikidata’s country may differ from the list’s, which is by location). A low share means many more are not in the list.',
    colCountry: 'Country',
    colList: 'List',
    colWikidata: 'Wikidata',
    colShare: 'Share',
    top: (name) => `Most famous: ${name}`,
    showAll: (n) => `Show all ${n} countries`,
    showLess: 'Show the top 20 only',
    taiwan: (n, wd) => `Taiwan: ${n} in the list and ${wd} in Wikidata, all fortresses, batteries and ruins.`,
    perMillion: 'Per million people',
    perMillionNote: (year) => `Countries with at least 1 million people; population is the UN World Population Prospects 2024 estimate for ${year}.`,
    colPer: 'Per million',
    caption: (name) => `${name}: landmarks by type`,
    unknown: '—',
    seg: (type, n) => `${type}: ${n}`,
    bar: (label, segs) => `${label}: ${segs.join(', ')}`,
  },
});

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
}

const TOP = 20;

export default function CastlesWorld(_props: WorldPanelProps) {
  const t = useT();
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<CastleStats>('topics/castles/castles-stats.json');
  const [all, setAll] = useState(false);
  const view = useMemo(() => {
    if (!data) return null;
    const name = (iso3: string) => countryName(iso3, null, lang);
    const centuryMax = Math.max(...data.centuries.map(([, c]) => c.reduce((a, b) => a + b, 0)));
    const perMillion = data.countries
      .filter((c) => c[3] !== null && c[3] >= 1e6)
      .map((c) => ({ iso3: c[0], name: name(c[0]), per: (c[1] / (c[3] as number)) * 1e6, n: c[1] }))
      .sort((a, b) => b.per - a.per)
      .slice(0, 10);
    const tw = data.countries.find((c) => c[0] === 'TWN');
    return {
      centuryMax,
      perMillion,
      tw: tw ? text.taiwan(tw[1], tw[2] === null ? text.unknown : fixed(tw[2], 0)) : null,
      rows: data.countries.map((c) => ({
        iso3: c[0],
        name: name(c[0]),
        n: c[1],
        wd: c[2],
        share: c[2] ? Math.min(100, (c[1] / c[2]) * 100) : null,
        top: lang === 'zh' ? c[5] : c[6],
      })),
    };
  }, [data, lang, text]);

  if (!data || !view) return <p className="empty">{t.loading}</p>;
  const rows = all ? view.rows : view.rows.slice(0, TOP);
  return (
    <section className="panel-section castle-stats">
      <p className="note">
        {text.intro(fixed(data.total, 0), data.snapshot)}
        {CASTLE_TYPES.map((c, i) => (
          <span key={i} className="castle-type">
            <span className="castle-swatch" style={{ background: c.color }} aria-hidden="true" />
            {tr(c.short, lang)} {fixed(data.categories[i], 0)}
          </span>
        ))}
      </p>
      <p className="note">{text.dated(fixed(data.undated, 0), fixed(data.approx, 0))}</p>

      <h3>{text.centuries}</h3>
      <p className="note">{text.centuriesNote}</p>
      <ul className="castle-centuries">
        {data.centuries.map(([key, cats]) => {
          const total = cats.reduce((a, b) => a + b, 0);
          const label = text.century(key);
          return (
            <li key={key}>
              <span className="castle-century-label">{label}</span>
              <svg
                className="castle-century-bar"
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                role="img"
                aria-label={text.bar(label, cats.map((n, i) => text.seg(tr(CASTLE_TYPES[i].short, lang), fixed(n, 0))))}
              >
                {stack(cats, view.centuryMax).map((seg) => (
                  <rect key={seg.i} x={seg.x} y={0} width={seg.w} height={10} fill={CASTLE_TYPES[seg.i].color}>
                    <title>{text.seg(tr(CASTLE_TYPES[seg.i].short, lang), fixed(cats[seg.i], 0))}</title>
                  </rect>
                ))}
              </svg>
              <span className="castle-century-total">{fixed(total, 0)}</span>
            </li>
          );
        })}
      </ul>

      <h3>{text.countries}</h3>
      <p className="note">{text.countriesNote}</p>
      <table className="mini-table" aria-label={text.countries}>
        <thead>
          <tr>
            <th scope="col">{text.colCountry}</th>
            <th scope="col" className="num">
              {text.colList}
            </th>
            <th scope="col" className="num">
              {text.colWikidata}
            </th>
            <th scope="col" className="num">
              {text.colShare}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.iso3}>
              <th scope="row">
                {r.name}
                <span className="mini-table-sub">{text.top(r.top)}</span>
              </th>
              <td className="num">{fixed(r.n, 0)}</td>
              <td className="num">{r.wd === null ? text.unknown : fixed(r.wd, 0)}</td>
              <td className="num">{r.share === null ? text.unknown : `${fixed(r.share, r.share < 10 ? 1 : 0)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {view.rows.length > TOP && (
        <button type="button" className="eclipse-more" onClick={() => setAll(!all)}>
          {all ? text.showLess : text.showAll(view.rows.length)}
        </button>
      )}
      {view.tw && <p className="note">{view.tw}</p>}

      <h3>{text.perMillion}</h3>
      <p className="note">{text.perMillionNote(data.popYear)}</p>
      <table className="mini-table" aria-label={text.perMillion}>
        <thead>
          <tr>
            <th scope="col">{text.colCountry}</th>
            <th scope="col" className="num">
              {text.colPer}
            </th>
            <th scope="col" className="num">
              {text.colList}
            </th>
          </tr>
        </thead>
        <tbody>
          {view.perMillion.map((r) => (
            <tr key={r.iso3}>
              <th scope="row">{r.name}</th>
              <td className="num">{fixed(r.per, r.per < 10 ? 1 : 0)}</td>
              <td className="num">{fixed(r.n, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** 疊起來的橫條：各段的位置與寬度（0–100，依最大的那一列縮放），段與段之間留一點空隙 */
function stack(cats: number[], max: number): { i: number; x: number; w: number }[] {
  const out: { i: number; x: number; w: number }[] = [];
  let x = 0;
  cats.forEach((n, i) => {
    if (n <= 0) return;
    const w = (n / max) * 100;
    out.push({ i, x, w: Math.max(w - 0.6, 0.4) });
    x += w;
  });
  return out;
}

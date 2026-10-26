import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang, useT, type Lang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatPercent } from '../../lib/format';
import { BRANDS, brandLabel, perMillion } from '../chain-stores';
import type { PanelExtraProps } from '../types';

/** 公司公布的店數（pipeline/sources/chain_official.py），osm 是同樣國家的 OSM 店數 */
interface OfficialCount {
  brand: string;
  iso3: string[];
  count: number;
  asof: string;
  scope: string;
  scopeEn: string;
  source: string;
  sourceEn: string;
  url: string;
  /** 'about'（約）、'over'（超過）或空字串 */
  qualifier: string;
  osm: number;
}

/** countries/<ISO3>.json（pipeline/topics/chain_stores.py） */
interface ChainFile {
  snapshot: string;
  /** WPP 2024 的 2026 年人口 */
  population: number;
  /** 各品牌在 OSM 上的店數（沒有的品牌不列） */
  brands: Record<string, number>;
  official: OfficialCount[];
  /** 品牌已經退出這個國家（OSM 上的舊標示沒有算）：text 是「2022 年退出俄羅斯…」，stale 是沒算的點數 */
  exited?: { brand: string; text: string; textEn: string; stale: number }[];
  convenience?: { count: number; brands: [string, number][]; unbranded: number };
}

const TEXT = defineMessages({
  zh: {
    none: '這個國家在 OpenStreetMap 上沒有這 9 個品牌的店，也沒有標示便利商店。',
    brandsTitle: '各品牌的店數',
    brandsCaption: (country: string) => `${country}各品牌在 OpenStreetMap 上的店數與公司公布的店數`,
    snapshot: (date: string) => `OpenStreetMap ${date} 的快照`,
    colBrand: '品牌',
    colOsm: 'OSM',
    colDensity: '每百萬人',
    colOfficial: '公司公布',
    colCoverage: '涵蓋率',
    over: (n: string) => `${n} 以上`,
    about: (n: string) => `約 ${n}`,
    overStores: (n: string) => `${n} 家以上`,
    aboutStores: (n: string) => `約 ${n} 家`,
    exactStores: (n: string) => `${n} 家`,
    combinedNote: '* 公司只公布跟鄰近國家的合計（見下面的出處），涵蓋率用 OSM 上同樣幾個國家的合計來算。',
    exited: (brand: string, text: string, stale: number) =>
      `${brand} ${text}${stale ? `；OpenStreetMap 上還留著 ${stale} 個舊的標示，沒有算` : ''}。`,
    coverageNote:
      '涵蓋率 = OSM 店數 ÷ 公司公布的店數。OpenStreetMap 是志願者繪製的地圖，各國標得完不完整差很多；超過 100% 可能是公司的數字比較舊、OSM 上還留著已經關掉的店，或同一家店標了兩次。',
    poor: (pct: string) => `這個國家的 OSM 只標了公司公布店數的 ${pct}，地圖上的數字明顯偏低。`,
    sourcesTitle: '公司公布店數的出處',
    sourceLine: (brand: string, count: string, asof: string, scope: string) =>
      `${brand} ${count}（${asof}${scope ? `，${scope}` : ''}）：`,
    convenienceTitle: '所有便利商店',
    convenienceCount: (n: string, density: string) =>
      `OpenStreetMap 上有 ${n} 家（每百萬人 ${density} 家），標示最多的品牌：`,
    convenienceAria: (country: string) => `${country}的便利商店品牌`,
    stores: (n: number) => `${fixed(n, 0)} 家`,
    unbranded: (n: string) => `另有 ${n} 家沒有標品牌（多半是獨立的小店）。`,
    brandNote:
      '7-Eleven、全家、Lawson 依這個主題的認法合併（brand:wikidata 或名稱），其他品牌照 OpenStreetMap 上 brand 標籤的寫法，不同寫法沒有合併。',
  },
  en: {
    none: 'None of these 9 brands, and no convenience stores, are mapped in this country on OpenStreetMap.',
    brandsTitle: 'Stores by brand',
    brandsCaption: (country) => `Stores of each brand in ${country} on OpenStreetMap and as published by the company`,
    snapshot: (date) => `OpenStreetMap snapshot of ${date}`,
    colBrand: 'Brand',
    colOsm: 'OSM',
    colDensity: 'Per million',
    colOfficial: 'Company',
    colCoverage: 'Coverage',
    over: (n) => `${n}+`,
    about: (n) => `c. ${n}`,
    overStores: (n) => `${n}+ stores`,
    aboutStores: (n) => `about ${n} stores`,
    exactStores: (n) => `${n} stores`,
    combinedNote:
      '* The company publishes only a total combined with neighbouring countries (see the sources below); coverage uses the OSM total for the same countries.',
    exited: (brand, text, stale) =>
      `${brand} ${text}${stale ? `; ${stale} outdated ${stale === 1 ? 'entry remains' : 'entries remain'} on OpenStreetMap and ${stale === 1 ? 'is' : 'are'} not counted` : ''}.`,
    coverageNote:
      'Coverage = OSM stores ÷ the company’s published count. OpenStreetMap is a volunteer-built map and its completeness varies a lot by country; above 100% can mean the company figure is older, closed stores are still mapped, or a store is mapped twice.',
    poor: (pct) => `OSM maps only ${pct} of the company’s published count here, so the map clearly undercounts.`,
    sourcesTitle: 'Sources of company counts',
    sourceLine: (brand, count, asof, scope) => `${brand}: ${count} (${asof}${scope ? `, ${scope}` : ''}): `,
    convenienceTitle: 'All convenience stores',
    convenienceCount: (n, density) =>
      `${n} mapped on OpenStreetMap (${density} per million people). Most-mapped brands:`,
    convenienceAria: (country) => `Convenience store brands in ${country}`,
    stores: (n) => `${fixed(n, 0)} ${n === 1 ? 'store' : 'stores'}`,
    unbranded: (n) => `Another ${n} have no brand mapped (mostly independent shops).`,
    brandNote:
      '7-Eleven, FamilyMart and Lawson are merged as identified in this topic (brand:wikidata or name); other brands are as written in the OpenStreetMap brand tag, with different spellings not merged.',
  },
});

/** 涵蓋率低於這個比例時，側欄另外寫一句提醒（tooltip 的 hints 用同一個門檻，pipeline 的 POOR_COVERAGE） */
const POOR = 0.5;

const count = (n: number, lang: Lang) => n.toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US');

export default function ChainStoresPanel({ topic, iso3, item, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<ChainFile>(`topics/${topic.id}/countries/${iso3}.json`);
  if (error) return <p className="empty">{text.none}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  const officialOf = (brand: string) => data.official.find((o) => o.brand === brand);
  /** 表格裡只寫數字（合計好幾國的加 *），出處那一行加單位 */
  const officialText = (o: OfficialCount) => {
    const n = count(o.count, lang);
    const v = o.qualifier === 'over' ? text.over(n) : o.qualifier === 'about' ? text.about(n) : n;
    return o.iso3.length > 1 ? `${v} *` : v;
  };
  const officialStores = (o: OfficialCount) => {
    const n = count(o.count, lang);
    return o.qualifier === 'over'
      ? text.overStores(n)
      : o.qualifier === 'about'
        ? text.aboutStores(n)
        : text.exactStores(n);
  };
  const rows = BRANDS.filter((b) => data.brands[b.id] || officialOf(b.id)).map((b) => {
    const osm = data.brands[b.id] ?? 0;
    const o = officialOf(b.id);
    return { id: b.id, label: tr(b.label, lang), osm, official: o, coverage: o ? o.osm / o.count : null };
  });
  const current = rows.find((r) => r.id === item && r.coverage !== null && r.coverage < POOR);
  const shared = data.official.filter((o) => o.iso3.length > 1);
  const conv = data.convenience;

  return (
    <section className="panel-section">
      {(rows.length > 0 || Boolean(data.exited?.length)) && (
        <>
          <h3>{text.brandsTitle}</h3>
          <p className="panel-year-note">{text.snapshot(data.snapshot)}</p>
          {rows.length > 0 && (
            <table className="mini-table" aria-label={text.brandsCaption(countryName)}>
              <thead>
                <tr>
                  <th scope="col">{text.colBrand}</th>
                  <th scope="col" className="num">
                    {text.colOsm}
                  </th>
                  <th scope="col" className="num">
                    {text.colDensity}
                  </th>
                  <th scope="col" className="num">
                    {text.colOfficial}
                  </th>
                  <th scope="col" className="num">
                    {text.colCoverage}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.id === item ? 'is-current' : undefined}>
                    <th scope="row">{r.label}</th>
                    <td className="num">{count(r.osm, lang)}</td>
                    <td className="num">{perMillion((r.osm / data.population) * 1e6)}</td>
                    <td className="num">{r.official ? officialText(r.official) : '–'}</td>
                    <td className="num">{r.coverage !== null ? formatPercent(r.coverage * 100, 0) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {current && <p className="note chain-poor">{text.poor(formatPercent(current.coverage! * 100, 0))}</p>}
          {(data.exited ?? []).map((e) => (
            <p key={e.brand} className="note">
              {text.exited(tr(brandLabel(e.brand), lang), lang === 'zh' ? e.text : e.textEn, e.stale)}
            </p>
          ))}
          {data.official.length > 0 && <p className="note">{text.coverageNote}</p>}
          {shared.length > 0 && <p className="note">{text.combinedNote}</p>}
          {data.official.length > 0 && (
            <>
              <h4>{text.sourcesTitle}</h4>
              <ul className="note chain-sources">
                {data.official.map((o) => {
                  const brand = BRANDS.find((b) => b.id === o.brand);
                  const scope = lang === 'zh' ? o.scope : o.scopeEn;
                  return (
                    <li key={o.brand}>
                      {text.sourceLine(brand ? tr(brand.label, lang) : o.brand, officialStores(o), o.asof, scope)}
                      <a href={o.url} target="_blank" rel="noreferrer">
                        {lang === 'zh' ? o.source : o.sourceEn}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
      {conv && conv.count > 0 && (
        <>
          <h3>{text.convenienceTitle}</h3>
          <p className="panel-year-note">
            {text.convenienceCount(count(conv.count, lang), perMillion((conv.count / data.population) * 1e6))}
          </p>
          {conv.brands.length > 0 && (
            <BarList
              items={conv.brands.map(([name, n]) => ({
                key: name,
                // 「#7-eleven」是這個主題認出來的品牌，換成目前語言的名稱；其他是 OSM 的 brand 標籤原文
                label: name.startsWith('#') ? tr(brandLabel(name.slice(1)), lang) : name,
                value: n,
              }))}
              format={(v) => text.stores(Math.round(v))}
              total={conv.count}
              ariaLabel={text.convenienceAria(countryName)}
              properNouns
            />
          )}
          {conv.unbranded > 0 && <p className="note">{text.unbranded(count(conv.unbranded, lang))}</p>}
          {conv.brands.length > 0 && <p className="note">{text.brandNote}</p>}
        </>
      )}
    </section>
  );
}

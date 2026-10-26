import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { EChart } from '../../charts/EChart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { decodePoints } from '../../map/Overlays';
import {
  BANDS,
  buildingName,
  cityName,
  COVERAGE_CHINA_200,
  COVERAGE_WORLD_200,
  COVERAGE_WORLD_300,
  CTBUH_CHINA_200,
  CTBUH_WORLD_200,
  CTBUH_WORLD_300,
  metres,
} from '../skyscrapers';
import type { PanelExtraProps, PointRecord, PointsData } from '../types';
import { TopicLink } from './TopicLink';

/** 一開始列出幾棟，其他收在「顯示其餘」 */
const SHOWN = 10;
/** 沒有完工年份的最多列幾棟 */
const UNDATED_SHOWN = 8;
const FIRST_YEAR = 1930;
/** 側欄的歷年折線：150、200、300 m 以上 */
const LINES = [150, 200, 300];

/** undated.json（pipeline/topics/skyscrapers.py）：[QID 數字, 名稱, 中文名稱, 高度, 國家] */
type Undated = [number, string, string | null, number, string];

const TEXT = defineMessages({
  zh: {
    coverage: `Wikidata 收錄的大樓不完整：跟 CTBUH 統計的 2025 年底總數比，200 m 以上約 ${COVERAGE_WORLD_200}%（全世界 ${fixed(CTBUH_WORLD_200, 0)} 棟）、300 m 以上約 ${COVERAGE_WORLD_300}%（${CTBUH_WORLD_300} 棟）。下面的棟數是 Wikidata 收錄的，各國的收錄程度差很多。`,
    china: `中國特別少：CTBUH 統計中國 200 m 以上 ${fixed(CTBUH_CHINA_200, 0)} 棟，Wikidata 只收錄約 ${COVERAGE_CHINA_200}%。`,
    title: (country: string, year: number) => `${country}的大樓（${year} 年）`,
    summary: (n: number, n200: number, n300: number) =>
      `150 m 以上 ${n} 棟，其中 200 m 以上 ${n200} 棟、300 m 以上 ${n300} 棟。`,
    none: (year: number) => `${year} 年沒有 Wikidata 收錄的 150 m 以上的大樓。`,
    bandsAria: (country: string) => `${country}的大樓依高度分段`,
    tallest: '最高的大樓',
    meta: (h: string, floors: number | null, year: number, city: string | null) =>
      [h, floors ? `${floors} 層` : null, `${year} 年完工`, city].filter(Boolean).join(' · '),
    gone: (y: number) => `${y} 年拆除或毀損`,
    twin: '雙塔（算 2 棟）',
    more: (n: number) => `顯示其餘 ${n} 棟`,
    history: (country: string) => `${country}歷年的大樓數`,
    historyAria: (country: string) => `${country}歷年 150、200、300 m 以上的大樓數`,
    world: '全世界歷年的大樓數',
    worldAria: '全世界歷年 150、200、300 m 以上的大樓數',
    worldNote: (n200: number, n300: number) =>
      `2025 年底 Wikidata 收錄 200 m 以上 ${n200} 棟、300 m 以上 ${n300} 棟；CTBUH 統計的是 ${fixed(CTBUH_WORLD_200, 0)} 棟、${CTBUH_WORLD_300} 棟。`,
    line: (m: number) => `${m} m 以上`,
    undated: (n: number) => `Wikidata 另外有 ${n} 棟沒有完工年份，不算進上面的棟數（有的可能還沒完工）：`,
    undatedMore: (n: number) => `等 ${n} 棟`,
    undatedItem: (name: string, h: string) => `${name}（${h}）`,
    cities: '這些大樓所在的城市有多大、住了多少人：',
    citiesLink: '城市',
    note: '名稱是 Wikidata 的中文名稱，沒有的寫英文名稱；高度是建築高度（含尖塔、不含天線），城市依 Wikidata 的所在行政區。',
    taiwan:
      '台北 101 在 2004 年底完工時是世界最高的建築（508 m），2010 年被杜拜的哈里發塔超過。高雄 85 大樓（1997 年完工）仍在使用：高樓層 2019 年經法拍由海霸王集團取得，引進艾美酒店、整修中（報導預計 2026 年開幕），中山大學國際金融研究學院、高雄市經發局的新創基地已經進駐。臺中最高的臺中商銀總行大樓在 Wikidata 沒有完工年份，所以不在清單上。',
  },
  en: {
    coverage: `Wikidata’s list is incomplete: compared with the CTBUH’s totals at the end of 2025, it has about ${COVERAGE_WORLD_200}% of buildings of 200 m or more (${fixed(CTBUH_WORLD_200, 0)} worldwide) and about ${COVERAGE_WORLD_300}% of those of 300 m or more (${CTBUH_WORLD_300}). The counts below are Wikidata’s, and coverage varies a lot between countries.`,
    china: `China is especially under-covered: the CTBUH counts ${fixed(CTBUH_CHINA_200, 0)} buildings of 200 m or more in China, of which Wikidata has about ${COVERAGE_CHINA_200}%.`,
    title: (country, year) => `Buildings in ${country} (${year})`,
    summary: (n, n200, n300) =>
      `${n} ${n === 1 ? 'building' : 'buildings'} of 150 m or more, of which ${n200} of 200 m+ and ${n300} of 300 m+.`,
    none: (year) => `No buildings of 150 m or more in Wikidata in ${year}.`,
    bandsAria: (country) => `Buildings in ${country} by height`,
    tallest: 'Tallest buildings',
    meta: (h, floors, year, city) => [h, floors ? `${floors} floors` : null, `completed ${year}`, city].filter(Boolean).join(' · '),
    gone: (y) => `demolished or destroyed in ${y}`,
    twin: 'twin towers (counted as two)',
    more: (n) => `Show ${n} more`,
    history: (country) => `Buildings in ${country} over time`,
    historyAria: (country) => `Buildings of 150, 200 and 300 m or more in ${country} over time`,
    world: 'Buildings worldwide over time',
    worldAria: 'Buildings of 150, 200 and 300 m or more worldwide over time',
    worldNote: (n200, n300) =>
      `At the end of 2025 Wikidata had ${n200} buildings of 200 m+ and ${n300} of 300 m+; the CTBUH counts ${fixed(CTBUH_WORLD_200, 0)} and ${CTBUH_WORLD_300}.`,
    line: (m) => `${m} m+`,
    undated: (n) => `Wikidata lists ${n} more without a completion year; they are not counted above (some may be unfinished):`,
    undatedMore: (n) => `(${n} in all)`,
    undatedItem: (name, h) => `${name} (${h})`,
    cities: 'How large are the cities these buildings stand in:',
    citiesLink: 'Cities',
    note: 'Names and heights are from Wikidata; heights are architectural heights (including spires, not antennas), and cities follow Wikidata’s administrative locations.',
    taiwan:
      'Taipei 101 was the world’s tallest building (508 m) when completed at the end of 2004, until the Burj Khalifa in Dubai in 2010. The 85 Sky Tower in Kaohsiung (completed 1997) is still in use: its upper floors were bought at auction in 2019 by a company of the Sea King group, which is refurbishing them for a Le Méridien hotel (reported to open in 2026), and National Sun Yat-sen University and a city start-up hub have moved in. Taichung’s tallest, the Taichung Commercial Bank headquarters, has no completion year in Wikidata and so is not listed.',
  },
});

const standing = (p: PointRecord, year: number) =>
  (p.y as number) <= year && (typeof p.d !== 'number' || p.d > year);
const weight = (p: PointRecord) => (p.n === 2 ? 2 : 1);

export default function SkyscrapersPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<PointsData>(`topics/${topic.id}/buildings.json`);
  const undated = useJson<Undated[]>(`topics/${topic.id}/undated.json`).data;
  const points = useMemo(() => (data ? decodePoints(data) : null), [data]);

  const view = useMemo(() => {
    if (!points) return null;
    const mine = points.filter((p) => p.iso3 === iso3);
    const last = Math.max(...points.map((p) => p.y as number));
    const years = Array.from({ length: last - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
    const count = (list: PointRecord[], min: number, y: number) =>
      list.reduce((s, p) => s + ((p.h as number) >= min && standing(p, y) ? weight(p) : 0), 0);
    const colors = [tokens.hues.aqua, tokens.hues.yellow, tokens.hues.magenta];
    const indicator = topic.indicators.find((i) => i.id === 'supertall')!;
    const chart = (list: PointRecord[]) =>
      timeSeriesOption({
        years,
        lines: LINES.map((min, i) => ({ name: text.line(min), values: years.map((y) => count(list, min, y)), color: colors[i] })),
        year: Math.min(Math.max(year, FIRST_YEAR), last),
        indicator,
        tokens,
      });
    const now = mine.filter((p) => standing(p, year)).sort((a, b) => (b.h as number) - (a.h as number));
    const bands = BANDS.map((b, i) => ({
      key: String(b.min),
      label: tr(b.label, lang),
      value: now.reduce((s, p) => {
        const h = p.h as number;
        return s + (h >= b.min && (i === BANDS.length - 1 || h < BANDS[i + 1].min) ? weight(p) : 0);
      }, 0),
    }));
    return {
      now,
      bands,
      n: count(mine, 150, year),
      n200: count(mine, 200, year),
      n300: count(mine, 300, year),
      history: mine.length ? chart(mine) : null,
      world: chart(points),
      world2025: [count(points, 200, 2025), count(points, 300, 2025)] as const,
    };
  }, [points, iso3, year, tokens, topic, text, lang]);

  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!view) return <p className="empty">{t.loading}</p>;

  const mineUndated = (undated ?? []).filter((u) => u[4] === iso3);
  const row = (p: PointRecord) => {
    const zh = lang === 'zh' && typeof p.zh === 'string';
    const extra = [typeof p.d === 'number' ? text.gone(p.d) : null, p.n === 2 ? text.twin : null].filter(Boolean);
    return (
      <li key={String(p.q)}>
        <span className="plain-title">
          {zh ? buildingName(p, lang) : <span translate="no">{buildingName(p, lang)}</span>}
          {zh && (
            <>
              {' '}
              <span className="muted" translate="no" lang="en">
                {String(p.name)}
              </span>
            </>
          )}
        </span>
        <span className="plain-meta">
          {text.meta(metres(p.h as number), typeof p.fl === 'number' ? p.fl : null, p.y as number, cityName(p, lang))}
          {extra.length > 0 && ` · ${extra.join(' · ')}`}
        </span>
      </li>
    );
  };

  return (
    <section className="panel-section">
      <p className="note">
        {text.coverage}
        {(iso3 === 'CHN' || iso3 === 'HKG' || iso3 === 'MAC') && ` ${text.china}`}
      </p>
      {iso3 === 'TWN' && <p className="note">{text.taiwan}</p>}
      <h3>{text.title(countryName, year)}</h3>
      {view.now.length === 0 ? (
        <p className="empty">{text.none(year)}</p>
      ) : (
        <>
          <p className="panel-year-note">{text.summary(view.n, view.n200, view.n300)}</p>
          <BarList items={view.bands} format={(v) => fixed(v, 0)} ariaLabel={text.bandsAria(countryName)} />
          <h3>{text.tallest}</h3>
          <ul className="plain-list">{view.now.slice(0, SHOWN).map(row)}</ul>
          {view.now.length > SHOWN && (
            <details>
              <summary className="note">{text.more(view.now.length - SHOWN)}</summary>
              <ul className="plain-list">{view.now.slice(SHOWN).map(row)}</ul>
            </details>
          )}
        </>
      )}
      {mineUndated.length > 0 && (
        <p className="note">
          {text.undated(mineUndated.length)}{' '}
          {mineUndated
            .slice(0, UNDATED_SHOWN)
            .map(([, name, zh, h]) => text.undatedItem(lang === 'zh' ? (zh ?? name) : name, metres(h)))
            .join(tr({ zh: '、', en: ', ' }, lang))}
          {mineUndated.length > UNDATED_SHOWN && ` ${text.undatedMore(mineUndated.length)}`}
        </p>
      )}
      {view.history && (
        <>
          <h3>{text.history(countryName)}</h3>
          <EChart option={view.history} height={200} ariaLabel={text.historyAria(countryName)} />
        </>
      )}
      <h3>{text.world}</h3>
      <EChart option={view.world} height={200} ariaLabel={text.worldAria} />
      <p className="note">{text.worldNote(view.world2025[0], view.world2025[1])}</p>
      {view.now.length > 0 && (
        <p className="note">
          {text.cities}{' '}
          <TopicLink topic="cities" iso3={iso3}>
            {text.citiesLink}
          </TopicLink>
        </p>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}

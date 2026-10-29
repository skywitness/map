import { useMemo } from 'react';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { decodePoints } from '../../map/Overlays';
import { SITE_TYPES } from '../world-heritage';
import type { PanelExtraProps, PointRecord, PointsData } from '../types';

/** 一開始列出幾處，其他收在「顯示其餘」 */
const SHOWN = 12;
/** 子項目 → 點的 type 欄位（pipeline 的 CULTURAL、NATURAL、MIXED） */
const ITEM_TYPE: Record<string, number> = { cultural: 1, natural: 2, mixed: 3 };
const SEP = { zh: '、', en: ', ' };

const TEXT = defineMessages({
  zh: {
    title: (country: string) => `${country}的世界遺產`,
    summary: (year: number, n: number, danger: number) => `${year} 年為止 ${n} 處${danger ? `，其中 ${danger} 處列為瀕危` : ''}。`,
    none: (year: number) => `${year} 年為止沒有這一類的世界遺產。`,
    danger: (y: number) => `${y} 年起列為瀕危`,
    shared: (others: string) => `跨國：與${others}`,
    more: (n: number) => `顯示其餘 ${n} 處`,
    note: '名稱是 Wikidata 的中文名稱，沒有的寫 UNESCO 的英文名稱；年份是登錄年份。',
    bioTitle: (country: string) => `${country}的生物圈保護區`,
    bioSummary: (n: number) => `Wikidata 收錄、有座標的 ${n} 處。`,
    bioNone: 'Wikidata 沒有這個國家有座標的生物圈保護區。',
    bioNote: '名稱是 Wikidata 的中文名稱，沒有的寫英文名稱；Wikidata 的生物圈保護區不完整，也有已除名沒標的。',
    bioTaiwan: '台灣不是 UNESCO 的會員，不能參加人與生物圈計畫，沒有生物圈保護區。',
    taiwanTitle: '台灣與世界遺產',
    taiwan:
      '台灣不是《世界遺產公約》的締約國，不能提名世界遺產，所以沒有世界遺產。文化部（前身為文建會）在 2003、2009、2010 年遴選出「臺灣世界遺產潛力點」，目前 18 處，例如太魯閣國家公園、玉山國家公園、大屯火山群、蘭嶼聚落與自然景觀、澎湖石滬群、水金九礦業遺址、樂生療養院，依世界遺產的標準保存、研究與推廣。',
  },
  en: {
    title: (country) => `World Heritage sites in ${country}`,
    summary: (year, n, danger) => `${n} ${n === 1 ? 'site' : 'sites'} by ${year}${danger ? `, ${danger} of them in danger` : ''}.`,
    none: (year) => `No World Heritage sites of this type by ${year}.`,
    danger: (y) => `in danger since ${y}`,
    shared: (others) => `shared with ${others}`,
    more: (n) => `Show ${n} more`,
    note: 'Names are the UNESCO English names; years are years of inscription.',
    bioTitle: (country) => `Biosphere reserves in ${country}`,
    bioSummary: (n) => `${n} ${n === 1 ? 'reserve' : 'reserves'} with coordinates in Wikidata.`,
    bioNone: 'Wikidata has no biosphere reserves with coordinates in this country.',
    bioNote: 'Names come from Wikidata; its biosphere reserves are incomplete and include some withdrawn ones.',
    bioTaiwan: 'Taiwan is not a UNESCO member, so it cannot take part in the Man and the Biosphere Programme and has no biosphere reserves.',
    taiwanTitle: 'Taiwan and World Heritage',
    taiwan:
      'Taiwan is not a State Party to the World Heritage Convention, so it cannot nominate sites and has none on the list. In 2003, 2009 and 2010 the Ministry of Culture (then the Council for Cultural Affairs) selected “Potential World Heritage Sites in Taiwan”, now 18, such as Taroko and Yushan National Parks, the Tatun Volcano Group, Lanyu settlements and landscape, the Penghu stone fish weirs, the Shuijinjiu mining sites and the Losheng Sanatorium, to be conserved, studied and promoted to World Heritage standards.',
  },
});

export default function WorldHeritagePanel(props: PanelExtraProps) {
  return props.indicator.id === 'biosphere' ? <BiosphereSection {...props} /> : <SitesSection {...props} />;
}

/** 生物圈保護區（pipeline/topics/biosphere.py 的 biosphere-points.json）：這一國的保護區，依名稱排 */
function BiosphereSection({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<PointsData>(iso3 === 'TWN' ? null : `topics/${topic.id}/biosphere-points.json`);
  const reserves = useMemo(() => {
    if (!data) return null;
    const name = (p: PointRecord) => (lang === 'zh' && typeof p.zh === 'string' ? p.zh : String(p.name ?? ''));
    return decodePoints(data)
      .filter((p) => [p.iso3, ...(typeof p.more === 'string' ? p.more.split(',') : [])].includes(iso3))
      .map((p) => ({ key: String(p.q), shown: name(p), original: String(p.name ?? '') }))
      .sort((a, b) => a.shown.localeCompare(b.shown, lang === 'zh' ? 'zh-Hant' : 'en'));
  }, [data, iso3, lang]);
  if (iso3 === 'TWN') return <p className="note">{text.bioTaiwan}</p>;
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!reserves) return <p className="empty">{t.loading}</p>;
  const row = (r: (typeof reserves)[number]) => (
    <li key={r.key}>
      <span className="plain-title" translate={r.shown === r.original ? 'no' : undefined}>
        {r.shown}
        {r.shown !== r.original && (
          <>
            {' '}
            <span className="muted" translate="no" lang="en">
              {r.original}
            </span>
          </>
        )}
      </span>
    </li>
  );
  return (
    <section className="panel-section">
      <h3>{text.bioTitle(countryName)}</h3>
      {reserves.length === 0 ? (
        <p className="empty">{text.bioNone}</p>
      ) : (
        <>
          <p className="panel-year-note">{text.bioSummary(reserves.length)}</p>
          <ul className="plain-list">{reserves.slice(0, SHOWN).map(row)}</ul>
          {reserves.length > SHOWN && (
            <details>
              <summary className="note">{text.more(reserves.length - SHOWN)}</summary>
              <ul className="plain-list">{reserves.slice(SHOWN).map(row)}</ul>
            </details>
          )}
        </>
      )}
      <p className="note">{text.bioNote}</p>
    </section>
  );
}

function SitesSection({ topic, iso3, year, item, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<PointsData>(iso3 === 'TWN' ? null : `topics/${topic.id}/sites.json`);
  const points = useMemo(() => (data ? decodePoints(data) : null), [data]);
  const countries = useJson<CountryTable>('countries.json').data;

  const sites = useMemo(() => {
    if (!points) return [];
    const type = item ? ITEM_TYPE[item] : undefined;
    const states = (p: PointRecord) => [p.iso3, ...(typeof p.more === 'string' ? p.more.split(',') : [])];
    return points
      .filter((p) => states(p).includes(iso3) && (p.year as number) <= year && (!type || p.type === type))
      .sort((a, b) => (a.year as number) - (b.year as number) || (a.id as number) - (b.id as number))
      .map((p) => ({ p, others: states(p).filter((s): s is string => typeof s === 'string' && s !== iso3) }));
  }, [points, iso3, year, item]);

  if (iso3 === 'TWN') {
    return (
      <section className="panel-section">
        <h3>{text.taiwanTitle}</h3>
        <p className="note">{text.taiwan}</p>
      </section>
    );
  }
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!points) return <p className="empty">{t.loading}</p>;

  const danger = sites.filter(({ p }) => typeof p.danger === 'number').length;
  const row = ({ p, others }: (typeof sites)[number]) => {
    const zh = lang === 'zh' && typeof p.zh === 'string' ? p.zh : null;
    const meta = [tr(SITE_TYPES[p.type as number] ?? '', lang), String(p.year)];
    if (typeof p.danger === 'number') meta.push(text.danger(p.danger));
    return (
      <li key={String(p.id)}>
        <span className="plain-title">
          {zh ?? <span translate="no">{String(p.name)}</span>}
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
          {meta.join(' · ')}
          {others.length > 0 && ` · ${text.shared(others.map((c) => nameOf(c, countries, lang)).join(tr(SEP, lang)))}`}
        </span>
      </li>
    );
  };

  return (
    <section className="panel-section">
      <h3>{text.title(countryName)}</h3>
      {sites.length === 0 ? (
        <p className="empty">{text.none(year)}</p>
      ) : (
        <>
          <p className="panel-year-note">{text.summary(year, sites.length, danger)}</p>
          <ul className="plain-list">{sites.slice(0, SHOWN).map(row)}</ul>
          {sites.length > SHOWN && (
            <details>
              <summary className="note">{text.more(sites.length - SHOWN)}</summary>
              <ul className="plain-list">{sites.slice(SHOWN).map(row)}</ul>
            </details>
          )}
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}

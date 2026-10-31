import { useMemo } from 'react';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { decodePoints } from '../../map/overlayData';
import { articlesText, kindLabel, LAYERS, placeName } from '../attractions';
import { moreFile, type PanelExtraProps, type PointRecord, type PointsData } from '../types';

/** 每一類列出幾處（依有幾種語言的維基百科有條目） */
const SHOWN = 8;

const TEXT = defineMessages({
  zh: {
    title: (layer: string) => `最有名的${layer}`,
    none: 'Wikidata 沒有收錄。',
    moc: '文化部的博物館名錄',
    note: '依有幾種語言的維基百科有條目排序，只是知名度的粗略指標；Wikidata 的收錄各國差很多，所以不寫總數。',
  },
  en: {
    title: (layer) => `Best-known ${layer.toLowerCase()}`,
    none: 'None in Wikidata.',
    moc: 'From the Ministry of Culture museum list',
    note: 'Ranked by the number of Wikipedia language editions with an article, a rough measure of how well known a place is; Wikidata’s coverage differs a lot between countries, so totals are not given.',
  },
});

export default function AttractionsPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useJsonMany<PointsData>(LAYERS.map((l) => `topics/${topic.id}/${l.id}.json`));
  const decoded = useMemo(() => files.map((f) => (f ? decodePoints(f) : null)), [files]);
  // 博物館分兩個檔（museums.json 是條目語言數 MUSEUM_MIN_SL 以上的，2026-10-31）：這一國在裡面有 SHOWN 座以上時，
  // 最有名的 SHOWN 座一定都在裡面；不到才下載其餘的（museums-more.json，約 0.9 MB）
  const museumIndex = LAYERS.findIndex((l) => l.id === 'museums');
  const museumCount = decoded[museumIndex]?.filter((p) => p.iso3 === iso3).length ?? null;
  const needMore = museumCount !== null && museumCount < SHOWN;
  const moreData = useJson<PointsData>(needMore ? `topics/${topic.id}/${moreFile('museums.json')}` : null).data;
  const moreRows = useMemo(() => (moreData ? decodePoints(moreData) : null), [moreData]);
  const lists = useMemo(
    () =>
      decoded.map((base, i) => {
        const rows = i === museumIndex && needMore ? (base && moreRows ? base.concat(moreRows) : null) : base;
        return rows
          ? rows
              .filter((p) => p.iso3 === iso3)
              .sort((a, b) => Number(b.sl) - Number(a.sl))
              .slice(0, SHOWN)
          : null;
      }),
    [decoded, iso3, museumIndex, needMore, moreRows],
  );
  if (lists.some((l) => !l)) return <p className="empty">{t.loading}</p>;
  const meta = (layer: (typeof LAYERS)[number], p: PointRecord) => {
    const sl = Number(p.sl);
    return [kindLabel(layer, p.t), sl > 0 ? articlesText(sl) : p.moc === 1 ? text.moc : null].filter(Boolean).join(' · ');
  };
  return (
    <>
      {LAYERS.map((layer, i) => {
        const rows = lists[i] ?? [];
        return (
          <section className="panel-section" key={layer.id}>
            <h3>{text.title(tr(layer.label))}</h3>
            {rows.length === 0 ? (
              <p className="empty">{text.none}</p>
            ) : (
              <ul className="plain-list">
                {rows.map((p, j) => {
                  const name = placeName(p, lang);
                  return (
                    <li key={j}>
                      <span className="plain-title">{name}</span>
                      {lang === 'zh' && typeof p.en === 'string' && p.en !== name && (
                        <span className="plain-meta" translate="no">
                          {p.en}
                        </span>
                      )}
                      <span className="plain-meta">{meta(layer, p)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      <p className="note">{text.note}</p>
    </>
  );
}

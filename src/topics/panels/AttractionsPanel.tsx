import { useMemo } from 'react';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { decodePoints } from '../../map/Overlays';
import { articlesText, kindLabel, LAYERS, placeName } from '../attractions';
import type { PanelExtraProps, PointRecord, PointsData } from '../types';

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
  const lists = useMemo(
    () =>
      decoded.map((rows) =>
        rows
          ? rows
              .filter((p) => p.iso3 === iso3)
              .sort((a, b) => Number(b.sl) - Number(a.sl))
              .slice(0, SHOWN)
          : null,
      ),
    [decoded, iso3],
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

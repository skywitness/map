import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { decodePoints } from '../../map/Overlays';
import { placementText } from '../pandas';
import type { PanelExtraProps, PointsData } from '../types';

const TEXT = defineMessages({
  zh: {
    title: (country: string) => `${country}的大熊貓`,
    none: '條目裡沒有這個國家收到大熊貓的紀錄。',
    unnamed: '條目沒寫哪個動物園',
    note: '整理自英文維基百科三個條目的固定版本；熊貓的名字照條目的英文拼法（台灣的寫中文）。',
  },
  en: {
    title: (country) => `Giant pandas in ${country}`,
    none: 'The articles record no giant pandas sent to this country.',
    unnamed: 'Zoo not named in the articles',
    note: 'Compiled from fixed revisions of three English Wikipedia articles; panda names follow the articles’ spelling.',
  },
});

export default function PandasPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<PointsData>(`topics/${topic.id}/zoos.json`);
  const rows = useMemo(
    () => (data ? decodePoints(data).filter((p) => p.iso3 === iso3).sort((a, b) => Number(a.a) - Number(b.a)) : null),
    [data, iso3],
  );
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!rows) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title(countryName)}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <ul className="plain-list">
          {rows.map((p) => {
            const zoo = typeof p.zoo === 'string' ? (lang === 'zh' && typeof p.zooZh === 'string' ? p.zooZh : p.zoo) : text.unnamed;
            const note = lang === 'zh' ? p.zh : p.en;
            return (
              <li key={String(p.i)}>
                <span className="plain-title">{zoo}</span>
                <span className="plain-meta">
                  {placementText(p)}
                  {typeof p.names === 'string' && (
                    <>
                      {' · '}
                      <span translate="no">{p.names}</span>
                    </>
                  )}
                </span>
                {typeof note === 'string' && <span className="plain-meta">{note}</span>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}

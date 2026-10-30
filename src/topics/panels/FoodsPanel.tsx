import { defineMessages, useLang, useT } from '../../i18n';
import { tr } from '../../i18n/lang';
import { useJson } from '../../lib/data';
import { FOOD_KINDS } from '../foods';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/foods.py 的 countries/<ISO3>.json：每種食物一個清單，[中文名, 英文名, 維基百科條目數, QID] */
type Row = [string | null, string, number, string];
type FoodsData = Record<string, Row[]> & { fields: string[] };

const TEXT = defineMessages({
  zh: {
    title: (kind: string, country: string, n: number) => `${country}原產的${kind}（${n} 種）`,
    none: (kind: string) => `Wikidata 沒有原產於這裡的${kind}。`,
    note: '依 Wikidata 的原產國，維基百科條目多的（比較有名的）排前面。',
  },
  en: {
    title: (kind, country, n) => `${kind} from ${country} (${n})`,
    none: (kind) => `Wikidata lists no ${kind.toLowerCase()} from here.`,
    note: 'By country of origin in Wikidata, best known (most Wikipedia articles) first.',
  },
});

export default function FoodsPanel({ topic, iso3, item, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  // 沒有任何特色食物的國家沒有檔案（讀取失敗就當成沒有）
  const { data, error } = useJson<FoodsData>(`topics/${topic.id}/foods/${iso3}.json`);
  if (!data && !error) return <p className="empty">{t.loading}</p>;
  // 目前選的食物放最前面，其他兩種接在後面
  const kinds = [...FOOD_KINDS].sort((a, b) => Number(b.id === item) - Number(a.id === item));
  return (
    <section className="panel-section">
      {kinds.map((kind) => {
        const rows = data?.[kind.id] ?? [];
        const label = tr(kind.label);
        return (
          <div key={kind.id} className="panel-subsection">
            <h3>{text.title(label, countryName, rows.length)}</h3>
            {rows.length === 0 ? (
              <p className="empty">{text.none(label)}</p>
            ) : (
              <ul className="plain-list">
                {rows.map(([zh, en, , qid]) => {
                  const name = lang === 'zh' && zh ? zh : en;
                  return (
                    <li key={qid}>
                      <span className="plain-title">{name}</span>
                      {name !== en && (
                        <span className="plain-meta" translate="no">
                          {en}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      <p className="note">{text.note}</p>
    </section>
  );
}

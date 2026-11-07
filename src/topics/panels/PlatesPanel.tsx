import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { OROGENS } from '../plates';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/plates_today.py 輸出的 plate-shares.json（2026-11-07，製作手冊 542） */
interface PlateShares {
  names: Record<string, [string, string]>;
  countries: Record<string, { plates: [string, number][]; orogens: [string, number][] }>;
}

const TEXT = defineMessages({
  zh: {
    plates: '國土在哪些板塊上',
    orogens: '國土在哪些造山帶裡',
    noOrogens: '不在 PB2002 的造山帶裡。',
    noData: '沒有這一國的國土資料。',
    share: (v: number) => `${fixed(v, 1)}%`,
    note: '面積比例，依 PB2002（Bird 2003）的板塊與造山帶，國土是 Natural Earth 1:50m 的國界。',
  },
  en: {
    plates: 'Plates under the country',
    orogens: 'Orogens',
    noOrogens: 'Not in any PB2002 orogen.',
    noData: 'No land data for this country.',
    share: (v) => `${fixed(v, 1)}%`,
    note: 'Shares of land area, from the PB2002 plates and orogens (Bird 2003); borders are Natural Earth 1:50m.',
  },
});

export default function PlatesPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<PlateShares>(`topics/${topic.id}/plate-shares.json`);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  const row = data.countries[iso3];
  if (!row) return <p className="empty">{text.noData}</p>;
  const name = (code: string) => {
    const n = data.names[code];
    return n ? (lang === 'zh' ? n[0] : n[1]) : code;
  };
  const orogen = (key: string) => (OROGENS[key] ? OROGENS[key][lang] : key);
  return (
    <section className="panel-section">
      <h3>{text.plates}</h3>
      <ul className="plain-list">
        {row.plates.map(([code, share]) => (
          <li key={code}>
            <span className="plain-title">{name(code)}</span>
            <span className="plain-meta">{text.share(share)}</span>
          </li>
        ))}
      </ul>
      <h3>{text.orogens}</h3>
      {row.orogens.length > 0 ? (
        <ul className="plain-list">
          {row.orogens.map(([key, share]) => (
            <li key={key}>
              <span className="plain-title">{orogen(key)}</span>
              <span className="plain-meta">{text.share(share)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">{text.noOrogens}</p>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}

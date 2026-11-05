import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/** detail.json（pipeline/topics/megafauna.py）：現在、應有的種數，與「應該在但現在不在」的 [學名, 體重 kg, IUCN 狀態, 目] */
interface Detail {
  now: number;
  natural: number;
  lost: [string, number, string, string][];
}

const TEXT = defineMessages({
  zh: {
    title: '已經不在這裡的大型哺乳類',
    summary: (now: number, natural: number) => `現在 ${now} 種，沒有人類影響時應有 ${natural} 種。`,
    none: '應該在這裡的大型哺乳類都還在。',
    status: (s: string) =>
      ({ EP: '史前滅絕', EX: '已滅絕', EW: '野外滅絕', CR: '極危', EN: '瀕危', VU: '易危', NT: '近危', LC: '無危', DD: '資料不足' })[s] ?? s,
    statusNote: '「史前滅絕」「已滅絕」「野外滅絕」是全世界都沒有野生族群；其他是還活著、只是不在這一國（IUCN 狀態，2019 年）。學名照 PHYLACINE 1.2。',
    aria: '已經不在這裡的大型哺乳類',
  },
  en: {
    title: 'Large mammals no longer here',
    summary: (now: number, natural: number) => `${now} species today; ${natural} without human impact.`,
    none: 'All the large mammals expected here are still present.',
    status: (s: string) =>
      ({ EP: 'prehistoric extinct', EX: 'extinct', EW: 'extinct in the wild', CR: 'critically endangered', EN: 'endangered', VU: 'vulnerable', NT: 'near threatened', LC: 'least concern', DD: 'data deficient' })[s] ?? s,
    statusNote: '“Prehistoric extinct”, “extinct” and “extinct in the wild” have no wild populations anywhere; the others survive elsewhere but not in this country (IUCN status, 2019). Scientific names as in PHYLACINE 1.2.',
    aria: 'Large mammals no longer here',
  },
});

export default function MegafaunaPanel({ topic, iso3 }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<Record<string, Detail>>(`topics/${topic.id}/detail.json`).data?.[iso3];
  if (!d) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <p>{text.summary(d.now, d.natural)}</p>
      {d.lost.length ? (
        <table className="mini-table" aria-label={text.aria}>
          <tbody>
            {d.lost.map(([name, kg, status]) => (
              <tr key={name}>
                <th scope="row" translate="no">
                  <i>{name}</i>
                </th>
                <td className="num">{fixed(kg, 0)} kg</td>
                <td>{text.status(status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">{text.none}</p>
      )}
      <p className="note">{text.statusNote}</p>
    </section>
  );
}

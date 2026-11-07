import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import type { PanelExtraProps } from '../types';

/**
 * 網路自由度的側欄（2026-11-07，製作手冊第二十七批 590；pipeline/topics/internet_freedom.py 的 questions.json）：
 * 這一國 21 題各得幾分（滿分不同，越接近滿分越自由）。題目是 Freedom House 英文題目的中文摘要。
 */
interface Questions {
  codes: string[];
  max: number[];
  countries: Record<string, number[]>;
}

const TEXT = defineMessages({
  zh: {
    title: '21 題各得幾分',
    head: ['題', '問的是', '得分'],
    groups: { A: '接取障礙', B: '內容限制', C: '使用者權利侵害' } as Record<string, string>,
    q: [
      '基礎設施限制上網或網速', '上網太貴、部分族群用不到', '政府控制基礎設施來斷網', '業者的多樣性受限', '主管機關不獨立',
      '封鎖或過濾內容', '強迫平台刪除內容', '限制不透明、不合比例、無法申訴', '自我審查', '網路資訊被操控', '發表內容的經濟或法規障礙',
      '網路資訊缺乏多樣性與可信度', '線上組織與動員受阻',
      '法律不保障言論自由、司法不獨立', '處罰網路言論的法律', '因網路活動被處罰', '限制匿名或加密', '國家監控侵害隱私',
      '業者蒐集使用者資料侵害隱私', '因網路活動受恐嚇或暴力', '駭客與網路攻擊',
    ],
    note: '每題的分數越接近滿分，代表那個問題越少（越自由）。題目是 Freedom House 英文題目的摘要。',
  },
  en: {
    title: 'Scores on the 21 questions',
    head: ['Q', 'About', 'Score'],
    groups: { A: 'Obstacles to access', B: 'Limits on content', C: 'Violations of user rights' } as Record<string, string>,
    q: [
      'Infrastructure limits access or speed', 'Access too expensive or out of reach', 'Government control of infrastructure to cut connectivity',
      'Obstacles to provider diversity', 'Regulators not independent',
      'Blocking or filtering of content', 'Forced removal of content', 'Restrictions opaque, disproportionate or unappealable', 'Self-censorship',
      'Manipulation of online information', 'Economic or regulatory constraints on publishing', 'Online information lacks diversity and reliability',
      'Online mobilisation impeded',
      'Laws fail to protect expression; judiciary not independent', 'Laws penalising online activity', 'People penalised for online activity',
      'Restrictions on anonymity or encryption', 'State surveillance infringes privacy', 'Company data collection infringes privacy',
      'Intimidation or violence over online activity', 'Hacking and cyberattacks',
    ],
    note: 'The closer a score is to the maximum, the less of that problem (the freer). Questions are summaries of Freedom House’s wording.',
  },
});

export default function InternetFreedomPanel({ topic, iso3 }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<Questions>(`topics/${topic.id}/questions.json`).data;
  const row = d?.countries[iso3];
  if (!d || !row) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <div className="mini-table-scroll">
        <table className="mini-table">
          <thead>
            <tr>
              {text.head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.codes.map((code, i) => (
              <tr key={code} title={text.groups[code[0]]}>
                <td>{code}</td>
                <td>{text.q[i]}</td>
                <td className="num">
                  {row[i]} / {d.max[i]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">{text.note}</p>
    </section>
  );
}

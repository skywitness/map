import { getLang, tr, type Text } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointRecord } from './types';

/**
 * 樂園的四種所有權關係（2026-11-08，製作手冊第二十八批 684，候選 1531；「迪士尼」與「環球影城」共用，
 * pipeline/topics/park_ownership.py）。手冊：九個一樣的點會騙人，四種關係要畫得不一樣。
 */
const C = MAP_TOKENS.categorical;

export const OWNERSHIP: { label: Text; color: string }[] = [
  { label: { zh: '全資', en: 'Wholly owned' }, color: C[0] },
  { label: { zh: '全資子公司經營', en: 'Run by a wholly owned subsidiary' }, color: C[2] },
  { label: { zh: '合資，母公司是小股東', en: 'Joint venture, minority stake' }, color: C[1] },
  { label: { zh: '只授權、不持股', en: 'Licensed only, no stake' }, color: C[5] },
];

/** 點依所有權上色（主題樂園與水上樂園改用點的大小分） */
export const OWNERSHIP_COLORS = {
  field: 'own',
  title: { zh: '所有權', en: 'Ownership' },
  thresholds: [1.5, 2.5, 3.5],
  classes: OWNERSHIP.map(({ label, color }) => ({ label, color })),
};

/** 「上海國際主題樂園公司：申迪集團 57%、迪士尼 43%」這類說明；英文照代碼寫通用的句子 */
export function ownershipText(p: PointRecord, parent: Text): string | null {
  const own = typeof p.own === 'number' ? p.own : null;
  if (!own) return null;
  const label = tr(OWNERSHIP[own - 1].label);
  if (getLang() === 'zh') {
    const note = typeof p.ownnote === 'string' && p.ownnote ? p.ownnote : null;
    return note ? tr({ zh: `${label}：${note}`, en: label }) : tr({ zh: `${label}（${tr(parent)}）`, en: label });
  }
  const share = typeof p.share === 'number' ? p.share : null;
  if (own === 3 && share) return `${label}: ${tr(parent)} holds ${share}%`;
  if (own === 4) return `${label}: licensed by ${tr(parent)}`;
  return `${label} (${tr(parent)})`;
}

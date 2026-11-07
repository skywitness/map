import { defineMessages, useLang, useT } from '../../i18n';
import { tr } from '../../i18n/lang';
import { useJson } from '../../lib/data';
import { SITE_STATUS, SITE_TYPES } from '../contaminated-sites';
import type { PanelExtraProps } from '../types';

/**
 * 污染場址的側欄（2026-11-07，第二十五批 486）：台灣的場址依列管狀態、類型、縣市的件數，與最常見的污染物。
 * 資料是 pipeline/topics/contaminated_sites.py 輸出的 summary.json（類型：[名稱, 全部, 仍列管]）
 */
interface Summary {
  total: number;
  now: number;
  status: number[];
  types: [string, number, number][];
  /** [中文, 英文, 件數] */
  counties: [string, string, number][];
  soil: [string, string, number][];
  water: [string, string, number][];
}

const TEXT = defineMessages({
  zh: {
    title: '台灣的污染場址',
    total: (all: number, now: number) => `2002 年以來公告 ${all.toLocaleString('en-US')} 處，現在仍列管 ${now} 處。`,
    status: '現在的列管狀態',
    types: ['類型', '全部', '仍列管'],
    counties: ['縣市', '公告過的場址'],
    soil: '土壤最常見的污染物（處）',
    water: '地下水最常見的污染物（處）',
    other: '只有台灣的資料。',
    colon: '：',
    sep: '、',
  },
  en: {
    title: 'Contaminated sites in Taiwan',
    total: (all: number, now: number) => `${all.toLocaleString('en-US')} sites listed since 2002; ${now} are still listed.`,
    status: 'Current status',
    types: ['Type', 'All', 'Still listed'],
    counties: ['County or city', 'Sites ever listed'],
    soil: 'Commonest soil pollutants (sites)',
    water: 'Commonest groundwater pollutants (sites)',
    other: 'Taiwan only.',
    colon: ': ',
    sep: ', ',
  },
});

export default function ContaminatedSitesPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data } = useJson<Summary>(iso3 === 'TWN' ? `topics/${topic.id}/summary.json` : null);
  if (iso3 !== 'TWN') return <p className="empty">{text.other}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  // 中文名稱 → 雙語：類型名稱跟 SITE_TYPES 的中文一樣
  const typeLabel = (zh: string) => tr(SITE_TYPES.find((x) => typeof x !== 'string' && x.zh === zh) ?? zh); // i18n-ignore
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <p className="note">{text.total(data.total, data.now)}</p>
      <p className="note">
        {text.status}{text.colon}{data.status.slice(0, 3).map((n, i) => `${tr(SITE_STATUS[i])} ${n}`).join(text.sep)}
      </p>
      <table className="mini-table">
        <thead>
          <tr>
            {text.types.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.types.map(([name, all, now]) => (
            <tr key={name}>
              <td>{typeLabel(name)}</td>
              <td>{all.toLocaleString('en-US')}</td>
              <td>{now}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="mini-table">
        <thead>
          <tr>
            {text.counties.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.counties.slice(0, 8).map(([zh, en, n]) => (
            <tr key={zh}>
              <td>{lang === 'zh' ? zh : en}</td>
              <td>{n.toLocaleString('en-US')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        {text.soil}{text.colon}{data.soil.slice(0, 6).map(([zh, en, c]) => `${lang === 'zh' ? zh : en} ${c.toLocaleString('en-US')}`).join(text.sep)}
      </p>
      <p className="note">
        {text.water}{text.colon}{data.water.slice(0, 6).map(([zh, en, c]) => `${lang === 'zh' ? zh : en} ${c}`).join(text.sep)}
      </p>
    </section>
  );
}

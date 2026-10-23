import { useMemo } from 'react';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { missionType, VISA } from '../diplomacy';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/taiwan_diplomacy.py 的 details.json */
interface DetailsFile {
  /** [類型, 中文簡稱, 正式名稱, 英文名稱, 城市, 駐在國, 網站] */
  missions: [number, string, string, string, string, string, string][];
  countries: Record<string, CountryDetails>;
  /** 領事事務局免簽證名單的更新日期 */
  visaUpdated: string;
}

interface CountryDetails {
  /** 邦交的期間：[建交日期, 斷交日期]，建交 null = 1949 年底以前就有，斷交 null = 至今 */
  a?: [string | null, string | null][];
  /** 在當地的館處（missions 的索引） */
  m?: number[];
  /** 沒有館處時，兼轄的館處（missions 的索引） */
  c?: number[];
  /** 兼轄的館處不在外交部通訊錄裡（陸委會的駐港機構）：[中文名稱, 英文名稱] */
  cx?: [string, string | null][];
  /** 簽證待遇：[類別, 可停留（中文）, 可停留（英文）, 說明（中文）]，同一國可能有好幾種 */
  v?: [number, string | null, string | null, string][];
  /** 領事事務局網站的「簽證及入境須知」 */
  b?: string;
}

const TEXT = defineMessages({
  zh: {
    // 數值卡片已經寫了主題的 noValue（「由陸委會主管」），這裡補充前往的方式
    mainland: '前往中國大陸要用台胞證（臺灣居民來往大陸通行證）；兩岸事務不在外交部與領事事務局的資料裡。',
    hongKong: '前往香港要先網上預辦入境登記；港澳事務由陸委會主管，不在外交部的館處資料裡。',
    relations: '與中華民國（台灣）的邦交',
    allyAt: (year: number) => `${year} 年：邦交國`,
    formerAt: (year: number) => `${year} 年：沒有邦交（曾經是邦交國）`,
    never: '1949 年底以後沒有邦交',
    noneYet: (year: number) => `${year} 年：沒有邦交`,
    period: (start: string | null, end: string | null) =>
      `${start ? `${start} 建交` : '1949 年以前就有邦交'} → ${end ? `${end} 斷交` : '至今'}`,
    missions: (n: number) => `駐外館處（${n} 個）`,
    noMission: '沒有館處',
    coveredBy: '沒有館處，由這些館處兼轄',
    visa: '國人簽證待遇',
    visaRequired: '需事先申請簽證（不在領事事務局的免簽證、落地簽證、電子簽證名單裡）',
    noVisa: '領事事務局沒有這個地方的資料。',
    boca: '領事事務局：簽證及入境須知',
    updated: (date: string) => `免簽證名單更新日期：${date}。各國規定時常變動，出發前請以各國公告為準。`,
  },
  en: {
    mainland:
      'Travel to mainland China uses the Taiwan Compatriot Permit; cross-strait matters are outside the Ministry of Foreign Affairs and Bureau of Consular Affairs data.',
    hongKong:
      'Travel to Hong Kong requires online pre-arrival registration; Hong Kong and Macau affairs fall under the Mainland Affairs Council, not the overseas missions data.',
    relations: 'Diplomatic relations with the Republic of China (Taiwan)',
    allyAt: (year) => `${year}: diplomatic ally`,
    formerAt: (year) => `${year}: no diplomatic relations (former ally)`,
    never: 'No diplomatic relations since 1949',
    noneYet: (year) => `${year}: no diplomatic relations`,
    period: (start, end) => `${start ? `Established ${start}` : 'Relations since before 1950'} → ${end ? `severed ${end}` : 'to date'}`,
    missions: (n) => `Taiwan's missions (${n})`,
    noMission: 'No mission',
    coveredBy: 'No mission; covered by',
    visa: 'Visa access for Taiwan passport holders',
    visaRequired: 'Visa required in advance (not on the Bureau of Consular Affairs visa-free, visa-on-arrival or e-visa list)',
    noVisa: 'The Bureau of Consular Affairs has no information for this place.',
    boca: 'Bureau of Consular Affairs: visa and entry information (in Chinese)',
    updated: (date) => `Visa list updated ${date}. Rules change often; check the destination's own announcements before travelling.`,
  },
});

/** 那一年的 12 月 31 日有沒有邦交（跟 pipeline 的 allies.allied 一樣） */
function alliedAt(periods: [string | null, string | null][], year: number): boolean {
  return periods.some(([start, end]) => (start === null || +start.slice(0, 4) <= year) && (end === null || +end.slice(0, 4) > year));
}

export default function DiplomacyPanel({ topic, iso3, year }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<DetailsFile>(`topics/${topic.id}/details.json`);
  const visaLabel = useMemo(() => new Map(VISA.map((c) => [c.value, tr(c.label, lang)])), [lang]);

  // 台灣：數值卡片與圖表已經寫「台灣是這個主題的觀點」（主題的 noValue），不必再重複
  if (iso3 === 'TWN') return null;
  if (iso3 === 'CHN') return <p className="note">{text.mainland}</p>;
  if (iso3 === 'HKG') return <p className="note">{text.hongKong}</p>;
  if (error) return <p className="empty">{t.noData}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  const c = data.countries[iso3] ?? {};
  const periods = c.a ?? [];
  const status =
    periods.length === 0
      ? text.never
      : alliedAt(periods, year)
        ? text.allyAt(year)
        : periods.some(([start]) => start === null || +start.slice(0, 4) <= year)
          ? text.formerAt(year)
          : text.noneYet(year);
  // 主要館處（大使館、代表處）在前，其他城市的辦事處依名稱排
  const byType = (a: DetailsFile['missions'][number], b: DetailsFile['missions'][number]) =>
    a[0] - b[0] || (lang === 'en' ? a[3].localeCompare(b[3], 'en') : a[1].localeCompare(b[1], 'zh-TW'));
  const own = (c.m ?? []).map((i) => data.missions[i]).sort(byType);
  const covering = (c.c ?? []).map((i) => data.missions[i]);
  // 英文介面沒有英文名稱的兼轄館處不列（只有陸委會的駐港機構，而且都有）
  const extra = (c.cx ?? []).filter(([, en]) => lang === 'zh' || en);

  const missionItem = ([type, name, , nameEn, city, , website]: DetailsFile['missions'][number]) => (
    <li key={name}>
      <span className="plain-title">
        {website.startsWith('https://') || website.startsWith('http://') ? (
          <a href={website} target="_blank" rel="noreferrer">
            {lang === 'en' ? nameEn : name}
          </a>
        ) : lang === 'en' ? (
          nameEn
        ) : (
          name
        )}
      </span>
      <span className="plain-meta">
        {missionType(type)} · <span translate="no">{city}</span>
      </span>
    </li>
  );

  return (
    <section className="panel-section">
      <h3>{text.relations}</h3>
      <p className="panel-figure">{status}</p>
      {periods.length > 0 && (
        <ul className="plain-list">
          {periods.map(([start, end]) => (
            <li key={`${start}-${end}`}>
              <span>{text.period(start, end)}</span>
            </li>
          ))}
        </ul>
      )}

      {own.length > 0 ? (
        <>
          <h3>{text.missions(own.length)}</h3>
          <ul className="plain-list">{own.map(missionItem)}</ul>
        </>
      ) : covering.length + extra.length > 0 ? (
        <>
          <h3>{text.coveredBy}</h3>
          <ul className="plain-list">
            {covering.map(missionItem)}
            {extra.map(([zh, en]) => (
              <li key={zh}>
                <span className="plain-title">{lang === 'en' ? en : zh}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <h3>{text.missions(0)}</h3>
          <p className="empty">{text.noMission}</p>
        </>
      )}

      <h3>{text.visa}</h3>
      {c.v && c.v.length > 0 ? (
        <ul className="plain-list">
          {c.v.map(([category, zhStay, enStay, note]) => (
            <li key={category}>
              <span className="plain-title">
                {visaLabel.get(category)}
                {(lang === 'en' ? enStay : zhStay) && ` · ${lang === 'en' ? enStay : zhStay}`}
              </span>
              {lang === 'zh' && note && <span className="plain-meta">{note}</span>}
            </li>
          ))}
        </ul>
      ) : c.b ? (
        <p className="panel-figure">{text.visaRequired}</p>
      ) : (
        <p className="empty">{text.noVisa}</p>
      )}
      {c.b && (
        <p className="note">
          <a href={c.b} target="_blank" rel="noreferrer">
            {text.boca}
          </a>
        </p>
      )}
      {(c.v || c.b) && <p className="note">{text.updated(data.visaUpdated)}</p>}
    </section>
  );
}

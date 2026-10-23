import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/** countries/<ISO3>.json（pipeline/topics/space.py） */
interface CountryFile {
  total: number;
  first: number;
  /** 目前在軌酬載最多的擁有者（GCAT 的機構短名稱）：[名稱, 顆數] */
  owners: [string, number][];
  /** 蘇聯時期（GCAT 的 SU）的酬載數，只有俄羅斯有 */
  soviet: number;
  /** 酬載不多的國家才有：[國際編號, 名稱, 計畫名稱, 發射日期, 再入或離軌日期, 擁有者代碼] */
  payloads?: [string, string, string, string, string, string][];
}

/** 一開始列出幾顆，其他收在「顯示其餘」 */
const SHOWN = 15;
const n0 = (v: number) => fixed(v, 0);

const TEXT = defineMessages({
  zh: {
    summary: (first: number, total: number) => `${first} 年發射第一顆，GCAT 共收錄 ${n0(total)} 顆酬載（含已經再入大氣層的）。`,
    soviet: (n: number) => `其中 ${n0(n)} 顆是蘇聯時期的。`,
    owners: '目前在軌酬載的主要擁有者',
    ownersAria: (country: string) => `${country}在軌酬載的主要擁有者`,
    list: (country: string) => `${country}的酬載`,
    inOrbit: '在軌道上',
    gone: (date: string) => `${date} 再入或離軌`,
    more: (n: number) => `顯示其餘 ${n} 顆`,
    none: '沒有這個國家擁有的酬載。',
    taiwan:
      '國家太空中心（TASA，2023 年以前是國家太空計畫室 NSPO）的福衛系列：福衛一號（1999）、二號（2004）、三號（2006，6 顆，與美國合作的 COSMIC）、五號（2017）、七號（2019，6 顆，與美國合作的 COSMIC-2）、獵風者（2023，GCAT 記為 FORMOSAT-7R）、福衛八號第一顆（2025）；其他是大學與民間的立方衛星。GCAT 把福衛三號、七號記在台灣名下，實際上是台美合作、共同擁有。',
    note: '名稱與日期是 GCAT 的英文原文（UTC），擁有者是 GCAT 的機構代碼。',
  },
  en: {
    summary: (first, total) => `First payload launched in ${first}; GCAT lists ${n0(total)} payloads in all (including those that have re-entered).`,
    soviet: (n) => `${n0(n)} of them date from the Soviet era.`,
    owners: 'Main owners of payloads now in orbit',
    ownersAria: (country) => `Main owners of payloads in orbit, ${country}`,
    list: (country) => `Payloads of ${country}`,
    inOrbit: 'in orbit',
    gone: (date) => `re-entered or deorbited ${date}`,
    more: (n) => `Show ${n} more`,
    none: 'No payloads owned by this country.',
    taiwan:
      'The FORMOSAT series of the Taiwan Space Agency (TASA, the National Space Organization NSPO before 2023): FORMOSAT-1 (1999), -2 (2004), -3 (2006, six satellites, the COSMIC mission with the US), -5 (2017), -7 (2019, six satellites, COSMIC-2 with the US), TRITON (2023, listed by GCAT as FORMOSAT-7R) and the first FORMOSAT-8 satellite (2025); the rest are university and commercial cubesats. GCAT lists FORMOSAT-3 and -7 under Taiwan, though they are joint Taiwan–US missions.',
    note: 'Names and dates are as given in GCAT (UTC); owners are GCAT organisation codes.',
  },
});

export default function SpacePanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const index = useJson<string[]>(`topics/${topic.id}/countries/index.json`);
  const listed = index.data?.includes(iso3) ?? false;
  const country = useJson<CountryFile>(listed ? `topics/${topic.id}/countries/${iso3}.json` : null);
  // 換國家時不能拿上一個國家的資料來顯示
  const data = listed && !country.loading ? country.data : null;
  const owners = useMemo(() => (data?.owners ?? []).map(([name, value]) => ({ key: name, label: name, value })), [data]);

  if (index.error) return <p className="empty">{t.loadFailed(index.error.message)}</p>;
  if (!index.data || (listed && !data)) return <p className="empty">{t.loading}</p>;
  if (!data) {
    return (
      <section className="panel-section">
        <p className="empty">{text.none}</p>
      </section>
    );
  }

  const row = ([piece, name, plname, launched, gone, owner]: NonNullable<CountryFile['payloads']>[number]) => (
    <li key={piece}>
      <span className="plain-title" translate="no">
        {name}
        {plname && <span className="muted"> {plname}</span>}
      </span>
      <span className="plain-meta">
        <span translate="no">{launched}</span> · {gone ? text.gone(gone) : text.inOrbit} · <span translate="no">{owner}</span>
      </span>
    </li>
  );
  const list = data.payloads ?? [];

  return (
    <section className="panel-section">
      <p className="panel-year-note">
        {text.summary(data.first, data.total)}
        {data.soviet > 0 && ` ${text.soviet(data.soviet)}`}
      </p>
      {iso3 === 'TWN' && <p className="note">{text.taiwan}</p>}
      {owners.length > 0 && (
        <>
          <h3>{text.owners}</h3>
          <BarList items={owners} format={n0} ariaLabel={text.ownersAria(countryName)} properNouns />
        </>
      )}
      {list.length > 0 && (
        <>
          <h3>{text.list(countryName)}</h3>
          <ul className="plain-list">{list.slice(0, SHOWN).map(row)}</ul>
          {list.length > SHOWN && (
            <details>
              <summary className="note">{text.more(list.length - SHOWN)}</summary>
              <ul className="plain-list">{list.slice(SHOWN).map(row)}</ul>
            </details>
          )}
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}

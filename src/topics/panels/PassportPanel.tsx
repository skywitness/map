import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang, useT, type Lang } from '../../i18n';
import { countryName, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { categoryScale } from '../../map/categories';
import { MAP_TOKENS } from '../../theme/tokens';
import { DATA_DATE, EASY, PASSPORT_VISA, PERMIT } from '../passport';
import { VISA } from '../diplomacy';
import type { IndicatorData, PanelExtraProps } from '../types';

/** pipeline/topics/passport.py 的 visa/<護照>.json：一般的指標檔，另外附免簽證天數與改列為「另用通行證」的目的地 */
interface VisaFile extends IndicatorData {
  days?: Record<string, number>;
  /** 改列為「另用通行證」的目的地 → Passport Index 原本的類別 */
  recoded?: Record<string, number>;
}

/** 每一類先列出這麼多個目的地，其餘收在「顯示其餘」裡 */
const SHOWN = 10;
/** 側欄由容易到難列出（圖例是由難到容易），最後是兩岸、港澳的通行證 */
const PERMIT_CODE = 7;
const ORDER = [1, 2, 3, 4, 5, 6, PERMIT_CODE];
/** mini-table 的儲存格沒有左右間距，英文的長字會黏在一起 */
const GAP = { paddingRight: 8 };

const TEXT = defineMessages({
  zh: {
    title: (country: string) => `持${country}護照`,
    summary: (easy: number, total: number) =>
      `${total} 個目的地中，${easy} 個可以免簽證、落地簽證或只要上網申請旅行授權（Passport Index，${DATA_DATE}）。`,
    toHere: (passport: string, country: string) => `持${passport}護照前往${country}`,
    days: (n: number) => `${n} 天`,
    count: (n: number) => `${n} 個`,
    withDays: (name: string, days: string) => `${name}（${days}）`,
    sep: '、',
    recoded: (original: string) => `Passport Index 原列「${original}」`,
    more: (n: number) => `顯示其餘 ${n} 個`,
    compare: '跟外交部領事事務局的名單比對',
    compareSummary: (common: number, same: number, date: string) =>
      `兩邊都有的 ${common} 個目的地中，${same} 個類別相同、${common - same} 個不同（領事事務局 ${date ? `${date} ` : '最新'}版，Passport Index ${DATA_DATE}）。`,
    destination: '目的地',
    boca: '領事事務局',
    passportIndex: 'Passport Index',
    moreRows: (n: number) => `顯示其餘 ${n} 個不同的目的地`,
    compareNote:
      '差異多半來自：資料日期不同（Passport Index 是 2026 年 2 月）；分類方式不同（例如領事事務局把澳洲的 ETA、肯亞的 eTA 列為電子簽證，Passport Index 列為旅行授權；同一國有好幾種方式時，領事事務局這邊取最方便的一種）；Passport Index 把領事事務局列為需事先申請的一些國家列成電子簽證、落地簽證或不准入境。只有 Passport Index 有的是中國大陸、香港（由陸委會主管）與巴勒斯坦；只有領事事務局有的是關島、波多黎各等屬地。',
    compareMissing: '台灣的外交主題的簽證資料載入失敗，沒辦法比對。',
    caveat: '各國規定時常變動，出發前請以各國公告為準。',
  },
  en: {
    title: (country) => `With a ${country} passport`,
    summary: (easy, total) =>
      `${easy} of ${total} destinations are visa-free, visa on arrival or need only an online travel authorisation (Passport Index, ${DATA_DATE}).`,
    toHere: (passport, country) => `${passport} passport to ${country}`,
    days: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
    count: (n) => String(n),
    withDays: (name, days) => `${name} (${days})`,
    sep: ', ',
    recoded: (original) => `Passport Index lists “${original}”`,
    more: (n) => `Show ${n} more`,
    compare: 'Compared with the Bureau of Consular Affairs list',
    compareSummary: (common, same, date) =>
      `Of the ${common} destinations in both, ${same} have the same category and ${common - same} differ (Bureau of Consular Affairs list${date ? ` of ${date}` : ''}, Passport Index ${DATA_DATE}).`,
    destination: 'Destination',
    boca: 'Consular Affairs',
    passportIndex: 'Passport Index',
    moreRows: (n) => `Show ${n} more differences`,
    compareNote:
      'Most differences come from different dates (Passport Index is from February 2026), different classifications (the Bureau of Consular Affairs lists the Australian ETA and the Kenyan eTA as e-visas, Passport Index as travel authorisations; where a country offers several options, the Bureau side shows the most convenient), and Passport Index listing some countries as e-visa, visa on arrival or no admission where the Bureau says a visa is required. Only Passport Index covers mainland China, Hong Kong (both under the Mainland Affairs Council) and Palestine; only the Bureau covers territories such as Guam and Puerto Rico.',
    compareMissing: 'The visa data of the Taiwan foreign relations topic failed to load, so no comparison is shown.',
    caveat: "Rules change often; check the destination's own announcements before travelling.",
  },
});

const categoryLabel = (code: number, lang: Lang) =>
  tr(PASSPORT_VISA.find((c) => c.value === code)?.label ?? (code === PERMIT_CODE ? PERMIT : ''), lang);

export default function PassportPanel({ topic, iso3, item, countryName: name }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const countries = useJson<CountryTable>('countries.json').data;
  const isPassport = topic.dimension?.options.some((o) => o.id === iso3) ?? false;
  const own = useJson<VisaFile>(isPassport ? `topics/${topic.id}/visa/${iso3}.json` : null);
  // useJson 換檔時會留著上一份資料，換國家時不能拿上一本護照來顯示
  const data = isPassport && !own.loading ? own.data : null;
  // 選單換成別的護照時（地圖畫的是那本），先寫那本護照到這個國家要不要簽證
  const otherPassport = item && item !== iso3 ? item : null;
  const other = useJson<VisaFile>(otherPassport ? `topics/${topic.id}/visa/${otherPassport}.json` : null);
  const otherData = otherPassport && !other.loading ? other.data : null;
  const twn = iso3 === 'TWN';
  const boca = useJson<IndicatorData>(twn ? 'topics/taiwan-diplomacy/visa.json' : null);
  const bocaManifest = useJson<{ visaListUpdated?: string }>(twn ? 'topics/taiwan-diplomacy/manifest.json' : null);

  const scale = useMemo(() => {
    const layer = topic.indicators.find((i) => i.id === 'visa')?.layer;
    return layer?.kind === 'categorical' ? categoryScale(layer, MAP_TOKENS) : null;
  }, [topic]);
  const swatch = (code: number) => (
    <span
      className="legend-swatch"
      style={{ display: 'inline-block', verticalAlign: '-1px', background: scale?.color(code) ?? undefined }}
      aria-hidden="true"
    />
  );

  const nameOf = useMemo(() => {
    const cache = new Map<string, string>();
    return (code: string) => {
      let n = cache.get(code);
      if (n === undefined) cache.set(code, (n = countryName(code, countries, lang)));
      return n;
    };
  }, [countries, lang]);

  // 各類的目的地，依目前語言的國名排序
  const groups = useMemo(() => {
    if (!data) return null;
    const collator = new Intl.Collator(lang === 'zh' ? 'zh-TW' : 'en');
    const byCode = new Map<number, string[]>();
    for (const [dest, series] of Object.entries(data.values)) {
      const code = series[0];
      if (code == null) continue;
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code)!.push(dest);
    }
    for (const list of byCode.values()) list.sort((a, b) => collator.compare(nameOf(a), nameOf(b)));
    return byCode;
  }, [data, lang, nameOf]);

  // 台灣護照 vs 領事事務局（代碼相同：1 免簽證 … 5 需事先申請）
  const comparison = useMemo(() => {
    if (!twn || !data || !boca.data) return null;
    const collator = new Intl.Collator(lang === 'zh' ? 'zh-TW' : 'en');
    const common: string[] = [];
    const diffs: { dest: string; boca: number; pi: number }[] = [];
    for (const [dest, series] of Object.entries(data.values)) {
      const pi = series[0];
      const b = boca.data.values[dest]?.[0];
      if (pi == null || b == null) continue;
      common.push(dest);
      if (pi !== b) diffs.push({ dest, boca: b, pi });
    }
    diffs.sort((a, b) => collator.compare(nameOf(a.dest), nameOf(b.dest)));
    return { common: common.length, same: common.length - diffs.length, diffs };
  }, [twn, data, boca.data, lang, nameOf]);

  // 選單上的護照到這個國家
  const toHere = otherData?.values[iso3]?.[0];
  // Passport Index 沒有收的地方（屬地等）：數值卡片已經寫了主題的 noValue，這裡沒有東西可列
  if (!isPassport && (!otherPassport || (otherData && toHere == null))) return null;
  if (own.error) return <p className="empty">{t.loadFailed(own.error.message)}</p>;
  if ((isPassport && !data) || (otherPassport && !otherData && !other.error)) return <p className="empty">{t.loading}</p>;

  const destLabel = (file: VisaFile, dest: string) => {
    const days = file.days?.[dest];
    const original = file.recoded?.[dest];
    const n = nameOf(dest);
    if (days) return text.withDays(n, text.days(days));
    if (original !== undefined) return text.withDays(n, text.recoded(categoryLabel(original, lang)));
    return n;
  };

  const bocaLabel = (code: number) => tr(VISA.find((c) => c.value === code)?.label ?? '', lang);
  const diffRow = ({ dest, boca: b, pi }: { dest: string; boca: number; pi: number }) => (
    <tr key={dest}>
      <td style={GAP}>{nameOf(dest)}</td>
      <td style={GAP}>{bocaLabel(b)}</td>
      <td>{categoryLabel(pi, lang)}</td>
    </tr>
  );
  const diffTable = (rows: NonNullable<typeof comparison>['diffs']) => (
    <table className="mini-table">
      <thead>
        <tr>
          <th scope="col" style={GAP}>
            {text.destination}
          </th>
          <th scope="col" style={GAP}>
            {text.boca}
          </th>
          <th scope="col">{text.passportIndex}</th>
        </tr>
      </thead>
      <tbody>{rows.map(diffRow)}</tbody>
    </table>
  );

  return (
    <section className="panel-section">
      {otherPassport && toHere != null && otherData && (
        <>
          <h3>{text.toHere(nameOf(otherPassport), name)}</h3>
          <p className="panel-figure">
            {swatch(toHere)} {categoryLabel(toHere, lang)}
            {otherData.days?.[iso3] ? ` · ${text.days(otherData.days[iso3])}` : ''}
            {otherData.recoded?.[iso3] !== undefined && (
              <span className="muted"> · {text.recoded(categoryLabel(otherData.recoded[iso3], lang))}</span>
            )}
          </p>
        </>
      )}

      {data && groups && (
        <>
          <h3>{text.title(name)}</h3>
          <p className="panel-year-note">
            {text.summary(
              ORDER.filter((c) => EASY.has(c)).reduce((n, c) => n + (groups.get(c)?.length ?? 0), 0),
              Object.keys(data.values).length,
            )}
          </p>
          <BarList
            items={ORDER.filter((c) => groups.has(c)).map((code) => ({
              key: String(code),
              label: categoryLabel(code, lang),
              value: groups.get(code)!.length,
              color: scale?.color(code) ?? undefined,
            }))}
            format={text.count}
            total={Object.keys(data.values).length}
            ariaLabel={text.title(name)}
          />
          {ORDER.filter((c) => groups.has(c)).map((code) => {
            const list = groups.get(code)!;
            return (
              <div key={code}>
                <h4>
                  {swatch(code)} {categoryLabel(code, lang)}
                </h4>
                <p className="panel-year-note">{list.slice(0, SHOWN).map((d) => destLabel(data, d)).join(text.sep)}</p>
                {list.length > SHOWN && (
                  <details>
                    <summary className="note">{text.more(list.length - SHOWN)}</summary>
                    <p className="panel-year-note">{list.slice(SHOWN).map((d) => destLabel(data, d)).join(text.sep)}</p>
                  </details>
                )}
              </div>
            );
          })}
        </>
      )}

      {twn && (
        <>
          <h3>{text.compare}</h3>
          {boca.error ? (
            <p className="empty">{text.compareMissing}</p>
          ) : !comparison ? (
            <p className="empty">{t.loading}</p>
          ) : (
            <>
              <p className="panel-year-note">
                {text.compareSummary(comparison.common, comparison.same, bocaManifest.data?.visaListUpdated ?? '')}
              </p>
              {diffTable(comparison.diffs.slice(0, SHOWN))}
              {comparison.diffs.length > SHOWN && (
                <details>
                  <summary className="note">{text.moreRows(comparison.diffs.length - SHOWN)}</summary>
                  {diffTable(comparison.diffs.slice(SHOWN))}
                </details>
              )}
              <p className="note">{text.compareNote}</p>
            </>
          )}
        </>
      )}
      <p className="note">{text.caveat}</p>
    </section>
  );
}

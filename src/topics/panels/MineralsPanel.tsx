import { BarList } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';
import TradePanel from './TradePanel';

/** pipeline/topics/minerals.py 輸出的彙整檔：每年、每個國家是主要生產國的礦種 */
interface TopProducersFile {
  /** 列出的條件：前 minRank 名而且占 minRankShare% 以上，或占 minShare% 以上 */
  minRank: number;
  minRankShare: number;
  minShare: number;
  years: number[];
  /** {年: {國家: [[礦種, 名次, 占全球 %, 產量（公噸）], …]}}，依占比由大到小 */
  byYear: Record<string, Record<string, [string, number, number, number][]>>;
}

const TEXT = defineMessages({
  zh: {
    title: '主要生產的礦產',
    year: (year: number, estimate: boolean) => `${year} 年${estimate ? '（初估）' : ''} · 占全球產量`,
    rank: (name: string, rank: number) => `${name} · 第 ${rank} 名`,
    note: (n: number, rank: number, rankShare: number, share: number) =>
      `這個主題的 ${n} 種礦產裡，這個國家排全球前 ${rank} 名（而且占 ${rankShare}% 以上）或占全球產量 ${share}% 以上的，依占比排列。名次只比 USGS 列出的國家，同值同名次。`,
    none: (year: number, n: number, rank: number, rankShare: number, share: number) =>
      `${year} 年這個國家不是這 ${n} 種礦產的主要生產國（全球前 ${rank} 名而且占 ${rankShare}% 以上，或占 ${share}% 以上）。USGS 只列出主要生產國，其餘併入「其他國家」。`,
    taiwan: (n: number) =>
      `USGS 這 ${n} 種礦產的產量表都沒有台灣：台灣沒有開採這些礦（曬鹽 2002 年停止），電子、電池、鋼鐵等產業所需的原料幾乎全部仰賴進口。`,
  },
  en: {
    title: 'Main minerals produced',
    year: (year, estimate) => `${year}${estimate ? ' (preliminary)' : ''} · share of world output`,
    rank: (name, rank) => `${name} · #${rank}`,
    note: (n, rank, rankShare, share) =>
      `Of the ${n} minerals in this topic, those where the country ranks in the world top ${rank} (with at least ${rankShare}% of output) or produces at least ${share}% of world output, sorted by share. Ranks compare only the countries USGS lists; ties share a rank.`,
    none: (year, n, rank, rankShare, share) =>
      `In ${year} this country was not a main producer of any of the ${n} minerals (world top ${rank} with at least ${rankShare}% of output, or at least ${share}%). USGS lists only the main producers and groups the rest as "Other countries".`,
    taiwan: (n) =>
      `Taiwan appears in none of the USGS production tables for these ${n} minerals: it does not mine them (its solar salt works closed in 2002), and its electronics, battery and steel industries rely almost entirely on imported raw materials.`,
  },
});

/** mining-rights-tw.json（pipeline/topics/minerals_rights_tw.py）：地礦中心的現存礦業權清冊彙總 */
interface TaiwanRights {
  date: string;
  rights: number;
  offshore: number;
  onshoreArea: number;
  minerals: [string, number][];
  counties: [string, number][];
}

const TW_TEXT = defineMessages({
  zh: {
    title: '台灣現存的礦業權',
    summary: (date: string, n: number, offshore: number, area: number) =>
      `經濟部地質調查及礦業管理中心的現存礦業權清冊（製表日 ${date}）：${n} 個礦區，其中 ${offshore} 個是海域的石油天然氣礦區；陸上礦區合計約 ${fixed(area, 0)} 公頃。`,
    minerals: '各礦種的礦區數',
    counties: (list: string) => `所在縣市：${list}`,
    note: '一個礦區常登記好幾種礦，各礦種都算一次。海域礦區的面積欄跟陸上的單位對不上，不算進面積。',
    count: (v: number) => `${fixed(v, 0)} 區`,
    sep: '、',
  },
  en: {
    title: 'Mining rights in force in Taiwan',
    summary: (date: string, n: number, offshore: number, area: number) =>
      `Register of current mining rights, Geological Survey and Mining Management Agency (as of ${date}): ${n} mining areas, ${offshore} of them offshore oil and gas blocks; onshore areas total about ${fixed(area, 0)} ha.`,
    minerals: 'Mining areas by mineral',
    counties: (list: string) => `By county: ${list}`,
    note: 'Many areas are licensed for several minerals, each counted once. Offshore block areas use a unit inconsistent with onshore ones and are left out of the total.',
    count: (v: number) => `${fixed(v, 0)}`,
    sep: ', ',
  },
});

function TaiwanRightsSection({ folder }: { folder: string }) {
  const lang = useLang();
  const text = TW_TEXT[lang];
  const { data } = useJson<TaiwanRights>(`topics/${folder}/mining-rights-tw.json`);
  if (!data) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <p className="note">{text.summary(data.date, data.rights, data.offshore, data.onshoreArea)}</p>
      <BarList
        items={data.minerals.slice(0, 12).map(([name, n]) => ({ key: name, label: name, value: n }))}
        format={text.count}
        ariaLabel={text.minerals}
      />
      <p className="note">{text.counties(data.counties.map(([c, n]) => `${c} ${n}`).join(text.sep))}</p>
      <p className="note">{text.note}</p>
    </section>
  );
}

/** 子項目名稱去掉括號裡的計量口徑：「稀土（氧化物當量）」→「稀土」 */
const shortName = (label: string) => label.replace(/（.*）$|\s*\(.*\)$/, '');

export default function MineralsPanel(props: PanelExtraProps) {
  // 貿易流向的指標（稀土、永久磁鐵、鈾）：列出主要出口對象與進口來源，跟貿易主題一樣
  if (props.indicator.layer.kind === 'flow') return <TradePanel {...props} />;
  return <ProducerPanel {...props} />;
}

function ProducerPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<TopProducersFile>(`topics/${topic.id}/top-producers.json`);
  if (error) return null;
  if (!data) return <p className="empty">{t.loading}</p>;

  const shownYear = [...data.years].reverse().find((y) => y <= year) ?? data.years[0];
  const rows = data.byYear[String(shownYear)]?.[iso3] ?? [];
  const options = topic.dimension?.options ?? [];
  const names = new Map(options.map((o) => [o.id, shortName(o.label)]));
  const estimate = shownYear === data.years[data.years.length - 1];

  return (
    <>
      <section className="panel-section">
        <h3>{text.title}</h3>
        {rows.length === 0 ? (
          <p className="empty">
            {iso3 === 'TWN'
              ? text.taiwan(options.length)
              : text.none(shownYear, options.length, data.minRank, data.minRankShare, data.minShare)}
          </p>
        ) : (
          <>
            <p className="panel-year-note">
              {text.year(shownYear, estimate)}
              {shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
            </p>
            <BarList
              items={rows.map(([id, rank, share]) => ({
                key: id,
                label: text.rank(names.get(id) ?? id, rank),
                value: share,
              }))}
              format={(v) => `${fixed(v, v < 1 ? 2 : 1)}%`}
              max={100}
              ariaLabel={`${countryName} · ${text.title}`}
            />
            <p className="note">{text.note(options.length, data.minRank, data.minRankShare, data.minShare)}</p>
          </>
        )}
      </section>
      {iso3 === 'TWN' && <TaiwanRightsSection folder={topic.id} />}
    </>
  );
}

import { BarList } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { tr } from '../../i18n/lang';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import type { PanelExtraProps, Text } from '../types';
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
      `USGS 這 ${n} 種礦產的產量表都沒有台灣：電子、電池、鋼鐵等產業所需的金屬原料幾乎全部仰賴進口（曬鹽 2002 年停止）；台灣自己挖的主要是水泥用的大理石，見下方礦務局的統計。`,
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
      `Taiwan appears in none of the USGS production tables for these ${n} minerals: its electronics, battery and steel industries rely almost entirely on imported metal ores (its solar salt works closed in 2002). What Taiwan mines is mainly marble for cement; see the mining agency’s figures below.`,
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

/**
 * taiwan-production.json（pipeline/topics/minerals_economy.py）：礦務局的主要礦產品產銷量值表（依產值排序）與礦業權費、權利金。
 * items：[名稱, 英文名稱, 單位, 英文單位, 生產量, 生產值（新台幣元）]；fees：[年, 礦業權費, 礦產權利金]（元）
 */
interface TaiwanProduction {
  year: number;
  items: [string, string, string, string, number, number][];
  fees: [number, number, number][];
}

const PROD_TEXT = defineMessages({
  zh: {
    title: (year: number) => `台灣挖出什麼（${year} 年）`,
    summary: (n: number, m: number, total: string) =>
      `經濟部地質調查及礦業管理中心的主要礦產品產銷量值表：${n} 種礦產品裡 ${m} 種有生產，產值合計 ${total} 元，依產值排列。`,
    item: (name: string, qty: string, unit: string) => `${name} · ${qty} ${unit}`,
    value: (v: number) => `${formatLargeNumber(v)} 元`,
    zero: (list: string) => `沒有生產：${list}。`,
    fees: (year: number, fee: string, royalty: string, first: number, royalty0: string) =>
      `${year} 年徵收礦業權費 ${fee} 元、礦產權利金 ${royalty} 元（${first} 年權利金 ${royalty0} 元）。`,
    note: '礦種是礦務局自己的分類，跟 USGS 的礦種對不起來：「大理石（供交水泥用）」是水泥原料。單位照原表。砂石屬土石採取，不在這張表。',
    sep: '、',
  },
  en: {
    title: (year: number) => `What Taiwan mines (${year})`,
    summary: (n: number, m: number, total: string) =>
      `Output of main mineral products, Geological Survey and Mining Management Agency: ${m} of ${n} products were produced, worth NT$${total} in all, sorted by value.`,
    item: (name: string, qty: string, unit: string) => `${name} · ${qty} ${unit}`,
    value: (v: number) => `NT$${formatLargeNumber(v)}`,
    zero: (list: string) => `Not produced: ${list}.`,
    fees: (year: number, fee: string, royalty: string, first: number, royalty0: string) =>
      `In ${year} the agency collected NT$${fee} in mining-right fees and NT$${royalty} in royalties (royalties in ${first}: NT$${royalty0}).`,
    note: 'The categories are the agency’s own and do not match USGS commodities: “marble (for cement)” is cement feedstock. Units are as published. Sand and gravel fall under a separate quarrying law and are not in this table.',
    sep: ', ',
  },
});

function TaiwanProductionSection({ folder }: { folder: string }) {
  const lang = useLang();
  const text = PROD_TEXT[lang];
  const { data } = useJson<TaiwanProduction>(`topics/${folder}/taiwan-production.json`);
  if (!data) return null;
  const produced = data.items.filter((r) => r[4] > 0);
  const zero = data.items.filter((r) => r[4] === 0).map((r) => (lang === 'en' ? r[1] : r[0]));
  const total = data.items.reduce((sum, r) => sum + r[5], 0);
  const fees = data.fees[data.fees.length - 1];
  const first = data.fees[0];
  return (
    <section className="panel-section">
      <h3>{text.title(data.year)}</h3>
      <p className="note">{text.summary(data.items.length, produced.length, formatLargeNumber(total))}</p>
      <BarList
        items={produced.map((r) => ({
          key: r[0],
          label: text.item(lang === 'en' ? r[1] : r[0], fixed(r[4], 0), lang === 'en' ? r[3] : r[2]),
          value: r[5],
        }))}
        format={text.value}
        ariaLabel={text.title(data.year)}
      />
      {zero.length > 0 && <p className="note">{text.zero(zero.join(text.sep))}</p>}
      {fees && first && (
        <p className="note">
          {text.fees(fees[0], formatLargeNumber(fees[1]), formatLargeNumber(fees[2]), first[0], formatLargeNumber(first[2]))}
        </p>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}

/** ores-exports-mix/（pipeline/topics/minerals_economy.py）：一年一檔，{國家: [[品項序號, 占礦石與金屬出口 %], …]} */
interface OresMixIndex {
  years: number[];
  groups: string[];
}

/** 品項（SITC Rev. 2 的三位碼，金屬礦砂拆四位碼），跟 pipeline 的 MIX_GROUPS 同 id */
const ORE_GROUPS: Record<string, Text> = {
  fertilizers: { zh: '天然肥料原料', en: 'Crude fertilizers' },
  stone: { zh: '石材、砂與礫石', en: 'Stone, sand and gravel' },
  sulphur: { zh: '硫磺與黃鐵礦', en: 'Sulphur and iron pyrites' },
  abrasives: { zh: '天然研磨料（含工業鑽石）', en: 'Natural abrasives (incl. industrial diamonds)' },
  'other-crude': { zh: '其他原礦物', en: 'Other crude minerals' },
  'iron-ore': { zh: '鐵礦砂', en: 'Iron ore' },
  'steel-scrap': { zh: '鋼鐵廢料', en: 'Iron and steel scrap' },
  'uranium-ore': { zh: '鈾、釷礦砂', en: 'Uranium and thorium ores' },
  'copper-ore': { zh: '銅礦砂', en: 'Copper ores' },
  'nickel-ore': { zh: '鎳礦砂', en: 'Nickel ores' },
  bauxite: { zh: '鋁礦砂（鋁土礦）', en: 'Aluminium ores (bauxite)' },
  'lead-ore': { zh: '鉛礦砂', en: 'Lead ores' },
  'zinc-ore': { zh: '鋅礦砂', en: 'Zinc ores' },
  'tin-ore': { zh: '錫礦砂', en: 'Tin ores' },
  'manganese-ore': { zh: '錳礦砂', en: 'Manganese ores' },
  'other-ore': { zh: '其他金屬礦砂（鉻、鈷、鎢、鉬、鈦…）', en: 'Other base-metal ores (chromium, cobalt, tungsten, molybdenum, titanium…)' },
  'metal-scrap': { zh: '非鐵金屬廢料與含金屬的灰渣', en: 'Non-ferrous scrap and metal-bearing ash' },
  'precious-ore': { zh: '貴金屬礦砂與廢料', en: 'Precious-metal ores and scrap' },
  'silver-pgm': { zh: '銀與鉑族金屬', en: 'Silver and platinum-group metals' },
  copper: { zh: '銅', en: 'Copper' },
  nickel: { zh: '鎳', en: 'Nickel' },
  aluminium: { zh: '鋁', en: 'Aluminium' },
  lead: { zh: '鉛', en: 'Lead' },
  zinc: { zh: '鋅', en: 'Zinc' },
  tin: { zh: '錫', en: 'Tin' },
  uranium: { zh: '鈾（耗乏鈾）與釷', en: 'Depleted uranium and thorium' },
  'other-metals': { zh: '其他賤金屬（鎢、鉬、鈷、鎂…）', en: 'Other base metals (tungsten, molybdenum, cobalt, magnesium…)' },
};

const MIX_TEXT = defineMessages({
  zh: {
    title: '出口的是哪些礦與金屬',
    year: (year: number) => `${year} 年 · 占礦石與金屬出口`,
    none: (year: number) => `${year} 年這個國家的礦石與金屬出口不到 100 萬美元，或 Atlas 沒有資料。`,
    note: '礦石與金屬出口裡前 5 項各占幾 %（分母是礦石與金屬出口，不是全部出口），Harvard Atlas 的 SITC Rev. 2；跟地圖的世界銀行數字來源不同，總額可能有出入。',
    taiwan: '台灣沒有向聯合國申報，數字來自貿易夥伴的申報。',
  },
  en: {
    title: 'Which ores and metals it exports',
    year: (year: number) => `${year} · share of ores and metals exports`,
    none: (year: number) => `In ${year} this country exported less than US$1 million of ores and metals, or the Atlas has no data.`,
    note: 'Top five items as a share of the country’s ores and metals exports (not of all exports), from the Harvard Atlas (SITC Rev. 2); the source differs from the World Bank figures on the map, so totals may not match.',
    taiwan: 'Taiwan does not report to the UN; its figures come from its partners’ reports.',
  },
});

function OresMixSection({ folder, iso3, year, countryName }: { folder: string; iso3: string; year: number; countryName: string }) {
  const lang = useLang();
  const t = useT();
  const text = MIX_TEXT[lang];
  const { data: index } = useJson<OresMixIndex>(`topics/${folder}/ores-exports-mix/index.json`);
  const years = index?.years ?? [];
  const shownYear = years.length ? Math.min(Math.max(year, years[0]), years[years.length - 1]) : null;
  const { data } = useJson<Record<string, [number, number][]>>(
    shownYear === null ? null : `topics/${folder}/ores-exports-mix/${shownYear}.json`,
  );
  if (!index || !data || shownYear === null) return null;
  const rows = data[iso3] ?? [];
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.none(shownYear)}</p>
      ) : (
        <>
          <p className="panel-year-note">
            {text.year(shownYear)}
            {shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
          </p>
          <BarList
            items={rows.map(([i, share]) => {
              const id = index.groups[i];
              return { key: id, label: ORE_GROUPS[id] ? tr(ORE_GROUPS[id]) : id, value: share };
            })}
            format={(v) => `${fixed(v, v < 10 ? 1 : 0)}%`}
            max={100}
            ariaLabel={`${countryName} · ${text.title}`}
          />
        </>
      )}
      <p className="note">
        {text.note}
        {iso3 === 'TWN' && text.taiwan}
      </p>
    </section>
  );
}

/** 子項目名稱去掉括號裡的計量口徑：「稀土（氧化物當量）」→「稀土」 */
const shortName = (label: string) => label.replace(/（.*）$|\s*\(.*\)$/, '');

export default function MineralsPanel(props: PanelExtraProps) {
  // 貿易流向的指標（稀土、永久磁鐵、鈾）：列出主要出口對象與進口來源，跟貿易主題一樣
  if (props.indicator.layer.kind === 'flow') return <TradePanel {...props} />;
  // 礦石與金屬出口占比（第二十五批 445）：先列這一國出口的是哪些礦與金屬
  return (
    <>
      {props.indicator.id === 'ores-exports' && (
        <OresMixSection folder={props.topic.id} iso3={props.iso3} year={props.year} countryName={props.countryName} />
      )}
      <ProducerPanel {...props} />
    </>
  );
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
      {iso3 === 'TWN' && <TaiwanProductionSection folder={topic.id} />}
      {iso3 === 'TWN' && <TaiwanRightsSection folder={topic.id} />}
    </>
  );
}

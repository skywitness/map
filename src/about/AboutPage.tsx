import { useEffect, useMemo, useState } from 'react';
import { defineMessages, langParam, setLang, tr, useLang } from '../i18n';
import { siteRoot } from '../lib/url-state';
import { useTheme } from '../theme/useTheme';
import { CATALOG } from '../topics/catalog.gen';
import { LICENSE_KINDS, licenseKind, sourceKinds, type LicenseKind } from './sources';
import { INDICATOR_COUNT, SOURCES, TOPIC_COUNT } from './sources.gen';

/**
 * 關於這個網站（製作手冊第十五批 262，2026-11-01；使用者 6 題都選 A）：獨立的頁面 about/，不載入地圖。
 * 內容照手冊的順序：這個網站是什麼、原則、台灣與爭議領土、方法與限制、資料來源一覽（從各主題的 sources 自動產生，
 * scripts/topic-catalog.mjs → sources.gen.ts）、AI 的角色、更正。頁上寫的每一件事都對照過程式（DESIGN.md 第 11 節）。
 */

const REPO = 'https://github.com/skywitness/map';
const ISSUES = `${REPO}/issues`;
const DESIGN_LICENSES = `${REPO}/blob/main/DESIGN.md#8-資料陷阱重要`; // i18n-ignore（DESIGN.md 第 8 節的錨點）

const TEXT = defineMessages({
  zh: {
    pageTitle: '關於這個網站 · 世界資料地圖',
    back: '← 回到地圖',
    title: '關於這個網站',
    contents: '這一頁的內容',
    otherLang: 'English',
    themeLight: '淺色',
    themeDark: '深色',
    whatTitle: '這個網站是什麼',
    what: (topics: number, indicators: number) =>
      `世界資料地圖是個人做的互動世界地圖，目前有 ${topics} 個主題、${indicators} 個指標：在地圖上看各國的數字，拖時間軸看歷年變化，也可以看排名表、點國家看細節與比較。`,
    free: '不用帳號、免費、沒有廣告。',
    tracking:
      '網站沒有統計、廣告或追蹤的程式，也不用 cookie；語言、深淺色、底圖、收藏的畫面這些設定只存在你自己的瀏覽器裡。地圖的底圖與地形由 OpenFreeMap 與 AWS 上的 Terrain Tiles 提供，「此刻的極光」「此刻世界的新聞熱點」會直接向 NOAA、GDELT 下載最新的資料，這些網站會看到你的連線。',
    code: '程式公開在 GitHub（skywitness/map）。這個 repo 沒有附授權條款（LICENSE），所以程式不是開源授權的軟體；資料各自依來源的授權使用與分享（見下面的資料來源一覽）。',
    principlesTitle: '原則',
    principles: [
      '數字都來自標明出處的機構，網站不自己量。每個主題的頁尾寫資料來源與授權。',
      '寫資料的年份，不寫發布的年份。普查、調查這類年份零散的指標，某一年沒有資料時用那國最近幾年的值，地圖、滑過的說明、排名表與側欄都會標出實際是哪一年。',
      '推估值（例如聯合國的人口推估）在時間軸上標「推估值」，側欄的折線圖畫成虛線；早年多半是估計的資料，時間軸標「估計值」。',
      '沒有資料的國家畫斜線，不補值。',
      '台灣跟其他國家一樣列出（見下一節）。',
    ],
    taiwanTitle: '台灣與爭議領土',
    taiwan: [
      '台灣在這個網站跟其他國家一樣列出、上色與排名。資料來源沒有台灣時，用台灣官方的開放資料補上，並在附註寫出處；補的值跟來源的定義不完全一樣時，也會寫明。',
      '國界與名稱只是為了呈現資料，不代表對任何領土爭議的立場；有爭議的地方在附註寫明。',
    ],
    methodTitle: '方法與限制',
    method: [
      '各國最新的年份不同：比較時，拿來比的不一定是同一年。',
      '各國的定義不同：失業、都市人口、識字率這類指標，各國的定義與調查方法不一樣，國際機構盡量調整過，但不能完全比較。',
      '世界與區域的合計依主題不同：人口用聯合國自己的世界值；民主指數是有資料國家的簡單平均（每國一樣重）；成人身高是依人口加權的平均；海底電纜是加總。每個主題的說明寫它怎麼算。',
      '屬地、爭議地區在各來源的處理不一致：有的併在本國，有的分開列，有的沒有；地圖上沒有自己形狀的地區，附註寫明數字算在哪裡。',
      '資料不定期更新，各來源的週期不同。每個主題的頁尾寫資料產生的日期，來源的版本寫在來源名稱或說明裡；詳細的版本與下載方式在 GitHub 上的 DESIGN.md。',
      '用台灣官方資料補的值、自己換算的值（例如人均、加權平均）都寫在附註。',
    ],
    sourcesTitle: '資料來源一覽',
    sourcesIntro: (n: number) =>
      `從各主題的資料來源自動產生，共 ${n} 個（同一個網址算一個）。授權的細節與查證過程記在 GitHub 上 DESIGN.md 的第 8 節第 12 點。`,
    shareAlike:
      '相同方式分享的授權（CC BY-SA、ODbL，以及非商業的 CC BY-NC-SA）：用到這些資料的主題，資料檔、匯出的地圖圖片與 CSV 也用同一種授權分享，主題的頁尾有寫。',
    designLink: '授權的細節（DESIGN.md）',
    all: '全部',
    search: '搜尋來源或主題',
    usedIn: '用在：',
    license: '授權：',
    shown: (n: number, total: number) => (n === total ? `共 ${total} 個來源` : `${n} / ${total} 個來源`),
    none: '沒有符合的來源',
    sitewideTitle: '每個主題都會用到的',
    sitewide: [
      { name: 'Natural Earth（國界與國名）', url: 'https://www.naturalearthdata.com/', license: '公有領域' },
      {
        name: 'OpenFreeMap、OpenMapTiles、OpenStreetMap（底圖）',
        url: 'https://openfreemap.org/',
        license: '© OpenMapTiles © OpenStreetMap 貢獻者（OpenStreetMap 的資料是 ODbL）',
      },
      {
        name: 'Terrain Tiles（地形與 3D）',
        url: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
        license: '依各資料來源的標示（連結）',
      },
    ],
    aiTitle: 'AI 的角色',
    ai: [
      '這個網站的程式、資料的下載與整理、授權條款的查證，大量使用 AI（Anthropic 的 Claude）協助。',
      '網站上的數字都來自標明出處的機構，AI 不產生數字。資料的授權都上網讀條款原文確認，查不到或沒寫清楚的就不用。做哪些主題、用哪些資料，由網站作者決定。',
    ],
    fixTitle: '更正',
    fix: '看到錯誤、過時的數字或缺的出處，請到 GitHub Issues 回報，最好附上出處。回報要有 GitHub 帳號。',
    fixLink: '到 GitHub Issues 回報',
    listSep: '、',
    licenseSep: '；',
  },
  en: {
    pageTitle: 'About · World Data Map',
    back: '← Back to the map',
    title: 'About this site',
    contents: 'On this page',
    // 語言名稱用該語言自己寫
    otherLang: '中文', // i18n-ignore
    themeLight: 'Light',
    themeDark: 'Dark',
    whatTitle: 'What this site is',
    what: (topics, indicators) =>
      `World Data Map is an interactive world map made by one person, with ${topics} topics and ${indicators} indicators: see each country’s figures on the map, drag the time slider for changes over the years, or use the ranking table and click a country for details and comparisons.`,
    free: 'No account, free, no ads.',
    tracking:
      'There is no analytics, advertising or tracking code, and no cookies; settings such as language, theme, basemap and saved views stay in your own browser. Basemaps and terrain come from OpenFreeMap and Terrain Tiles on AWS, and “Aurora now” and “News hotspots now” download the latest data directly from NOAA and GDELT, so those sites see your connection.',
    code: 'The code is public on GitHub (skywitness/map). The repository has no licence file, so the code is not open-source licensed; the data are used and shared under each source’s own licence (see the list of sources below).',
    principlesTitle: 'Principles',
    principles: [
      'Every figure comes from a named institution; the site does not measure anything itself. The footer of each topic gives its sources and licences.',
      'Years are the years the data refer to, not publication years. For indicators from scattered censuses and surveys, a country without data in a year uses its most recent value from the last few years, and the map, tooltip, ranking table and side panel all show the actual year.',
      'Projections (such as the UN population projections) are labelled “projected” on the time slider and dashed in the side-panel charts; early years that are mostly estimates are labelled “estimated”.',
      'Countries without data are hatched; no values are filled in.',
      'Taiwan is listed like every other country (see the next section).',
    ],
    taiwanTitle: 'Taiwan and disputed territories',
    taiwan: [
      'Taiwan is listed, coloured and ranked like every other country on this site. Where a source has no figures for Taiwan, they are filled in from Taiwan’s official open data, with the source given in a note; where the filled-in figures do not match the source’s definition exactly, the note says so.',
      'Borders and names are only for presenting data and imply no position on any territorial dispute; disputed areas are explained in notes.',
    ],
    methodTitle: 'Methods and limitations',
    method: [
      'Countries’ latest years differ, so a comparison is not always between the same years.',
      'Definitions differ between countries: for indicators such as unemployment, urban population and literacy, definitions and survey methods vary, and international agencies harmonise them only partly.',
      'World and regional totals depend on the topic: population uses the UN’s own world figure; the democracy index is a simple average of the countries with data (each counts equally); adult height is a population-weighted average; submarine cables are a sum. Each topic’s description says how.',
      'Dependent and disputed territories are handled inconsistently across sources: some are included with their sovereign state, some are listed separately, some are missing; for areas without their own shape on the map, a note says where their figures are counted.',
      'Data are updated irregularly and each source has its own cycle. The footer of each topic gives the date the data were generated, and the source version is in the source name or description; full details of versions and downloads are in DESIGN.md on GitHub.',
      'Figures filled in from Taiwan’s official data and figures calculated here (per capita, weighted averages and the like) are explained in notes.',
    ],
    sourcesTitle: 'List of sources',
    sourcesIntro: (n) =>
      `Generated automatically from the sources of every topic: ${n} in all (one per web address). Licence details and how they were checked are recorded in point 12 of section 8 of DESIGN.md on GitHub.`,
    shareAlike:
      'Share-alike licences (CC BY-SA, ODbL and the non-commercial CC BY-NC-SA): topics that use these data share their data files, exported map images and CSV files under the same licence, as noted in their footers.',
    designLink: 'Licence details (DESIGN.md)',
    all: 'All',
    search: 'Search sources or topics',
    usedIn: 'Used in: ',
    license: 'Licence: ',
    shown: (n, total) => (n === total ? `${total} sources` : `${n} of ${total} sources`),
    none: 'No matching sources',
    sitewideTitle: 'Used by every topic',
    sitewide: [
      { name: 'Natural Earth (borders and names)', url: 'https://www.naturalearthdata.com/', license: 'Public domain' },
      {
        name: 'OpenFreeMap, OpenMapTiles, OpenStreetMap (basemaps)',
        url: 'https://openfreemap.org/',
        license: '© OpenMapTiles © OpenStreetMap contributors (OpenStreetMap data are under the ODbL)',
      },
      {
        name: 'Terrain Tiles (terrain and 3D)',
        url: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
        license: 'As attributed for each data source (see link)',
      },
    ],
    aiTitle: 'The role of AI',
    ai: [
      'The site’s code, the downloading and processing of data, and the checking of licence terms were done with extensive help from AI (Anthropic’s Claude).',
      'Every figure on the site comes from a named institution; AI does not produce figures. Licences are confirmed by reading the original terms online, and data whose terms cannot be found or are unclear are not used. The site’s author decides which topics to make and which data to use.',
    ],
    fixTitle: 'Corrections',
    fix: 'If you see a mistake, an outdated figure or a missing source, please report it on GitHub Issues, ideally with a source. Reporting needs a GitHub account.',
    fixLink: 'Report on GitHub Issues',
    listSep: ', ',
    licenseSep: '; ',
  },
});

/** 主題的網址（英文介面帶 ?lang=en） */
function topicHref(id: string): string {
  const lang = langParam();
  return `${siteRoot()}t/${id}/${lang ? `?lang=${lang}` : ''}`;
}

export default function AboutPage() {
  const lang = useLang();
  const text = TEXT[lang];
  const { tokens, toggle } = useTheme();
  const [kind, setKind] = useState<LicenseKind | null>(null);
  const [query, setQuery] = useState('');

  // 分頁標題：i18n 換語言時會改回網站的標題，這裡在它之後再改
  useEffect(() => {
    document.title = text.pageTitle;
  }, [text]);

  const titles = useMemo(
    () => Object.fromEntries(Object.values(CATALOG.topics).map((t) => [t.id, tr(t.title, lang)])),
    [lang],
  );
  const counts = useMemo(() => {
    const out = new Map<LicenseKind, number>();
    for (const s of SOURCES) for (const k of sourceKinds(s)) out.set(k, (out.get(k) ?? 0) + 1);
    return out;
  }, []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SOURCES.filter((s) => {
      if (kind && !s.licenses.some((l) => licenseKind(l) === kind)) return false;
      if (!q) return true;
      const hay = [tr(s.name, lang), s.url, ...s.licenses.map((l) => tr(l, lang)), ...s.topics.map((id) => titles[id] ?? id)];
      return hay.some((h) => h.toLowerCase().includes(q));
    });
  }, [kind, query, lang, titles]);
  const kindNote = LICENSE_KINDS.find((k) => k.id === kind)?.note;
  const home = `${siteRoot()}${langParam() ? `?lang=${langParam()}` : ''}`;

  return (
    <div className="about-page">
      <header className="about-top">
        <a href={home} className="about-back">
          {text.back}
        </a>
        <span className="about-tools">
          <button type="button" className="about-tool" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
            {text.otherLang}
          </button>
          <button type="button" className="about-tool" onClick={toggle}>
            {tokens.mode === 'dark' ? text.themeLight : text.themeDark}
          </button>
        </span>
      </header>
      <main className="about-main">
        <h1>{text.title}</h1>
        <nav className="about-toc" aria-label={text.contents}>
          {(
            [
              ['what', text.whatTitle],
              ['principles', text.principlesTitle],
              ['taiwan', text.taiwanTitle],
              ['methods', text.methodTitle],
              ['sources', text.sourcesTitle],
              ['ai', text.aiTitle],
              ['corrections', text.fixTitle],
            ] as const
          ).map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>

        <section id="what">
          <h2>{text.whatTitle}</h2>
          <p>{text.what(TOPIC_COUNT, INDICATOR_COUNT)}</p>
          <p>{text.free}</p>
          <p>{text.tracking}</p>
          <p>
            {text.code}{' '}
            <a href={REPO} target="_blank" rel="noreferrer">
              github.com/skywitness/map
            </a>
          </p>
        </section>

        <section id="principles">
          <h2>{text.principlesTitle}</h2>
          <ul>
            {text.principles.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <section id="taiwan">
          <h2>{text.taiwanTitle}</h2>
          {text.taiwan.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>

        <section id="methods">
          <h2>{text.methodTitle}</h2>
          <ul>
            {text.method.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <section id="sources" className="about-sources">
          <h2>{text.sourcesTitle}</h2>
          <p>
            {text.sourcesIntro(SOURCES.length)}{' '}
            <a href={DESIGN_LICENSES} target="_blank" rel="noreferrer">
              {text.designLink}
            </a>
          </p>
          <p className="about-note">{text.shareAlike}</p>

          <h3>{text.sitewideTitle}</h3>
          <ul className="about-source-list">
            {text.sitewide.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.name}
                </a>
                <span className="about-meta">
                  {text.license}
                  {s.license}
                </span>
              </li>
            ))}
          </ul>

          <div className="about-filters" role="group" aria-label={text.license}>
            <button type="button" className="about-chip" aria-pressed={kind === null} onClick={() => setKind(null)}>
              {text.all} {SOURCES.length}
            </button>
            {LICENSE_KINDS.filter((k) => counts.get(k.id)).map((k) => (
              <button
                key={k.id}
                type="button"
                className="about-chip"
                aria-pressed={kind === k.id}
                onClick={() => setKind(kind === k.id ? null : k.id)}
              >
                {tr(k.label, lang)} {counts.get(k.id)}
              </button>
            ))}
          </div>
          {kindNote && <p className="about-note">{tr(kindNote, lang)}</p>}
          <input
            type="search"
            className="about-search"
            placeholder={text.search}
            aria-label={text.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="about-count">{text.shown(shown.length, SOURCES.length)}</p>
          {shown.length === 0 ? (
            <p className="about-note">{text.none}</p>
          ) : (
            <ul className="about-source-list">
              {shown.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {tr(s.name, lang)}
                  </a>
                  <span className="about-meta">
                    {text.license}
                    {s.licenses.map((l) => tr(l, lang)).join(text.licenseSep)}
                  </span>
                  <span className="about-meta">
                    {text.usedIn}
                    {s.topics.map((id, i) => (
                      <span key={id}>
                        {i > 0 && text.listSep}
                        <a href={topicHref(id)}>{titles[id] ?? id}</a>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="ai">
          <h2>{text.aiTitle}</h2>
          {text.ai.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>

        <section id="corrections">
          <h2>{text.fixTitle}</h2>
          <p>
            {text.fix}{' '}
            <a href={ISSUES} target="_blank" rel="noreferrer">
              {text.fixLink}
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}

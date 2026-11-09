import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import type { CategoryDef, ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 中醫的研究（新主題，2026-11-08，製作手冊第二十九批 700、709 的論文部分，候選 1613–1618；pipeline/topics/tcm_research.py）：
 * OpenAlex 的群組查詢（本機 session 查好放在 map-plan 的 data/openalex-tcm/）。2026-11-09 加臨床試驗（690、701、709 的試驗部分，
 * pipeline/topics/tcm_trials.py；ClinicalTrials.gov 的搜尋結果由使用者用瀏覽器匯出）。不談療效：只是「有幾篇論文、幾件試驗以它為題」。
 */
const SYSTEMS = [
  { id: 'tcm', label: { zh: '中醫（traditional Chinese medicine）', en: 'Traditional Chinese medicine' } },
  { id: 'acupuncture', label: { zh: '針灸', en: 'Acupuncture' } },
  { id: 'ayurveda', label: { zh: '阿育吠陀', en: 'Ayurveda' } },
  { id: 'homeopathy', label: { zh: '順勢療法', en: 'Homeopathy' } },
  { id: 'kampo', label: { zh: '漢方', en: 'Kampo' } },
];
const THERAPIES = [
  { id: 'all', label: { zh: '全部中醫療法', en: 'All Chinese medicine therapies' } },
  { id: 'acupuncture', label: { zh: '針灸（含電針、耳針）', en: 'Acupuncture (incl. electro- and ear acupuncture)' } },
  { id: 'acupressure', label: { zh: '指壓', en: 'Acupressure' } },
  { id: 'taichi-qigong', label: { zh: '太極與氣功', en: 'Tai chi and qigong' } },
  { id: 'herbal', label: { zh: '中藥', en: 'Chinese herbal medicine' } },
  { id: 'cupping', label: { zh: '拔罐', en: 'Cupping' } },
  { id: 'moxibustion', label: { zh: '艾灸', en: 'Moxibustion' } },
];
const MAIN_SYSTEM: CategoryDef[] = [
  { value: 1, label: { zh: '中醫系療法比較多', en: 'More Chinese medicine trials' } },
  { value: 2, label: { zh: '其他傳統醫學體系比較多', en: 'More trials of other traditional systems' } },
  { value: 3, label: { zh: '一樣多', en: 'Equal' } },
];
const trials = (v: number) => tr({ zh: `${fixed(v, 0)} 件`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'trial' : 'trials'}` });
const CONDITION_LIST: ListPanelDef = {
  label: { zh: '中醫試驗最常研究的病', en: 'Conditions most often studied in Chinese medicine trials' },
  tabLabel: { zh: '研究的病', en: 'Conditions' },
  indicators: ['trials', 'per-thousand', 'main-system', 'first-year', 'enrollment'],
  file: 'conditions.json',
  countryField: 'iso3',
  empty: { zh: '這裡沒有中醫療法的試驗', en: 'No Chinese medicine trials here' },
  rows: (points: PointRecord[]) =>
    [...points]
      .sort((a, b) => Number(a.rank) - Number(b.rank))
      .map((p, i): ListRow => ({
        key: `cd-${i}`,
        title: String(p.cond ?? ''),
        titleProper: true,
        lines: [tr({ zh: `${p.n} 件試驗（登記的病名原文）`, en: `${p.n} trials (condition as registered)` })],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 3 },
      })),
};
const papers = (v: number) => tr({ zh: `${fixed(v, 0)} 篇`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'paper' : 'papers'}` });

export const tcmResearch: TopicDefinition = {
  id: 'tcm-research',
  title: { zh: '中醫的研究：各國的中醫論文與臨床試驗', en: 'Research on Chinese medicine: papers and clinical trials by country' },
  shortTitle: { zh: '中醫的研究', en: 'Chinese medicine research' },
  defaultIndicator: 'papers',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'OpenAlex：題名與摘要含 traditional chinese medicine、acupuncture、ayurveda、homeopathy、kampo 的期刊論文、回顧與會議論文，依作者機構所在國與出版年的群組查詢（2026-11-08 查詢）',
        en: 'OpenAlex: journal articles, reviews and conference papers with traditional chinese medicine, acupuncture, ayurveda, homeopathy or kampo in the title or abstract, grouped by authors’ institution country and publication year (queried 8 November 2026)',
      },
      url: 'https://openalex.org/',
      license: 'CC0',
    },
    {
      name: {
        zh: 'ClinicalTrials.gov：介入措施查 acupuncture、electroacupuncture、moxibustion、acupressure、auriculotherapy、cupping、tuina、qigong、tai chi、chinese herbal、traditional chinese medicine（4,531 件）與其他傳統醫學體系（317 件）的搜尋結果匯出，資料下載於 2026-11-09（最新的更新日期 2026-11-06）；依國家、年份、療法、病名計數',
        en: 'ClinicalTrials.gov: search results exported for interventions acupuncture, electroacupuncture, moxibustion, acupressure, auriculotherapy, cupping, tuina, qigong, tai chi, chinese herbal and traditional chinese medicine (4,531 studies) and other traditional systems (317), downloaded 9 November 2026 (latest update posted 6 November 2026); counted by country, year, therapy and condition',
      },
      url: 'https://clinicaltrials.gov/',
      license: { zh: 'ClinicalTrials.gov 使用條款（註明來源與處理日期、說明改動）', en: 'ClinicalTrials.gov terms (attribution, processing date, modifications stated)' },
    },
  ],
  note: {
    zh: 'OpenAlex 的論文，作者機構所在國依論文計數：一篇有幾國作者就每國各算一篇，各國相加大於總數；沒有任何作者有國家資料的不算進各國（中醫論文有 23%、針灸 35%、阿育吠陀 55% 是這樣）。用英文關鍵詞找題名與摘要，韓醫、藏醫與漢方的其他寫法、只用中文發表的期刊都抓不到，所以是下限，各體系之間也不是公平的比較。這裡只算有幾篇論文以它為題，不涉及療效。全部學科的論文數見「學術論文」主題。',
    en: 'Papers in OpenAlex counted by the country of the authors’ institutions: a paper with authors in several countries counts once for each, so country totals exceed the overall total, and papers with no author country are left out (23% of Chinese medicine papers, 35% for acupuncture and 55% for Ayurveda). Titles and abstracts were searched with English keywords, so other names for Korean, Tibetan and Kampo medicine and journals published only in Chinese are missed: these are lower bounds and the systems are not compared on equal terms. This counts papers on a subject and says nothing about efficacy. Papers in all fields are in the Research papers topic.',
  },
  listPanel: [CONDITION_LIST],
  indicators: [
    {
      id: 'papers',
      label: { zh: '各國一年發表的論文', en: 'Papers published per year' },
      description: {
        zh: '一年裡題名或摘要寫到這個體系的論文有幾篇（依作者機構所在國）。中醫（traditional Chinese medicine）2000–2025 年 88,426 篇、137 國：2000 年 397 篇、2010 年 3,369、2024 年 7,653、2025 年 9,981（還在陸續收錄）；中國 59,542 篇最多，美國 3,076、台灣 2,005（第 3）、香港 1,657、英國 787、日本 766、澳門 754、南韓 687。針灸 62,657 篇、142 國：中國 20,045、美國 5,523、南韓 3,882、英國 1,642、日本 1,303，台灣 868 篇第 9。阿育吠陀 31,931 篇（印度 12,515）、順勢療法 13,600 篇（印度 2,035、巴西 874、美國 842）、漢方 3,368 篇（日本 2,233）。中醫與針灸合起來有 157 國，再加上阿育吠陀與順勢療法也只到 169 國。拖時間軸看每一年。',
        en: 'Papers per year with the system in the title or abstract, by authors’ institution country. Traditional Chinese medicine: 88,426 papers from 137 countries in 2000–2025, rising from 397 in 2000 to 3,369 in 2010, 7,653 in 2024 and 9,981 in 2025 (still being indexed); China has 59,542, followed by the US 3,076, Taiwan 2,005 (third), Hong Kong 1,657, the UK 787, Japan 766, Macao 754 and South Korea 687. Acupuncture: 62,657 papers from 142 countries, led by China 20,045, the US 5,523, South Korea 3,882, the UK 1,642 and Japan 1,303, with Taiwan ninth at 868. Ayurveda has 31,931 (India 12,515), homeopathy 13,600 (India 2,035, Brazil 874, the US 842) and Kampo 3,368 (Japan 2,233). Chinese medicine and acupuncture together cover 157 countries; adding Ayurveda and homeopathy brings it only to 169. Drag the timeline to see each year.',
      },
      unit: { zh: '篇', en: 'papers' },
      file: 'papers/{item}.json',
      dimension: { label: { zh: '體系', en: 'System' }, options: SYSTEMS, defaultOption: 'tcm' },
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      integer: true,
      format: papers,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'share',
      label: { zh: '占全國論文的比例', en: 'Share of all national papers' },
      description: {
        zh: '2000–2025 年這個國家的論文裡，每一萬篇有幾篇以中醫或針灸為題（分母是 OpenAlex 全部學科的論文，同樣依作者機構所在國計數）。只算全部論文至少 10 萬篇的 70 國：小國一個團隊就能撐起比例（澳門的全部論文不到 10 萬篇，沒有上色）。中醫：中國每萬篇 43.2 篇最高，香港 31.2、台灣 22.1、新加坡 6.2、泰國 4.6、馬來西亞 4.5、菲律賓 4.5、南韓 3.6；另一端俄羅斯 0.34、阿爾及利亞 0.21、祕魯 0.18。針灸的第一名換成南韓 20.4，中國 14.5、香港 12.6、台灣 9.6、奧地利 5.5、挪威 5.0。滑過國家看篇數。',
        en: 'Of all papers from a country in 2000–2025, how many per 10,000 are on Chinese medicine or acupuncture (the denominator is all OpenAlex papers, counted the same way by authors’ institution country). Only the 70 countries with at least 100,000 papers are shaded, because one team can drive the share of a small country (Macao has fewer than 100,000 papers and is not shaded). Chinese medicine: China is highest at 43.2 per 10,000, followed by Hong Kong 31.2, Taiwan 22.1, Singapore 6.2, Thailand 4.6, Malaysia 4.5, the Philippines 4.5 and South Korea 3.6; at the other end are Russia 0.34, Algeria 0.21 and Peru 0.18. For acupuncture South Korea leads at 20.4, ahead of China 14.5, Hong Kong 12.6, Taiwan 9.6, Austria 5.5 and Norway 5.0. Hover for the counts.',
      },
      unit: { zh: '篇／萬篇', en: 'per 10,000 papers' },
      file: 'share/{item}.json',
      dimension: { label: { zh: '體系', en: 'System' }, options: SYSTEMS.slice(0, 2), defaultOption: 'tcm' },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 10, 20] } },
      timeless: true,
      format: (v) => tr({ zh: `每萬篇 ${fixed(v, 1)} 篇`, en: `${fixed(v, 1)} per 10,000` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'oa',
      label: { zh: '中醫論文的開放取用比例', en: 'Open access share of Chinese medicine papers' },
      description: {
        zh: '2000–2025 年的中醫論文裡，OpenAlex 標成開放取用（任何人都能免費讀全文）的比例。全部是 41.5%（36,711／88,426 篇）。只替中醫論文至少 100 篇的 28 國上色：印尼 86.0% 最高，泰國 80.6、馬來西亞 78.4、波蘭 76.4、荷蘭 72.0；美國 57.2、日本 55.6、台灣 53.7、香港 53.3、中國 45.6、德國 43.1。比例高的常常是因為那個國家的論文集中在少數開放取用期刊；全部學科的開放取用比例見「學術論文」主題。',
        en: 'Share of Chinese medicine papers from 2000–2025 that OpenAlex marks as open access (full text free to read). Overall it is 41.5% (36,711 of 88,426). Only the 28 countries with at least 100 Chinese medicine papers are shaded: Indonesia is highest at 86.0%, followed by Thailand 80.6, Malaysia 78.4, Poland 76.4 and the Netherlands 72.0; the US has 57.2, Japan 55.6, Taiwan 53.7, Hong Kong 53.3, China 45.6 and Germany 43.1. A high share often means a country’s papers are concentrated in a few open access journals; the open access share across all fields is in the Research papers topic.',
      },
      unit: '%',
      file: 'oa.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [45, 50, 55, 60, 70, 80] } },
      timeless: true,
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'trials',
      label: { zh: '臨床試驗（累計）', en: 'Clinical trials (cumulative)' },
      description: {
        zh: 'ClinicalTrials.gov 上以中醫療法為介入措施的試驗，依試驗地點所在國、到這一年為止累計（依開始日期；一件多國在每一國各算一次）。全部 4,531 件、62 國：中國 1,276 件、美國 769、台灣 378（第 3）、土耳其 262、香港 162、埃及 149、南韓 132；535 件沒填地點。逐年：1997 年 2 件、2000 年 11、2010 年 98、2020 年 266、2024 年 433（2025、2026 年的還會增加，也有登記時填的是預計開始日期）。最早的一件：美國 1994 年、丹麥 1997、中國與德國 1998、台灣與巴西 2000。子項目依介入措施與題目的關鍵詞分療法（匯出檔沒有介入措施的說明，加起來少於全部）：針灸 2,068 件（中國 531、美國 421、台灣 192）、中藥 589 件（中國 310、台灣 87）、太極與氣功 437 件（美國 141 最多）、指壓 401 件（土耳其 107 最多）。中國登記在 ChiCTR、日本在 jRCT、印度在 CTRI，這三國在這裡偏少：日本只有 1 件不是不研究漢方，是登記在別的地方。只算試驗的件數，不談療效。拖時間軸看累計的變化。',
        en: 'Trials on ClinicalTrials.gov with a Chinese medicine therapy as the intervention, by the country of the trial sites, cumulative to the year (by start date; a multi-country trial counts once in each). 4,531 in all from 62 countries: China 1,276, the US 769, Taiwan 378 (third), Türkiye 262, Hong Kong 162, Egypt 149 and South Korea 132; 535 list no site. By year: 2 in 1997, 11 in 2000, 98 in 2010, 266 in 2020 and 433 in 2024 (2025 and 2026 will still grow, and some registrations give a planned start date). The first trial was in the US in 1994, then Denmark 1997, China and Germany 1998 and Taiwan and Brazil 2000. Sub-items split therapies by keywords in the interventions and titles (the export lacks intervention descriptions, so they sum to less than the total): acupuncture 2,068 (China 531, the US 421, Taiwan 192), Chinese herbal medicine 589 (China 310, Taiwan 87), tai chi and qigong 437 (the US leads with 141) and acupressure 401 (Türkiye leads with 107). China registers mainly in ChiCTR, Japan in jRCT and India in CTRI, so these are undercounted: Japan’s single trial does not mean Japan does no Kampo research, only that it is registered elsewhere. This counts trials and says nothing about efficacy. Drag the timeline for the cumulative count.',
      },
      unit: { zh: '件', en: 'trials' },
      file: 'trials/{item}.json',
      dimension: { label: { zh: '療法', en: 'Therapy' }, options: THERAPIES, defaultOption: 'all' },
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      integer: true,
      format: trials,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'per-thousand',
      label: { zh: '每千件臨床試驗有幾件是中醫', en: 'Chinese medicine trials per 1,000 trials' },
      description: {
        zh: '這一國在 ClinicalTrials.gov 登記的全部試驗裡，每一千件有幾件以中醫療法為介入措施（分母同「研發與創新」主題的各國試驗總數；只算全部試驗至少 200 件的 58 國）。越南 45.6‰ 最高，印尼 34.4、香港 33.8、台灣 28.9、中國 23.3、賽普勒斯 20.0、巴基斯坦 14.3、土耳其 9.7；另一端澳洲 0.4、比利時 0.3、荷蘭 0.2、芬蘭 0.2、日本 0.1。把「這一國本來做多少試驗」除掉之後，才看得出東亞與東南亞高、歐洲低。中國、日本、印度主要登記在本國的平台，比例偏低。',
        en: 'Of all trials a country has registered on ClinicalTrials.gov, how many per 1,000 have a Chinese medicine intervention (the denominator is the national total used in the Research and innovation topic; only the 58 countries with at least 200 trials are shaded). Viet Nam is highest at 45.6‰, followed by Indonesia 34.4, Hong Kong 33.8, Taiwan 28.9, China 23.3, Cyprus 20.0, Pakistan 14.3 and Türkiye 9.7; at the other end are Australia 0.4, Belgium 0.3, the Netherlands 0.2, Finland 0.2 and Japan 0.1. Dividing by how many trials a country runs at all shows East and South-East Asia high and Europe low. China, Japan and India register mainly on national platforms, so their shares are understated.',
      },
      unit: '‰',
      file: 'per-thousand.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2.5, 5, 10, 20, 30] } },
      timeless: true,
      format: (v) => `${fixed(v, 1)}‰`,
      formatTick: (v) => `${v}‰`,
    },
    {
      id: 'main-system',
      label: { zh: '傳統醫學的試驗以哪一系為主', en: 'Which traditional system dominates trials' },
      description: {
        zh: '中醫系療法的試驗（4,531 件）跟其他傳統醫學體系的試驗（阿育吠陀、順勢療法、自然療法、尤納尼、悉達、漢方、藏醫、韓醫、印尼的 jamu，共 317 件）哪一邊多；只替兩邊合計至少 5 件的 42 國上色。38 國是中醫系比較多，只有印度與南非是其他體系比較多，奧地利與墨西哥一樣多。其他體系的試驗以南韓 79 件（韓醫）最多，美國 53、印度 39、德國 22。介入措施或題目寫到漢方的 0 件、藏醫 3 件，日本與蒙古的傳統醫學在這個資料庫裡幾乎看不到。對照「傳統與替代醫學的據點」：OSM 的據點以中醫為主的只有 10 國（55 國裡），整脊、整骨更常見——據點量的是開業的地方，試驗量的是做研究的人。',
        en: 'Whether Chinese medicine trials (4,531) or trials of other traditional systems (Ayurveda, homeopathy, naturopathy, Unani, Siddha, Kampo, Tibetan and Korean medicine and Indonesian jamu; 317 in all) are more numerous; only the 42 countries with at least 5 combined are shaded. Chinese medicine leads in 38, other systems only in India and South Africa, and Austria and Mexico are equal. Trials of other systems are led by South Korea (79, Korean medicine), the US 53, India 39 and Germany 22. No trial names Kampo in its interventions or title and only 3 name Tibetan medicine, so Japanese and Mongolian traditional medicine are barely visible in this registry. By contrast, OpenStreetMap places (Traditional and alternative medicine topic) are dominated by Chinese medicine in only 10 of 55 countries, with chiropractic and osteopathy more common: places measure where practitioners work, trials where research is done.',
      },
      unit: '',
      file: 'main-system.json',
      layer: { kind: 'categorical', categories: MAIN_SYSTEM },
      timeless: true,
      unranked: true,
      format: (v) => tr(MAIN_SYSTEM.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
    },
    {
      id: 'first-year',
      label: { zh: '第一件中醫試驗的年份', en: 'Year of the first Chinese medicine trial' },
      description: {
        zh: '這一國第一件中醫療法試驗開始的年份（ClinicalTrials.gov 的開始日期）。美國 1994 年最早，丹麥 1997、中國與德國 1998、台灣與巴西 2000、香港、加拿大與瑞典 2002、南韓與英國 2005；62 國裡一半以上是 2008 年以後。ClinicalTrials.gov 2000 年才上線、2005 年起期刊要求登記才普遍，早期的是回溯登記，第一件登記不等於第一次做。',
        en: 'The year a country’s first Chinese medicine trial started (ClinicalTrials.gov start date). The US is earliest at 1994, then Denmark 1997, China and Germany 1998, Taiwan and Brazil 2000, Hong Kong, Canada and Sweden 2002 and South Korea and the UK 2005; more than half of the 62 countries come after 2008. ClinicalTrials.gov launched in 2000 and registration became routine only after journals required it in 2005, so early entries were registered retrospectively and the first registration is not necessarily the first study.',
      },
      unit: { zh: '年', en: '' },
      file: 'first-year.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2000, 2005, 2010, 2015, 2020] } },
      timeless: true,
      integer: true,
      unranked: true,
      lowerIsBetter: true,
      format: (v) => tr({ zh: `${Math.round(v)} 年`, en: `${Math.round(v)}` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'enrollment',
      label: { zh: '中醫試驗的受試者人數', en: 'Participants in Chinese medicine trials' },
      description: {
        zh: '中醫療法的介入型試驗登記的受試者人數合計，只算所有地點都在同一國的試驗（多國試驗的人數分不到國家；觀察型研究常是整個世代，不算）。中國 278,409 人最多，美國 74,992、台灣 26,260、土耳其 20,982、香港 20,154、埃及 9,032、南韓 7,683。還在收案的試驗填的是預計人數，已完成的是實際人數，匯出檔分不出來。',
        en: 'Total participants registered for interventional Chinese medicine trials, counting only trials whose sites are all in one country (multi-country trials cannot be split by country, and observational studies, often whole cohorts, are excluded). China has the most (278,409), followed by the US 74,992, Taiwan 26,260, Türkiye 20,982, Hong Kong 20,154, Egypt 9,032 and South Korea 7,683. Ongoing trials report planned numbers and completed ones actual numbers; the export does not distinguish them.',
      },
      unit: { zh: '人', en: 'participants' },
      file: 'enrollment.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 人`, en: `${fixed(v, 0)}` }),
      formatTick: (v) => formatLargeNumber(v),
    },
  ],
};

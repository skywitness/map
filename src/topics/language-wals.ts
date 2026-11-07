import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { CategoryDef, IndicatorDef } from './types';

/**
 * 語言加四個特徵（2026-11-07，製作手冊第二十七批 552，候選 1254–1257；pipeline/topics/language_wals.py）：
 * WALS 的語序（81A）、聲調（13A）、名詞的格（49A）、冠詞（37A），國家的值是主要官方語言；Eurostat 的大人會幾種外語。
 */

const C = MAP_TOKENS.categorical;

export const WORD_ORDER: CategoryDef[] = [
  { value: 1, label: { zh: 'SOV（主詞－受詞－動詞）', en: 'SOV' }, color: C[0] },
  { value: 2, label: { zh: 'SVO（主詞－動詞－受詞）', en: 'SVO' }, color: C[1] },
  { value: 3, label: { zh: 'VSO（動詞－主詞－受詞）', en: 'VSO' }, color: C[2] },
  { value: 4, label: { zh: 'VOS（動詞－受詞－主詞）', en: 'VOS' }, color: C[3] },
  { value: 5, label: { zh: 'OVS（受詞－動詞－主詞）', en: 'OVS' }, color: C[4] },
  { value: 6, label: { zh: 'OSV（受詞－主詞－動詞）', en: 'OSV' }, color: C[5] },
  { value: 7, label: { zh: '沒有主導的語序', en: 'No dominant order' }, color: MAP_TOKENS.categoricalOther },
];
export const TONE: CategoryDef[] = [
  { value: 1, label: { zh: '沒有聲調', en: 'No tones' } },
  { value: 2, label: { zh: '簡單的聲調（高低兩種）', en: 'Simple tone system' } },
  { value: 3, label: { zh: '複雜的聲調', en: 'Complex tone system' } },
];
/** 49A 的 9 類合成 7 類（pipeline 的 CASE_MERGE） */
export const CASES: CategoryDef[] = [
  { value: 1, label: { zh: '沒有形態格', en: 'No case marking' } },
  { value: 7, label: { zh: '只有邊緣的格', en: 'Borderline case marking only' } },
  { value: 2, label: { zh: '2–3 個格', en: '2–3 cases' } },
  { value: 3, label: { zh: '4–5 個格', en: '4–5 cases' } },
  { value: 4, label: { zh: '6–7 個格', en: '6–7 cases' } },
  { value: 5, label: { zh: '8–9 個格', en: '8–9 cases' } },
  { value: 6, label: { zh: '10 個以上的格', en: '10 or more cases' } },
];
export const ARTICLES: CategoryDef[] = [
  { value: 1, label: { zh: '有定冠詞（跟指示詞不同的詞）', en: 'Definite article distinct from demonstrative' } },
  { value: 2, label: { zh: '用指示詞（這、那）當定冠詞', en: 'Demonstrative used as definite article' } },
  { value: 3, label: { zh: '定冠詞是詞綴', en: 'Definite affix' } },
  { value: 4, label: { zh: '沒有定冠詞，但有不定冠詞', en: 'No definite, but indefinite article' } },
  { value: 5, label: { zh: '沒有冠詞', en: 'No articles' } },
];

const HOW = {
  zh: '資料是 WALS（世界語言結構地圖集，Dryer 與 Haspelmath 編）的語言特徵。國家的值是「主要官方語言」（跟這個主題的主要官方語言同一個算法：CLDR 的官方語言裡會說的人最多的），所以菲律賓是英語、不是他加祿語；把國內所有語言加起來會讓美國變成 SOV、德國變成「沒有主導的語序」，所以不那樣算。語言用 Glottolog 的代碼對到 WALS（不能用 ISO 碼：ISO 的 cmn、deu 在 WALS 會對到別的方言），WALS 沒有那個特徵的值就留白（例如標準阿拉伯語沒有聲調的資料）。點國家看 WALS 收的這一國的語言。',
  en: 'Data are language features from WALS (the World Atlas of Language Structures, edited by Dryer and Haspelmath). Each country shows its main official language (the same rule as this topic’s main official language: the official language spoken by the most people according to CLDR), so the Philippines shows English, not Tagalog; pooling all of a country’s languages would make the US SOV and Germany “no dominant order”, so that is not done. Languages are matched to WALS through Glottolog codes (ISO codes cannot be used: ISO cmn and deu match other varieties in WALS), and countries are blank where WALS has no value for that feature (Modern Standard Arabic has no tone data, for example). Select a country for the WALS languages listed there.',
};

type Bilingual = { zh: string; en: string };

function walsIndicator(id: string, label: Text, description: Bilingual, categories: CategoryDef[]): IndicatorDef {
  return {
    id: `wals-${id}`,
    label,
    description: { zh: `${description.zh}${HOW.zh}`, en: `${description.en} ${HOW.en}` },
    unit: '',
    file: `wals/${id}.json`,
    layer: { kind: 'categorical', categories },
    format: (v) => tr(categories.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
    missing: { zh: 'WALS 沒有這一國主要官方語言的這個特徵', en: 'No WALS value for the main official language' },
    menuGroup: { zh: '語言的特徵（WALS）', en: 'Language features (WALS)' },
  };
}

export const languageWalsPart: TopicPart = {
  name: { zh: '語言的特徵、大人會幾種外語', en: 'Language features and adults’ foreign languages' },
  sources: [
    {
      name: {
        zh: 'WALS Online（Dryer & Haspelmath 編，CLDF 版）',
        en: 'WALS Online (eds. Dryer & Haspelmath, CLDF edition)',
      },
      url: 'https://wals.info/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Eurostat 成人教育調查：會幾種外語（edat_aes_l21）', en: 'Eurostat Adult Education Survey: number of foreign languages known (edat_aes_l21)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/edat_aes_l21/default/table',
      license: 'CC BY 4.0',
    },
  ],
  indicators: [
    walsIndicator(
      'order',
      { zh: '基本語序（主詞、受詞、動詞）', en: 'Basic word order' },
      {
        zh: '主要官方語言的主詞、受詞、動詞的基本順序（WALS 81A）。WALS 的 1,376 種語言裡 SOV 564 種最多、SVO 488、沒有主導的語序 189、VSO 95、VOS 25、OVS 11、OSV 4；但大語言多是 SVO，國家層級 233 國有值、172 國是 SVO：華語、英語、西班牙語、法語、俄語、越南語、泰語、印尼語。SOV 21 國（日語、韓語、印地語、土耳其語、波斯語），VSO 22 國（現代標準阿拉伯語），沒有主導的語序 16 國（德語、匈牙利語、希臘語），馬達加斯加語 VOS、吐瓦魯語 OVS。台灣的主要官方語言是華語（SVO）；WALS 收的台灣語言裡阿美語、排灣語、魯凱語沒有主導的語序，賽德克語是全世界只有 25 種的 VOS。',
        en: 'Basic order of subject, object and verb in the main official language (WALS 81A). Of WALS’s 1,376 languages, SOV is commonest (564), then SVO 488, no dominant order 189, VSO 95, VOS 25, OVS 11 and OSV 4; but big languages tend to be SVO, and of the 233 countries with a value 172 are SVO: Mandarin, English, Spanish, French, Russian, Vietnamese, Thai and Indonesian. 21 are SOV (Japanese, Korean, Hindi, Turkish, Persian), 22 VSO (Modern Standard Arabic), 16 have no dominant order (German, Hungarian, Greek), Malagasy is VOS and Tuvaluan OVS. Taiwan’s main official language, Mandarin, is SVO; among Taiwan’s languages in WALS, Amis, Paiwan and Rukai have no dominant order and Seediq is VOS, one of only 25 such languages worldwide.',
      },
      WORD_ORDER,
    ),
    walsIndicator(
      'tone',
      { zh: '有沒有聲調', en: 'Tone' },
      {
        zh: '主要官方語言有沒有聲調（WALS 13A）。WALS 的 527 種語言：沒有聲調 307、簡單的聲調 132、複雜的聲調 88；只有 169 國有值。複雜的聲調是華語（台灣、中國大陸、香港、澳門）、越南語、泰語、緬甸語；日語、挪威語、拉脫維亞語、索馬利語被歸成簡單的聲調（音高重音，例如日語的「橋」與「箸」），其他大多沒有聲調。',
        en: 'Whether the main official language has tones (WALS 13A). Of WALS’s 527 languages, 307 have no tones, 132 a simple tone system and 88 a complex one; only 169 countries have a value. Complex tones: Mandarin (Taiwan, mainland China, Hong Kong, Macao), Vietnamese, Thai and Burmese; Japanese, Norwegian, Latvian and Somali count as simple tone systems (pitch accent, as in Japanese hashi “bridge” versus “chopsticks”), and most others have none.',
      },
      TONE,
    ),
    walsIndicator(
      'case',
      { zh: '名詞有幾個格', en: 'Number of cases' },
      {
        zh: '主要官方語言的名詞用詞形變化標出幾個格（WALS 49A，9 類合成 7 類）。WALS 只有 261 種語言有這一項，181 國有值。芬蘭語、匈牙利語、愛沙尼亞語 10 個以上，日語 8–9 個（WALS 把が、を、に這類助詞算成格），俄語、波蘭語、土耳其語、韓語 6–7 個，德語 4 個，英語 2 個，華語、法語、西班牙語、越南語、泰語、印尼語沒有形態格。',
        en: 'How many cases the main official language marks on nouns (WALS 49A, nine classes merged into seven). Only 261 WALS languages have this feature, giving 181 countries. Finnish, Hungarian and Estonian have 10 or more, Japanese 8–9 (WALS counts particles such as ga, o and ni as case markers), Russian, Polish, Turkish and Korean 6–7, German 4 and English 2; Mandarin, French, Spanish, Vietnamese, Thai and Indonesian have no case marking.',
      },
      CASES,
    ),
    walsIndicator(
      'articles',
      { zh: '有沒有冠詞', en: 'Articles' },
      {
        zh: '主要官方語言有沒有定冠詞（WALS 37A）。219 國有值：149 國有跟指示詞不同的定冠詞（英語 the、法語、西班牙語、德語），36 國的定冠詞是詞綴（阿拉伯語的 al-、丹麥語、阿爾巴尼亞語），22 國沒有冠詞（俄語、芬蘭語、韓語、印地語），6 國用指示詞當定冠詞（印尼語、斯瓦希里語），6 國沒有定冠詞但有不定冠詞（日語、土耳其語、波斯語、泰語）。華語在 WALS 沒有這一項。',
        en: 'Whether the main official language has a definite article (WALS 37A). Of 219 countries with a value, 149 have a definite article distinct from the demonstrative (English the, French, Spanish, German), 36 a definite affix (Arabic al-, Danish, Albanian), 22 no articles (Russian, Finnish, Korean, Hindi), 6 use a demonstrative as the definite article (Indonesian, Swahili) and 6 have an indefinite but no definite article (Japanese, Turkish, Persian, Thai). WALS has no value for Mandarin.',
      },
      ARTICLES,
    ),
    {
      id: 'adult-languages',
      label: { zh: '大人會幾種外語', en: 'Foreign languages adults know' },
      description: {
        zh: '25–64 歲的人自己說會幾種外語（Eurostat 成人教育調查，2007、2011、2016、2022；子項目：一種都不會、1 種、2 種、3 種以上）。2022 年「一種都不會」挪威 1.8%、斯洛維尼亞 4.0%、瑞典 4.1%、愛沙尼亞 4.5% 最低，保加利亞 51.8%、匈牙利 51.3%、羅馬尼亞 51.2%、土耳其 46.0%、西班牙 43.7% 最高，愛爾蘭 37.5%（母語是英語，比較少學外語）；「3 種以上」挪威 71.2%、斯洛維尼亞 56.3%、盧森堡 54.1%、荷蘭 40.2%，土耳其與羅馬尼亞各 1.2%。是自我回報，北歐可能報得高、南歐報得低；英國、科索沃照 Eurostat 的再利用規定不畫，台灣沒有可比的調查（普查問的是在家說的語言）。',
        en: 'How many foreign languages people aged 25–64 say they know (Eurostat Adult Education Survey, 2007, 2011, 2016 and 2022; switch between none, one, two and three or more). In 2022 the share knowing none was lowest in Norway (1.8%), Slovenia (4.0%), Sweden (4.1%) and Estonia (4.5%) and highest in Bulgaria (51.8%), Hungary (51.3%), Romania (51.2%), Turkey (46.0%) and Spain (43.7%), with Ireland at 37.5% (English speakers learn fewer languages); three or more: Norway 71.2%, Slovenia 56.3%, Luxembourg 54.1% and the Netherlands 40.2%, against 1.2% in Turkey and Romania. Answers are self-assessed, possibly higher in the Nordics and lower in southern Europe; the UK and Kosovo are not shown under Eurostat’s reuse rules, and Taiwan has no comparable survey (its census asks about languages used at home).',
      },
      unit: '%',
      file: 'adult-languages/{item}.json',
      dimension: {
        label: { zh: '會幾種外語', en: 'Languages known' },
        options: [
          { id: '0', label: { zh: '一種都不會', en: 'None' } },
          { id: '1', label: { zh: '1 種', en: 'One' } },
          { id: '2', label: { zh: '2 種', en: 'Two' } },
          { id: '3', label: { zh: '3 種以上', en: 'Three or more' } },
        ],
        defaultOption: '0',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 40, 50] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2022,
      menuGroup: { zh: '學外語', en: 'Learning languages' },
    },
  ],
};

import { tr } from '../i18n/lang';
import type { CategoryDef, DimensionDef, IndicatorDef, SourceDef } from './types';

/**
 * 南極：南極條約的締約國與協商國（2026-11-08，製作手冊第二十七批 551，候選 1239；pipeline/topics/antarctic_treaty.py）。
 * 南極條約秘書處的締約國表（使用者用瀏覽器存下，www.ats.aq 的 robots.txt 不准程式抓）：條約地位依年份（時間軸），
 * 環境議定書、CCAS、CCAMLR 三個附屬公約的締約狀態（2026 年）。國家依條約地位上色，不畫任何領土主張。
 */

/** 打開這兩個指標時看全世界（南極主題預設從南極點正上方看，看不到締約國） */
const WORLD: [number, number, number, number] = [-180, -58, 180, 75];

const STATUS: CategoryDef[] = [
  { value: 1, label: { zh: '協商國（有表決權）', en: 'Consultative Party (votes)' } },
  { value: 2, label: { zh: '非協商國（簽了約、沒有表決權）', en: 'Non-Consultative Party (no vote)' } },
];

const INSTRUMENT: CategoryDef[] = [
  { value: 1, label: { zh: '締約國', en: 'Party' } },
  { value: 2, label: { zh: '南極條約締約國、沒有加入這個公約', en: 'Treaty party, not party to this instrument' } },
];

const INSTRUMENTS: DimensionDef = {
  label: { zh: '公約', en: 'Instrument' },
  options: [
    { id: 'protocol', label: { zh: '環境保護議定書（已生效）', en: 'Environment Protocol (in force)' } },
    { id: 'ccas', label: { zh: '南極海豹保育公約（CCAS）', en: 'Seals Convention (CCAS)' } },
    { id: 'ccamlr', label: { zh: '南極海洋生物資源養護公約（CCAMLR）', en: 'Marine Living Resources Convention (CCAMLR)' } },
  ],
  defaultOption: 'protocol',
};

const categoryText = (cats: CategoryDef[]) => (v: number) => tr(cats.find((c) => c.value === v)?.label ?? { zh: '', en: '' });

export const TREATY_SOURCES: SourceDef[] = [
  {
    name: {
      zh: '南極條約秘書處（Secretariat of the Antarctic Treaty）「Parties」締約國表（2026-11-08 使用者用瀏覽器存下）',
      en: 'Secretariat of the Antarctic Treaty, “Parties” table (saved in a browser on 8 November 2026)',
    },
    url: 'https://www.ats.aq/devAS/Parties?lang=e',
    license: { zh: '註明出處即可使用（ATS 的著作權聲明）', en: 'may be used with the source indicated (ATS copyright notice)' },
  },
];

export const TREATY_NOTE = {
  zh: '南極條約：國家只依條約地位上色，不畫領土主張；沒有顏色的是沒有加入條約的國家（包括台灣）。',
  en: 'Antarctic Treaty: countries are coloured by treaty status only, with no territorial claims drawn; uncoloured countries, including Taiwan, are not parties.',
};

export const TREATY_INDICATORS: IndicatorDef[] = [
  {
    id: 'treaty-status',
    label: { zh: '南極條約的締約國與協商國', en: 'Antarctic Treaty parties' },
    description: {
      zh: '南極條約體系裡的地位（南極條約秘書處的締約國表）。條約 1961 年 6 月 23 日生效時有 13 國（12 個原始簽署國加波蘭），1980 年 20 國、2000 年 44 國，2026 年 58 國，最新加入的是沙烏地阿拉伯（2024 年 5 月）與阿聯（2024 年 12 月）。58 國裡 29 個是協商國，可以在南極條約協商會議上表決；其他 29 國簽了約、沒有表決權。原始簽署國以外的國家要「在南極進行實質的科學研究活動」（例如設研究站、派考察隊）才能成為協商國，所以這張名單也是誰有能力去南極做研究的指標，最近一個是捷克（2014 年）。拖時間軸看名單怎麼長出來；滑過國家看加入與成為協商國的日期。沒有顏色的是沒有加入條約的國家（包括台灣）。',
      en: 'Status in the Antarctic Treaty System (Secretariat of the Antarctic Treaty, list of Parties). The treaty entered into force on 23 June 1961 with 13 parties (the 12 original signatories plus Poland); there were 20 by 1980, 44 by 2000 and 58 in 2026, the latest being Saudi Arabia (May 2024) and the UAE (December 2024). Of the 58, 29 are Consultative Parties that vote at the Antarctic Treaty Consultative Meeting; the other 29 have signed but do not vote. Apart from the original signatories, a country becomes consultative only by conducting substantial scientific research in Antarctica (such as setting up a station or sending an expedition), so the list also shows who can afford Antarctic science; the most recent was Czechia (2014). Drag the timeline to watch the list grow; hover for the dates of accession and consultative status. Uncoloured countries, including Taiwan, are not parties.',
    },
    unit: '',
    file: 'treaty-status.json',
    layer: { kind: 'categorical', categories: STATUS },
    format: categoryText(STATUS),
    defaultYear: 2026,
    unranked: true,
    focus: WORLD,
  },
  {
    id: 'treaty-instruments',
    label: { zh: '南極條約的附屬公約', en: 'Antarctic Treaty instruments' },
    description: {
      zh: '南極條約的 58 個締約國有沒有加入三個附屬的公約（南極條約秘書處的締約國表，2026 年）：1991 年的環境保護議定書（禁止礦產資源活動，1998 年 1 月 14 日生效）對 42 國已經生效；1972 年的南極海豹保育公約（CCAS）17 國；1980 年的南極海洋生物資源養護公約（CCAMLR，管南大洋的漁業，例如磷蝦與齒魚）31 國。斯洛伐克的議定書是捷克斯洛伐克 1992 年簽的，對斯洛伐克還沒生效。這張表只列南極條約的締約國，不是條約締約國的公約成員不在上面。',
      en: 'Whether the 58 parties to the Antarctic Treaty have joined its three associated instruments (Secretariat of the Antarctic Treaty, list of Parties, 2026): the 1991 Environment Protocol (which bans mineral resource activities; in force since 14 January 1998) is in force for 42; the 1972 Convention for the Conservation of Antarctic Seals (CCAS) has 17; the 1980 Convention on the Conservation of Antarctic Marine Living Resources (CCAMLR, which manages Southern Ocean fisheries such as krill and toothfish) has 31. Slovakia’s Protocol was signed by Czechoslovakia in 1992 and is not in force for Slovakia. The table lists treaty parties only, so members of the conventions that are not treaty parties are not shown.',
    },
    unit: '',
    file: 'treaty-instruments/{item}.json',
    dimension: INSTRUMENTS,
    layer: { kind: 'categorical', categories: INSTRUMENT },
    format: categoryText(INSTRUMENT),
    defaultYear: 2026,
    unranked: true,
    focus: WORLD,
  },
];

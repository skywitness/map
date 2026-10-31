import { tr } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * Starlink 開通的國家（2026-10-31，製作手冊第十批 170；pipeline/topics/starlink.py）：維基共享資源的服務狀態地圖
 * （2026-10-08 版）依顏色對 ISO 代碼。使用者決定獨立成主題，放科技的「數位」欄。類別圖，不做左側欄。
 */

/** 狀態（pipeline 的 COLORS）：灰色在說明頁寫 Unknown、條目的圖例寫 Not covered，所以寫成「地圖沒有標」 */
const STATUS: CategoryDef[] = [
  { value: 1, label: { zh: '已開通', en: 'Active' } },
  { value: 2, label: { zh: '開通但沒有核准', en: 'Active without approval' } },
  { value: 3, label: { zh: '已核准、等待開通', en: 'Approved, pending activation' } },
  { value: 0, label: { zh: '地圖沒有標（沒有服務或狀態不明）', en: 'Not marked (no service or unknown)' }, color: MAP_TOKENS.categoricalOther },
];

export const starlink: TopicDefinition = {
  id: 'starlink',
  title: { zh: 'Starlink 開通的國家', en: 'Where Starlink is available' },
  shortTitle: { zh: 'Starlink', en: 'Starlink' },
  defaultIndicator: 'status',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '維基共享資源「Starlink availability map by country.svg」（2026-10-08 版）',
        en: 'Wikimedia Commons, “Starlink availability map by country.svg” (version of 8 October 2026)',
      },
      url: 'https://commons.wikimedia.org/wiki/File:Starlink_availability_map_by_country.svg',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「Starlink」的服務與核准一節（revid 1382130179，附註）',
        en: 'English Wikipedia, “Starlink”, section on availability and regulatory approval (revision 1382130179; notes)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=Starlink&oldid=1382130179',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '維基共享資源的地圖是志願者依新聞與 Starlink 官網整理的，2026-10-08 版。灰色在說明頁的圖例寫「Unknown」、英文維基條目的圖例寫「Not covered」，所以寫成「地圖沒有標」：多半是沒有服務，也可能只是還沒更新。目前沒有「已核准、等待開通」的國家。各國的核准經過見台灣、印度、南非、伊朗等國的附註。',
    en: 'The Wikimedia Commons map is maintained by volunteers from news reports and Starlink’s website; this is the 8 October 2026 version. Grey is labelled “Unknown” in the file’s legend but “Not covered” in the English Wikipedia article, so it is shown here as not marked: mostly no service, though some may simply not be updated yet. No country is currently marked as approved and pending activation. See the notes for Taiwan, India, South Africa, Iran and others for their approval history.',
  },
  indicators: [
    {
      id: 'status',
      label: { zh: '服務狀態', en: 'Service status' },
      description: {
        zh: 'Starlink 衛星網路在每個國家與地區的服務狀態。地圖上已開通的有 125 個國家與地區（英文維基寫約 160 個可以用），日本、南韓、美國、烏克蘭、菲律賓、印尼、越南（2026 年核准）都有；伊朗沒有核准、但有人用。台灣、中國、印度（2026 年 6 月凍結最後核准）、俄羅斯、巴基斯坦、南非沒有標。台灣 2022 年跟 SpaceX 談，因外資持股的規定破局。',
        en: 'The status of Starlink satellite internet in each country and territory. The map shows service active in 125 countries and territories (English Wikipedia says about 160 can use it), including Japan, South Korea, the US, Ukraine, the Philippines, Indonesia and Vietnam (approved in 2026); Iran has users without approval. Taiwan, China, India (final approval frozen in June 2026), Russia, Pakistan and South Africa are not marked. Taiwan’s talks with SpaceX broke down in 2022 over foreign-ownership rules.',
      },
      unit: '',
      file: 'status.json',
      layer: { kind: 'categorical', categories: STATUS },
      format: (v) => tr(STATUS.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
      timeless: true,
    },
  ],
};

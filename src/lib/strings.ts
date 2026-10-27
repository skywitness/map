/**
 * 介面文字：搜尋、快捷鍵、手機側欄抽屜、分享選單用到的字串。元件裡用 `const UI = useUI()`。
 * 其他共用的介面文字在 src/i18n/zh.ts、en.ts。
 */
import { defineMessages, useLang } from '../i18n';

const UI_TEXT = defineMessages({
  zh: {
    search: {
      label: '搜尋國家',
      placeholder: '搜尋國家（/）',
      /** 觸控裝置（沒有快捷鍵）的提示文字，手機上搜尋框只有約 130px 寬 */
      touchPlaceholder: '搜尋國家',
      noResults: '找不到符合的國家',
      /** 搜尋框也搜尋主題時（不是純地圖頁） */
      labelWithTopics: '搜尋國家或主題',
      placeholderWithTopics: '搜尋國家或主題（/）',
      touchPlaceholderWithTopics: '搜尋國家或主題',
      noResultsWithTopics: '找不到符合的國家或主題',
      /** 結果清單的組名與主題結果右邊的標籤 */
      countries: '國家',
      topics: '主題',
      kinds: { topic: '主題', indicator: '指標', item: '項目' },
      noData: '無資料',
      /** 螢幕閱讀器朗讀的結果數量 */
      resultCount: (n: number) => (n ? `${n} 個結果，用上下鍵選擇` : '找不到符合的國家'),
    },
    shortcuts: {
      button: '鍵盤快捷鍵',
      buttonTitle: '鍵盤快捷鍵（?）',
      title: '鍵盤快捷鍵',
      close: '關閉',
      note: '在輸入框打字時不會觸發。',
      items: [
        { keys: ['/'], label: '搜尋國家' },
        { keys: ['←', '→'], label: '上一年／下一年' },
        { keys: ['Space'], label: '播放／暫停歷年變化' },
        { keys: ['+', '−'], label: '放大／縮小地圖' },
        { keys: ['Esc'], label: '取消選取、關閉側欄' },
        { keys: ['?'], label: '顯示這份說明' },
      ],
    },
    sheet: {
      /** 抽屜三段高度的名稱，給螢幕閱讀器用 */
      handle: (state: 'peek' | 'half' | 'full') =>
        `調整面板高度（${{ peek: '收合', half: '半開', full: '全開' }[state]}）`,
    },
    share: {
      button: '分享',
      image: '下載地圖圖片（PNG）',
      imageBusy: '圖片產生中…',
      imageDone: '已下載圖片',
      imageFailed: '圖片產生失敗，請稍後再試',
      csvYear: (year: number) => `下載 CSV（${year} 年）`,
      /** 不隨時間變化的資料（海拔）只有一個年份，不分「這一年／所有年份」 */
      csv: '下載 CSV',
      csvAll: '下載 CSV（所有年份）',
      csvDone: '已下載 CSV',
      shareLink: '分享連結…',
      copyLink: '複製連結',
      copied: '已複製連結',
      copyFailed: '無法複製，請直接複製網址列',
    },
  },
  en: {
    search: {
      label: 'Search countries',
      placeholder: 'Search countries (/)',
      touchPlaceholder: 'Find a country',
      noResults: 'No matching countries',
      labelWithTopics: 'Search countries or topics',
      placeholderWithTopics: 'Countries or topics (/)',
      touchPlaceholderWithTopics: 'Country or topic',
      noResultsWithTopics: 'No matching countries or topics',
      countries: 'Countries',
      topics: 'Topics',
      kinds: { topic: 'Topic', indicator: 'Indicator', item: 'Item' },
      noData: 'No data',
      resultCount: (n) => (n ? `${n} ${n === 1 ? 'result' : 'results'}; use the up and down arrows to choose` : 'No matching countries'),
    },
    shortcuts: {
      button: 'Keyboard shortcuts',
      buttonTitle: 'Keyboard shortcuts (?)',
      title: 'Keyboard shortcuts',
      close: 'Close',
      note: 'Shortcuts are ignored while you are typing in a text box.',
      items: [
        { keys: ['/'], label: 'Search countries' },
        { keys: ['←', '→'], label: 'Previous / next year' },
        { keys: ['Space'], label: 'Play / pause the years' },
        { keys: ['+', '−'], label: 'Zoom the map in / out' },
        { keys: ['Esc'], label: 'Clear the selection, close the panel' },
        { keys: ['?'], label: 'Show this help' },
      ],
    },
    sheet: {
      handle: (state) => `Resize panel (${{ peek: 'collapsed', half: 'half open', full: 'fully open' }[state]})`,
    },
    share: {
      button: 'Share',
      image: 'Download map image (PNG)',
      imageBusy: 'Creating image…',
      imageDone: 'Image downloaded',
      imageFailed: 'Could not create the image. Please try again.',
      csvYear: (year) => `Download CSV (${year})`,
      csv: 'Download CSV',
      csvAll: 'Download CSV (all years)',
      csvDone: 'CSV downloaded',
      shareLink: 'Share link…',
      copyLink: 'Copy link',
      copied: 'Link copied',
      copyFailed: 'Could not copy. Please copy the address bar instead.',
    },
  },
});

export function useUI() {
  return UI_TEXT[useLang()];
}

/**
 * 介面文字：搜尋、快捷鍵、手機側欄抽屜用到的字串集中在這裡，之後要翻譯成其他語言時只改這個檔。
 */
export const UI = {
  search: {
    label: '搜尋國家',
    placeholder: '搜尋國家（/）',
    noResults: '找不到符合的國家',
    noData: '無資料',
    /** 螢幕閱讀器朗讀的結果數量 */
    resultCount: (n: number) => (n ? `${n} 個結果，用上下鍵選擇` : '找不到符合的國家'),
  },
  shortcuts: {
    button: '鍵盤快捷鍵',
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
    handle: '調整面板高度',
    /** 抽屜三段高度的名稱，給螢幕閱讀器用 */
    states: { peek: '收合', half: '半開', full: '全開' },
  },
} as const;

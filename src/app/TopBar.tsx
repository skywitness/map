import { CommandPalette, type PaletteAction } from '../controls/CommandPalette';
import type { PlaceOption } from '../controls/CommandPaletteDialog';
import { LangSwitch } from '../controls/LangSwitch';
import { LayoutMenu } from '../controls/LayoutMenu';
import { ShortcutHelp } from '../controls/ShortcutHelp';
import { TopicNav } from '../controls/TopicNav';
import { useT } from '../i18n';
import type { SearchEntry } from '../lib/countrySearch';
import type { LayoutPrefs } from '../lib/layoutPrefs';
import type { TopicTarget } from '../lib/topicSearch';
import { hrefWithEmbed } from '../lib/url-state';
import { MoonIcon, SunIcon } from '../map/MapIcons';
import type { Topic } from '../topics/types';

interface TopBarProps {
  topic: Topic;
  /** 嵌入模式（?embed=1）：頂列換成主題名稱與「在世界資料地圖開啟」 */
  embed: boolean;
  online: boolean;
  /** 從主題選單換主題（指標、子項目等回到預設） */
  onSelectTopic: (topicId: string) => void;
  /** 搜尋到的主題或指標 */
  onSelectTarget: (target: TopicTarget) => void;
  overviewOpen: boolean;
  onOverviewChange: (open: boolean) => void;
  /** 指令面板的國家搜尋範圍與指令 */
  searchIndex: SearchEntry[];
  onSelectCountry: (iso3: string) => void;
  paletteActions: PaletteAction[];
  /** 指令面板搜尋目前主題地圖上的點 */
  searchPlaces?: (query: string, limit: number) => PlaceOption[];
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  /** 版面：時間軸、資料來源與說明各自顯示或關掉 */
  layout: LayoutPrefs;
  onLayoutChange: (patch: Partial<LayoutPrefs>) => void;
}

/** 頁面最上面的一列：網站名稱、離線標示、主題選單、指令面板、語言、版面、快捷鍵、深淺色（App.tsx，2026-10-29 拆出來） */
export function TopBar({
  topic,
  embed,
  online,
  onSelectTopic,
  onSelectTarget,
  overviewOpen,
  onOverviewChange,
  searchIndex,
  onSelectCountry,
  paletteActions,
  searchPlaces,
  themeMode,
  onToggleTheme,
  layout,
  onLayoutChange,
}: TopBarProps) {
  const t = useT();
  return (
    <>
      {embed && (
        // 嵌入模式（?embed=1，放在別的網頁的 iframe 裡）：頂列換成主題名稱與「在世界資料地圖開啟」，
        // 控制列只留指標，頁尾只留資料來源（CSS 的 .is-embed）
        <header className="embed-bar">
          <h1 className="embed-title">{topic.title}</h1>
          <a
            className="embed-open"
            href={hrefWithEmbed(false)}
            target="_blank"
            rel="noopener"
            // 網址在點的當下才算（年份、國家可能剛換過）
            onClick={(e) => (e.currentTarget.href = hrefWithEmbed(false))}
          >
            {t.embedOpen}
            <span aria-hidden="true"> ↗</span>
          </a>
        </header>
      )}
      <header className="topbar" hidden={embed}>
        <h1 className="brand">{t.brand}</h1>
        {!online && (
          <span className="offline-badge" role="status" title={t.offlineHint}>
            {t.offline}
          </span>
        )}
        <TopicNav
          current={topic}
          onSelect={onSelectTopic}
          onSelectTarget={onSelectTarget}
          overviewOpen={overviewOpen}
          onOverviewChange={onOverviewChange}
        />
        <CommandPalette
          index={searchIndex}
          currentTopic={topic.id}
          onSelectCountry={onSelectCountry}
          onSelectTopic={onSelectTarget}
          actions={paletteActions}
          places={searchPlaces}
        />
        <LangSwitch />
        <LayoutMenu prefs={layout} onChange={onLayoutChange} />
        <ShortcutHelp />
        <button
          type="button"
          className="icon-button theme-toggle"
          onClick={onToggleTheme}
          aria-label={themeMode === 'dark' ? t.switchToLight : t.switchToDark}
          title={themeMode === 'dark' ? t.switchToLight : t.switchToDark}
        >
          {themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>
    </>
  );
}

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { tr, useLang, useT } from '../i18n';
import type { TopicTarget } from '../lib/topicSearch';
import { prefetchTopic, TOPIC_GROUPS, type TopicGroup, type TopicSummary } from '../topics';
import { pureMap } from '../topics/map';
import { categoryStyle, Glyph, GroupGlyph, loadTopicIcons, useTopicIcons } from './TopicIcon';
import { TopicsOverview } from './TopicsOverview';

interface TopicNavProps {
  current: Pick<TopicSummary, 'id' | 'shortTitle'>;
  onSelect: (topicId: string) => void;
  /** 主題總覽裡選到指標或子項目時（篩選「鋰」）直接開那個指標 */
  onSelectTarget: (target: TopicTarget) => void;
}

/** 選單項目下方列出的指標數 */
const SUMMARY_COUNT = 3;
/** 一欄最多幾個主題，超過就分欄（最多 3 欄），選單才不會長過螢幕 */
const ITEMS_PER_COLUMN = 7;
const MAX_COLUMNS = 3;
/** 選單與按鈕、畫面邊緣的距離 */
const GAP = 6;

type Focus = 'current' | 'first' | 'last' | 'none';

/** 主題多的分類分成幾欄；由上往下排完一欄再排下一欄，↑↓ 的順序跟畫面一致 */
function menuStyle(count: number, position: { left: number; top: number }): CSSProperties {
  const columns = Math.min(MAX_COLUMNS, Math.ceil(count / ITEMS_PER_COLUMN));
  return {
    left: position.left,
    top: position.top,
    '--menu-columns': columns,
    '--menu-rows': Math.ceil(count / columns),
  } as CSSProperties;
}

/** 只捲動主題列本身（scrollIntoView 可能連整頁一起捲）；右邊留出淡出的寬度 */
function reveal(nav: HTMLElement, button: HTMLElement): void {
  const n = nav.getBoundingClientRect();
  const b = button.getBoundingClientRect();
  if (b.left < n.left) nav.scrollLeft -= n.left - b.left + 8;
  else if (b.right > n.right - 28) nav.scrollLeft += b.right - (n.right - 28) + 8;
}

/**
 * 頂列的主題選單：純地圖一顆按鈕，其他主題依 TOPIC_GROUPS 分類，每類一個下拉選單。
 * 目前主題所在的分類按鈕會亮起，並顯示「分類 · 主題」。
 *
 * 鍵盤依 WAI-ARIA 的 menu button 模式：↓↑ 開啟、↑↓ Home End 移動、←→ 換到相鄰的分類、Esc 關閉。
 * 主題列在手機上可以橫向捲動（overflow 會裁掉往下長的選單），所以選單用 portal 放到 body、
 * 以 fixed 定位對齊按鈕。
 */
export function TopicNav({ current, onSelect, onSelectTarget }: TopicNavProps) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState<string | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusOnOpen = useRef<Focus>('current');
  const menuId = useId();

  const [overflowing, setOverflowing] = useState(false);
  const [overview, setOverview] = useState(false);
  const icons = useTopicIcons(open !== null);

  // 主題的圖示（另一個 chunk）：頁面安靜下來之後先下載，打開選單時就有；滑到、移到主題列上也開始下載
  useEffect(() => {
    const timer = setTimeout(() => {
      const idle = window.requestIdleCallback ?? ((run: () => void) => setTimeout(run, 0));
      idle(() => loadTopicIcons().catch(() => {}));
    }, 5000);
    return () => clearTimeout(timer);
  }, []);
  const warmIcons = () => {
    loadTopicIcons().catch(() => {});
  };

  const openGroup = TOPIC_GROUPS.find((g) => g.id === open) ?? null;
  // current 是 localize() 過的副本，要用 id 比對
  const activeGroup = TOPIC_GROUPS.find((g) => g.topics.some((topic) => topic.id === current.id)) ?? null;
  const isPure = current.id === pureMap.id;

  /** 選單對齊按鈕的左下角 */
  const place = (id: string) => {
    const rect = buttonRefs.current.get(id)?.getBoundingClientRect();
    if (rect) setPosition({ left: rect.left, top: rect.bottom + GAP });
    return rect !== undefined;
  };

  const show = (id: string, focus: Focus) => {
    if (!place(id)) return;
    focusOnOpen.current = focus;
    setOpen(id);
  };

  const close = (refocus: boolean) => {
    const id = open;
    setOpen(null);
    if (refocus && id) buttonRefs.current.get(id)?.focus();
  };

  // 主題列放不下（窄螢幕、英文）時可以橫向捲動，右緣淡出提示後面還有
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const check = () => setOverflowing(nav.scrollWidth > nav.clientWidth + 1);
    const observer = new ResizeObserver(check);
    observer.observe(nav);
    // 按鈕的寬度會跟著語言、目前主題改變，nav 本身的大小不一定會變
    check();
    return () => observer.disconnect();
  }, [lang, current.id]);

  // 選單超出右邊時往左移
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu || !position) return;
    const left = Math.max(GAP, Math.min(position.left, window.innerWidth - menu.offsetWidth - GAP));
    if (left !== position.left) setPosition({ ...position, left });
  }, [open, position]);

  // 開啟後把焦點放到目前主題（或第一、最後一項）
  useEffect(() => {
    if (!open) return;
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const focus = focusOnOpen.current;
    if (focus !== 'none') {
      const checked = items.find((el) => el.getAttribute('aria-checked') === 'true');
      const target = focus === 'last' ? items.at(-1) : focus === 'current' ? (checked ?? items[0]) : items[0];
      target?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const inside = (node: EventTarget | null) =>
      node instanceof Node && (navRef.current?.contains(node) || menuRef.current?.contains(node));
    const onPointerDown = (e: globalThis.PointerEvent) => {
      if (!inside(e.target)) setOpen(null);
    };
    // 主題列橫向捲動、頁面捲動、視窗改變大小時，選單跟著按鈕移動
    const follow = (e: Event) => {
      if (!(e.target instanceof Node && menuRef.current?.contains(e.target))) place(open);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [open]);

  // 換主題、手機上剛打開時，把目前的分類捲進主題列的可見範圍
  useEffect(() => {
    const nav = navRef.current;
    const button = nav?.querySelector<HTMLElement>('.is-active');
    if (nav && button) reveal(nav, button);
  }, [current.id]);

  const neighbour = (id: string, step: number) => {
    const index = TOPIC_GROUPS.findIndex((g) => g.id === id);
    return TOPIC_GROUPS[(index + step + TOPIC_GROUPS.length) % TOPIC_GROUPS.length].id;
  };

  const onButtonKeyDown = (group: TopicGroup) => (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      show(group.id, e.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  // 滑鼠移到另一個分類時，已經開著的選單直接換過去（跟桌面程式的選單列一樣）
  const onButtonPointerEnter = (group: TopicGroup) => (e: PointerEvent) => {
    if (open && open !== group.id && e.pointerType === 'mouse') show(group.id, 'none');
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    if (!open) return;
    const list = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => {
      e.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') move(index + 1);
    else if (e.key === 'ArrowUp') move(index - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(list.length - 1);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = neighbour(open, e.key === 'ArrowRight' ? 1 : -1);
      const button = buttonRefs.current.get(next);
      if (navRef.current && button) reveal(navRef.current, button);
      show(next, 'first');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') close(false);
  };

  const select = (topic: TopicSummary) => {
    close(true);
    if (topic.id !== current.id) onSelect(topic.id);
  };

  const summary = (topic: TopicSummary) =>
    t.topicSummary(
      topic.indicators.slice(0, SUMMARY_COUNT).map((ind) => tr(ind.label, lang)),
      topic.indicators.length > SUMMARY_COUNT,
    );

  // 每個分類選單的最後一項是「看全部主題」，也在 itemRefs 裡（↑↓ 移得到）
  itemRefs.current.length = (openGroup?.topics.length ?? 0) + 1;

  const openOverview = () => {
    setOpen(null);
    setOverview(true);
  };

  return (
    <nav
      className={`topics${overflowing ? ' is-overflowing' : ''}`}
      aria-label={t.topicsNav}
      ref={navRef}
      onPointerEnter={warmIcons}
      onFocus={warmIcons}
    >
      <button
        type="button"
        className={`topic topic-group${isPure ? ' is-active' : ''}`}
        style={categoryStyle(null)}
        aria-current={isPure ? 'page' : undefined}
        onClick={() => onSelect(pureMap.id)}
      >
        <GroupGlyph group="map" size={15} className="topic-group-icon" />
        {tr(pureMap.shortTitle, lang)}
      </button>
      {TOPIC_GROUPS.map((group) => {
        const active = group === activeGroup;
        const expanded = open === group.id;
        return (
          <button
            key={group.id}
            ref={(el) => {
              if (el) buttonRefs.current.set(group.id, el);
              else buttonRefs.current.delete(group.id);
            }}
            type="button"
            className={`topic topic-group${active ? ' is-active' : ''}`}
            style={categoryStyle(group.id)}
            aria-haspopup="menu"
            aria-expanded={expanded}
            aria-controls={expanded ? menuId : undefined}
            onClick={() => (expanded ? close(false) : show(group.id, 'current'))}
            onKeyDown={onButtonKeyDown(group)}
            onPointerEnter={onButtonPointerEnter(group)}
          >
            <GroupGlyph group={group.id} size={15} className="topic-group-icon" />
            <span className="topic-group-label">{tr(group.label, lang)}</span>
            {active && <span className="topic-current">{tr(current.shortTitle, lang)}</span>}
            <svg className="topic-caret" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
              <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        );
      })}
      {openGroup &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            className="topic-menu"
            id={menuId}
            role="menu"
            aria-label={tr(openGroup.label, lang)}
            style={{ ...menuStyle(openGroup.topics.length, position), ...categoryStyle(openGroup.id) }}
            onKeyDown={onMenuKeyDown}
          >
            {/* 主題排成網格（分欄），「看全部主題」在網格下面另起一行 */}
            <div className="topic-menu-items" role="none">
              {openGroup.topics.map((topic, i) => (
                <button
                  key={topic.id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={topic.id === current.id}
                  tabIndex={-1}
                  className="topic-item"
                  // 滑到、移到選項上就先下載主題的定義（各自一個 chunk），點下去不必等
                  onPointerEnter={() => prefetchTopic(topic.id)}
                  onFocus={() => prefetchTopic(topic.id)}
                  onClick={() => select(topic)}
                >
                  {/* 主題的圖示，分類代表色的底（2026-10-29 以前是縮圖，打開一個分類要下載約 300 KB） */}
                  <span className="topic-tile" aria-hidden="true">
                    <Glyph d={icons?.[topic.id]} size={18} />
                  </span>
                  <span className="topic-item-title">{tr(topic.shortTitle, lang)}</span>
                  <span className="topic-item-summary">{summary(topic)}</span>
                </button>
              ))}
            </div>
            <button
              ref={(el) => {
                itemRefs.current[openGroup.topics.length] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="topic-menu-all"
              onClick={openOverview}
            >
              {t.allTopicsMenu}
              <span aria-hidden="true"> →</span>
            </button>
          </div>,
          document.body,
        )}
      <TopicsOverview
        open={overview}
        current={current}
        onClose={() => setOverview(false)}
        onSelect={(target) => {
          setOverview(false);
          if (target.indicator || target.item || target.topic !== current.id) onSelectTarget(target);
        }}
      />
    </nav>
  );
}

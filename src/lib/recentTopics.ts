/**
 * 最近看過的主題（2026-10-29）：存在這台瀏覽器的 localStorage，最新的在前，最多 8 個。
 * 主題總覽的「最近看過」、指令面板（Ctrl+K）空白時列出；只是方便，讀寫失敗（無痕模式、停用儲存）就當作沒有。
 */
import { CATALOG } from '../topics/catalog.gen';

const KEY = 'recentTopics';
const MAX = 8;

export function readRecentTopics(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    // 主題可能改名或拿掉了：只留現在還有的
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string' && id in CATALOG.topics) : [];
  } catch {
    return [];
  }
}

/** 記下剛打開的主題（移到最前面） */
export function rememberTopic(id: string): void {
  try {
    const list = [id, ...readRecentTopics().filter((t) => t !== id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 不能存就算了
  }
}

import { formatPercent } from '../lib/format';

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  /** 類別色；不給就用主色（單一系列） */
  color?: string;
}

interface BarListProps {
  items: BarListItem[];
  format: (value: number) => string;
  /** 有給就在右側顯示占比 */
  total?: number;
  /** 長條比例尺的最大值，預設為清單中的最大值 */
  max?: number;
  ariaLabel: string;
}

/** 橫向長條清單：比 treemap 好讀，數值與占比直接寫出來，不必 hover */
export function BarList({ items, format, total, max, ariaLabel }: BarListProps) {
  const scaleMax = max ?? Math.max(...items.map((i) => i.value), 0);
  return (
    <ul className="bar-list" aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={item.key}>
          <span className="bar-label">
            {item.color && <span className="bar-key" style={{ background: item.color }} />}
            {item.label}
          </span>
          <span className="bar-value">{format(item.value)}</span>
          {total !== undefined && total > 0 && (
            <span className="bar-share">{formatPercent((item.value / total) * 100, item.value / total < 0.1 ? 1 : 0)}</span>
          )}
          <span className="bar-track" aria-hidden="true">
            <span
              className="bar-fill"
              style={{
                width: `${scaleMax > 0 ? Math.max(0, (item.value / scaleMax) * 100) : 0}%`,
                background: item.color,
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

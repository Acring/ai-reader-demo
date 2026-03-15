import { useState } from 'react';
import { TERM_TYPE_COLORS } from '../termColors';

export function TermLegend() {
  const [collapsed, setCollapsed] = useState(false);
  const entries = Object.entries(TERM_TYPE_COLORS);

  return (
    <div className="term-legend">
      <div className="term-legend-header" onClick={() => setCollapsed((v) => !v)}>
        <span className="term-legend-title">术语类型图例</span>
        <span className="term-legend-toggle">{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && (
        <div className="term-legend-list">
          {entries.map(([type, { color, label }]) => (
            <div key={type} className="term-legend-item">
              <span className="term-legend-dot" style={{ backgroundColor: color }} />
              <span className="term-legend-label" style={{ color }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

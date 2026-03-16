import { TERM_TYPE_COLORS, type TermTypesMap } from '../termColors';

interface TermExplanationPanelProps {
  term: string;
  termTypes: TermTypesMap;
  onClose: () => void;
}

export function TermExplanationPanel({
  term,
  termTypes,
  onClose,
}: TermExplanationPanelProps) {
  const entry = termTypes[term];
  if (!entry) return null;

  const typeInfo = TERM_TYPE_COLORS[entry.type];
  const color = typeInfo?.color ?? '#666';
  const label = typeInfo?.label ?? entry.type;

  return (
    <div className="term-explanation-panel">
      <div className="term-explanation-header">
        <span className="term-explanation-title">术语解释</span>
        <button className="term-explanation-close" onClick={onClose}>
          &times;
        </button>
      </div>
      <div className="term-explanation-body">
        <div className="term-explanation-name" style={{ color }}>
          {term}
        </div>
        <div className="term-explanation-type">
          <span className="term-explanation-dot" style={{ backgroundColor: color }} />
          <span>{label}</span>
        </div>
        {entry.explanation ? (
          <div className="term-explanation-text">{entry.explanation}</div>
        ) : (
          <div className="term-explanation-empty">暂无解释</div>
        )}
      </div>
    </div>
  );
}

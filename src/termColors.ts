export const TERM_TYPE_COLORS: Record<string, { color: string; label: string }> = {
  policy:         { color: '#e63946', label: '政策/制度/法规' },
  concept:        { color: '#457b9d', label: '抽象概念/理念' },
  mechanism:      { color: '#2a9d8f', label: '体制机制/工作方法' },
  goal:           { color: '#e9c46a', label: '目标/战略方向' },
  service:        { color: '#f4a261', label: '公共服务/社会服务' },
  industry:       { color: '#264653', label: '产业/行业/经济业态' },
  right:          { color: '#6a0572', label: '权利/权益' },
  technology:     { color: '#118ab2', label: '具体技术/技术领域' },
  issue:          { color: '#ef476f', label: '问题/挑战/风险' },
  institution:    { color: '#073b4c', label: '组织/机构/制度性实体' },
  infrastructure: { color: '#06d6a0', label: '基础设施/工程/系统' },
  standard:       { color: '#8338ec', label: '标准/规范/指标' },
  region:         { color: '#ff6b35', label: '地理区域/地名' },
  group:          { color: '#d62828', label: '人群/群体' },
  product:        { color: '#3a86a7', label: '具体产品/物品' },
  resource:       { color: '#588157', label: '资源' },
};

export interface TermEntry {
  type: string;
  explanation?: string;
}

export type TermTypesMap = Record<string, TermEntry>;

export interface TermMatch {
  start: number;
  end: number;
  term: string;
  type: string;
  color: string;
}

/**
 * 在文本中查找所有术语匹配，采用最长匹配优先策略，不重叠。
 */
export function findTermMatches(text: string, termTypes: TermTypesMap): TermMatch[] {
  const terms = Object.keys(termTypes).filter((t) => t.length > 0);
  if (terms.length === 0) return [];

  // 按长度降序排序，优先匹配最长的术语
  terms.sort((a, b) => b.length - a.length);

  // occupied[i] 标记位置 i 是否已被占用
  const occupied = new Uint8Array(text.length);
  const matches: TermMatch[] = [];

  for (const term of terms) {
    let idx = 0;
    while ((idx = text.indexOf(term, idx)) !== -1) {
      let conflict = false;
      for (let k = idx; k < idx + term.length; k++) {
        if (occupied[k]) { conflict = true; break; }
      }
      if (!conflict) {
        const type = termTypes[term].type;
        const colorEntry = TERM_TYPE_COLORS[type];
        if (colorEntry) {
          matches.push({ start: idx, end: idx + term.length, term, type, color: colorEntry.color });
          for (let k = idx; k < idx + term.length; k++) occupied[k] = 1;
        }
      }
      idx += 1;
    }
  }

  matches.sort((a, b) => a.start - b.start);
  return matches;
}

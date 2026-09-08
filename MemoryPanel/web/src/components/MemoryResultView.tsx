/**
 * MemoryResultView — 可读结果渲染器。
 *
 * 把内核 /v3/memory/* 返回的对象渲染成结构化可读内容（键值行 + 标签 + 徽标 + 列表），
 * 取代裸 JSON `<pre>`。仅在遇到无法结构化的值时才回退为紧凑 JSON。
 */
import { Tag } from 'tea-component';

// 常见"状态/枚举"词 → 主题色
const TAG_THEME: Record<string, string> = {
  completed: 'success', approved: 'success', ok: 'success', active: 'success', success: 'success', automatic: 'success', true: 'success', runnable: 'success', recallable: 'success', writable: 'success', usable: 'success', allowed: 'success', commit: 'success', merge: 'primary', update: 'primary', link: 'primary', keep: 'primary', verified: 'success', published: 'success',
  failed: 'error', rejected: 'error', denied: 'error', deny: 'error', error: 'error', false: 'error', disputed: 'error', superseded: 'error', deleted: 'error', archived: 'warning', stale: 'warning', low: 'error', untrusted: 'error', archive: 'warning',
  pending: 'warning', pending_approval: 'warning', review_required: 'warning', explicit_only: 'warning', review: 'warning', risky: 'warning', hold: 'warning', candidate: 'default', dormant: 'default', consolidat: 'default', consolidated: 'primary',
};

function themeFor(s: string): string {
  return TAG_THEME[s] ?? TAG_THEME[s.toLowerCase()] ?? 'default';
}

function labelize(key: string): string {
  // snake_case / camelCase → 空格分隔的可读词
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
}

function isScalar(v: unknown): v is string | number | boolean | null | undefined {
  return v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/** 标量：布尔→是/否，状态词→Tag，其余按文本/数字。 */
function Scalar({ v }: { v: unknown }) {
  if (v === null || v === undefined) return <span className="_rv-empty">—</span>;
  if (typeof v === 'boolean') return <Tag theme={v ? 'success' : 'error'}>{v ? '是' : '否'}</Tag>;
  if (typeof v === 'number') return <span className="_rv-num">{v}</span>;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return <span className="_rv-empty">—</span>;
    if (t.length <= 28 && /^[\w.-]+$/.test(t)) {
      return <Tag theme={themeFor(t) as 'success'}>{t}</Tag>;
    }
    return <span className="_rv-text">{v}</span>;
  }
  return null;
}

function Value({ v }: { v: unknown }) {
  if (isScalar(v)) return <Scalar v={v} />;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="_rv-empty">（空）</span>;
    if (v.every(isScalar)) {
      return (
        <div className="_rv-chips">
          {v.map((x, i) => <span key={i} className="_rv-chip">{String(x)}</span>)}
        </div>
      );
    }
    return (
      <div className="_rv-list">
        {v.map((x, i) => <Value key={i} v={x} />)}
      </div>
    );
  }
  if (typeof v === 'object') {
    return <ResultView value={v as Record<string, unknown>} nested />;
  }
  return <span>{String(v)}</span>;
}

export function ResultView({ value, nested }: { value: unknown; nested?: boolean }) {
  if (value === null || value === undefined) return <span className="_rv-empty">—</span>;
  if (typeof value !== 'object' || Array.isArray(value)) return <Value v={value} />;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span className="_rv-empty">（空对象）</span>;
  return (
    <div className="_rv-block" style={nested ? { paddingLeft: 14, borderLeft: '2px solid #eee' } : undefined}>
      {entries.map(([k, v]) => (
        <div key={k} className="_rv-row">
          <span className="_rv-key">{labelize(k)}</span>
          <span className="_rv-val"><Value v={v} /></span>
        </div>
      ))}
    </div>
  );
}

export default ResultView;
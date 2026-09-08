/**
 * QueryFAB — 浮动 Cypher 查询按钮（对齐 GitNexus）。
 */
import { useState, useRef, useEffect } from 'react';
import { Terminal, Play, X, Loader2 } from 'lucide-react';

const EXAMPLES = [
  { label: 'Functions', query: `MATCH (n) WHERE n.id CONTAINS 'Function:' RETURN n.id, n.name, n.filePath LIMIT 50` },
  { label: 'Classes', query: `MATCH (n) WHERE n.id CONTAINS 'Class:' RETURN n.id, n.name, n.filePath LIMIT 50` },
  { label: 'Calls', query: `MATCH (a)-[r]->(b) WHERE r.type = 'CALLS' RETURN a.id, a.name, b.id, b.name, r.type LIMIT 50` },
  { label: 'Imports', query: `MATCH (a)-[r]->(b) WHERE r.type = 'IMPORTS' RETURN a.id, a.name, b.id, b.name, r.type LIMIT 50` },
];

interface Props {
  repoPath: string;
  authFetch: (path: string) => Promise<any>;
}

export function QueryFAB({ repoPath, authFetch }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setQuery(''); setResult('');
  }, [open]);

  const runQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await authFetch(
        `/api/v1/knowledge/code-graph/engine/search?repo=${encodeURIComponent(repoPath)}&q=${encodeURIComponent(query.trim())}`
      );
      const results = data.results ?? [];
      if (results.length === 0) {
        setResult('No results.');
      } else {
        const cols = Object.keys(results[0]);
        const header = '| ' + cols.join(' | ') + ' |\n| ' + cols.map(() => '---').join(' | ') + ' |';
        const rows = results.slice(0, 20).map((r: any) => '| ' + cols.map(c => String(r[c] ?? '')).join(' | ') + ' |').join('\n');
        setResult(header + '\n' + rows + (results.length > 20 ? `\n\n*...and ${results.length - 20} more*` : ''));
      }
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="absolute left-3 bottom-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg hover:bg-purple-700 transition-colors"
        title="Cypher Query"
      >
        <Terminal className="h-5 w-5" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-16 bottom-3 z-10 w-96 rounded-lg border border-gray-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <span className="text-sm font-semibold text-gray-700">Cypher Query</span>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-3">
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="MATCH (n) RETURN n LIMIT 10"
              rows={3}
              className="w-full rounded border border-gray-200 px-3 py-2 text-xs font-mono outline-none focus:border-purple-400 resize-none"
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) runQuery(); }}
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-1">
                {EXAMPLES.map(ex => (
                  <button key={ex.label} onClick={() => setQuery(ex.query)} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500 hover:bg-purple-100 hover:text-purple-700">
                    {ex.label}
                  </button>
                ))}
              </div>
              <button
                onClick={runQuery}
                disabled={loading || !query.trim()}
                className="flex items-center gap-1 rounded bg-purple-600 px-3 py-1 text-xs text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Run
              </button>
            </div>
          </div>
          {result && (
            <div className="border-t border-gray-100 p-3 max-h-60 overflow-auto">
              <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap">{result}</pre>
            </div>
          )}
        </div>
      )}
    </>
  );
}
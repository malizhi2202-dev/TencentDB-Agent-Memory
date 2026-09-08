/**
 * AIChatPanel — 右下角 AI 代码分析浮窗。
 * 对标 GitNexus QueryFAB，保持当前 UI 风格（蓝色 #2563eb，Developer Tool 调性）。
 */
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

interface Props {
  repoPath: string;
  selectedNodeName?: string;
}

export function AIChatPanel({ repoPath, selectedNodeName }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedNodeName && open) {
      setQuery(`分析 ${selectedNodeName}`);
    }
  }, [selectedNodeName, open]);

  const send = async () => {
    const q = query.trim();
    if (!q || loading) return;
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setQuery('');
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/knowledge/code-graph/engine/chat?q=${encodeURIComponent(q)}&repo=${encodeURIComponent(repoPath)}`,
        { headers: { 'X-Tdai-Service-Id': 'default' } }
      );
      const data = await res.json();
      const text = data?.data?.text || data?.data?.result?.text || 'No response';
      setMessages(prev => [...prev, { role: 'ai', text }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        title="AI Code Analysis"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex h-96 w-80 flex-col rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <span className="text-sm font-semibold text-gray-700">AI Code Analysis</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {messages.length === 0 && (
              <p className="text-gray-400 text-xs text-center mt-4">Ask about code structure, dependencies, or patterns...</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-blue-50 text-blue-800 ml-4' : 'bg-gray-50 text-gray-700 mr-4'}`}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-gray-400 text-xs px-3">
                <Loader2 size={14} className="animate-spin" /> Analyzing...
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-gray-100 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about this codebase..."
              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            />
            <button onClick={send} disabled={loading} className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
/**
 * RightPanel — 右侧面板（Chat + Processes 双 Tab）。
 * 对标 GitNexus RightPanel，保持当前 UI 风格。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Workflow, X, Send, Loader2, ArrowRight } from 'lucide-react';
import { knowledgeApi } from '@/lib/knowledge-api';
import type { GraphNode, GraphEdge } from '../CodeGraphPage';

interface ChatMessage { role: 'user' | 'ai'; text: string; }

interface Props {
  repoPath: string;
  codeGraphId: string;
  selectedNode: GraphNode | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onFocusNode: (nodeId: string) => void;
}

export function RightPanel({ repoPath, codeGraphId, selectedNode }: Props) {
  const [tab, setTab] = useState<'chat' | 'processes'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [processes, setProcesses] = useState<any[]>([]);
  const [procsLoading, setProcsLoading] = useState(false);
  const [processPid, setProcessPid] = useState<string | null>(null);
  const [flowSteps, setFlowSteps] = useState<any[]>([]);
  const [flowEdges, setFlowEdges] = useState<any[]>([]);
  const [flowLoading, setFlowLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-send AI analysis when node is selected
  useEffect(() => {
    if (selectedNode && tab === 'chat') {
      setInput(`分析 ${selectedNode.name || selectedNode.id} (${selectedNode.type || selectedNode.label})`);
    }
  }, [selectedNode, tab]);

  // Load processes
  useEffect(() => {
    if (tab === 'processes' && processes.length === 0 && repoPath) {
      setProcsLoading(true);
      fetch(`/api/v1/knowledge/code-graph/engine/processes?repo=${encodeURIComponent(repoPath)}`)
        .then(r => r.json()).then(d => { if (d.code === 0) setProcesses(d.data?.processes || []); })
        .catch(() => {}).finally(() => setProcsLoading(false));
    }
  }, [tab, repoPath, processes.length]);

  const sendMessage = useCallback(async () => {
    const q = input.trim(); if (!q || loading) return;
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput(''); setLoading(true);
    try {
      const result = await knowledgeApi.codeAnalysis.ask(codeGraphId, q);
      setMessages(prev => [...prev, { role: 'ai', text: result.isError ? `分析失败：${result.text}` : result.text || 'No response' }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${err?.message ?? String(err)}` }]);
    } finally { setLoading(false); }
  }, [input, loading, codeGraphId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const loadFlow = useCallback(async (pid: string) => {
    setProcessPid(pid); setFlowLoading(true);
    try {
      const res = await fetch(`/api/v1/knowledge/code-graph/engine/process-flow?repo=${encodeURIComponent(repoPath)}&pid=${encodeURIComponent(pid)}`);
      const d = await res.json();
      if (d.code === 0) { setFlowSteps(d.data?.steps || []); setFlowEdges(d.data?.edges || []); }
    } catch {} finally { setFlowLoading(false); }
  }, [repoPath]);

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-white">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {[
          { id: 'chat' as const, icon: MessageCircle, label: 'AI 分析' },
          { id: 'processes' as const, icon: Workflow, label: '流程分析' },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${tab === id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Chat tab */}
      {tab === 'chat' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2">
            {messages.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-8">Click a node or file to start AI analysis</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`rounded-lg px-2.5 py-1.5 text-xs ${m.role === 'user' ? 'bg-blue-50 text-blue-800 ml-3' : 'bg-gray-50 text-gray-700 mr-3'}`}>
                {m.text}
              </div>
            ))}
            {loading && <div className="flex items-center gap-2 text-xs text-gray-400 px-2"><Loader2 size={12} className="animate-spin" /> Analyzing...</div>}
          </div>
          <div className="flex items-center gap-1.5 border-t border-gray-100 p-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about this codebase..."
              className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />
            <button onClick={sendMessage} disabled={loading}
              className="flex h-7 w-7 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              <Send size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Processes tab */}
      {tab === 'processes' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {procsLoading && <div className="flex items-center gap-2 text-xs text-gray-400 p-3"><Loader2 size={12} className="animate-spin" /> Loading...</div>}
          {!procsLoading && processes.length === 0 && <p className="text-xs text-gray-400 p-3">No processes in this repo</p>}
          {processes.map(p => (
            <button key={p.id} onClick={() => loadFlow(p.id)}
              className={`text-left px-3 py-2 text-xs border-b border-gray-50 ${processPid === p.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <div className="font-medium text-gray-700 truncate">{p.name || p.id}</div>
              {p.processType && <div className="text-[10px] text-gray-400">{p.processType} · {p.stepCount ?? 0} steps</div>}
            </button>
          ))}
          {/* Flow diagram */}
          {processPid && (
            <div className="border-t border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Process Flow</span>
                <button onClick={() => setProcessPid(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
              {flowLoading && <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 size={12} className="animate-spin" /></div>}
              <div className="space-y-1.5">
                {flowSteps.sort((a, b) => (a.step ?? 0) - (b.step ?? 0)).map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{s.step ?? '?'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700 truncate">{s.name}</div>
                      {s.filePath && <div className="text-[10px] text-gray-400 truncate">{s.filePath}</div>}
                    </div>
                    {flowEdges.some(e => e.source === s.id) && <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
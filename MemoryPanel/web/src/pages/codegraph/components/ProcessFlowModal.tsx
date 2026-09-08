/**
 * ProcessFlowModal — Process 流程图模态框。
 * 对标 GitNexus ProcessFlowModal，展示流程步骤与调用关系。
 */
import { useState, useEffect } from 'react';
import { X, Loader2, ArrowRight } from 'lucide-react';

interface FlowStep {
  id: string;
  name: string;
  filePath?: string;
  step?: number;
}

interface FlowEdge {
  source: string;
  target: string;
  type: string;
}

interface Props {
  repoPath: string;
  pid: string;
  onClose: () => void;
}

export function ProcessFlowModal({ repoPath, pid, onClose }: Props) {
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/knowledge/code-graph/engine/process-flow?repo=${encodeURIComponent(repoPath)}&pid=${encodeURIComponent(pid)}`)
      .then(r => r.json())
      .then(d => {
        if (d.code === 0) {
          setSteps(d.data?.steps || []);
          setEdges(d.data?.edges || []);
        } else setError(d.message || 'Failed');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [repoPath, pid]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Process Flow</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> Loading flow...</div>}
          {error && <div className="text-sm text-red-500">{error}</div>}
          {!loading && !error && (
            <div className="space-y-2">
              {steps.sort((a, b) => (a.step ?? 0) - (b.step ?? 0)).map(s => {
                const nextEdges = edges.filter(e => e.source === s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                      {s.step ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{s.name}</div>
                      {s.filePath && <div className="text-[10px] text-gray-400 truncate">{s.filePath}</div>}
                    </div>
                    {nextEdges.length > 0 && <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />}
                  </div>
                );
              })}
              {steps.length === 0 && <div className="text-sm text-gray-400">No steps in this process</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
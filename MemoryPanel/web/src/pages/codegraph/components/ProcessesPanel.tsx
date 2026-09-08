/**
 * ProcessesPanel — Process 列表面板。
 * 显示代码仓库中的流程节点，点击可查看流程图。
 */
import { useState, useEffect } from 'react';
import { Workflow, Loader2 } from 'lucide-react';

interface ProcessItem {
  id: string;
  name: string;
  processType?: string;
  stepCount?: number;
}

interface Props {
  repoPath: string;
  onSelectProcess: (pid: string) => void;
  selectedPid?: string;
}

export function ProcessesPanel({ repoPath, onSelectProcess, selectedPid }: Props) {
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setError('');
    fetch(`/api/v1/knowledge/code-graph/engine/processes?repo=${encodeURIComponent(repoPath)}`)
      .then(r => r.json())
      .then(d => {
        if (d.code === 0) setProcesses(d.data?.processes || []);
        else setError(d.message || 'Failed');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [repoPath]);

  return (
    <div className="p-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase mb-2">
        <Workflow size={14} /> Processes
      </h3>
      {loading && <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 size={12} className="animate-spin" /> Loading...</div>}
      {error && <div className="text-xs text-red-500">{error}</div>}
      {!loading && !error && processes.length === 0 && (
        <div className="text-xs text-gray-400">No processes found in this repo</div>
      )}
      <div className="flex flex-col gap-1">
        {processes.map(p => (
          <button key={p.id} onClick={() => onSelectProcess(p.id)}
            className={`text-left text-xs rounded px-2 py-1.5 ${selectedPid === p.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'}`}>
            <div className="font-medium truncate">{p.name || p.id}</div>
            {p.processType && <div className="text-[10px] text-gray-400">{p.processType} · {p.stepCount ?? 0} steps</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
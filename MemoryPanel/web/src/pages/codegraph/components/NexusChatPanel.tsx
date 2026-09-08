/**
 * NexusChatPanel — 对话式 AI Agent（对齐 GitNexus Nexus AI）。
 * 支持流式响应、工具调用卡片、接地链接、停止生成。
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Sparkles, Loader2, User, Trash2, Square, Wrench, FileText, Search, Zap } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  steps?: MessageStep[];
  timestamp: number;
}

interface MessageStep {
  id: string;
  type: 'content' | 'tool_call' | 'reasoning';
  content?: string;
  toolCall?: { name: string; args: string; result?: string };
}

const QUICK_ACTIONS = [
  'What does this project do?',
  'List the main classes and their responsibilities',
  'Show me how authentication works',
  'Find the most important files',
];

interface Props {
  repoPath: string;
  authFetch: (path: string) => Promise<any>;
}

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('panel_session');
    if (raw) {
      const s = JSON.parse(raw);
      return { 'X-Tdai-Service-Id': s.instanceId || '', 'X-Tdai-User-Key': s.userKey || '' };
    }
  } catch { /* */ }
  return {};
}

export function NexusChatPanel({ repoPath, authFetch: _authFetch }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string, steps?: MessageStep[]) => {
    setMessages(prev => [...prev, { role, content, steps, timestamp: Date.now() }]);
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput('');
    addMessage('user', q);

    setLoading(true);
    const ac = new AbortController();
    setAbortCtrl(ac);

    const base = '/api/v1/knowledge/code-graph/engine';
    const headers = { ...authHeaders(), 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`${base}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          repo: repoPath,
          messages: [{ role: 'user', content: q }],
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Chat failed' }));
        addMessage('assistant', `Error: ${err.error || 'Chat failed'}`);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { addMessage('assistant', 'No response'); setLoading(false); return; }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      const steps: MessageStep[] = [];
      let stepCounter = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'content') {
              fullContent += data.content;
              // Update last message in-place for streaming feel
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') {
                  last.content = fullContent;
                  last.steps = [...steps, { id: `c${++stepCounter}`, type: 'content', content: data.content }];
                } else {
                  next.push({ role: 'assistant', content: fullContent, steps: [...steps], timestamp: Date.now() });
                }
                return next;
              });
            } else if (data.type === 'tool_start') {
              steps.push({ id: `t${++stepCounter}`, type: 'tool_call', toolCall: { name: data.tool, args: data.args } });
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') last.steps = [...steps];
                return next;
              });
            } else if (data.type === 'tool_result') {
              const lastStep = steps[steps.length - 1];
              if (lastStep?.toolCall) lastStep.toolCall.result = data.result;
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') last.steps = [...steps];
                return next;
              });
            }
          } catch { /* parse error */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        addMessage('assistant', `Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
      setAbortCtrl(null);
    }
  }, [input, loading, repoPath, addMessage]);

  const handleStop = () => { abortCtrl?.abort(); setLoading(false); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const clearChat = () => setMessages([]);

  const toolIcon = (name: string) => {
    if (name.includes('cypher')) return <Zap className="h-3.5 w-3.5" />;
    if (name.includes('read')) return <FileText className="h-3.5 w-3.5" />;
    if (name.includes('search')) return <Search className="h-3.5 w-3.5" />;
    return <Wrench className="h-3.5 w-3.5" />;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-semibold text-gray-700">Nexus AI</span>
          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-600">Agent</span>
        </div>
        <button onClick={clearChat} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Clear">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-2xl mx-auto">🧠</div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">Ask about the codebase</h3>
            <p className="mb-4 text-xs text-gray-400">AI-powered analysis with graph grounding</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_ACTIONS.map(a => (
                <button key={a} onClick={() => { setInput(a); }}
                  className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-100">
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="animate-fade-in">
            {m.role === 'user' && (
              <div className="mb-3">
                <div className="mb-1 flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-400 uppercase">You</span>
                </div>
                <div className="pl-6 text-sm text-gray-700">{m.content}</div>
              </div>
            )}
            {m.role === 'assistant' && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-xs font-medium text-gray-400 uppercase">Nexus</span>
                  {loading && i === messages.length - 1 && (
                    <Loader2 className="h-3 w-3 animate-spin text-purple-500" />
                  )}
                </div>
                <div className="pl-6 space-y-3">
                  {m.steps && m.steps.length > 0 ? (
                    m.steps.map((step) => (
                      <div key={step.id}>
                        {step.type === 'tool_call' && step.toolCall && (
                          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-200">
                              {toolIcon(step.toolCall.name)}
                              <span className="text-xs font-medium text-gray-600">{step.toolCall.name}</span>
                              {step.toolCall.result ? (
                                <span className="ml-auto text-xs text-green-500">✓</span>
                              ) : (
                                <Loader2 className="ml-auto h-3 w-3 animate-spin text-gray-400" />
                              )}
                            </div>
                            <div className="px-3 py-2 text-xs font-mono text-gray-500">
                              {step.toolCall.args?.slice(0, 200)}
                            </div>
                            {step.toolCall.result && (
                              <div className="px-3 py-2 text-xs font-mono text-gray-600 border-t border-gray-200 max-h-24 overflow-y-auto">
                                {step.toolCall.result.slice(0, 500)}
                              </div>
                            )}
                          </div>
                        )}
                        {step.type === 'content' && step.content && (
                          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {step.content}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the codebase..."
            rows={1}
            disabled={loading}
            className="min-h-[36px] flex-1 resize-none border-none bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 disabled:opacity-50"
            style={{ height: '36px', overflowY: 'hidden' }}
          />
          {loading ? (
            <button onClick={handleStop} className="flex h-9 w-9 items-center justify-center rounded-md bg-red-500/80 text-white hover:bg-red-500">
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <span>LLM Agent · Supports tool calls</span>
        </div>
      </div>
    </div>
  );
}
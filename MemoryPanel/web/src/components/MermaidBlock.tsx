/**
 * MermaidBlock —— 渲染 Mermaid 图表（architecture diagram）。
 * 使用 mermaid 库动态渲染到 SVG，支持缩放和拖拽。
 */
import { useEffect, useRef, useId, useState, useCallback } from 'react';
import mermaid from 'mermaid';

// 初始化一次
let initialized = false;
function ensureInit() {
  if (initialized) return;
  initialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  });
}

export function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // zoom/pan state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    ensureInit();
    const container = containerRef.current;
    if (!container || !code) return;

    let cancelled = false;

    (async () => {
      try {
        const { svg } = await mermaid.render(`mermaid-${id.replace(/:/g, '_')}`, code);
        if (!cancelled && container) {
          container.innerHTML = svg;
          // auto-fit: scale to fit container width
          const svgEl = container.querySelector('svg');
          if (svgEl) {
            const containerW = container.parentElement?.clientWidth ?? 800;
            const svgW = svgEl.getBoundingClientRect().width || svgEl.viewBox?.baseVal?.width || 800;
            const fitScale = Math.min(1, (containerW - 32) / svgW);
            setScale(fitScale);
            setPan({ x: 0, y: 0 });
          }
        }
      } catch (err) {
        if (!cancelled && container) {
          container.innerHTML = `<pre class="mermaid-error">${(err as Error).message || String(err)}</pre>`;
        }
      }
    })();

    return () => { cancelled = true; };
  }, [code, id]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.max(0.2, Math.min(3, s + delta)));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      className="mermaid-canvas"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
    >
      <div
        ref={svgRef}
        className="mermaid-stage"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        <div ref={containerRef} />
      </div>
      <div className="mermaid-zoom-hint">
        🖱️ 滚轮缩放 · 拖拽平移 · 当前 {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
/**
 * AssetMarkdown —— 资产页统一的 Markdown 渲染组件。
 *
 * 从 WikiSourcesPanel / CodeSourcesPanel 收敛：两侧此前各有一份复制粘贴的
 * mdComponents，统一收口到此，避免再次分叉。
 *
 * 两种密度（组件库版本差异）：
 *   - default：Wiki 详情正文用的较大字号（text-sm / text-lg）
 *   - compact：Code 详情搜索结果/探索结果用的紧凑字号（text-[11px]~[13px]）
 * 传入 compact 即切换为 Code 侧原有样式，保持两页视觉不回退。
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Wiki 详情正文密度（默认） */
export const mdComponents = {
  h1: ({ children, ...p }: any) => (
    <h1 className="text-xl font-bold mb-3 mt-0 pb-2 border-b border-border text-foreground" {...p}>
      {children}
    </h1>
  ),
  h2: ({ children, ...p }: any) => (
    <h2 className="text-lg font-semibold mb-2 mt-6 text-foreground/85" {...p}>
      {children}
    </h2>
  ),
  h3: ({ children, ...p }: any) => (
    <h3 className="text-base font-semibold mb-1.5 mt-4 text-foreground/85" {...p}>
      {children}
    </h3>
  ),
  h4: ({ children, ...p }: any) => (
    <h4 className="text-sm font-semibold mb-1 mt-3 text-foreground/85" {...p}>
      {children}
    </h4>
  ),
  p: ({ children, ...p }: any) => (
    <p className="text-sm leading-relaxed mb-3 text-foreground/70" {...p}>
      {children}
    </p>
  ),
  ul: ({ children, ...p }: any) => (
    <ul className="text-sm list-disc pl-5 mb-3 space-y-1 text-foreground/70" {...p}>
      {children}
    </ul>
  ),
  ol: ({ children, ...p }: any) => (
    <ol className="text-sm list-decimal pl-5 mb-3 space-y-1 text-foreground/70" {...p}>
      {children}
    </ol>

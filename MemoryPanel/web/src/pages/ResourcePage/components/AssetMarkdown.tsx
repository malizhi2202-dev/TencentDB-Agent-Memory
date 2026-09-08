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
  ),
  li: ({ children, ...p }: any) => (
    <li className="text-sm text-foreground/70" {...p}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...p }: any) => (
    <blockquote className="border-l-2 border-border pl-3 my-3 italic text-foreground/60" {...p}>
      {children}
    </blockquote>
  ),
  a: ({ children, ...p }: any) => (
    <a className="text-primary underline underline-offset-2 hover:opacity-80" target="_blank" rel="noreferrer" {...p}>
      {children}
    </a>
  ),
  img: ({ alt, ...p }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="max-w-full rounded-md my-2" alt={alt ?? ''} {...p} />
  ),
  code: ({ children, ...p }: any) => (
    <code className="text-[13px] rounded bg-muted px-1.5 py-0.5 font-mono text-foreground/90" {...p}>
      {children}
    </code>
  ),
  pre: ({ children, ...p }: any) => (
    <pre className="text-[13px] rounded-md bg-muted p-3 my-3 overflow-x-auto text-foreground/90" {...p}>
      {children}
    </pre>
  ),
  table: ({ children, ...p }: any) => (
    <div className="overflow-x-auto my-3">
      <table className="text-sm w-full border-collapse text-foreground/70" {...p}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...p }: any) => (
    <th className="border border-border px-2 py-1 text-left font-semibold bg-muted/50" {...p}>
      {children}
    </th>
  ),
  td: ({ children, ...p }: any) => (
    <td className="border border-border px-2 py-1" {...p}>
      {children}
    </td>
  ),
  hr: ({ ...p }: any) => <hr className="my-4 border-border" {...p} />,
};

/** Code 详情紧凑密度（compact） */
export const compactMdComponents = {
  h1: ({ children, ...p }: any) => (
    <h1 className="text-[13px] font-bold mb-2 mt-0 pb-1 border-b border-border text-foreground" {...p}>
      {children}
    </h1>
  ),
  h2: ({ children, ...p }: any) => (
    <h2 className="text-[13px] font-semibold mb-1.5 mt-4 text-foreground/85" {...p}>
      {children}
    </h2>
  ),
  h3: ({ children, ...p }: any) => (
    <h3 className="text-[12px] font-semibold mb-1 mt-3 text-foreground/85" {...p}>
      {children}
    </h3>
  ),
  h4: ({ children, ...p }: any) => (
    <h4 className="text-[12px] font-semibold mb-1 mt-2 text-foreground/85" {...p}>
      {children}
    </h4>
  ),
  p: ({ children, ...p }: any) => (
    <p className="text-[11px] leading-relaxed mb-2 text-foreground/70" {...p}>
      {children}
    </p>
  ),
  ul: ({ children, ...p }: any) => (
    <ul className="text-[11px] list-disc pl-4 mb-2 space-y-0.5 text-foreground/70" {...p}>
      {children}
    </ul>
  ),
  ol: ({ children, ...p }: any) => (
    <ol className="text-[11px] list-decimal pl-4 mb-2 space-y-0.5 text-foreground/70" {...p}>
      {children}
    </ol>
  ),
  li: ({ children, ...p }: any) => (
    <li className="text-[11px] text-foreground/70" {...p}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...p }: any) => (
    <blockquote className="border-l-2 border-border pl-2 my-2 italic text-foreground/60" {...p}>
      {children}
    </blockquote>
  ),
  a: ({ children, ...p }: any) => (
    <a className="text-primary underline underline-offset-2 hover:opacity-80" target="_blank" rel="noreferrer" {...p}>
      {children}
    </a>
  ),
  img: ({ alt, ...p }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="max-w-full rounded my-1.5" alt={alt ?? ''} {...p} />
  ),
  code: ({ children, ...p }: any) => (
    <code className="text-[11px] rounded bg-muted px-1 py-0.5 font-mono text-foreground/90" {...p}>
      {children}
    </code>
  ),
  pre: ({ children, ...p }: any) => (
    <pre className="text-[11px] rounded bg-muted p-2 my-2 overflow-x-auto text-foreground/90" {...p}>
      {children}
    </pre>
  ),
  table: ({ children, ...p }: any) => (
    <div className="overflow-x-auto my-2">
      <table className="text-[12px] w-full border-collapse text-foreground/70" {...p}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...p }: any) => (
    <th className="border border-border px-1.5 py-0.5 text-left font-semibold bg-muted/50" {...p}>
      {children}
    </th>
  ),
  td: ({ children, ...p }: any) => (
    <td className="border border-border px-1.5 py-0.5" {...p}>
      {children}
    </td>
  ),
  hr: ({ ...p }: any) => <hr className="my-3 border-border" {...p} />,
};

/** 统一 Markdown 渲染入口：content + 可选 compact 密度。 */
export function AssetMarkdown({ content, compact }: { content: string; compact?: boolean }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={compact ? compactMdComponents : mdComponents}>
      {content}
    </ReactMarkdown>
  );
}
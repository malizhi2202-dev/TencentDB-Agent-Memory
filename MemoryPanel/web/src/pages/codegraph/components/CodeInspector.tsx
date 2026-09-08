/**
 * CodeInspector — 点击节点展示源码（语法高亮）。
 */
import { Button } from 'tea-component';
import { CloseIcon } from 'tea-icons-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { GraphNode } from '../CodeGraphPage';

interface Props {
  node: GraphNode;
  content: string;
  onClose: () => void;
}

function guessLang(filePath: string): string {
  const ext = (filePath || '').split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp',
    c: 'c', cs: 'csharp', rb: 'ruby', php: 'php', swift: 'swift',
    kt: 'kotlin', scala: 'scala', sh: 'bash', yaml: 'yaml', yml: 'yaml',
    json: 'json', xml: 'xml', html: 'html', css: 'css', scss: 'scss',
    md: 'markdown', sql: 'sql', dockerfile: 'dockerfile', toml: 'toml',
  };
  return map[ext || ''] || 'text';
}

export function CodeInspector({ node, content, onClose }: Props) {
  return (
    <div className="_cg-inspector">
      <div className="_cg-inspector-header">
        <div className="_cg-inspector-info">
          <span className="_cg-inspector-badge" style={{ background: node.color }}>
            {node.label}
          </span>
          <span className="_cg-inspector-name">{node.name || node.id}</span>
          {node.filePath && (
            <span className="_cg-inspector-path">{node.filePath}</span>
          )}
        </div>
        <Button type="icon" onClick={onClose}><CloseIcon /></Button>
      </div>
      <div className="_cg-inspector-code">
        <SyntaxHighlighter
          language={guessLang(node.filePath || '')}
          style={oneLight}
          showLineNumbers
          customStyle={{ margin: 0, fontSize: 13, background: '#fafafa', maxHeight: 'none' }}
        >
          {content || '// No content'}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
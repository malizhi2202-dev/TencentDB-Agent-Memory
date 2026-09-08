/**
 * NodeTypeLegend — 节点类型 / 边类型 / 颜色图例（可点击）。
 */
import { type NodeTypeInfo, type EdgeTypeInfo } from '../CodeGraphPage';

interface Props {
  nodeTypes: NodeTypeInfo[];
  edgeTypes: EdgeTypeInfo[];
}

export function NodeTypeLegend({ nodeTypes, edgeTypes }: Props) {
  return (
    <div className="_cg-legend">
      <div className="_cg-legend-section">
        <div className="_cg-legend-title">Node Types ({nodeTypes.length})</div>
        {nodeTypes.map(nt => (
          <div key={nt.type} className="_cg-legend-item">
            <span className="_cg-legend-dot" style={{ background: nt.color }} />
            <span className="_cg-legend-label">{nt.type}</span>
            <span className="_cg-legend-count">{nt.count.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="_cg-legend-divider" />

      <div className="_cg-legend-section">
        <div className="_cg-legend-title">Edge Types ({edgeTypes.length})</div>
        {edgeTypes.map(et => (
          <div key={et.type} className="_cg-legend-item">
            <span className="_cg-legend-line" style={{ background: et.color }} />
            <span className="_cg-legend-label">{et.type}</span>
            <span className="_cg-legend-count">{et.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
/**
 * MemorySpaceDetailPage — 记忆空间详情（骨架）
 *
 * change: agent-collab-ui-redesign / T08
 * 头部（Brain 域 chip + 空间 id）+ 内容区（L0-L3 记忆块 + 质量指标）。
 * 骨架阶段为空态，不接真实数据。
 */
import { useParams } from 'react-router-dom';
import { Card, StatusTip, Tag, Text } from 'tea-component';

export function MemorySpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>();

  return (
    <div className="_memory-detail-page">
      <div className="_memory-detail-head">
        <Text theme="strong" style={{ fontSize: 18 }}>
          记忆空间详情
        </Text>
        <Text theme="label">{spaceId ?? ''}</Text>
        <Tag theme="default">Brain 域：待定</Tag>
        <Tag theme="default">骨架阶段</Tag>
      </div>

      <Card>
        <Card.Body>
          <StatusTip
            status="empty"
            emptyText="L0–L3 记忆块 + 写入策略 + 质量指标（骨架阶段，待后续 change 接数据）"
          />
        </Card.Body>
      </Card>
    </div>
  );
}

export default MemorySpaceDetailPage;
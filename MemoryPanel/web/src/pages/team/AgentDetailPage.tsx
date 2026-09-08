/**
 * AgentDetailPage — Agent 详情（4 Tab 配置面骨架）
 *
 * change: agent-collab-ui-redesign / T07
 * 三段式：Agent 头部 + 4 Tab（基础/执行环境/绑定/API）+ 配置区。
 * 骨架阶段：字段用前端类型占位，不接后端（见 CHANGE 范围排除）。
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, StatusTip, Tabs, TabPanel, Tag, Text } from 'tea-component';

type AgentTab = 'basic' | 'env' | 'bindings' | 'api';

const TABS: { id: AgentTab; label: string }[] = [
  { id: 'basic', label: '基础' },
  { id: 'env', label: '执行环境' },
  { id: 'bindings', label: '绑定' },
  { id: 'api', label: 'API' },
];

const TAB_PLACEHOLDER: Record<AgentTab, string> = {
  basic: '名称 / 描述 / 类型 / 角色 / 角色设定（persona）',
  env: 'network_policy（offline/restricted/open）/ approval_mode / allow_shell',
  bindings: 'Skill / 知识库 / MCP 绑定列表',
  api: 'surface.tool（AI 调用）+ surface.api（外部 HTTP）双通道',
};

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<AgentTab>('basic');

  return (
    <div className="_memory-detail-page">
      <div className="_memory-detail-head">
        <Text theme="strong" style={{ fontSize: 18 }}>
          Agent 详情
        </Text>
        <Text theme="label">{id ?? ''}</Text>
        <Tag theme="default">骨架阶段</Tag>
      </div>

      <Tabs
        activeId={activeTab}
        onActive={(tab) => setActiveTab(tab.id as AgentTab)}
        disableTabScrolling
        tabs={TABS.map((t) => ({ id: t.id, label: t.label }))}
      >
        {TABS.map((t) => (
          <TabPanel id={t.id} key={t.id}>
            <Card>
              <Card.Body>
                <StatusTip
                  status="empty"
                  emptyText={`${t.label}：${TAB_PLACEHOLDER[t.id]}（骨架阶段，待后续 change 接数据）`}
                />
              </Card.Body>
            </Card>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}

export default AgentDetailPage;
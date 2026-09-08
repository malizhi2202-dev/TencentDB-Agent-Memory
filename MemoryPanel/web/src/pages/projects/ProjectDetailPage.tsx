/**
 * ProjectDetailPage — 项目详情。
 *
 * change: agent-collab-ui-redesign / 导航信息架构 + 项目级知识落地
 * 从项目列表页下探进入（URL 携带 :id）。结构：
 *   - 头部（返回列表 + 项目名/id）
 *   - 项目级五类知识（目标/决策/交付物/讨论/规范约定）——真实 CRUD，走 KnowledgeEntry 实体
 *   - 记忆空间（骨架，待接项目级空间）
 *   - 成员 + 资产（真实数据）
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Input, StatusTip, Tabs, TabPanel, Text } from 'tea-component';
import { ArrowLeftIcon, AddIcon, DeleteIcon } from 'tea-icons-react';
import { projectMembersApi } from '@/lib/api/projects';
import { assetsApi } from '@/lib/api/assets';
import { tea } from '@/lib/tea-bridge';
import { getErrorMessage } from '@/lib/error-message';
import { KnowledgeEntryPanel } from '@/components/KnowledgeEntryPanel';
import type { ProjectMember, Asset } from '@/lib/api/types';

type ProjectTab =
  | 'objective' | 'decision' | 'deliverable' | 'discussion' | 'convention'
  | 'memory' | 'members' | 'assets';

const TABS: { id: ProjectTab; label: string }[] = [
  { id: 'objective', label: '目标' },
  { id: 'decision', label: '决策' },
  { id: 'deliverable', label: '交付物' },
  { id: 'discussion', label: '讨论' },
  { id: 'convention', label: '规范约定' },
  { id: 'memory', label: '记忆空间' },
  { id: 'members', label: '成员' },
  { id: 'assets', label: '资产' },
];

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProjectTab>('objective');

  // 成员管理
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [newUserId, setNewUserId] = useState('');

  // 资产聚合
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!id) return;
    setMembersLoading(true);
    try {
      setMembers(await projectMembersApi.list(id));
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    } finally {
      setMembersLoading(false);
    }
  }, [id]);

  const loadAssets = useCallback(async () => {
    if (!id) return;
    setAssetsLoading(true);
    try {
      setAssets(await assetsApi.listByProject(id));
    } catch (e) {
      setAssets([]);
      tea.notify.error(getErrorMessage(e));
    } finally {
      setAssetsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadMembers();
    void loadAssets();
  }, [loadMembers, loadAssets]);

  const handleAddMember = async () => {
    if (!id || !newUserId.trim()) return;
    try {
      await projectMembersApi.add(id, { user_id: newUserId.trim() });
      tea.notify.success('成员已添加');
      setNewUserId('');
      await loadMembers();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!id) return;
    const ok = await tea.confirm({ message: `确定移除成员 ${userId}？` });
    if (!ok) return;
    try {
      await projectMembersApi.remove(id, userId);
      tea.notify.success('成员已移除');
      await loadMembers();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  if (!id) return null;

  const scope = 'project' as const;

  return (
    <div className="_memory-detail-page">
      <div className="_memory-detail-head">
        <Button type="weak" onClick={() => navigate('/projects')} title="返回项目列表">
          <ArrowLeftIcon size={14} /> 返回项目列表
        </Button>
        <Text theme="strong" style={{ fontSize: 18 }}>
          项目详情
        </Text>
        <Text theme="label">{id}</Text>
      </div>

      <Tabs
        activeId={activeTab}
        onActive={(tab) => setActiveTab(tab.id as ProjectTab)}
        disableTabScrolling
        tabs={TABS.map((t) => ({ id: t.id, label: t.label }))}
      >
        <TabPanel id="objective">
          <KnowledgeEntryPanel
            scope={scope}
            scopeId={id}
            kind="objective"
            title="目标 Objectives"
            statusOptions={[{ value: 'open', text: '未开始' }, { value: 'doing', text: '进行中' }, { value: 'done', text: '已完成' }]}
          />
        </TabPanel>
        <TabPanel id="decision">
          <KnowledgeEntryPanel scope={scope} scopeId={id} kind="decision" title="决策 Decisions" />
        </TabPanel>
        <TabPanel id="deliverable">
          <KnowledgeEntryPanel
            scope={scope}
            scopeId={id}
            kind="deliverable"
            title="交付物 Deliverables"
            statusOptions={[{ value: 'draft', text: '草稿' }, { value: 'review', text: '评审中' }, { value: 'final', text: '已交付' }]}
          />
        </TabPanel>
        <TabPanel id="discussion">
          <KnowledgeEntryPanel scope={scope} scopeId={id} kind="discussion" title="讨论 Discussions" />
        </TabPanel>
        <TabPanel id="convention">
          <KnowledgeEntryPanel scope={scope} scopeId={id} kind="convention" title="规范约定 Conventions" />
        </TabPanel>

        <TabPanel id="memory">
          <Card>
            <Card.Body>
              <StatusTip status="empty" emptyText="记忆空间（骨架阶段，待接项目级空间）" />
            </Card.Body>
          </Card>
        </TabPanel>

        <TabPanel id="members">
          <Card>
            <Card.Body title="成员">
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <Input value={newUserId} onChange={setNewUserId} placeholder="输入 user_id 加入 project" style={{ width: 280 }} />
                <Button type="primary" onClick={handleAddMember} disabled={!newUserId.trim()}>
                  <AddIcon size={14} /> 添加成员
                </Button>
              </div>
              {membersLoading ? (
                <StatusTip status="loading" />
              ) : members.length === 0 ? (
                <StatusTip status="empty" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {members.map((m) => (
                    <div key={m.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span>{m.username ?? m.user_id}</span>
                      <Button type="weak" onClick={() => void handleRemoveMember(m.user_id)}>
                        <DeleteIcon size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </TabPanel>

        <TabPanel id="assets">
          <Card>
            <Card.Body title="项目资产（跨 Team 协作拼图）">
              {assetsLoading ? (
                <StatusTip status="loading" />
              ) : assets.length === 0 ? (
                <StatusTip status="empty" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {assets.map((a) => (
                    <div key={a.asset_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span>
                        <strong>{a.name}</strong>
                        <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>{a.asset_type}</span>
                      </span>
                      <span style={{ color: '#999', fontSize: 12 }}>{a.owner_user_id}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  );
}

export default ProjectDetailPage;

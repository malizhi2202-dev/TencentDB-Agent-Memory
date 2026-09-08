/**
 * TaskCreateDialog — 「新建 Task」弹窗。
 *
 * 必填字段（前端校验）：
 *   - title         任务标题
 *   - description   任务描述
 *
 * 关于 team 归属：
 *   不再让用户在 dialog 里选 team。team 由右上角全局 TeamSwitcher 决定，
 *   这里只 readonly 展示「将创建到 team：name (team_id)」，避免出现「右上角是 A
 *   但弹窗里默认选了 B、用户没注意一切就走偏」的两套上下文不一致问题。
 *
 * 关于 linked_agents / source：
 *   创建时不填，统一留空（source_type 默认 'manual'）。关联 Agent 在创建后
 *   通过 TaskDetail 追加（见 descriptionExtra 文案）。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Input, Modal, Text } from 'tea-component';
import type { TaskSourceType } from '@/services';

/** 新建 Task 的草稿（由调用方落库）。 */
export interface TaskDraft {
  team_id: string;
  title: string;
  description: string;
  source_type: TaskSourceType;
  source_url: string;
  linked_agents: string[];
}

interface TaskCreateDialogProps {
  team: { team_id: string; name: string };
  onClose: () => void;
  onCreate: (draft: TaskDraft) => Promise<void> | void;
}

export default function TaskCreateDialog({ team, onClose, onCreate }: TaskCreateDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError(t('task.titleRequired'));
      return;
    }
    setTitleError(null);
    setCreating(true);
    try {
      await onCreate({
        team_id: team.team_id,
        title: trimmed,
        description: description.trim(),
        source_type: 'manual',
        source_url: '',
        linked_agents: [],
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal
      visible
      caption={t('taskCreate.caption')}
      size="m"
      onClose={onClose}
      disableEscape={creating}
    >
      <Modal.Body>
        <Form>
          <Form.Item label={t('taskCreate.team')}>
            <Text>
              {t('taskCreate.teamLabel')}: {team.name}（{team.team_id}）
            </Text>
          </Form.Item>
          <Form.Item
            label={t('taskCreate.title')}
            status={titleError ? 'error' : undefined}
            message={titleError ?? undefined}
            required
          >
            <Input
              autoFocus
              size="full"
              value={title}
              onChange={(value) => {
                setTitle(value);
                if (titleError) setTitleError(null);
              }}
              placeholder={t('taskCreate.titlePlaceholder')}
              disabled={creating}
            />
          </Form.Item>
          <Form.Item label={t('taskCreate.description')} extra={t('taskCreate.descriptionExtra')}>
            <Input.TextArea
              size="full"
              value={description}
              onChange={(value) => setDescription(value)}
              placeholder={t('taskCreate.descriptionPlaceholder')}
              rows={6}
              disabled={creating}
            />
          </Form.Item>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button type="primary" onClick={() => void handleSubmit()} disabled={creating} loading={creating}>
          {t('taskCreate.submit')}
        </Button>
        <Button onClick={onClose} disabled={creating}>
          {t('taskCreate.cancel')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
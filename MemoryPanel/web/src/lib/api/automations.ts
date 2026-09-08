/**
 * api/automations.ts — Automation（自动化编排）。
 * 走 meta/automation/* 透明代理。
 */
import { metaPost, metaListAll, getCurrentUser } from './base';
import type { Automation } from './types';

export interface CreateAutomationInput {
  teamId: string;
  name: string;
  description?: string;
  triggerType: 'cron' | 'webhook' | 'manual' | 'event';
  triggerConfigJson?: string;
  actionType: 'run_agent' | 'run_task' | 'notify';
  actionConfigJson?: string;
  targetId?: string;
  status?: string;
  source: 'memory' | 'external' | 'hybrid';
}

export const automationsApi = {
  list: (teamId: string) => metaListAll<Automation>('automation/list', { team_id: teamId }),

  get: (automationId: string) => metaPost<Automation>('automation/get', { automation_id: automationId }),

  create: async (data: CreateAutomationInput) => {
    const me = await getCurrentUser();
    return metaPost<Automation>('automation/create', {
      team_id: data.teamId,
      name: data.name,
      description: data.description,
      trigger_type: data.triggerType,
      trigger_config_json: data.triggerConfigJson,
      action_type: data.actionType,
      action_config_json: data.actionConfigJson,
      target_id: data.targetId,
      status: data.status,
      source: data.source,
      owner_user_id: me.user_id,
    });
  },

  delete: (automationIds: string[]) =>
    metaPost<{ deleted: number; missing: string[] }>('automation/delete', { automation_ids: automationIds }),
};
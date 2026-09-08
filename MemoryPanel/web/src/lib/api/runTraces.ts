/**
 * api/runTraces.ts — RunTrace（会话回放）。
 * 走 meta/run-trace/* 透明代理。
 */
import { metaPost, metaListAll, getCurrentUser } from './base';
import type { RunTrace } from './types';

export const runTracesApi = {
  list: (teamId: string, params?: { agent_id?: string; kind?: 'run' | 'trace'; status?: string }) =>
    metaListAll<RunTrace>('run-trace/list', {
      team_id: teamId,
      agent_id: params?.agent_id,
      kind: params?.kind,
      status: params?.status,
    }),

  get: (runId: string) => metaPost<RunTrace>('run-trace/get', { run_id: runId }),

  create: async (data: {
    teamId: string;
    title: string;
    kind: 'run' | 'trace';
    agentId?: string;
    taskId?: string;
    status?: string;
    inputSummary?: string;
    outputSummary?: string;
    traceJson?: string;
    source: 'memory' | 'external' | 'hybrid';
  }) => {
    const me = await getCurrentUser();
    return metaPost<RunTrace>('run-trace/create', {
      team_id: data.teamId,
      title: data.title,
      kind: data.kind,
      agent_id: data.agentId,
      task_id: data.taskId,
      status: data.status,
      input_summary: data.inputSummary,
      output_summary: data.outputSummary,
      trace_json: data.traceJson,
      source: data.source,
      owner_user_id: me.user_id,
    });
  },

  delete: (runIds: string[]) =>
    metaPost<{ deleted: number; missing: string[] }>('run-trace/delete', { run_ids: runIds }),
};

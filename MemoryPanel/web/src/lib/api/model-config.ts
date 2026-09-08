/**
 * api/model-config.ts — 公共默认模型配置（config/global/*）。
 *
 * 对应内核 /v3/meta/config/global/get | set 的 module=llm_default：
 *   - model / provider / protocol 三个参数，scope 均为 global。
 *   - 空 model 表示「不强制、沿用客户端请求模型」。
 */

import { metaPost } from './base';
import type { AgentLlmConfig } from '@/services';
import { EMPTY_AGENT_LLM } from '@/services';

const MODULE = 'llm_default';

interface GlobalConfigItem {
  module: string;
  param_name: string;
  param_key: string;
  description: string;
  effective_value: string;
}

interface GlobalConfigView {
  module: string;
  module_description: string;
  items: GlobalConfigItem[];
}

export const modelConfigApi = {
  /** 读取公共默认模型配置（空 model 表示未配置）。 */
  async get(): Promise<AgentLlmConfig> {
    const view = await metaPost<GlobalConfigView>('config/global/get', { module: MODULE });
    const byName = new Map(view.items.map((it) => [it.param_name, it.effective_value]));
    return {
      model: byName.get('model') ?? '',
      provider: byName.get('provider') ?? '',
      protocol: (byName.get('protocol') as AgentLlmConfig['protocol']) || EMPTY_AGENT_LLM.protocol,
    };
  },

  /** 写入公共默认模型配置。 */
  async set(config: AgentLlmConfig): Promise<void> {
    await metaPost<{ ok: boolean }>('config/global/set', {
      module: MODULE,
      params: {
        model: config.model,
        provider: config.provider,
        protocol: config.protocol,
      },
    });
  },
};

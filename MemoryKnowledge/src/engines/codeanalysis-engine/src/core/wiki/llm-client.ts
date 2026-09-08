import { logger } from '../logger.js';
import { CircuitOpenError, ResilientFetchExhaustedError, resilientFetch } from 'gitnexus-shared';
/**
 * LLM Client for Wiki Generation
 *
 * OpenAI-compatible API client using native fetch.
 * Supports MiniMax and other OpenAI-compatible endpoints.
 *
 * Config priority: CLI flags > env vars > defaults
 */

export type LLMProvider =
  | 'openai'
  | 'openrouter'
  | 'azure'
  | 'custom'
  | 'cursor'
  | 'claude'
  | 'codex'
  | 'opencode'
  | 'minimax';

export const MINIMAX_OPENAI_BASE_URLS = {
  global_en: 'https://api.minimax.io/v1',
  cn_zh: 'https://api.minimaxi.com/v1',
} as const;

export const MINIMAX_MODEL_IDS = ['MiniMax-M3', 'MiniMax-M2.7'] as const;

export type MiniMaxThinkingMode = 'adaptive' | 'disabled' | 'always_on';

export type LLMUserContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | {
          type: 'image_url';
          image_url: {
            url: string;
            detail?: 'low' | 'default' | 'high';
            max_long_side_pixel?: number;
          };
        }
      | {
          type: 'video_url';
          video_url: {
            url: string;
            detail?: 'low' | 'default' | 'high';
            fps?: number;
            max_long_side_pixel?: number;
          };
        }
    >;

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  /** Provider type — controls auth header behaviour */
  provider?: LLMProvider;
  /** Azure api-version query param (e.g. '2024-10-21'). Appended to URL when set. */
  apiVersion?: string;
  /** When true, strips sampling params and uses max_completion_tokens instead of max_tokens */
  isReasoningModel?: boolean;
  /** Per-attempt fetch timeout in ms. Omit to disable request timeouts. */
  requestTimeoutMs?: number;
  /** Max fetch attempts before giving up (default: 3). */
  maxAttempts?: number;
  /** Exact hostnames allowed for explicit http:// LLM endpoints. */
  allowedInsecureHttpHosts?: readonly string[];
}

export interface LLMResponse {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
}


(Showing lines 1-80 of 525. Use offset=81 to continue.)
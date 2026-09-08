/**
 * dsh-rate-limit-retry — A simple retry handler that intercepts DeepSeek API
 * rate-limit errors ("访问过于频繁:api-key请求token数超出分钟限制") and waits
 * several minutes before retrying, instead of the default sub-second delay.
 *
 * This plugin participates in the `agent/request-error` waterfall. When it
 * detects a rate-limit failure, it waits for a configurable duration (default
 * 3 minutes) and returns `{ kind: 'retry' }`. All other failures are delegated
 * to the next listener (the built-in llm-retry policy).
 *
 * @module dsh-rate-limit-retry
 */

// ---------------------------------------------------------------------------
// Plugin identity (Cordis namespace-plugin contract)
// ---------------------------------------------------------------------------

export const name = 'rate-limit-retry'

/**
 * This plugin depends on the `agents` service to receive scoped
 * `agent/request-error` events.
 */
export const inject = ['agents']

/**
 * config schema.  The loader requires every plugin to export a `Config`
 * value; this plugin accepts no user-facing knobs — everything is hardcoded
 * below.  A `parse` method that passes through the config satisfies the
 * loader's contract.
 */
export const Config = {
  /** @param {unknown} [value] */
  parse(value) {
    return value ?? {}
  },
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long to wait before retrying a rate-limited request. */
const RETRY_DELAY_MS = 3 * 60 * 1000 // 3 minutes

/** Maximum consecutive rate-limit retries before delegating to downstream. */
const MAX_RETRIES = 10

/** Error message substrings that trigger the long wait. */
const RATE_LIMIT_PATTERNS = [
  // DeepSeek Chinese rate-limit message
  '访问过于频繁',
  'api-key请求token数超出分钟限制',
  // DeepSeek English rate-limit message
  'token count exceeds',
  'per minute limit',
  // Generic rate-limit indicators
  'rate limit',
  'too many requests',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether the failure message matches any rate-limit pattern.
 * @param {string} message - The error message from the API.
 * @param {string[]} patterns - Patterns to match against.
 * @returns {boolean}
 */
function isRateLimit(message, patterns) {
  const lower = message.toLowerCase()
  return patterns.some((pattern) => lower.includes(pattern.toLowerCase()))
}

/**
 * Create a cancellable delay promise.
 * @param {number} delayMs - Milliseconds to wait.
 * @param {AbortSignal} signal - Abort signal to cancel the wait.
 * @returns {Promise<boolean>} `true` if the delay completed, `false` if aborted.
 */
function cancellableDelay(delayMs, signal) {
  if (signal.aborted) return Promise.resolve(false)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve(true)
    }, delayMs)
    function onAbort() {
      clearTimeout(timer)
      resolve(false)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

// ---------------------------------------------------------------------------
// Plugin implementation
// ---------------------------------------------------------------------------

/**
 * Install the rate-limit retry handler.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - The Cordis plugin context.
 */
export function apply(ctx) {
  // Track retries per (turn, step) so we don't loop forever.
  // Key: `${turn}:${step}`, value: number of retries so far.
  const retryCounts = new Map()

  const lifetime = new AbortController()

  /**
   * Handle a failed request.
   *
   * @param {Object} payload
   * @param {import('@deepseek-ai/dsh-agent').Agent} payload.agent
   * @param {number} payload.turn
   * @param {number} payload.step
   * @param {string} payload.provider
   * @param {import('@deepseek-ai/dsh-llm').LlmFailure} payload.failure
   * @param {import('@deepseek-ai/dsh-llm').ResolvedRetryPolicy|undefined} payload.retryPolicy
   * @param {AbortSignal} payload.signal
   * @param {() => Promise<import('@deepseek-ai/dsh-agent').RequestErrorAction>} next
   * @returns {Promise<import('@deepseek-ai/dsh-agent').RequestErrorAction>}
   */
  async function onRequestError(payload, next) {
    const { turn, step, failure, signal } = payload

    // Only intercept rate-limit errors.
    if (!isRateLimit(failure.message, RATE_LIMIT_PATTERNS)) {
      return next()
    }

    const key = `${turn}:${step}`
    const count = (retryCounts.get(key) ?? 0) + 1
    retryCounts.set(key, count)

    if (count > MAX_RETRIES) {
      ctx.logger.warn(
        `rate-limit-retry: exceeded max retries (${MAX_RETRIES}) for turn ${turn} step ${step}, delegating to downstream`,
      )
      return next()
    }

    const fusedSignal = AbortSignal.any([signal, lifetime.signal])
    if (fusedSignal.aborted) return undefined

    ctx.logger.info(
      `rate-limit-retry: rate limit detected (attempt ${count}/${MAX_RETRIES}), ` +
        `waiting ${(RETRY_DELAY_MS / 1000).toFixed(0)}s before retry...`,
    )

    const completed = await cancellableDelay(RETRY_DELAY_MS, fusedSignal)
    if (!completed) return undefined

    // Clean up the counter after a successful wait.
    retryCounts.delete(key)

    return { kind: 'retry' }
  }

  const disposeListener = ctx.on('agent/request-error', (payload, next) => {
    if (lifetime.signal.aborted) {
      return Promise.resolve(undefined)
    }
    return onRequestError(payload, next)
  })

  ctx.effect(() => async () => {
    disposeListener()
    lifetime.abort(new Error('rate-limit-retry plugin disposed'))
  }, 'rate-limit-retry: abort and drain')
}
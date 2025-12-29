import { createOpenRouterClient } from '@sokoban-eval-toolkit/utils'
import type { Action, GameState, PromptOptions, SessionMetrics } from '@src/types'
import { generateDungeonPrompt, generateMoveByMovePrompt } from '@src/utils/promptGeneration'
import { parseAIResponse } from '@src/utils/responseParser'

function getApiKey(): string | undefined {
  return import.meta.env.VITE_OPENROUTER_API_KEY
}

export function hasOpenRouterApiKey(): boolean {
  const key = getApiKey()
  return !!key && key.length > 0
}

export interface LLMResponse {
  moves: Action[]
  rawResponse: string
  /** Native reasoning from the model (e.g., DeepSeek R1 thinking output) */
  nativeReasoning?: string
  /** Reasoning parsed from the response content (e.g., from JSON "reasoning" field) */
  parsedReasoning?: string
  inputTokens: number
  outputTokens: number
  /** Reasoning tokens if reported separately (e.g., OpenAI o1/o3) - already included in outputTokens */
  reasoningTokens: number
  cost: number
  durationMs: number
  error?: string
}

/**
 * Get a solution from the LLM for a dungeon puzzle.
 */
export async function getDungeonSolution(
  state: GameState,
  model: string,
  options: PromptOptions,
): Promise<LLMResponse> {
  const startTime = Date.now()

  try {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('API key not configured')
    }
    const client = createOpenRouterClient(apiKey)

    const prompt = generateDungeonPrompt(state, options)

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user' as const, content: prompt }],
      temperature: 0.3,
    })

    const durationMs = Date.now() - startTime
    const message = response.choices[0]?.message
    const content = message?.content ?? ''
    const usage = response.usage

    // Extract native reasoning from OpenRouter response (some models like DeepSeek provide this)
    // biome-ignore lint/suspicious/noExplicitAny: OpenRouter-specific field not in OpenAI types
    const nativeReasoning = (message as any)?.reasoning as string | undefined

    const parsed = parseAIResponse(content)

    // Log full response data for debugging
    console.log('[LLM Response]', {
      model,
      message,
      usage,
      durationMs: Date.now() - startTime,
    })

    const inputTokens = usage?.prompt_tokens ?? 0
    const outputTokens = usage?.completion_tokens ?? 0
    // Extract reasoning tokens from completion_tokens_details (OpenRouter/OpenAI format)
    // biome-ignore lint/suspicious/noExplicitAny: Provider-specific field
    const reasoningTokens = (usage as any)?.completion_tokens_details?.reasoning_tokens ?? 0
    // Use actual cost from OpenRouter if available, otherwise estimate
    // biome-ignore lint/suspicious/noExplicitAny: Provider-specific field
    const actualCost = (usage as any)?.cost as number | undefined
    const cost = actualCost ?? estimateCost(model, inputTokens, outputTokens)

    return {
      moves: parsed.moves,
      rawResponse: content,
      nativeReasoning: nativeReasoning || undefined,
      parsedReasoning: parsed.reasoning,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cost,
      durationMs,
      error: parsed.error,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error('[LLM Error]', error)
    return {
      moves: [],
      rawResponse: '',
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cost: 0,
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get the next move from the LLM (move-by-move mode).
 */
export async function getNextMove(
  state: GameState,
  model: string,
  moveHistory: string[],
): Promise<LLMResponse> {
  const startTime = Date.now()

  try {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('API key not configured')
    }
    const client = createOpenRouterClient(apiKey)

    const prompt = generateMoveByMovePrompt(state, moveHistory)

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 50, // We only need one move
    })

    const durationMs = Date.now() - startTime
    const message = response.choices[0]?.message
    const content = message?.content ?? ''
    const usage = response.usage

    // Extract native reasoning from OpenRouter response (some models like DeepSeek provide this)
    // biome-ignore lint/suspicious/noExplicitAny: OpenRouter-specific field not in OpenAI types
    const nativeReasoning = (message as any)?.reasoning as string | undefined

    const parsed = parseAIResponse(content)

    // Log full response data for debugging
    console.log('[LLM Response - Move]', {
      model,
      message,
      usage,
      durationMs,
    })

    const inputTokens = usage?.prompt_tokens ?? 0
    const outputTokens = usage?.completion_tokens ?? 0
    // biome-ignore lint/suspicious/noExplicitAny: Provider-specific field
    const reasoningTokens = (usage as any)?.completion_tokens_details?.reasoning_tokens ?? 0
    // biome-ignore lint/suspicious/noExplicitAny: Provider-specific field
    const actualCost = (usage as any)?.cost as number | undefined
    const cost = actualCost ?? estimateCost(model, inputTokens, outputTokens)

    return {
      moves: parsed.moves.slice(0, 1), // Only take first move
      rawResponse: content,
      nativeReasoning: nativeReasoning || undefined,
      parsedReasoning: parsed.reasoning,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cost,
      durationMs,
      error: parsed.error,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error('[LLM Error - Move]', error)
    return {
      moves: [],
      rawResponse: '',
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cost: 0,
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Rough cost estimation based on model.
 * Actual costs may vary - this is for display purposes.
 */
function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Very rough estimates per 1K tokens
  const rates: Record<string, { input: number; output: number }> = {
    'openai/gpt-4o': { input: 0.005, output: 0.015 },
    'openai/gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'anthropic/claude-3.5-sonnet': { input: 0.003, output: 0.015 },
    'anthropic/claude-haiku-4.5': { input: 0.0008, output: 0.004 },
    'google/gemini-2.5-pro': { input: 0.00125, output: 0.005 },
  }

  const rate = rates[model] ?? { input: 0.001, output: 0.003 }
  return (inputTokens * rate.input + outputTokens * rate.output) / 1000
}

/** Approximate words per token (average for English text) */
const WORDS_PER_TOKEN = 0.75

/**
 * Create initial session metrics.
 */
export function createSessionMetrics(): SessionMetrics {
  return {
    totalCost: 0,
    totalTokens: 0,
    totalDurationMs: 0,
    requestCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalReasoningTokens: 0,
    estimatedWords: 0,
  }
}

/**
 * Update session metrics with a new response.
 */
export function updateSessionMetrics(
  metrics: SessionMetrics,
  response: LLMResponse,
): SessionMetrics {
  // Estimate words from output tokens (includes reasoning tokens)
  const estimatedWords = Math.round(response.outputTokens * WORDS_PER_TOKEN)

  return {
    totalCost: metrics.totalCost + response.cost,
    totalTokens: metrics.totalTokens + response.inputTokens + response.outputTokens,
    totalDurationMs: metrics.totalDurationMs + response.durationMs,
    requestCount: metrics.requestCount + 1,
    totalInputTokens: metrics.totalInputTokens + response.inputTokens,
    totalOutputTokens: metrics.totalOutputTokens + response.outputTokens,
    totalReasoningTokens: metrics.totalReasoningTokens + response.reasoningTokens,
    estimatedWords: metrics.estimatedWords + estimatedWords,
  }
}

// Legacy export for compatibility
export const getSokobanSolution = getDungeonSolution

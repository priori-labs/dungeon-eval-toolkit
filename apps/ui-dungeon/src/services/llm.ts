import { createOpenRouterClient } from '@sokoban-eval-toolkit/utils'
import type {
  Action,
  DungeonLevel,
  ExplorationCommand,
  GameState,
  PromptOptions,
  SessionMetrics,
  TileType,
} from '@src/types'
import { generateDungeonPrompt } from '@src/utils/promptGeneration'
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
  /** Exploration command if AI is exploring rather than providing final solution */
  explorationCommand?: ExplorationCommand
  /** Whether SUBMIT was included in the response (finalizes solution) */
  hasSubmit?: boolean
}

/**
 * Get a solution from the LLM for a dungeon puzzle.
 * @param seedReasoning Optional "fake history" reasoning to seed the model with
 */
export async function getDungeonSolution(
  state: GameState,
  model: string,
  options: PromptOptions,
  seedReasoning?: string,
): Promise<LLMResponse> {
  const startTime = Date.now()

  try {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('API key not configured')
    }
    const client = createOpenRouterClient(apiKey)

    const prompt = generateDungeonPrompt(state, options)

    // Build messages - use "Fake History" format if seed reasoning provided
    const messages = seedReasoning?.trim()
      ? [
          { role: 'user' as const, content: prompt },
          { role: 'assistant' as const, content: seedReasoning.trim() },
          {
            role: 'user' as const,
            content:
              'The above reasoning has been verified as correct. Based on that high level analysis, translate the strategy to a specific move sequence to complete the puzzle.',
          },
        ]
      : [{ role: 'user' as const, content: prompt }]

    const response = await client.chat.completions.create({
      model,
      messages,
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
    // biome-ignore lint/suspicious/noExplicitAny: Provider-specific field
    const cost = ((usage as any)?.cost as number) ?? 0

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
      explorationCommand: parsed.explorationCommand,
      hasSubmit: parsed.hasSubmit,
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
 * Continue exploration with a follow-up prompt
 */
export async function continueExploration(
  initialPrompt: string,
  previousResponse: string,
  continuationPrompt: string,
  model: string,
): Promise<LLMResponse> {
  const startTime = Date.now()

  try {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('API key not configured')
    }
    const client = createOpenRouterClient(apiKey)

    // Build conversation history
    const messages = [
      { role: 'user' as const, content: initialPrompt },
      { role: 'assistant' as const, content: previousResponse },
      { role: 'user' as const, content: continuationPrompt },
    ]

    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.3,
    })

    const durationMs = Date.now() - startTime
    const message = response.choices[0]?.message
    const content = message?.content ?? ''
    const usage = response.usage

    // biome-ignore lint/suspicious/noExplicitAny: OpenRouter-specific field
    const nativeReasoning = (message as any)?.reasoning as string | undefined

    const parsed = parseAIResponse(content)

    console.log('[LLM Response - Exploration Continue]', {
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
    const cost = ((usage as any)?.cost as number) ?? 0

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
      explorationCommand: parsed.explorationCommand,
      hasSubmit: parsed.hasSubmit,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error('[LLM Error - Exploration]', error)
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

/**
 * Prompt for generating a dungeon level via AI
 */
const DUNGEON_GENERATION_PROMPT = `You are a puzzle game designer creating challenging dungeon puzzles. Generate a dungeon puzzle level that is interesting, challenging, and GUARANTEED TO BE SOLVABLE.

CRITICAL: The puzzle you create MUST be solvable. Before finalizing your design, mentally trace through the solution to verify the player can reach the goal. Do not create impossible puzzles.

## Game Rules

The player starts at a designated position and must reach the GOAL tile to win.

### Tile Types
- EMPTY: Walkable floor tile
- WALL: Impassable barrier (borders must always be walls)
- GOAL: The target destination (exactly 1 required)
- KEY_RED, KEY_BLUE, KEY_GREEN, KEY_YELLOW: Collectible keys
- DOOR_RED, DOOR_BLUE, DOOR_GREEN, DOOR_YELLOW: Doors that require matching colored key to open
- BLOCK: Pushable box (can be pushed into empty spaces or onto traps to neutralize them)
- TRAP: Instant death if stepped on (can be neutralized by pushing a block onto it)
- PORTAL_A, PORTAL_B: Teleportation pair (stepping on one teleports to the other)

### Movement Rules
- Player moves in 4 directions: UP, DOWN, LEFT, RIGHT
- Player can push BLOCKs (one at a time, only if space behind block is empty or trap)
- Pushing a BLOCK onto a TRAP neutralizes the trap (block disappears, trap becomes safe)
- Keys are automatically collected when walked over
- Doors automatically open when player has matching key and walks into them
- Portals teleport player to the paired portal

## Design Guidelines for Challenging Puzzles

1. **Require strategic thinking**: Don't make the solution obvious
2. **Use key-door mechanics**: Require collecting keys in specific order
3. **Include block puzzles**: Blocks should be necessary to reach goal or neutralize traps
4. **Add meaningful traps**: Place traps that require thought to avoid or neutralize
5. **Consider dead-ends**: Create situations where wrong moves can make puzzle unsolvable
6. **Portals (optional)**: If using portals, make them integral to the solution

## Constraints

- Grid size: Use the exact dimensions specified
- Borders: All edge tiles MUST be WALL
- Player start: Must be on an EMPTY tile (not on border)
- Goal: Exactly 1 GOAL tile required
- Portals: Either 0 portals, or exactly 1 pair (PORTAL_A and PORTAL_B together)
- Keys/Doors: Each door color needs a matching key of same color somewhere reachable
- The puzzle MUST be solvable

## Output Format

Return a JSON object with this exact structure:
{
  "name": "Descriptive puzzle name",
  "description": "Brief description of the puzzle's challenge",
  "objective": "What the player needs to do",
  "playerStart": { "x": <column>, "y": <row> },
  "layout": [
    ["WALL", "WALL", "WALL", ...],
    ["WALL", "EMPTY", "EMPTY", ...],
    ...
  ]
}

IMPORTANT:
- layout[0] is the TOP row (y=0)
- layout[y][x] gives the tile at position (x, y)
- x increases left-to-right (columns)
- y increases top-to-bottom (rows)
- All border tiles (x=0, x=width-1, y=0, y=height-1) must be WALL
- THE PUZZLE MUST BE SOLVABLE - verify there is a valid path from player start to goal

Generate a puzzle for a grid of size WIDTH x HEIGHT.`

export interface GenerateLevelResponse {
  level: DungeonLevel | null
  rawResponse: string
  error?: string
  inputTokens: number
  outputTokens: number
  cost: number
  durationMs: number
}

/**
 * Generate a dungeon level using AI
 */
export async function generateDungeonLevel(
  width: number,
  height: number,
  model: string,
): Promise<GenerateLevelResponse> {
  const startTime = Date.now()

  try {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('API key not configured')
    }
    const client = createOpenRouterClient(apiKey)

    const prompt = DUNGEON_GENERATION_PROMPT.replace('WIDTH', String(width)).replace(
      'HEIGHT',
      String(height),
    )

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8, // Higher temperature for creativity
    })

    const durationMs = Date.now() - startTime
    const content = response.choices[0]?.message?.content ?? ''
    const usage = response.usage

    console.log('[LLM Level Generation Response]', {
      model,
      content,
      usage,
      durationMs,
    })

    const inputTokens = usage?.prompt_tokens ?? 0
    const outputTokens = usage?.completion_tokens ?? 0
    // biome-ignore lint/suspicious/noExplicitAny: Provider-specific field
    const cost = ((usage as any)?.cost as number) ?? 0

    // Parse the response
    const level = parseGeneratedLevel(content, width, height)

    return {
      level,
      rawResponse: content,
      error: level ? undefined : 'Failed to parse generated level',
      inputTokens,
      outputTokens,
      cost,
      durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error('[LLM Level Generation Error]', error)
    return {
      level: null,
      rawResponse: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      durationMs,
    }
  }
}

/**
 * Parse AI-generated level response into a DungeonLevel
 */
function parseGeneratedLevel(content: string, width: number, height: number): DungeonLevel | null {
  try {
    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    } else {
      // Try to find JSON object directly
      const objectMatch = content.match(/\{[\s\S]*\}/)
      if (objectMatch) {
        jsonStr = objectMatch[0]
      }
    }

    const data = JSON.parse(jsonStr)

    // Validate required fields
    if (!data.layout || !Array.isArray(data.layout)) {
      console.error('Missing or invalid layout')
      return null
    }

    if (
      !data.playerStart ||
      typeof data.playerStart.x !== 'number' ||
      typeof data.playerStart.y !== 'number'
    ) {
      console.error('Missing or invalid playerStart')
      return null
    }

    // Validate and normalize layout
    const layout: TileType[][] = []
    const validTileTypes = new Set([
      'EMPTY',
      'WALL',
      'GOAL',
      'KEY_RED',
      'KEY_BLUE',
      'KEY_GREEN',
      'KEY_YELLOW',
      'DOOR_RED',
      'DOOR_BLUE',
      'DOOR_GREEN',
      'DOOR_YELLOW',
      'BLOCK',
      'TRAP',
      'PORTAL_A',
      'PORTAL_B',
    ])

    for (let y = 0; y < data.layout.length; y++) {
      const row: TileType[] = []
      for (let x = 0; x < data.layout[y].length; x++) {
        let tile = data.layout[y][x] as string
        // Normalize tile type
        tile = tile.toUpperCase().trim()
        if (!validTileTypes.has(tile)) {
          tile = 'EMPTY'
        }
        row.push(tile as TileType)
      }
      layout.push(row)
    }

    // Ensure borders are walls
    for (let y = 0; y < layout.length; y++) {
      for (let x = 0; x < layout[y].length; x++) {
        if (x === 0 || x === layout[y].length - 1 || y === 0 || y === layout.length - 1) {
          layout[y][x] = 'WALL' as TileType
        }
      }
    }

    // Validate there's exactly one goal
    let goalCount = 0
    for (const row of layout) {
      for (const tile of row) {
        if (tile === 'GOAL') goalCount++
      }
    }
    if (goalCount === 0) {
      console.error('No GOAL tile found')
      return null
    }

    // Validate portal pairs (0 or exactly 2)
    let portalACount = 0
    let portalBCount = 0
    for (const row of layout) {
      for (const tile of row) {
        if (tile === 'PORTAL_A') portalACount++
        if (tile === 'PORTAL_B') portalBCount++
      }
    }
    if ((portalACount > 0 || portalBCount > 0) && (portalACount !== 1 || portalBCount !== 1)) {
      console.warn('Invalid portal configuration, removing portals')
      for (let y = 0; y < layout.length; y++) {
        for (let x = 0; x < layout[y].length; x++) {
          if (layout[y][x] === 'PORTAL_A' || layout[y][x] === 'PORTAL_B') {
            layout[y][x] = 'EMPTY' as TileType
          }
        }
      }
    }

    // Ensure player start is valid
    const playerStart = {
      x: Math.max(1, Math.min(data.playerStart.x, width - 2)),
      y: Math.max(1, Math.min(data.playerStart.y, height - 2)),
    }

    // Make sure player start position is empty
    if (layout[playerStart.y] && layout[playerStart.y][playerStart.x]) {
      layout[playerStart.y][playerStart.x] = 'EMPTY' as TileType
    }

    return {
      id: `ai_${Date.now()}`,
      name: data.name || 'AI Generated Puzzle',
      description: data.description || 'A puzzle generated by AI',
      gridSize: { width: layout[0]?.length ?? width, height: layout.length },
      maxTurns: 200,
      objective: data.objective || 'Reach the goal',
      playerStart,
      layout,
    }
  } catch (error) {
    console.error('Failed to parse generated level:', error)
    return null
  }
}

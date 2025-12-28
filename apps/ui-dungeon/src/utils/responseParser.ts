/**
 * Parse AI responses for dungeon puzzle solutions
 */

import type { Action } from '@src/types'

export interface ParsedAIResponse {
  moves: Action[]
  reasoning?: string
  error?: string
}

const VALID_ACTIONS: Action[] = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'INTERACT']

/**
 * Parse an AI response to extract moves and reasoning
 */
export function parseAIResponse(content: string): ParsedAIResponse {
  // Try to extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      moves: [],
      error: 'No JSON found in response',
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])

    // Extract reasoning if present
    const reasoning = parsed.reasoning || parsed.explanation || undefined

    // Handle single move format: {"move": "UP"}
    if (parsed.move && typeof parsed.move === 'string') {
      const move = parsed.move.toUpperCase() as Action
      if (VALID_ACTIONS.includes(move)) {
        return {
          moves: [move],
          reasoning,
        }
      }
      return {
        moves: [],
        reasoning,
        error: `Invalid move: ${parsed.move}`,
      }
    }

    // Handle multiple moves format: {"moves": ["UP", "DOWN", ...]}
    if (parsed.moves && Array.isArray(parsed.moves)) {
      const validMoves: Action[] = []
      for (const move of parsed.moves) {
        if (typeof move === 'string') {
          const upperMove = move.toUpperCase() as Action
          if (VALID_ACTIONS.includes(upperMove)) {
            validMoves.push(upperMove)
          }
        }
      }

      if (validMoves.length === 0) {
        return {
          moves: [],
          reasoning,
          error: 'No valid moves found in response',
        }
      }

      return {
        moves: validMoves,
        reasoning,
      }
    }

    return {
      moves: [],
      error: 'Response does not contain move or moves field',
    }
  } catch (e) {
    return {
      moves: [],
      error: `Failed to parse JSON: ${e instanceof Error ? e.message : 'Unknown error'}`,
    }
  }
}

/**
 * Convert moves to a simple notation string
 */
export function movesToNotation(moves: Action[]): string {
  return moves
    .map((m) => {
      switch (m) {
        case 'UP':
          return 'u'
        case 'DOWN':
          return 'd'
        case 'LEFT':
          return 'l'
        case 'RIGHT':
          return 'r'
        case 'INTERACT':
          return 'i'
        default:
          return '?'
      }
    })
    .join('')
}

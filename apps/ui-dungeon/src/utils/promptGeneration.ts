/**
 * Prompt generation for AI to solve dungeon puzzles
 */

import type { GameState, PromptOptions, TileType } from '@src/types'

/**
 * Convert game state to ASCII representation
 */
function gameStateToAscii(state: GameState): string {
  const { grid, playerPosition, gridSize } = state
  const lines: string[] = []

  for (let y = 0; y < gridSize.height; y++) {
    let line = ''
    for (let x = 0; x < gridSize.width; x++) {
      if (playerPosition.x === x && playerPosition.y === y) {
        line += '@'
        continue
      }

      const tile = grid[y]?.[x]
      if (!tile) {
        line += '?'
        continue
      }

      line += tileToChar(tile.type)
    }
    lines.push(line)
  }

  return lines.join('\n')
}

/**
 * Convert tile type to ASCII character
 */
function tileToChar(type: TileType): string {
  switch (type) {
    case 'WALL':
      return '#'
    case 'EMPTY':
      return '.'
    case 'GOAL':
      return 'G'
    case 'KEY_RED':
      return 'r'
    case 'KEY_BLUE':
      return 'b'
    case 'KEY_GREEN':
      return 'g'
    case 'KEY_YELLOW':
      return 'y'
    case 'DOOR_RED':
      return 'D'
    case 'DOOR_BLUE':
      return 'E'
    case 'DOOR_GREEN':
      return 'F'
    case 'DOOR_YELLOW':
      return 'H'
    case 'BLOCK':
      return 'O'
    case 'TRAP':
      return 'T'
    case 'PORTAL_A':
      return 'A'
    case 'PORTAL_B':
      return 'Z'
    default:
      return '?'
  }
}

/**
 * Generate coordinate locations format representation
 */
function generateCoordinateLocationsFormat(state: GameState): string {
  const { grid, gridSize, playerPosition } = state
  const parts: string[] = []

  parts.push(`Board Size: ${gridSize.width}x${gridSize.height}`)
  parts.push(`Player Location: (${playerPosition.x},${playerPosition.y})`)

  // Collect positions by type
  const positions: Record<string, string[]> = {
    walls: [],
    goals: [],
    keys: [],
    doors: [],
    blocks: [],
    traps: [],
    portals: [],
  }

  for (let y = 0; y < gridSize.height; y++) {
    for (let x = 0; x < gridSize.width; x++) {
      const tile = grid[y]?.[x]
      if (!tile) continue

      const pos = `(${x},${y})`
      switch (tile.type) {
        case 'WALL':
          positions.walls.push(pos)
          break
        case 'GOAL':
          positions.goals.push(pos)
          break
        case 'KEY_RED':
        case 'KEY_BLUE':
        case 'KEY_GREEN':
        case 'KEY_YELLOW':
          positions.keys.push(`${pos}:${tile.type.replace('KEY_', '').toLowerCase()}`)
          break
        case 'DOOR_RED':
        case 'DOOR_BLUE':
        case 'DOOR_GREEN':
        case 'DOOR_YELLOW':
          positions.doors.push(
            `${pos}:${tile.type.replace('DOOR_', '').toLowerCase()}${tile.isOpen ? '(open)' : '(closed)'}`,
          )
          break
        case 'BLOCK':
          positions.blocks.push(pos)
          break
        case 'TRAP':
          positions.traps.push(pos)
          break
        case 'PORTAL_A':
        case 'PORTAL_B':
          positions.portals.push(`${pos}:${tile.type.replace('PORTAL_', '')}`)
          break
      }
    }
  }

  if (positions.goals.length > 0) parts.push(`Goal Locations: ${positions.goals.join(', ')}`)
  if (positions.keys.length > 0) parts.push(`Key Locations: ${positions.keys.join(', ')}`)
  if (positions.doors.length > 0) parts.push(`Door Locations: ${positions.doors.join(', ')}`)
  if (positions.blocks.length > 0) parts.push(`Block Locations: ${positions.blocks.join(', ')}`)
  if (positions.traps.length > 0) parts.push(`Trap Locations: ${positions.traps.join(', ')}`)
  if (positions.portals.length > 0) parts.push(`Portal Locations: ${positions.portals.join(', ')}`)

  return parts.join('\n')
}

/**
 * Generate a prompt for an AI to solve a dungeon puzzle
 */
export function generateDungeonPrompt(state: GameState, options: PromptOptions): string {
  const parts: string[] = []

  // Header
  parts.push('# Dungeon Puzzle')
  parts.push('')
  parts.push(
    'You are solving a turn-based dungeon puzzle. Navigate the player to the goal while collecting keys, opening doors, and avoiding traps.',
  )
  parts.push('')

  // Rules
  parts.push('## Rules')
  parts.push('- You can move UP, DOWN, LEFT, or RIGHT')
  parts.push('- Use INTERACT to open adjacent doors (requires matching key color)')
  parts.push('- **Keys**: Walk onto a key tile to collect it (tile becomes empty)')
  parts.push(
    '- **Doors**: Block movement when closed. Use INTERACT while adjacent with matching key',
  )
  parts.push('- **Blocks**: Can be pushed into empty spaces or onto traps')
  parts.push('- **Traps**: Deadly to player. Pushing a block onto a trap neutralizes both')
  parts.push('- **Portals**: Walking onto Portal A teleports you to Portal B, and vice versa')
  parts.push(`- **Turn Limit**: You have ${state.maxTurns} turns maximum`)
  parts.push('- Walls (#) are impassable')
  parts.push('')

  // Example sequence
  parts.push('## Example: Collecting a Key and Opening a Door')
  parts.push('')
  parts.push('Initial state: `#@r.D.G#`')
  parts.push('(Wall, Player, red key, empty, red Door closed, empty, Goal, Wall)')
  parts.push('')
  parts.push('Solution sequence:')
  parts.push('1. RIGHT - Player moves onto key, collects it: `#.@.D.G#` (inventory: RED)')
  parts.push('2. RIGHT - Player moves to empty space: `#..@D.G#`')
  parts.push(
    '3. INTERACT - Player opens adjacent door using RED key: `#..@..G#` (door becomes empty)',
  )
  parts.push('4. RIGHT - Player moves where door was: `#...@.G#`')
  parts.push('5. RIGHT - Player moves to empty space: `#....@G#`')
  parts.push('6. RIGHT - Player reaches goal: `#.....@#` (WIN!)')
  parts.push('')

  // Trap example
  parts.push('## Example: Neutralizing a Trap')
  parts.push('')
  parts.push('Initial state: `#.TO@.#`')
  parts.push('(Wall, empty, Trap, Block, Player, empty, Wall)')
  parts.push('')
  parts.push('Solution sequence:')
  parts.push('1. LEFT - Player pushes block onto trap, both disappear: `#..@..#`')
  parts.push('')
  parts.push(
    'The block neutralizes the trap, clearing the path. Without the block, stepping on T would kill the player!',
  )
  parts.push('')

  // Current state representation
  if (options.asciiGrid) {
    parts.push('## Current State (ASCII Grid)')
    parts.push('```')
    parts.push(gameStateToAscii(state))
    parts.push('```')
    parts.push('')
    parts.push('Legend:')
    parts.push('- # = Wall')
    parts.push('- . = Empty floor')
    parts.push('- @ = Player')
    parts.push('- G = Goal (reach this to win)')
    parts.push('- r, b, g, y = Keys (red, blue, green, yellow)')
    parts.push('- D, E, F, H = Doors (red, blue, green, yellow) - become empty when opened')
    parts.push('- O = Pushable block')
    parts.push('- T = Trap (deadly)')
    parts.push('- A, Z = Portals (A teleports to Z)')
    parts.push('')
  }

  // Coordinate locations format
  if (options.coordinateLocations) {
    parts.push('## Positions')
    parts.push(generateCoordinateLocationsFormat(state))
    parts.push('')
  }

  // Current inventory
  parts.push('## Current Status')
  parts.push(`- Turn: ${state.turn}/${state.maxTurns}`)
  parts.push(
    `- Keys in inventory: ${state.inventory.keys.length > 0 ? state.inventory.keys.join(', ') : 'none'}`,
  )
  parts.push(`- Player position: (${state.playerPosition.x},${state.playerPosition.y})`)
  parts.push('')

  // Important note about code
  parts.push(
    'IMPORTANT: Please do not write any code to solve the puzzle. This is a test of your visual/intuitive reasoning and spatial planning skills.',
  )
  parts.push('')

  // Output format
  parts.push('## Your Task')

  if (options.executionMode === 'fullSolution') {
    parts.push('Provide a complete solution to reach the goal.')
    parts.push('')
    parts.push('In your reasoning, explain your solution strategy step-by-step:')
    parts.push('1. Identify what keys are needed and where they are')
    parts.push('2. Plan the order of collecting keys and opening doors')
    parts.push('3. Identify any traps that need to be neutralized with blocks')
    parts.push('4. Describe the path to the goal')
    parts.push('')
    parts.push('Return ONLY a JSON object in this exact format (no other text):')
    parts.push(
      '{"reasoning":"<detailed step-by-step strategy explanation>","moves":["UP","RIGHT","INTERACT","DOWN","LEFT"]}',
    )
    parts.push('')
    parts.push('Valid moves: UP, DOWN, LEFT, RIGHT, INTERACT')
  } else {
    parts.push('Provide the next single move.')
    parts.push('')
    parts.push('In your reasoning, briefly explain:')
    parts.push('- What is the immediate goal of this move?')
    parts.push('- How does it contribute to the overall solution?')
    parts.push('')
    parts.push('Return ONLY a JSON object in this exact format (no other text):')
    parts.push('{"reasoning":"<brief reasoning for this move>","move":"UP"}')
    parts.push('')
    parts.push('Valid moves: UP, DOWN, LEFT, RIGHT, INTERACT')
  }

  return parts.join('\n')
}

/**
 * Generate a minimal prompt (just the grid and basic instructions)
 */
export function generateMinimalPrompt(state: GameState): string {
  const parts: string[] = []

  parts.push(
    'Solve this dungeon puzzle. Reach the goal (G) while collecting keys and opening doors.',
  )
  parts.push('')
  parts.push('```')
  parts.push(gameStateToAscii(state))
  parts.push('```')
  parts.push('')
  parts.push(`Turn ${state.turn}/${state.maxTurns}`)
  if (state.inventory.keys.length > 0) {
    parts.push(`Keys: ${state.inventory.keys.join(', ')}`)
  }
  parts.push('')
  parts.push('Reply with moves as a JSON array: ["UP", "DOWN", "LEFT", "RIGHT", "INTERACT", ...]')

  return parts.join('\n')
}

/**
 * Generate a move-by-move prompt for iterative solving
 */
export function generateMoveByMovePrompt(state: GameState, moveHistory: string[]): string {
  const parts: string[] = []

  parts.push('Dungeon puzzle - provide the NEXT SINGLE MOVE.')
  parts.push('')
  parts.push('Current state:')
  parts.push('```')
  parts.push(gameStateToAscii(state))
  parts.push('```')
  parts.push('')

  if (moveHistory.length > 0) {
    parts.push(`Previous moves: ${moveHistory.join(', ')}`)
    parts.push('')
  }

  parts.push(`Turn: ${state.turn}/${state.maxTurns}`)
  if (state.inventory.keys.length > 0) {
    parts.push(`Keys: ${state.inventory.keys.join(', ')}`)
  }
  parts.push('')
  parts.push('Reply with ONE move: UP, DOWN, LEFT, RIGHT, or INTERACT')

  return parts.join('\n')
}

/**
 * Default prompt options
 */
export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
  asciiGrid: true,
  coordinateFormat: true,
  includeNotationGuide: true,
  executionMode: 'fullSolution',
  cipherSymbols: false,
  coordinateLocations: false,
}

// Legacy export for compatibility
export const generateSokobanPrompt = generateDungeonPrompt

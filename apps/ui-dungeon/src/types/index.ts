/**
 * Core game types for the dungeon crawler puzzle builder
 */

// Core position type
export interface Position {
  x: number // column (0-indexed)
  y: number // row (0-indexed)
}

// Tile types that can exist on the grid
export const TileType = {
  EMPTY: 'EMPTY',
  WALL: 'WALL',
  GOAL: 'GOAL',
  KEY_RED: 'KEY_RED',
  KEY_BLUE: 'KEY_BLUE',
  KEY_GREEN: 'KEY_GREEN',
  KEY_YELLOW: 'KEY_YELLOW',
  DOOR_RED: 'DOOR_RED',
  DOOR_BLUE: 'DOOR_BLUE',
  DOOR_GREEN: 'DOOR_GREEN',
  DOOR_YELLOW: 'DOOR_YELLOW',
  BLOCK: 'BLOCK', // Pushable box
  TRAP: 'TRAP',
  PORTAL_A: 'PORTAL_A',
  PORTAL_B: 'PORTAL_B',
} as const
export type TileType = (typeof TileType)[keyof typeof TileType]

// Actions the player can take
export const Action = {
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
} as const
export type Action = (typeof Action)[keyof typeof Action]

// Movement directions (subset of actions)
export type MoveDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

// A single tile on the grid with optional metadata
export interface Tile {
  type: TileType
  isOpen?: boolean // For doors (true = open, can pass through)
  isFixed?: boolean // For blocks that have neutralized traps (safe to walk on)
}

// The full grid state
export type Grid = Tile[][]

// Color types for keys/doors
export type KeyColor = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW'

// Inventory tracking collected items
export interface Inventory {
  keys: KeyColor[]
}

// Move record for undo functionality and AI tracking
export interface MoveRecord {
  id: string
  action: Action
  previousPlayerPos: Position
  previousGrid?: Grid // For undoing door openings, key pickups, etc.
  previousInventory?: Inventory
  collectedKey?: KeyColor
  openedDoor?: Position
  pushedBlock?: { from: Position; to: Position }
  neutralizedTrap?: Position
  teleported?: boolean
  source: 'human' | 'ai'
  timestamp: number
}

// Level definition (blueprint for creating a game)
export interface DungeonLevel {
  id: string
  name: string
  description: string
  gridSize: { width: number; height: number }
  maxTurns: number
  objective: string
  playerStart: Position
  layout: TileType[][] // Grid layout as a 2D array of tile types
}

// Complete game state
export interface GameState {
  level: DungeonLevel
  turn: number
  maxTurns: number
  gridSize: { width: number; height: number }
  grid: Grid
  playerPosition: Position
  inventory: Inventory
  objective: string
  done: boolean
  success: boolean
  message?: string
  moveHistory: MoveRecord[]
  startTime: number | null
  endTime: number | null
}

// Result of executing an action
export interface ActionResult {
  success: boolean
  newState: GameState
  message: string
}

// AI prompt options
export interface PromptOptions {
  executionMode: 'fullSolution' | 'moveByMove'
  /** Add explicit instructions, labels, and legend */
  addInstructions: boolean
  /** Add few-shot gameplay examples */
  addExamples: boolean
  /** Enable exploration mode with EXPLORE/CONTINUE/RESTART commands */
  enableExploration: boolean
  /** Use semantic symbol names (e.g., "red key" instead of "a") */
  enableSemanticSymbols: boolean
  /** Include reasoning field in the response format */
  includeReasoning: boolean
}

// Exploration command types for AI responses
export type ExplorationCommand = 'EXPLORE' | 'CONTINUE' | 'RESTART' | 'RESTART_EXPLORE' | 'SUBMIT'

// AI session metrics
export interface SessionMetrics {
  totalCost: number
  totalTokens: number
  totalDurationMs: number
  requestCount: number
  // Human calibrated efficiency metrics
  totalInputTokens: number
  totalOutputTokens: number
  totalReasoningTokens: number
  /** Estimated words from tokens (approx 0.75 words per token) */
  estimatedWords: number
}

// Planned move for AI execution
export interface PlannedMove {
  id: string
  action: Action
  status: 'pending' | 'executing' | 'success' | 'failed' | 'invalid'
  error?: string
}

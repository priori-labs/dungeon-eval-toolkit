import type { Action, MoveDirection, TileType } from '@src/types'

// Grid rendering
export const CELL_SIZE = 40

// Action key mappings
export const ACTION_KEYS: Record<string, Action> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
}

// Move key mappings (arrow keys only - for backwards compatibility)
export const MOVE_KEYS: Record<string, MoveDirection> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
}

// Direction vectors
export const DIRECTION_VECTORS: Record<MoveDirection, { dx: number; dy: number }> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
}

// Dungeon notation mapping (for AI move parsing)
export const DUNGEON_NOTATION: Record<string, Action> = {
  u: 'UP',
  U: 'UP',
  d: 'DOWN',
  D: 'DOWN',
  l: 'LEFT',
  L: 'LEFT',
  r: 'RIGHT',
  R: 'RIGHT',
}

// AI move execution delay (ms)
export const AI_MOVE_DELAY = 200

// Tile categories for the palette
export const TILE_CATEGORIES = {
  basic: ['EMPTY', 'WALL', 'GOAL'] as TileType[],
  keys: ['KEY_RED', 'KEY_BLUE', 'KEY_GREEN', 'KEY_YELLOW'] as TileType[],
  doors: ['DOOR_RED', 'DOOR_BLUE', 'DOOR_GREEN', 'DOOR_YELLOW'] as TileType[],
  objects: ['BLOCK', 'TRAP'] as TileType[],
  portals: ['PORTAL_A', 'PORTAL_B'] as TileType[],
}

// Tile display names
export const TILE_NAMES: Record<TileType, string> = {
  EMPTY: 'Empty',
  WALL: 'Wall',
  GOAL: 'Goal',
  KEY_RED: 'Red Key',
  KEY_BLUE: 'Blue Key',
  KEY_GREEN: 'Green Key',
  KEY_YELLOW: 'Yellow Key',
  DOOR_RED: 'Red Door',
  DOOR_BLUE: 'Blue Door',
  DOOR_GREEN: 'Green Door',
  DOOR_YELLOW: 'Yellow Door',
  BLOCK: 'Block',
  TRAP: 'Trap',
  PORTAL_A: 'Portal A',
  PORTAL_B: 'Portal B',
}

import { CELL_SIZE } from '@src/constants'
import type { GameState, Position, TileType } from '@src/types'

// Add mode types for the tile palette
export type AddMode =
  | 'wall'
  | 'empty'
  | 'goal'
  | 'block'
  | 'trap'
  | 'key-red'
  | 'key-blue'
  | 'key-green'
  | 'key-yellow'
  | 'door-red'
  | 'door-blue'
  | 'door-green'
  | 'door-yellow'
  | 'portal-a'
  | 'portal-b'
  | 'player-start'
  | 'remove'
  | null

interface DungeonGridProps {
  state: GameState | null
  highlightedCells?: Position[]
  className?: string
  isEditing?: boolean
  onCellClick?: (x: number, y: number) => void
  selectedTile?: AddMode
  onCellDragStart?: (x: number, y: number) => void
  onCellDragEnter?: (x: number, y: number) => void
  onDragEnd?: () => void
  isDragging?: boolean
}

// Color mappings for tile types
const TILE_COLORS: Record<string, string> = {
  EMPTY: 'hsl(var(--dungeon-floor))',
  WALL: 'hsl(var(--dungeon-wall))',
  GOAL: 'hsl(var(--dungeon-goal))',
  KEY_RED: '#ffb3ba',
  KEY_BLUE: '#bae1ff',
  KEY_GREEN: '#baffc9',
  KEY_YELLOW: '#ffffba',
  DOOR_RED: '#ff9aa2',
  DOOR_BLUE: '#9ac9ff',
  DOOR_GREEN: '#9affb3',
  DOOR_YELLOW: '#ffff9a',
  BLOCK: 'hsl(var(--dungeon-floor))',
  TRAP: 'hsl(var(--dungeon-floor))',
  PORTAL_A: '#c7ceea',
  PORTAL_B: '#e2c7ea',
}

// Emoji mappings for tile types
const TILE_EMOJIS: Partial<Record<TileType, string>> = {
  GOAL: '⭐',
  KEY_RED: '🔑',
  KEY_BLUE: '🔑',
  KEY_GREEN: '🔑',
  KEY_YELLOW: '🔑',
  DOOR_RED: '🚪',
  DOOR_BLUE: '🚪',
  DOOR_GREEN: '🚪',
  DOOR_YELLOW: '🚪',
  BLOCK: '📦',
  TRAP: '💀',
  PORTAL_A: '🌀',
  PORTAL_B: '🌀',
}

export function DungeonGrid({
  state,
  highlightedCells = [],
  className = '',
  isEditing = false,
  onCellClick,
  selectedTile = null,
  onCellDragStart,
  onCellDragEnter,
  onDragEnd,
  isDragging = false,
}: DungeonGridProps) {
  if (!state) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/20 rounded-lg p-8 ${className}`}
        style={{ width: CELL_SIZE * 10, height: CELL_SIZE * 10 }}
      >
        <p className="text-muted-foreground text-sm">No puzzle loaded</p>
      </div>
    )
  }

  const { grid, gridSize, playerPosition } = state

  // Use smaller cells for large grids (over 20x20)
  const isLargeGrid = gridSize.width > 20 || gridSize.height > 20
  const cellSize = isLargeGrid ? 28 : CELL_SIZE

  const isHighlighted = (x: number, y: number) =>
    highlightedCells.some((c) => c.x === x && c.y === y)

  const isPlayer = (x: number, y: number) => playerPosition.x === x && playerPosition.y === y

  const gridWidth = gridSize.width * cellSize
  const gridHeight = gridSize.height * cellSize

  return (
    <div className={`inline-block rounded overflow-hidden animate-fade-in ${className}`}>
      <div
        className="relative bg-[hsl(var(--dungeon-floor))]"
        style={{
          width: gridWidth,
          height: gridHeight,
          display: 'grid',
          gridTemplateColumns: `repeat(${gridSize.width}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${gridSize.height}, ${cellSize}px)`,
        }}
      >
        {grid.map((row, y) =>
          row.map((tile, x) => {
            const tileType = tile.type
            const cellIsPlayer = isPlayer(x, y)
            const cellIsHighlighted = isHighlighted(x, y)
            const cellKey = `cell-${x}-${y}`

            // Get base color
            let bgColor = TILE_COLORS[tileType] || TILE_COLORS.EMPTY

            // Handle open doors - show as floor-like
            if (tileType.startsWith('DOOR_') && tile.isOpen) {
              bgColor = 'hsl(var(--dungeon-floor))'
            }

            // Get emoji
            const emoji = TILE_EMOJIS[tileType as TileType]

            // Check for editing cursor
            const isBorderCell =
              x === 0 || x === gridSize.width - 1 || y === 0 || y === gridSize.height - 1
            const canEdit = isEditing && selectedTile && !isBorderCell

            return (
              <div
                key={cellKey}
                className={`relative transition-all duration-150 ${isEditing ? 'cursor-pointer hover:brightness-125' : ''} select-none outline-none`}
                style={{
                  backgroundColor: bgColor,
                  cursor: canEdit ? 'crosshair' : undefined,
                }}
                onClick={isEditing ? () => onCellClick?.(x, y) : undefined}
                onMouseDown={
                  isEditing
                    ? (e) => {
                        e.preventDefault()
                        onCellDragStart?.(x, y)
                      }
                    : undefined
                }
                onMouseEnter={isEditing && isDragging ? () => onCellDragEnter?.(x, y) : undefined}
                onMouseUp={isEditing ? () => onDragEnd?.() : undefined}
                onKeyDown={
                  isEditing
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onCellClick?.(x, y)
                        }
                      }
                    : undefined
                }
                role={isEditing ? 'button' : undefined}
                tabIndex={isEditing ? 0 : undefined}
              >
                {/* Tile content (emoji) */}
                {emoji && tileType !== 'WALL' && tileType !== 'EMPTY' && !cellIsPlayer && (
                  <div
                    className={`absolute inset-0 flex items-center justify-center ${
                      tileType === 'BLOCK' || tileType === 'TRAP'
                        ? isLargeGrid
                          ? 'text-lg'
                          : 'text-2xl'
                        : isLargeGrid
                          ? 'text-sm'
                          : 'text-lg'
                    } ${tileType === 'TRAP' ? 'border border-orange-400' : ''}`}
                    style={{
                      opacity: tileType.startsWith('DOOR_') && tile.isOpen ? 0.3 : 1,
                    }}
                  >
                    {/* Special handling for open doors */}
                    {tileType.startsWith('DOOR_') && tile.isOpen ? '┃' : emoji}
                  </div>
                )}

                {/* Player */}
                {cellIsPlayer && (
                  <div
                    className="absolute rounded-full flex items-center justify-center shadow-lg"
                    style={{
                      inset: isLargeGrid ? 3 : 4,
                      backgroundColor: 'hsl(var(--dungeon-player))',
                      border: `${isLargeGrid ? 2 : 3}px solid hsl(var(--dungeon-player) / 0.5)`,
                    }}
                  >
                    <div
                      className={`${isLargeGrid ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full`}
                      style={{ backgroundColor: 'hsl(var(--dungeon-player) / 0.3)' }}
                    />
                  </div>
                )}

                {/* Player start indicator (in editing mode, when player is elsewhere) */}
                {isEditing &&
                  state.level.playerStart.x === x &&
                  state.level.playerStart.y === y &&
                  !cellIsPlayer && (
                    <div
                      className="absolute rounded-full border-2 border-dashed flex items-center justify-center"
                      style={{
                        inset: isLargeGrid ? 4 : 6,
                        borderColor: 'hsl(var(--dungeon-player))',
                        opacity: 0.5,
                      }}
                    >
                      <span className={isLargeGrid ? 'text-[10px]' : 'text-xs'}>P</span>
                    </div>
                  )}

                {/* AI path highlight overlay */}
                {cellIsHighlighted && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundColor: 'rgba(251, 191, 36, 0.35)',
                    }}
                  />
                )}
              </div>
            )
          }),
        )}
      </div>
    </div>
  )
}

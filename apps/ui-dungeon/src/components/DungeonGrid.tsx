import { Cube, DoorOpen, Flag, Key, Skull, Spiral } from '@phosphor-icons/react'
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

// Sophisticated muted color palette for tile accents
const TILE_ACCENT_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  EMPTY: { bg: 'transparent', border: 'transparent', icon: 'transparent' },
  WALL: { bg: 'hsl(var(--dungeon-wall))', border: 'transparent', icon: 'transparent' },
  GOAL: { bg: 'hsl(47 80% 50% / 0.45)', border: 'hsl(47 80% 50% / 0.6)', icon: 'hsl(47 80% 55%)' },
  KEY_RED: { bg: 'hsl(0 60% 50% / 0.4)', border: 'hsl(0 60% 45% / 0.6)', icon: 'hsl(0 65% 55%)' },
  KEY_BLUE: {
    bg: 'hsl(210 60% 50% / 0.4)',
    border: 'hsl(210 60% 45% / 0.6)',
    icon: 'hsl(210 65% 55%)',
  },
  KEY_GREEN: {
    bg: 'hsl(140 50% 45% / 0.4)',
    border: 'hsl(140 50% 40% / 0.6)',
    icon: 'hsl(140 55% 50%)',
  },
  KEY_YELLOW: {
    bg: 'hsl(45 70% 50% / 0.4)',
    border: 'hsl(45 70% 45% / 0.6)',
    icon: 'hsl(45 75% 55%)',
  },
  DOOR_RED: {
    bg: 'hsl(25 70% 40% / 0.5)',
    border: 'hsl(25 70% 40% / 0.7)',
    icon: 'hsl(25 75% 50%)',
  },
  DOOR_BLUE: {
    bg: 'hsl(210 55% 40% / 0.5)',
    border: 'hsl(210 55% 40% / 0.7)',
    icon: 'hsl(210 60% 50%)',
  },
  DOOR_GREEN: {
    bg: 'hsl(140 45% 35% / 0.5)',
    border: 'hsl(140 45% 35% / 0.7)',
    icon: 'hsl(140 50% 45%)',
  },
  DOOR_YELLOW: {
    bg: 'hsl(45 65% 40% / 0.5)',
    border: 'hsl(45 65% 40% / 0.7)',
    icon: 'hsl(45 70% 50%)',
  },
  BLOCK: { bg: 'hsl(30 30% 35% / 0.5)', border: 'hsl(30 25% 40% / 0.6)', icon: 'hsl(30 30% 55%)' },
  TRAP: { bg: 'hsl(0 70% 45% / 0.45)', border: 'hsl(0 70% 40% / 0.6)', icon: 'hsl(0 75% 55%)' },
  PORTAL_A: {
    bg: 'hsl(270 50% 50% / 0.45)',
    border: 'hsl(270 50% 45% / 0.6)',
    icon: 'hsl(270 55% 60%)',
  },
  PORTAL_B: {
    bg: 'hsl(180 50% 45% / 0.45)',
    border: 'hsl(180 50% 40% / 0.6)',
    icon: 'hsl(180 55% 55%)',
  },
}

// Get the appropriate icon component for a tile type
function TileIcon({
  tileType,
  size,
  isOpen,
}: {
  tileType: TileType
  size: number
  isOpen?: boolean
}) {
  const colors = TILE_ACCENT_COLORS[tileType] || TILE_ACCENT_COLORS.EMPTY
  const iconColor = colors.icon
  const weight = 'regular' as const

  switch (tileType) {
    case 'GOAL':
      return <Flag size={size} weight="fill" color={iconColor} />
    case 'KEY_RED':
    case 'KEY_BLUE':
    case 'KEY_GREEN':
    case 'KEY_YELLOW':
      return <Key size={size} weight={weight} color={iconColor} />
    case 'DOOR_RED':
    case 'DOOR_BLUE':
    case 'DOOR_GREEN':
    case 'DOOR_YELLOW':
      return isOpen ? (
        <DoorOpen size={size} weight={weight} color={iconColor} style={{ opacity: 0.4 }} />
      ) : (
        <DoorOpen size={size} weight="fill" color={iconColor} />
      )
    case 'BLOCK':
      return <Cube size={size} weight={weight} color={iconColor} />
    case 'TRAP':
      return <Skull size={size} weight={weight} color={iconColor} />
    case 'PORTAL_A':
    case 'PORTAL_B':
      return <Spiral size={size} weight={weight} color={iconColor} className="animate-spin-slow" />
    default:
      return null
  }
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
  const indexSize = isLargeGrid ? 20 : 24
  const iconSize = isLargeGrid ? 16 : 22

  return (
    <div className={`inline-block animate-fade-in ${className}`}>
      {/* Column indexes (top) - static grid, indexes never reorder */}
      <div className="flex" style={{ marginLeft: indexSize }}>
        {Array.from({ length: gridSize.width }).map((_, x) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static grid indexes never reorder
            key={`col-${x}`}
            className="flex items-center justify-center text-muted-foreground/60 font-mono"
            style={{
              width: cellSize,
              height: indexSize,
              fontSize: isLargeGrid ? 9 : 10,
            }}
          >
            {x}
          </div>
        ))}
      </div>

      <div className="flex">
        {/* Row indexes (left) - static grid, indexes never reorder */}
        <div className="flex flex-col">
          {Array.from({ length: gridSize.height }).map((_, y) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static grid indexes never reorder
              key={`row-${y}`}
              className="flex items-center justify-center text-muted-foreground/60 font-mono"
              style={{
                width: indexSize,
                height: cellSize,
                fontSize: isLargeGrid ? 9 : 10,
              }}
            >
              {y}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div
          className="relative rounded-sm overflow-hidden"
          style={{
            width: gridWidth,
            height: gridHeight,
            display: 'grid',
            gridTemplateColumns: `repeat(${gridSize.width}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${gridSize.height}, ${cellSize}px)`,
            backgroundColor: 'hsl(var(--dungeon-floor))',
            boxShadow: 'inset 0 0 0 1px hsl(var(--border) / 0.3)',
          }}
        >
          {grid.map((row, y) =>
            row.map((tile, x) => {
              const tileType = tile.type
              const cellIsPlayer = isPlayer(x, y)
              const cellIsHighlighted = isHighlighted(x, y)
              const cellKey = `cell-${x}-${y}`
              const isWall = tileType === 'WALL'
              const isEmpty = tileType === 'EMPTY'
              const isDoor = tileType.startsWith('DOOR_')
              const isOpenDoor = isDoor && tile.isOpen

              // Get accent colors for this tile
              const colors = TILE_ACCENT_COLORS[tileType] || TILE_ACCENT_COLORS.EMPTY

              // Check for editing cursor
              const isBorderCell =
                x === 0 || x === gridSize.width - 1 || y === 0 || y === gridSize.height - 1
              const canEdit = isEditing && selectedTile && !isBorderCell

              return (
                <div
                  key={cellKey}
                  className={`relative transition-all duration-100 select-none outline-none ${
                    isEditing ? 'cursor-pointer hover:brightness-125' : ''
                  }`}
                  style={{
                    backgroundColor: isWall ? colors.bg : isEmpty ? 'transparent' : colors.bg,
                    cursor: canEdit ? 'crosshair' : undefined,
                    boxShadow:
                      !isWall && !isEmpty && !isOpenDoor
                        ? `inset 0 0 0 1px ${colors.border}`
                        : isWall
                          ? 'inset 0 1px 2px hsl(0 0% 100% / 0.05)'
                          : undefined,
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
                  {/* Tile icon */}
                  {!isWall && !isEmpty && !cellIsPlayer && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <TileIcon tileType={tileType} size={iconSize} isOpen={isOpenDoor} />
                    </div>
                  )}

                  {/* Player */}
                  {cellIsPlayer && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ fontSize: isLargeGrid ? 18 : 24 }}
                    >
                      🧑‍🚀
                    </div>
                  )}

                  {/* Player start indicator (in editing mode, when player is elsewhere) */}
                  {isEditing &&
                    state.level.playerStart.x === x &&
                    state.level.playerStart.y === y &&
                    !cellIsPlayer && (
                      <div
                        className="absolute inset-0 flex items-center justify-center opacity-40"
                        style={{ fontSize: isLargeGrid ? 14 : 18 }}
                      >
                        🧑‍🚀
                      </div>
                    )}

                  {/* AI path highlight overlay */}
                  {cellIsHighlighted && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundColor: 'hsl(45 100% 50% / 0.25)',
                        boxShadow: 'inset 0 0 0 1px hsl(45 100% 50% / 0.4)',
                      }}
                    />
                  )}
                </div>
              )
            }),
          )}
        </div>
      </div>

      {/* Add slow spin animation for portals */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  )
}

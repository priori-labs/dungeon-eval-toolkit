/**
 * Sophisticated tile palette for the level editor
 * Uses Phosphor icons with a refined, muted color system
 */

import {
  Cube,
  DoorOpen,
  Eraser,
  Flag,
  Key,
  Skull,
  Spiral,
  Square,
  SquaresFour,
  User,
} from '@phosphor-icons/react'
import { TILE_CATEGORIES, TILE_NAMES } from '@src/constants'
import type { TileType } from '@src/types'
import type { AddMode } from './DungeonGrid'

interface TilePaletteProps {
  selectedTile: AddMode
  onSelectTile: (tile: AddMode) => void
  isSettingPlayerStart: boolean
  onSetPlayerStart: (value: boolean) => void
  isEditing: boolean
  onEditingChange: (editing: boolean) => void
}

// Sophisticated muted color palette matching the grid
const TILE_PALETTE_STYLES: Record<
  string,
  { bg: string; border: string; icon: string; iconBg?: string }
> = {
  EMPTY: {
    bg: 'hsl(0 0% 12%)',
    border: 'hsl(0 0% 20%)',
    icon: 'hsl(0 0% 50%)',
  },
  WALL: {
    bg: 'hsl(0 0% 25%)',
    border: 'hsl(0 0% 35%)',
    icon: 'hsl(0 0% 60%)',
  },
  GOAL: {
    bg: 'hsl(47 80% 50% / 0.45)',
    border: 'hsl(47 80% 50% / 0.6)',
    icon: 'hsl(47 80% 55%)',
  },
  KEY_RED: {
    bg: 'hsl(0 60% 50% / 0.4)',
    border: 'hsl(0 60% 45% / 0.6)',
    icon: 'hsl(0 65% 55%)',
  },
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
  BLOCK: {
    bg: 'hsl(30 30% 35% / 0.5)',
    border: 'hsl(30 25% 40% / 0.6)',
    icon: 'hsl(30 30% 55%)',
  },
  TRAP: {
    bg: 'hsl(0 70% 45% / 0.45)',
    border: 'hsl(0 70% 40% / 0.6)',
    icon: 'hsl(0 75% 55%)',
  },
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

// Map AddMode to TileType for comparison
function addModeToTileType(mode: AddMode): TileType | null {
  if (!mode) return null
  const map: Record<string, TileType> = {
    wall: 'WALL',
    empty: 'EMPTY',
    goal: 'GOAL',
    block: 'BLOCK',
    trap: 'TRAP',
    'key-red': 'KEY_RED',
    'key-blue': 'KEY_BLUE',
    'key-green': 'KEY_GREEN',
    'key-yellow': 'KEY_YELLOW',
    'door-red': 'DOOR_RED',
    'door-blue': 'DOOR_BLUE',
    'door-green': 'DOOR_GREEN',
    'door-yellow': 'DOOR_YELLOW',
    'portal-a': 'PORTAL_A',
    'portal-b': 'PORTAL_B',
  }
  return map[mode] ?? null
}

// Map TileType to AddMode
function tileTypeToAddMode(tileType: TileType): AddMode {
  const map: Record<TileType, AddMode> = {
    WALL: 'wall',
    EMPTY: 'empty',
    GOAL: 'goal',
    BLOCK: 'block',
    TRAP: 'trap',
    KEY_RED: 'key-red',
    KEY_BLUE: 'key-blue',
    KEY_GREEN: 'key-green',
    KEY_YELLOW: 'key-yellow',
    DOOR_RED: 'door-red',
    DOOR_BLUE: 'door-blue',
    DOOR_GREEN: 'door-green',
    DOOR_YELLOW: 'door-yellow',
    PORTAL_A: 'portal-a',
    PORTAL_B: 'portal-b',
  }
  return map[tileType]
}

// Get the icon for a tile type
function getTileIcon(tileType: TileType, color: string, size = 14) {
  switch (tileType) {
    case 'EMPTY':
      return <Square size={size} weight="regular" color={color} />
    case 'WALL':
      return <SquaresFour size={size} weight="fill" color={color} />
    case 'GOAL':
      return <Flag size={size} weight="fill" color={color} />
    case 'KEY_RED':
    case 'KEY_BLUE':
    case 'KEY_GREEN':
    case 'KEY_YELLOW':
      return <Key size={size} weight="regular" color={color} />
    case 'DOOR_RED':
    case 'DOOR_BLUE':
    case 'DOOR_GREEN':
    case 'DOOR_YELLOW':
      return <DoorOpen size={size} weight="fill" color={color} />
    case 'BLOCK':
      return <Cube size={size} weight="regular" color={color} />
    case 'TRAP':
      return <Skull size={size} weight="regular" color={color} />
    case 'PORTAL_A':
    case 'PORTAL_B':
      return <Spiral size={size} weight="regular" color={color} />
    default:
      return null
  }
}

interface TileButtonProps {
  tileType: TileType
  isSelected: boolean
  onClick: () => void
}

function TileButton({ tileType, isSelected, onClick }: TileButtonProps) {
  const name = TILE_NAMES[tileType]
  const styles = TILE_PALETTE_STYLES[tileType] || TILE_PALETTE_STYLES.EMPTY

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
        isSelected
          ? 'ring-1 ring-white/40 ring-offset-1 ring-offset-background scale-110'
          : 'hover:scale-105 hover:brightness-125'
      }`}
      style={{
        backgroundColor: styles.bg,
        boxShadow: `inset 0 0 0 1px ${styles.border}`,
      }}
      title={name}
    >
      {getTileIcon(tileType, styles.icon)}
    </button>
  )
}

export function TilePalette({
  selectedTile,
  onSelectTile,
  isSettingPlayerStart,
  onSetPlayerStart,
  isEditing,
  onEditingChange,
}: TilePaletteProps) {
  const selectedTileType = addModeToTileType(selectedTile)

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Edit toggle, Player, Basic, Erase */}
      <div className="flex items-center justify-center gap-3">
        {/* Edit Toggle */}
        <button
          type="button"
          onClick={() => onEditingChange(!isEditing)}
          className={`h-7 px-3 text-xs rounded border focus:outline-none whitespace-nowrap transition-colors ${
            isEditing
              ? 'bg-primary/20 text-primary border-primary/50'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
          }`}
        >
          {isEditing ? 'Editing' : 'Edit Level'}
        </button>

        {isEditing && (
          <>
            <div className="w-px h-5 bg-border/30" />

            {/* Player Start */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
                Player
              </span>
              <button
                type="button"
                onClick={() => {
                  onSetPlayerStart(!isSettingPlayerStart)
                  if (!isSettingPlayerStart) {
                    onSelectTile('player-start')
                  }
                }}
                className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
                  isSettingPlayerStart
                    ? 'ring-1 ring-white/40 ring-offset-1 ring-offset-background scale-110'
                    : 'hover:scale-105 hover:brightness-125'
                }`}
                style={{
                  backgroundColor: isSettingPlayerStart
                    ? 'hsl(210 100% 50% / 0.25)'
                    : 'hsl(0 0% 15%)',
                  boxShadow: isSettingPlayerStart
                    ? 'inset 0 0 0 1px hsl(210 100% 50% / 0.5)'
                    : 'inset 0 0 0 1px hsl(0 0% 25%)',
                }}
                title="Set Player Start"
              >
                <User
                  size={14}
                  weight={isSettingPlayerStart ? 'bold' : 'regular'}
                  color={isSettingPlayerStart ? 'hsl(210 100% 60%)' : 'hsl(0 0% 50%)'}
                />
              </button>
            </div>

            <div className="w-px h-5 bg-border/30" />

            {/* Basic Tiles */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
                Basic
              </span>
              <div className="flex gap-1">
                {TILE_CATEGORIES.basic.map((tileType) => (
                  <TileButton
                    key={tileType}
                    tileType={tileType}
                    isSelected={selectedTileType === tileType}
                    onClick={() => {
                      onSetPlayerStart(false)
                      onSelectTile(tileTypeToAddMode(tileType))
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="w-px h-5 bg-border/30" />

            {/* Remove Tool */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
                Erase
              </span>
              <button
                type="button"
                onClick={() => {
                  onSetPlayerStart(false)
                  onSelectTile('remove')
                }}
                className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
                  selectedTile === 'remove'
                    ? 'ring-1 ring-white/40 ring-offset-1 ring-offset-background scale-110'
                    : 'hover:scale-105 hover:brightness-125'
                }`}
                style={{
                  backgroundColor:
                    selectedTile === 'remove' ? 'hsl(0 70% 45% / 0.2)' : 'hsl(0 0% 15%)',
                  boxShadow:
                    selectedTile === 'remove'
                      ? 'inset 0 0 0 1px hsl(0 70% 45% / 0.5)'
                      : 'inset 0 0 0 1px hsl(0 0% 25%)',
                }}
                title="Remove Tile"
              >
                <Eraser
                  size={14}
                  weight={selectedTile === 'remove' ? 'bold' : 'regular'}
                  color={selectedTile === 'remove' ? 'hsl(0 70% 55%)' : 'hsl(0 0% 50%)'}
                />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Divider between rows (only shown when editing) */}
      {isEditing && <div className="h-px bg-border/30" />}

      {/* Row 2: Keys, Doors, Objects, Portals (only shown when editing) */}
      {isEditing && (
        <div className="flex items-center justify-center gap-3">
          {/* Keys */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
              Keys
            </span>
            <div className="flex gap-1">
              {TILE_CATEGORIES.keys.map((tileType) => (
                <TileButton
                  key={tileType}
                  tileType={tileType}
                  isSelected={selectedTileType === tileType}
                  onClick={() => {
                    onSetPlayerStart(false)
                    onSelectTile(tileTypeToAddMode(tileType))
                  }}
                />
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-border/30" />

          {/* Doors */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
              Doors
            </span>
            <div className="flex gap-1">
              {TILE_CATEGORIES.doors.map((tileType) => (
                <TileButton
                  key={tileType}
                  tileType={tileType}
                  isSelected={selectedTileType === tileType}
                  onClick={() => {
                    onSetPlayerStart(false)
                    onSelectTile(tileTypeToAddMode(tileType))
                  }}
                />
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-border/30" />

          {/* Objects */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
              Objects
            </span>
            <div className="flex gap-1">
              {TILE_CATEGORIES.objects.map((tileType) => (
                <TileButton
                  key={tileType}
                  tileType={tileType}
                  isSelected={selectedTileType === tileType}
                  onClick={() => {
                    onSetPlayerStart(false)
                    onSelectTile(tileTypeToAddMode(tileType))
                  }}
                />
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-border/30" />

          {/* Portals */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
              Portals
            </span>
            <div className="flex gap-1">
              {TILE_CATEGORIES.portals.map((tileType) => (
                <TileButton
                  key={tileType}
                  tileType={tileType}
                  isSelected={selectedTileType === tileType}
                  onClick={() => {
                    onSetPlayerStart(false)
                    onSelectTile(tileTypeToAddMode(tileType))
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

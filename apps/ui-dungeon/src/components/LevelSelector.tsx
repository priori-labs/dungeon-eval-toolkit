import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Input } from '@sokoban-eval-toolkit/ui-library/components/input'
import { Label } from '@sokoban-eval-toolkit/ui-library/components/label'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import { toast } from '@sokoban-eval-toolkit/ui-library/components/sonner'
import { Switch } from '@sokoban-eval-toolkit/ui-library/components/switch'
import type { DungeonLevel } from '@src/types'
import {
  createBlankLevel,
  deleteLevel,
  exportAllToJSON,
  getSavedLevels,
  importFromJSON,
  saveLevel,
} from '@src/utils/levelStorage'
import { ChevronDown, ChevronRight, Download, Plus, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface LevelSelectorProps {
  onLevelLoad: (level: DungeonLevel) => void
  currentLevel?: DungeonLevel | null
  isEditing?: boolean
  onEditingChange?: (editing: boolean) => void
}

export function LevelSelector({
  onLevelLoad,
  currentLevel,
  isEditing = false,
  onEditingChange,
}: LevelSelectorProps) {
  const [savedLevels, setSavedLevels] = useState<DungeonLevel[]>([])
  const [newLevelWidth, setNewLevelWidth] = useState(10)
  const [newLevelHeight, setNewLevelHeight] = useState(8)
  const [levelName, setLevelName] = useState('')
  const [savedLevelsOpen, setSavedLevelsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load saved levels on mount
  useEffect(() => {
    setSavedLevels(getSavedLevels())
  }, [])

  // Refresh saved levels
  const refreshSavedLevels = useCallback(() => {
    setSavedLevels(getSavedLevels())
  }, [])

  // Create new level
  const handleNewLevel = useCallback(() => {
    const level = createBlankLevel(newLevelWidth, newLevelHeight, 'New Level')
    onLevelLoad(level)
    setLevelName('New Level')
  }, [newLevelWidth, newLevelHeight, onLevelLoad])

  // Save current level
  const handleSave = useCallback(() => {
    if (!currentLevel) return

    const levelToSave: DungeonLevel = {
      ...currentLevel,
      name: levelName || currentLevel.name,
    }

    saveLevel(levelToSave)
    refreshSavedLevels()
    toast.success('Level saved')
  }, [currentLevel, levelName, refreshSavedLevels])

  // Load a saved level
  const handleLoadSaved = useCallback(
    (level: DungeonLevel) => {
      onLevelLoad(level)
      setLevelName(level.name)
    },
    [onLevelLoad],
  )

  // Delete a saved level
  const handleDelete = useCallback(
    (levelId: string) => {
      if (!confirm('Delete this level?')) return
      deleteLevel(levelId)
      refreshSavedLevels()
    },
    [refreshSavedLevels],
  )

  // Export all levels
  const handleExportAll = useCallback(() => {
    const json = exportAllToJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dungeon-levels.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Import levels
  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        try {
          const data = JSON.parse(text)
          // Check if it's an array of levels or a single level
          const levels = Array.isArray(data) ? data : [data]

          for (const levelData of levels) {
            const level = importFromJSON(JSON.stringify(levelData))
            if (level) {
              saveLevel(level)
            }
          }

          refreshSavedLevels()
          alert(`Imported ${levels.length} level(s)`)
        } catch {
          alert('Failed to import levels')
        }
      }
      reader.readAsText(file)

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [refreshSavedLevels],
  )

  return (
    <div className="space-y-4">
      {/* Edit Mode Toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="edit-mode" className="text-sm">
          Edit Mode
        </Label>
        <Switch
          id="edit-mode"
          checked={isEditing}
          onCheckedChange={(checked) => onEditingChange?.(checked)}
        />
      </div>

      <Separator />

      {/* New Level Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">New Level</h3>

        <div className="flex gap-2 items-end">
          <div className="w-16">
            <Label htmlFor="width" className="text-xs text-muted-foreground">
              Width
            </Label>
            <Input
              id="width"
              type="number"
              min={5}
              max={20}
              value={newLevelWidth}
              onChange={(e) => setNewLevelWidth(Number(e.target.value))}
              className="h-8"
            />
          </div>
          <div className="w-16">
            <Label htmlFor="height" className="text-xs text-muted-foreground">
              Height
            </Label>
            <Input
              id="height"
              type="number"
              min={5}
              max={20}
              value={newLevelHeight}
              onChange={(e) => setNewLevelHeight(Number(e.target.value))}
              className="h-8"
            />
          </div>
          <Button onClick={handleNewLevel} size="sm" className="flex-1 h-8">
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>
      </div>

      <Separator />

      {/* Current Level */}
      {currentLevel && (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Current Level</h3>

            <div>
              <Label htmlFor="level-name" className="text-xs text-muted-foreground">
                Name
              </Label>
              <Input
                id="level-name"
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
                placeholder="Level name..."
                className="h-8"
              />
            </div>

            <div className="text-xs text-muted-foreground">
              {currentLevel.gridSize.width}x{currentLevel.gridSize.height}
            </div>

            <Button onClick={handleSave} size="sm" className="w-full" disabled={!levelName.trim()}>
              Save Level
            </Button>
          </div>

          <Separator />
        </>
      )}

      {/* Saved Levels */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setSavedLevelsOpen(!savedLevelsOpen)}
          className="flex items-center gap-1 w-full text-left"
        >
          {savedLevelsOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <h3 className="text-sm font-semibold">Saved Levels</h3>
          <span className="text-xs text-muted-foreground ml-1">({savedLevels.length})</span>
        </button>

        {savedLevelsOpen && (
          <>
            <div className="flex gap-1 ml-5">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Import levels"
              >
                <Upload className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleExportAll}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Export all levels"
                disabled={savedLevels.length === 0}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />

            {savedLevels.length === 0 ? (
              <p className="text-xs text-muted-foreground ml-5">No saved levels yet</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto ml-5">
                {savedLevels.map((level) => (
                  <div
                    key={level.id}
                    className="flex items-center gap-2 p-2 rounded bg-muted/50 hover:bg-muted"
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadSaved(level)}
                      className="flex-1 text-left text-sm truncate hover:underline"
                    >
                      {level.name}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {level.gridSize.width}x{level.gridSize.height}
                    </span>
                    <Button
                      onClick={() => handleDelete(level.id)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

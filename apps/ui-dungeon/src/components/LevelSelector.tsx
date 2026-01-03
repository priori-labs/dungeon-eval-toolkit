import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Input } from '@sokoban-eval-toolkit/ui-library/components/input'
import { Label } from '@sokoban-eval-toolkit/ui-library/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sokoban-eval-toolkit/ui-library/components/select'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import { toast } from '@sokoban-eval-toolkit/ui-library/components/sonner'
import { Switch } from '@sokoban-eval-toolkit/ui-library/components/switch'
import { OPENROUTER_MODELS } from '@sokoban-eval-toolkit/utils'
import { generateDungeonLevel, hasOpenRouterApiKey } from '@src/services/llm'
import type { DungeonLevel } from '@src/types'
import {
  createBlankLevel,
  deleteLevel,
  exportAllToJSON,
  getSavedLevels,
  importFromJSON,
  saveLevel,
} from '@src/utils/levelStorage'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface AIGenerationStats {
  durationMs: number
  cost: number
  inputTokens: number
  outputTokens: number
  rawResponse: string
  model: string
  width: number
  height: number
  error?: string
}

const DEFAULT_AI_MODEL = 'x-ai/grok-4.1-fast'

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
  const [newLevelWidth, setNewLevelWidth] = useState(16)
  const [newLevelHeight, setNewLevelHeight] = useState(16)
  const [levelName, setLevelName] = useState('')
  const [savedLevelsOpen, setSavedLevelsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI generation state
  const [aiModel, setAiModel] = useState(DEFAULT_AI_MODEL)
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastGenStats, setLastGenStats] = useState<AIGenerationStats | null>(null)
  const [copiedStats, setCopiedStats] = useState(false)
  const hasApiKey = hasOpenRouterApiKey()

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

  // Generate AI level
  const handleGenerateAI = useCallback(async () => {
    if (isGenerating || !hasApiKey) return

    setIsGenerating(true)
    setLastGenStats(null)
    try {
      const result = await generateDungeonLevel(newLevelWidth, newLevelHeight, aiModel)

      // Store stats regardless of success/failure
      setLastGenStats({
        durationMs: result.durationMs,
        cost: result.cost,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        rawResponse: result.rawResponse,
        model: aiModel,
        width: newLevelWidth,
        height: newLevelHeight,
        error: result.error,
      })

      if (result.error || !result.level) {
        toast.error(result.error || 'Failed to generate level')
        return
      }

      onLevelLoad(result.level)
      setLevelName(result.level.name)
      toast.success(`Generated "${result.level.name}" in ${(result.durationMs / 1000).toFixed(1)}s`)
    } catch (error) {
      toast.error('Failed to generate level')
      console.error('AI generation error:', error)
    } finally {
      setIsGenerating(false)
    }
  }, [isGenerating, hasApiKey, newLevelWidth, newLevelHeight, aiModel, onLevelLoad])

  // Copy full AI generation debug info
  const handleCopyGenStats = useCallback(() => {
    if (!lastGenStats) return

    const debugInfo = `=== AI Level Generation Debug Info ===
Model: ${lastGenStats.model}
Grid Size: ${lastGenStats.width}x${lastGenStats.height}
Duration: ${(lastGenStats.durationMs / 1000).toFixed(2)}s
Cost: $${lastGenStats.cost.toFixed(4)}
Input Tokens: ${lastGenStats.inputTokens}
Output Tokens: ${lastGenStats.outputTokens}
${lastGenStats.error ? `Error: ${lastGenStats.error}\n` : ''}
=== Raw Response ===
${lastGenStats.rawResponse}
`

    navigator.clipboard.writeText(debugInfo).then(() => {
      setCopiedStats(true)
      setTimeout(() => setCopiedStats(false), 2000)
    })
  }, [lastGenStats])

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
          <Button onClick={handleNewLevel} size="sm" className="flex-1 h-8" disabled={isGenerating}>
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>

        {/* AI Generation */}
        <div className="space-y-2">
          <Select value={aiModel} onValueChange={setAiModel} disabled={isGenerating || !hasApiKey}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select model..." />
            </SelectTrigger>
            <SelectContent>
              {OPENROUTER_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleGenerateAI}
            size="sm"
            variant="secondary"
            className="w-full h-8"
            disabled={isGenerating || !hasApiKey}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1" />
                AI Generate
              </>
            )}
          </Button>
          {!hasApiKey && (
            <p className="text-[10px] text-muted-foreground">
              Set VITE_OPENROUTER_API_KEY to use AI generation
            </p>
          )}
          {lastGenStats && !isGenerating && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1">
              <span>
                AI Response:{' '}
                {lastGenStats.durationMs >= 60000
                  ? `${Math.floor(lastGenStats.durationMs / 60000)}m ${Math.floor((lastGenStats.durationMs % 60000) / 1000)}s`
                  : `${(lastGenStats.durationMs / 1000).toFixed(1)}s`}{' '}
                (${lastGenStats.cost.toFixed(2)})
                {lastGenStats.error && <span className="text-red-400 ml-1">[error]</span>}
              </span>
              <button
                type="button"
                onClick={handleCopyGenStats}
                className="p-0.5 hover:bg-muted rounded transition-colors"
                title="Copy full debug info"
              >
                <Copy
                  className={`w-3 h-3 ${copiedStats ? 'text-green-500' : 'text-muted-foreground'}`}
                />
              </button>
            </div>
          )}
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

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { AnimationScript } from './types'
import { computeCanvasState, extractTransient } from './canvasReducer'
import { useSceneSequencer } from './useSceneSequencer'
import { useVoice } from '../hooks/useVoice'
import Stage from './Stage'
import Controls from './Controls'

interface AnimationRendererProps {
  script: AnimationScript
  onClose: () => void
}

export default function AnimationRenderer({ script, onClose }: AnimationRendererProps) {
  const [mode, setMode] = useState<'overview' | 'deepdive'>('overview')
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null)
  const [narrate, setNarrate] = useState(true)

  const { speak, cancelSpeak } = useVoice()

  const activeComponent = useMemo(
    () => script.components.find(c => c.character_id === activeComponentId) ?? null,
    [script.components, activeComponentId]
  )

  const currentScenes = useMemo(() => {
    if (mode === 'deepdive' && activeComponent) return activeComponent.deep_dive.scenes
    return script.overview.scenes
  }, [mode, activeComponent, script.overview.scenes])

  const {
    index, scene, progress, playing, play, pause, next, prev, restart, isComplete,
  } = useSceneSequencer(currentScenes, { autoplay: true })

  const canvas = useMemo(() => computeCanvasState(currentScenes, index), [currentScenes, index])
  const transient = useMemo(() => extractTransient(currentScenes[index]), [currentScenes, index])

  const lastNarratedSceneId = useRef<string | null>(null)

  // Speak the current scene's narration when the scene changes, if narrate is on.
  useEffect(() => {
    if (!narrate || !scene) return
    if (lastNarratedSceneId.current === scene.scene_id) return
    lastNarratedSceneId.current = scene.scene_id
    if (scene.narration?.text) speak(scene.narration.text)
  }, [scene, narrate, speak])

  useEffect(() => {
    if (!playing) cancelSpeak()
  }, [playing, cancelSpeak])

  useEffect(() => {
    // Cancel narration on mode switch and unmount.
    return () => cancelSpeak()
  }, [mode, cancelSpeak])

  const handlePlayPause = () => {
    if (playing) { pause(); cancelSpeak() } else { play() }
  }

  const handlePrev = () => { cancelSpeak(); prev() }
  const handleNext = () => { cancelSpeak(); next() }
  const handleRestart = () => { cancelSpeak(); restart() }
  const handleToggleNarrate = () => {
    setNarrate(n => {
      if (n) cancelSpeak()
      return !n
    })
  }

  const handleEnterDeepDive = (characterId: string) => {
    const comp = script.components.find(c => c.character_id === characterId)
    if (!comp || comp.deep_dive.scenes.length === 0) return
    cancelSpeak()
    lastNarratedSceneId.current = null
    setActiveComponentId(characterId)
    setMode('deepdive')
  }

  const handleExitDeepDive = () => {
    cancelSpeak()
    lastNarratedSceneId.current = null
    setActiveComponentId(null)
    setMode('overview')
  }

  const handleClose = () => {
    cancelSpeak()
    onClose()
  }

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {mode === 'deepdive' && (
        <button
          onClick={handleExitDeepDive}
          className="self-start flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium tracking-wide uppercase transition-all duration-200"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to overview
        </button>
      )}

      <div className="flex-1 min-h-0">
        <Stage
          canvas={canvas}
          transient={transient}
          components={script.components}
          mode={mode}
          onEnterDeepDive={handleEnterDeepDive}
          showHotspots={isComplete || mode === 'deepdive'}
        />
      </div>

      <div
        className="min-h-[3rem] px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-[#c6c6c8] text-left leading-relaxed"
        data-testid="animation-caption"
      >
        {scene?.narration?.text ?? ''}
      </div>

      <Controls
        playing={playing}
        progress={progress}
        narrate={narrate}
        onPlayPause={handlePlayPause}
        onPrev={handlePrev}
        onNext={handleNext}
        onRestart={handleRestart}
        onToggleNarrate={handleToggleNarrate}
      />

      <button
        onClick={handleClose}
        className="self-center px-8 py-3.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 text-white/70 font-medium text-sm tracking-wider uppercase transition-all duration-200"
      >
        Close
      </button>
    </div>
  )
}

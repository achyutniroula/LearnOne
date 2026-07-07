import { useCallback, useEffect, useRef, useState } from 'react'
import type { Scene } from './types'

export type SequencerPhase = 'pausing' | 'playing'

export interface UseSceneSequencerReturn {
  index: number
  scene: Scene | undefined
  progress: number
  playing: boolean
  phase: SequencerPhase
  play: () => void
  pause: () => void
  next: () => void
  prev: () => void
  restart: () => void
  seekTo: (i: number) => void
  isComplete: boolean
}

export interface UseSceneSequencerOpts {
  autoplay?: boolean
  onComplete?: () => void
}

/**
 * Drives scene-by-scene timed playback using a requestAnimationFrame delta
 * accumulator (not setTimeout chains) so pause/resume is clean and drift-free.
 */
export function useSceneSequencer(scenes: Scene[], opts: UseSceneSequencerOpts = {}): UseSceneSequencerReturn {
  const { autoplay = false, onComplete } = opts

  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<SequencerPhase>('playing')
  const [playing, setPlaying] = useState(autoplay)
  const [isComplete, setIsComplete] = useState(false)

  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Reset whenever the underlying scene list identity changes.
  useEffect(() => {
    setIndex(0)
    setProgress(0)
    elapsedRef.current = 0
    lastTsRef.current = null
    setIsComplete(false)
    const first = scenes[0]
    setPhase(first?.narration?.pause_before_ms && first.narration.pause_before_ms > 0 ? 'pausing' : 'playing')
    setPlaying(autoplay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes])

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    lastTsRef.current = null
  }, [])

  useEffect(() => {
    if (!playing || isComplete || scenes.length === 0) {
      stopLoop()
      return
    }

    const tick = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts
      const delta = ts - lastTsRef.current
      lastTsRef.current = ts
      elapsedRef.current += delta

      const scene = scenes[index]
      if (!scene) { stopLoop(); return }
      const pauseMs = scene.narration?.pause_before_ms && scene.narration.pause_before_ms > 0
        ? scene.narration.pause_before_ms
        : 0
      const durationMs = Math.max(1, scene.duration_ms ?? 2000)
      const total = pauseMs + durationMs

      if (elapsedRef.current < pauseMs) {
        setPhase('pausing')
        setProgress(0)
      } else {
        setPhase('playing')
        const playElapsed = elapsedRef.current - pauseMs
        setProgress(Math.min(1, playElapsed / durationMs))
      }

      if (elapsedRef.current >= total) {
        if (index >= scenes.length - 1) {
          setIsComplete(true)
          setPlaying(false)
          stopLoop()
          onCompleteRef.current?.()
          return
        }
        elapsedRef.current = 0
        lastTsRef.current = null
        const nextScene = scenes[index + 1]
        setPhase(nextScene?.narration?.pause_before_ms && nextScene.narration.pause_before_ms > 0 ? 'pausing' : 'playing')
        setProgress(0)
        setIndex(i => i + 1)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return stopLoop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index, scenes, isComplete, stopLoop])

  // Pause on tab hide; resume is user-initiated only (via play()).
  useEffect(() => {
    const fn = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', fn)
    return () => document.removeEventListener('visibilitychange', fn)
  }, [])

  useEffect(() => stopLoop, [stopLoop])

  const play = useCallback(() => {
    if (isComplete) return
    lastTsRef.current = null
    setPlaying(true)
  }, [isComplete])

  const pause = useCallback(() => {
    setPlaying(false)
  }, [])

  const seekTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(scenes.length - 1, i))
    elapsedRef.current = 0
    lastTsRef.current = null
    setIndex(clamped)
    setProgress(0)
    setIsComplete(false)
    const scene = scenes[clamped]
    setPhase(scene?.narration?.pause_before_ms && scene.narration.pause_before_ms > 0 ? 'pausing' : 'playing')
  }, [scenes])

  const next = useCallback(() => {
    seekTo(index + 1 >= scenes.length ? scenes.length - 1 : index + 1)
  }, [index, scenes.length, seekTo])

  const prev = useCallback(() => {
    seekTo(index - 1 < 0 ? 0 : index - 1)
  }, [index, seekTo])

  const restart = useCallback(() => {
    seekTo(0)
    setPlaying(true)
  }, [seekTo])

  return {
    index,
    scene: scenes[index],
    progress,
    playing,
    phase,
    play,
    pause,
    next,
    prev,
    restart,
    seekTo,
    isComplete,
  }
}

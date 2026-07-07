import { Play, Pause, SkipBack, SkipForward, RotateCcw, Volume2, VolumeX } from 'lucide-react'

interface ControlsProps {
  playing: boolean
  progress: number
  narrate: boolean
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  onRestart: () => void
  onToggleNarrate: () => void
}

export default function Controls({
  playing, progress, narrate, onPlayPause, onPrev, onNext, onRestart, onToggleNarrate,
}: ControlsProps) {
  return (
    <div className="w-full flex flex-col gap-2.5">
      <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-white/60 transition-[width] duration-100 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onRestart}
          aria-label="Restart"
          className="p-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={onPrev}
          aria-label="Previous scene"
          className="p-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={onPlayPause}
          aria-label={playing ? 'Pause' : 'Play'}
          className="btn-primary px-6 py-2.5"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={onNext}
          aria-label="Next scene"
          className="p-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200"
        >
          <SkipForward className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleNarrate}
          aria-label={narrate ? 'Mute narration' : 'Enable narration'}
          className="p-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200"
        >
          {narrate ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

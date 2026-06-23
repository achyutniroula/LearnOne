import { useState, useRef, ChangeEvent, FormEvent, useCallback, useEffect } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import VoiceControl from './VoiceControl'
import type { UseVoiceReturn } from '../../hooks/useVoice'

const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

interface PendingImage {
  data: string
  mediaType: string
  preview: string
}

export interface LeonInputBarProps {
  onSend: (text: string, imageData?: string, imageMediaType?: string) => void
  disabled: boolean
  voice: UseVoiceReturn
  // cancelSpeak and speaking are available through voice; kept in props for
  // forward-compatibility if callers need to pass overrides.
  cancelSpeak?: () => void
  speaking?: boolean
}

export default function LeonInputBar({ onSend, disabled, voice }: LeonInputBarProps) {
  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Voice path submits text only — image attach is a deliberate separate action.
  // Passing pendingImage here would capture it as a stale closure when mic opens.
  const handleFinalTranscript = useCallback(
    (transcript: string) => {
      if (!transcript.trim()) return
      onSend(transcript.trim())
    },
    [onSend]
  )

  // Keep input focused after voice interaction
  useEffect(() => {
    if (!voice.listening) {
      inputRef.current?.focus()
    }
  }, [voice.listening])

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setImageError(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError('Use JPEG, PNG, GIF, or WebP.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image must be under 3 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setPendingImage({
        data: dataUrl.split(',')[1],
        mediaType: file.type,
        preview: dataUrl,
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!input.trim() || disabled) return
    onSend(input.trim(), pendingImage?.data, pendingImage?.mediaType)
    setInput('')
    setPendingImage(null)
  }

  return (
    <div className="flex flex-col gap-1">
      {/* ── Image preview strip ───────────────────────────────────────── */}
      <AnimatePresence>
        {pendingImage && (
          <motion.div
            key="img-preview"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="flex items-center gap-3 px-1 py-2"
              style={{ borderTop: '1px solid var(--glass-border)' }}
            >
              <img
                src={pendingImage.preview}
                alt="preview"
                className="h-10 w-10 object-cover rounded-lg flex-shrink-0"
              />
              <span
                className="text-xs flex-1 truncate"
                style={{ color: 'var(--on-muted)' }}
              >
                {pendingImage.mediaType}
              </span>
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="btn-ghost p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {imageError && (
        <p className="text-xs px-1" style={{ color: 'var(--error)' }}>
          {imageError}
        </p>
      )}

      {/* ── Input row ─────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2"
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Voice control (mic + stop-speak) */}
        <VoiceControl
          voice={voice}
          onFinalTranscript={handleFinalTranscript}
          disabled={disabled}
        />

        {/* Text input */}
        <input
          ref={inputRef}
          className="input-base"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={voice.listening ? 'Listening…' : 'Ask LEON anything about this repo…'}
          disabled={disabled || voice.listening}
          autoFocus
        />

        {/* Attach image */}
        <button
          type="button"
          onClick={() => { setImageError(null); fileInputRef.current?.click() }}
          className="btn-ghost p-2.5 flex-shrink-0"
          title="Attach image"
          disabled={disabled}
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Send */}
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="btn-primary px-4 py-2.5 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}

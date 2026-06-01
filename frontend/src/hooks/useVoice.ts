import { useState, useEffect, useRef, useCallback } from 'react'
import { getToken } from '../api/api'

export interface UseVoiceReturn {
  supported: boolean
  listening: boolean
  speaking: boolean
  interimTranscript: string
  micError: string | null
  startListening: (onFinal: (transcript: string) => void) => void
  stopListening: () => void
  speak: (text: string) => void
  cancelSpeak: () => void
}

const SPEECH_MIN_RMS    = 0.010  // absolute floor — never triggers below this
const SPEECH_SNR_RATIO  = 2.5   // voice must be N× background to count as speech
const SPEECH_CONFIRM_MS = 200   // must sustain above threshold this long (filters coughs/clicks)
const SILENCE_AFTER_MS  = 1200  // ms of quiet after confirmed speech → send
const MAX_WAIT_MS       = 20000 // give up if no speech detected in this window

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/_{1,2}([^_\n]+)_{1,2}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function bestMimeType(): string {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export function useVoice(): UseVoiceReturn {
  const supported = typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    typeof MediaRecorder !== 'undefined'

  const [listening, setListening]       = useState(false)
  const [speaking, setSpeaking]         = useState(false)
  const [interimTranscript, setInterim] = useState('')
  const [micError, setMicError]         = useState<string | null>(null)

  const recorderRef   = useRef<MediaRecorder | null>(null)
  const chunksRef     = useRef<Blob[]>([])
  const streamRef     = useRef<MediaStream | null>(null)
  const audioCtxRef   = useRef<AudioContext | null>(null)
  const rafRef        = useRef<number>(0)
  const voiceAbortRef = useRef<AbortController | null>(null)

  // ── Cancel TTS ────────────────────────────────────────────────────────────
  const cancelSpeak = useCallback(() => {
    voiceAbortRef.current?.abort()
    voiceAbortRef.current = null
    window.speechSynthesis?.cancel()  // clears the utterance queue
    setSpeaking(false)
  }, [])

  // ── Tear down mic + VAD ───────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
    setListening(false)
    setInterim('')
  }, [])

  // ── Start listening with barge-in support ─────────────────────────────────
  //
  // Key design: the mic opens immediately (VAD watching), but the MediaRecorder
  // only starts when the user's speech is first detected. This means:
  //   • While LEON is talking, the mic is already open — barge-in fires instantly.
  //   • The recording captures only the user's voice, not LEON's TTS output.
  //   • cancelSpeak() is called the moment user speech is detected, not before.
  //
  const startListening = useCallback(
    (onFinal: (transcript: string) => void) => {
      stopListening()
      setMicError(null)

      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
          streamRef.current = stream

          const mime      = bestMimeType()
          const audioCtx  = new AudioContext()
          audioCtxRef.current = audioCtx
          const source    = audioCtx.createMediaStreamSource(stream)
          const analyser  = audioCtx.createAnalyser()
          analyser.fftSize = 512
          source.connect(analyser)
          const buf = new Float32Array(analyser.fftSize)

          let hasSpeech        = false
          let silenceFrom: number | null = null
          let speechConfirmAt: number | null = null
          let waitStart        = Date.now()
          let bgRms            = 0.005  // adaptive noise floor — starts low, rises to ambient

          const tick = () => {
            analyser.getFloatTimeDomainData(buf)
            const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length)

            // Slowly track background noise (only while not in confirmed speech)
            if (!hasSpeech) bgRms = 0.995 * bgRms + 0.005 * rms

            // Dynamic threshold: higher of absolute floor vs N× ambient noise
            const threshold = Math.max(SPEECH_MIN_RMS, bgRms * SPEECH_SNR_RATIO)
            const isSpeech  = rms > threshold

            if (isSpeech) {
              if (speechConfirmAt === null) speechConfirmAt = Date.now()
              const confirmedMs = Date.now() - speechConfirmAt

              if (!hasSpeech && confirmedMs >= SPEECH_CONFIRM_MS) {
                // ── Confirmed real speech → barge-in ────────────────────
                hasSpeech = true
                cancelSpeak()
                const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
                chunksRef.current = []
                recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
                recorder.onstop = async () => {
                  cancelAnimationFrame(rafRef.current)
                  stream.getTracks().forEach(t => t.stop())
                  audioCtx.close().catch(() => {})
                  const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' })
                  chunksRef.current = []
                  if (blob.size < 500) { setListening(false); setInterim(''); return }
                  setInterim('Transcribing…')   // keep listening=true so orb stays active
                  try {
                    const form = new FormData()
                    form.append('audio', blob, 'recording.webm')
                    const res = await fetch('/api/leon/transcribe', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${getToken()}` },
                      body: form,
                    })
                    if (!res.ok) throw new Error('failed')
                    const { transcript } = await res.json() as { transcript: string }
                    setListening(false); setInterim('')
                    if (transcript?.trim()) onFinal(transcript.trim())
                  } catch {
                    setListening(false); setInterim('')
                    setMicError('Transcription failed — try again.')
                  }
                }
                recorder.start(100)
                recorderRef.current = recorder
              }

              if (hasSpeech) {
                silenceFrom = null
                setInterim('Listening…')
              }

            } else {
              // Below threshold — reset confirmation window
              if (!hasSpeech) speechConfirmAt = null

              if (hasSpeech) {
                // ── Counting silence after confirmed speech ────────────────
                if (silenceFrom === null) silenceFrom = Date.now()
                const elapsed = Date.now() - silenceFrom
                const secs    = Math.max(0, Math.ceil((SILENCE_AFTER_MS - elapsed) / 1000))
                setInterim(secs > 0 ? `Done in ${secs}s…` : 'Sending…')
                if (elapsed >= SILENCE_AFTER_MS) {
                  recorderRef.current?.stop()
                  return
                }
              } else {
                // ── Waiting for first speech ───────────────────────────────
                setInterim('Listening…')
                if (Date.now() - waitStart > MAX_WAIT_MS) {
                  stopListening()
                  return
                }
              }
            }

            rafRef.current = requestAnimationFrame(tick)
          }

          rafRef.current = requestAnimationFrame(tick)
          setListening(true)
          setInterim('Listening…')
        })
        .catch((err: unknown) => {
          const name = (err as DOMException).name
          setMicError(
            name === 'NotAllowedError' ? 'Microphone access denied — allow it in the address bar.' :
            name === 'NotFoundError'   ? 'No microphone found.' :
            'Could not access microphone.'
          )
        })
    },
    [cancelSpeak, stopListening]
  )

  // ── Voice selection ───────────────────────────────────────────────────────
  // Priority: Microsoft Natural (Aria/Jenny) → known female names → Google → any English
  const FEMALE_NAMES = ['aria', 'jenny', 'sara', 'sarah', 'zira', 'samantha', 'victoria',
                        'karen', 'moira', 'fiona', 'allison', 'ava', 'susan', 'natasha']

  function pickVoice(): SpeechSynthesisVoice | null {
    const all = window.speechSynthesis.getVoices()
    const en  = all.filter(v => v.lang.startsWith('en'))
    if (!en.length) return null
    return (
      en.find(v => /natural|neural/i.test(v.name)) ??
      en.find(v => FEMALE_NAMES.some(n => v.name.toLowerCase().includes(n))) ??
      en.find(v => /google/i.test(v.name)) ??
      en[0]
    )
  }

  // ── TTS — sentence-by-sentence for natural prosody ────────────────────────
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    cancelSpeak()
    const cleaned = stripMarkdown(text)
    if (!cleaned) return

    // Split into sentences so each utterance gets fresh prosody (sounds human)
    const sentences = cleaned.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g)
      ?.map(s => s.trim()).filter(s => s.length > 1) ?? [cleaned]

    let idx = 0
    let cancelled = false

    const speakNext = (voice: SpeechSynthesisVoice | null) => {
      if (cancelled || idx >= sentences.length) { setSpeaking(false); return }
      const utt    = new SpeechSynthesisUtterance(sentences[idx++])
      utt.voice    = voice
      utt.rate     = 0.88   // calm, measured pace
      utt.pitch    = 1.06   // slightly higher — softer, less robotic
      utt.volume   = 1.0
      utt.onend    = () => speakNext(voice)
      utt.onerror  = () => { if (!cancelled) setSpeaking(false) }
      window.speechSynthesis.speak(utt)
    }

    // Store a cancel flag so ongoing chain stops when cancelSpeak fires
    const prevAbort = voiceAbortRef.current
    const ac = new AbortController()
    voiceAbortRef.current = ac
    ac.signal.addEventListener('abort', () => { cancelled = true })
    prevAbort?.abort()

    const doSpeak = () => {
      setSpeaking(true)
      speakNext(pickVoice())
    }

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true, signal: ac.signal })
    } else {
      doSpeak()
    }
  }, [cancelSpeak])

  // ── Pause TTS on tab hide ─────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => { if (document.hidden) { window.speechSynthesis?.cancel(); setSpeaking(false) } }
    document.addEventListener('visibilitychange', fn)
    return () => document.removeEventListener('visibilitychange', fn)
  }, [])

  useEffect(() => {
    return () => { stopListening(); window.speechSynthesis?.cancel() }
  }, [stopListening])

  return { supported, listening, speaking, interimTranscript, micError, startListening, stopListening, speak, cancelSpeak }
}

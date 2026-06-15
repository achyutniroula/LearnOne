import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle } from 'lucide-react'
import { getToken } from '../../api/api'
import LeonOrb from './LeonOrb'
import type { OrbState } from '../../hooks/useLeonState'

interface VoiceSessionProps {
  sessionId: number
  onClose: () => void
}

type SessionStatus = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

export default function VoiceSession({ sessionId, onClose }: VoiceSessionProps) {
  const [status, setStatus] = useState<SessionStatus>('connecting')
  const [errorMsg, setErrorMsg] = useState('')
  const [userTranscript, setUserTranscript] = useState('')
  const [modelTranscript, setModelTranscript] = useState('')

  const socketRef = useRef<WebSocket | null>(null)
  const wsUrlRef = useRef<string>('')
  const intentionalCloseRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const MAX_RECONNECTS = 3

  // Audio Playback references
  const playAudioContextRef = useRef<AudioContext | null>(null)
  const nextStartTimeRef = useRef<number>(0)
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])

  // Audio Recording references
  const recordAudioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)

  // Track status transitions based on playback/recording
  const statusRef = useRef<SessionStatus>('connecting')
  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setStatus('error')
      setErrorMsg('Not authenticated. Please log in.')
      return
    }

    // Build WebSocket URL
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    let wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    let host = window.location.host

    if (baseUrl) {
      const match = baseUrl.match(/^(https?:)\/\/(.+)$/)
      if (match) {
        wsProtocol = match[1] === 'https:' ? 'wss:' : 'ws:'
        host = match[2]
      }
    }
    const cleanedHost = host.replace(/\/$/, '')
    const wsUrl = `${wsProtocol}//${cleanedHost}/ws/sessions/${sessionId}/voice?token=${encodeURIComponent(token)}`
    wsUrlRef.current = wsUrl

    // Named function so it can be called for reconnection
    const connectWebSocket = (url: string) => {
      const ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      socketRef.current = ws

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0
        handleInterrupted()
        setStatus('listening')
        startRecording(ws)
      }

      ws.onmessage = async (event) => {
        // Handle binary audio chunks from Gemini Live
        if (event.data instanceof ArrayBuffer) {
          setStatus('speaking')
          playAudioChunk(event.data)
          return
        }

        // Handle JSON text events
        try {
          const data = JSON.parse(event.data)
          switch (data.event) {
            case 'thinking':
              setStatus('thinking')
              setModelTranscript('Let me think...')
              break
            case 'thinking_complete':
              setStatus('speaking')
              break
            case 'interrupted':
              handleInterrupted()
              setStatus('listening')
              setUserTranscript('(Interrupted)')
              setModelTranscript('')
              break
            case 'model_transcript':
              setStatus('speaking')
              setModelTranscript((prev) => prev === 'Let me think...' ? data.text : prev + data.text)
              break
            case 'user_transcript':
              setUserTranscript(data.text)
              break
            case 'turn_complete':
              setStatus('listening')
              // Reset local transcripts for next turn
              setUserTranscript('')
              setModelTranscript('')
              break
          }
        } catch (err) {
          console.error('Failed to parse WebSocket JSON message', err)
        }
      }

      ws.onerror = (err) => {
        console.error('WebSocket error occurred', err)
        setStatus('error')
        setErrorMsg('Failed to establish voice session connection.')
      }

      ws.onclose = (event) => {
        if (event.code === 1008) {
          setStatus('error')
          setErrorMsg('Session expired or authentication failed.')
        } else if (!intentionalCloseRef.current && reconnectAttemptsRef.current < MAX_RECONNECTS) {
          reconnectAttemptsRef.current += 1
          setTimeout(() => {
            if (!intentionalCloseRef.current) {
              connectWebSocket(wsUrlRef.current)
            }
          }, 1000)
        } else if (!intentionalCloseRef.current && statusRef.current !== 'error') {
          onClose()
        }
      }
    }

    intentionalCloseRef.current = false
    reconnectAttemptsRef.current = 0
    connectWebSocket(wsUrl)

    return () => {
      intentionalCloseRef.current = true
      cleanup()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Capture mic audio at 16kHz
  const startRecording = async (ws: WebSocket) => {
    // Tear down any previous recording resources before starting new ones (reconnect path)
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect()
      processorNodeRef.current = null
    }
    if (recordAudioContextRef.current) {
      recordAudioContextRef.current.close()
      recordAudioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const recordCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
      recordAudioContextRef.current = recordCtx

      const source = recordCtx.createMediaStreamSource(stream)
      // Buffer size 2048, 1 input channel, 1 output channel
      const processor = recordCtx.createScriptProcessor(2048, 1, 1)
      processorNodeRef.current = processor

      source.connect(processor)
      processor.connect(recordCtx.destination)

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return
        const inputData = e.inputBuffer.getChannelData(0)

        // Convert Float32Array to 16-bit PCM Int16Array
        const pcmBuffer = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Send binary arraybuffer
        ws.send(pcmBuffer.buffer)
      }
    } catch (err) {
      console.error('Failed to access microphone', err)
      setStatus('error')
      setErrorMsg('Microphone access denied. Please allow microphone permissions and reload.')
    }
  }

  // Play 24kHz PCM audio chunks smoothly via scheduling queue
  const playAudioChunk = (arrayBuffer: ArrayBuffer) => {
    if (!playAudioContextRef.current) {
      playAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })
    }
    const ctx = playAudioContextRef.current
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const int16Array = new Int16Array(arrayBuffer)
    const float32Array = new Float32Array(int16Array.length)
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0
    }

    const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000)
    audioBuffer.getChannelData(0).set(float32Array)

    const sourceNode = ctx.createBufferSource()
    sourceNode.buffer = audioBuffer
    sourceNode.connect(ctx.destination)

    const currentTime = ctx.currentTime
    const startTime = Math.max(currentTime, nextStartTimeRef.current)
    sourceNode.start(startTime)
    nextStartTimeRef.current = startTime + audioBuffer.duration

    activeSourcesRef.current.push(sourceNode)

    sourceNode.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((node) => node !== sourceNode)
      // Check if all queued sources finished speaking to transition state
      if (activeSourcesRef.current.length === 0 && statusRef.current === 'speaking') {
        setStatus('listening')
      }
    }
  }

  // Stop playback instantly on interruption
  const handleInterrupted = () => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop()
      } catch (e) {
        // Source already stopped
      }
    })
    activeSourcesRef.current = []
    nextStartTimeRef.current = 0
  }

  const cleanup = () => {
    // Close WebSocket
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    // Stop recording
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect()
      processorNodeRef.current = null
    }
    if (recordAudioContextRef.current) {
      recordAudioContextRef.current.close()
      recordAudioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    // Stop playback
    handleInterrupted()
    if (playAudioContextRef.current) {
      playAudioContextRef.current.close()
      playAudioContextRef.current = null
    }
  }

  const getOrbState = (s: SessionStatus): OrbState => {
    if (s === 'listening') return 'listening'
    if (s === 'thinking') return 'thinking'
    if (s === 'speaking') return 'speaking'
    return 'idle'
  }

  const statusLabels: Record<SessionStatus, string> = {
    connecting: 'Establishing secure link...',
    listening: 'Listening... (Speak to LearnOne)',
    thinking: 'Reasoning...',
    speaking: 'Speaking...',
    error: 'Session Interrupted'
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-[#09090b]/95 backdrop-blur-xl">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb-blue opacity-30" />
        <div className="orb-purple opacity-30" />
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Main interaction sphere area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-10 w-full max-w-xl text-center relative">

        {/* User live subtitle transcript */}
        <div className="h-16 flex items-end justify-center px-4 w-full">
          <AnimatePresence mode="wait">
            {userTranscript && (
              <motion.p
                key="user-transcript"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 0.7, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm italic font-light text-[#c6c6c8]"
              >
                "{userTranscript}"
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Dynamic Orb */}
        <div className="relative flex items-center justify-center">
          <LeonOrb state={getOrbState(status)} size="hero" />
        </div>

        {/* Status text */}
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8e8e93] font-medium">
            {statusLabels[status]}
          </p>
        </div>

        {/* Model speech transcript display */}
        <div className="h-28 overflow-y-auto px-6 w-full text-[#e2e2e8] text-base font-light leading-relaxed no-scrollbar select-none">
          <AnimatePresence mode="wait">
            {modelTranscript && (
              <motion.p
                key="model-transcript"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-h-full"
              >
                {modelTranscript}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Error state alert overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <div className="glass-card-static max-w-sm p-6 flex flex-col items-center text-center gap-4">
            <AlertTriangle className="w-12 h-12 text-red-400" />
            <h3 className="text-lg font-medium text-white">Voice Connection Error</h3>
            <p className="text-xs text-[#c6c6c8] leading-relaxed">{errorMsg}</p>
            <button
              onClick={onClose}
              className="btn-primary w-full py-2.5 mt-2 bg-red-600/90 border-red-500/30 hover:bg-red-600"
            >
              Close voice session
            </button>
          </div>
        </div>
      )}

      {/* Primary Action Button */}
      {status !== 'error' && (
        <div className="pb-12">
          <button
            onClick={onClose}
            className="px-8 py-3.5 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-200 font-medium text-sm tracking-wider uppercase shadow-[0_0_24px_rgba(239,68,68,0.15)] hover:shadow-[0_0_32px_rgba(239,68,68,0.25)] transition-all duration-200"
          >
            End voice session
          </button>
        </div>
      )}
    </div>
  )
}

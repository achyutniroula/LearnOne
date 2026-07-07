// Pure functions — no React — that fold a scene list into derived canvas state.
import type {
  Scene, CanvasState, CharacterState, ConnectionState, TransientEffect,
} from './types'

const IDENTITY_CAMERA = { scale: 1, cx: 0.5, cy: 0.5 }

export function initialCanvasState(): CanvasState {
  return {
    background: 'dark',
    characters: [],
    connections: [],
    camera: { ...IDENTITY_CAMERA },
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * Folds all PERSISTENT animation effects from scenes[0..uptoIndex] (inclusive)
 * into a CanvasState. Fails soft on malformed data — never throws.
 */
export function computeCanvasState(scenes: Scene[], uptoIndex: number): CanvasState {
  const state: CanvasState = initialCanvasState()
  if (!Array.isArray(scenes)) return state

  const end = Math.min(uptoIndex, scenes.length - 1)
  for (let i = 0; i <= end; i++) {
    const scene = scenes[i]
    if (!scene || typeof scene !== 'object') continue
    const anim = scene.animation
    if (!anim || typeof anim !== 'object') continue

    try {
      switch (anim.type) {
        case 'set_background': {
          if (anim.style === 'whiteboard' || anim.style === 'dark' || anim.style === 'blueprint') {
            state.background = anim.style
          }
          break
        }
        case 'appear_character': {
          if (!anim.id) break
          const next: CharacterState = {
            id: anim.id,
            label: anim.label ?? anim.id,
            icon: anim.icon ?? 'file',
            color: anim.color ?? 'blue',
            x: anim.position?.x ?? 0.5,
            y: anim.position?.y ?? 0.5,
          }
          const existingIdx = state.characters.findIndex(c => c.id === next.id)
          if (existingIdx >= 0) {
            const prevAnnotation = state.characters[existingIdx].annotation
            state.characters[existingIdx] = { ...next, annotation: prevAnnotation }
          } else {
            state.characters.push(next)
          }
          break
        }
        case 'label_character': {
          const target = state.characters.find(c => c.id === anim.id)
          if (target) target.annotation = anim.annotation
          break
        }
        case 'draw_connection': {
          if (!anim.from || !anim.to) break
          state.connections.push({
            from: anim.from,
            to: anim.to,
            label: anim.label,
            style: anim.style ?? 'solid',
            direction: anim.direction ?? 'one_way',
          })
          break
        }
        case 'zoom_to': {
          const target = state.characters.find(c => c.id === anim.target_id)
          if (target) {
            state.camera = {
              scale: clamp(anim.scale ?? 1.5, 1, 2.5),
              cx: clamp(target.x, 0, 1),
              cy: clamp(target.y, 0, 1),
            }
          }
          break
        }
        case 'zoom_out': {
          state.camera = { ...IDENTITY_CAMERA }
          break
        }
        default:
          break
      }
    } catch {
      // Fail soft — skip this scene's persistent effect.
    }
  }

  return state
}

/**
 * Maps the current scene's animation to a TransientEffect, if it's one of the
 * 9 transient types. Malformed/unknown animation objects fail soft to null.
 */
export function extractTransient(scene: Scene | undefined | null): TransientEffect | null {
  if (!scene || typeof scene !== 'object') return null
  const anim = scene.animation
  if (!anim || typeof anim !== 'object') return null

  try {
    switch (anim.type) {
      case 'fade_in_title':
        return { kind: 'title', title: anim.title ?? '', subtitle: anim.subtitle ?? '' }
      case 'highlight_character':
        if (!anim.id) return null
        return { kind: 'highlight_character', id: anim.id, pulse: !!anim.pulse }
      case 'highlight_connection':
        if (!anim.from || !anim.to) return null
        return { kind: 'highlight_connection', from: anim.from, to: anim.to }
      case 'animate_flow':
        if (!anim.connection_id) return null
        return { kind: 'animate_flow', connectionId: anim.connection_id, particle: anim.particle ?? 'data' }
      case 'spotlight':
        if (!anim.target_id) return null
        return { kind: 'spotlight', targetId: anim.target_id, dimOthers: !!anim.dim_others }
      case 'reveal_code':
        if (!anim.file || !Array.isArray(anim.lines) || anim.lines.length !== 2) return null
        return { kind: 'reveal_code', file: anim.file, lines: [anim.lines[0], anim.lines[1]], annotation: anim.annotation ?? '' }
      case 'show_callout':
        if (!anim.text || !anim.target_id) return null
        return { kind: 'callout', text: anim.text, targetId: anim.target_id, style: anim.style ?? 'label' }
      case 'show_analogy':
        if (!anim.text || !anim.icon) return null
        return { kind: 'analogy', text: anim.text, icon: anim.icon }
      case 'step_sequence':
        if (!Array.isArray(anim.steps)) return null
        return { kind: 'step_sequence', steps: anim.steps, style: anim.style ?? 'numbered' }
      default:
        return null
    }
  } catch {
    return null
  }
}

/**
 * Heuristic matcher for animate_flow's `connection_id`, which has no explicit
 * `id` field on the persistent connections list. Tries `${from}-${to}` and
 * `${from}->${to}` conventions, then falls back to substring matching against
 * from/to ids. Returns null (silent no-op) if nothing matches.
 */
export function resolveConnectionId(connections: ConnectionState[], connectionId: string): ConnectionState | null {
  if (!connectionId || !Array.isArray(connections)) return null

  for (const conn of connections) {
    if (`${conn.from}-${conn.to}` === connectionId) return conn
    if (`${conn.from}->${conn.to}` === connectionId) return conn
    if (`${conn.to}-${conn.from}` === connectionId) return conn
    if (`${conn.to}->${conn.from}` === connectionId) return conn
  }

  const lower = connectionId.toLowerCase()
  for (const conn of connections) {
    if (lower.includes(conn.from.toLowerCase()) && lower.includes(conn.to.toLowerCase())) {
      return conn
    }
  }

  if (import.meta.env.DEV) {
    console.warn(`resolveConnectionId: no match for "${connectionId}" among`, connections)
  }
  return null
}

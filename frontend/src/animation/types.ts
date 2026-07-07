// Types describing the AnimationScript JSON produced by the backend scriptwriter,
// plus the derived internal state types used by the renderer.

export type IconName = 'browser' | 'server' | 'database' | 'cache' | 'ai' | 'user' | 'queue' | 'file'
export type CharColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal'
export type BackgroundStyle = 'whiteboard' | 'dark' | 'blueprint'
export type ConnectionStyle = 'solid' | 'dashed' | 'animated'
export type ConnectionDirection = 'one_way' | 'two_way'
export type ParticleKind = 'data' | 'audio' | 'request' | 'response'
export type CalloutStyle = 'thought' | 'speech' | 'label'
export type AnalogyIcon = 'restaurant' | 'airport' | 'postoffice' | 'factory' | 'library'
export type StepSequenceStyle = 'numbered' | 'arrow_chain'

export interface Position {
  x: number
  y: number
}

// ── The 15 discriminated-union animation variants ──────────────────────────

export interface FadeInTitleAnim {
  type: 'fade_in_title'
  title: string
  subtitle: string
}

export interface SetBackgroundAnim {
  type: 'set_background'
  style: BackgroundStyle
}

export interface AppearCharacterAnim {
  type: 'appear_character'
  id: string
  label: string
  icon: IconName
  position: Position
  color: CharColor
}

export interface HighlightCharacterAnim {
  type: 'highlight_character'
  id: string
  pulse: boolean
}

export interface LabelCharacterAnim {
  type: 'label_character'
  id: string
  annotation: string
}

export interface DrawConnectionAnim {
  type: 'draw_connection'
  from: string
  to: string
  label?: string
  style: ConnectionStyle
  direction: ConnectionDirection
}

export interface AnimateFlowAnim {
  type: 'animate_flow'
  connection_id: string
  particle: ParticleKind
}

export interface HighlightConnectionAnim {
  type: 'highlight_connection'
  from: string
  to: string
}

export interface ZoomToAnim {
  type: 'zoom_to'
  target_id: string
  scale: number
}

export interface ZoomOutAnim {
  type: 'zoom_out'
}

export interface SpotlightAnim {
  type: 'spotlight'
  target_id: string
  dim_others: boolean
}

export interface RevealCodeAnim {
  type: 'reveal_code'
  file: string
  lines: [number, number]
  annotation: string
}

export interface ShowCalloutAnim {
  type: 'show_callout'
  text: string
  target_id: string
  style: CalloutStyle
}

export interface ShowAnalogyAnim {
  type: 'show_analogy'
  text: string
  icon: AnalogyIcon
}

export interface StepSequenceAnim {
  type: 'step_sequence'
  steps: string[]
  style: StepSequenceStyle
}

export type Animation =
  | FadeInTitleAnim
  | SetBackgroundAnim
  | AppearCharacterAnim
  | HighlightCharacterAnim
  | LabelCharacterAnim
  | DrawConnectionAnim
  | AnimateFlowAnim
  | HighlightConnectionAnim
  | ZoomToAnim
  | ZoomOutAnim
  | SpotlightAnim
  | RevealCodeAnim
  | ShowCalloutAnim
  | ShowAnalogyAnim
  | StepSequenceAnim

// ── Script shape ────────────────────────────────────────────────────────────

export interface Narration {
  text: string
  delivery?: string
  pause_before_ms?: number
}

export interface Scene {
  scene_id: string
  duration_ms: number
  narration: Narration
  animation: Animation
  canvas_state: string
}

export interface ClickTarget {
  label: string
  position: Position
}

export interface Component {
  character_id: string
  click_target: ClickTarget
  deep_dive: { scenes: Scene[] }
}

export interface Overview {
  total_duration_ms: number
  scenes: Scene[]
}

export interface AnimationScript {
  overview: Overview
  components: Component[]
}

// ── Derived internal state ─────────────────────────────────────────────────

export interface CharacterState {
  id: string
  label: string
  icon: IconName
  color: CharColor
  x: number
  y: number
  annotation?: string
}

export interface ConnectionState {
  from: string
  to: string
  label?: string
  style: ConnectionStyle
  direction: ConnectionDirection
}

export interface CameraState {
  scale: number
  cx: number
  cy: number
}

export interface CanvasState {
  background: BackgroundStyle
  characters: CharacterState[]
  connections: ConnectionState[]
  camera: CameraState
}

// ── Transient effects (camelCase field names) ──────────────────────────────

export interface TitleTransient {
  kind: 'title'
  title: string
  subtitle: string
}

export interface HighlightCharacterTransient {
  kind: 'highlight_character'
  id: string
  pulse: boolean
}

export interface HighlightConnectionTransient {
  kind: 'highlight_connection'
  from: string
  to: string
}

export interface AnimateFlowTransient {
  kind: 'animate_flow'
  connectionId: string
  particle: ParticleKind
}

export interface SpotlightTransient {
  kind: 'spotlight'
  targetId: string
  dimOthers: boolean
}

export interface RevealCodeTransient {
  kind: 'reveal_code'
  file: string
  lines: [number, number]
  annotation: string
}

export interface CalloutTransient {
  kind: 'callout'
  text: string
  targetId: string
  style: CalloutStyle
}

export interface AnalogyTransient {
  kind: 'analogy'
  text: string
  icon: AnalogyIcon
}

export interface StepSequenceTransient {
  kind: 'step_sequence'
  steps: string[]
  style: StepSequenceStyle
}

export type TransientEffect =
  | TitleTransient
  | HighlightCharacterTransient
  | HighlightConnectionTransient
  | AnimateFlowTransient
  | SpotlightTransient
  | RevealCodeTransient
  | CalloutTransient
  | AnalogyTransient
  | StepSequenceTransient

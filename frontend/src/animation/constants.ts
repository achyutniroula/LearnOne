import {
  Globe, Server, Database, Zap, Sparkles, User, Layers, File,
  Utensils, Plane, Mail, Factory, Library,
  type LucideIcon,
} from 'lucide-react'
import type { IconName, CharColor, AnalogyIcon } from './types'

export const ICON_MAP: Record<IconName, LucideIcon> = {
  browser: Globe,
  server: Server,
  database: Database,
  cache: Zap,
  ai: Sparkles,
  user: User,
  queue: Layers,
  file: File,
}

export const ANALOGY_ICON_MAP: Record<AnalogyIcon, LucideIcon> = {
  restaurant: Utensils,
  airport: Plane,
  postoffice: Mail,
  factory: Factory,
  library: Library,
}

interface ColorTokens {
  bg: string
  ring: string
  glow: string
  text: string
}

// rgba-based glow tokens matching the dark glassy aesthetic used by LeonOrb.tsx.
export const COLOR_MAP: Record<CharColor, ColorTokens> = {
  blue:   { bg: 'rgba(80,180,255,0.16)',  ring: 'rgba(80,180,255,0.45)',  glow: 'rgba(80,180,255,0.5)',  text: '#8fd0ff' },
  green:  { bg: 'rgba(60,220,140,0.16)',  ring: 'rgba(60,220,140,0.45)',  glow: 'rgba(60,220,140,0.5)',  text: '#8ff0c8' },
  purple: { bg: 'rgba(180,90,255,0.16)',  ring: 'rgba(180,90,255,0.45)',  glow: 'rgba(180,90,255,0.5)',  text: '#d0aaff' },
  orange: { bg: 'rgba(255,160,60,0.16)',  ring: 'rgba(255,160,60,0.45)',  glow: 'rgba(255,160,60,0.5)',  text: '#ffd0a0' },
  red:    { bg: 'rgba(255,90,90,0.16)',   ring: 'rgba(255,90,90,0.45)',   glow: 'rgba(255,90,90,0.5)',   text: '#ffb0b0' },
  teal:   { bg: 'rgba(0,220,180,0.16)',   ring: 'rgba(0,220,180,0.45)',   glow: 'rgba(0,220,180,0.5)',   text: '#80f0dd' },
}

// Safe inset — normalized 0..1 positions are mapped into an 8%..92% drawable
// window so nodes never clip at the stage edges.
export const SAFE_INSET = 0.08

export function mapPosition(x: number, y: number): { left: string; top: string } {
  const span = 1 - SAFE_INSET * 2
  const px = SAFE_INSET + Math.min(1, Math.max(0, x)) * span
  const py = SAFE_INSET + Math.min(1, Math.max(0, y)) * span
  return { left: `${(px * 100).toFixed(3)}%`, top: `${(py * 100).toFixed(3)}%` }
}

// Same mapping, but returning raw 0..100 numbers for SVG viewBox coordinates.
export function mapPositionSvg(x: number, y: number): { cx: number; cy: number } {
  const span = 1 - SAFE_INSET * 2
  const px = SAFE_INSET + Math.min(1, Math.max(0, x)) * span
  const py = SAFE_INSET + Math.min(1, Math.max(0, y)) * span
  return { cx: px * 100, cy: py * 100 }
}

export type OrbState = 'idle' | 'listening' | 'speaking' | 'thinking'

interface UseLeonStateProps {
  listening: boolean
  loading: boolean   // chat request in flight
  speaking: boolean
}

/**
 * Derives the current orb state from voice/loading signals.
 * Priority: listening > thinking(loading) > speaking > idle
 */
export function useLeonState({ listening, loading, speaking }: UseLeonStateProps): OrbState {
  if (listening) return 'listening'
  if (loading) return 'thinking'
  if (speaking) return 'speaking'
  return 'idle'
}

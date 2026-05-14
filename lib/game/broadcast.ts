import type { RealtimeChannel } from '@supabase/supabase-js'
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'
import type { GameState } from '@/types/game'
import { createClient } from '@/lib/supabase/client'

const BROADCAST_EVENT = 'STATE_UPDATE'

export type GameConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

export function subscribeToGameState(
  sessionId: string,
  onStateUpdate: (state: GameState) => void,
  onStatusChange?: (status: GameConnectionStatus) => void,
  onPresenceJoin?: (presences: { ownerToken?: string }[]) => void,
  onPresenceLeave?: (presences: { ownerToken?: string }[]) => void,
): RealtimeChannel {
  const supabase = createClient()
  const channel = supabase.channel(`game:${sessionId}`, {
    config: { broadcast: { ack: true } },
  })

  channel.on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
    onStateUpdate(payload as GameState)
  })

  if (onPresenceJoin) {
    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      onPresenceJoin(newPresences as { ownerToken?: string }[])
    })
  }

  if (onPresenceLeave) {
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      onPresenceLeave(leftPresences as { ownerToken?: string }[])
    })
  }

  onStatusChange?.('connecting')
  channel.subscribe(status => {
    if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) onStatusChange?.('connected')
    if (status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) onStatusChange?.('reconnecting')
    if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) onStatusChange?.('disconnected')
    if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) onStatusChange?.('error')
  })
  return channel
}

export async function broadcastState(
  channel: RealtimeChannel,
  state: GameState
): Promise<void> {
  const response = await channel.send({ type: 'broadcast', event: BROADCAST_EVENT, payload: state })
  if (response !== 'ok') throw new Error(`Broadcast failed: ${response}`)
}

export async function persistState(sessionId: string, state: GameState): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('sessions')
    .update({ game_state: state, updated_at: state.updatedAt })
    .eq('id', sessionId)
  if (error) throw error
}

export async function hydrateState(sessionId: string): Promise<GameState | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sessions')
    .select('game_state')
    .eq('id', sessionId)
    .single()

  if (error || !data) return null
  return data.game_state as GameState
}

export function unsubscribe(channel: RealtimeChannel): void {
  channel.unsubscribe()
}

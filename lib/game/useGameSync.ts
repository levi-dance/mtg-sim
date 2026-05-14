'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { GameAction } from '@/lib/game/actions'
import { broadcastState, hydrateState, persistState, subscribeToGameState, unsubscribe, type GameConnectionStatus } from '@/lib/game/broadcast'
import { applyAction } from '@/lib/game/reducer'
import { getOrCreateToken } from '@/lib/tokens/identity'
import type { GameState } from '@/types/game'

interface SyncIssue {
  message: string
  timestamp: string
}

interface GameSyncState {
  gameState: GameState | null
  myToken: string
  isLoading: boolean
  connectionStatus: GameConnectionStatus
  pendingSyncs: number
  lastIssue: SyncIssue | null
  dispatch: (action: GameAction) => void
  resetToState: (newState: GameState) => void
}

function shouldApplyState(current: GameState | null, incoming: GameState): boolean {
  if (!incoming.players) return false
  if (!current) return true
  return Date.parse(incoming.updatedAt) >= Date.parse(current.updatedAt)
}

function issueFromError(error: unknown): SyncIssue {
  return {
    message: error instanceof Error ? error.message : 'State sync failed.',
    timestamp: new Date().toISOString(),
  }
}

export function useGameSync(sessionId: string): GameSyncState {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [myToken, setMyToken] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<GameConnectionStatus>('connecting')
  const [pendingSyncs, setPendingSyncs] = useState(0)
  const [lastIssue, setLastIssue] = useState<SyncIssue | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const stateRef = useRef<GameState | null>(null)
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve())

  const applyIncomingState = useCallback((incoming: GameState) => {
    setGameState(current => {
      if (!shouldApplyState(current, incoming)) return current
      stateRef.current = incoming
      return incoming
    })
  }, [])

  // Define dispatch before the useEffect so the effect can close over it directly
  const dispatch = useCallback((action: GameAction) => {
    const current = stateRef.current
    const channel = channelRef.current
    if (!current || !channel) return

    const nextState = applyAction(current, action)
    if (nextState === current) return

    stateRef.current = nextState
    setGameState(nextState)
    setLastIssue(null)
    setPendingSyncs(count => count + 1)

    syncQueueRef.current = syncQueueRef.current
      .then(async () => {
        await broadcastState(channel, nextState)
        await persistState(sessionId, nextState)
      })
      .catch(error => {
        setLastIssue(issueFromError(error))
      })
      .finally(() => {
        setPendingSyncs(count => Math.max(0, count - 1))
      })
  }, [sessionId])

  const resetToState = useCallback((newState: GameState) => {
    const channel = channelRef.current
    if (!channel) return

    stateRef.current = newState
    setGameState(newState)
    setLastIssue(null)
    setPendingSyncs(count => count + 1)

    syncQueueRef.current = syncQueueRef.current
      .then(async () => {
        await broadcastState(channel, newState)
        await persistState(sessionId, newState)
      })
      .catch(error => {
        setLastIssue(issueFromError(error))
      })
      .finally(() => {
        setPendingSyncs(count => Math.max(0, count - 1))
      })
  }, [sessionId])

  useEffect(() => {
    let isActive = true
    stateRef.current = null
    syncQueueRef.current = Promise.resolve()

    // getOrCreateToken is safe inside useEffect (always client-side)
    const token = getOrCreateToken()

    queueMicrotask(() => {
      if (!isActive) return
      setGameState(null)
      setIsLoading(true)
      setLastIssue(null)
      setMyToken(token)
    })

    function dispatchConnect(ownerToken: string, connected: boolean) {
      const state = stateRef.current
      if (!state) return
      const player = Object.values(state.players).find(p => p.ownerToken === ownerToken)
      if (!player || player.connected === connected) return
      dispatch({
        type: 'PLAYER_CONNECT',
        playerId: player.id,
        connected,
        timestamp: new Date().toISOString(),
      })
    }

    channelRef.current = subscribeToGameState(
      sessionId,
      incoming => {
        if (isActive) applyIncomingState(incoming)
      },
      status => {
        if (!isActive) return
        setConnectionStatus(status)
        if (status === 'connected') {
          channelRef.current?.track({ ownerToken: token })
          dispatchConnect(token, true)
        }
      },
      presences => {
        if (!isActive) return
        for (const p of presences) {
          if (p.ownerToken && p.ownerToken !== token) {
            dispatchConnect(p.ownerToken, true)
          }
        }
      },
      presences => {
        if (!isActive) return
        for (const p of presences) {
          if (p.ownerToken) dispatchConnect(p.ownerToken, false)
        }
      },
    )

    void hydrateState(sessionId)
      .then(state => {
        if (!isActive) return
        if (state) applyIncomingState(state)
        // After hydration, mark self connected
        dispatchConnect(token, true)
      })
      .catch(error => {
        if (isActive) setLastIssue(issueFromError(error))
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
      const channel = channelRef.current
      channelRef.current = null
      if (channel) void unsubscribe(channel)
    }
  }, [applyIncomingState, dispatch, sessionId])

  return { gameState, myToken, isLoading, connectionStatus, pendingSyncs, lastIssue, dispatch, resetToState }
}

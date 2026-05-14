'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getOrCreateToken, getDisplayName, saveDisplayName } from '@/lib/tokens/identity'
import { getSession, joinSession, initializeGame, subscribeToLobby } from '@/lib/sessions'
import { listDecks, getDeck } from '@/lib/decks'
import { createInitialGameState } from '@/lib/game/state'
import { PlayerSlot } from './PlayerSlot'
import type { Session, LobbyPlayer } from '@/types/session'
import type { Deck, DeckSummary } from '@/types/deck'
import type { GameMode } from '@/types/game'

interface Props {
  sessionId: string
}

function getSeatCount(mode: GameMode): number {
  return mode === '1v1' ? 2 : 4
}

function modeLabel(mode: GameMode): string {
  return mode === '4ffa' ? '4-Player FFA' : mode.toUpperCase()
}

function mulliganLabel(session: Session): string {
  if (session.mulliganRule === 'friendly') {
    return `Friendly (${session.friendlyMulliganCount ?? 1})`
  }
  return session.mulliganRule === 'london' ? 'London Mulligan' : 'Normal Mulligan'
}

export function LobbyRoom({ sessionId }: Props) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([])
  const [allowSpectators, setAllowSpectators] = useState(true)
  const [myToken] = useState(getOrCreateToken)
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [displayName, setDisplayName] = useState(getDisplayName)
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    getSession(sessionId).then(result => {
      if (!result) {
        setLoadError('Session not found. The link may be invalid or expired.')
        setIsLoading(false)
        return
      }
      setSession(result.session)
      setLobbyPlayers(result.lobbyPlayers)
      setAllowSpectators(result.allowSpectators)
      setIsLoading(false)

      listDecks(myToken).then(setDecks).catch(() => {})
    })

    channelRef.current = subscribeToLobby(sessionId, (updated, players, spectators) => {
      setSession(updated)
      setLobbyPlayers(players)
      setAllowSpectators(spectators)
    })

    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [sessionId, myToken])

  // Redirect all clients when game starts
  useEffect(() => {
    if (session?.status === 'active') {
      router.push(`/game/${sessionId}`)
    }
  }, [session?.status, sessionId, router])

  const myPlayer = lobbyPlayers.find(p => p.token === myToken)
  const isHost = session?.hostToken === myToken
  const hasJoined = !!myPlayer
  const seatCount = session ? getSeatCount(session.mode) : 0
  const seatedPlayers = lobbyPlayers.filter(p => !p.isSpectator)
  const spectators = lobbyPlayers.filter(p => p.isSpectator)
  const filteredDecks = decks.filter(d => !session || d.format === session.format)
  const canStart = isHost && seatedPlayers.length === seatCount && !isStarting
  const remainingSeats = seatCount - seatedPlayers.length

  const handleJoin = async () => {
    if (!displayName.trim() || !session) return
    setIsJoining(true)
    setJoinError(null)

    try {
      const takenSeats = new Set(seatedPlayers.map(p => p.seatIndex))
      let seatIndex: number | null = null
      let isSpectator = false

      for (let i = 0; i < seatCount; i++) {
        if (!takenSeats.has(i)) {
          seatIndex = i
          break
        }
      }

      if (seatIndex === null) {
        if (!allowSpectators) {
          setJoinError('Session is full and spectators are not allowed.')
          setIsJoining(false)
          return
        }
        isSpectator = true
      }

      const player: LobbyPlayer = {
        token: myToken,
        displayName: displayName.trim(),
        seatIndex,
        isSpectator,
        connected: true,
        deckId: selectedDeckId,
        ready: false,
      }

      saveDisplayName(displayName.trim())
      await joinSession(sessionId, player)
    } catch {
      setJoinError('Failed to join — check connection')
    } finally {
      setIsJoining(false)
    }
  }

  const handleStartGame = async () => {
    if (!canStart || !session) return
    setIsStarting(true)
    try {
      const decksByToken = new Map<string, Deck>()
      await Promise.all(
        seatedPlayers
          .filter(p => p.deckId)
          .map(async (player) => {
            const deck = await getDeck(player.deckId!)
            if (deck) decksByToken.set(player.token, deck)
          })
      )
      const gameState = createInitialGameState(session, lobbyPlayers, decksByToken, allowSpectators)
      await initializeGame(sessionId, gameState)
      // Redirect is triggered by the subscription detecting status='active'
    } catch {
      setIsStarting(false)
    }
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/lobby?session=${sessionId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-400">Loading session...</p>
      </div>
    )
  }

  // Error / not found
  if (loadError || !session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-red-400">{loadError ?? 'Session not found.'}</p>
      </div>
    )
  }

  // Join form — for players who haven't joined yet
  if (!hasJoined && !isHost) {
    return (
      <div className="max-w-lg mx-auto w-full p-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#d4a843]">Join Session</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {modeLabel(session.mode)}
            {' · '}
            {session.format === 'commander' ? 'Commander' : 'Modern'}
            {' · '}
            {mulliganLabel(session)}
          </p>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Enter your name"
              maxLength={24}
              autoFocus
              className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#d4a843]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
              Deck{' '}
              <span className="text-zinc-600 normal-case font-normal">(optional)</span>
            </label>
            {filteredDecks.length > 0 ? (
              <select
                value={selectedDeckId ?? ''}
                onChange={e => setSelectedDeckId(e.target.value || null)}
                className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#d4a843]"
              >
                <option value="">No deck selected</option>
                {filteredDecks.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-zinc-600 text-sm">
                No {session.format} decks found.{' '}
                <a
                  href="/decks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#d4a843] hover:underline"
                >
                  Create one →
                </a>
              </p>
            )}
          </div>

          {joinError && <p className="text-red-400 text-sm">{joinError}</p>}

          <button
            onClick={handleJoin}
            disabled={!displayName.trim() || isJoining}
            className="py-2.5 bg-[#d4a843] text-[#0d1117] font-semibold rounded hover:bg-[#e6b84f] disabled:opacity-40 transition-colors"
          >
            {isJoining ? 'Joining...' : 'Join Game'}
          </button>
        </div>

        <p className="text-zinc-600 text-xs text-center">
          {seatedPlayers.length} / {seatCount} players joined
        </p>
      </div>
    )
  }

  // Lobby view (host or joined player)
  const seats = Array.from({ length: seatCount }, (_, i) => ({
    index: i,
    player: seatedPlayers.find(p => p.seatIndex === i) ?? null,
  }))

  return (
    <div className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#d4a843]">Game Lobby</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {modeLabel(session.mode)}
            {' · '}
            {session.format === 'commander' ? 'Commander' : 'Modern'}
            {' · '}
            {mulliganLabel(session)}
            {' · '}
            {session.matchLength === 1 ? 'Best of 1' : session.matchLength === 3 ? 'Best of 3' : 'Best of 5'}
          </p>
        </div>
        <button
          onClick={handleCopyLink}
          className="px-3 py-1.5 text-xs bg-[#21262d] border border-[#30363d] text-zinc-300 rounded hover:border-[#d4a843]/50 hover:text-zinc-100 transition-colors shrink-0"
        >
          {copied ? '✓ Copied!' : 'Copy Invite Link'}
        </button>
      </div>

      {/* Player seats */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
          Players ({seatedPlayers.length}/{seatCount})
        </h2>
        {seats.map(({ index, player }) => (
          <PlayerSlot
            key={index}
            seatIndex={index}
            player={player}
            isHost={player?.token === session.hostToken}
            isMe={player?.token === myToken}
          />
        ))}
      </div>

      {/* Spectators */}
      {allowSpectators && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
            Spectators{spectators.length > 0 ? ` (${spectators.length})` : ''}
          </h2>
          {spectators.length === 0 ? (
            <p className="text-zinc-700 text-sm italic">None</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {spectators.map(p => (
                <span
                  key={p.token}
                  className="text-sm px-3 py-1 bg-[#161b22] border border-[#30363d] rounded-full text-zinc-300"
                >
                  {p.displayName}
                  {p.token === myToken && (
                    <span className="text-zinc-500 ml-1">(You)</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Start game / waiting */}
      <div className="mt-2 flex flex-col gap-2">
        {isHost ? (
          <>
            <button
              onClick={handleStartGame}
              disabled={!canStart}
              className="w-full py-3 bg-[#d4a843] text-[#0d1117] font-semibold rounded-xl hover:bg-[#e6b84f] disabled:opacity-40 transition-colors text-base"
            >
              {isStarting ? 'Starting...' : 'Start Game'}
            </button>
            {!canStart && !isStarting && (
              <p className="text-zinc-500 text-sm text-center">
                Waiting for {remainingSeats} more player{remainingSeats !== 1 ? 's' : ''}
              </p>
            )}
          </>
        ) : (
          <p className="text-zinc-500 text-sm text-center py-2">
            Waiting for the host to start the game...
          </p>
        )}
      </div>
    </div>
  )
}

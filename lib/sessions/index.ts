import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { GameMode, GameFormat, MulliganRule, GameStatus, GameState, Player, PlayerZones, PlayerStats, LogEntry } from '@/types/game'
import type { Session, LobbyPlayer } from '@/types/session'
import type { Deck } from '@/types/deck'
import { fisherYatesShuffle } from '@/lib/game/shuffle'
import { deckToInstances, commanderToInstance } from '@/lib/game/instances'

interface DbSession {
  id: string
  mode: string
  format: string
  mulligan_rule: string
  friendly_mulligan_count: number | null
  match_length: number
  status: string
  game_state: Record<string, unknown>
  host_token: string
  created_at: string
  updated_at: string
}

type LobbyGameState = {
  lobbyPlayers?: LobbyPlayer[]
  allowSpectators?: boolean
}

function fromDb(row: DbSession): Session {
  return {
    id: row.id,
    mode: row.mode as GameMode,
    format: row.format as GameFormat,
    mulliganRule: row.mulligan_rule as MulliganRule,
    friendlyMulliganCount: row.friendly_mulligan_count,
    matchLength: row.match_length as 1 | 3 | 5,
    status: row.status as GameStatus,
    hostToken: row.host_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseLobbyState(raw: Record<string, unknown>): LobbyGameState {
  return raw as LobbyGameState
}

export async function createSession(
  settings: {
    mode: GameMode
    format: GameFormat
    mulliganRule: MulliganRule
    friendlyMulliganCount: number | null
    matchLength: 1 | 3 | 5
    allowSpectators: boolean
  },
  hostToken: string,
  hostDisplayName: string,
  hostDeckId: string | null
): Promise<string> {
  const supabase = createClient()

  const hostPlayer: LobbyPlayer = {
    token: hostToken,
    displayName: hostDisplayName,
    seatIndex: 0,
    isSpectator: false,
    connected: true,
    deckId: hostDeckId,
    ready: false,
  }

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      mode: settings.mode,
      format: settings.format,
      mulligan_rule: settings.mulliganRule,
      friendly_mulligan_count: settings.friendlyMulliganCount,
      match_length: settings.matchLength,
      status: 'lobby',
      game_state: { lobbyPlayers: [hostPlayer], allowSpectators: settings.allowSpectators },
      host_token: hostToken,
    })
    .select('id')
    .single()

  if (error) throw error
  return (data as { id: string }).id
}

export async function getSession(
  id: string
): Promise<{ session: Session; lobbyPlayers: LobbyPlayer[]; allowSpectators: boolean } | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).single()
  if (error || !data) return null

  const row = data as DbSession
  const lobbyState = parseLobbyState(row.game_state)
  return {
    session: fromDb(row),
    lobbyPlayers: lobbyState.lobbyPlayers ?? [],
    allowSpectators: lobbyState.allowSpectators ?? true,
  }
}

export async function joinSession(id: string, player: LobbyPlayer): Promise<void> {
  const supabase = createClient()

  const { data, error } = await supabase.from('sessions').select('game_state').eq('id', id).single()
  if (error || !data) throw new Error('Session not found')

  const lobbyState = parseLobbyState((data as DbSession).game_state)
  const players = lobbyState.lobbyPlayers ?? []
  const idx = players.findIndex(p => p.token === player.token)

  if (idx >= 0) {
    players[idx] = player
  } else {
    players.push(player)
  }

  const { error: updateError } = await supabase
    .from('sessions')
    .update({
      game_state: { ...lobbyState, lobbyPlayers: players },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) throw updateError
}

export async function startGame(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function initializeGame(id: string, gameState: GameState): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'active',
      game_state: gameState,
      updated_at: gameState.updatedAt,
    })
    .eq('id', id)
  if (error) throw error
}

export function startNextGame(currentState: GameState, decksByToken: Map<string, Deck>): GameState {
  const now = new Date().toISOString()
  const startingLife = currentState.format === 'commander' ? 40 : 20
  const gamesPlayed = Object.values(currentState.matchScore).reduce((a, b) => a + b, 0)

  const seated = Object.values(currentState.players)
    .filter(p => !p.isSpectator)
    .sort((a, b) => a.seatIndex - b.seatIndex)

  const updatedPlayers: Record<string, Player> = {}

  for (const player of seated) {
    const deck = decksByToken.get(player.ownerToken)
    const libraryInstances = deck ? deckToInstances(deck.mainDeck) : []
    const shuffled = fisherYatesShuffle(libraryInstances)
    const hand = shuffled.splice(0, currentState.settings.startingHandSize)

    const commandZone =
      currentState.format === 'commander' && deck?.commanderCard
        ? [commanderToInstance(deck.commanderCard)]
        : []

    const commanderDamage: Record<string, number> = {}
    seated.forEach(p => {
      if (p.id !== player.id) commanderDamage[p.id] = 0
    })

    const stats: PlayerStats = {
      life: startingLife,
      poisonCounters: 0,
      commanderDamage,
      energyCounters: 0,
      experienceCounters: 0,
    }

    const zones: PlayerZones = {
      library: shuffled,
      hand,
      battlefield: [],
      graveyard: [],
      exile: [],
      commandZone,
    }

    updatedPlayers[player.id] = {
      ...player,
      stats,
      zones,
      loss: null,
    }
  }

  // Preserve spectators unchanged
  for (const player of Object.values(currentState.players)) {
    if (player.isSpectator) updatedPlayers[player.id] = player
  }

  const startLog: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: now,
    playerId: 'system',
    message: `Game ${gamesPlayed + 1} started.`,
    type: 'system',
  }

  return {
    ...currentState,
    status: 'active',
    sideboardReadyIds: [],
    turn: {
      number: 1,
      activePlayerId: seated[0]?.id ?? '',
      phase: 'untap',
    },
    players: updatedPlayers,
    tokens: [],
    log: [startLog],
    lastAction: null,
    previousState: null,
    pendingVote: null,
    updatedAt: now,
  }
}

export function subscribeToLobby(
  id: string,
  onUpdate: (session: Session, lobbyPlayers: LobbyPlayer[], allowSpectators: boolean) => void
): RealtimeChannel {
  const supabase = createClient()
  const channel = supabase
    .channel(`lobby:${id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${id}` },
      (payload) => {
        const row = payload.new as DbSession
        const lobbyState = parseLobbyState(row.game_state)
        onUpdate(fromDb(row), lobbyState.lobbyPlayers ?? [], lobbyState.allowSpectators ?? true)
      }
    )

  channel.subscribe()
  return channel
}

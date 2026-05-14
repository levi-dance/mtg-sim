import type { GameState, Player, PlayerZones, PlayerStats, LogEntry } from '@/types/game'
import type { Session, LobbyPlayer } from '@/types/session'
import type { Deck } from '@/types/deck'
import { fisherYatesShuffle } from './shuffle'
import { deckToInstances, commanderToInstance } from './instances'

export function createInitialGameState(
  session: Session,
  lobbyPlayers: LobbyPlayer[],
  decksByToken: Map<string, Deck>,
  allowSpectators: boolean
): GameState {
  const now = new Date().toISOString()
  const startingLife = session.format === 'commander' ? 40 : 20

  const seated = [...lobbyPlayers]
    .filter(p => !p.isSpectator)
    .sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0))

  const playerIds = seated.map((_, i) => `player_${i}`)

  const players: Record<string, Player> = {}

  for (let i = 0; i < seated.length; i++) {
    const lobbyPlayer = seated[i]
    const playerId = playerIds[i]
    const deck = decksByToken.get(lobbyPlayer.token)

    const libraryInstances = deck ? deckToInstances(deck.mainDeck) : []
    const shuffled = fisherYatesShuffle(libraryInstances)
    const hand = shuffled.splice(0, 7)

    const commandZone =
      session.format === 'commander' && deck?.commanderCard
        ? [commanderToInstance(deck.commanderCard)]
        : []

    const commanderDamage: Record<string, number> = {}
    for (let j = 0; j < seated.length; j++) {
      if (j !== i) commanderDamage[playerIds[j]] = 0
    }

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

    players[playerId] = {
      id: playerId,
      displayName: lobbyPlayer.displayName,
      ownerToken: lobbyPlayer.token,
      seatIndex: i,
      isSpectator: false,
      connected: true,
      deckId: lobbyPlayer.deckId,
      stats,
      zones,
    }
  }

  const matchScore: Record<string, number> = {}
  playerIds.forEach(id => { matchScore[id] = 0 })

  const startLog: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: now,
    playerId: 'system',
    message: 'Game started.',
    type: 'system',
  }

  return {
    sessionId: session.id,
    mode: session.mode,
    format: session.format,
    status: 'active',
    matchScore,
    sideboardReadyIds: [],
    turn: {
      number: 1,
      activePlayerId: playerIds[0] ?? '',
      phase: 'untap',
    },
    players,
    tokens: [],
    log: [startLog],
    lastAction: null,
    previousState: null,
    pendingVote: null,
    settings: {
      startingLife,
      startingHandSize: 7,
      mulliganRule: session.mulliganRule,
      friendlyMulliganCount: session.friendlyMulliganCount,
      matchLength: session.matchLength,
      allowSpectators,
    },
    createdAt: now,
    updatedAt: now,
  }
}

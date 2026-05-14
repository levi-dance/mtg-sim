export type GameMode = '1v1' | '2v2' | '4ffa'
export type GameFormat = 'commander' | 'modern'
export type GameStatus = 'lobby' | 'active' | 'sideboard' | 'ended'
export type MulliganRule = 'london' | 'normal' | 'friendly'
export type SubfieldZone = 'lands' | 'creatures' | 'other'

export type TurnPhase =
  | 'untap'
  | 'upkeep'
  | 'draw'
  | 'main1'
  | 'combat_begin'
  | 'combat_attackers'
  | 'combat_blockers'
  | 'combat_damage'
  | 'combat_end'
  | 'main2'
  | 'end'
  | 'cleanup'

export type ActionType =
  | 'DRAW_CARD'
  | 'DRAW_X'
  | 'PLAY_CARD'
  | 'MOVE_CARD'
  | 'MOVE_CARD_ON_BOARD'
  | 'MOVE_TOKEN_ON_BOARD'
  | 'TAP_CARD'
  | 'TAP_TOKEN'
  | 'UNTAP_CARD'
  | 'UNTAP_TOKEN'
  | 'UNTAP_ALL'
  | 'TRANSFORM_CARD'
  | 'PHASE_OUT'
  | 'ADD_COUNTER'
  | 'REMOVE_COUNTER'
  | 'MARK_DAMAGE'
  | 'CLEAR_DAMAGE'
  | 'REVEAL_CARD'
  | 'REVEAL_TOP_X'
  | 'SCRY_X'
  | 'MILL_X'
  | 'LOOK_TOP_X'
  | 'SHUFFLE_LIBRARY'
  | 'TUTOR'
  | 'ADD_TOKEN'
  | 'REMOVE_TOKEN'
  | 'COPY_PERMANENT'
  | 'SET_LIFE'
  | 'SET_POISON'
  | 'SET_COMMANDER_DAMAGE'
  | 'SET_ENERGY'
  | 'SET_EXPERIENCE'
  | 'CAST_COMMANDER'
  | 'MULTI_SELECT_ACTION'
  | 'NEXT_PHASE'
  | 'NEXT_TURN'
  | 'ROLL_DICE'
  | 'FLIP_COIN'
  | 'HOST_VOTE_INITIATE'
  | 'HOST_VOTE_CAST'
  | 'HOST_VOTE_RESOLVE'
  | 'TAKE_BACK'
  | 'PLAYER_CONCEDE'
  | 'PLAYER_CONNECT'
  | 'GAME_END'
  | 'MATCH_END'
  | 'SIDEBOARD_CONFIRM'

export type BuiltInCounterType = 'plusOne' | 'minusOne' | 'loyalty'

export type PlayerLossReason = 'life' | 'poison' | 'commanderDamage' | 'conceded'

export interface CardCounters {
  plusOne: number
  minusOne: number
  loyalty: number
  custom: { label: string; value: number }[]
}

export interface CardInstance {
  instanceId: string
  cardId: string
  name: string
  faceDown: boolean
  tapped: boolean
  counters: Partial<CardCounters> | Record<string, never>
  attachments: string[]
  markedDamage: number
  annotation: string
  transformed: boolean
  phased: boolean
  x: number | null
  y: number | null
  // battlefield-only
  summoningSick?: boolean
  flipped?: boolean
  subfieldZone?: SubfieldZone
  zIndex?: number
  // command zone-only
  commanderCastCount?: number
}

export interface TokenInstance {
  instanceId: string
  ownerId: string
  name: string
  cardId: string
  tapped: boolean
  x: number
  y: number
  counters: Partial<CardCounters>
  attachments: string[]
  markedDamage: number
  subfieldZone: SubfieldZone
  zIndex?: number
}

export interface PlayerZones {
  library: CardInstance[]
  hand: CardInstance[]
  battlefield: CardInstance[]
  graveyard: CardInstance[]
  exile: CardInstance[]
  commandZone: CardInstance[]
}

export interface PlayerStats {
  life: number
  poisonCounters: number
  commanderDamage: Record<string, number>
  energyCounters: number
  experienceCounters: number
}

export interface PlayerLoss {
  reason: PlayerLossReason
  sourcePlayerId?: string
  message: string
  timestamp: string
}

export interface Player {
  id: string
  displayName: string
  ownerToken: string
  seatIndex: number
  isSpectator: boolean
  connected: boolean
  deckId: string | null
  stats: PlayerStats
  zones: PlayerZones
  loss?: PlayerLoss | null
}

export interface TurnState {
  number: number
  activePlayerId: string
  phase: TurnPhase
}

export interface LogEntry {
  id: string
  timestamp: string
  playerId: string
  message: string
  type: 'play' | 'move' | 'draw' | 'tap' | 'counter' | 'stat' | 'system' | 'roll' | 'vote'
}

export interface GameAction {
  type: ActionType
  playerId: string
  timestamp: string
  [key: string]: unknown
}

export interface GameSettings {
  startingLife: number
  startingHandSize: number
  mulliganRule: MulliganRule
  friendlyMulliganCount: number | null
  matchLength: 1 | 3 | 5
  allowSpectators: boolean
}

export interface VoteState {
  id: string
  topic: string
  actionType: 'TAKE_BACK' | 'GAME_END'
  initiatorId: string
  votes: Record<string, 'yes' | 'no'>
}

export interface GameState {
  sessionId: string
  mode: GameMode
  format: GameFormat
  status: GameStatus
  matchScore: Record<string, number>
  sideboardReadyIds: string[]
  turn: TurnState
  players: Record<string, Player>
  tokens: TokenInstance[]
  log: LogEntry[]
  lastAction: GameAction | null
  previousState: GameState | null
  pendingVote: VoteState | null
  settings: GameSettings
  createdAt: string
  updatedAt: string
}

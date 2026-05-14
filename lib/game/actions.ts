import type { ActionType, BuiltInCounterType } from '@/types/game'

export interface BaseAction {
  type: ActionType
  playerId: string
  timestamp: string
}

export interface DrawCardAction extends BaseAction {
  type: 'DRAW_CARD'
}

export interface DrawXAction extends BaseAction {
  type: 'DRAW_X'
  count: number
}

export interface PlayCardAction extends BaseAction {
  type: 'PLAY_CARD'
  instanceId: string
  fromZone: 'hand' | 'commandZone'
  x?: number
  y?: number
  subfieldZone?: import('@/types/game').SubfieldZone
}

export interface MoveCardAction extends BaseAction {
  type: 'MOVE_CARD'
  instanceId: string
  fromZone: keyof import('@/types/game').PlayerZones
  toZone: keyof import('@/types/game').PlayerZones
  targetPlayerId?: string
  x?: number
  y?: number
}

export interface MoveCardOnBoardAction extends BaseAction {
  type: 'MOVE_CARD_ON_BOARD'
  instanceId: string
  x: number
  y: number
}

export interface MoveTokenOnBoardAction extends BaseAction {
  type: 'MOVE_TOKEN_ON_BOARD'
  instanceId: string
  x: number
  y: number
  subfieldZone?: import('@/types/game').SubfieldZone
}

export interface TapCardAction extends BaseAction {
  type: 'TAP_CARD'
  instanceId: string
}

export interface TapTokenAction extends BaseAction {
  type: 'TAP_TOKEN'
  instanceId: string
}

export interface UntapCardAction extends BaseAction {
  type: 'UNTAP_CARD'
  instanceId: string
}

export interface UntapTokenAction extends BaseAction {
  type: 'UNTAP_TOKEN'
  instanceId: string
}

export interface UntapAllAction extends BaseAction {
  type: 'UNTAP_ALL'
}

export interface SetLifeAction extends BaseAction {
  type: 'SET_LIFE'
  life: number
}

export interface SetPoisonAction extends BaseAction {
  type: 'SET_POISON'
  poisonCounters: number
}

export interface SetCommanderDamageAction extends BaseAction {
  type: 'SET_COMMANDER_DAMAGE'
  commanderPlayerId: string
  damage: number
}

export interface SetEnergyAction extends BaseAction {
  type: 'SET_ENERGY'
  energyCounters: number
}

export interface SetExperienceAction extends BaseAction {
  type: 'SET_EXPERIENCE'
  experienceCounters: number
}

export interface AddCounterAction extends BaseAction {
  type: 'ADD_COUNTER'
  instanceId: string
  counterType: BuiltInCounterType | 'custom'
  amount: number
  label?: string
}

export interface RemoveCounterAction extends BaseAction {
  type: 'REMOVE_COUNTER'
  instanceId: string
  counterType: BuiltInCounterType | 'custom'
  amount: number
  label?: string
}

export interface MarkDamageAction extends BaseAction {
  type: 'MARK_DAMAGE'
  instanceId: string
  amount: number
}

export interface ClearDamageAction extends BaseAction {
  type: 'CLEAR_DAMAGE'
  instanceId: string
}

export interface AddTokenAction extends BaseAction {
  type: 'ADD_TOKEN'
  name: string
  cardId: string
  x: number
  y: number
  subfieldZone: import('@/types/game').SubfieldZone
}

export interface RemoveTokenAction extends BaseAction {
  type: 'REMOVE_TOKEN'
  instanceId: string
}

export interface NextPhaseAction extends BaseAction {
  type: 'NEXT_PHASE'
}

export interface CastCommanderAction extends BaseAction {
  type: 'CAST_COMMANDER'
  instanceId: string
  x?: number
  y?: number
}

export interface MultiSelectAction extends BaseAction {
  type: 'MULTI_SELECT_ACTION'
  instanceIds: string[]
  operation: 'tap' | 'untap' | 'move' | 'addCounter' | 'removeCounter' | 'markDamage' | 'clearDamage'
  toZone?: keyof import('@/types/game').PlayerZones
  counterType?: BuiltInCounterType | 'custom'
  label?: string
  amount?: number
}

export interface RevealTopXAction extends BaseAction {
  type: 'REVEAL_TOP_X'
  count: number
}

export interface MillXAction extends BaseAction {
  type: 'MILL_X'
  count: number
}

export interface ScryXAction extends BaseAction {
  type: 'SCRY_X'
  count: number
  topInstanceIds: string[]
  bottomInstanceIds: string[]
}

export interface TutorAction extends BaseAction {
  type: 'TUTOR'
  instanceId: string
  toZone: 'hand'
  shuffleAfter: boolean
}

export interface PlayerConcedeAction extends BaseAction {
  type: 'PLAYER_CONCEDE'
}

export interface RollDiceAction extends BaseAction {
  type: 'ROLL_DICE'
  sides: number
  result: number
}

export interface FlipCoinAction extends BaseAction {
  type: 'FLIP_COIN'
  result: 'heads' | 'tails'
}

export interface HostVoteInitiateAction extends BaseAction {
  type: 'HOST_VOTE_INITIATE'
  voteId: string
  topic: string
  actionType: 'TAKE_BACK' | 'GAME_END'
}

export interface HostVoteCastAction extends BaseAction {
  type: 'HOST_VOTE_CAST'
  voteId: string
  vote: 'yes' | 'no'
}

export interface HostVoteResolveAction extends BaseAction {
  type: 'HOST_VOTE_RESOLVE'
  voteId: string
}

export interface GameEndAction extends BaseAction {
  type: 'GAME_END'
}

export interface MatchEndAction extends BaseAction {
  type: 'MATCH_END'
  winnerId: string
}

export interface SideboardConfirmAction extends BaseAction {
  type: 'SIDEBOARD_CONFIRM'
}

export interface PlayerConnectAction extends BaseAction {
  type: 'PLAYER_CONNECT'
  connected: boolean
}

export type GameAction =
  | DrawCardAction
  | DrawXAction
  | PlayCardAction
  | MoveCardAction
  | MoveCardOnBoardAction
  | MoveTokenOnBoardAction
  | TapCardAction
  | TapTokenAction
  | UntapCardAction
  | UntapTokenAction
  | UntapAllAction
  | SetLifeAction
  | SetPoisonAction
  | SetCommanderDamageAction
  | SetEnergyAction
  | SetExperienceAction
  | AddCounterAction
  | RemoveCounterAction
  | MarkDamageAction
  | ClearDamageAction
  | AddTokenAction
  | RemoveTokenAction
  | NextPhaseAction
  | CastCommanderAction
  | MultiSelectAction
  | RevealTopXAction
  | MillXAction
  | ScryXAction
  | TutorAction
  | PlayerConcedeAction
  | RollDiceAction
  | FlipCoinAction
  | HostVoteInitiateAction
  | HostVoteCastAction
  | HostVoteResolveAction
  | GameEndAction
  | MatchEndAction
  | SideboardConfirmAction
  | PlayerConnectAction
  | (BaseAction & { [key: string]: unknown })

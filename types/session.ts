import type { GameMode, GameFormat, MulliganRule, GameStatus } from './game'

export interface SessionSettings {
  mode: GameMode
  format: GameFormat
  mulliganRule: MulliganRule
  friendlyMulliganCount: number | null
  matchLength: 1 | 3 | 5
  allowSpectators: boolean
}

export interface Session {
  id: string
  mode: GameMode
  format: GameFormat
  mulliganRule: MulliganRule
  friendlyMulliganCount: number | null
  matchLength: 1 | 3 | 5
  status: GameStatus
  hostToken: string
  createdAt: string
  updatedAt: string
}

export interface LobbyPlayer {
  token: string
  displayName: string
  seatIndex: number | null
  isSpectator: boolean
  connected: boolean
  deckId: string | null
  ready: boolean
}

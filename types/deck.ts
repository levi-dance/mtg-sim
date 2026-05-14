import type { GameFormat } from './game'

export interface DeckCard {
  cardId: string
  name: string
  quantity: number
  artId: string
}

export interface Deck {
  id: string
  ownerToken: string
  name: string
  format: GameFormat
  commanderCard: DeckCard | null
  mainDeck: DeckCard[]
  sideboard: DeckCard[]
  createdAt: string
  updatedAt: string
}

export interface DeckSummary {
  id: string
  name: string
  format: GameFormat
  commanderCard: DeckCard | null
  cardCount: number
  updatedAt: string
}

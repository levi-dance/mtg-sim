import { createClient } from '@/lib/supabase/client'
import type { Deck, DeckCard, DeckSummary } from '@/types/deck'
import type { GameFormat } from '@/types/game'

interface DbDeck {
  id: string
  owner_token: string
  name: string
  format: string
  commander_card: DeckCard | null
  main_deck: DeckCard[]
  sideboard: DeckCard[]
  created_at: string
  updated_at: string
}

function fromDb(row: DbDeck): Deck {
  return {
    id: row.id,
    ownerToken: row.owner_token,
    name: row.name,
    format: row.format as GameFormat,
    commanderCard: row.commander_card,
    mainDeck: row.main_deck,
    sideboard: row.sideboard,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listDecks(ownerToken: string): Promise<DeckSummary[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('decks')
    .select('id, name, format, commander_card, main_deck, updated_at')
    .eq('owner_token', ownerToken)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    format: row.format as GameFormat,
    commanderCard: row.commander_card as DeckCard | null,
    cardCount: (row.main_deck as DeckCard[]).reduce((sum, c) => sum + c.quantity, 0),
    updatedAt: row.updated_at,
  }))
}

export async function getDeck(id: string): Promise<Deck | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('decks')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return fromDb(data as DbDeck)
}

export async function saveDeck(deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Deck> {
  const supabase = createClient()
  const payload = {
    owner_token: deck.ownerToken,
    name: deck.name,
    format: deck.format,
    commander_card: deck.commanderCard,
    main_deck: deck.mainDeck,
    sideboard: deck.sideboard,
    updated_at: new Date().toISOString(),
  }
  if (deck.id) {
    const { data, error } = await supabase
      .from('decks')
      .update(payload)
      .eq('id', deck.id)
      .select()
      .single()
    if (error) throw error
    return fromDb(data as DbDeck)
  }
  const { data, error } = await supabase
    .from('decks')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return fromDb(data as DbDeck)
}

export async function deleteDeck(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('decks').delete().eq('id', id)
  if (error) throw error
}

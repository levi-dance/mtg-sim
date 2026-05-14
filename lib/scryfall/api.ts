import { getCached, setCached } from './cache'

const BASE_URL = 'https://api.scryfall.com'

export interface ScryfallImageUris {
  small: string
  normal: string
  large: string
  png: string
  art_crop: string
  border_crop: string
}

export interface ScryfallCardFace {
  name: string
  image_uris?: ScryfallImageUris
  type_line?: string
  oracle_text?: string
}

export interface ScryfallCard {
  id: string
  name: string
  type_line: string
  oracle_text?: string
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
  layout: string
  set: string
  set_name: string
  collector_number: string
  prints_search_uri?: string
}

export interface ScryfallList {
  object: 'list'
  total_cards: number
  has_more: boolean
  next_page?: string
  data: ScryfallCard[]
}

async function scryfallFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    // 100ms delay recommended by Scryfall for burst requests
  })
  if (!res.ok) {
    throw new Error(`Scryfall error ${res.status}: ${url}`)
  }
  return res.json() as Promise<T>
}

export async function getCardByName(name: string): Promise<ScryfallCard> {
  const cacheKey = `named:${name}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const card = await scryfallFetch<ScryfallCard>(
    `${BASE_URL}/cards/named?exact=${encodeURIComponent(name)}`
  )
  setCached(cacheKey, card)
  setCached(`id:${card.id}`, card)
  return card
}

export async function getCardById(id: string): Promise<ScryfallCard> {
  const cacheKey = `id:${id}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const card = await scryfallFetch<ScryfallCard>(`${BASE_URL}/cards/${id}`)
  setCached(cacheKey, card)
  return card
}

export async function searchCards(query: string): Promise<ScryfallCard[]> {
  const cacheKey = `search:${query}`
  const cached = getCached(cacheKey)
  if (cached) return [cached]

  const result = await scryfallFetch<ScryfallList>(
    `${BASE_URL}/cards/search?q=${encodeURIComponent(query)}`
  )
  result.data.forEach(card => setCached(`id:${card.id}`, card))
  return result.data
}

export async function getCardPrintings(name: string): Promise<ScryfallCard[]> {
  const result = await scryfallFetch<ScryfallList>(
    `${BASE_URL}/cards/search?q=!"${encodeURIComponent(name)}"&unique=prints`
  )
  result.data.forEach(card => setCached(`id:${card.id}`, card))
  return result.data
}

export async function searchTokens(name: string): Promise<ScryfallCard[]> {
  const result = await scryfallFetch<ScryfallList>(
    `${BASE_URL}/cards/search?q=type:token+${encodeURIComponent(name)}`
  )
  result.data.forEach(card => setCached(`id:${card.id}`, card))
  return result.data
}

export function getCardImageUri(card: ScryfallCard, size: keyof ScryfallImageUris = 'normal'): string {
  if (card.image_uris?.[size]) return card.image_uris[size]
  if (card.card_faces?.[0]?.image_uris?.[size]) return card.card_faces[0].image_uris[size]
  if (card.image_uris?.normal) return card.image_uris.normal
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal
  return ''
}

export async function autocompleteCardNames(query: string): Promise<string[]> {
  if (query.length < 2) return []
  const res = await fetch(
    `${BASE_URL}/cards/autocomplete?q=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!res.ok) return []
  const data = await res.json() as { object: string; data: string[] }
  return data.data
}

export async function getCardByNameFuzzy(name: string): Promise<ScryfallCard> {
  // Check exact-name cache first (populated by previous lookups)
  const exactKey = `named:${name}`
  const cached = getCached(exactKey)
  if (cached) return cached

  const res = await fetch(
    `${BASE_URL}/cards/named?fuzzy=${encodeURIComponent(name)}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!res.ok) {
    throw new Error(`Card not found: ${name}`)
  }
  const card = await res.json() as ScryfallCard
  setCached(`named:${card.name}`, card)
  setCached(`id:${card.id}`, card)
  return card
}

export function getArtCropUri(artId: string): string {
  return `https://cards.scryfall.io/art_crop/front/${artId[0]}/${artId[1]}/${artId}.jpg`
}

export function getNormalUri(artId: string): string {
  return `https://cards.scryfall.io/normal/front/${artId[0]}/${artId[1]}/${artId}.jpg`
}

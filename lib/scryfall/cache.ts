import type { ScryfallCard } from './api'

const cache = new Map<string, ScryfallCard>()

export function getCached(key: string): ScryfallCard | undefined {
  return cache.get(key)
}

export function setCached(key: string, card: ScryfallCard): void {
  cache.set(key, card)
}

export function hasCached(key: string): boolean {
  return cache.has(key)
}

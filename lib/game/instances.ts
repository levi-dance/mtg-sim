import type { CardInstance } from '@/types/game'
import type { DeckCard } from '@/types/deck'

export function deckToInstances(cards: DeckCard[]): CardInstance[] {
  const instances: CardInstance[] = []
  for (const card of cards) {
    for (let i = 0; i < card.quantity; i++) {
      instances.push({
        instanceId: crypto.randomUUID(),
        cardId: card.cardId,
        name: card.name,
        faceDown: false,
        tapped: false,
        counters: {},
        attachments: [],
        markedDamage: 0,
        annotation: '',
        transformed: false,
        phased: false,
        x: null,
        y: null,
      })
    }
  }
  return instances
}

export function commanderToInstance(card: DeckCard): CardInstance {
  return {
    instanceId: crypto.randomUUID(),
    cardId: card.cardId,
    name: card.name,
    faceDown: false,
    tapped: false,
    counters: {},
    attachments: [],
    markedDamage: 0,
    annotation: '',
    transformed: false,
    phased: false,
    x: null,
    y: null,
    commanderCastCount: 0,
  }
}

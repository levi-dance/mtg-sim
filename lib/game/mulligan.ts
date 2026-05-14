import type { CardInstance, MulliganRule } from '@/types/game'
import { shuffleLibrary } from './shuffle'

export interface MulliganResult {
  hand: CardInstance[]
  library: CardInstance[]
}

export function londonMulligan(
  hand: CardInstance[],
  library: CardInstance[],
): MulliganResult {
  // Put entire hand back, draw 7 — player chooses which cards to bottom manually
  const newLibrary = shuffleLibrary([...library, ...hand])
  const newHand = newLibrary.splice(0, 7)
  return { hand: newHand, library: newLibrary }
}

export function normalMulligan(
  hand: CardInstance[],
  library: CardInstance[],
  targetSize: number
): MulliganResult {
  const newLibrary = shuffleLibrary([...library, ...hand])
  const newHand = newLibrary.splice(0, targetSize)
  return { hand: newHand, library: newLibrary }
}

export function applyMulligan(
  rule: MulliganRule,
  hand: CardInstance[],
  library: CardInstance[],
  mulliganNumber: number,
  startingHandSize: number
): MulliganResult {
  const targetSize = startingHandSize - mulliganNumber
  switch (rule) {
    case 'london':
      return londonMulligan(hand, library)
    case 'normal':
    case 'friendly':
      return normalMulligan(hand, library, targetSize)
  }
}

import type {
  GameState,
  CardInstance,
  Player,
  PlayerZones,
  TokenInstance,
  GameAction as RawGameAction,
  TurnPhase,
  BuiltInCounterType,
  VoteState,
} from '@/types/game'
import type { GameAction } from './actions'
import { shuffleLibrary } from './shuffle'

const TURN_PHASES: TurnPhase[] = [
  'untap',
  'upkeep',
  'draw',
  'main1',
  'combat_begin',
  'combat_attackers',
  'combat_blockers',
  'combat_damage',
  'combat_end',
  'main2',
  'end',
  'cleanup',
]

// Cast a typed action to the raw GameAction shape used in lastAction
function asRaw(action: GameAction): RawGameAction {
  return action as unknown as RawGameAction
}

function addLog(state: GameState, playerId: string, message: string, type: GameState['log'][number]['type']): GameState['log'] {
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    playerId,
    message,
    type,
  }
  const log = [...state.log, entry]
  return log.length > 100 ? log.slice(log.length - 100) : log
}

function findCardInZones(zones: PlayerZones, instanceId: string): { zone: keyof PlayerZones; card: CardInstance } | null {
  for (const [zoneName, cards] of Object.entries(zones) as [keyof PlayerZones, CardInstance[]][]) {
    const card = cards.find(c => c.instanceId === instanceId)
    if (card) return { zone: zoneName, card }
  }
  return null
}

function drawCards(player: GameState['players'][string], count: number): GameState['players'][string] {
  if (count <= 0 || player.zones.library.length === 0) return player

  const drawn = player.zones.library.slice(0, count).map(card => ({ ...card, faceDown: false }))
  const library = player.zones.library.slice(drawn.length)

  return {
    ...player,
    zones: {
      ...player.zones,
      library,
      hand: [...player.zones.hand, ...drawn],
    },
  }
}

function normalizeMovedCard(card: CardInstance, toZone: keyof PlayerZones, x?: number, y?: number): CardInstance {
  const movingToBattlefield = toZone === 'battlefield'
  return {
    ...card,
    faceDown: toZone === 'library',
    x: movingToBattlefield ? (x ?? 0) : null,
    y: movingToBattlefield ? (y ?? 0) : null,
    tapped: false,
    counters: movingToBattlefield ? card.counters : {},
    markedDamage: movingToBattlefield ? card.markedDamage : 0,
    summoningSick: movingToBattlefield ? true : undefined,
    subfieldZone: movingToBattlefield ? (card.subfieldZone ?? 'other') : undefined,
    zIndex: undefined,
  }
}

function nextBattlefieldZ(player: GameState['players'][string]): number {
  return player.zones.battlefield.reduce((highest, card, index) => Math.max(highest, card.zIndex ?? index), 0) + 1
}

function nextTokenZ(state: GameState): number {
  return state.tokens.reduce((highest, token, index) => Math.max(highest, token.zIndex ?? index), 0) + 1
}

function formatCounter(counterType: BuiltInCounterType | 'custom', label?: string): string {
  if (counterType === 'plusOne') return '+1/+1 counter'
  if (counterType === 'minusOne') return '-1/-1 counter'
  if (counterType === 'loyalty') return 'loyalty counter'
  return `${label ?? 'custom'} counter`
}

function withUpdatedCard(
  player: Player,
  instanceId: string,
  updateCard: (card: CardInstance) => CardInstance
): { player: Player; card: CardInstance; updatedCard: CardInstance } | null {
  const found = findCardInZones(player.zones, instanceId)
  if (!found) return null

  const updatedCard = updateCard(found.card)
  return {
    card: found.card,
    updatedCard,
    player: {
      ...player,
      zones: {
        ...player.zones,
        [found.zone]: player.zones[found.zone].map(card =>
          card.instanceId === instanceId ? updatedCard : card
        ),
      },
    },
  }
}

function updateCounter<T extends CardInstance | TokenInstance>(
  permanent: T,
  counterType: BuiltInCounterType | 'custom',
  amount: number,
  label: string | undefined,
  direction: 1 | -1
): T {
  const cleanAmount = Math.max(0, Math.floor(amount))
  if (cleanAmount === 0) return permanent

  if (counterType === 'custom') {
    const cleanLabel = label?.trim()
    if (!cleanLabel) return permanent

    const existing = permanent.counters.custom ?? []
    const current = existing.find(counter => counter.label === cleanLabel)
    const nextValue = Math.max(0, (current?.value ?? 0) + cleanAmount * direction)
    const custom = [
      ...existing.filter(counter => counter.label !== cleanLabel),
      ...(nextValue > 0 ? [{ label: cleanLabel, value: nextValue }] : []),
    ]

    return { ...permanent, counters: { ...permanent.counters, custom } }
  }

  const current = permanent.counters[counterType] ?? 0
  const nextValue = Math.max(0, current + cleanAmount * direction)
  return { ...permanent, counters: { ...permanent.counters, [counterType]: nextValue } }
}

function setPlayerLoss(player: Player, timestamp: string): Player {
  if (player.loss?.reason === 'conceded') return player

  const commanderLoss = Object.entries(player.stats.commanderDamage).find(([, damage]) => damage >= 21)
  const loss =
    player.stats.life <= 0
      ? { reason: 'life' as const, message: `${player.displayName} has 0 or less life.`, timestamp }
      : player.stats.poisonCounters >= 10
        ? { reason: 'poison' as const, message: `${player.displayName} has 10 or more poison counters.`, timestamp }
        : commanderLoss
          ? {
              reason: 'commanderDamage' as const,
              sourcePlayerId: commanderLoss[0],
              message: `${player.displayName} has taken 21 or more commander damage.`,
              timestamp,
            }
          : null

  return { ...player, loss }
}

function withEvaluatedLosses(players: Record<string, Player>, timestamp: string): Record<string, Player> {
  return Object.fromEntries(
    Object.entries(players).map(([playerId, player]) => [playerId, setPlayerLoss(player, timestamp)])
  )
}

export function applyAction(state: GameState, action: GameAction): GameState {
  const next = { ...state, previousState: { ...state, previousState: null } }

  switch (action.type) {
    case 'DRAW_CARD': {
      const player = state.players[action.playerId]
      if (!player || player.zones.library.length === 0) return state

      const updatedPlayer = drawCards(player, 1)

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: updatedPlayer,
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} drew a card.`, 'draw'),
        updatedAt: action.timestamp,
      }
    }

    case 'DRAW_X': {
      const player = state.players[action.playerId]
      if (!player) return state

      const drawAction = action as import('./actions').DrawXAction
      const count = Math.max(0, Math.floor(drawAction.count))
      const updatedPlayer = drawCards(player, count)
      if (updatedPlayer === player) return state

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: updatedPlayer,
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} drew ${Math.min(count, player.zones.library.length)} cards.`, 'draw'),
        updatedAt: action.timestamp,
      }
    }

    case 'PLAY_CARD': {
      const player = state.players[action.playerId]
      if (!player) return state

      const playAction = action as import('./actions').PlayCardAction
      const fromZone = playAction.fromZone ?? 'hand'
      const cardIndex = player.zones[fromZone].findIndex(c => c.instanceId === playAction.instanceId)
      if (cardIndex === -1) return state

      const card = player.zones[fromZone][cardIndex]
      const playedCard: CardInstance = {
        ...card,
        faceDown: false,
        tapped: false,
        summoningSick: true,
        x: playAction.x ?? 0,
        y: playAction.y ?? 0,
        subfieldZone: playAction.subfieldZone ?? 'other',
        zIndex: nextBattlefieldZ(player),
      }

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            zones: {
              ...player.zones,
              [fromZone]: player.zones[fromZone].filter((_, i) => i !== cardIndex),
              battlefield: [...player.zones.battlefield, playedCard],
            },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} played ${card.name}.`, 'play'),
        updatedAt: action.timestamp,
      }
    }

    case 'CAST_COMMANDER': {
      const player = state.players[action.playerId]
      if (!player) return state

      const castAction = action as import('./actions').CastCommanderAction
      const cardIndex = player.zones.commandZone.findIndex(c => c.instanceId === castAction.instanceId)
      if (cardIndex === -1) return state

      const card = player.zones.commandZone[cardIndex]
      const castCard: CardInstance = {
        ...card,
        faceDown: false,
        tapped: false,
        commanderCastCount: (card.commanderCastCount ?? 0) + 1,
        summoningSick: true,
        x: castAction.x ?? 0,
        y: castAction.y ?? 0,
        subfieldZone: 'creatures',
        zIndex: nextBattlefieldZ(player),
      }

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            zones: {
              ...player.zones,
              commandZone: player.zones.commandZone.filter((_, i) => i !== cardIndex),
              battlefield: [...player.zones.battlefield, castCard],
            },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} cast ${card.name} from the command zone.`, 'play'),
        updatedAt: action.timestamp,
      }
    }

    case 'TAP_CARD': {
      const player = state.players[action.playerId]
      if (!player) return state

      const tapAction = action as import('./actions').TapCardAction
      const found = findCardInZones(player.zones, tapAction.instanceId)
      if (!found) return state

      const updatedZone = player.zones[found.zone].map(c =>
        c.instanceId === tapAction.instanceId ? { ...c, tapped: true } : c
      )

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            zones: { ...player.zones, [found.zone]: updatedZone },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} tapped ${found.card.name}.`, 'tap'),
        updatedAt: action.timestamp,
      }
    }

    case 'TAP_TOKEN': {
      const player = state.players[action.playerId]
      if (!player) return state

      const tapAction = action as import('./actions').TapTokenAction
      const token = state.tokens.find(item => item.instanceId === tapAction.instanceId && item.ownerId === action.playerId)
      if (!token) return state

      return {
        ...next,
        tokens: state.tokens.map(item =>
          item.instanceId === tapAction.instanceId ? { ...item, tapped: true } : item
        ),
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} tapped ${token.name}.`, 'tap'),
        updatedAt: action.timestamp,
      }
    }

    case 'UNTAP_CARD': {
      const player = state.players[action.playerId]
      if (!player) return state

      const untapAction = action as import('./actions').UntapCardAction
      const found = findCardInZones(player.zones, untapAction.instanceId)
      if (!found) return state

      const updatedZone = player.zones[found.zone].map(c =>
        c.instanceId === untapAction.instanceId ? { ...c, tapped: false } : c
      )

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            zones: { ...player.zones, [found.zone]: updatedZone },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} untapped ${found.card.name}.`, 'tap'),
        updatedAt: action.timestamp,
      }
    }

    case 'UNTAP_TOKEN': {
      const player = state.players[action.playerId]
      if (!player) return state

      const untapAction = action as import('./actions').UntapTokenAction
      const token = state.tokens.find(item => item.instanceId === untapAction.instanceId && item.ownerId === action.playerId)
      if (!token) return state

      return {
        ...next,
        tokens: state.tokens.map(item =>
          item.instanceId === untapAction.instanceId ? { ...item, tapped: false } : item
        ),
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} untapped ${token.name}.`, 'tap'),
        updatedAt: action.timestamp,
      }
    }

    case 'UNTAP_ALL': {
      const player = state.players[action.playerId]
      if (!player) return state

      const untappedBattlefield = player.zones.battlefield.map(c => ({ ...c, tapped: false }))
      const untappedTokens = state.tokens.map(token =>
        token.ownerId === action.playerId ? { ...token, tapped: false } : token
      )

      return {
        ...next,
        tokens: untappedTokens,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            zones: { ...player.zones, battlefield: untappedBattlefield },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} untapped all permanents.`, 'tap'),
        updatedAt: action.timestamp,
      }
    }

    case 'MOVE_CARD': {
      const moveAction = action as import('./actions').MoveCardAction
      const sourcePlayer = state.players[action.playerId]
      const targetPlayerId = moveAction.targetPlayerId ?? action.playerId
      const targetPlayer = state.players[targetPlayerId]
      if (!sourcePlayer || !targetPlayer) return state

      const fromZone = moveAction.fromZone
      const toZone = moveAction.toZone
      const cardIndex = sourcePlayer.zones[fromZone].findIndex(c => c.instanceId === moveAction.instanceId)
      if (cardIndex === -1) return state

      const card = sourcePlayer.zones[fromZone][cardIndex]
      const movedCard = {
        ...normalizeMovedCard(card, toZone, moveAction.x, moveAction.y),
        zIndex: toZone === 'battlefield' ? nextBattlefieldZ(targetPlayer) : undefined,
      }

      const updatedSourceZones = {
        ...sourcePlayer.zones,
        [fromZone]: sourcePlayer.zones[fromZone].filter((_, i) => i !== cardIndex),
      }

      if (action.playerId === targetPlayerId) {
        return {
          ...next,
          players: {
            ...state.players,
            [action.playerId]: {
              ...sourcePlayer,
              zones: {
                ...updatedSourceZones,
                [toZone]: [...sourcePlayer.zones[toZone], movedCard],
              },
            },
          },
          lastAction: asRaw(action),
          log: addLog(next, action.playerId, `${sourcePlayer.displayName} moved ${card.name} to ${toZone}.`, 'move'),
          updatedAt: action.timestamp,
        }
      }

      // Cross-player move
      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: { ...sourcePlayer, zones: updatedSourceZones },
          [targetPlayerId]: {
            ...targetPlayer,
            zones: {
              ...targetPlayer.zones,
              [toZone]: [...targetPlayer.zones[toZone], movedCard],
            },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${sourcePlayer.displayName} moved ${card.name} to ${targetPlayer.displayName}'s ${toZone}.`, 'move'),
        updatedAt: action.timestamp,
      }
    }

    case 'MOVE_CARD_ON_BOARD': {
      const boardMoveAction = action as import('./actions').MoveCardOnBoardAction
      const player = state.players[action.playerId]
      if (!player) return state

      const card = player.zones.battlefield.find(c => c.instanceId === boardMoveAction.instanceId)
      if (!card) return state

      const movedCard = { ...card, x: boardMoveAction.x, y: boardMoveAction.y, zIndex: nextBattlefieldZ(player) }
      const updatedBattlefield = [
        ...player.zones.battlefield.filter(c => c.instanceId !== boardMoveAction.instanceId),
        movedCard,
      ]

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            zones: { ...player.zones, battlefield: updatedBattlefield },
          },
        },
        lastAction: asRaw(action),
        updatedAt: action.timestamp,
      }
    }

    case 'MOVE_TOKEN_ON_BOARD': {
      const tokenMoveAction = action as import('./actions').MoveTokenOnBoardAction
      const token = state.tokens.find(item => item.instanceId === tokenMoveAction.instanceId && item.ownerId === action.playerId)
      if (!token) return state

      const movedToken: TokenInstance = {
        ...token,
        x: tokenMoveAction.x,
        y: tokenMoveAction.y,
        subfieldZone: tokenMoveAction.subfieldZone ?? token.subfieldZone,
        zIndex: nextTokenZ(state),
      }

      return {
        ...next,
        tokens: [
          ...state.tokens.filter(item => item.instanceId !== tokenMoveAction.instanceId),
          movedToken,
        ],
        lastAction: asRaw(action),
        updatedAt: action.timestamp,
      }
    }

    case 'MULTI_SELECT_ACTION': {
      const player = state.players[action.playerId]
      if (!player) return state

      const multiAction = action as import('./actions').MultiSelectAction
      const selectedIds = new Set(multiAction.instanceIds)
      if (selectedIds.size === 0) return state

      if (multiAction.operation === 'tap' || multiAction.operation === 'untap') {
        const tapped = multiAction.operation === 'tap'
        const updatedBattlefield = player.zones.battlefield.map(card =>
          selectedIds.has(card.instanceId) ? { ...card, tapped } : card
        )
        const changedCount = updatedBattlefield.filter((card, index) => card !== player.zones.battlefield[index]).length
        if (changedCount === 0) return state

        return {
          ...next,
          players: {
            ...state.players,
            [action.playerId]: {
              ...player,
              zones: { ...player.zones, battlefield: updatedBattlefield },
            },
          },
          lastAction: asRaw(action),
          log: addLog(next, action.playerId, `${player.displayName} ${tapped ? 'tapped' : 'untapped'} ${changedCount} permanents.`, 'tap'),
          updatedAt: action.timestamp,
        }
      }

      if (multiAction.operation === 'addCounter' || multiAction.operation === 'removeCounter') {
        const counterType = multiAction.counterType
        const amount = Math.max(1, Math.floor(multiAction.amount ?? 1))
        if (!counterType) return state

        const direction = multiAction.operation === 'addCounter' ? 1 : -1
        const updatedBattlefield = player.zones.battlefield.map(card =>
          selectedIds.has(card.instanceId) ? updateCounter(card, counterType, amount, multiAction.label, direction) : card
        )
        const changedCount = updatedBattlefield.filter((card, index) => card !== player.zones.battlefield[index]).length
        if (changedCount === 0) return state

        const verb = direction === 1 ? 'added' : 'removed'
        return {
          ...next,
          players: {
            ...state.players,
            [action.playerId]: {
              ...player,
              zones: { ...player.zones, battlefield: updatedBattlefield },
            },
          },
          lastAction: asRaw(action),
          log: addLog(next, action.playerId, `${player.displayName} ${verb} ${formatCounter(counterType, multiAction.label)}s ${direction === 1 ? 'to' : 'from'} ${changedCount} permanents.`, 'counter'),
          updatedAt: action.timestamp,
        }
      }

      if (multiAction.operation === 'markDamage') {
        const amount = Math.floor(multiAction.amount ?? 0)
        if (amount === 0) return state

        const updatedBattlefield = player.zones.battlefield.map(card =>
          selectedIds.has(card.instanceId) ? { ...card, markedDamage: Math.max(0, card.markedDamage + amount) } : card
        )
        const changedCount = updatedBattlefield.filter((card, index) => card !== player.zones.battlefield[index]).length
        if (changedCount === 0) return state

        return {
          ...next,
          players: {
            ...state.players,
            [action.playerId]: {
              ...player,
              zones: { ...player.zones, battlefield: updatedBattlefield },
            },
          },
          lastAction: asRaw(action),
          log: addLog(next, action.playerId, `${player.displayName} ${amount > 0 ? 'marked' : 'removed'} damage on ${changedCount} permanents.`, 'counter'),
          updatedAt: action.timestamp,
        }
      }

      if (multiAction.operation === 'clearDamage') {
        const updatedBattlefield = player.zones.battlefield.map(card =>
          selectedIds.has(card.instanceId) && card.markedDamage > 0 ? { ...card, markedDamage: 0 } : card
        )
        const changedCount = updatedBattlefield.filter((card, index) => card !== player.zones.battlefield[index]).length
        if (changedCount === 0) return state

        return {
          ...next,
          players: {
            ...state.players,
            [action.playerId]: {
              ...player,
              zones: { ...player.zones, battlefield: updatedBattlefield },
            },
          },
          lastAction: asRaw(action),
          log: addLog(next, action.playerId, `${player.displayName} cleared marked damage from ${changedCount} permanents.`, 'counter'),
          updatedAt: action.timestamp,
        }
      }

      const toZone = multiAction.toZone
      if (multiAction.operation !== 'move' || !toZone || toZone === 'battlefield') return state

      const movingCards = player.zones.battlefield.filter(card => selectedIds.has(card.instanceId))
      if (movingCards.length === 0) return state

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            zones: {
              ...player.zones,
              battlefield: player.zones.battlefield.filter(card => !selectedIds.has(card.instanceId)),
              [toZone]: [
                ...player.zones[toZone],
                ...movingCards.map(card => normalizeMovedCard(card, toZone)),
              ],
            },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} moved ${movingCards.length} permanents to ${toZone}.`, 'move'),
        updatedAt: action.timestamp,
      }
    }

    case 'ADD_TOKEN': {
      const player = state.players[action.playerId]
      if (!player) return state

      const tokenAction = action as import('./actions').AddTokenAction
      const name = tokenAction.name.trim()
      if (!name) return state

      const token: TokenInstance = {
        instanceId: `tok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ownerId: action.playerId,
        name,
        cardId: tokenAction.cardId,
        tapped: false,
        x: tokenAction.x,
        y: tokenAction.y,
        counters: {},
        attachments: [],
        markedDamage: 0,
        subfieldZone: tokenAction.subfieldZone,
        zIndex: nextTokenZ(state),
      }

      return {
        ...next,
        tokens: [...state.tokens, token],
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} created a ${name} token.`, 'play'),
        updatedAt: action.timestamp,
      }
    }

    case 'REMOVE_TOKEN': {
      const player = state.players[action.playerId]
      if (!player) return state

      const removeAction = action as import('./actions').RemoveTokenAction
      const token = state.tokens.find(item => item.instanceId === removeAction.instanceId && item.ownerId === action.playerId)
      if (!token) return state

      return {
        ...next,
        tokens: state.tokens.filter(item => item.instanceId !== removeAction.instanceId),
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} removed ${token.name}.`, 'move'),
        updatedAt: action.timestamp,
      }
    }

    case 'ADD_COUNTER':
    case 'REMOVE_COUNTER': {
      const player = state.players[action.playerId]
      if (!player) return state

      const counterAction = action as import('./actions').AddCounterAction | import('./actions').RemoveCounterAction
      const direction = action.type === 'ADD_COUNTER' ? 1 : -1
      const updated = withUpdatedCard(player, counterAction.instanceId, card =>
        updateCounter(card, counterAction.counterType, counterAction.amount, counterAction.label, direction)
      )
      if (updated && updated.card !== updated.updatedCard) {
        const verb = direction === 1 ? 'added' : 'removed'
        return {
          ...next,
          players: {
            ...state.players,
            [action.playerId]: updated.player,
          },
          lastAction: asRaw(action),
          log: addLog(next, action.playerId, `${player.displayName} ${verb} ${formatCounter(counterAction.counterType, counterAction.label)} on ${updated.card.name}.`, 'counter'),
          updatedAt: action.timestamp,
        }
      }

      const token = state.tokens.find(item => item.instanceId === counterAction.instanceId && item.ownerId === action.playerId)
      if (!token) return state

      const updatedToken = updateCounter(token, counterAction.counterType, counterAction.amount, counterAction.label, direction)
      if (updatedToken === token) return state

      const verb = direction === 1 ? 'added' : 'removed'
      return {
        ...next,
        tokens: state.tokens.map(item => item.instanceId === counterAction.instanceId ? updatedToken : item),
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} ${verb} ${formatCounter(counterAction.counterType, counterAction.label)} on ${token.name}.`, 'counter'),
        updatedAt: action.timestamp,
      }
    }

    case 'MARK_DAMAGE': {
      const player = state.players[action.playerId]
      if (!player) return state

      const damageAction = action as import('./actions').MarkDamageAction
      const amount = Math.floor(damageAction.amount)
      if (amount === 0) return state

      const updated = withUpdatedCard(player, damageAction.instanceId, card => ({
        ...card,
        markedDamage: Math.max(0, card.markedDamage + amount),
      }))
      if (updated && updated.card.markedDamage !== updated.updatedCard.markedDamage) {
        return {
          ...next,
          players: {
            ...state.players,
            [action.playerId]: updated.player,
          },
          lastAction: asRaw(action),
          log: addLog(next, action.playerId, `${player.displayName} set ${updated.card.name} to ${updated.updatedCard.markedDamage} marked damage.`, 'counter'),
          updatedAt: action.timestamp,
        }
      }

      const token = state.tokens.find(item => item.instanceId === damageAction.instanceId && item.ownerId === action.playerId)
      if (!token) return state

      const markedDamage = Math.max(0, token.markedDamage + amount)
      if (markedDamage === token.markedDamage) return state
      return {
        ...next,
        tokens: state.tokens.map(item =>
          item.instanceId === damageAction.instanceId ? { ...item, markedDamage } : item
        ),
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} set ${token.name} to ${markedDamage} marked damage.`, 'counter'),
        updatedAt: action.timestamp,
      }
    }

    case 'CLEAR_DAMAGE': {
      const player = state.players[action.playerId]
      if (!player) return state

      const clearAction = action as import('./actions').ClearDamageAction
      const updated = withUpdatedCard(player, clearAction.instanceId, card => ({ ...card, markedDamage: 0 }))
      if (updated && updated.card.markedDamage !== 0) {
        return {
          ...next,
          players: {
            ...state.players,
            [action.playerId]: updated.player,
          },
          lastAction: asRaw(action),
          log: addLog(next, action.playerId, `${player.displayName} cleared marked damage from ${updated.card.name}.`, 'counter'),
          updatedAt: action.timestamp,
        }
      }

      const token = state.tokens.find(item => item.instanceId === clearAction.instanceId && item.ownerId === action.playerId)
      if (!token || token.markedDamage === 0) return state

      return {
        ...next,
        tokens: state.tokens.map(item =>
          item.instanceId === clearAction.instanceId ? { ...item, markedDamage: 0 } : item
        ),
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} cleared marked damage from ${token.name}.`, 'counter'),
        updatedAt: action.timestamp,
      }
    }

    case 'SHUFFLE_LIBRARY': {
      const player = state.players[action.playerId]
      if (!player) return state

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            zones: { ...player.zones, library: shuffleLibrary(player.zones.library) },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} shuffled their library.`, 'system'),
        updatedAt: action.timestamp,
      }
    }

    case 'REVEAL_TOP_X': {
      const player = state.players[action.playerId]
      if (!player) return state

      const revealAction = action as import('./actions').RevealTopXAction
      const count = Math.max(0, Math.floor(revealAction.count))
      const revealed = player.zones.library.slice(0, count)
      if (revealed.length === 0) return state

      return {
        ...next,
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} revealed ${revealed.map(card => card.name).join(', ')} from the top of their library.`, 'system'),
        updatedAt: action.timestamp,
      }
    }

    case 'MILL_X': {
      const player = state.players[action.playerId]
      if (!player) return state

      const millAction = action as import('./actions').MillXAction
      const count = Math.max(0, Math.floor(millAction.count))
      const milled = player.zones.library.slice(0, count).map(card => ({ ...card, faceDown: false }))
      if (milled.length === 0) return state

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            zones: {
              ...player.zones,
              library: player.zones.library.slice(milled.length),
              graveyard: [...player.zones.graveyard, ...milled],
            },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} milled ${milled.length} cards.`, 'move'),
        updatedAt: action.timestamp,
      }
    }

    case 'SCRY_X': {
      const player = state.players[action.playerId]
      if (!player) return state

      const scryAction = action as import('./actions').ScryXAction
      const count = Math.max(0, Math.floor(scryAction.count))
      const topCards = player.zones.library.slice(0, count)
      if (topCards.length === 0) return state

      const topById = new Map(topCards.map(card => [card.instanceId, card]))
      const bottomIds = new Set(scryAction.bottomInstanceIds)
      const orderedTopIds = scryAction.topInstanceIds.filter(id => topById.has(id) && !bottomIds.has(id))
      const keptTop = [
        ...orderedTopIds.map(id => topById.get(id)).filter(card => Boolean(card)),
        ...topCards.filter(card => !bottomIds.has(card.instanceId) && !orderedTopIds.includes(card.instanceId)),
      ] as CardInstance[]
      const movedBottom = [
        ...scryAction.bottomInstanceIds.map(id => topById.get(id)).filter(card => Boolean(card)),
        ...topCards.filter(card => bottomIds.has(card.instanceId) && !scryAction.bottomInstanceIds.includes(card.instanceId)),
      ] as CardInstance[]
      const rest = player.zones.library.slice(topCards.length)

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            zones: {
              ...player.zones,
              library: [...keptTop, ...rest, ...movedBottom],
            },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} scried ${topCards.length}${movedBottom.length > 0 ? ` and put ${movedBottom.length} on the bottom` : ''}.`, 'system'),
        updatedAt: action.timestamp,
      }
    }

    case 'TUTOR': {
      const player = state.players[action.playerId]
      if (!player) return state

      const tutorAction = action as import('./actions').TutorAction
      const tutored = player.zones.library.find(card => card.instanceId === tutorAction.instanceId)
      if (!tutored) return state

      const remainingLibrary = player.zones.library.filter(card => card.instanceId !== tutorAction.instanceId)
      const library = tutorAction.shuffleAfter ? shuffleLibrary(remainingLibrary) : remainingLibrary

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            zones: {
              ...player.zones,
              library,
              hand: [...player.zones.hand, { ...tutored, faceDown: false }],
            },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} tutored for a card${tutorAction.shuffleAfter ? ' and shuffled' : ''}.`, 'system'),
        updatedAt: action.timestamp,
      }
    }

    case 'SET_LIFE': {
      const player = state.players[action.playerId]
      if (!player) return state

      const lifeAction = action as import('./actions').SetLifeAction
      const players = withEvaluatedLosses({
        ...state.players,
        [action.playerId]: {
          ...player,
          stats: { ...player.stats, life: lifeAction.life },
        },
      }, action.timestamp)

      return {
        ...next,
        players,
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} set life to ${lifeAction.life}.`, 'stat'),
        updatedAt: action.timestamp,
      }
    }

    case 'SET_POISON': {
      const player = state.players[action.playerId]
      if (!player) return state

      const poisonAction = action as import('./actions').SetPoisonAction
      const poisonCounters = Math.max(0, poisonAction.poisonCounters)
      const players = withEvaluatedLosses({
        ...state.players,
        [action.playerId]: {
          ...player,
          stats: { ...player.stats, poisonCounters },
        },
      }, action.timestamp)

      return {
        ...next,
        players,
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} set poison to ${poisonCounters}.`, 'stat'),
        updatedAt: action.timestamp,
      }
    }

    case 'SET_COMMANDER_DAMAGE': {
      const player = state.players[action.playerId]
      if (!player) return state

      const commanderAction = action as import('./actions').SetCommanderDamageAction
      const damage = Math.max(0, commanderAction.damage)
      const sourcePlayerName = state.players[commanderAction.commanderPlayerId]?.displayName ?? 'a commander'
      const players = withEvaluatedLosses({
        ...state.players,
        [action.playerId]: {
          ...player,
          stats: {
            ...player.stats,
            commanderDamage: {
              ...player.stats.commanderDamage,
              [commanderAction.commanderPlayerId]: damage,
            },
          },
        },
      }, action.timestamp)

      return {
        ...next,
        players,
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} set commander damage from ${sourcePlayerName} to ${damage}.`, 'stat'),
        updatedAt: action.timestamp,
      }
    }

    case 'SET_ENERGY': {
      const player = state.players[action.playerId]
      if (!player) return state

      const energyAction = action as import('./actions').SetEnergyAction
      const energyCounters = Math.max(0, energyAction.energyCounters)

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            stats: { ...player.stats, energyCounters },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} set energy to ${energyCounters}.`, 'stat'),
        updatedAt: action.timestamp,
      }
    }

    case 'SET_EXPERIENCE': {
      const player = state.players[action.playerId]
      if (!player) return state

      const experienceAction = action as import('./actions').SetExperienceAction
      const experienceCounters = Math.max(0, experienceAction.experienceCounters)

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            stats: { ...player.stats, experienceCounters },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} set experience to ${experienceCounters}.`, 'stat'),
        updatedAt: action.timestamp,
      }
    }

    case 'PLAYER_CONCEDE': {
      const player = state.players[action.playerId]
      if (!player) return state

      return {
        ...next,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            loss: {
              reason: 'conceded',
              message: `${player.displayName} conceded the game.`,
              timestamp: action.timestamp,
            },
          },
        },
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} conceded the game.`, 'system'),
        updatedAt: action.timestamp,
      }
    }

    case 'NEXT_PHASE': {
      const currentPhaseIndex = TURN_PHASES.indexOf(state.turn.phase)
      const nextPhaseIndex = currentPhaseIndex === TURN_PHASES.length - 1 ? 0 : currentPhaseIndex + 1
      const nextPhase = TURN_PHASES[nextPhaseIndex]
      const seatedPlayers = Object.values(state.players).sort((a, b) => a.seatIndex - b.seatIndex)
      const activeIndex = seatedPlayers.findIndex(player => player.id === state.turn.activePlayerId)
      const nextActivePlayer =
        nextPhase === 'untap'
          ? seatedPlayers[(activeIndex + 1 + seatedPlayers.length) % seatedPlayers.length]
          : state.players[state.turn.activePlayerId]

      if (!nextActivePlayer) return state

      let updatedActivePlayer = nextActivePlayer
      if (nextPhase === 'untap') {
        updatedActivePlayer = {
          ...updatedActivePlayer,
          zones: {
            ...updatedActivePlayer.zones,
            battlefield: updatedActivePlayer.zones.battlefield.map(card => ({ ...card, tapped: false })),
          },
        }
      }
      if (nextPhase === 'draw') updatedActivePlayer = drawCards(updatedActivePlayer, 1)

      return {
        ...next,
        turn: {
          number: nextPhase === 'untap' ? state.turn.number + 1 : state.turn.number,
          activePlayerId: updatedActivePlayer.id,
          phase: nextPhase,
        },
        players: {
          ...state.players,
          [updatedActivePlayer.id]: updatedActivePlayer,
        },
        lastAction: asRaw(action),
        log: addLog(next, updatedActivePlayer.id, `Moved to ${nextPhase.replaceAll('_', ' ')}.`, 'system'),
        updatedAt: action.timestamp,
      }
    }

    case 'ROLL_DICE': {
      const player = state.players[action.playerId]
      if (!player) return state
      const rollAction = action as import('./actions').RollDiceAction
      return {
        ...next,
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} rolled a d${rollAction.sides} and got ${rollAction.result}.`, 'roll'),
        updatedAt: action.timestamp,
      }
    }

    case 'FLIP_COIN': {
      const player = state.players[action.playerId]
      if (!player) return state
      const coinAction = action as import('./actions').FlipCoinAction
      return {
        ...next,
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} flipped a coin: ${coinAction.result}!`, 'roll'),
        updatedAt: action.timestamp,
      }
    }

    case 'TAKE_BACK': {
      if (!state.previousState) return state
      return {
        ...state.previousState,
        previousState: null,
        log: addLog(state, action.playerId, `${state.players[action.playerId]?.displayName ?? 'Host'} took back the last action.`, 'system'),
      }
    }

    case 'PLAYER_CONNECT': {
      const player = state.players[action.playerId]
      if (!player) return state
      const connectAction = action as import('./actions').PlayerConnectAction
      if (player.connected === connectAction.connected) return state
      // Connection changes don't update previousState — they're ephemeral housekeeping
      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: { ...player, connected: connectAction.connected },
        },
        lastAction: asRaw(action),
        updatedAt: action.timestamp,
      }
    }

    case 'HOST_VOTE_INITIATE': {
      const player = state.players[action.playerId]
      if (!player || player.seatIndex !== 0) return state
      if (state.pendingVote) return state

      const voteAction = action as import('./actions').HostVoteInitiateAction
      // Do NOT use `next` here — preserving previousState so TAKE_BACK votes can still restore it
      return {
        ...state,
        pendingVote: {
          id: voteAction.voteId,
          topic: voteAction.topic,
          actionType: voteAction.actionType,
          initiatorId: action.playerId,
          votes: {},
        },
        lastAction: asRaw(action),
        log: addLog(state, action.playerId, `${player.displayName} called a vote: "${voteAction.topic}"`, 'vote'),
        updatedAt: action.timestamp,
      }
    }

    case 'HOST_VOTE_CAST': {
      if (!state.pendingVote) return state

      const castAction = action as import('./actions').HostVoteCastAction
      if (castAction.voteId !== state.pendingVote.id) return state

      const player = state.players[action.playerId]
      if (!player || player.isSpectator) return state

      const updatedVotes: Record<string, 'yes' | 'no'> = { ...state.pendingVote.votes, [action.playerId]: castAction.vote }
      const updatedVote: VoteState = { ...state.pendingVote, votes: updatedVotes }

      const nonSpectators = Object.values(state.players).filter(p => !p.isSpectator)
      const majority = Math.floor(nonSpectators.length / 2) + 1
      const yesCount = Object.values(updatedVotes).filter(v => v === 'yes').length
      const noCount = Object.values(updatedVotes).filter(v => v === 'no').length
      const allVoted = Object.keys(updatedVotes).length === nonSpectators.length

      const castBase = {
        ...state,
        pendingVote: updatedVote,
        lastAction: asRaw(action),
        log: addLog(state, action.playerId, `${player.displayName} voted ${castAction.vote}.`, 'vote'),
        updatedAt: action.timestamp,
      }

      if (yesCount >= majority || noCount >= majority || allVoted) {
        return applyVoteResolution(castBase, updatedVote, action.playerId, action.timestamp)
      }

      return castBase
    }

    case 'HOST_VOTE_RESOLVE': {
      if (!state.pendingVote) return state

      const resolveAction = action as import('./actions').HostVoteResolveAction
      if (resolveAction.voteId !== state.pendingVote.id) return state

      const player = state.players[action.playerId]
      if (!player || player.seatIndex !== 0) return state

      return applyVoteResolution(state, state.pendingVote, action.playerId, action.timestamp)
    }

    case 'GAME_END': {
      const player = state.players[action.playerId]
      if (!player || player.seatIndex !== 0) return state

      return {
        ...next,
        status: 'ended',
        lastAction: asRaw(action),
        log: addLog(next, action.playerId, `${player.displayName} ended the game.`, 'system'),
        updatedAt: action.timestamp,
      }
    }

    case 'MATCH_END': {
      const player = state.players[action.playerId]
      if (!player || player.seatIndex !== 0) return state

      const matchEndAction = action as import('./actions').MatchEndAction
      const winner = state.players[matchEndAction.winnerId]
      if (!winner) return state

      const updatedMatchScore = {
        ...state.matchScore,
        [matchEndAction.winnerId]: (state.matchScore[matchEndAction.winnerId] ?? 0) + 1,
      }
      const gamesPlayed = Object.values(updatedMatchScore).reduce((a, b) => a + b, 0)

      return {
        ...state,
        previousState: null,
        pendingVote: null,
        status: 'sideboard',
        matchScore: updatedMatchScore,
        sideboardReadyIds: [],
        lastAction: asRaw(action),
        log: addLog(state, action.playerId, `${winner.displayName} won game ${gamesPlayed}!`, 'system'),
        updatedAt: action.timestamp,
      }
    }

    case 'SIDEBOARD_CONFIRM': {
      const player = state.players[action.playerId]
      if (!player || player.isSpectator) return state
      if (state.sideboardReadyIds.includes(action.playerId)) return state

      return {
        ...state,
        sideboardReadyIds: [...state.sideboardReadyIds, action.playerId],
        lastAction: asRaw(action),
        log: addLog(state, action.playerId, `${player.displayName} is ready for the next game.`, 'system'),
        updatedAt: action.timestamp,
      }
    }

    default:
      return state
  }
}

function applyVoteResolution(
  state: GameState,
  vote: VoteState,
  resolverId: string,
  timestamp: string
): GameState {
  const nonSpectators = Object.values(state.players).filter(p => !p.isSpectator)
  const majority = Math.floor(nonSpectators.length / 2) + 1
  const yesCount = Object.values(vote.votes).filter(v => v === 'yes').length
  const passed = yesCount >= majority

  const resolvedState = { ...state, pendingVote: null, updatedAt: timestamp }

  if (passed && vote.actionType === 'TAKE_BACK') {
    if (!state.previousState) {
      return {
        ...resolvedState,
        log: addLog(state, resolverId, `Vote "${vote.topic}": yes — nothing to take back.`, 'vote'),
      }
    }
    return {
      ...state.previousState,
      previousState: null,
      pendingVote: null,
      log: addLog(state, resolverId, `Vote "${vote.topic}": yes — last action taken back.`, 'vote'),
      updatedAt: timestamp,
    }
  }

  if (passed && vote.actionType === 'GAME_END') {
    return {
      ...resolvedState,
      status: 'ended',
      log: addLog(state, resolverId, `Vote "${vote.topic}": yes — game ended.`, 'vote'),
    }
  }

  return {
    ...resolvedState,
    log: addLog(state, resolverId, `Vote "${vote.topic}": no.`, 'vote'),
  }
}

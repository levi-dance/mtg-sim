import { applyAction } from '@/lib/game/reducer'
import type { GameState } from '@/types/game'

function makeState(): GameState {
  const createdAt = '2026-05-12T10:00:00.000Z'
  const makeLibraryCard = (index: number) => ({
    instanceId: `inst_${index}`,
    cardId: `card_${index}`,
    name: index === 1 ? 'Forest' : `Test Card ${index}`,
    faceDown: true,
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

  return {
    sessionId: 'session',
    mode: '1v1',
    format: 'commander',
    status: 'active',
    matchScore: {},
    sideboardReadyIds: [],
    turn: { number: 1, activePlayerId: 'player_a', phase: 'main1' },
    players: {
      player_a: {
        id: 'player_a',
        displayName: 'Levi',
        ownerToken: 'token',
        seatIndex: 0,
        isSpectator: false,
        connected: true,
        deckId: 'deck',
        stats: {
          life: 40,
          poisonCounters: 0,
          commanderDamage: { player_b: 0 },
          energyCounters: 0,
          experienceCounters: 0,
        },
        zones: {
          library: [1, 2, 3, 4].map(makeLibraryCard),
          hand: [],
          battlefield: [],
          graveyard: [],
          exile: [],
          commandZone: [
            {
              instanceId: 'inst_commander',
              cardId: 'card_commander',
              name: 'Atraxa, Praetors Voice',
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
            },
          ],
        },
      },
      player_b: {
        id: 'player_b',
        displayName: 'Alex',
        ownerToken: 'token_b',
        seatIndex: 1,
        isSpectator: false,
        connected: true,
        deckId: 'deck_b',
        stats: {
          life: 40,
          poisonCounters: 0,
          commanderDamage: { player_a: 0 },
          energyCounters: 0,
          experienceCounters: 0,
        },
        zones: {
          library: [],
          hand: [],
          battlefield: [],
          graveyard: [],
          exile: [],
          commandZone: [],
        },
      },
    },
    tokens: [],
    log: [],
    lastAction: null,
    previousState: null,
    pendingVote: null,
    settings: {
      startingLife: 40,
      startingHandSize: 7,
      mulliganRule: 'london',
      friendlyMulliganCount: null,
      matchLength: 3,
      allowSpectators: true,
    },
    createdAt,
    updatedAt: createdAt,
  }
}

export function verifyReducerDispatchFlow(): void {
  const first = applyAction(makeState(), {
    type: 'DRAW_CARD',
    playerId: 'player_a',
    timestamp: '2026-05-12T10:01:00.000Z',
  })
  const second = applyAction(first, {
    type: 'SET_LIFE',
    playerId: 'player_a',
    life: 39,
    timestamp: '2026-05-12T10:02:00.000Z',
  })

  if (second.previousState?.previousState !== null) {
    throw new Error('previousState must remain one level deep.')
  }
  if (second.players.player_a.stats.life !== 39) {
    throw new Error('Optimistic reducer flow did not apply the latest action.')
  }

  const cast = applyAction(second, {
    type: 'CAST_COMMANDER',
    playerId: 'player_a',
    instanceId: 'inst_commander',
    timestamp: '2026-05-12T10:03:00.000Z',
    x: 100,
    y: 200,
  })
  const commander = cast.players.player_a.zones.battlefield.find(card => card.instanceId === 'inst_commander')
  if (commander?.commanderCastCount !== 1) {
    throw new Error('Commander casts must increment commanderCastCount.')
  }

  const counteredCommander = applyAction(applyAction(cast, {
    type: 'ADD_COUNTER',
    playerId: 'player_a',
    instanceId: 'inst_commander',
    counterType: 'plusOne',
    amount: 2,
    timestamp: '2026-05-12T10:03:10.000Z',
  }), {
    type: 'MARK_DAMAGE',
    playerId: 'player_a',
    instanceId: 'inst_commander',
    amount: 4,
    timestamp: '2026-05-12T10:03:20.000Z',
  })
  const commanderReturned = applyAction(counteredCommander, {
    type: 'MOVE_CARD',
    playerId: 'player_a',
    instanceId: 'inst_commander',
    fromZone: 'battlefield',
    toZone: 'commandZone',
    timestamp: '2026-05-12T10:03:30.000Z',
  })
  const returnedCommander = commanderReturned.players.player_a.zones.commandZone.find(card => card.instanceId === 'inst_commander')
  if (!returnedCommander || returnedCommander.commanderCastCount !== 1 || returnedCommander.markedDamage !== 0 || returnedCommander.counters.plusOne) {
    throw new Error('Returning a commander to command zone must clear battlefield counters and damage but preserve commanderCastCount.')
  }

  const moved = applyAction(cast, {
    type: 'MOVE_CARD',
    playerId: 'player_a',
    instanceId: 'inst_commander',
    fromZone: 'battlefield',
    toZone: 'library',
    timestamp: '2026-05-12T10:04:00.000Z',
  })
  const libraryCard = moved.players.player_a.zones.library.find(card => card.instanceId === 'inst_commander')
  if (!libraryCard?.faceDown || libraryCard.x !== null || libraryCard.y !== null) {
    throw new Error('Moving a card to library must clear table position and hide the card.')
  }

  const battleReady = applyAction(moved, {
    type: 'MOVE_CARD',
    playerId: 'player_a',
    instanceId: 'inst_commander',
    fromZone: 'library',
    toZone: 'battlefield',
    timestamp: '2026-05-12T10:05:00.000Z',
    x: 100,
    y: 200,
  })
  const tapped = applyAction(battleReady, {
    type: 'MULTI_SELECT_ACTION',
    playerId: 'player_a',
    instanceIds: ['inst_commander'],
    operation: 'tap',
    timestamp: '2026-05-12T10:06:00.000Z',
  })
  if (!tapped.players.player_a.zones.battlefield[0]?.tapped) {
    throw new Error('Bulk tap must tap selected battlefield cards.')
  }

  const movedBulk = applyAction(tapped, {
    type: 'MULTI_SELECT_ACTION',
    playerId: 'player_a',
    instanceIds: ['inst_commander'],
    operation: 'move',
    toZone: 'exile',
    timestamp: '2026-05-12T10:07:00.000Z',
  })
  if (movedBulk.players.player_a.zones.exile[0]?.instanceId !== 'inst_commander') {
    throw new Error('Bulk move must move selected battlefield cards to the target zone.')
  }

  const twoCards = applyAction(movedBulk, {
    type: 'MOVE_CARD',
    playerId: 'player_a',
    instanceId: 'inst_commander',
    fromZone: 'exile',
    toZone: 'battlefield',
    timestamp: '2026-05-12T10:08:00.000Z',
    x: 100,
    y: 200,
  })
  const secondPermanent = applyAction(twoCards, {
    type: 'MOVE_CARD',
    playerId: 'player_a',
    instanceId: 'inst_2',
    fromZone: 'library',
    toZone: 'battlefield',
    timestamp: '2026-05-12T10:09:00.000Z',
    x: 120,
    y: 220,
  })
  const topMoved = applyAction(secondPermanent, {
    type: 'MOVE_CARD_ON_BOARD',
    playerId: 'player_a',
    instanceId: 'inst_2',
    x: 300,
    y: 300,
    timestamp: '2026-05-12T10:10:00.000Z',
  })
  if (topMoved.players.player_a.zones.battlefield.at(-1)?.instanceId !== 'inst_2') {
    throw new Error('Moving a battlefield card must make it the topmost battlefield card.')
  }

  const libraryState = makeState()
  const revealed = applyAction(libraryState, {
    type: 'REVEAL_TOP_X',
    playerId: 'player_a',
    count: 2,
    timestamp: '2026-05-12T10:11:00.000Z',
  })
  if (revealed.players.player_a.zones.library.length !== libraryState.players.player_a.zones.library.length) {
    throw new Error('Reveal top must not move library cards.')
  }
  if (!revealed.log.at(-1)?.message.includes('Forest')) {
    throw new Error('Reveal top must log revealed card names.')
  }

  const milled = applyAction(libraryState, {
    type: 'MILL_X',
    playerId: 'player_a',
    count: 2,
    timestamp: '2026-05-12T10:12:00.000Z',
  })
  if (milled.players.player_a.zones.library[0]?.instanceId !== 'inst_3') {
    throw new Error('Mill must remove cards from the top of library.')
  }
  if (milled.players.player_a.zones.graveyard.map(card => card.instanceId).join(',') !== 'inst_1,inst_2') {
    throw new Error('Mill must move top library cards to graveyard in order.')
  }

  const scried = applyAction(libraryState, {
    type: 'SCRY_X',
    playerId: 'player_a',
    count: 3,
    topInstanceIds: ['inst_3', 'inst_1'],
    bottomInstanceIds: ['inst_2'],
    timestamp: '2026-05-12T10:13:00.000Z',
  })
  if (scried.players.player_a.zones.library.map(card => card.instanceId).join(',') !== 'inst_3,inst_1,inst_4,inst_2') {
    throw new Error('Scry must reorder kept cards and put selected cards on the bottom.')
  }

  const tutored = applyAction(libraryState, {
    type: 'TUTOR',
    playerId: 'player_a',
    instanceId: 'inst_3',
    toZone: 'hand',
    shuffleAfter: false,
    timestamp: '2026-05-12T10:14:00.000Z',
  })
  if (tutored.players.player_a.zones.hand[0]?.instanceId !== 'inst_3') {
    throw new Error('Tutor must move the selected library card to hand.')
  }
  if (tutored.players.player_a.zones.library.some(card => card.instanceId === 'inst_3')) {
    throw new Error('Tutor must remove the selected card from library.')
  }

  const counterReady = applyAction(libraryState, {
    type: 'MOVE_CARD',
    playerId: 'player_a',
    instanceId: 'inst_1',
    fromZone: 'library',
    toZone: 'battlefield',
    timestamp: '2026-05-12T10:15:00.000Z',
    x: 100,
    y: 200,
  })
  const counterAdded = applyAction(counterReady, {
    type: 'ADD_COUNTER',
    playerId: 'player_a',
    instanceId: 'inst_1',
    counterType: 'plusOne',
    amount: 2,
    timestamp: '2026-05-12T10:16:00.000Z',
  })
  if (counterAdded.players.player_a.zones.battlefield[0]?.counters.plusOne !== 2) {
    throw new Error('Add counter must increment the named counter.')
  }

  const counterRemoved = applyAction(counterAdded, {
    type: 'REMOVE_COUNTER',
    playerId: 'player_a',
    instanceId: 'inst_1',
    counterType: 'plusOne',
    amount: 1,
    timestamp: '2026-05-12T10:17:00.000Z',
  })
  if (counterRemoved.players.player_a.zones.battlefield[0]?.counters.plusOne !== 1) {
    throw new Error('Remove counter must decrement without going below zero.')
  }

  const damaged = applyAction(counterRemoved, {
    type: 'MARK_DAMAGE',
    playerId: 'player_a',
    instanceId: 'inst_1',
    amount: 3,
    timestamp: '2026-05-12T10:18:00.000Z',
  })
  if (damaged.players.player_a.zones.battlefield[0]?.markedDamage !== 3) {
    throw new Error('Mark damage must track damage on a permanent.')
  }

  const damagedToGraveyard = applyAction(damaged, {
    type: 'MOVE_CARD',
    playerId: 'player_a',
    instanceId: 'inst_1',
    fromZone: 'battlefield',
    toZone: 'graveyard',
    timestamp: '2026-05-12T10:18:30.000Z',
  })
  const graveyardCard = damagedToGraveyard.players.player_a.zones.graveyard.find(card => card.instanceId === 'inst_1')
  if (!graveyardCard || graveyardCard.markedDamage !== 0 || graveyardCard.counters.plusOne) {
    throw new Error('Moving a card off the battlefield must clear counters and marked damage.')
  }

  const damageCleared = applyAction(damaged, {
    type: 'CLEAR_DAMAGE',
    playerId: 'player_a',
    instanceId: 'inst_1',
    timestamp: '2026-05-12T10:19:00.000Z',
  })
  if (damageCleared.players.player_a.zones.battlefield[0]?.markedDamage !== 0) {
    throw new Error('Clear damage must reset marked damage.')
  }

  const bulkCounterRemoved = applyAction(counterRemoved, {
    type: 'MULTI_SELECT_ACTION',
    playerId: 'player_a',
    instanceIds: ['inst_1'],
    operation: 'removeCounter',
    counterType: 'plusOne',
    amount: 1,
    timestamp: '2026-05-12T10:19:30.000Z',
  })
  if (bulkCounterRemoved.players.player_a.zones.battlefield[0]?.counters.plusOne !== 0) {
    throw new Error('Bulk remove counter must decrement selected battlefield cards.')
  }

  const bulkMarkedDamage = applyAction(damageCleared, {
    type: 'MULTI_SELECT_ACTION',
    playerId: 'player_a',
    instanceIds: ['inst_1'],
    operation: 'markDamage',
    amount: 1,
    timestamp: '2026-05-12T10:19:40.000Z',
  })
  if (bulkMarkedDamage.players.player_a.zones.battlefield[0]?.markedDamage !== 1) {
    throw new Error('Bulk mark damage must update selected battlefield cards.')
  }

  const bulkMovedWithDamage = applyAction(bulkMarkedDamage, {
    type: 'MULTI_SELECT_ACTION',
    playerId: 'player_a',
    instanceIds: ['inst_1'],
    operation: 'move',
    toZone: 'exile',
    timestamp: '2026-05-12T10:19:50.000Z',
  })
  const bulkExiled = bulkMovedWithDamage.players.player_a.zones.exile.find(card => card.instanceId === 'inst_1')
  if (!bulkExiled || bulkExiled.markedDamage !== 0 || bulkExiled.counters.plusOne) {
    throw new Error('Bulk moving cards off the battlefield must clear counters and marked damage.')
  }

  const energized = applyAction(libraryState, {
    type: 'SET_ENERGY',
    playerId: 'player_a',
    energyCounters: 4,
    timestamp: '2026-05-12T10:20:00.000Z',
  })
  const experienced = applyAction(energized, {
    type: 'SET_EXPERIENCE',
    playerId: 'player_a',
    experienceCounters: 2,
    timestamp: '2026-05-12T10:21:00.000Z',
  })
  if (experienced.players.player_a.stats.energyCounters !== 4 || experienced.players.player_a.stats.experienceCounters !== 2) {
    throw new Error('Energy and experience actions must update player stats.')
  }

  const commanderLoss = applyAction(libraryState, {
    type: 'SET_COMMANDER_DAMAGE',
    playerId: 'player_a',
    commanderPlayerId: 'player_b',
    damage: 21,
    timestamp: '2026-05-12T10:22:00.000Z',
  })
  if (commanderLoss.players.player_a.loss?.reason !== 'commanderDamage') {
    throw new Error('Commander damage at 21 must mark the player as lost.')
  }

  const correctedCommanderDamage = applyAction(commanderLoss, {
    type: 'SET_COMMANDER_DAMAGE',
    playerId: 'player_a',
    commanderPlayerId: 'player_b',
    damage: 20,
    timestamp: '2026-05-12T10:23:00.000Z',
  })
  if (correctedCommanderDamage.players.player_a.loss) {
    throw new Error('Correcting commander damage below 21 must clear automatic loss.')
  }

  const poisonLoss = applyAction(libraryState, {
    type: 'SET_POISON',
    playerId: 'player_a',
    poisonCounters: 10,
    timestamp: '2026-05-12T10:24:00.000Z',
  })
  if (poisonLoss.players.player_a.loss?.reason !== 'poison') {
    throw new Error('Poison at 10 must mark the player as lost.')
  }

  const conceded = applyAction(libraryState, {
    type: 'PLAYER_CONCEDE',
    playerId: 'player_a',
    timestamp: '2026-05-12T10:25:00.000Z',
  })
  if (conceded.players.player_a.loss?.reason !== 'conceded') {
    throw new Error('Concede must mark the player as lost by concession.')
  }

  const tokenAdded = applyAction(libraryState, {
    type: 'ADD_TOKEN',
    playerId: 'player_a',
    name: 'Goblin',
    cardId: 'token_card',
    x: 120,
    y: 220,
    subfieldZone: 'creatures',
    timestamp: '2026-05-12T10:26:00.000Z',
  })
  const token = tokenAdded.tokens[0]
  if (!token || token.name !== 'Goblin' || token.ownerId !== 'player_a') {
    throw new Error('Add token must create an owned battlefield token.')
  }

  const tokenMoved = applyAction(tokenAdded, {
    type: 'MOVE_TOKEN_ON_BOARD',
    playerId: 'player_a',
    instanceId: token.instanceId,
    x: 300,
    y: 320,
    subfieldZone: 'lands',
    timestamp: '2026-05-12T10:27:00.000Z',
  })
  if (tokenMoved.tokens[0]?.x !== 300 || tokenMoved.tokens[0]?.subfieldZone !== 'lands') {
    throw new Error('Move token must update token position and lane.')
  }

  const tokenTapped = applyAction(tokenMoved, {
    type: 'TAP_TOKEN',
    playerId: 'player_a',
    instanceId: token.instanceId,
    timestamp: '2026-05-12T10:28:00.000Z',
  })
  if (!tokenTapped.tokens[0]?.tapped) {
    throw new Error('Tap token must tap the target token.')
  }

  const tokenCounter = applyAction(tokenTapped, {
    type: 'ADD_COUNTER',
    playerId: 'player_a',
    instanceId: token.instanceId,
    counterType: 'plusOne',
    amount: 1,
    timestamp: '2026-05-12T10:29:00.000Z',
  })
  if (tokenCounter.tokens[0]?.counters.plusOne !== 1) {
    throw new Error('Counter actions must be able to target tokens.')
  }

  const tokenDamaged = applyAction(tokenCounter, {
    type: 'MARK_DAMAGE',
    playerId: 'player_a',
    instanceId: token.instanceId,
    amount: 2,
    timestamp: '2026-05-12T10:30:00.000Z',
  })
  if (tokenDamaged.tokens[0]?.markedDamage !== 2) {
    throw new Error('Damage actions must be able to target tokens.')
  }

  const tokenRemoved = applyAction(tokenDamaged, {
    type: 'REMOVE_TOKEN',
    playerId: 'player_a',
    instanceId: token.instanceId,
    timestamp: '2026-05-12T10:31:00.000Z',
  })
  if (tokenRemoved.tokens.length !== 0) {
    throw new Error('Remove token must delete the target token.')
  }

  const rolled = applyAction(libraryState, {
    type: 'ROLL_DICE',
    playerId: 'player_a',
    sides: 20,
    result: 17,
    timestamp: '2026-05-12T10:32:00.000Z',
  })
  if (!rolled.log.at(-1)?.message.includes('d20') || !rolled.log.at(-1)?.message.includes('17')) {
    throw new Error('Roll dice must log the die type and result.')
  }
  if (rolled.log.at(-1)?.type !== 'roll') {
    throw new Error('Roll dice log entry must have type "roll".')
  }
  if (rolled.players.player_a.zones.library.length !== libraryState.players.player_a.zones.library.length) {
    throw new Error('Roll dice must not mutate any zones.')
  }

  const flipped = applyAction(libraryState, {
    type: 'FLIP_COIN',
    playerId: 'player_a',
    result: 'heads',
    timestamp: '2026-05-12T10:33:00.000Z',
  })
  if (!flipped.log.at(-1)?.message.toLowerCase().includes('heads')) {
    throw new Error('Flip coin must log the result.')
  }
  if (flipped.log.at(-1)?.type !== 'roll') {
    throw new Error('Flip coin log entry must have type "roll".')
  }

  const flippedTails = applyAction(libraryState, {
    type: 'FLIP_COIN',
    playerId: 'player_a',
    result: 'tails',
    timestamp: '2026-05-12T10:34:00.000Z',
  })
  if (!flippedTails.log.at(-1)?.message.toLowerCase().includes('tails')) {
    throw new Error('Flip coin must log tails result correctly.')
  }

  // HOST_VOTE_INITIATE — only host (seatIndex 0) can start a vote
  const voteInitiated = applyAction(libraryState, {
    type: 'HOST_VOTE_INITIATE',
    playerId: 'player_a',
    voteId: 'vote_001',
    topic: 'Take back last action?',
    actionType: 'TAKE_BACK',
    timestamp: '2026-05-12T10:35:00.000Z',
  })
  if (!voteInitiated.pendingVote || voteInitiated.pendingVote.id !== 'vote_001') {
    throw new Error('HOST_VOTE_INITIATE must create a pendingVote in state.')
  }
  if (voteInitiated.log.at(-1)?.type !== 'vote') {
    throw new Error('HOST_VOTE_INITIATE must append a vote log entry.')
  }
  // previousState chain must remain intact for TAKE_BACK to work later
  if (voteInitiated.previousState !== libraryState.previousState) {
    throw new Error('HOST_VOTE_INITIATE must not update previousState.')
  }

  // Non-host cannot initiate
  const nonHostVote = applyAction(libraryState, {
    type: 'HOST_VOTE_INITIATE',
    playerId: 'player_b',
    voteId: 'vote_002',
    topic: 'Take back last action?',
    actionType: 'TAKE_BACK',
    timestamp: '2026-05-12T10:35:30.000Z',
  })
  if (nonHostVote !== libraryState) {
    throw new Error('Non-host players must not be able to initiate a vote.')
  }

  // HOST_VOTE_CAST — players vote, auto-resolves at majority
  const voteWithAction = applyAction(libraryState, {
    type: 'DRAW_CARD',
    playerId: 'player_a',
    timestamp: '2026-05-12T10:35:45.000Z',
  })
  const voteStarted = applyAction(voteWithAction, {
    type: 'HOST_VOTE_INITIATE',
    playerId: 'player_a',
    voteId: 'vote_003',
    topic: 'Take back last action?',
    actionType: 'TAKE_BACK',
    timestamp: '2026-05-12T10:36:00.000Z',
  })
  const votedYes = applyAction(voteStarted, {
    type: 'HOST_VOTE_CAST',
    playerId: 'player_a',
    voteId: 'vote_003',
    vote: 'yes',
    timestamp: '2026-05-12T10:36:10.000Z',
  })
  if (!votedYes.pendingVote || votedYes.pendingVote.votes['player_a'] !== 'yes') {
    throw new Error('HOST_VOTE_CAST must record the player vote.')
  }

  // Second vote reaches majority in a 2-player game — should auto-resolve yes → TAKE_BACK
  const autoResolved = applyAction(votedYes, {
    type: 'HOST_VOTE_CAST',
    playerId: 'player_b',
    voteId: 'vote_003',
    vote: 'yes',
    timestamp: '2026-05-12T10:36:20.000Z',
  })
  if (autoResolved.pendingVote !== null) {
    throw new Error('Vote must auto-resolve once majority is reached.')
  }
  if (autoResolved.players.player_a.zones.hand.length !== libraryState.players.player_a.zones.hand.length) {
    throw new Error('TAKE_BACK vote resolution must restore the state before the voted action.')
  }

  // HOST_VOTE_RESOLVE force-resolve — majority no → vote fails
  const voteForNo = applyAction(voteInitiated, {
    type: 'HOST_VOTE_CAST',
    playerId: 'player_b',
    voteId: 'vote_001',
    vote: 'no',
    timestamp: '2026-05-12T10:37:00.000Z',
  })
  const forceResolved = applyAction(voteForNo, {
    type: 'HOST_VOTE_RESOLVE',
    playerId: 'player_a',
    voteId: 'vote_001',
    timestamp: '2026-05-12T10:37:10.000Z',
  })
  if (forceResolved.pendingVote !== null) {
    throw new Error('HOST_VOTE_RESOLVE must clear pendingVote.')
  }
  if (!forceResolved.log.at(-1)?.message.includes('no')) {
    throw new Error('Force-resolved failed vote must log the "no" outcome.')
  }

  // Non-host cannot force-resolve
  const resolveByNonHost = applyAction(voteInitiated, {
    type: 'HOST_VOTE_RESOLVE',
    playerId: 'player_b',
    voteId: 'vote_001',
    timestamp: '2026-05-12T10:37:20.000Z',
  })
  if (resolveByNonHost !== voteInitiated) {
    throw new Error('Non-host players must not be able to force-resolve a vote.')
  }

  // GAME_END — host can end the game directly
  const gameEnded = applyAction(libraryState, {
    type: 'GAME_END',
    playerId: 'player_a',
    timestamp: '2026-05-12T10:38:00.000Z',
  })
  if (gameEnded.status !== 'ended') {
    throw new Error('GAME_END must set game status to ended.')
  }
  const gameEndedByNonHost = applyAction(libraryState, {
    type: 'GAME_END',
    playerId: 'player_b',
    timestamp: '2026-05-12T10:38:10.000Z',
  })
  if (gameEndedByNonHost !== libraryState) {
    throw new Error('Non-host players must not be able to end the game directly.')
  }
}

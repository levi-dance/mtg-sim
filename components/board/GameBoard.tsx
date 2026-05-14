'use client'

import { useCallback, useMemo, useState } from 'react'
import { DndContext, DragOverlay, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'framer-motion'
import { flushSync } from 'react-dom'
import { BattlefieldZone } from '@/components/board/BattlefieldZone'
import { HandZone } from '@/components/board/HandZone'
import { LibraryZone } from '@/components/board/LibraryZone'
import { PlayerStrip } from '@/components/board/PlayerStrip'
import { SpectatorView } from '@/components/board/SpectatorView'
import { CardContextMenu, type CardContextMenuState } from '@/components/cards/CardContextMenu'
import { CardImage } from '@/components/cards/CardImage'
import { CardPreview } from '@/components/cards/CardPreview'
import { DiceRoller } from '@/components/ui/DiceRoller'
import { HostControls } from '@/components/ui/HostControls'
import { LifeTracker } from '@/components/ui/LifeTracker'
import { MatchScoreDisplay } from '@/components/ui/MatchScoreDisplay'
import { PhaseTracker } from '@/components/ui/PhaseTracker'
import { SideboardPhase } from '@/components/ui/SideboardPhase'
import { TokenCreator } from '@/components/ui/TokenCreator'
import { VoteModal } from '@/components/ui/VoteModal'
import type { GameAction } from '@/lib/game/actions'
import { getDeck } from '@/lib/decks/index'
import { startNextGame } from '@/lib/sessions/index'
import { useGameSync } from '@/lib/game/useGameSync'
import type { CardInstance, GameState, Player, SubfieldZone } from '@/types/game'
import type { Deck } from '@/types/deck'

interface Props {
  sessionId: string
}

type PileZone = 'graveyard' | 'exile' | 'commandZone'
type CardPreviewState = {
  card: CardInstance
  x: number
  y: number
}

export function GameBoard({ sessionId }: Props) {
  const [openPile, setOpenPile] = useState<PileZone | null>(null)
  const [previewCard, setPreviewCard] = useState<CardPreviewState | null>(null)
  const [contextMenu, setContextMenu] = useState<CardContextMenuState | null>(null)
  const [dragOverlayCard, setDragOverlayCard] = useState<CardInstance | null>(null)
  const [selectedBattlefieldIds, setSelectedBattlefieldIds] = useState<string[]>([])
  const [groupDrag, setGroupDrag] = useState<{ activeId: string; ids: string[]; deltaX: number; deltaY: number } | null>(null)
  const { gameState, myToken, isLoading, connectionStatus, pendingSyncs, lastIssue, dispatch, resetToState } = useGameSync(sessionId)

  const players = useMemo(
    () => Object.values(gameState?.players ?? {}).sort((a, b) => a.seatIndex - b.seatIndex),
    [gameState?.players]
  )
  const localPlayer = players.find(player => player.ownerToken === myToken) ?? players[0]
  const opponents = players.filter(player => player.id !== localPlayer?.id)
  const activePlayer = gameState ? gameState.players[gameState.turn.activePlayerId] : null
  const localTokens = useMemo(
    () => gameState?.tokens.filter(token => token.ownerId === localPlayer?.id) ?? [],
    [gameState?.tokens, localPlayer?.id]
  )
  const setCardPreview = useCallback((card: CardInstance | null, x = 0, y = 0) => {
    setPreviewCard(card ? { card, x, y } : null)
  }, [])

  function subfieldFromDrop(y: number, height: number): SubfieldZone {
    if (y > height * 0.66) return 'lands'
    if (y > height * 0.33) return 'creatures'
    return 'other'
  }

  function dragSource(event: DragStartEvent | DragEndEvent): string | null {
    const source = event.active.data.current?.source
    return typeof source === 'string' ? source : null
  }

  function handleDragStart(event: DragStartEvent) {
    setCardPreview(null)
    const source = dragSource(event)
    const instanceId = String(event.active.id)
    if (source === 'battlefield' && selectedBattlefieldIds.includes(instanceId) && selectedBattlefieldIds.length > 1) {
      setGroupDrag({ activeId: instanceId, ids: selectedBattlefieldIds, deltaX: 0, deltaY: 0 })
      return
    }
    if (source !== 'hand') return

    const card = localPlayer.zones.hand.find(item => item.instanceId === instanceId)
    setDragOverlayCard(card ?? null)
  }

  function handleDragMove(event: DragMoveEvent) {
    if (dragSource(event) !== 'battlefield') return
    const instanceId = String(event.active.id)
    setGroupDrag(current =>
      current?.activeId === instanceId
        ? { ...current, deltaX: event.delta.x, deltaY: event.delta.y }
        : current
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const source = dragSource(event)
    const instanceId = String(event.active.id)
    setDragOverlayCard(null)
    setGroupDrag(null)
    setCardPreview(null)

    if (source === 'battlefield') {
      const card = localPlayer.zones.battlefield.find(item => item.instanceId === instanceId)
      if (!card) return
      const movingIds = selectedBattlefieldIds.includes(instanceId) && selectedBattlefieldIds.length > 1
        ? selectedBattlefieldIds
        : [instanceId]
      const movingCards = movingIds
        .map(id => localPlayer.zones.battlefield.find(item => item.instanceId === id))
        .filter(card => Boolean(card)) as CardInstance[]

      flushSync(() => {
        movingCards.forEach(movingCard => {
          dispatch({
            type: 'MOVE_CARD_ON_BOARD',
            playerId: localPlayer.id,
            instanceId: movingCard.instanceId,
            x: Math.max(0, (movingCard.x ?? 0) + event.delta.x),
            y: Math.max(0, (movingCard.y ?? 0) + event.delta.y),
            timestamp: new Date().toISOString(),
          })
        })
      })
      return
    }

    if (source === 'token') {
      const token = gameState?.tokens.find(item => item.instanceId === instanceId && item.ownerId === localPlayer.id)
      if (!token) return

      flushSync(() => {
        dispatch({
          type: 'MOVE_TOKEN_ON_BOARD',
          playerId: localPlayer.id,
          instanceId,
          x: Math.max(0, token.x + event.delta.x),
          y: Math.max(0, token.y + event.delta.y),
          subfieldZone: subfieldFromDrop(Math.max(0, token.y + event.delta.y), document.querySelector<HTMLElement>('.battlefield-zone')?.getBoundingClientRect().height ?? 1),
          timestamp: new Date().toISOString(),
        })
      })
      return
    }

    if (source !== 'hand' || event.over?.id !== 'battlefield-drop-zone') return

    const zoneElement = document.querySelector<HTMLElement>('.battlefield-zone')
    const initialRect = event.active.rect.current.initial
    if (!zoneElement || !initialRect) return

    const zoneRect = zoneElement.getBoundingClientRect()
    const x = Math.max(0, initialRect.left + event.delta.x - zoneRect.left)
    const y = Math.max(0, initialRect.top + event.delta.y - zoneRect.top)

    flushSync(() => {
      dispatch({
        type: 'PLAY_CARD',
        playerId: localPlayer.id,
        instanceId,
        fromZone: 'hand',
        x,
        y,
        subfieldZone: subfieldFromDrop(y, zoneRect.height),
        timestamp: new Date().toISOString(),
      })
    })
  }

  function handleDragCancel() {
    setDragOverlayCard(null)
    setGroupDrag(null)
    setCardPreview(null)
  }

  async function handleStartNextGame() {
    if (!gameState) return
    const decksByToken = new Map<string, Deck>()
    await Promise.all(
      players
        .filter(p => !p.isSpectator && p.deckId)
        .map(async p => {
          const deck = await getDeck(p.deckId!)
          if (deck) decksByToken.set(p.ownerToken, deck)
        })
    )
    const newState = startNextGame(gameState, decksByToken)
    resetToState(newState)
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d1117]">
        <p className="text-zinc-400">Loading game...</p>
      </main>
    )
  }

  if (!gameState || !localPlayer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d1117]">
        <p className="text-zinc-500">Waiting for game to initialize...</p>
      </main>
    )
  }

  if (localPlayer.isSpectator) {
    return <SpectatorView gameState={gameState} />
  }

  const totalPlayers = players.length
  // Sort opponents so the player to my left is first, across is second, right is third
  const sortedOpponents = [...opponents].sort((a, b) => {
    const relA = (a.seatIndex - localPlayer.seatIndex + totalPlayers) % totalPlayers
    const relB = (b.seatIndex - localPlayer.seatIndex + totalPlayers) % totalPlayers
    return relB - relA
  })

  return (
    <main className="game-table min-h-screen overflow-hidden p-4 text-zinc-100">
      <div className="grid h-[calc(100vh-2rem)] grid-cols-[minmax(0,1fr)_18rem] gap-4">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4">
          <div className="grid gap-3 xl:grid-cols-3">
            {sortedOpponents.map(player => {
              const relPos = (player.seatIndex - localPlayer.seatIndex + totalPlayers) % totalPlayers
              const posLabel = totalPlayers === 4
                ? relPos === 1 ? 'Right' : relPos === 2 ? 'Across' : 'Left'
                : totalPlayers === 3 && relPos === 1 ? 'Right' : totalPlayers === 3 ? 'Left' : ''
              return (
                <div key={player.id} className="flex flex-col gap-1">
                  {posLabel && (
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">{posLabel}</p>
                  )}
                  <PlayerStrip
                    player={player}
                    isActive={player.id === gameState.turn.activePlayerId}
                    isMe={player.ownerToken === myToken}
                  />
                </div>
              )
            })}
            {sortedOpponents.length === 0 && (
              <PlayerStrip
                player={localPlayer}
                isActive={localPlayer.id === gameState.turn.activePlayerId}
                isMe
              />
            )}
          </div>

          <DndContext onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <BattlefieldZone
              player={localPlayer}
              tokens={localTokens}
              selectedIds={selectedBattlefieldIds}
              setSelectedIds={setSelectedBattlefieldIds}
              groupDrag={groupDrag}
              dispatch={dispatch}
              onPreview={setCardPreview}
            />

            <section className="grid min-h-0 grid-cols-[minmax(0,1fr)_15rem] gap-4">
              <HandZone
                player={localPlayer}
                dispatch={dispatch}
                onPreview={setCardPreview}
                onContextMenu={setContextMenu}
              />
              <div className="relative z-20 grid content-end gap-3 rounded-lg border border-[#30363d] bg-[#161b22]/90 p-3">
                <div className="flex justify-center">
                  <LibraryZone player={localPlayer} dispatch={dispatch} onContextMenu={setContextMenu} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <PileButton label="Grave" count={localPlayer.zones.graveyard.length} onClick={() => setOpenPile('graveyard')} />
                  <PileButton label="Exile" count={localPlayer.zones.exile.length} onClick={() => setOpenPile('exile')} />
                  <PileButton label="Command" count={localPlayer.zones.commandZone.length} onClick={() => setOpenPile('commandZone')} />
                </div>
              </div>
            </section>
            <DragOverlay dropAnimation={null}>
              {dragOverlayCard && (
                <div className="hand-drag-overlay">
                  <CardImage cardId={dragOverlayCard.cardId} name={dragOverlayCard.name} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <section className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              {gameState.format} · {gameState.mode}
            </p>
            <h1 className="mt-1 font-serif text-xl font-semibold text-zinc-100">
              {activePlayer?.displayName ?? 'Game'} is active
            </h1>
            <p className="mt-1 text-sm text-zinc-500">Session {gameState.sessionId.slice(0, 8)}</p>
          </section>

          <SyncStatusPanel
            status={connectionStatus}
            pendingSyncs={pendingSyncs}
            lastIssue={lastIssue}
          />
          <MatchScoreDisplay gameState={gameState} players={players} />
          <PhaseTracker
            activePlayerId={gameState.turn.activePlayerId}
            phase={gameState.turn.phase}
            turnNumber={gameState.turn.number}
            dispatch={dispatch}
          />
          <LifeTracker player={localPlayer} dispatch={dispatch} />
          <div className="flex flex-col gap-3 opacity-85">
            <TokenCreator player={localPlayer} tokenCount={localTokens.length} dispatch={dispatch} />
            <DiceRoller player={localPlayer} dispatch={dispatch} />
            <HostControls localPlayer={localPlayer} gameState={gameState} dispatch={dispatch} />
            <CommanderDamagePanel players={players} localPlayer={localPlayer} dispatch={dispatch} />
          </div>
          <GameLog state={gameState} />
        </aside>
      </div>

      {openPile && (
        <PileModal
          title={pileTitle(openPile)}
          zone={openPile}
          cards={localPlayer.zones[openPile]}
          onPreview={setCardPreview}
          onContextMenu={setContextMenu}
          onClose={() => setOpenPile(null)}
        />
      )}
      {contextMenu && (
        <CardContextMenu
          menu={contextMenu}
          player={localPlayer}
          dispatch={dispatch}
          onClose={() => setContextMenu(null)}
        />
      )}
      <CardPreview preview={previewCard} />
      <AnimatePresence>
        {players.some(p => p.loss) && <LossOverlay key="loss-overlay" players={players} />}
      </AnimatePresence>
      {gameState.status === 'sideboard' && (
        <SideboardPhase
          gameState={gameState}
          localPlayer={localPlayer}
          players={players}
          dispatch={dispatch}
          onStartNextGame={handleStartNextGame}
        />
      )}
      {gameState.pendingVote && (
        <VoteModal
          vote={gameState.pendingVote}
          players={players}
          localPlayer={localPlayer}
          dispatch={dispatch}
        />
      )}
    </main>
  )
}

function SyncStatusPanel({
  status,
  pendingSyncs,
  lastIssue,
}: {
  status: string
  pendingSyncs: number
  lastIssue: { message: string; timestamp: string } | null
}) {
  const isHealthy = status === 'connected' && !lastIssue
  return (
    <section className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-sm font-semibold text-zinc-100">Table Sync</h2>
          <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">{status}</p>
        </div>
        <span className={`h-3 w-3 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-[#d4a843]'}`} />
      </div>
      <p className="mt-3 text-sm text-zinc-500">
        {pendingSyncs > 0 ? `${pendingSyncs} update${pendingSyncs === 1 ? '' : 's'} syncing` : 'Local play is current'}
      </p>
      {lastIssue && (
        <p className="mt-2 rounded border border-[#d4a843]/40 bg-[#0d1117] px-3 py-2 text-xs leading-snug text-[#d4a843]">
          {lastIssue.message}
        </p>
      )}
    </section>
  )
}

function PileButton({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-3 text-center transition hover:border-[#d4a843]/60"
      onClick={onClick}
    >
      <span className="block font-mono text-xl font-semibold text-zinc-100">{count}</span>
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
    </button>
  )
}

function CommanderDamagePanel({
  players,
  localPlayer,
  dispatch,
}: {
  players: Player[]
  localPlayer: Player
  dispatch: (action: GameAction) => void
}) {
  const entries = players
    .filter(player => player.id !== localPlayer.id)
    .map(player => ({
      player,
      damage: localPlayer.stats.commanderDamage[player.id] ?? 0,
    }))

  function setDamage(commanderPlayerId: string, damage: number) {
    dispatch({
      type: 'SET_COMMANDER_DAMAGE',
      playerId: localPlayer.id,
      commanderPlayerId,
      damage,
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <section className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <h2 className="mb-3 font-serif text-sm font-semibold text-zinc-100">Commander Damage</h2>
      <div className="grid gap-2">
        {entries.map(({ player, damage }) => (
          <div key={player.id} className="grid gap-2 rounded bg-[#0d1117] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-zinc-400">{player.displayName}</span>
              <span className="font-mono text-sm text-zinc-100">{damage}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[-5, -1, 1, 5].map(delta => (
                <button
                  key={delta}
                  type="button"
                  className="rounded border border-[#30363d] px-2 py-1 font-mono text-xs text-zinc-200 transition hover:border-[#d4a843]/60"
                  onClick={() => setDamage(player.id, Math.max(0, damage + delta))}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-zinc-600">No opposing commanders.</p>}
      </div>
    </section>
  )
}

function LossOverlay({ players }: { players: Player[] }) {
  const lostPlayers = players.filter(player => player.loss)

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[120] grid place-items-center bg-black/45 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.section
        className="w-full max-w-xl rounded-lg border border-red-500/55 bg-[#0d1117]/95 p-6 text-center shadow-2xl"
        initial={{ opacity: 0, scale: 0.88, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.08 }}
      >
        <p className="text-xs uppercase tracking-[0.24em] text-red-300">Loss Detected</p>
        <div className="mt-4 grid gap-3">
          {lostPlayers.map(player => (
            <div key={player.id} className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3">
              <h2 className="font-serif text-2xl font-semibold text-zinc-100">{player.displayName}</h2>
              <p className="mt-1 text-sm text-zinc-400">{player.loss?.message}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  )
}

const LOG_COLORS: Record<string, string> = {
  draw: 'text-blue-400',
  roll: 'text-[#d4a843]',
  vote: 'text-purple-400',
  system: 'text-zinc-500',
  play: 'text-zinc-200',
  move: 'text-zinc-400',
  tap: 'text-zinc-500',
  counter: 'text-zinc-400',
  stat: 'text-zinc-400',
}

function GameLog({ state }: { state: GameState }) {
  return (
    <section className="min-h-0 rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <h2 className="mb-3 font-serif text-sm font-semibold text-zinc-100">Game Log</h2>
      <div className="flex max-h-56 flex-col overflow-y-auto divide-y divide-[#30363d]/40">
        {[...state.log].reverse().map(entry => (
          <p key={entry.id} className={`py-1.5 text-sm leading-snug ${LOG_COLORS[entry.type] ?? 'text-zinc-400'}`}>
            <span className="mr-2 font-mono text-xs text-zinc-600">
              {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {entry.message}
          </p>
        ))}
      </div>
    </section>
  )
}

function PileModal({
  title,
  zone,
  cards,
  onClose,
  onPreview,
  onContextMenu,
}: {
  title: string
  zone: PileZone
  cards: CardInstance[]
  onClose: () => void
  onPreview: (card: CardInstance | null, x?: number, y?: number) => void
  onContextMenu: (menu: CardContextMenuState) => void
}) {
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-8">
      <section className="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-4">
          <h2 className="font-serif text-lg font-semibold text-zinc-100">{title}</h2>
          <button type="button" className="rounded border border-[#30363d] px-3 py-1 text-sm text-zinc-300" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="grid max-h-[62vh] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3 overflow-y-auto p-5">
          {cards.map(card => (
            <button
              key={card.instanceId}
              type="button"
              className="zone-card"
              onMouseEnter={event => {
                const rect = event.currentTarget.getBoundingClientRect()
                onPreview(card, rect.right, rect.top + rect.height / 2)
              }}
              onMouseLeave={() => onPreview(null)}
              onFocus={event => {
                const rect = event.currentTarget.getBoundingClientRect()
                onPreview(card, rect.right, rect.top + rect.height / 2)
              }}
              onBlur={() => onPreview(null)}
              onContextMenu={event => {
                event.preventDefault()
                onPreview(null)
                onContextMenu({ card, zone, x: event.clientX, y: event.clientY })
              }}
            >
              <CardImage cardId={card.cardId} name={card.name} />
            </button>
          ))}
          {cards.length === 0 && <p className="text-sm text-zinc-600">No cards here.</p>}
        </div>
      </section>
    </div>
  )
}

function pileTitle(zone: PileZone): string {
  if (zone === 'commandZone') return 'Command Zone'
  return zone[0].toUpperCase() + zone.slice(1)
}

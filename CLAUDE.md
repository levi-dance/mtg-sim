# CLAUDE.md — MTG Sim Project Bible
> This file is the single source of truth for all Claude sessions on this project.
> Read this file in full at the start of every session before writing any code.
> At the end of every session, update the "Current State" and "Next Session" sections below.

---

## What This Project Is

MTG Sim is a browser-based Magic: The Gathering game table simulator for a private group of up to 10 rotating players (max 4 at a table). It is NOT a rules engine. It is a digital game mat — players have full manual control over every card at all times, just like a physical game mat. The app handles bookkeeping, card rendering, real-time sync, and logistics. Players communicate via Discord.

**Target users:** Desktop browsers only. Private group. No public distribution.
**Formats:** Commander and Modern.
**Game modes:** 1v1, 2v2, 4-player FFA.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, React 19) |
| Real-time | Supabase Realtime (broadcast channels) |
| Database | Supabase PostgreSQL (free tier) |
| Card data | Scryfall API — free, no auth, has every card and token ever printed |
| Animations | Framer Motion |
| Drag and drop | dnd-kit (@dnd-kit/core, @dnd-kit/sortable) |
| Styling | Tailwind CSS + custom CSS |
| Deployment | Vercel (free tier) |

---

## Coding Conventions

- TypeScript everywhere — no `any` types
- Next.js App Router — use server components by default, `'use client'` only when needed (event handlers, hooks, browser APIs)
- No inline styles — use Tailwind classes or `app/globals.css`
- No comments explaining what the code does — only add a comment if the WHY is non-obvious
- No placeholder/TODO code left in files — implement fully or omit
- Do not add error handling for scenarios that cannot happen — trust TypeScript and framework guarantees
- Validate only at system boundaries (user input, Scryfall API responses, Supabase responses)

---

## Scryfall API

Base URL: `https://api.scryfall.com`

Key endpoints:
- Card by name (exact): `GET /cards/named?exact={cardName}`
- Card by name (fuzzy): `GET /cards/named?fuzzy={cardName}`
- Card search: `GET /cards/search?q={query}`
- Token search: `GET /cards/search?q=type:token+{name}`
- All printings: `GET /cards/search?q=!"{cardName}"&unique=prints`
- Autocomplete: `GET /cards/autocomplete?q={partial}`

Card image: `card.image_uris.normal` (or `card.card_faces[0].image_uris.normal` for double-faced cards)

**Cache all Scryfall responses.** Do not call Scryfall on every render. Cache in-memory (`lib/scryfall/cache.ts`) and in Supabase where appropriate.

---

## Identity & Auth

No login. No Google auth. No NextAuth.

Each device gets a UUID token on first visit, stored in localStorage and synced to the `player_tokens` Supabase table. This token identifies the player for deck persistence. Decks belong to a token, not an account.

Players enter a display name when joining a session. That name is session-scoped only.

---

## Supabase Schema

```sql
-- Sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  mode text not null,           -- '1v1', '2v2', '4ffa'
  format text not null,         -- 'commander', 'modern'
  mulligan_rule text not null,  -- 'london', 'normal', 'friendly'
  friendly_mulligan_count int,  -- null unless friendly
  match_length int not null,    -- 1, 3, or 5
  status text default 'lobby',  -- 'lobby', 'active', 'sideboard', 'ended'
  game_state jsonb default '{}',
  host_token text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Decks
create table decks (
  id uuid primary key default gen_random_uuid(),
  owner_token text not null,
  name text not null,
  format text not null,         -- 'commander', 'modern'
  commander_card jsonb,         -- null for modern
  main_deck jsonb not null,     -- array of { cardId, name, quantity, artId }
  sideboard jsonb default '[]', -- array of { cardId, name, quantity, artId }
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Player tokens
create table player_tokens (
  token text primary key,
  display_name text,
  created_at timestamptz default now()
);
```

RLS is disabled on all three tables. Supabase Realtime must be enabled for the `sessions` table.

---

## Folder Structure

```
/app
  /page.tsx                     ← landing / redirect to lobby
  /lobby/page.tsx               ← create or join a session
  /game/[sessionId]/page.tsx    ← main game board
  /decks/page.tsx               ← deck list
  /decks/[deckId]/page.tsx      ← deck builder / editor
  /decks/import/page.tsx        ← deck importer

/components
  /board/
    GameBoard.tsx               ← main board layout
    PlayerStrip.tsx             ← compressed opponent view
    BattlefieldZone.tsx         ← lands / creatures / other permanents zones
    HandZone.tsx                ← player's hand
    LibraryZone.tsx             ← library stack
    GraveyardZone.tsx           ← graveyard (+ popup)
    ExileZone.tsx               ← exile (+ popup)
    CommandZone.tsx             ← commander card zone
    SpectatorView.tsx           ← read-only grid of all boards
  /cards/
    CardImage.tsx               ← Scryfall image renderer
    CardBack.tsx                ← face-down card back
    CardPreview.tsx             ← full-size hover preview (fixed corner)
    CardContextMenu.tsx         ← right-click single card menu
    RadialWheel.tsx             ← multi-select radial action wheel
    SelectionBox.tsx            ← drag-to-select rectangle
  /deck/
    DeckBuilder.tsx
    DeckImporter.tsx
    CardSearch.tsx
    ArtSelector.tsx
  /lobby/
    LobbyRoom.tsx
    SessionSettings.tsx
    PlayerSlot.tsx
  /ui/
    LifeTracker.tsx
    PoisonTracker.tsx
    CommanderDamageTracker.tsx
    PhaseTracker.tsx
    DiceRoller.tsx
    CoinFlip.tsx
    GameLog.tsx
    VoteModal.tsx
    LossOverlay.tsx
    MatchScoreDisplay.tsx

/lib
  /supabase/
    client.ts                   ← browser supabase client
    server.ts                   ← server supabase client
  /game/
    state.ts                    ← createInitialGameState
    actions.ts                  ← action type definitions
    reducer.ts                  ← applyAction(state, action) → newState
    broadcast.ts                ← send/receive via Supabase Realtime
    shuffle.ts                  ← Fisher-Yates shuffle
    mulligan.ts                 ← mulligan logic per rule type
    instances.ts                ← deckToInstances, commanderToInstance
  /scryfall/
    api.ts                      ← Scryfall fetch helpers
    cache.ts                    ← in-memory card cache
  /sessions/
    index.ts                    ← createSession, getSession, joinSession, startGame, initializeGame
  /decks/
    index.ts                    ← listDecks, getDeck, saveDeck, deleteDeck
  /tokens/
    identity.ts                 ← device token generation and persistence

/types
  game.ts                       ← GameState, Player, CardInstance, TokenInstance, PlayerZones, GameAction
  deck.ts                       ← Deck, DeckCard, DeckSummary
  session.ts                    ← Session, SessionSettings, LobbyPlayer
```

---

## Real-Time Pattern

Game state is a single JSON object. Every action produces a new full state.

```typescript
// Dispatch an action
function dispatch(action: GameAction) {
  const newState = applyAction(currentState, action)
  // 1. Update local state immediately (optimistic)
  setGameState(newState)
  // 2. Broadcast to all clients
  channel.send({ type: 'broadcast', event: 'STATE_UPDATE', payload: newState })
  // 3. Persist to Supabase for reconnection
  supabase.from('sessions').update({ game_state: newState, updated_at: new Date() }).eq('id', sessionId)
}

// Receive from others
channel.on('broadcast', { event: 'STATE_UPDATE' }, ({ payload }) => {
  setGameState(payload)
})
```

Late joiners and reconnecting players hydrate from `sessions.game_state` in DB, not from broadcast.

The `previousState` field in state enables the host "take back" feature — stores the prior state snapshot so it can be restored. Only one level deep.

---

## Game State JSON

```json
{
  "sessionId": "uuid",
  "mode": "1v1",
  "format": "commander",
  "status": "active",
  "matchScore": { "player_a": 1, "player_b": 0 },
  "turn": {
    "number": 3,
    "activePlayerId": "player_a",
    "phase": "main1"
  },
  "players": {
    "player_a": {
      "id": "player_a",
      "displayName": "Levi",
      "ownerToken": "device-uuid",
      "seatIndex": 0,
      "isSpectator": false,
      "connected": true,
      "deckId": "deck-uuid",
      "stats": {
        "life": 40,
        "poisonCounters": 0,
        "commanderDamage": { "player_b": 0 },
        "energyCounters": 0,
        "experienceCounters": 0
      },
      "zones": {
        "library": [{ "instanceId": "inst_001", "cardId": "scryfall-uuid", "name": "Forest", "faceDown": true, "tapped": false, "counters": {}, "attachments": [], "markedDamage": 0, "annotation": "", "transformed": false, "phased": false, "x": null, "y": null }],
        "hand": [],
        "battlefield": [{ "instanceId": "inst_003", "cardId": "scryfall-uuid", "name": "Command Tower", "faceDown": false, "tapped": true, "x": 420, "y": 180, "counters": { "plusOne": 0, "minusOne": 0, "loyalty": 0, "custom": [] }, "attachments": ["inst_007"], "markedDamage": 0, "annotation": "", "summoningSick": false, "transformed": false, "phased": false, "flipped": false, "subfieldZone": "lands" }],
        "graveyard": [],
        "exile": [],
        "commandZone": [{ "instanceId": "inst_000", "cardId": "scryfall-uuid", "name": "Atraxa, Praetors' Voice", "commanderCastCount": 1, "tapped": false, "counters": {}, "attachments": [], "markedDamage": 0, "annotation": "" }]
      }
    }
  },
  "tokens": [],
  "log": [{ "id": "log_001", "timestamp": "2026-05-12T10:30:00Z", "playerId": "player_a", "message": "Levi played Sol Ring from hand.", "type": "play" }],
  "lastAction": { "type": "PLAY_CARD", "playerId": "player_a", "instanceId": "inst_002", "fromZone": "hand", "toZone": "battlefield", "timestamp": "2026-05-12T10:30:00Z" },
  "previousState": null,
  "settings": { "startingLife": 40, "startingHandSize": 7, "mulliganRule": "london", "friendlyMulliganCount": null, "matchLength": 3, "allowSpectators": true },
  "createdAt": "2026-05-12T10:00:00Z",
  "updatedAt": "2026-05-12T10:31:00Z"
}
```

Key rules:
- Every card in any zone has a unique `instanceId` (generated at game start, survives zone moves)
- `cardId` is the Scryfall UUID — used only for image/data fetching
- `x` and `y` are pixel coordinates on the battlefield canvas (null in other zones)
- `subfieldZone` is `"lands"`, `"creatures"`, or `"other"` — only relevant on battlefield
- `previousState` stores the full prior state for take-back. Only one level deep.
- Log is capped at 100 entries — slice oldest when adding new

---

## All Action Types

```typescript
type ActionType =
  | 'DRAW_CARD' | 'DRAW_X' | 'PLAY_CARD' | 'MOVE_CARD' | 'MOVE_CARD_ON_BOARD'
  | 'MOVE_TOKEN_ON_BOARD' | 'TAP_CARD' | 'TAP_TOKEN' | 'UNTAP_CARD'
  | 'UNTAP_TOKEN' | 'UNTAP_ALL' | 'TRANSFORM_CARD' | 'PHASE_OUT'
  | 'ADD_COUNTER' | 'REMOVE_COUNTER' | 'MARK_DAMAGE' | 'CLEAR_DAMAGE'
  | 'REVEAL_CARD' | 'REVEAL_TOP_X' | 'SCRY_X' | 'MILL_X' | 'LOOK_TOP_X'
  | 'SHUFFLE_LIBRARY' | 'TUTOR' | 'ADD_TOKEN' | 'REMOVE_TOKEN' | 'COPY_PERMANENT'
  | 'SET_LIFE' | 'SET_POISON' | 'SET_COMMANDER_DAMAGE' | 'SET_ENERGY'
  | 'SET_EXPERIENCE' | 'CAST_COMMANDER'
  | 'MULTI_SELECT_ACTION' | 'NEXT_PHASE' | 'NEXT_TURN' | 'ROLL_DICE' | 'FLIP_COIN'
  | 'HOST_VOTE_INITIATE' | 'HOST_VOTE_CAST' | 'HOST_VOTE_RESOLVE'
  | 'TAKE_BACK' | 'PLAYER_CONCEDE' | 'GAME_END' | 'MATCH_END' | 'SIDEBOARD_CONFIRM'
```

---

## Turn Phases (in order)

`untap` → `upkeep` → `draw` → `main1` → `combat_begin` → `combat_attackers` → `combat_blockers` → `combat_damage` → `combat_end` → `main2` → `end` → `cleanup`

- `untap`: app auto-untaps all active player's permanents
- `draw`: app auto-draws 1 card for active player (toggleable)

---

## Visual Design

**Aesthetic:** Premium physical card table. Dark navy/charcoal felt texture. Gold accents and UI chrome. Card sleeves with subtle dark glow border. MTG Arena / Hearthstone level of polish.

**Color tokens (from globals.css):**
- Background: `#0d1117`
- Panels: `#161b22`
- Gold accent: `#d4a843`

**Animations (Framer Motion):**
- Card hover in hand: scale 1.0 → 1.4x, z-index elevates
- Card played to battlefield: slides from hand zone, fade-in
- Tap: smooth 90° rotation
- Radial wheel: expands from cursor position
- Selection box: dashed animated border
- Loss announcement: dramatic full-screen overlay

**Never use:** generic fonts (Inter, Roboto, Arial), purple gradients, cookie-cutter layouts.

---

## Key UX Rules

- Right-click on any card anywhere opens a context menu relevant to that zone
- Click and drag on a zone to multi-select; right-click selection opens radial wheel
- Hovering a card in hand scales it up; hovering a card on battlefield shows full preview in fixed corner
- Opponent hand always shows as face-down card backs — count visible, contents never
- Graveyard and exile open as a scrollable grid popup
- Library opens as a searchable grid only when tutoring — otherwise library actions via click menu on the stack
- All game actions append to the log (max 100 entries)
- Dice rolls and coin flips visible to all players via log

---

## What NOT to Build

- No rules enforcement, no automatic combat resolution, no stack management
- No mana tracking or tapping automation
- No in-game chat, no user accounts, no game history
- No mobile support, no AI opponents
- No automated token creation from card text (player manually adds tokens)

---

## Build Order

| Session | Focus | Status |
|---|---|---|
| 1 | Project scaffold, Supabase setup, DB schema, device token system, routing | Complete |
| 2 | Deck builder — card search, add/remove, sideboard, commander pin, save | Complete |
| 3 | Deck importer — text paste, Scryfall validation, art selection | Complete |
| 4 | Lobby — session creation, join via link, settings, spectator assignment | Complete |
| 5 | Game start sequence — shuffle, deal, mulligan flow, first player roll | Complete |
| 6 | Game board layout — zones, player strips, sidebar, phase tracker | Complete |
| 7 | Card rendering — Scryfall images, hover preview, face-down backs, positioning | Complete |
| 8 | Real-time sync — Supabase broadcast, action dispatch, state hydration | Complete |
| 9 | Single card context menus — all zones, all actions | Complete |
| 10 | Multi-select + radial wheel | Complete |
| 11 | Library actions — tutor, scry, mill, reveal, shuffle | Complete |
| 12 | Counters, stats tracking, auto-loss detection | Complete |
| 13 | Token creator | Complete |
| 14 | Dice roller, coin flip | Complete |
| 15 | Host controls + majority vote | Complete |
| 16 | Reconnection, spectator mode, opponent view rotation | Complete |
| 17 | Match tracking, sideboard phase between games | Complete |
| 18 | Animations — Framer Motion polish | Complete |
| 19 | Visual polish — dark table aesthetic, typography, layout refinement | Complete |
| 20 | Testing, bug fixing, Vercel deployment | Complete |

---

## Current State

**Last completed session:** Session 20 — Testing, Bug Fixing, Vercel Deployment (2026-05-14)

**What exists:**
- `package.json` — framer-motion, @dnd-kit/core, @dnd-kit/sortable, @supabase/supabase-js, @supabase/ssr installed
- `.env.local` — configured with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- `lib/supabase/client.ts` — browser Supabase client via @supabase/ssr
- `lib/supabase/server.ts` — server Supabase client (async cookies pattern)
- `lib/tokens/identity.ts` — getOrCreateToken, syncTokenToSupabase, initPlayerIdentity
- `lib/game/actions.ts` — typed GameAction union (DrawCard, DrawX, PlayCard, MoveCard, MoveTokenOnBoard, Tap, Untap, TapToken, UntapToken, MultiSelectAction, RevealTopX, MillX, ScryX, Tutor, AddToken, RemoveToken, SetLife, SetPoison, SetCommanderDamage, SetEnergy, SetExperience, AddCounter, RemoveCounter, MarkDamage, ClearDamage, CastCommander, PlayerConcede, NextPhase, RollDice, FlipCoin, HostVoteInitiate, HostVoteCast, HostVoteResolve, GameEnd, MatchEnd, SideboardConfirm, PlayerConnect)
- `lib/game/reducer.ts` — applyAction with DRAW_CARD, DRAW_X, PLAY_CARD, CAST_COMMANDER, TAP_CARD, UNTAP_CARD, UNTAP_ALL, TAP_TOKEN, UNTAP_TOKEN, MOVE_CARD, MOVE_CARD_ON_BOARD, MOVE_TOKEN_ON_BOARD, ADD_TOKEN, REMOVE_TOKEN, MULTI_SELECT_ACTION, SHUFFLE_LIBRARY, REVEAL_TOP_X, MILL_X, SCRY_X, TUTOR, SET_LIFE, SET_POISON, SET_COMMANDER_DAMAGE, SET_ENERGY, SET_EXPERIENCE, ADD_COUNTER, REMOVE_COUNTER, MARK_DAMAGE, CLEAR_DAMAGE, PLAYER_CONCEDE, NEXT_PHASE, ROLL_DICE, FLIP_COIN, TAKE_BACK, HOST_VOTE_INITIATE, HOST_VOTE_CAST, HOST_VOTE_RESOLVE, GAME_END, MATCH_END, SIDEBOARD_CONFIRM, PLAYER_CONNECT implemented
- `lib/game/broadcast.ts` — subscribeToGameState, broadcastState, persistState, hydrateState with Realtime status reporting and send/persist error propagation
- `lib/game/useGameSync.ts` — reusable client hook for game hydration, Supabase broadcast subscription cleanup, optimistic dispatch, ordered broadcast/persist writes, visible sync issues, and `resetToState` for broadcasting a fully-computed new state (used for next-game transitions)
- `lib/game/reducer.test.ts` — focused reducer verification helper for optimistic dispatch flow, one-level `previousState`, commander casting, card movement normalization, battlefield-leave counter/damage clearing, bulk selected-card actions, library actions, counters, marked damage, bulk radial counter/damage actions, stats, loss-state transitions, token transitions, dice/coin log transitions, and vote initiation/casting/resolution transitions
- `lib/game/shuffle.ts` — Fisher-Yates shuffle
- `lib/game/mulligan.ts` — London, normal, and friendly mulligan logic
- `lib/scryfall/api.ts` — getCardByName, getCardById, getCardByNameFuzzy, searchCards, getCardPrintings, searchTokens, getCardImageUri, autocompleteCardNames, getArtCropUri, getNormalUri; token search now caches returned token cards by ID
- `lib/scryfall/cache.ts` — in-memory Scryfall response cache
- `lib/decks/index.ts` — listDecks, getDeck, saveDeck (insert/update), deleteDeck
- `types/game.ts` — full GameState, Player, PlayerLoss, CardInstance, TokenInstance, PlayerZones, VoteState, GameAction interfaces; ActionType includes PLAYER_CONNECT, MATCH_END, SIDEBOARD_CONFIRM; GameState includes `sideboardReadyIds: string[]`
- `types/deck.ts` — Deck, DeckCard, DeckSummary interfaces
- `types/session.ts` — Session, SessionSettings, LobbyPlayer interfaces
- `components/PlayerIdentityInit.tsx` — client component wired into root layout that calls initPlayerIdentity on mount
- `components/deck/CardSearch.tsx` — debounced autocomplete search, dropdown with keyboard nav, card image preview on hover
- `components/deck/ArtSelector.tsx` — modal showing all printings for a card name; click to select artId
- `components/deck/DeckBuilder.tsx` — full deck editor: commander slot, add-to-main/sideboard toggle, card list with quantity controls, art switching, save/delete
- `components/deck/DeckImporter.tsx` — two-stage import flow: paste decklist → per-card Scryfall fuzzy validation → save and redirect
- `lib/sessions/index.ts` — createSession, getSession, joinSession, startGame, subscribeToLobby, initializeGame, startNextGame (builds fresh GameState for game N+1 carrying over matchScore)
- `components/lobby/SessionSettings.tsx` — mode/format/mulligan/match-length/spectators toggles
- `components/lobby/PlayerSlot.tsx` — individual seat display (empty or filled, host/me badges, connected dot)
- `components/lobby/CreateSession.tsx` — host flow: display name + deck + settings → create session → redirect
- `components/lobby/LobbyRoom.tsx` — main lobby with live updates; on Start Game: builds initial GameState, calls initializeGame, redirects all clients
- `app/globals.css` — dark navy theme, enhanced crosshatch felt texture, card shell, hand fan, battlefield, and library stack styles; `.card-back.library` and `.card-back.hand` have inset glow and shimmer gradient; `.battlefield-zone.drop-target` has stronger gold inset shadow; `.hand-drag-overlay` has stronger gold glow for drag feedback
- `app/layout.tsx` — metadata, PlayerIdentityInit wired in
- `app/page.tsx` — redirects to /lobby
- `app/lobby/page.tsx` — async server component: no ?session → CreateSession; ?session={id} → LobbyRoom
- `app/game/[sessionId]/page.tsx` — server component rendering GameBoard
- `app/decks/page.tsx` — deck list with art crop thumbnails
- `app/decks/[deckId]/page.tsx` — loads deck, renders DeckBuilder; handles deckId='new'
- `app/decks/import/page.tsx` — renders DeckImporter
- `lib/game/instances.ts` — deckToInstances, commanderToInstance
- `lib/game/state.ts` — createInitialGameState: shuffles library, deals 7, places commander, sets life totals
- `components/board/GameBoard.tsx` — full-screen client game table wired through `useGameSync`, with Table Sync status, pending sync count, non-blocking sync failure display, pile modal context menus, shared card context-menu state, commander damage controls, token creator panel, loss overlay, vote modal overlay, host controls panel, spectator routing (isSpectator players see SpectatorView), opponent seat rotation (left/across/right position labels for 4-player), shared dnd-kit context for hand-to-battlefield/token play, grouped movement for selected battlefield cards; sidebar recesses secondary controls (TokenCreator, DiceRoller, HostControls, CommanderDamagePanel) at 85% opacity behind a visual divide; inline `GameLog` uses type-distinct text colors (draw=blue, roll=gold, vote=purple, system=zinc-500, play=zinc-200, others=zinc-400) with dividers between entries
- `components/board/SpectatorView.tsx` — read-only full-screen grid of all active player boards; shows name, life, connection status, hand (face-down), zone counts, battlefield card images, and owned tokens; no controls or dispatch
- `components/board/PlayerStrip.tsx` — compressed opponent strip with name, connection dot, trio-badge zone counts (perms/GY/Ex), loss badge alongside zone counts, face-down hand backs, library count; life shown as `text-3xl` gold number when player is active
- `components/board/HandZone.tsx` — local hand zone with real Scryfall card images, Framer Motion spring hover-scale (1.35×) and y-lift on motion.button, fixed preview, right-click context menu, drag-to-battlefield play, and double-click play-to-battlefield
- `components/board/LibraryZone.tsx` — library stack with card back, draw 1, draw 7, shuffle, look top X private modal, reveal top X log action, scry X reorder/bottom modal, mill X, searchable tutor modal, and right-click stack/top-card context menu
- `components/board/BattlefieldZone.tsx` — dnd-kit battlefield canvas with lands / creatures / other lanes, draggable real card images, draggable token permanents, Framer Motion spring tap rotation and entry fade-in/scale on the battlefield-card-visual span, badges rotating with the card, clickable counter/damage badges with pointer-safe quick actions, hover preview, right-click permanent radial/token actions, drag-to-select with animated selection-box pulse, selected-card styling, and radial wheel bulk actions via AnimatePresence
- `components/ui/PhaseTracker.tsx` — dot-pipeline phase display: prominent gold turn number, current phase label in serif, 12-dot progress pipeline with filled-to-current indicator, and Next Phase button dispatching NEXT_PHASE
- `components/ui/LifeTracker.tsx` — local life, poison, energy, experience, and concede controls dispatching SET_LIFE, SET_POISON, SET_ENERGY, SET_EXPERIENCE, and PLAYER_CONCEDE
- `components/ui/TokenCreator.tsx` — manual token creator with Scryfall token search, custom-name fallback, lane selection, and ADD_TOKEN dispatch
- `components/ui/DiceRoller.tsx` — sidebar dice and coin panel: d4/d6/d8/d10/d12/d20 quick-roll buttons, custom-sided die input, coin flip button, and prominent last-result display; dispatches ROLL_DICE and FLIP_COIN actions logged to all players
- `components/ui/VoteModal.tsx` — full-screen overlay rendered for all clients when gameState.pendingVote is set; shows vote topic, per-player vote status, yes/no vote buttons for unvoted non-spectators, and a host-only Force Resolve button
- `components/ui/HostControls.tsx` — sidebar panel visible only to host (seatIndex 0); provides Call Take-Back Vote and End Game buttons; End Game shows a winner picker that dispatches MATCH_END (feeding into match tracking); disabled during an active vote
- `components/ui/MatchScoreDisplay.tsx` — sidebar widget showing wins per player as filled circles, current game number, and best-of N label
- `components/ui/SideboardPhase.tsx` — full-screen overlay shown when status === 'sideboard'; displays match score grid with win-pip indicators, per-player ready status, Edit Deck link (new tab), Ready button (dispatches SIDEBOARD_CONFIRM), and host-only Start Game N button (fetches updated decks via getDeck, calls startNextGame + resetToState); shows separate Match Over view with End Session button when match is decided
- `components/cards/CardImage.tsx` — cached Scryfall image renderer using `getCardById`, normal/large image sizes, double-faced fallback through Scryfall helper, and missing-image fallback for custom tokens/cards without an image ID
- `components/cards/CardBack.tsx` — reusable face-down card back for libraries and opponent hands
- `components/cards/CardPreview.tsx` — fixed-corner hover preview for cards on the table and in piles
- `components/cards/CardContextMenu.tsx` — right-click single-card menu for local hand, battlefield, graveyard, exile, command zone, and library stack actions, including battlefield counter and marked-damage actions where this menu is used
- `components/cards/SelectionBox.tsx` — drag-selection rectangle for battlefield multi-select
- `components/cards/RadialWheel.tsx` — compact selected-card radial action wheel with Framer Motion spring scale/opacity entrance and exit animation on the wheel container (AnimatePresence in BattlefieldZone), evenly spaced pill actions, bottom-anchored close/back action, top-level tap, untap, counters, damage, move, and clear categories plus secondary menus for counter, damage, and zone-move actions
- `next.config.ts` — allows optimized remote images from `cards.scryfall.io`

**Known issues / blockers:**
- Supabase schema SQL must be run manually in the Supabase dashboard
- RLS must be disabled: `alter table decks disable row level security; alter table player_tokens disable row level security; alter table sessions disable row level security;`
- Supabase Realtime must be enabled for `sessions` table in dashboard: Database → Replication
- `joinSession` uses a read-modify-write pattern — simultaneous joins could clobber. Acceptable for private group.
- `npm run lint` and `npx tsc --noEmit` both pass with zero errors. `npm run build` produces a clean production build (7 routes: 4 static, 3 dynamic).
- Vercel deployment requires: (1) push repo to GitHub, (2) connect to Vercel, (3) add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars in Vercel dashboard — `.env.local` is gitignored and must not be committed.
- Supabase production check required before going live: confirm RLS is disabled on `sessions`, `decks`, `player_tokens` tables, and Realtime is enabled for `sessions` in the Supabase dashboard (Database → Replication).

**Key architectural decisions:**
- Lobby player list stored in `sessions.game_state.lobbyPlayers` during lobby phase; overwritten with full GameState on game start
- Lobby uses Supabase Postgres Changes (not broadcast) so late-joiners hydrate from DB
- Host auto-added as seat 0 at session creation time
- Display name persisted in localStorage (`mtg_sim_display_name`) and in `player_tokens.display_name`
- 75ms inter-request delay on Scryfall calls (not cache hits)
- Abort via `useRef` in DeckImporter validation loop to avoid stale closure issues
- Not-found cards skipped on import (not blocked); user shown skipped count
- GameBoard dispatch pipeline lives in `useGameSync`: it applies reducer output locally, broadcasts full GameState snapshots via Supabase Realtime, then persists `sessions.game_state` for reconnection.
- `useGameSync` subscribes before hydration and only applies incoming/hydrated states when their `updatedAt` is not older than current local state, avoiding stale hydration overwrites.
- Broadcast and persist writes are ordered through a promise queue so rapid local actions do not persist older snapshots after newer snapshots.
- Reducer snapshots now clear nested `previousState` before storing the prior state, preserving the one-level take-back rule across consecutive actions.
- Single-card right-click menus only expose local-player zones currently rendered by the board; opponent hands remain face-down and do not expose card contents or actions.
- Moving a card to library now clears battlefield coordinates and sets it face-down; moving to battlefield assigns table coordinates and summoning sickness.
- Moving a card from battlefield to any non-battlefield zone clears battlefield counters, marked damage, summoning sickness, battlefield position, and z-index while preserving commander metadata such as `commanderCastCount`.
- Casting a commander from the command zone uses `CAST_COMMANDER`, increments `commanderCastCount`, and moves the card to the creatures lane.
- Battlefield multi-select starts only from empty board space so card drag behavior remains available through dnd-kit.
- Right-clicking a battlefield card opens the radial wheel for that card; right-clicking selected empty board opens the radial wheel for the current selection.
- `MULTI_SELECT_ACTION` is battlefield-scoped for now and records one log entry per bulk operation.
- Battlefield card tap rotation is applied to the inner card frame, not the positioned draggable shell, so tapped cards keep their table coordinates.
- Battlefield card preview is suppressed immediately on mouse-down and during dnd-kit dragging.
- Right-clicking any battlefield card selects that card and opens the radial wheel; other zones continue to use the single-card context menu.
- Radial wheel action buttons dispatch on pointer-down and stop backdrop propagation so the close layer cannot swallow the intended action.
- Hand cards are draggable through the shared dnd-kit context; dropping on the battlefield plays the card at the drop position and infers the battlefield lane from the drop height. Double-click remains as a shortcut.
- DragOverlay drop animation is disabled for hand-to-battlefield plays to avoid the card snapping toward its source/top-left before the state update lands.
- Drag-end dispatches are wrapped in `flushSync` so dnd-kit transform cleanup does not create a visible disappear/reappear frame.
- Battlefield cards have optional `zIndex`; playing or moving a card on the battlefield assigns the next highest z-index so the released card is visually topmost.
- Library look/tutor/scry modal contents are local UI until the player confirms an explicit state-changing action.
- `REVEAL_TOP_X` logs the revealed card names without moving zones; `MILL_X` moves the top cards to graveyard face-up; `TUTOR` moves the selected library card to hand and can shuffle the remaining library.
- `SCRY_X` reorders the current top cards and moves selected cards to the bottom of the library without publicly naming them in the log.
- NEXT_PHASE advances through the configured phase order; moving into untap rotates active player and untaps their battlefield, moving into draw draws one card for the active player.
- Session 7 uses `next/image` for Scryfall card images with `cards.scryfall.io` in `next.config.ts`; the dev server must be restarted after config changes.
- Card images hydrate through the in-memory Scryfall cache first, then fetch by Scryfall UUID only when missing.
- Card counters are stored on each `CardInstance.counters`; built-in counters are clamped at zero, custom counters are keyed by label and removed when their value reaches zero.
- Marked damage is stored on `CardInstance.markedDamage`; clearing damage is a manual action available through card/radial controls.
- Energy and experience are manual player stats, independent of card counters and visible in the local player totals panel.
- Commander damage is stored from the damaged player's perspective as `player.stats.commanderDamage[sourcePlayerId]`; reaching 21 sets a loss marker for that player.
- Automatic loss markers are bookkeeping only: life, poison, and commander-damage losses clear if the value is manually corrected, while concession remains sticky.
- Loss overlays derive from `Player.loss` and do not block table interaction, so players can manually correct bookkeeping mistakes.
- Tokens live in top-level `gameState.tokens` and are owned by `ownerId`, rather than living inside a player's card zones.
- Tokens use `ADD_TOKEN`, `REMOVE_TOKEN`, `MOVE_TOKEN_ON_BOARD`, `TAP_TOKEN`, and `UNTAP_TOKEN`; existing counter and marked-damage actions can target either cards or owned tokens.
- Custom tokens use an empty `cardId` and render through the `CardImage` fallback without attempting a Scryfall lookup.
- Token creation is fully manual from the sidebar: players can search Scryfall tokens or create a custom named token, but card text never creates tokens automatically.
- The local battlefield renders only tokens owned by the local player; spectator/opponent token presentation is still future work with opponent view rotation.
- Battlefield card right-clicks intentionally open the radial wheel instead of the single-card context menu; the radial wheel stays compact and opens secondary counter, damage, and move menus for detailed actions.
- Existing battlefield counter and marked-damage badges are interactive; clicking a badge opens quick actions for increment, decrement, double, and remove/clear while stopping drag and context-menu propagation.
- Token and counter/damage quick-action menus dispatch on pointer-down rather than click so dnd-kit pointer handling cannot swallow menu actions.
- Battlefield card visuals now rotate as a single unit when tapped, so counter and marked-damage badges stay attached to the tapped card orientation.
- Dragging one card in a multi-selection moves every selected battlefield card together, preserving their relative spacing during the drag and after drop.
- Radial wheel actions are computed as evenly spaced pill-shaped controls with close/back occupying the bottom slot, instead of relying on a fixed set of hard-coded circular slots.
- The battlefield zone is isolated into its own stacking context, and game modals/menus/previews use a higher layer scale so high-z battlefield cards cannot render above graveyard, exile, library, context-menu, radial, preview, or loss overlays.
- Dice roll and coin flip results are computed on the rolling player's client (using module-level helpers to satisfy `react-hooks/purity`) and included in the dispatched action payload; all clients receive the result through the standard GameState broadcast, and the result is appended to the shared log with type `'roll'`.
- `DiceRoller` keeps local UI state for `lastRoll` and `lastFlip` so the most recent result remains visible in the sidebar without a log scroll; local state is independent of GameState and resets on the next roll or flip.
- Vote state lives in `GameState.pendingVote` so all clients receive it through the standard broadcast and can render the VoteModal simultaneously.
- `HOST_VOTE_INITIATE` intentionally does NOT use the `next` pattern (does not update `previousState`), so that when a TAKE_BACK vote resolves yes, `state.previousState` still points to the state before the questionable action rather than before the vote initiation.
- Host is identified as the player with `seatIndex === 0`; this is established at session creation and does not change.
- Vote auto-resolves when `yesCount >= majority` or `noCount >= majority` or all non-spectators have voted; majority = `Math.floor(n / 2) + 1`.
- `GAME_END` is a direct host action (no vote required) that sets `status: 'ended'`; a vote for game-end can also be initiated via HOST_VOTE_INITIATE with `actionType: 'GAME_END'`.
- The HostControls "Call Take-Back Vote" button is disabled when there is no `previousState` (nothing to take back) or when a vote is already pending.
- `PLAYER_CONNECT` updates `player.connected` without touching `previousState` — connection events are ephemeral housekeeping and should not appear in the take-back chain.
- `useGameSync` defines `dispatch` before the main `useEffect` so presence event handlers can close over it directly, avoiding the render-phase ref assignment pattern that React 19 lint rules flag.
- Supabase Presence is tracked per client using `channel.track({ ownerToken })`. On join/leave events, the matching player in GameState is found by `ownerToken` and `PLAYER_CONNECT` is dispatched. On reconnect (channel status → `connected`), presence is re-tracked and `PLAYER_CONNECT(true)` is dispatched for the local player. After hydration, the local player is also marked connected so reconnecting clients update the flag even if the channel was already subscribed.
- Spectator players (`isSpectator: true`) are routed to `SpectatorView` instead of the interactive board in `GameBoard`; all dispatch access is unavailable in that path.
- Spectator view renders opponent tokens by filtering `gameState.tokens` by `ownerId`, making all token permanents visible regardless of which player owns them.
- Opponent strips in `GameBoard` are sorted by relative seat position (descending) so that for 4-player games the left/across/right columns match physical table orientation. A position label ("Left", "Across", "Right") is rendered above each strip when `totalPlayers >= 3`.
- `MATCH_END` is host-only, does NOT use the `next` pattern (sets `previousState: null`) and always moves `status` to `'sideboard'` regardless of whether the match is decided; `SideboardPhase` detects the win condition from `matchScore` and renders a Match Over view vs. sideboard swap view accordingly.
- `SIDEBOARD_CONFIRM` does not use the `next` pattern; it's ephemeral readiness bookkeeping tracked in `GameState.sideboardReadyIds`.
- `startNextGame` (in `lib/sessions/index.ts`) is a pure function taking the current `GameState` and a `Map<ownerToken, Deck>` and returning a fresh `GameState`; player IDs are preserved across games so deck/token ownership remains consistent.
- `useGameSync` exposes `resetToState(newState)` for broadcasting a fully-computed state that was not produced via the reducer. The host's "Start Game N" handler fetches updated decks via `getDeck`, calls `startNextGame`, then calls `resetToState` — all other clients receive the new state via the standard broadcast.
- Sideboard swaps are made in the existing deck builder (`/decks/[deckId]`) opened in a new tab from the SideboardPhase "Edit Deck" link; `startNextGame` fetches fresh decks at next-game start time, picking up any changes made during the sideboard window.
- `SideboardPhase` renders at `z-[110]`, below LossOverlay (`z-[120]`) and VoteModal; during sideboard there are no active votes and LossOverlay is pointer-events-none so layering is non-conflicting.
- `MatchScoreDisplay` is always visible in the sidebar (not conditional on match length > 1) so players always see the score context.
- Hand card hover is implemented via `motion.button` (Framer Motion) with `whileHover={{ scale: 1.35, y: -8, zIndex: 50 }}` and a spring transition; the CSS `transform` was removed from `.hand-card:hover` to avoid conflict, but the box-shadow glow is kept in CSS.
- Battlefield card entry and tap rotation are both animated via a single `motion.span` (`battlefield-card-visual`); `initial={{ opacity: 0, scale: 0.88 }}`, `animate={{ opacity: 1, scale: 1, rotate: card.tapped ? 90 : 0 }}`. This replaces the previous CSS `transform: rotate(90deg)` on the tapped class.
- Radial wheel uses `motion.div` inside `RadialWheel` with `initial/animate/exit` and is wrapped in `AnimatePresence` at the BattlefieldZone call site so the exit animation fires when the wheel closes.
- LossOverlay is rendered conditionally from GameBoard (not returning null internally) so `AnimatePresence` can detect mount/unmount for entrance and exit animations.
- VoteModal and SideboardPhase both use `motion.div` + `motion.section` for backdrop fade-in and panel spring entrance; exit animations are not needed since state changes trigger unmount before any visual exit could play.
- The `selection-box` CSS uses a `@keyframes selection-pulse` animation for a breathing border color effect — Framer Motion was not used since `border-dash` and `border-color` on animated CSS pseudo-borders are handled more cleanly in pure CSS.
- Phase tracker replaces the 2-column grid with a dot pipeline: a relative container holds a full-width `bg-[#30363d]` track line, an overlaid gold line that transitions its width to `(currentIndex / 11) * 100%`, and 12 dots positioned via `justify-between`; the current dot glows via `shadow-[0_0_5px_2px_...]`.
- Opponent life in `PlayerStrip` is gold when that player is the active player, zinc-100 otherwise — gives an immediate visual cue without requiring the active pip.
- Loss badge in `PlayerStrip` is now placed in the zone-count row (alongside perms/GY/Ex chips) rather than in the name header row; this gives it more horizontal space and makes the name row less cluttered.
- Secondary sidebar panels (TokenCreator, DiceRoller, HostControls, CommanderDamagePanel) are wrapped in an `opacity-85` div to visually recess them without borders or labels; this preserves their functionality while drawing focus to the primary controls above.
- GameLog type-distinct colors are stored in a module-level `LOG_COLORS` record rather than an inline conditional, making it straightforward to add or adjust colors without touching the render path.
- `getOrCreateToken()` and `getDisplayName()` are synchronous localStorage reads and are passed directly to `useState()` as lazy initializers instead of being called inside `useEffect` bodies, avoiding cascading renders.
- `londonMulligan` does not use the `targetSize` parameter (London mulligan always draws 7; the player manually chooses which to bottom), so the parameter was removed from the function signature.
- `DeckImporter`'s `CardRowItem` uses `key={row.id + '-' + row.editName}` to remount when `editName` changes externally (after re-check), eliminating the need for a `useEffect` to sync local input state.
- `CreateSession` derives `effectiveSelectedDeckId` from `filteredDecks` at render time instead of using a `useEffect` to reset `selectedDeckId` when the format changes; stale state is masked by the derived value.

---

## Deployment Checklist

The codebase is complete. To deploy:

1. **Push to GitHub** — create a new repo, add as remote, push `main`
2. **Vercel** — import the GitHub repo in Vercel dashboard; add env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Supabase** — in the Supabase dashboard:
   - Database → SQL Editor: run `alter table sessions disable row level security; alter table decks disable row level security; alter table player_tokens disable row level security;`
   - Database → Replication: enable Realtime for the `sessions` table
4. **Smoke test** — open two browsers, create a session, join, play through a full turn cycle

## End of Session Instructions

At the end of every session, before finishing:

1. Update **Current State** — what was built, what files were created or modified
2. Update the **Status** column in the Build Order table for completed sessions
3. Update **Known issues / blockers** with anything unresolved
4. Update **Next Session** — rewrite it with the specific tasks for the next session based on what was and wasn't completed
5. Note any architectural decisions made that differ from this document and update the relevant section

This keeps every future session oriented from the first line.


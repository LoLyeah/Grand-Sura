# Grand Estates 3D — Luxury Landmark Monopoly & AI Host

Grand Estates 3D is a multiplayer-capable 3D property trading board game rendered in a studio-lit Three.js environment where players buy, develop, auction, and trade iconic world landmarks. It pairs authoritative real-time multiplayer rooms and local pass-and-play AI bots with an optional Male or Female AI Game Host featuring customizable personalities, expressive TTS commentary (`gemini-3.8-flash-tts`), real-time voice conversations (`gemini-3.8-live`), and live Google Search real-estate & city trivia grounding (`gemini-3.8-flash`).

### User Review & Critical Decisions

> [!IMPORTANT]
> Review the confirmed product and architectural choices below before we begin building the application. Click **Proceed** to start implementation or share any adjustments.

- **Confirmed Decision 1 — Hybrid Multiplayer Modes**: Supports both **Online Real-Time Rooms** (via shareable 6-character room codes synchronized over a custom Node.js + WebSocket server) and **Local Pass-and-Play + Smart AI Bots** on a single device.
- **Confirmed Decision 2 — Classic Luxury Board with Real-World Landmarks**: The 40-tile 3D board features world-famous avenues and landmarks across 8 color-coded tiers (from Mediterranean historic districts to Mayfair, Ginza, and Fifth Avenue), paired with live Google Search grounding to fetch real-world landmark facts, tourism trends, and economic trivia when landing on or inspecting a tile.
- **Confirmed Decision 3 — Optional Male/Female AI Host & Dynamic Personalities**: Players can toggle the AI Host on or off at any time, choose between **Male** (`Charon` / `Fenrir` / `Puck`) and **Female** (`Kore` / `Zephyr`) voices, select from the 4 confirmed presets (**Witty Game Show Host**, **Ruthless Wall Street Tycoon**, **Calm Zen Financial Advisor**, **Dramatic Auctioneer**), or type a custom free-form personality prompt.

---

### 1. Overview & Core Concept

- **What It Does**: Delivers a complete 40-space 3D Monopoly experience including 3D physics-inspired dice rolling, animated multi-part player tokens, property purchasing, live player-to-player & bot auctions, house/hotel construction, mortgages, player-to-player trade negotiations, Chance & Community Chest cards, Jail mechanics, and bankruptcy resolution.
- **Target Audience / Persona**: Friends playing together remotely via room codes, families/groups playing pass-and-play on a shared screen, and solo players competing against strategic bots accompanied by an entertaining AI showrunner.
- **Key Value**: Combines tactile 3D tabletop craftsmanship with an optional, personality-driven AI Host that narrates dramatic turns with expressive voice acting (`gemini-3.8-flash-tts`), engages in two-way real-time voice banter and rule/strategy coaching (`gemini-3.8-live`), and enriches every landmark with live web facts (`gemini-3.8-flash` + `googleSearch`).

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Title & Lobby Setup Modal**: Players choose **Local Table (Pass-and-Play + Bots)** or **Online Multiplayer Room (Create or Join via 6-char Code)**, configure 2–6 players (human or bot, token archetype, color), and configure the **AI Host Studio** (Enabled/Disabled toggle, Male/Female gender & voice selection, Preset or Custom Personality description).
  2. **Full-Bleed 3D Board Viewport (`100vw × 100vh`)**: The camera smoothly glides from an orbital overview to track the active token and dice roll, with click/hover raycasting on any of the 40 board spaces to inspect Title Deeds, 3D houses/hotels, and live Google Search landmark intelligence.
  3. **Turn & Property Resolution**: Rolling dice moves the player's composite 3D token step-by-step around the perimeter. Landing on an unowned landmark opens the Title Deed action sheet (**Buy Property** or **Start Live Auction**); landing on an owned landmark automatically transfers rent; landing on Chance, Community Chest, Tax, or Go To Jail triggers corresponding board animations and optional AI Host commentary.
  4. **Real-Time Voice & Host Controls**: When the AI Host is enabled, major events trigger dynamic spoken commentary using `gemini-3.8-flash-tts` with vocal bursts (`<laugh>`, `<gasp>`, `<breath>`). Players can also open the **Live Voice Mic** (`gemini-3.8-live`) at any moment to talk directly to the Male or Female AI Host in real time—asking for trade advice, trash-talking opponents, or settling rule questions.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: **Haute Horology & Grand Casino Salon** — Rich dark mahogany, brushed brass trim, velvet emerald felt board centerpiece, and crisp ivory parchment title deeds.
  - *Color Palette & Mood (60-30-10 Discipline)*:
    - **60% Dominant Canvas & Table Atmosphere**: Deep salon obsidian-mahogany (`#0F0C0A` to `#181310`) with horizon-matched exponential fog and a classic felt-emerald board center (`#0E3A2F`).
    - **30% Structural Surfaces**: Solid/translucent dark espresso HUD panels (`rgba(20, 16, 14, 0.92)` with `1px solid rgba(212, 175, 55, 0.22)` hairline borders — zero `backdrop-filter` over WebGL to preserve software and hardware frame pacing) and warm ivory deed surfaces (`#FAF6F0`).
    - **10% Accent Budget**: Burnished Championship Gold (`#D4AF37`), Auction Crimson (`#DC2626`), and Emerald Solvent Green (`#10B981`), always paired with explicit text labels and tabular numerals.
  - *Typography & Hierarchy (2+1 Font Rule)*:
    - **Display / Board & Deed Titles**: `Fraunces` (editorial luxury serif for landmark deeds, grand headers, and board centerpiece).
    - **UI & Controls Body**: `Plus Jakarta Sans` (clean, high-legibility geometric sans for HUD actions, player ledgers, and lobby setup).
    - **Treasury, Rent Tables & Dice Telemetry**: `JetBrains Mono` with `tabular-nums` for balances, rent tiers, auction bids, and room codes.
  - *Component Styling & Viewport-First Layout*:
    - **100% Unobstructed Central 3D Viewport**: The Three.js canvas fills `100vw × 100vh`. No floating cards on the mid-left or mid-right flanks.
    - **Top Bar Contract**: Compact top bar with 3 clean zones: Brand wordmark + Room Code (`Grand Estates 3D · Room #...`), concise player balance strip (`tabular-nums`), and primary lobby/camera reset action.
    - **Collapsible Bottom Control Dock (`≤ 15%` Viewport Footprint)**: Pinned to `bottom: 20px; left: 50%; transform: translateX(-50%); max-width: min(940px, 94vw)` with a `▾ Hide Controls / ▴ Show Controls (H)` drawer toggle. Consolidates Dice Roll / End Turn actions, Build/Mortgage manager, Trade drawer, AI Host Persona & Voice controls, Camera presets (`Overview`, `Follow Token`, `Top-Down`, `Free Orbit`), and Landmark Search Trivia.
    - **Zero-Pill & Anti-Slop Discipline**: All player statuses, property groups, and turn metadata use clean unboxed typography with `·` separators and static indicators (no pulsing dots, no code-comment headers).

- **Interactive Feedback & Motion**:
  - **Composite 3–12 Part Procedural 3D Models**:
    - **Player Tokens**: 6 distinct multi-part `THREE.Group` sculptures (Luxury Grand Tourer Car, Vintage Steam Locomotive, Brass Top Hat on Velvet Cushion, Executive Yacht, Crowned Chess Knight, Aviation Biplane) built from 5–9 parts with varied `metalness`/`roughness` and bottom-center ground pivots plus soft radial contact shadows.
    - **3D Houses, Grand Hotels & Centerpiece**: Multi-part procedural cottages with pitched roofs, chimneys, and dormers; Art Deco grand hotels with stepped brass spires; and an ornate 3D central rotating trophy/carousel with card decks.
  - **Silky Exponential Damping**: Camera transitions and token hops interpolate using `THREE.MathUtils.damp(current, target, lambda, delta)` and automatically yield when the user manually orbits (`OrbitControls` `'start'`).
  - **Synthesized Web Audio FX**: Crisp procedural Web Audio API sound effects for dice clatter, token hops, cash register chimes, gavel strikes, and property upgrades.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Custom Node.js HTTP + WebSocket Server (`server.ts`)**:
  - *Chosen Approach*: Run Next.js alongside a custom Node.js HTTP & WebSocket server on port 3000 (`ws` library) that manages both `/ws/game` (authoritative multiplayer Monopoly rooms) and `/ws/live` (server-side proxy bridge to Gemini `ai.live.connect` with `gemini-3.8-live`).
  - *Why*: Satisfies both the strict server-side Gemini API key rule (never exposing `GEMINI_API_KEY` to the browser) and the real-time multi-user requirement (true WebSocket room state synchronization across tabs/devices).
  - *Alternatives Considered*: Client-only state or HTTP polling was rejected because real-time multiplayer and low-latency 16kHz/24kHz PCM Live API streaming require full-duplex WebSockets.

- **Decision 2 — Optional & Non-Blocking AI Host Architecture**:
  - *Chosen Approach*: The AI Host can be toggled completely off for pure classic board gameplay, or toggled on with Male/Female voice selection and dynamic personality instructions. Commentary (`gemini-3.8-flash-tts`) runs asynchronously after game actions so dice rolls and turn transitions never block or lag while audio is synthesized.
  - *Why*: Keeps gameplay snappy (≤ 200ms UI feedback) while delivering expressive multi-persona voice acting when enabled.

- **Decision 3 — Procedural Canvas Textures & Studio PBR Environment**:
  - *Chosen Approach*: Generate all 40 board tile graphics, typography, price ribbons, bump maps, and contact shadows via high-DPI HTML5 2D `CanvasTexture` (`SRGBColorSpace`, max anisotropy) combined with `RoomEnvironment` + `PMREMGenerator` and `isSoftwareGl` frame-pacing protection.
  - *Why*: Guarantees zero 404 external asset failures, razor-sharp board text at grazing camera angles, and smooth performance across both hardware GPUs and software WebGL environments.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER (Next.js App)                        │
│                                                                            │
│  ┌──────────────────────────┐         ┌─────────────────────────────────┐  │
│  │   3D Board Viewport      │         │  Semantic DOM Overlay & Dock    │  │
│  │  (Isolated useRef Canvas)│◄───────►│  • Top Bar (Room, Ledger, Turn) │  │
│  │  • 40-Tile Luxury Board  │ Raycast │  • Collapsible Bottom HUD Dock  │  │
│  │  • 3-12 Part 3D Tokens   │ & Damp  │  • Title Deed & Auction Modal   │  │
│  │  • 3D Dice & Buildings   │         │  • Trade & Build Drawer         │  │
│  │  • Studio PBR + Soft-GL  │         │  • AI Host Studio & Live Mic    │  │
│  └──────────────────────────┘         └────────┬───────────────┬────────┘  │
└────────────────────────────────────────────────┼───────────────┼───────────┘
                                                 │               │
                        WebSocket (/ws/game)     │               │ WebSocket (/ws/live) & REST
                        Room State & Actions     ▼               ▼ (/api/host/tts, /api/landmark/search)
┌────────────────────────────────────────────────────────────────────────────┐
│                   CUSTOM NODE.JS + NEXT.JS SERVER (Port 3000)              │
│                                                                            │
│  ┌──────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │   Multiplayer Room Engine        │  │   Server-Side Gemini Proxy     │  │
│  │  • Authoritative Game State      │  │  • TTS: gemini-3.8-flash-tts   │  │
│  │  • Turn, Rent, Auction & Trade   │  │  • Live Voice: gemini-3.8-live │  │
│  │  • Smart Bot Decision Evaluator  │  │  • Search: gemini-3.8-flash    │  │
│  │  • Idempotent Event Broadcasts   │  │    with { googleSearch: {} }   │  │
│  └──────────────────────────────────┘  └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `GameRoomState`: `roomCode`, `mode` (`'ONLINE'` | `'LOCAL'`), `status` (`'LOBBY'` | `'PLAYING'` | `'GAME_OVER'`), `turnIndex`, `phase` (`'ROLL'` | `'MOVING'` | `'ACTION'` | `'AUCTION'` | `'END_TURN'`), `dice` (`[number, number]`, `doublesCount`), `players` (`PlayerState[]`), `properties` (`Record<number, PropertyOwnership>`), `activeAuction` (`AuctionState | null`), `activeTrade` (`TradeOffer | null`), `drawnCard` (`DeckCard | null`), `eventLog` (`GameEvent[]`), `hostConfig` (`HostConfig`).
  - `PlayerState`: `id`, `name`, `isBot`, `botDifficulty`, `tokenType` (6 composite 3D archetypes), `color`, `cash`, `position` (`0–39`), `inJail`, `jailTurns`, `getOutOfJailCards`, `bankrupt`, `connected`.
  - `HostConfig`: `enabled` (`boolean`), `gender` (`'MALE'` | `'FEMALE'`), `voiceName` (`'Charon'` | `'Fenrir'` | `'Puck'` for Male; `'Kore'` | `'Zephyr'` for Female), `personalityPreset` (`'WITTY_HOST'` | `'WALL_STREET_TYCOON'` | `'ZEN_ADVISOR'` | `'DRAMATIC_AUCTIONEER'` | `'CUSTOM'`), `customPersonalityPrompt` (`string`).

- **Interactive Component & State Mapping**:
  - **Lobby & Host Configurator**: Creates/joins a 6-character WebSocket room or starts a local pass-and-play session; switches AI Host on/off, selects Male/Female voice, picks one of the 4 confirmed personality presets or custom prompt, and previews the voice.
  - **Turn & Dice Controller**: Dispatches `game:roll_dice`; animates 3D dice physics and token hopping; triggers automatic rent deduction, tax, card draw, or buy/auction choice; executes automated bot turns after a 700ms natural pacing delay when `currentPlayer.isBot` is true.
  - **Property & Portfolio Manager**: Handles `game:buy_property`, `game:build_house` (validating full color-group monopoly and even building rules), `game:sell_house`, and `game:toggle_mortgage`.
  - **Live Auction & Trade Modals**: Supports competitive multi-player and bot bidding (`game:place_bid`, `game:pass_bid`) when a player declines an unowned property, plus bilateral cash-and-property trade proposals (`game:propose_trade`, `game:respond_trade`).
  - **Landmark Search Grounding Drawer**: Clicking any landmark space or pressing **"Live City Intel"** calls `/api/landmark/search` (`gemini-3.8-flash` with `googleSearch`) to display up-to-date real-world landmark facts, real estate context, and clickable source citations (`groundingChunks`).

- **Key Sequences & Integrations**:
  - **Expressive AI Host Commentary (`/api/host/tts`)**: On key game events (big rent hit, bankruptcy, auction gavel, jail), the server first generates a short, punchy in-character reaction line using `gemini-3.8-flash` tailored to the user's chosen personality and then synthesizes expressive audio via `gemini-3.8-flash-tts` with `speechMetadata.style` and selected Male/Female `prebuiltVoiceConfig.voiceName`, returning a 24kHz WAV (`audio/wav`) played smoothly in the browser.
  - **Real-Time Voice Conversations (`/ws/live`)**: Streams 16kHz mono PCM microphone audio from the browser over WebSocket to the server's `ai.live.connect({ model: "gemini-3.8-live" })` session injected with the current Monopoly board state and active Host personality/voice, returning gapless 24kHz PCM audio and live transcripts.

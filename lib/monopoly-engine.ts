import {
  BOARD_SIZE_CONFIGS,
  BoardSizeId,
  CHANCE_CARDS,
  CHEST_CARDS,
  ColorGroup,
  DeckCard,
  getBoardTiles,
  getCornerIndices,
  getGroupTileIndices,
  GLOBAL_EVENTS,
  GlobalEventDefinition,
  GlobalEventId,
  HostConfig,
  TokenArchetype,
} from './monopoly-data';

export type GameMode = 'LOCAL' | 'ONLINE';
export type RoomStatus = 'LOBBY' | 'PLAYING' | 'GAME_OVER';
export type TurnPhase = 'ROLL' | 'ACTION' | 'AUCTION' | 'END_TURN';

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  token: TokenArchetype;
  color: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  bankrupt: boolean;
  connected: boolean;
}

export interface PropertyState {
  tileIndex: number;
  ownerId: string | null;
  houses: number; // 0-4 houses, 5 = Grand Hotel
  mortgaged: boolean;
}

export interface AuctionState {
  tileIndex: number;
  highestBid: number;
  highestBidderId: string | null;
  activeBidderIds: string[];
  currentBidderIndex: number;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offerCash: number;
  requestCash: number;
  offerProperties: number[];
  requestProperties: number[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface ActiveGlobalEventState {
  event: GlobalEventDefinition;
  remainingTurns: number;
  triggeredAtTurn: number;
  playerImpacts: { playerId: string; playerName: string; deltaCash: number }[];
}

export interface TurnEventNotice {
  id: string;
  kind:
    | 'BUY_DECISION'
    | 'RENT_PAID'
    | 'TAX_PAID'
    | 'CARD_DRAWN'
    | 'JAIL_EVENT'
    | 'BANKRUPTCY'
    | 'LANDED_SAFE';
  playerId: string;
  playerName: string;
  tileIndex: number;
  tileName: string;
  tileCity: string;
  tileColorHex: string;
  title: string;
  subtitle: string;
  description: string;
  amountDelta?: number;
  creditorId?: string | null;
  creditorName?: string;
  passedGoBonus?: boolean;
  cardTitle?: string;
  cardDeck?: 'CHANCE' | 'CHEST';
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  text: string;
  type:
    | 'ROLL'
    | 'BUY'
    | 'RENT'
    | 'CARD'
    | 'JAIL'
    | 'AUCTION'
    | 'BUILD'
    | 'TRADE'
    | 'EVENT'
    | 'BANKRUPT'
    | 'SYSTEM';
  important?: boolean;
}

export interface GameRoomState {
  roomCode: string;
  mode: GameMode;
  boardSize: BoardSizeId;
  status: RoomStatus;
  turnIndex: number;
  phase: TurnPhase;
  dice: [number, number];
  doublesCount: number;
  lastRollWasDoubles: boolean;
  players: PlayerState[];
  properties: Record<number, PropertyState>;
  activeAuction: AuctionState | null;
  activeTrade: TradeOffer | null;
  drawnCard: DeckCard | null;
  turnNotice: TurnEventNotice | null;
  activeGlobalEvent: ActiveGlobalEventState | null;
  lastTriggeredGlobalEvent: ActiveGlobalEventState | null;
  completedTurns: number;
  turnsUntilNextEvent: number;
  turnTimeLimitSeconds: number;
  turnStartedAt: number;
  winnerId: string | null;
  logs: GameLogEntry[];
  hostConfig: HostConfig;
  lastHeadlineEvent: string | null;
  version: number;
}

export const GLOBAL_EVENT_INTERVAL_TURNS = 4;
export const DEFAULT_TURN_TIME_LIMIT_SECONDS = 60;

export function createInitialProperties(
  boardSize: BoardSizeId = 'CLASSIC'
): Record<number, PropertyState> {
  const tiles = getBoardTiles(boardSize);
  const props: Record<number, PropertyState> = {};
  for (const tile of tiles) {
    if (
      tile.type === 'PROPERTY' ||
      tile.type === 'RAILROAD' ||
      tile.type === 'UTILITY'
    ) {
      props[tile.index] = {
        tileIndex: tile.index,
        ownerId: null,
        houses: 0,
        mortgaged: false,
      };
    }
  }
  return props;
}

export function createInitialGameRoom(
  roomCode: string,
  mode: GameMode,
  players: PlayerState[],
  hostConfig: HostConfig,
  turnTimeLimitSeconds: number = DEFAULT_TURN_TIME_LIMIT_SECONDS,
  boardSize: BoardSizeId = 'CLASSIC'
): GameRoomState {
  const boardConfig = BOARD_SIZE_CONFIGS[boardSize];
  return {
    roomCode,
    mode,
    boardSize,
    status: 'PLAYING',
    turnIndex: 0,
    phase: 'ROLL',
    dice: [1, 1],
    doublesCount: 0,
    lastRollWasDoubles: false,
    players,
    properties: createInitialProperties(boardSize),
    activeAuction: null,
    activeTrade: null,
    drawnCard: null,
    turnNotice: null,
    activeGlobalEvent: null,
    lastTriggeredGlobalEvent: null,
    completedTurns: 0,
    turnsUntilNextEvent: GLOBAL_EVENT_INTERVAL_TURNS,
    turnTimeLimitSeconds,
    turnStartedAt: Date.now(),
    winnerId: null,
    logs: [
      {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        text: `Welcome to Grand Estates 3D (${boardConfig.name} · ${boardConfig.recommendedPlayers})! Match initialized with ${players.length} contenders.`,
        type: 'SYSTEM',
        important: true,
      },
    ],
    hostConfig,
    lastHeadlineEvent: `The Grand Estates match has begun on the ${boardConfig.name} with ${players.map((p) => p.name).join(', ')}. ${players[0]?.name || 'Player 1'} is first to roll!`,
    version: 1,
  };
}

function addLog(
  state: GameRoomState,
  text: string,
  type: GameLogEntry['type'],
  important = false
) {
  state.logs = [
    {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      text,
      type,
      important,
    },
    ...state.logs.slice(0, 44),
  ];
  if (important) {
    state.lastHeadlineEvent = text;
  }
}

/**
 * Returns the effective purchase price of a property accounting for active global events (e.g. Stock Market Crash -30%)
 */
export function getEffectivePropertyPrice(
  state: GameRoomState,
  tileIndex: number
): number {
  const tiles = getBoardTiles(state.boardSize);
  const tile = tiles[tileIndex];
  const basePrice = tile?.price || 0;
  if (!basePrice) return 0;
  const mult = state.activeGlobalEvent?.event.priceMultiplier ?? 1.0;
  return Math.max(10, Math.round((basePrice * mult) / 5) * 5);
}

/**
 * Returns the effective house/hotel build cost accounting for active global events
 */
export function getEffectiveHouseCost(
  state: GameRoomState,
  tileIndex: number
): number {
  const tiles = getBoardTiles(state.boardSize);
  const tile = tiles[tileIndex];
  const baseCost = tile?.houseCost || 0;
  if (!baseCost) return 0;
  const mult = state.activeGlobalEvent?.event.buildCostMultiplier ?? 1.0;
  return Math.max(10, Math.round((baseCost * mult) / 5) * 5);
}

export function ownsFullColorGroup(
  state: GameRoomState,
  playerId: string,
  group: ColorGroup
): boolean {
  const groupIndices = getGroupTileIndices(state.boardSize);
  const indices = groupIndices[group];
  if (!indices || indices.length === 0) return false;
  return indices.every(
    (idx) =>
      state.properties[idx]?.ownerId === playerId &&
      !state.properties[idx]?.mortgaged
  );
}

export function calculateRent(
  state: GameRoomState,
  tileIndex: number,
  diceTotal: number
): number {
  const tiles = getBoardTiles(state.boardSize);
  const groupIndices = getGroupTileIndices(state.boardSize);
  const tile = tiles[tileIndex];
  const prop = state.properties[tileIndex];
  if (!tile || !prop || !prop.ownerId || prop.mortgaged) return 0;

  const rentMult = state.activeGlobalEvent?.event.rentMultiplier ?? 1.0;
  let computedRent = 0;

  if (tile.type === 'PROPERTY' && tile.rent) {
    if (prop.houses > 0) {
      computedRent = tile.rent[Math.min(prop.houses, 5)] || tile.rent[0];
    } else {
      const baseRent = tile.rent[0];
      computedRent = ownsFullColorGroup(state, prop.ownerId, tile.group)
        ? baseRent * 2
        : baseRent;
    }
  } else if (tile.type === 'RAILROAD') {
    const ownedRailroads = groupIndices.RAILROAD.filter(
      (idx) =>
        state.properties[idx]?.ownerId === prop.ownerId &&
        !state.properties[idx]?.mortgaged
    ).length;
    const scale = [25, 50, 100, 200, 300, 400];
    computedRent = scale[Math.max(0, ownedRailroads - 1)] || 25;
  } else if (tile.type === 'UTILITY') {
    const ownedUtilities = groupIndices.UTILITY.filter(
      (idx) =>
        state.properties[idx]?.ownerId === prop.ownerId &&
        !state.properties[idx]?.mortgaged
    ).length;
    const multiplier = ownedUtilities >= 2 ? 10 : 4;
    computedRent = diceTotal * multiplier;
  }

  return Math.max(1, Math.round(computedRent * rentMult));
}

export function canBuildHouseOnTile(
  state: GameRoomState,
  playerId: string,
  tileIndex: number
): { allowed: boolean; reason?: string } {
  const tiles = getBoardTiles(state.boardSize);
  const groupMap = getGroupTileIndices(state.boardSize);
  const tile = tiles[tileIndex];
  const prop = state.properties[tileIndex];
  const player = state.players.find((p) => p.id === playerId);
  if (!tile || !prop || !player)
    return { allowed: false, reason: 'Invalid property' };
  if (tile.type !== 'PROPERTY' || !tile.houseCost)
    return { allowed: false, reason: 'Cannot build on this space' };
  if (prop.ownerId !== playerId)
    return { allowed: false, reason: 'You do not own this property' };
  if (prop.mortgaged)
    return { allowed: false, reason: 'Property is mortgaged' };
  if (prop.houses >= 5)
    return { allowed: false, reason: 'Grand Hotel already built' };

  const effectiveCost = getEffectiveHouseCost(state, tileIndex);
  if (player.cash < effectiveCost)
    return {
      allowed: false,
      reason: `Insufficient cash ($${effectiveCost} required)`,
    };

  const groupIndices = groupMap[tile.group];
  const ownsAll = groupIndices.every(
    (idx) =>
      state.properties[idx]?.ownerId === playerId &&
      !state.properties[idx]?.mortgaged
  );
  if (!ownsAll) {
    return {
      allowed: false,
      reason: 'Must own all unmortgaged properties in this color group',
    };
  }

  const minHousesInGroup = Math.min(
    ...groupIndices.map((idx) => state.properties[idx]?.houses ?? 0)
  );
  if (prop.houses > minHousesInGroup) {
    return {
      allowed: false,
      reason: 'Must build evenly across the color group',
    };
  }

  return { allowed: true };
}

function handleBankruptcyIfNeeded(
  state: GameRoomState,
  player: PlayerState,
  creditorId: string | null
) {
  const tiles = getBoardTiles(state.boardSize);
  while (player.cash < 0) {
    const propWithHouse = Object.values(state.properties)
      .filter((p) => p.ownerId === player.id && p.houses > 0)
      .sort((a, b) => b.houses - a.houses)[0];

    if (propWithHouse) {
      const tile = tiles[propWithHouse.tileIndex];
      const refund = Math.floor((tile?.houseCost || 50) / 2);
      propWithHouse.houses -= 1;
      player.cash += refund;
      addLog(
        state,
        `${player.name} liquidated a building on ${tile?.shortName || 'estate'} for $${refund}.`,
        'BUILD',
        false
      );
      continue;
    }

    const propToMortgage = Object.values(state.properties).find(
      (p) => p.ownerId === player.id && !p.mortgaged && p.houses === 0
    );
    if (propToMortgage) {
      const tile = tiles[propToMortgage.tileIndex];
      const priceMult = state.activeGlobalEvent?.event.priceMultiplier ?? 1.0;
      const baseVal =
        tile?.mortgageValue || Math.floor((tile?.price || 100) / 2);
      const val = Math.max(10, Math.round(baseVal * priceMult));
      propToMortgage.mortgaged = true;
      player.cash += val;
      addLog(
        state,
        `${player.name} mortgaged ${tile?.shortName || 'estate'} for $${val} to cover obligations.`,
        'BUILD',
        false
      );
      continue;
    }

    break;
  }

  if (player.cash < 0) {
    player.bankrupt = true;
    player.cash = 0;
    for (const prop of Object.values(state.properties)) {
      if (prop.ownerId === player.id) {
        prop.houses = 0;
        prop.ownerId = creditorId;
        if (!creditorId) {
          prop.mortgaged = false;
        }
      }
    }
    const creditorName = creditorId
      ? state.players.find((p) => p.id === creditorId)?.name || 'Creditor'
      : 'the Sovereign Bank';
    const tile = tiles[player.position] || tiles[0];
    state.turnNotice = {
      id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'BANKRUPTCY',
      playerId: player.id,
      playerName: player.name,
      tileIndex: tile.index,
      tileName: tile.name,
      tileCity: tile.city,
      tileColorHex: tile.colorHex,
      title: `${player.name} Declared Bankruptcy!`,
      subtitle: `All estates & holdings transferred to ${creditorName}`,
      description: `${player.name} could not cover their financial obligations at ${tile.name} (${tile.city}) and has been eliminated from the match.`,
      creditorId,
      creditorName,
    };
    addLog(
      state,
      `${player.name} has declared bankruptcy! All assets transferred to ${creditorName}.`,
      'BANKRUPT',
      true
    );

    const alivePlayers = state.players.filter((p) => !p.bankrupt);
    if (alivePlayers.length === 1) {
      state.status = 'GAME_OVER';
      state.winnerId = alivePlayers[0].id;
      addLog(
        state,
        `${alivePlayers[0].name} conquers Grand Estates 3D as the sole surviving tycoon!`,
        'SYSTEM',
        true
      );
    } else if (state.activeAuction) {
      state.activeAuction.activeBidderIds =
        state.activeAuction.activeBidderIds.filter((id) => id !== player.id);
      if (state.activeAuction.activeBidderIds.length === 0) {
        state.activeAuction = null;
        state.phase = 'END_TURN';
      } else {
        state.activeAuction.currentBidderIndex =
          state.activeAuction.currentBidderIndex %
          state.activeAuction.activeBidderIds.length;
      }
    }
  }
}

function advanceToNextActivePlayer(state: GameRoomState) {
  const totalPlayers = state.players.length;
  for (let offset = 1; offset <= totalPlayers; offset++) {
    const candidateIdx = (state.turnIndex + offset) % totalPlayers;
    if (!state.players[candidateIdx].bankrupt) {
      state.turnIndex = candidateIdx;
      break;
    }
  }
  state.phase = 'ROLL';
  state.doublesCount = 0;
  state.lastRollWasDoubles = false;
  state.turnStartedAt = Date.now();
}

/**
 * Triggers a Dynamic Global Event affecting all players immediately and/or for N turns
 */
export function executeGlobalEvent(
  state: GameRoomState,
  forcedEventId?: GlobalEventId
) {
  const chosenEvent = forcedEventId
    ? GLOBAL_EVENTS.find((e) => e.id === forcedEventId) || GLOBAL_EVENTS[0]
    : GLOBAL_EVENTS[Math.floor(Math.random() * GLOBAL_EVENTS.length)];

  const playerImpacts: {
    playerId: string;
    playerName: string;
    deltaCash: number;
  }[] = [];

  for (const player of state.players) {
    if (player.bankrupt) continue;
    const ownedProps = Object.values(state.properties).filter(
      (p) => p.ownerId === player.id
    );
    const propCount = ownedProps.length;
    const buildingCount = ownedProps.reduce(
      (sum, p) => sum + (p.houses > 0 ? p.houses : 0),
      0
    );

    let delta = 0;
    if (chosenEvent.flatCashBonus) {
      delta += chosenEvent.flatCashBonus;
    }
    if (chosenEvent.perPropertyGrant) {
      delta += propCount * chosenEvent.perPropertyGrant;
    }
    if (chosenEvent.perPropertyFee) {
      delta -= propCount * chosenEvent.perPropertyFee;
    }
    if (chosenEvent.perBuildingFee) {
      delta -= buildingCount * chosenEvent.perBuildingFee;
    }

    if (delta !== 0) {
      player.cash += delta;
      handleBankruptcyIfNeeded(state, player, null);
    }
    playerImpacts.push({
      playerId: player.id,
      playerName: player.name,
      deltaCash: delta,
    });
  }

  const eventState: ActiveGlobalEventState = {
    event: chosenEvent,
    remainingTurns: chosenEvent.durationTurns,
    triggeredAtTurn: state.completedTurns,
    playerImpacts,
  };

  state.lastTriggeredGlobalEvent = eventState;
  if (chosenEvent.durationTurns > 0) {
    state.activeGlobalEvent = eventState;
  } else {
    if (
      state.activeGlobalEvent &&
      state.activeGlobalEvent.remainingTurns <= 0
    ) {
      state.activeGlobalEvent = null;
    }
  }

  const impactSummary = playerImpacts
    .filter((i) => i.deltaCash !== 0)
    .map(
      (i) =>
        `${i.playerName} (${i.deltaCash > 0 ? '+' : ''}$${i.deltaCash})`
    )
    .join(', ');

  addLog(
    state,
    `GLOBAL MACRO EVENT — ${chosenEvent.title}: ${chosenEvent.summary}${
      impactSummary ? ` [Impacts: ${impactSummary}]` : ''
    }`,
    'EVENT',
    true
  );
}

function resolveTileLanding(
  state: GameRoomState,
  player: PlayerState,
  diceTotal: number,
  passedGoBonus = false
) {
  const tiles = getBoardTiles(state.boardSize);
  const corners = getCornerIndices(state.boardSize);
  const tile = tiles[player.position] || tiles[0];
  state.drawnCard = null;

  if (tile.type === 'GO') {
    addLog(state, `${player.name} arrived at ${tile.name}.`, 'ROLL', false);
    state.turnNotice = {
      id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'LANDED_SAFE',
      playerId: player.id,
      playerName: player.name,
      tileIndex: tile.index,
      tileName: tile.name,
      tileCity: tile.city,
      tileColorHex: tile.colorHex,
      title: `Landed on ${tile.name}`,
      subtitle: 'Sovereign Salary Collected: +$200',
      description: `${player.name} arrived directly at ${tile.name} and received $200 from the Sovereign Treasury.`,
      amountDelta: 200,
      passedGoBonus: true,
    };
    state.phase = 'END_TURN';
    return;
  }

  if (
    tile.type === 'PROPERTY' ||
    tile.type === 'RAILROAD' ||
    tile.type === 'UTILITY'
  ) {
    const prop = state.properties[tile.index];
    const effectivePrice = getEffectivePropertyPrice(state, tile.index);
    if (!prop.ownerId) {
      if (player.cash >= effectivePrice) {
        state.phase = 'ACTION';
        state.turnNotice = {
          id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'BUY_DECISION',
          playerId: player.id,
          playerName: player.name,
          tileIndex: tile.index,
          tileName: tile.name,
          tileCity: tile.city,
          tileColorHex: tile.colorHex,
          title: `Unowned Deed: ${tile.name}`,
          subtitle: `${tile.city}, ${tile.country} · Market Price $${effectivePrice}`,
          description: `${player.name} landed on ${tile.name}. Would you like to acquire this title deed for $${effectivePrice} or send the lot to a live auction?`,
          amountDelta: -effectivePrice,
          passedGoBonus,
        };
        addLog(
          state,
          `${player.name} landed on unowned ${tile.name} (${tile.city}) — market price $${effectivePrice}.`,
          'ROLL',
          true
        );
      } else {
        startAuction(state, tile.index);
      }
      return;
    }

    if (prop.ownerId === player.id) {
      addLog(
        state,
        `${player.name} visited their own estate at ${tile.name}.`,
        'ROLL',
        false
      );
      state.turnNotice = {
        id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'LANDED_SAFE',
        playerId: player.id,
        playerName: player.name,
        tileIndex: tile.index,
        tileName: tile.name,
        tileCity: tile.city,
        tileColorHex: tile.colorHex,
        title: `Visited Your Own Estate`,
        subtitle: `${tile.name} (${tile.city})`,
        description: `${player.name} inspected their own property at ${tile.name}. No rent is due.`,
        passedGoBonus,
      };
      state.phase = 'END_TURN';
      return;
    }

    if (prop.mortgaged) {
      addLog(
        state,
        `${player.name} landed on ${tile.name}, which is currently mortgaged. No rent due.`,
        'ROLL',
        false
      );
      state.turnNotice = {
        id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'LANDED_SAFE',
        playerId: player.id,
        playerName: player.name,
        tileIndex: tile.index,
        tileName: tile.name,
        tileCity: tile.city,
        tileColorHex: tile.colorHex,
        title: `Mortgaged Estate: No Rent Due`,
        subtitle: `${tile.name} (${tile.city})`,
        description: `${player.name} landed on ${tile.name}, which is currently mortgaged by its owner. No rent is collected.`,
        passedGoBonus,
      };
      state.phase = 'END_TURN';
      return;
    }

    const owner = state.players.find((p) => p.id === prop.ownerId);
    const rent = calculateRent(state, tile.index, diceTotal);
    if (owner && rent > 0) {
      player.cash -= rent;
      owner.cash += rent;
      state.turnNotice = {
        id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'RENT_PAID',
        playerId: player.id,
        playerName: player.name,
        tileIndex: tile.index,
        tileName: tile.name,
        tileCity: tile.city,
        tileColorHex: tile.colorHex,
        title: `Rent Paid: -$${rent}`,
        subtitle: `${tile.name} (${tile.city}) · Owned by ${owner.name}`,
        description: `${player.name} landed on ${tile.name} and paid $${rent} in rent to ${owner.name}.`,
        amountDelta: -rent,
        creditorId: owner.id,
        creditorName: owner.name,
        passedGoBonus,
      };
      addLog(
        state,
        `${player.name} paid $${rent} rent to ${owner.name} at ${tile.name} (${tile.city})!`,
        'RENT',
        rent >= 80
      );
      handleBankruptcyIfNeeded(state, player, owner.id);
    }
    state.phase = 'END_TURN';
    return;
  }

  if (tile.type === 'TAX') {
    const tax = tile.taxAmount || 100;
    player.cash -= tax;
    state.turnNotice = {
      id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'TAX_PAID',
      playerId: player.id,
      playerName: player.name,
      tileIndex: tile.index,
      tileName: tile.name,
      tileCity: tile.city,
      tileColorHex: tile.colorHex,
      title: `Sovereign Tax Paid: -$${tax}`,
      subtitle: `${tile.name} (${tile.city})`,
      description: `${player.name} landed on ${tile.name} and paid a mandatory $${tax} levy to the Sovereign Treasury.`,
      amountDelta: -tax,
      passedGoBonus,
    };
    addLog(
      state,
      `${player.name} paid $${tax} for ${tile.name}.`,
      'RENT',
      true
    );
    handleBankruptcyIfNeeded(state, player, null);
    state.phase = 'END_TURN';
    return;
  }

  if (tile.type === 'GO_TO_JAIL') {
    player.position = corners.jail;
    player.inJail = true;
    player.jailTurns = 0;
    state.lastRollWasDoubles = false;
    state.doublesCount = 0;
    state.turnNotice = {
      id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'JAIL_EVENT',
      playerId: player.id,
      playerName: player.name,
      tileIndex: corners.jail,
      tileName: tile.name,
      tileCity: tile.city,
      tileColorHex: tile.colorHex,
      title: `Dispatched to Compliance Detention!`,
      subtitle: `${player.name} must report to Detention immediately`,
      description: `On your next turn, you may post $50 bail, present a Diplomatic Immunity pass, or attempt to roll doubles to exit Detention.`,
    };
    addLog(
      state,
      `${player.name} was subpoenaed directly to Compliance Detention!`,
      'JAIL',
      true
    );
    state.phase = 'END_TURN';
    return;
  }

  if (tile.type === 'CHANCE' || tile.type === 'CHEST') {
    const deck = tile.type === 'CHANCE' ? CHANCE_CARDS : CHEST_CARDS;
    const card = deck[Math.floor(Math.random() * deck.length)];
    state.drawnCard = card;
    addLog(
      state,
      `${player.name} drew ${tile.name}: "${card.title}" — ${card.description}`,
      'CARD',
      true
    );

    const eff = card.effect;
    if (eff.type === 'CASH') {
      player.cash += eff.amount;
      state.turnNotice = {
        id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'CARD_DRAWN',
        playerId: player.id,
        playerName: player.name,
        tileIndex: tile.index,
        tileName: tile.name,
        tileCity: tile.city,
        tileColorHex: tile.colorHex,
        title: card.title,
        subtitle:
          card.deck === 'CHANCE'
            ? 'Fortune & Venture Deck'
            : 'Sovereign Treasury Deck',
        description: card.description,
        amountDelta: eff.amount,
        passedGoBonus,
        cardTitle: card.title,
        cardDeck: card.deck,
      };
      handleBankruptcyIfNeeded(state, player, null);
      state.phase = 'END_TURN';
    } else if (eff.type === 'GET_OUT_OF_JAIL') {
      player.getOutOfJailCards += 1;
      state.turnNotice = {
        id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'CARD_DRAWN',
        playerId: player.id,
        playerName: player.name,
        tileIndex: tile.index,
        tileName: tile.name,
        tileCity: tile.city,
        tileColorHex: tile.colorHex,
        title: card.title,
        subtitle:
          card.deck === 'CHANCE'
            ? 'Fortune & Venture Deck'
            : 'Sovereign Treasury Deck',
        description: card.description,
        passedGoBonus,
        cardTitle: card.title,
        cardDeck: card.deck,
      };
      state.phase = 'END_TURN';
    } else if (eff.type === 'GO_TO_JAIL') {
      player.position = corners.jail;
      player.inJail = true;
      player.jailTurns = 0;
      state.lastRollWasDoubles = false;
      state.doublesCount = 0;
      state.turnNotice = {
        id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'JAIL_EVENT',
        playerId: player.id,
        playerName: player.name,
        tileIndex: corners.jail,
        tileName: tile.name,
        tileCity: tile.city,
        tileColorHex: tile.colorHex,
        title: card.title,
        subtitle: 'Sent to Compliance Detention',
        description: card.description,
        cardTitle: card.title,
        cardDeck: card.deck,
      };
      state.phase = 'END_TURN';
    } else if (eff.type === 'MOVE_TO') {
      let targetPos = eff.position;
      if (targetPos >= tiles.length) {
        targetPos = tiles.length - 1;
      }
      let extraGo = passedGoBonus;
      if (eff.collectGo && targetPos < player.position) {
        player.cash += 200;
        extraGo = true;
        addLog(
          state,
          `${player.name} passed GO and collected $200.`,
          'ROLL',
          false
        );
      }
      player.position = targetPos;
      resolveTileLanding(state, player, diceTotal, extraGo);
      if (state.turnNotice) {
        state.turnNotice.cardTitle = card.title;
        state.turnNotice.cardDeck = card.deck;
      }
    } else if (eff.type === 'MOVE_STEPS') {
      player.position =
        (player.position + eff.steps + tiles.length) % tiles.length;
      resolveTileLanding(state, player, diceTotal, passedGoBonus);
      if (state.turnNotice) {
        state.turnNotice.cardTitle = card.title;
        state.turnNotice.cardDeck = card.deck;
      }
    } else if (eff.type === 'REPAIRS') {
      let totalCost = 0;
      for (const prop of Object.values(state.properties)) {
        if (prop.ownerId === player.id) {
          if (prop.houses === 5) totalCost += eff.perHotel;
          else if (prop.houses > 0) totalCost += prop.houses * eff.perHouse;
        }
      }
      player.cash -= totalCost;
      state.turnNotice = {
        id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'CARD_DRAWN',
        playerId: player.id,
        playerName: player.name,
        tileIndex: tile.index,
        tileName: tile.name,
        tileCity: tile.city,
        tileColorHex: tile.colorHex,
        title: card.title,
        subtitle: `Property Assessment: -$${totalCost}`,
        description: `${card.description} Total assessment paid: $${totalCost}.`,
        amountDelta: -totalCost,
        passedGoBonus,
        cardTitle: card.title,
        cardDeck: card.deck,
      };
      addLog(
        state,
        `${player.name} paid $${totalCost} in property restoration assessments.`,
        'RENT',
        totalCost > 0
      );
      handleBankruptcyIfNeeded(state, player, null);
      state.phase = 'END_TURN';
    } else if (eff.type === 'COLLECT_FROM_ALL') {
      let collected = 0;
      for (const other of state.players) {
        if (other.id !== player.id && !other.bankrupt) {
          other.cash -= eff.amountPerPlayer;
          collected += eff.amountPerPlayer;
          handleBankruptcyIfNeeded(state, other, player.id);
        }
      }
      player.cash += collected;
      state.turnNotice = {
        id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'CARD_DRAWN',
        playerId: player.id,
        playerName: player.name,
        tileIndex: tile.index,
        tileName: tile.name,
        tileCity: tile.city,
        tileColorHex: tile.colorHex,
        title: card.title,
        subtitle: `Collected +$${collected} from contenders`,
        description: card.description,
        amountDelta: collected,
        passedGoBonus,
        cardTitle: card.title,
        cardDeck: card.deck,
      };
      state.phase = 'END_TURN';
    }
    return;
  }

  state.turnNotice = {
    id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'LANDED_SAFE',
    playerId: player.id,
    playerName: player.name,
    tileIndex: tile.index,
    tileName: tile.name,
    tileCity: tile.city,
    tileColorHex: tile.colorHex,
    title: `Arrived at ${tile.name}`,
    subtitle: `${tile.city}, ${tile.country}`,
    description: tile.description,
    passedGoBonus,
  };
  state.phase = 'END_TURN';
}

export function startAuction(state: GameRoomState, tileIndex: number) {
  const tiles = getBoardTiles(state.boardSize);
  const tile = tiles[tileIndex];
  const effectivePrice = getEffectivePropertyPrice(state, tileIndex);
  const eligible = state.players
    .filter((p) => !p.bankrupt && p.cash >= 10)
    .map((p) => p.id);

  state.turnNotice = null;

  if (eligible.length === 0 || !tile) {
    state.phase = 'END_TURN';
    return;
  }

  state.phase = 'AUCTION';
  state.activeAuction = {
    tileIndex,
    highestBid: Math.max(10, Math.floor((effectivePrice || 60) * 0.25)),
    highestBidderId: null,
    activeBidderIds: eligible,
    currentBidderIndex: 0,
  };
  addLog(
    state,
    `Live Auction opened for ${tile.name} (${tile.city})! Starting reserve at $${state.activeAuction.highestBid}.`,
    'AUCTION',
    true
  );
}

export function applyGameAction(
  prevState: GameRoomState,
  action:
    | { type: 'ROLL_DICE'; forcedDice?: [number, number] }
    | { type: 'PAY_JAIL_BAIL' }
    | { type: 'USE_JAIL_CARD' }
    | { type: 'BUY_PROPERTY' }
    | { type: 'DECLINE_PROPERTY' }
    | { type: 'AUCTION_BID'; playerId: string; amount: number }
    | { type: 'AUCTION_PASS'; playerId: string }
    | { type: 'BUILD_HOUSE'; playerId: string; tileIndex: number }
    | { type: 'SELL_HOUSE'; playerId: string; tileIndex: number }
    | { type: 'TOGGLE_MORTGAGE'; playerId: string; tileIndex: number }
    | { type: 'PROPOSE_TRADE'; offer: Omit<TradeOffer, 'id' | 'status'> }
    | { type: 'RESPOND_TRADE'; accept: boolean }
    | { type: 'TRIGGER_GLOBAL_EVENT'; eventId?: GlobalEventId }
    | { type: 'DISMISS_GLOBAL_EVENT_BANNER' }
    | { type: 'DISMISS_TURN_NOTICE' }
    | { type: 'UPDATE_HOST_CONFIG'; hostConfig: Partial<HostConfig> }
    | { type: 'SET_TURN_TIME_LIMIT'; seconds: number }
    | { type: 'CHANGE_BOARD_SIZE'; boardSize: BoardSizeId }
    | { type: 'END_TURN'; isTimeout?: boolean }
): GameRoomState {
  const state: GameRoomState = structuredClone(prevState);
  state.version += 1;

  if (action.type === 'UPDATE_HOST_CONFIG') {
    state.hostConfig = { ...state.hostConfig, ...action.hostConfig };
    return state;
  }

  if (action.type === 'SET_TURN_TIME_LIMIT') {
    state.turnTimeLimitSeconds = Math.max(0, action.seconds);
    state.turnStartedAt = Date.now();
    return state;
  }

  if (action.type === 'CHANGE_BOARD_SIZE') {
    const newSize = action.boardSize;
    const cfg = BOARD_SIZE_CONFIGS[newSize];
    state.boardSize = newSize;
    state.properties = createInitialProperties(newSize);
    state.activeAuction = null;
    state.activeTrade = null;
    state.drawnCard = null;
    state.turnNotice = null;
    state.phase = 'ROLL';
    state.turnIndex = 0;
    state.doublesCount = 0;
    state.lastRollWasDoubles = false;
    state.turnStartedAt = Date.now();
    for (const p of state.players) {
      p.position = 0;
      p.cash = cfg.startingCash;
      p.inJail = false;
      p.jailTurns = 0;
      p.bankrupt = false;
    }
    addLog(
      state,
      `Switched board layout to ${cfg.name} (${cfg.recommendedPlayers}, $${cfg.startingCash} starting capital).`,
      'SYSTEM',
      true
    );
    return state;
  }

  if (action.type === 'DISMISS_GLOBAL_EVENT_BANNER') {
    state.lastTriggeredGlobalEvent = null;
    return state;
  }

  if (action.type === 'DISMISS_TURN_NOTICE') {
    state.turnNotice = null;
    state.drawnCard = null;
    return state;
  }

  if (action.type === 'TRIGGER_GLOBAL_EVENT') {
    executeGlobalEvent(state, action.eventId);
    state.turnsUntilNextEvent = GLOBAL_EVENT_INTERVAL_TURNS;
    return state;
  }

  if (state.status !== 'PLAYING') return state;
  const currentPlayer = state.players[state.turnIndex];
  if (!currentPlayer) return state;

  // If the current turn player is already bankrupt, immediately skip to the next active player
  if (currentPlayer.bankrupt && action.type !== 'END_TURN') {
    advanceToNextActivePlayer(state);
    return state;
  }

  const tiles = getBoardTiles(state.boardSize);
  const corners = getCornerIndices(state.boardSize);
  const totalTiles = tiles.length;

  switch (action.type) {
    case 'PAY_JAIL_BAIL': {
      if (
        !currentPlayer.inJail ||
        state.phase !== 'ROLL' ||
        currentPlayer.cash < 50
      ) {
        return state;
      }
      currentPlayer.cash -= 50;
      currentPlayer.inJail = false;
      currentPlayer.jailTurns = 0;
      state.turnNotice = null;
      addLog(
        state,
        `${currentPlayer.name} posted $50 bail and exited Compliance Detention.`,
        'JAIL',
        true
      );
      return state;
    }

    case 'USE_JAIL_CARD': {
      if (
        !currentPlayer.inJail ||
        state.phase !== 'ROLL' ||
        currentPlayer.getOutOfJailCards <= 0
      ) {
        return state;
      }
      currentPlayer.getOutOfJailCards -= 1;
      currentPlayer.inJail = false;
      currentPlayer.jailTurns = 0;
      state.turnNotice = null;
      addLog(
        state,
        `${currentPlayer.name} presented a Diplomatic Immunity credential and exited Detention.`,
        'JAIL',
        true
      );
      return state;
    }

    case 'ROLL_DICE': {
      if (state.phase !== 'ROLL') return state;
      const d1 = action.forcedDice
        ? action.forcedDice[0]
        : Math.floor(Math.random() * 6) + 1;
      const d2 = action.forcedDice
        ? action.forcedDice[1]
        : Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;
      const isDoubles = d1 === d2;
      state.dice = [d1, d2];
      state.drawnCard = null;
      state.turnNotice = null;

      if (currentPlayer.inJail) {
        if (isDoubles) {
          currentPlayer.inJail = false;
          currentPlayer.jailTurns = 0;
          state.lastRollWasDoubles = false;
          addLog(
            state,
            `${currentPlayer.name} rolled doubles (${d1}+${d2}) to break out of Detention!`,
            'JAIL',
            true
          );
        } else {
          currentPlayer.jailTurns += 1;
          if (currentPlayer.jailTurns >= 3) {
            currentPlayer.cash -= 50;
            currentPlayer.inJail = false;
            currentPlayer.jailTurns = 0;
            addLog(
              state,
              `${currentPlayer.name} served 3 turns in Detention, paid $50 mandatory release, and moves ${total} spaces.`,
              'JAIL',
              true
            );
            handleBankruptcyIfNeeded(state, currentPlayer, null);
            if (currentPlayer.bankrupt) {
              state.phase = 'END_TURN';
              return state;
            }
          } else {
            const jailTile = tiles[corners.jail] || tiles[0];
            state.turnNotice = {
              id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              kind: 'JAIL_EVENT',
              playerId: currentPlayer.id,
              playerName: currentPlayer.name,
              tileIndex: corners.jail,
              tileName: jailTile.name,
              tileCity: jailTile.city,
              tileColorHex: jailTile.colorHex,
              title: `Remained in Detention (${currentPlayer.jailTurns}/3)`,
              subtitle: `Rolled ${d1} + ${d2} (No Doubles)`,
              description: `${currentPlayer.name} did not roll doubles and remains in Compliance Detention. You may pay $50 bail on your next turn.`,
            };
            addLog(
              state,
              `${currentPlayer.name} rolled ${d1}+${d2} (no doubles) and remains in Detention (${currentPlayer.jailTurns}/3).`,
              'JAIL',
              false
            );
            state.phase = 'END_TURN';
            return state;
          }
        }
      } else {
        if (isDoubles) {
          state.doublesCount += 1;
          state.lastRollWasDoubles = true;
          if (state.doublesCount >= 3) {
            currentPlayer.position = corners.jail;
            currentPlayer.inJail = true;
            currentPlayer.jailTurns = 0;
            state.doublesCount = 0;
            state.lastRollWasDoubles = false;
            const jailTile = tiles[corners.jail] || tiles[0];
            state.turnNotice = {
              id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              kind: 'JAIL_EVENT',
              playerId: currentPlayer.id,
              playerName: currentPlayer.name,
              tileIndex: corners.jail,
              tileName: jailTile.name,
              tileCity: jailTile.city,
              tileColorHex: jailTile.colorHex,
              title: `3 Consecutive Doubles — Sent to Detention!`,
              subtitle: `Rolled ${d1} + ${d2} (Third Doubles in a Row)`,
              description: `${currentPlayer.name} rolled three consecutive doubles and was dispatched directly to Compliance Detention!`,
            };
            addLog(
              state,
              `${currentPlayer.name} rolled 3 consecutive doubles (${d1}+${d2}) — sent to Compliance Detention for speeding!`,
              'JAIL',
              true
            );
            state.phase = 'END_TURN';
            return state;
          }
        } else {
          state.doublesCount = 0;
          state.lastRollWasDoubles = false;
        }
      }

      const prevPos = currentPlayer.position;
      const nextPos = (prevPos + total) % totalTiles;
      let passedGo = false;
      if (prevPos + total >= totalTiles && nextPos !== 0) {
        currentPlayer.cash += 200;
        passedGo = true;
        addLog(
          state,
          `${currentPlayer.name} passed Grand Departure (GO) and collected $200.`,
          'ROLL',
          false
        );
      } else if (nextPos === 0) {
        currentPlayer.cash += 200;
        passedGo = true;
        addLog(
          state,
          `${currentPlayer.name} landed directly on Grand Departure (GO) and collected $200!`,
          'ROLL',
          true
        );
      }

      currentPlayer.position = nextPos;
      resolveTileLanding(state, currentPlayer, total, passedGo);
      // If the active player went bankrupt from landing on this tile (rent/tax/card), immediately skip their turn so the game never waits on a bankrupt player
      if (currentPlayer.bankrupt && state.status === 'PLAYING') {
        advanceToNextActivePlayer(state);
      }
      return state;
    }

    case 'BUY_PROPERTY': {
      if (state.phase !== 'ACTION') return state;
      const tile = tiles[currentPlayer.position];
      const prop = state.properties[currentPlayer.position];
      const effectivePrice = getEffectivePropertyPrice(
        state,
        currentPlayer.position
      );
      if (!tile || !prop || prop.ownerId || !effectivePrice) return state;
      if (currentPlayer.cash < effectivePrice) return state;

      currentPlayer.cash -= effectivePrice;
      prop.ownerId = currentPlayer.id;
      state.turnNotice = null;
      const completedMonopoly = ownsFullColorGroup(
        state,
        currentPlayer.id,
        tile.group
      );
      addLog(
        state,
        completedMonopoly
          ? `${currentPlayer.name} acquired ${tile.name} (${tile.city}) for $${effectivePrice} and completed the ${tile.group} Monopoly!`
          : `${currentPlayer.name} purchased ${tile.name} (${tile.city}) for $${effectivePrice}.`,
        'BUY',
        true
      );
      state.phase = 'END_TURN';
      return state;
    }

    case 'DECLINE_PROPERTY': {
      if (state.phase !== 'ACTION') return state;
      state.turnNotice = null;
      startAuction(state, currentPlayer.position);
      return state;
    }

    case 'AUCTION_BID': {
      if (state.phase !== 'AUCTION' || !state.activeAuction) return state;
      const auction = state.activeAuction;
      const bidder = state.players.find((p) => p.id === action.playerId);
      if (!bidder || bidder.bankrupt) return state;
      if (!auction.activeBidderIds.includes(action.playerId)) return state;
      if (
        action.amount <= auction.highestBid &&
        auction.highestBidderId !== null
      )
        return state;
      if (bidder.cash < action.amount) return state;

      auction.highestBid = action.amount;
      auction.highestBidderId = bidder.id;
      const tile = tiles[auction.tileIndex];
      addLog(
        state,
        `${bidder.name} bid $${action.amount} for ${tile?.shortName || 'estate'}!`,
        'AUCTION',
        false
      );

      if (auction.activeBidderIds.length === 1) {
        bidder.cash -= auction.highestBid;
        state.properties[auction.tileIndex].ownerId = bidder.id;
        addLog(
          state,
          `Gavel down! ${bidder.name} won ${tile?.name || 'estate'} at auction for $${auction.highestBid}!`,
          'AUCTION',
          true
        );
        state.activeAuction = null;
        state.phase = 'END_TURN';
      } else {
        auction.currentBidderIndex =
          (auction.currentBidderIndex + 1) % auction.activeBidderIds.length;
      }
      return state;
    }

    case 'AUCTION_PASS': {
      if (state.phase !== 'AUCTION' || !state.activeAuction) return state;
      const auction = state.activeAuction;
      const passPlayer = state.players.find((p) => p.id === action.playerId);
      auction.activeBidderIds = auction.activeBidderIds.filter(
        (id) => id !== action.playerId
      );
      const tile = tiles[auction.tileIndex];
      if (passPlayer) {
        addLog(
          state,
          `${passPlayer.name} withdrew from bidding on ${tile?.shortName || 'estate'}.`,
          'AUCTION',
          false
        );
      }

      if (
        auction.activeBidderIds.length === 1 &&
        auction.highestBidderId !== null
      ) {
        const winner = state.players.find(
          (p) => p.id === auction.highestBidderId
        );
        if (winner) {
          winner.cash -= auction.highestBid;
          state.properties[auction.tileIndex].ownerId = winner.id;
          addLog(
            state,
            `Sold! ${winner.name} won ${tile?.name || 'estate'} at auction for $${auction.highestBid}!`,
            'AUCTION',
            true
          );
        }
        state.activeAuction = null;
        state.phase = 'END_TURN';
      } else if (auction.activeBidderIds.length === 0) {
        if (auction.highestBidderId) {
          const winner = state.players.find(
            (p) => p.id === auction.highestBidderId
          );
          if (winner) {
            winner.cash -= auction.highestBid;
            state.properties[auction.tileIndex].ownerId = winner.id;
            addLog(
              state,
              `Sold! ${winner.name} won ${tile?.name || 'estate'} at auction for $${auction.highestBid}!`,
              'AUCTION',
              true
            );
          }
        } else {
          addLog(
            state,
            `No bids placed for ${tile?.name || 'estate'}. Deed remains with the Sovereign Bank.`,
            'AUCTION',
            false
          );
        }
        state.activeAuction = null;
        state.phase = 'END_TURN';
      } else {
        auction.currentBidderIndex =
          auction.currentBidderIndex % auction.activeBidderIds.length;
      }
      return state;
    }

    case 'BUILD_HOUSE': {
      const check = canBuildHouseOnTile(
        state,
        action.playerId,
        action.tileIndex
      );
      if (!check.allowed) return state;
      const tile = tiles[action.tileIndex];
      const prop = state.properties[action.tileIndex];
      const player = state.players.find((p) => p.id === action.playerId)!;
      const effectiveCost = getEffectiveHouseCost(state, action.tileIndex);
      player.cash -= effectiveCost;
      prop.houses += 1;
      const label =
        prop.houses === 5 ? 'a Grand Hotel' : `Villa #${prop.houses}`;
      addLog(
        state,
        `${player.name} constructed ${label} on ${tile.name} (${tile.city}) for $${effectiveCost}!`,
        'BUILD',
        prop.houses === 5
      );
      return state;
    }

    case 'SELL_HOUSE': {
      const tile = tiles[action.tileIndex];
      const prop = state.properties[action.tileIndex];
      const player = state.players.find((p) => p.id === action.playerId);
      if (!tile || !prop || !player) return state;
      if (prop.ownerId !== action.playerId || prop.houses <= 0) return state;
      const refund = Math.floor((tile.houseCost || 50) / 2);
      prop.houses -= 1;
      player.cash += refund;
      addLog(
        state,
        `${player.name} sold a building on ${tile.shortName} for $${refund}.`,
        'BUILD',
        false
      );
      return state;
    }

    case 'TOGGLE_MORTGAGE': {
      const tile = tiles[action.tileIndex];
      const prop = state.properties[action.tileIndex];
      const player = state.players.find((p) => p.id === action.playerId);
      if (!tile || !prop || !player || prop.ownerId !== action.playerId)
        return state;

      const priceMult = state.activeGlobalEvent?.event.priceMultiplier ?? 1.0;
      const baseMortgageVal =
        tile.mortgageValue || Math.floor((tile.price || 100) / 2);
      const mortgageVal = Math.max(
        10,
        Math.round(baseMortgageVal * priceMult)
      );

      if (!prop.mortgaged) {
        if (prop.houses > 0) return state;
        prop.mortgaged = true;
        player.cash += mortgageVal;
        addLog(
          state,
          `${player.name} mortgaged ${tile.shortName} for $${mortgageVal}.`,
          'BUILD',
          false
        );
      } else {
        const unmortgageCost = Math.ceil(mortgageVal * 1.1);
        if (player.cash < unmortgageCost) return state;
        player.cash -= unmortgageCost;
        prop.mortgaged = false;
        addLog(
          state,
          `${player.name} lifted the mortgage on ${tile.shortName} for $${unmortgageCost}.`,
          'BUILD',
          false
        );
      }
      return state;
    }

    case 'PROPOSE_TRADE': {
      const fromP = state.players.find(
        (p) => p.id === action.offer.fromPlayerId
      );
      const toP = state.players.find((p) => p.id === action.offer.toPlayerId);
      if (!fromP || !toP) return state;
      state.activeTrade = {
        ...action.offer,
        id: `trade-${Date.now()}`,
        status: 'PENDING',
      };
      addLog(
        state,
        `${fromP.name} proposed a strategic portfolio trade to ${toP.name}.`,
        'TRADE',
        true
      );

      if (toP.isBot) {
        const offerValue =
          action.offer.offerCash +
          action.offer.offerProperties.reduce(
            (sum, idx) => sum + getEffectivePropertyPrice(state, idx),
            0
          );
        const requestValue =
          action.offer.requestCash +
          action.offer.requestProperties.reduce(
            (sum, idx) => sum + getEffectivePropertyPrice(state, idx) * 1.15,
            0
          );
        const botAccepts =
          offerValue >= requestValue && toP.cash >= action.offer.requestCash;
        return applyGameAction(state, {
          type: 'RESPOND_TRADE',
          accept: botAccepts,
        });
      }
      return state;
    }

    case 'RESPOND_TRADE': {
      const trade = state.activeTrade;
      if (!trade || trade.status !== 'PENDING') return state;
      const fromP = state.players.find((p) => p.id === trade.fromPlayerId);
      const toP = state.players.find((p) => p.id === trade.toPlayerId);
      if (!fromP || !toP) {
        state.activeTrade = null;
        return state;
      }

      if (
        action.accept &&
        fromP.cash >= trade.offerCash &&
        toP.cash >= trade.requestCash
      ) {
        fromP.cash = fromP.cash - trade.offerCash + trade.requestCash;
        toP.cash = toP.cash - trade.requestCash + trade.offerCash;

        for (const idx of trade.offerProperties) {
          if (state.properties[idx]?.ownerId === fromP.id) {
            state.properties[idx].ownerId = toP.id;
          }
        }
        for (const idx of trade.requestProperties) {
          if (state.properties[idx]?.ownerId === toP.id) {
            state.properties[idx].ownerId = fromP.id;
          }
        }
        addLog(
          state,
          `Deal closed! ${toP.name} accepted the portfolio trade with ${fromP.name}!`,
          'TRADE',
          true
        );
      } else {
        addLog(
          state,
          `${toP.name} declined the trade proposal from ${fromP.name}.`,
          'TRADE',
          false
        );
      }
      state.activeTrade = null;
      return state;
    }

    case 'END_TURN': {
      if (
        !action.isTimeout &&
        !currentPlayer.bankrupt &&
        state.phase !== 'END_TURN'
      )
        return state;
      state.drawnCard = null;
      if (state.turnNotice?.kind !== 'BANKRUPTCY') {
        state.turnNotice = null;
      }

      if (action.isTimeout) {
        if (state.phase === 'AUCTION' && state.activeAuction) {
          const auction = state.activeAuction;
          if (auction.highestBidderId) {
            const winner = state.players.find(
              (p) => p.id === auction.highestBidderId
            );
            const tile = tiles[auction.tileIndex];
            if (winner && winner.cash >= auction.highestBid && tile) {
              winner.cash -= auction.highestBid;
              state.properties[auction.tileIndex].ownerId = winner.id;
              addLog(
                state,
                `Turn clock expired during auction — ${tile.shortName} awarded to highest bidder ${winner.name} for $${auction.highestBid}.`,
                'AUCTION',
                true
              );
            }
          }
          state.activeAuction = null;
        }
        state.lastRollWasDoubles = false;
        state.doublesCount = 0;
        addLog(
          state,
          `Turn clock expired (${state.turnTimeLimitSeconds}s) — ${currentPlayer.name}'s turn was automatically ended.`,
          'SYSTEM',
          true
        );
      }

      if (
        !action.isTimeout &&
        state.lastRollWasDoubles &&
        !currentPlayer.inJail &&
        !currentPlayer.bankrupt
      ) {
        state.phase = 'ROLL';
        state.lastRollWasDoubles = false;
        state.turnStartedAt = Date.now();
        addLog(
          state,
          `${currentPlayer.name} rolled doubles and takes an extra turn!`,
          'ROLL',
          false
        );
        return state;
      }

      state.doublesCount = 0;
      state.lastRollWasDoubles = false;
      state.completedTurns += 1;

      // Decrement active global event duration if one is in effect
      if (state.activeGlobalEvent) {
        state.activeGlobalEvent.remainingTurns -= 1;
        if (state.activeGlobalEvent.remainingTurns <= 0) {
          addLog(
            state,
            `Market Update: "${state.activeGlobalEvent.event.title}" has concluded. Property valuations and rents return to baseline.`,
            'EVENT',
            false
          );
          state.activeGlobalEvent = null;
        }
      }

      // Periodically trigger a Dynamic Global Event
      state.turnsUntilNextEvent -= 1;
      if (state.turnsUntilNextEvent <= 0 && state.status === 'PLAYING') {
        state.turnsUntilNextEvent = GLOBAL_EVENT_INTERVAL_TURNS;
        executeGlobalEvent(state);
      }

      // Advance to next non-bankrupt player
      advanceToNextActivePlayer(state);
      return state;
    }
  }
}

/**
 * Computes the next automatic move for an AI Bot when it is the bot's turn or auction turn.
 */
export function computeNextBotAction(
  state: GameRoomState
): Parameters<typeof applyGameAction>[1] | null {
  if (state.status !== 'PLAYING') return null;

  const tiles = getBoardTiles(state.boardSize);
  const groupMap = getGroupTileIndices(state.boardSize);

  if (state.phase === 'AUCTION' && state.activeAuction) {
    const auction = state.activeAuction;
    const bidderId = auction.activeBidderIds[auction.currentBidderIndex];
    const bot = state.players.find((p) => p.id === bidderId);
    if (!bot) return null;
    if (bot.bankrupt) {
      return { type: 'AUCTION_PASS', playerId: bot.id };
    }
    if (!bot.isBot) return null;

    const tile = tiles[auction.tileIndex];
    if (!tile) return { type: 'AUCTION_PASS', playerId: bot.id };
    const effectivePrice = getEffectivePropertyPrice(state, auction.tileIndex);
    const groupIndices = groupMap[tile.group] || [];
    const ownedInGroup = groupIndices.filter(
      (idx) => state.properties[idx]?.ownerId === bot.id
    ).length;
    const maxWilling = Math.min(
      bot.cash - 60,
      Math.floor(effectivePrice * (ownedInGroup > 0 ? 1.25 : 0.95))
    );
    const nextBid =
      auction.highestBidderId === null
        ? auction.highestBid
        : auction.highestBid + 15;

    if (nextBid <= maxWilling && auction.highestBidderId !== bot.id) {
      return { type: 'AUCTION_BID', playerId: bot.id, amount: nextBid };
    }
    return { type: 'AUCTION_PASS', playerId: bot.id };
  }

  const currentPlayer = state.players[state.turnIndex];
  if (!currentPlayer) return null;
  // Never wait on a bankrupt player (whether bot or human) — skip immediately!
  if (currentPlayer.bankrupt) {
    return { type: 'END_TURN', isTimeout: true };
  }
  if (!currentPlayer.isBot) return null;

  if (state.phase === 'ROLL') {
    if (currentPlayer.inJail) {
      if (currentPlayer.getOutOfJailCards > 0) {
        return { type: 'USE_JAIL_CARD' };
      }
      if (currentPlayer.cash >= 250) {
        return { type: 'PAY_JAIL_BAIL' };
      }
    }
    return { type: 'ROLL_DICE' };
  }

  if (state.phase === 'ACTION') {
    const effectivePrice = getEffectivePropertyPrice(
      state,
      currentPlayer.position
    );
    if (
      currentPlayer.cash >= effectivePrice + 50 ||
      currentPlayer.cash >= effectivePrice
    ) {
      return { type: 'BUY_PROPERTY' };
    }
    return { type: 'DECLINE_PROPERTY' };
  }

  if (state.phase === 'END_TURN') {
    for (const prop of Object.values(state.properties)) {
      if (prop.ownerId === currentPlayer.id) {
        const effectiveCost = getEffectiveHouseCost(state, prop.tileIndex);
        if (
          effectiveCost > 0 &&
          currentPlayer.cash - effectiveCost >= 180 &&
          canBuildHouseOnTile(state, currentPlayer.id, prop.tileIndex).allowed
        ) {
          return {
            type: 'BUILD_HOUSE',
            playerId: currentPlayer.id,
            tileIndex: prop.tileIndex,
          };
        }
      }
    }
    return { type: 'END_TURN' };
  }

  return null;
}

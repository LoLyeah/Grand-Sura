export type TileType =
  | 'GO'
  | 'PROPERTY'
  | 'RAILROAD'
  | 'UTILITY'
  | 'TAX'
  | 'CHANCE'
  | 'CHEST'
  | 'JAIL'
  | 'FREE_PARKING'
  | 'GO_TO_JAIL';

export type ColorGroup =
  | 'BROWN'
  | 'LIGHT_BLUE'
  | 'PINK'
  | 'ORANGE'
  | 'RED'
  | 'YELLOW'
  | 'GREEN'
  | 'DARK_BLUE'
  | 'TEAL'
  | 'INDIGO'
  | 'CRIMSON'
  | 'AMBER'
  | 'VIOLET'
  | 'EMERALD'
  | 'COPPER'
  | 'PLATINUM'
  | 'RAILROAD'
  | 'UTILITY'
  | 'NONE';

export type BoardSizeId =
  | 'MINI'
  | 'CLASSIC'
  | 'MEGA'
  | 'CONTINENTAL'
  | 'COLOSSAL';

export interface BoardSizeConfig {
  id: BoardSizeId;
  name: string;
  shortLabel: string;
  totalTiles: number; // 24, 40, 52, 68, 84
  sideLength: number; // 6, 10, 13, 17, 21 (corners at 0, sideLength, 2*sideLength, 3*sideLength)
  gridDimension: number; // 7, 11, 14, 18, 22
  recommendedPlayers: string;
  recommendedMinPlayers: number;
  recommendedMaxPlayers: number;
  defaultPlayerCount: number;
  maxAllowedPlayers: number;
  startingCash: number;
  estimatedDuration: string;
  description: string;
}

export const BOARD_SIZE_CONFIGS: Record<BoardSizeId, BoardSizeConfig> = {
  MINI: {
    id: 'MINI',
    name: 'Express Salon Board (24 Spaces)',
    shortLabel: 'Mini · 24 Spaces',
    totalTiles: 24,
    sideLength: 6,
    gridDimension: 7,
    recommendedPlayers: 'Recommended: 2–3 Players',
    recommendedMinPlayers: 2,
    recommendedMaxPlayers: 3,
    defaultPlayerCount: 2,
    maxAllowedPlayers: 4,
    startingCash: 1200,
    estimatedDuration: '15–25 mins',
    description:
      'Compact 7×7 perimeter with 2-deed monopolies for rapid acquisitions and high-tempo duels.',
  },
  CLASSIC: {
    id: 'CLASSIC',
    name: 'Classic Sovereign Board (40 Spaces)',
    shortLabel: 'Classic · 40 Spaces',
    totalTiles: 40,
    sideLength: 10,
    gridDimension: 11,
    recommendedPlayers: 'Recommended: 3–5 Players',
    recommendedMinPlayers: 3,
    recommendedMaxPlayers: 5,
    defaultPlayerCount: 4,
    maxAllowedPlayers: 6,
    startingCash: 1500,
    estimatedDuration: '35–50 mins',
    description:
      'The signature 11×11 world landmark circuit balanced for strategic 3 to 5 tycoon syndicates.',
  },
  MEGA: {
    id: 'MEGA',
    name: 'Grand Metropolis Board (52 Spaces)',
    shortLabel: 'Mega · 52 Spaces',
    totalTiles: 52,
    sideLength: 13,
    gridDimension: 14,
    recommendedPlayers: 'Recommended: 5–8 Players',
    recommendedMinPlayers: 5,
    recommendedMaxPlayers: 8,
    defaultPlayerCount: 6,
    maxAllowedPlayers: 8,
    startingCash: 2000,
    estimatedDuration: '50–75 mins',
    description:
      'Expanded 14×14 global empire featuring 52 world capitals, 6 transit lines, and higher starting capital.',
  },
  CONTINENTAL: {
    id: 'CONTINENTAL',
    name: 'Continental Syndicate Board (68 Spaces)',
    shortLabel: 'Continental · 68 Spaces',
    totalTiles: 68,
    sideLength: 17,
    gridDimension: 18,
    recommendedPlayers: 'Recommended: 8–12 Players',
    recommendedMinPlayers: 8,
    recommendedMaxPlayers: 12,
    defaultPlayerCount: 10,
    maxAllowedPlayers: 12,
    startingCash: 2500,
    estimatedDuration: '65–95 mins',
    description:
      'Grand 18×18 intercontinental circuit with 12 landmark districts and 8 transit hubs built for 8–12 players.',
  },
  COLOSSAL: {
    id: 'COLOSSAL',
    name: 'Global Sovereign Summit (84 Spaces)',
    shortLabel: 'Colossal · 84 Spaces',
    totalTiles: 84,
    sideLength: 21,
    gridDimension: 22,
    recommendedPlayers: 'Recommended: 12–16 Players',
    recommendedMinPlayers: 12,
    recommendedMaxPlayers: 16,
    defaultPlayerCount: 14,
    maxAllowedPlayers: 16,
    startingCash: 3000,
    estimatedDuration: '90–120 mins',
    description:
      'Massive 22×22 world-scale board with 84 spaces and 16 distinct sovereign districts engineered for up to 16 players.',
  },
};

export type TokenArchetype =
  | 'GRAND_TOURER'
  | 'LOCOMOTIVE'
  | 'TOP_HAT'
  | 'YACHT'
  | 'CROWNED_KNIGHT'
  | 'BIPLANE';

export type HostGender = 'MALE' | 'FEMALE';

export type HostVoiceName = 'Charon' | 'Fenrir' | 'Puck' | 'Kore' | 'Zephyr';

export type PersonalityPresetId =
  | 'WITTY_HOST'
  | 'WALL_STREET_TYCOON'
  | 'ZEN_ADVISOR'
  | 'DRAMATIC_AUCTIONEER'
  | 'CUSTOM';

export interface HostConfig {
  enabled: boolean;
  gender: HostGender;
  voiceName: HostVoiceName;
  personalityPreset: PersonalityPresetId;
  customPersonalityPrompt: string;
  autoSpeakEvents: boolean;
}

export type GlobalEventId =
  | 'STOCK_MARKET_CRASH'
  | 'PROPERTY_TAX_AUDIT'
  | 'URBAN_DEVELOPMENT_GRANT'
  | 'GLOBAL_TOURISM_BOOM'
  | 'QUANTITATIVE_EASING'
  | 'INFRASTRUCTURE_SURGE';

export interface GlobalEventDefinition {
  id: GlobalEventId;
  title: string;
  category: 'CRASH' | 'AUDIT' | 'GRANT' | 'BOOM';
  summary: string;
  impactLabel: string;
  durationTurns: number; // 0 = instant one-shot, >0 = persists for N turns
  priceMultiplier: number; // e.g. 0.7 during Stock Market Crash
  rentMultiplier: number; // e.g. 1.5 during Tourism Boom
  buildCostMultiplier: number; // e.g. 0.6 during Quantitative Easing
  flatCashBonus?: number; // e.g. +$150 for Urban Development Grant
  perPropertyFee?: number; // e.g. $25 per property for Property Tax Audit
  perBuildingFee?: number; // e.g. $35 per building for Property Tax Audit
  perPropertyGrant?: number; // e.g. +$25 per owned property
}

export const GLOBAL_EVENTS: GlobalEventDefinition[] = [
  {
    id: 'STOCK_MARKET_CRASH',
    title: 'Stock Market Crash',
    category: 'CRASH',
    summary:
      'Global equities plunge into a liquidity correction! All unowned property purchase prices and mortgage valuations decrease by 30%, and base rents dip by 15% for the next 4 turns.',
    impactLabel: 'Property Prices -30% · Rents -15% (4 Turns)',
    durationTurns: 4,
    priceMultiplier: 0.7,
    rentMultiplier: 0.85,
    buildCostMultiplier: 1.0,
  },
  {
    id: 'PROPERTY_TAX_AUDIT',
    title: 'Property Tax Audit',
    category: 'AUDIT',
    summary:
      'Sovereign tax inspectors conduct a mandatory portfolio audit across all players! Every player immediately pays $25 per owned landmark deed plus $35 per constructed Villa or Hotel.',
    impactLabel: 'Immediate Fee: -$25 / Property · -$35 / Building',
    durationTurns: 0,
    priceMultiplier: 1.0,
    rentMultiplier: 1.0,
    buildCostMultiplier: 1.0,
    perPropertyFee: 25,
    perBuildingFee: 35,
  },
  {
    id: 'URBAN_DEVELOPMENT_GRANT',
    title: 'Urban Development Grant',
    category: 'GRANT',
    summary:
      'The World Heritage & Civic Renewal Council issues an immediate capital stimulus! Every solvent player receives a $150 base cash bonus plus $25 for each landmark they own.',
    impactLabel: 'Immediate Bonus: +$150 Base · +$25 / Owned Deed',
    durationTurns: 0,
    priceMultiplier: 1.0,
    rentMultiplier: 1.0,
    buildCostMultiplier: 1.0,
    flatCashBonus: 150,
    perPropertyGrant: 25,
  },
  {
    id: 'GLOBAL_TOURISM_BOOM',
    title: 'Global Luxury Tourism Boom',
    category: 'BOOM',
    summary:
      'Record international travel floods world capitals! All landmark and transit rents surge by +50%, while property acquisition prices rise +15% for the next 4 turns.',
    impactLabel: 'All Rents +50% · Property Prices +15% (4 Turns)',
    durationTurns: 4,
    priceMultiplier: 1.15,
    rentMultiplier: 1.5,
    buildCostMultiplier: 1.0,
  },
  {
    id: 'QUANTITATIVE_EASING',
    title: 'Central Bank Rate Cut & Construction Stimulus',
    category: 'GRANT',
    summary:
      'Emergency interest rate cuts unlock cheap credit! Every player immediately receives $100 liquidity, and Villa/Hotel construction costs are discounted by 40% for 4 turns.',
    impactLabel: '+$100 Cash Now · Building Costs -40% (4 Turns)',
    durationTurns: 4,
    priceMultiplier: 1.0,
    rentMultiplier: 1.0,
    buildCostMultiplier: 0.6,
    flatCashBonus: 100,
  },
];

export interface BoardTile {
  index: number;
  name: string;
  shortName: string;
  city: string;
  country: string;
  landmarkQuery: string;
  type: TileType;
  group: ColorGroup;
  colorHex: string;
  price?: number;
  rent?: number[]; // [base, 1H, 2H, 3H, 4H, Hotel]
  houseCost?: number;
  mortgageValue?: number;
  taxAmount?: number;
  description: string;
}

export interface DeckCard {
  id: string;
  deck: 'CHANCE' | 'CHEST';
  title: string;
  description: string;
  effect:
    | { type: 'CASH'; amount: number }
    | { type: 'MOVE_TO'; position: number; collectGo: boolean }
    | { type: 'MOVE_STEPS'; steps: number }
    | { type: 'GO_TO_JAIL' }
    | { type: 'GET_OUT_OF_JAIL' }
    | { type: 'REPAIRS'; perHouse: number; perHotel: number }
    | { type: 'COLLECT_FROM_ALL'; amountPerPlayer: number };
}

export const COLOR_GROUP_HEX: Record<ColorGroup, string> = {
  BROWN: '#8B5A2B',
  LIGHT_BLUE: '#38BDF8',
  PINK: '#EC4899',
  ORANGE: '#F97316',
  RED: '#EF4444',
  YELLOW: '#EAB308',
  GREEN: '#10B981',
  DARK_BLUE: '#3B82F6',
  TEAL: '#14B8A6',
  INDIGO: '#6366F1',
  CRIMSON: '#BE123C',
  AMBER: '#D97706',
  VIOLET: '#A855F7',
  EMERALD: '#059669',
  COPPER: '#C2410C',
  PLATINUM: '#64748B',
  RAILROAD: '#D4AF37',
  UTILITY: '#94A3B8',
  NONE: '#475569',
};

export const COLOR_GROUP_NAMES: Record<ColorGroup, string> = {
  BROWN: 'Old World Quarter',
  LIGHT_BLUE: 'Alpine & Canal District',
  PINK: 'Boulevard & Couture',
  ORANGE: 'Imperial & Neon East',
  RED: 'Global Financial Mile',
  YELLOW: 'Riviera & Sun Coast',
  GREEN: 'Pacific Sovereign',
  DARK_BLUE: 'Crown Jewel Estates',
  TEAL: 'Nordic & Baltic Fjords',
  INDIGO: 'Diplomatic Enclave',
  CRIMSON: 'Opera & Royal Quarter',
  AMBER: 'Silk Road Oasis',
  VIOLET: 'Haute Horology Valley',
  EMERALD: 'Andean & Emerald Coast',
  COPPER: 'Heritage Citadel',
  PLATINUM: 'Global Reserve Core',
  RAILROAD: 'Grand Transit Lines',
  UTILITY: 'Sovereign Utilities',
  NONE: 'Special Space',
};

export const TOKEN_ARCHETYPES: {
  id: TokenArchetype;
  name: string;
  subtitle: string;
  defaultColor: string;
}[] = [
  {
    id: 'GRAND_TOURER',
    name: 'Grand Tourer GT',
    subtitle: 'Sculpted brass roadster with wire wheels',
    defaultColor: '#D4AF37',
  },
  {
    id: 'LOCOMOTIVE',
    name: 'Orient Express',
    subtitle: 'Vintage steam engine with smokestack',
    defaultColor: '#EF4444',
  },
  {
    id: 'TOP_HAT',
    name: 'Savile Silk Hat',
    subtitle: 'High-crown top hat on crimson cushion',
    defaultColor: '#38BDF8',
  },
  {
    id: 'YACHT',
    name: 'Monaco Superyacht',
    subtitle: 'Twin-deck luxury cruiser with radar arch',
    defaultColor: '#10B981',
  },
  {
    id: 'CROWNED_KNIGHT',
    name: 'Royal Chevalier',
    subtitle: 'Carved tournament knight on pedestal',
    defaultColor: '#A855F7',
  },
  {
    id: 'BIPLANE',
    name: 'Aero Clipper',
    subtitle: 'Twin-wing vintage flyer with brass prop',
    defaultColor: '#F97316',
  },
];

// 16 distinct, high-contrast player colors supporting up to 16 players
export const PLAYER_PALETTE = [
  '#D4AF37', // 1. Sovereign Gold
  '#EF4444', // 2. Crimson Ruby
  '#38BDF8', // 3. Sky Sapphire
  '#10B981', // 4. Emerald Mint
  '#A855F7', // 5. Royal Amethyst
  '#F97316', // 6. Tangier Orange
  '#EC4899', // 7. Couture Rose
  '#14B8A6', // 8. Nordic Teal
  '#EAB308', // 9. Canary Topaz
  '#6366F1', // 10. Imperial Indigo
  '#84CC16', // 11. Chartreuse Jade
  '#F43F5E', // 12. Coral Garnet
  '#06B6D4', // 13. Glacier Cyan
  '#D946EF', // 14. Orchid Fuchsia
  '#F59E0B', // 15. Amber Bronze
  '#93C5FD', // 16. Ice Platinum
];

export const CONTENDER_NAMES = [
  'Aurelia Sterling',
  'Lord Kensington (Bot)',
  'Duchess Savile (Bot)',
  'Commodore Vance (Bot)',
  'Baroness Geneva (Bot)',
  'Countess Monaco (Bot)',
  'Chairman Matsuda (Bot)',
  'Chancellor Zurich (Bot)',
  'Marquess Belgravia (Bot)',
  'Viscountess Kyoto (Bot)',
  'Archduke Vienna (Bot)',
  'Director Chen (Bot)',
  'Governor Valletta (Bot)',
  'Ambassador Laurent (Bot)',
  'Magnate Vanderbilt (Bot)',
  'Empress Lutetia (Bot)',
];

export const HOST_VOICES: {
  voiceName: HostVoiceName;
  gender: HostGender;
  label: string;
  timbre: string;
}[] = [
  {
    voiceName: 'Charon',
    gender: 'MALE',
    label: 'Victor Sterling',
    timbre: 'Deep, authoritative baritone',
  },
  {
    voiceName: 'Puck',
    gender: 'MALE',
    label: 'Julian Vance',
    timbre: 'Quick-witted, charismatic showman',
  },
  {
    voiceName: 'Fenrir',
    gender: 'MALE',
    label: 'Marcus Thorne',
    timbre: 'Commanding, high-stakes executive',
  },
  {
    voiceName: 'Kore',
    gender: 'FEMALE',
    label: 'Evelyn Sinclair',
    timbre: 'Polished, articulate luxury host',
  },
  {
    voiceName: 'Zephyr',
    gender: 'FEMALE',
    label: 'Celeste Laurent',
    timbre: 'Warm, spirited prime-time presenter',
  },
];

export const PERSONALITY_PRESETS: {
  id: PersonalityPresetId;
  name: string;
  tagline: string;
  speechStyle: string;
  systemPrompt: string;
}[] = [
  {
    id: 'WITTY_HOST',
    name: 'Witty Game Show Host',
    tagline: 'Playful prime-time charisma, dramatic reveals & cheeky banter',
    speechStyle: 'Energetic, charismatic, witty prime-time game show host',
    systemPrompt:
      'You are a charismatic, witty prime-time Game Show Host officiating a high-stakes luxury Monopoly match called Grand Estates 3D. Keep commentary punchy (1-2 sentences), celebrate bold purchases, playfully tease players who pay huge rent or land in Jail, and occasionally include natural vocal bursts like <laugh> or <gasp> when dramatic rolls or market events happen.',
  },
  {
    id: 'WALL_STREET_TYCOON',
    name: 'Ruthless Wall Street Tycoon',
    tagline: 'Cutthroat market commentary, leverage worship & shark energy',
    speechStyle: 'Sharp, intense, fast-talking Wall Street mogul',
    systemPrompt:
      'You are a ruthless, razor-sharp Wall Street Real Estate Tycoon officiating Grand Estates 3D. Treat every dice roll and macro market event like a hostile takeover. Mock hesitation, praise monopolies and aggressive hotel construction, and remind players that cash sitting idle is losing alpha. Keep remarks crisp (1-2 sentences) with occasional <breath> or <laugh>.',
  },
  {
    id: 'ZEN_ADVISOR',
    name: 'Calm Zen Financial Advisor',
    tagline: 'Serene mindfulness meets stoic portfolio balance',
    speechStyle: 'Calm, soothing, philosophical wealth advisor',
    systemPrompt:
      'You are a serene, mindful Zen Financial Advisor guiding players through Grand Estates 3D. Frame both triumph, stock market crashes, and crippling rent payments as fleeting ripples in the river of compound wealth. Speak with gentle wisdom, subtle dry humor, and calm encouragement in 1-2 concise sentences.',
  },
  {
    id: 'DRAMATIC_AUCTIONEER',
    name: 'Dramatic Auctioneer',
    tagline: 'Sotheby’s prestige, theatrical gavel-strikes & aristocratic flair',
    speechStyle: 'Theatrical, aristocratic luxury auction house director',
    systemPrompt:
      'You are a theatrical, aristocratic luxury Auctioneer from a prestigious London & Geneva auction house officiating Grand Estates 3D. Treat every landmark purchase, rent payment, macro event, and bid like a historic Sotheby’s lot. Use refined vocabulary and dramatic flair in 1-2 sentences, with occasional <gasp> or <breath>.',
  },
  {
    id: 'CUSTOM',
    name: 'Custom Personality',
    tagline: 'Define your own custom AI Host persona & attitude',
    speechStyle: 'Expressive, dynamic character host',
    systemPrompt:
      'You are the custom AI Host for Grand Estates 3D Monopoly. Stay strictly in the user-defined character while reacting to board events in 1-2 vivid sentences.',
  },
];

export const BOARD_TILES: BoardTile[] = [
  {
    index: 0,
    name: 'Grand Departure (GO)',
    shortName: 'GO',
    city: 'Geneva',
    country: 'Switzerland',
    landmarkQuery: 'Geneva Private Banking District Switzerland',
    type: 'GO',
    group: 'NONE',
    colorHex: '#D4AF37',
    description: 'Collect $200 Sovereign Dividend as you pass or land here.',
  },
  {
    index: 1,
    name: 'Plaka Acropolis Walk',
    shortName: 'Plaka Walk',
    city: 'Athens',
    country: 'Greece',
    landmarkQuery: 'Plaka District Acropolis Athens Greece real estate tourism',
    type: 'PROPERTY',
    group: 'BROWN',
    colorHex: COLOR_GROUP_HEX.BROWN,
    price: 60,
    rent: [2, 10, 30, 90, 160, 250],
    houseCost: 50,
    mortgageValue: 30,
    description: 'Historic neoclassical hillside quarter beneath the Acropolis.',
  },
  {
    index: 2,
    name: 'Sovereign Treasury',
    shortName: 'Treasury',
    city: 'Zurich',
    country: 'Switzerland',
    landmarkQuery: 'Bahnhofstrasse Zurich Banking Vaults',
    type: 'CHEST',
    group: 'NONE',
    colorHex: '#38BDF8',
    description: 'Draw a Sovereign Treasury reserve card.',
  },
  {
    index: 3,
    name: 'Alfama Belvedere',
    shortName: 'Alfama',
    city: 'Lisbon',
    country: 'Portugal',
    landmarkQuery: 'Alfama District Lisbon Portugal historic landmarks',
    type: 'PROPERTY',
    group: 'BROWN',
    colorHex: COLOR_GROUP_HEX.BROWN,
    price: 60,
    rent: [4, 20, 60, 180, 320, 450],
    houseCost: 50,
    mortgageValue: 30,
    description: 'Terraced Tagus riverfront mansions and vintage tramways.',
  },
  {
    index: 4,
    name: 'Wealth & Estate Levy',
    shortName: 'Estate Tax',
    city: 'Luxembourg',
    country: 'Luxembourg',
    landmarkQuery: 'Luxembourg Financial District European Court',
    type: 'TAX',
    group: 'NONE',
    colorHex: '#EF4444',
    taxAmount: 200,
    description: 'Pay $200 Annual Sovereign Estate Tax.',
  },
  {
    index: 5,
    name: 'Gare du Nord Express',
    shortName: 'Nord Rail',
    city: 'Paris',
    country: 'France',
    landmarkQuery: 'Gare du Nord Paris high speed rail terminal',
    type: 'RAILROAD',
    group: 'RAILROAD',
    colorHex: COLOR_GROUP_HEX.RAILROAD,
    price: 200,
    rent: [25, 50, 100, 200],
    mortgageValue: 100,
    description: 'Continental high-speed rail hub linking London, Brussels, and Paris.',
  },
  {
    index: 6,
    name: 'Prinsengracht Canal',
    shortName: 'Prinsengracht',
    city: 'Amsterdam',
    country: 'Netherlands',
    landmarkQuery: 'Prinsengracht Canal Ring Amsterdam gable houses',
    type: 'PROPERTY',
    group: 'LIGHT_BLUE',
    colorHex: COLOR_GROUP_HEX.LIGHT_BLUE,
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
    mortgageValue: 50,
    description: 'Golden Age merchant canal townhouses in central Amsterdam.',
  },
  {
    index: 7,
    name: 'Fortune & Venture',
    shortName: 'Fortune',
    city: 'Monte Carlo',
    country: 'Monaco',
    landmarkQuery: 'Place du Casino Monte Carlo Monaco',
    type: 'CHANCE',
    group: 'NONE',
    colorHex: '#F97316',
    description: 'Draw a high-stakes Fortune & Venture card.',
  },
  {
    index: 8,
    name: 'Nyhavn Waterfront',
    shortName: 'Nyhavn',
    city: 'Copenhagen',
    country: 'Denmark',
    landmarkQuery: 'Nyhavn Harbor Copenhagen Denmark landmark',
    type: 'PROPERTY',
    group: 'LIGHT_BLUE',
    colorHex: COLOR_GROUP_HEX.LIGHT_BLUE,
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
    mortgageValue: 50,
    description: 'Iconic 17th-century harbor promenade and Nordic design hub.',
  },
  {
    index: 9,
    name: 'Ringstrasse Opera Quarter',
    shortName: 'Ringstrasse',
    city: 'Vienna',
    country: 'Austria',
    landmarkQuery: 'Vienna Ringstrasse State Opera Palais Austria',
    type: 'PROPERTY',
    group: 'LIGHT_BLUE',
    colorHex: COLOR_GROUP_HEX.LIGHT_BLUE,
    price: 120,
    rent: [8, 40, 100, 300, 450, 600],
    houseCost: 50,
    mortgageValue: 60,
    description: 'Imperial grand boulevard of palaces and the Vienna State Opera.',
  },
  {
    index: 10,
    name: 'Compliance Detention / Just Visiting',
    shortName: 'Detention',
    city: 'The Hague',
    country: 'Netherlands',
    landmarkQuery: 'Peace Palace The Hague International Court',
    type: 'JAIL',
    group: 'NONE',
    colorHex: '#64748B',
    description: 'Just Visiting on the outer promenade, or held in Regulatory Detention.',
  },
  {
    index: 11,
    name: 'Via Condotti Piazza',
    shortName: 'Via Condotti',
    city: 'Rome',
    country: 'Italy',
    landmarkQuery: 'Via dei Condotti Spanish Steps Rome luxury shopping',
    type: 'PROPERTY',
    group: 'PINK',
    colorHex: COLOR_GROUP_HEX.PINK,
    price: 140,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
    mortgageValue: 70,
    description: 'Rome’s premier haute couture thoroughfare at the foot of the Spanish Steps.',
  },
  {
    index: 12,
    name: 'Alpine Hydro & Solar Grid',
    shortName: 'Solar Grid',
    city: 'Geneva',
    country: 'Switzerland',
    landmarkQuery: 'Swiss Alpine Hydroelectric Clean Energy Grid',
    type: 'UTILITY',
    group: 'UTILITY',
    colorHex: COLOR_GROUP_HEX.UTILITY,
    price: 150,
    rent: [4, 10],
    mortgageValue: 75,
    description: 'If one Utility is owned, rent is 4x dice roll. If both are owned, 10x dice roll.',
  },
  {
    index: 13,
    name: 'Passeig de Gràcia',
    shortName: 'Gràcia',
    city: 'Barcelona',
    country: 'Spain',
    landmarkQuery: 'Passeig de Gracia Casa Batllo Barcelona architecture',
    type: 'PROPERTY',
    group: 'PINK',
    colorHex: COLOR_GROUP_HEX.PINK,
    price: 140,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
    mortgageValue: 70,
    description: 'Modernisme showcase boulevard home to Gaudí’s architectural masterpieces.',
  },
  {
    index: 14,
    name: 'Place Vendôme',
    shortName: 'Vendôme',
    city: 'Paris',
    country: 'France',
    landmarkQuery: 'Place Vendome Paris high jewelry Ritz',
    type: 'PROPERTY',
    group: 'PINK',
    colorHex: COLOR_GROUP_HEX.PINK,
    price: 160,
    rent: [12, 60, 180, 500, 700, 900],
    houseCost: 100,
    mortgageValue: 80,
    description: 'Octagonal royal square of Parisian haute joaillerie and palace hotels.',
  },
  {
    index: 15,
    name: 'St. Pancras Euroterminal',
    shortName: 'St. Pancras',
    city: 'London',
    country: 'United Kingdom',
    landmarkQuery: 'St Pancras International Station London Gothic architecture',
    type: 'RAILROAD',
    group: 'RAILROAD',
    colorHex: COLOR_GROUP_HEX.RAILROAD,
    price: 200,
    rent: [25, 50, 100, 200],
    mortgageValue: 100,
    description: 'Victorian gothic rail cathedral connecting Britain to Europe.',
  },
  {
    index: 16,
    name: 'Gion Hanami-koji',
    shortName: 'Gion District',
    city: 'Kyoto',
    country: 'Japan',
    landmarkQuery: 'Gion Hanamikoji Kyoto historic teahouse district',
    type: 'PROPERTY',
    group: 'ORANGE',
    colorHex: COLOR_GROUP_HEX.ORANGE,
    price: 180,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
    mortgageValue: 90,
    description: 'Preserved machiya timber sanctuary and exclusive Kyoto cultural district.',
  },
  {
    index: 17,
    name: 'Sovereign Treasury',
    shortName: 'Treasury',
    city: 'Singapore',
    country: 'Singapore',
    landmarkQuery: 'Raffles Place Singapore Financial District',
    type: 'CHEST',
    group: 'NONE',
    colorHex: '#38BDF8',
    description: 'Draw a Sovereign Treasury reserve card.',
  },
  {
    index: 18,
    name: 'Cheongdam Fashion Mile',
    shortName: 'Cheongdam',
    city: 'Seoul',
    country: 'South Korea',
    landmarkQuery: 'Cheongdam-dong Gangnam Seoul luxury flagship street',
    type: 'PROPERTY',
    group: 'ORANGE',
    colorHex: COLOR_GROUP_HEX.ORANGE,
    price: 180,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
    mortgageValue: 90,
    description: 'Gangnam’s architectural flagship avenue and entertainment powerhouse.',
  },
  {
    index: 19,
    name: 'The Bund Waitan',
    shortName: 'The Bund',
    city: 'Shanghai',
    country: 'China',
    landmarkQuery: 'The Bund Waitan Shanghai waterfront skyline',
    type: 'PROPERTY',
    group: 'ORANGE',
    colorHex: COLOR_GROUP_HEX.ORANGE,
    price: 200,
    rent: [16, 80, 220, 600, 800, 1000],
    houseCost: 100,
    mortgageValue: 100,
    description: 'Art Deco riverfront banking edifices facing the Pudong skyline.',
  },
  {
    index: 20,
    name: 'Grand Palazzo Sanctuary',
    shortName: 'Sanctuary',
    city: 'Lake Como',
    country: 'Italy',
    landmarkQuery: 'Bellagio Villa Lake Como Italy luxury resort',
    type: 'FREE_PARKING',
    group: 'NONE',
    colorHex: '#10B981',
    description: 'Private lakeside retreat. Rest peacefully with no rent or tax obligations.',
  },
  {
    index: 21,
    name: 'LaSalle Exchange Row',
    shortName: 'LaSalle Row',
    city: 'Chicago',
    country: 'United States',
    landmarkQuery: 'LaSalle Street Chicago Board of Trade architecture',
    type: 'PROPERTY',
    group: 'RED',
    colorHex: COLOR_GROUP_HEX.RED,
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
    mortgageValue: 110,
    description: 'Canyon of commodities exchanges and Art Deco skyscrapers.',
  },
  {
    index: 22,
    name: 'Fortune & Venture',
    shortName: 'Fortune',
    city: 'London',
    country: 'United Kingdom',
    landmarkQuery: 'City of London Royal Exchange',
    type: 'CHANCE',
    group: 'NONE',
    colorHex: '#F97316',
    description: 'Draw a high-stakes Fortune & Venture card.',
  },
  {
    index: 23,
    name: 'Bankenviertel Tower',
    shortName: 'Bankenviertel',
    city: 'Frankfurt',
    country: 'Germany',
    landmarkQuery: 'Bankenviertel Frankfurt skyline financial district',
    type: 'PROPERTY',
    group: 'RED',
    colorHex: COLOR_GROUP_HEX.RED,
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
    mortgageValue: 110,
    description: 'Continental Europe’s central banking skyline and glass towers.',
  },
  {
    index: 24,
    name: 'Lombard & Canary Wharf',
    shortName: 'Canary Wharf',
    city: 'London',
    country: 'United Kingdom',
    landmarkQuery: 'Canary Wharf London financial district',
    type: 'PROPERTY',
    group: 'RED',
    colorHex: COLOR_GROUP_HEX.RED,
    price: 240,
    rent: [20, 100, 300, 750, 925, 1100],
    houseCost: 150,
    mortgageValue: 120,
    description: 'Thames docklands banking citadel and global foreign exchange hub.',
  },
  {
    index: 25,
    name: 'Grand Central Terminal',
    shortName: 'Grand Central',
    city: 'New York',
    country: 'United States',
    landmarkQuery: 'Grand Central Terminal New York Beaux Arts landmark',
    type: 'RAILROAD',
    group: 'RAILROAD',
    colorHex: COLOR_GROUP_HEX.RAILROAD,
    price: 200,
    rent: [25, 50, 100, 200],
    mortgageValue: 100,
    description: 'Beaux-Arts Midtown transit crown with celestial vaulted concourse.',
  },
  {
    index: 26,
    name: 'Boulevard de la Croisette',
    shortName: 'La Croisette',
    city: 'Cannes',
    country: 'France',
    landmarkQuery: 'Promenade de la Croisette Cannes French Riviera',
    type: 'PROPERTY',
    group: 'YELLOW',
    colorHex: COLOR_GROUP_HEX.YELLOW,
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
    mortgageValue: 130,
    description: 'Palm-lined Riviera seafront of cinema palaces and Belle Époque hotels.',
  },
  {
    index: 27,
    name: 'Rodeo Drive Golden Triangle',
    shortName: 'Rodeo Drive',
    city: 'Beverly Hills',
    country: 'United States',
    landmarkQuery: 'Rodeo Drive Beverly Hills California luxury retail',
    type: 'PROPERTY',
    group: 'YELLOW',
    colorHex: COLOR_GROUP_HEX.YELLOW,
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
    mortgageValue: 130,
    description: 'Sun-drenched California luxury retail enclave and private showrooms.',
  },
  {
    index: 28,
    name: 'Trans-Oceanic Fiber & SatNet',
    shortName: 'SatNet Comms',
    city: 'Tokyo',
    country: 'Japan',
    landmarkQuery: 'Global Submarine Fiber Optic Cable Network',
    type: 'UTILITY',
    group: 'UTILITY',
    colorHex: COLOR_GROUP_HEX.UTILITY,
    price: 150,
    rent: [4, 10],
    mortgageValue: 75,
    description: 'Ultra-low-latency global communications backbone.',
  },
  {
    index: 29,
    name: 'Downtown Burj Boulevard',
    shortName: 'Burj Blvd',
    city: 'Dubai',
    country: 'United Arab Emirates',
    landmarkQuery: 'Sheikh Mohammed bin Rashid Boulevard Downtown Dubai Burj Khalifa',
    type: 'PROPERTY',
    group: 'YELLOW',
    colorHex: COLOR_GROUP_HEX.YELLOW,
    price: 280,
    rent: [24, 120, 360, 850, 1025, 1200],
    houseCost: 150,
    mortgageValue: 140,
    description: 'Record-breaking supertall oasis and fountain promenade.',
  },
  {
    index: 30,
    name: 'Subpoenaed to Detention',
    shortName: 'Go To Jail',
    city: 'The Hague',
    country: 'Netherlands',
    landmarkQuery: 'International Financial Compliance Tribunal',
    type: 'GO_TO_JAIL',
    group: 'NONE',
    colorHex: '#EF4444',
    description: 'Proceed immediately to Compliance Detention. Do not pass GO.',
  },
  {
    index: 31,
    name: 'Circular Quay Harbour',
    shortName: 'Circular Quay',
    city: 'Sydney',
    country: 'Australia',
    landmarkQuery: 'Circular Quay Sydney Opera House Harbour Bridge',
    type: 'PROPERTY',
    group: 'GREEN',
    colorHex: COLOR_GROUP_HEX.GREEN,
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
    mortgageValue: 150,
    description: 'Spectacular harbourfront gateway framed by the Sydney Opera House sails.',
  },
  {
    index: 32,
    name: 'Marina Bay Sands Walk',
    shortName: 'Marina Bay',
    city: 'Singapore',
    country: 'Singapore',
    landmarkQuery: 'Marina Bay Waterfront Singapore skyline',
    type: 'PROPERTY',
    group: 'GREEN',
    colorHex: COLOR_GROUP_HEX.GREEN,
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
    mortgageValue: 150,
    description: 'Sky-park architectural icon and tropical bayfront financial hub.',
  },
  {
    index: 33,
    name: 'Sovereign Treasury',
    shortName: 'Treasury',
    city: 'Hong Kong',
    country: 'China',
    landmarkQuery: 'Central Hong Kong Victoria Peak skyline',
    type: 'CHEST',
    group: 'NONE',
    colorHex: '#38BDF8',
    description: 'Draw a Sovereign Treasury reserve card.',
  },
  {
    index: 34,
    name: 'The Peak Severn Road',
    shortName: 'Victoria Peak',
    city: 'Hong Kong',
    country: 'China',
    landmarkQuery: 'Victoria Peak Severn Road Hong Kong luxury mansions',
    type: 'PROPERTY',
    group: 'GREEN',
    colorHex: COLOR_GROUP_HEX.GREEN,
    price: 320,
    rent: [28, 150, 450, 1000, 1200, 1400],
    houseCost: 200,
    mortgageValue: 160,
    description: 'Ultra-rare ridge estates commanding panoramic views over Victoria Harbour.',
  },
  {
    index: 35,
    name: 'Tokyo Station Shinkansen',
    shortName: 'Tokyo Rail',
    city: 'Tokyo',
    country: 'Japan',
    landmarkQuery: 'Tokyo Station Marunouchi Shinkansen bullet train',
    type: 'RAILROAD',
    group: 'RAILROAD',
    colorHex: COLOR_GROUP_HEX.RAILROAD,
    price: 200,
    rent: [25, 50, 100, 200],
    mortgageValue: 100,
    description: 'Red-brick Marunouchi landmark and nexus of the bullet train network.',
  },
  {
    index: 36,
    name: 'Fortune & Venture',
    shortName: 'Fortune',
    city: 'New York',
    country: 'United States',
    landmarkQuery: 'Wall Street New York Stock Exchange',
    type: 'CHANCE',
    group: 'NONE',
    colorHex: '#F97316',
    description: 'Draw a high-stakes Fortune & Venture card.',
  },
  {
    index: 37,
    name: 'Ginza Chuo-dori',
    shortName: 'Ginza',
    city: 'Tokyo',
    country: 'Japan',
    landmarkQuery: 'Ginza Chuo-dori Tokyo Wako clock tower luxury real estate',
    type: 'PROPERTY',
    group: 'DARK_BLUE',
    colorHex: COLOR_GROUP_HEX.DARK_BLUE,
    price: 350,
    rent: [35, 175, 500, 1100, 1300, 1500],
    houseCost: 200,
    mortgageValue: 175,
    description: 'Some of the highest-valued commercial square footage on Earth.',
  },
  {
    index: 38,
    name: 'Sovereign Luxury Duty',
    shortName: 'Luxury Duty',
    city: 'Monaco',
    country: 'Monaco',
    landmarkQuery: 'Port Hercule Monaco Superyacht Harbor',
    type: 'TAX',
    group: 'NONE',
    colorHex: '#EF4444',
    taxAmount: 100,
    description: 'Pay $100 Superyacht & Fine Art Luxury Duty.',
  },
  {
    index: 39,
    name: 'Mayfair & Fifth Crown',
    shortName: 'Mayfair Crown',
    city: 'London & New York',
    country: 'UK / USA',
    landmarkQuery: 'Mayfair Grosvenor Square London and Fifth Avenue New York real estate',
    type: 'PROPERTY',
    group: 'DARK_BLUE',
    colorHex: COLOR_GROUP_HEX.DARK_BLUE,
    price: 400,
    rent: [50, 200, 600, 1400, 1700, 2000],
    houseCost: 200,
    mortgageValue: 200,
    description: 'The pinnacle of transatlantic trophy real estate and embassy mansions.',
  },
];

// Curated 24-Tile Express Board (sideLength = 6; corners at 0, 6, 12, 18)
const MINI_SOURCE_INDICES: number[] = [
  0, // Corner 0: GO
  1, // Plaka Walk (BROWN)
  3, // Alfama (BROWN)
  5, // Nord Rail (RAILROAD)
  6, // Prinsengracht (LIGHT_BLUE)
  9, // Ringstrasse (LIGHT_BLUE)
  10, // Corner 6: Detention (JAIL)
  11, // Via Condotti (PINK)
  7, // Fortune (CHANCE)
  14, // Place Vendôme (PINK)
  16, // Gion District (ORANGE)
  19, // The Bund (ORANGE)
  20, // Corner 12: Sanctuary (FREE_PARKING)
  21, // LaSalle Row (RED)
  17, // Treasury (CHEST)
  24, // Canary Wharf (RED)
  25, // Grand Central (RAILROAD)
  27, // Rodeo Drive (YELLOW)
  30, // Corner 18: Go To Jail (GO_TO_JAIL)
  29, // Burj Blvd (YELLOW)
  32, // Marina Bay (GREEN)
  34, // Victoria Peak (GREEN)
  37, // Ginza (DARK_BLUE)
  39, // Mayfair Crown (DARK_BLUE)
];

export const MINI_BOARD_TILES: BoardTile[] = MINI_SOURCE_INDICES.map(
  (srcIdx, idx) => ({
    ...BOARD_TILES[srcIdx],
    index: idx,
  })
);

// Extra landmarks to expand the 40-tile Classic Board into the 52-tile Mega Metropolis Board (sideLength = 13; corners at 0, 13, 26, 39)
const MEGA_RAW_TILES: Omit<BoardTile, 'index'>[] = [
  // Edge 0 (13 spaces: 0..12)
  BOARD_TILES[0], // 0: GO
  BOARD_TILES[1], // 1: Plaka Walk (BROWN)
  BOARD_TILES[2], // 2: Treasury
  BOARD_TILES[3], // 3: Alfama (BROWN)
  {
    name: 'Valletta Grand Harbour',
    shortName: 'Valletta',
    city: 'Valletta',
    country: 'Malta',
    landmarkQuery: 'Valletta Grand Harbour Malta baroque palazzos',
    type: 'PROPERTY',
    group: 'BROWN',
    colorHex: COLOR_GROUP_HEX.BROWN,
    price: 70,
    rent: [5, 25, 70, 200, 350, 480],
    houseCost: 50,
    mortgageValue: 35,
    description: 'Fortified limestone peninsula and Mediterranean superyacht anchorage.',
  },
  BOARD_TILES[4], // Estate Tax
  BOARD_TILES[5], // Nord Rail
  BOARD_TILES[6], // Prinsengracht (LIGHT_BLUE)
  BOARD_TILES[7], // Fortune
  BOARD_TILES[8], // Nyhavn (LIGHT_BLUE)
  BOARD_TILES[9], // Ringstrasse (LIGHT_BLUE)
  {
    name: 'Gamla Stan Waterfront',
    shortName: 'Gamla Stan',
    city: 'Stockholm',
    country: 'Sweden',
    landmarkQuery: 'Gamla Stan Stockholm Royal Palace waterfront',
    type: 'PROPERTY',
    group: 'LIGHT_BLUE',
    colorHex: COLOR_GROUP_HEX.LIGHT_BLUE,
    price: 130,
    rent: [9, 45, 110, 330, 480, 640],
    houseCost: 50,
    mortgageValue: 65,
    description: 'Royal island archipelago of ochre merchant houses and Nobel heritage.',
  },
  {
    name: 'Gotthard Base Rail Tunnel',
    shortName: 'Alpine Rail',
    city: 'Zurich',
    country: 'Switzerland',
    landmarkQuery: 'Gotthard Base Tunnel Swiss Federal Railways',
    type: 'RAILROAD',
    group: 'RAILROAD',
    colorHex: COLOR_GROUP_HEX.RAILROAD,
    price: 200,
    rent: [25, 50, 100, 200],
    mortgageValue: 100,
    description: 'Deep-mountain engineering marvel linking northern and southern Europe.',
  },

  // Edge 1 (13 spaces: 13..25)
  BOARD_TILES[10], // 13: JAIL
  BOARD_TILES[11], // Via Condotti (PINK)
  BOARD_TILES[12], // Solar Grid (UTILITY)
  BOARD_TILES[13], // Gràcia (PINK)
  BOARD_TILES[14], // Vendôme (PINK)
  {
    name: 'Galleria Vittorio Emanuele',
    shortName: 'Galleria Milan',
    city: 'Milan',
    country: 'Italy',
    landmarkQuery: 'Galleria Vittorio Emanuele II Milan luxury arcade',
    type: 'PROPERTY',
    group: 'PINK',
    colorHex: COLOR_GROUP_HEX.PINK,
    price: 170,
    rent: [13, 65, 190, 520, 720, 920],
    houseCost: 100,
    mortgageValue: 85,
    description: 'Glass-vaulted 19th-century couture salon steps from the Milan Duomo.',
  },
  BOARD_TILES[15], // St. Pancras Rail
  BOARD_TILES[16], // Gion District (ORANGE)
  BOARD_TILES[17], // Treasury
  BOARD_TILES[18], // Cheongdam (ORANGE)
  BOARD_TILES[19], // The Bund (ORANGE)
  {
    name: 'Taipei Xinyi Financial Tower',
    shortName: 'Xinyi 101',
    city: 'Taipei',
    country: 'Taiwan',
    landmarkQuery: 'Taipei 101 Xinyi Financial District Taiwan',
    type: 'PROPERTY',
    group: 'ORANGE',
    colorHex: COLOR_GROUP_HEX.ORANGE,
    price: 210,
    rent: [17, 85, 235, 630, 830, 1030],
    houseCost: 100,
    mortgageValue: 105,
    description: 'Bamboo-inspired supertall landmark anchoring East Asia’s semiconductor capital.',
  },
  {
    name: 'Fortune & Venture',
    shortName: 'Fortune',
    city: 'Geneva',
    country: 'Switzerland',
    landmarkQuery: 'Jet dEau Lake Geneva',
    type: 'CHANCE',
    group: 'NONE',
    colorHex: '#F97316',
    description: 'Draw a high-stakes Fortune & Venture card.',
  },

  // Edge 2 (13 spaces: 26..38)
  BOARD_TILES[20], // 26: FREE_PARKING
  BOARD_TILES[21], // LaSalle Row (RED)
  BOARD_TILES[22], // Fortune
  BOARD_TILES[23], // Bankenviertel (RED)
  BOARD_TILES[24], // Canary Wharf (RED)
  {
    name: 'Bay Street Exchange Tower',
    shortName: 'Bay Street',
    city: 'Toronto',
    country: 'Canada',
    landmarkQuery: 'Bay Street Financial District Toronto Canada',
    type: 'PROPERTY',
    group: 'RED',
    colorHex: COLOR_GROUP_HEX.RED,
    price: 250,
    rent: [21, 105, 315, 775, 950, 1125],
    houseCost: 150,
    mortgageValue: 125,
    description: 'North American mining and banking headquarters corridor.',
  },
  BOARD_TILES[25], // Grand Central Rail
  BOARD_TILES[26], // La Croisette (YELLOW)
  BOARD_TILES[27], // Rodeo Drive (YELLOW)
  BOARD_TILES[28], // SatNet Comms (UTILITY)
  BOARD_TILES[29], // Burj Blvd (YELLOW)
  {
    name: 'Copacabana Palace Atlântica',
    shortName: 'Atlântica',
    city: 'Rio de Janeiro',
    country: 'Brazil',
    landmarkQuery: 'Avenida Atlantica Copacabana Palace Rio de Janeiro',
    type: 'PROPERTY',
    group: 'YELLOW',
    colorHex: COLOR_GROUP_HEX.YELLOW,
    price: 290,
    rent: [25, 125, 375, 875, 1050, 1225],
    houseCost: 150,
    mortgageValue: 145,
    description: 'Portuguese-mosaic oceanfront promenade and Art Deco palace hotel.',
  },
  {
    name: 'Changi SkyBridge Terminal',
    shortName: 'Changi Hub',
    city: 'Singapore',
    country: 'Singapore',
    landmarkQuery: 'Jewel Changi Airport Singapore Rain Vortex',
    type: 'RAILROAD',
    group: 'RAILROAD',
    colorHex: COLOR_GROUP_HEX.RAILROAD,
    price: 200,
    rent: [25, 50, 100, 200],
    mortgageValue: 100,
    description: 'Biosphere aviation nexus connecting trans-Pacific air corridors.',
  },

  // Edge 3 (13 spaces: 39..51)
  BOARD_TILES[30], // 39: GO_TO_JAIL
  BOARD_TILES[31], // Circular Quay (GREEN)
  BOARD_TILES[32], // Marina Bay (GREEN)
  BOARD_TILES[33], // Treasury
  BOARD_TILES[34], // Victoria Peak (GREEN)
  {
    name: 'Polanco Reforma Avenue',
    shortName: 'Polanco',
    city: 'Mexico City',
    country: 'Mexico',
    landmarkQuery: 'Avenida Presidente Masaryk Polanco Mexico City',
    type: 'PROPERTY',
    group: 'GREEN',
    colorHex: COLOR_GROUP_HEX.GREEN,
    price: 330,
    rent: [30, 160, 470, 1040, 1240, 1440],
    houseCost: 200,
    mortgageValue: 165,
    description: 'Tree-lined embassy and flagship luxury avenue in central Mexico City.',
  },
  BOARD_TILES[35], // Tokyo Rail
  BOARD_TILES[36], // Fortune
  BOARD_TILES[37], // Ginza (DARK_BLUE)
  BOARD_TILES[38], // Luxury Duty
  BOARD_TILES[39], // Mayfair Crown (DARK_BLUE)
  {
    name: 'Bahnhofstrasse Paradeplatz',
    shortName: 'Paradeplatz',
    city: 'Zurich',
    country: 'Switzerland',
    landmarkQuery: 'Paradeplatz Bahnhofstrasse Zurich private banking',
    type: 'PROPERTY',
    group: 'DARK_BLUE',
    colorHex: COLOR_GROUP_HEX.DARK_BLUE,
    price: 420,
    rent: [55, 220, 650, 1500, 1800, 2100],
    houseCost: 200,
    mortgageValue: 210,
    description: 'Legendary Swiss bullion vaults and ultra-prime wealth management square.',
  },
  {
    name: 'Sovereign Wealth Reserve',
    shortName: 'Treasury',
    city: 'Abu Dhabi',
    country: 'UAE',
    landmarkQuery: 'Al Maryah Island Abu Dhabi Global Market',
    type: 'CHEST',
    group: 'NONE',
    colorHex: '#38BDF8',
    description: 'Draw a Sovereign Treasury reserve card.',
  },
];

export const MEGA_BOARD_TILES: BoardTile[] = MEGA_RAW_TILES.map((t, idx) => ({
  ...t,
  index: idx,
}));

// Additional global landmarks used to construct the 68-Tile Continental (8–12P) and 84-Tile Colossal (12–16P) boards
function makeProp(
  shortName: string,
  name: string,
  city: string,
  country: string,
  group: ColorGroup,
  price: number,
  houseCost: number,
  description: string
): Omit<BoardTile, 'index'> {
  const baseRent = Math.max(4, Math.round(price * 0.09));
  return {
    name,
    shortName,
    city,
    country,
    landmarkQuery: `${name} ${city} ${country} luxury landmark architecture`,
    type: 'PROPERTY',
    group,
    colorHex: COLOR_GROUP_HEX[group],
    price,
    rent: [
      baseRent,
      baseRent * 5,
      baseRent * 14,
      baseRent * 32,
      baseRent * 42,
      baseRent * 54,
    ],
    houseCost,
    mortgageValue: Math.round(price / 2),
    description,
  };
}

function makeRail(
  shortName: string,
  name: string,
  city: string,
  country: string
): Omit<BoardTile, 'index'> {
  return {
    name,
    shortName,
    city,
    country,
    landmarkQuery: `${name} ${city} ${country} transit station`,
    type: 'RAILROAD',
    group: 'RAILROAD',
    colorHex: COLOR_GROUP_HEX.RAILROAD,
    price: 200,
    rent: [25, 50, 100, 200],
    mortgageValue: 100,
    description: `Intercontinental sovereign transit hub in ${city}.`,
  };
}

function makeUtility(
  shortName: string,
  name: string,
  city: string,
  country: string
): Omit<BoardTile, 'index'> {
  return {
    name,
    shortName,
    city,
    country,
    landmarkQuery: `${name} ${city} clean energy infrastructure`,
    type: 'UTILITY',
    group: 'UTILITY',
    colorHex: COLOR_GROUP_HEX.UTILITY,
    price: 150,
    rent: [4, 10],
    mortgageValue: 75,
    description: `Sovereign infrastructure grid in ${city}.`,
  };
}

const EXTRA_CONTINENTAL_POOL: Omit<BoardTile, 'index'>[] = [
  // TEAL group (Nordic & Baltic Fjords)
  makeProp('Aker Brygge', 'Aker Brygge Fjord Quay', 'Oslo', 'Norway', 'TEAL', 110, 50, 'Modernist fjord promenade and Nordic contemporary art harbor.'),
  makeProp('Esplanadi', 'Esplanadi Design Park', 'Helsinki', 'Finland', 'TEAL', 115, 50, 'Neoclassical boulevard at the heart of Helsinki’s diplomatic quarter.'),
  makeProp('Blue Lagoon', 'Reykjavik Geothermal Bay', 'Reykjavik', 'Iceland', 'TEAL', 125, 50, 'Geothermal mineral sanctuary and volcanic glass pavilion.'),
  makeRail('Bernina Express', 'Bernina Glacier Rail', 'St. Moritz', 'Switzerland'),

  // INDIGO group (Diplomatic Enclave)
  makeProp('Sablon Square', 'Place du Grand Sablon', 'Brussels', 'Belgium', 'INDIGO', 190, 100, 'Antiques and chocolatiers square surrounded by Flemish guildhalls.'),
  makeProp('Lange Voorhout', 'Lange Voorhout Embassy Row', 'The Hague', 'Netherlands', 'INDIGO', 195, 100, 'Linden-lined royal avenue of embassies and museums.'),
  makeProp('Palais Nations', 'Quai du Mont-Blanc', 'Geneva', 'Switzerland', 'INDIGO', 210, 100, 'Lakeside promenade overlooking Mont Blanc and diplomatic missions.'),
  makeUtility('North Sea Wind', 'North Sea Offshore Wind Array', 'Rotterdam', 'Netherlands'),

  // CRIMSON group (Opera & Royal Quarter)
  makeProp('Charles Bridge', 'Mala Strana Palace Quarter', 'Prague', 'Czechia', 'CRIMSON', 270, 150, 'Baroque terraced palaces beneath Prague Castle.'),
  makeProp('Andrássy Avenue', 'Andrássy Opera Boulevard', 'Budapest', 'Hungary', 'CRIMSON', 275, 150, 'Grand neo-Renaissance mansions and the Hungarian State Opera.'),
  makeProp('Wawel Royal', 'Krakow Royal Market Square', 'Krakow', 'Poland', 'CRIMSON', 285, 150, 'Medieval cloth hall and aristocratic townhouses.'),
  makeRail('Simplon Orient', 'Venice Santa Lucia Terminal', 'Venice', 'Italy'),

  // AMBER group (Silk Road & Gulf Oasis)
  makeProp('Corniche Pearl', 'The Pearl Lusail Marina', 'Doha', 'Qatar', 'AMBER', 340, 200, 'Crescent island superyacht berths and museum bay.'),
  makeProp('Al Maryah Square', 'Al Maryah Sovereign Island', 'Abu Dhabi', 'UAE', 'AMBER', 360, 200, 'International financial free-zone and waterfront galleria.'),
  makeProp('Bosphorus Palace', 'Bebek Bosphorus Mansions', 'Istanbul', 'Turkey', 'AMBER', 380, 200, 'Historic timber yalı estates straddling Europe and Asia.'),
  makeUtility('Desalination Grid', 'Arabian Gulf Fusion & Water Grid', 'Dubai', 'UAE'),
];

const EXTRA_COLOSSAL_POOL: Omit<BoardTile, 'index'>[] = [
  // VIOLET group (Haute Horology Valley)
  makeProp('Rue du Rhône', 'Rue du Rhône Horology Mile', 'Geneva', 'Switzerland', 'VIOLET', 150, 100, 'Flagship salons of the world’s oldest watchmaking maisons.'),
  makeProp('Vallée de Joux', 'Le Brassus Complications Atelier', 'Vallée de Joux', 'Switzerland', 'VIOLET', 155, 100, 'Cradle of haute horlogerie and perpetual calendar masters.'),
  makeProp('Schaffhausen', 'Rhine Falls Chronometer Works', 'Schaffhausen', 'Switzerland', 'VIOLET', 165, 100, 'Precision engineering sanctuary on the Upper Rhine.'),
  makeRail('Eurostar Channel', 'Channel Tunnel Folkestone Hub', 'London', 'United Kingdom'),

  // EMERALD group (Andean & Southern Hemisphere)
  makeProp('Recoleta Alvear', 'Avenida Alvear Recoleta', 'Buenos Aires', 'Argentina', 'EMERALD', 230, 150, 'Belle Époque Haussmann-style palaces in Buenos Aires.'),
  makeProp('Vitacura Costanera', 'Nueva Costanera Vitacura', 'Santiago', 'Chile', 'EMERALD', 235, 150, 'Andean skyline gastronomy and flagship boulevard.'),
  makeProp('Miraflores Malecon', 'Malecón de Miraflores Cliffs', 'Lima', 'Peru', 'EMERALD', 245, 150, 'Pacific clifftop parks and private club estates.'),
  makeUtility('Itaipu Hydro', 'Continental Hydroelectric Dam', 'Iguazu', 'Brazil'),

  // COPPER group (Heritage Citadel)
  makeProp('Medina Palmeraie', 'Hivernage Royal Palm Enclave', 'Marrakech', 'Morocco', 'COPPER', 310, 175, 'Walled riads and Atlas Mountain palace gardens.'),
  makeProp('Zamalek Nile', 'Gezira Island Nile Promenade', 'Cairo', 'Egypt', 'COPPER', 315, 175, 'Lush Nile island of 19th-century khedivial villas.'),
  makeProp('Clifton Victoria', 'Clifton Fourth Beach Ridge', 'Cape Town', 'South Africa', 'COPPER', 325, 175, 'Granite cliffside estates overlooking the Atlantic.'),
  makeRail('Rovos Pride', 'Pretoria Capital Park Station', 'Pretoria', 'South Africa'),

  // PLATINUM group (Global Reserve Core)
  makeProp('Sand Hill Road', 'Sand Hill Venture Corridor', 'Silicon Valley', 'United States', 'PLATINUM', 430, 225, 'Command center of global venture capital and frontier technology.'),
  makeProp('Pudong Lujiazui', 'Lujiazui World Financial Center', 'Shanghai', 'China', 'PLATINUM', 450, 225, 'Trio of supertall skyscrapers anchoring Asian capital markets.'),
  makeProp('Peak Crown', 'Mount Nicholson Peak Crest', 'Hong Kong', 'China', 'PLATINUM', 480, 250, 'Ultra-exclusive private peak residences overlooking Victoria Harbour.'),
  makeUtility('Quantum Cloud', 'Orbital Quantum Compute Mesh', 'Zurich', 'Switzerland'),
];

/**
 * Builds a balanced N-per-side board (total = sideLength * 4) with corners strictly at
 * 0 (GO), sideLength (JAIL), 2*sideLength (FREE_PARKING), and 3*sideLength (GO_TO_JAIL).
 */
function buildExpandedBoard(
  sideLength: number,
  extraPool: Omit<BoardTile, 'index'>[]
): BoardTile[] {
  const innerPerSide = sideLength - 1;
  // Gather all non-corner tiles from MEGA_RAW_TILES + extraPool
  const nonCorners = [
    ...MEGA_RAW_TILES.filter((_, idx) => idx % 13 !== 0),
    ...extraPool,
  ];
  const corners = [
    BOARD_TILES[0], // GO
    BOARD_TILES[10], // JAIL
    BOARD_TILES[20], // FREE_PARKING
    BOARD_TILES[30], // GO_TO_JAIL
  ];

  const result: BoardTile[] = [];
  let poolCursor = 0;

  for (let side = 0; side < 4; side++) {
    // Add corner
    result.push({
      ...corners[side],
      index: result.length,
    });
    // Add innerPerSide tiles
    for (let k = 0; k < innerPerSide; k++) {
      const item = nonCorners[poolCursor % nonCorners.length];
      poolCursor += 1;
      result.push({
        ...item,
        index: result.length,
      });
    }
  }

  return result;
}

export const CONTINENTAL_BOARD_TILES: BoardTile[] = buildExpandedBoard(
  17,
  EXTRA_CONTINENTAL_POOL
);

export const COLOSSAL_BOARD_TILES: BoardTile[] = buildExpandedBoard(21, [
  ...EXTRA_CONTINENTAL_POOL,
  ...EXTRA_COLOSSAL_POOL,
]);

export function getBoardTiles(boardSize: BoardSizeId = 'CLASSIC'): BoardTile[] {
  switch (boardSize) {
    case 'MINI':
      return MINI_BOARD_TILES;
    case 'MEGA':
      return MEGA_BOARD_TILES;
    case 'CONTINENTAL':
      return CONTINENTAL_BOARD_TILES;
    case 'COLOSSAL':
      return COLOSSAL_BOARD_TILES;
    case 'CLASSIC':
    default:
      return BOARD_TILES;
  }
}

export function getCornerIndices(boardSize: BoardSizeId = 'CLASSIC'): {
  go: number;
  jail: number;
  freeParking: number;
  goToJail: number;
} {
  const s = BOARD_SIZE_CONFIGS[boardSize]?.sideLength || 10;
  return {
    go: 0,
    jail: s,
    freeParking: s * 2,
    goToJail: s * 3,
  };
}

export function getGroupTileIndices(
  boardSize: BoardSizeId = 'CLASSIC'
): Record<ColorGroup, number[]> {
  const tiles = getBoardTiles(boardSize);
  const map: Record<ColorGroup, number[]> = {
    BROWN: [],
    LIGHT_BLUE: [],
    PINK: [],
    ORANGE: [],
    RED: [],
    YELLOW: [],
    GREEN: [],
    DARK_BLUE: [],
    TEAL: [],
    INDIGO: [],
    CRIMSON: [],
    AMBER: [],
    VIOLET: [],
    EMERALD: [],
    COPPER: [],
    PLATINUM: [],
    RAILROAD: [],
    UTILITY: [],
    NONE: [],
  };
  for (const tile of tiles) {
    if (tile.group !== 'NONE') {
      map[tile.group].push(tile.index);
    }
  }
  return map;
}

export const CHANCE_CARDS: DeckCard[] = [
  {
    id: 'ch-1',
    deck: 'CHANCE',
    title: 'Private Jet Charter to Mayfair',
    description: 'Advance directly to Mayfair & Fifth Crown.',
    effect: { type: 'MOVE_TO', position: 39, collectGo: true },
  },
  {
    id: 'ch-2',
    deck: 'CHANCE',
    title: 'Sovereign Fiscal Year Close',
    description: 'Advance to Grand Departure (GO) and collect $200.',
    effect: { type: 'MOVE_TO', position: 0, collectGo: true },
  },
  {
    id: 'ch-3',
    deck: 'CHANCE',
    title: 'Central Bank Rate Cut Dividend',
    description: 'Your commercial bond portfolio surges. Collect $150.',
    effect: { type: 'CASH', amount: 150 },
  },
  {
    id: 'ch-4',
    deck: 'CHANCE',
    title: 'Canary Wharf Merger Closing',
    description: 'Advance to Lombard & Canary Wharf. Collect $200 if you pass GO.',
    effect: { type: 'MOVE_TO', position: 24, collectGo: true },
  },
  {
    id: 'ch-5',
    deck: 'CHANCE',
    title: 'Architectural Heritage Restoration',
    description: 'Make general repairs on all your holdings: pay $25 per Villa and $100 per Grand Hotel.',
    effect: { type: 'REPAIRS', perHouse: 25, perHotel: 100 },
  },
  {
    id: 'ch-6',
    deck: 'CHANCE',
    title: 'Diplomatic Immunity Pass',
    description: 'Keep this credential to exit Compliance Detention free of charge.',
    effect: { type: 'GET_OUT_OF_JAIL' },
  },
  {
    id: 'ch-7',
    deck: 'CHANCE',
    title: 'Regulatory Audit Subpoena',
    description: 'Go directly to Compliance Detention. Do not pass GO, do not collect $200.',
    effect: { type: 'GO_TO_JAIL' },
  },
  {
    id: 'ch-8',
    deck: 'CHANCE',
    title: 'Chairman of the Syndicate',
    description: 'You have been elected Chairman. Collect $50 advisory fee from each player.',
    effect: { type: 'COLLECT_FROM_ALL', amountPerPlayer: 50 },
  },
  {
    id: 'ch-9',
    deck: 'CHANCE',
    title: 'High-Speed Rail Excursion',
    description: 'Advance to Gare du Nord Express. Collect $200 if you pass GO.',
    effect: { type: 'MOVE_TO', position: 5, collectGo: true },
  },
  {
    id: 'ch-10',
    deck: 'CHANCE',
    title: 'Unexpected Market Retracement',
    description: 'Move back 3 spaces to reassess your position.',
    effect: { type: 'MOVE_STEPS', steps: -3 },
  },
];

export const CHEST_CARDS: DeckCard[] = [
  {
    id: 'cc-1',
    deck: 'CHEST',
    title: 'Sovereign Wealth Fund Distribution',
    description: 'Annual dividend payout in your favor. Collect $200.',
    effect: { type: 'CASH', amount: 200 },
  },
  {
    id: 'cc-2',
    deck: 'CHEST',
    title: 'Geneva Art Gala Proceeds',
    description: 'Your charity auction lot exceeds estimates. Collect $100.',
    effect: { type: 'CASH', amount: 100 },
  },
  {
    id: 'cc-3',
    deck: 'CHEST',
    title: 'Private Aviation Retainer Fee',
    description: 'Pay $50 annual hangar and maintenance retainer.',
    effect: { type: 'CASH', amount: -50 },
  },
  {
    id: 'cc-4',
    deck: 'CHEST',
    title: 'International Tax Rebate',
    description: 'Treaty withholding refund approved. Collect $75.',
    effect: { type: 'CASH', amount: 75 },
  },
  {
    id: 'cc-5',
    deck: 'CHEST',
    title: 'Grand Anniversary Summit',
    description: 'Every player contributes $25 to your hosting gala.',
    effect: { type: 'COLLECT_FROM_ALL', amountPerPlayer: 25 },
  },
  {
    id: 'cc-6',
    deck: 'CHEST',
    title: 'Municipal Infrastructure Assessment',
    description: 'Assessed for street upgrades: pay $40 per Villa and $115 per Grand Hotel.',
    effect: { type: 'REPAIRS', perHouse: 40, perHotel: 115 },
  },
  {
    id: 'cc-7',
    deck: 'CHEST',
    title: 'Diplomatic Clearance Credential',
    description: 'Keep this credential to exit Compliance Detention free of charge.',
    effect: { type: 'GET_OUT_OF_JAIL' },
  },
  {
    id: 'cc-8',
    deck: 'CHEST',
    title: 'Concours d’Elegance First Prize',
    description: 'Your vintage tourer wins Best in Show at Lake Como. Collect $120.',
    effect: { type: 'CASH', amount: 120 },
  },
];

export const GROUP_TILE_INDICES: Record<ColorGroup, number[]> =
  getGroupTileIndices('CLASSIC');

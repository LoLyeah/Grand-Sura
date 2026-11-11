'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Markdown from 'react-markdown';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Check,
  Dices,
  Gavel,
  Globe,
  Layers,
  Mic,
  Settings,
  TrendingDown,
  TrendingUp,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import MonopolyBoard3D, { CameraPreset } from './three/MonopolyBoard3D';
import MonopolyBoard2D from './MonopolyBoard2D';
import LiveVoicePanel from './LiveVoicePanel';
import {
  BOARD_SIZE_CONFIGS,
  BoardSizeId,
  COLOR_GROUP_NAMES,
  CONTENDER_NAMES,
  getBoardTiles,
  GLOBAL_EVENTS,
  HOST_VOICES,
  HostConfig,
  HostGender,
  HostVoiceName,
  PERSONALITY_PRESETS,
  PersonalityPresetId,
  PLAYER_PALETTE,
  TOKEN_ARCHETYPES,
  TokenArchetype,
} from '@/lib/monopoly-data';
import {
  applyGameAction,
  canBuildHouseOnTile,
  computeNextBotAction,
  createInitialGameRoom,
  DEFAULT_TURN_TIME_LIMIT_SECONDS,
  GameLogEntry,
  GameMode,
  GameRoomState,
  getEffectiveHouseCost,
  getEffectivePropertyPrice,
  PlayerState,
} from '@/lib/monopoly-engine';
import { soundFX } from '@/lib/sound-fx';

type ActiveModalTab =
  | 'NONE'
  | 'LOBBY'
  | 'DEED'
  | 'PORTFOLIO'
  | 'TRADE'
  | 'EVENTS'
  | 'HOST'
  | 'SETTINGS';

const DEFAULT_HOST_CONFIG: HostConfig = {
  enabled: true,
  gender: 'FEMALE',
  voiceName: 'Kore',
  personalityPreset: 'WITTY_HOST',
  customPersonalityPrompt: '',
  autoSpeakEvents: true,
};

function buildDraftPlayersForCount(
  count: number,
  startingCash = 1500
): PlayerState[] {
  const clamped = Math.max(2, Math.min(16, count));
  const list: PlayerState[] = [];
  for (let i = 0; i < clamped; i++) {
    const arch = TOKEN_ARCHETYPES[i % TOKEN_ARCHETYPES.length];
    const color = PLAYER_PALETTE[i % PLAYER_PALETTE.length];
    list.push({
      id: `p-${i + 1}`,
      name: CONTENDER_NAMES[i] || `Contender ${i + 1}`,
      isBot: i > 0,
      token: arch.id,
      color,
      cash: startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      bankrupt: false,
      connected: true,
    });
  }
  return list;
}

const DEFAULT_LOCAL_PLAYERS: PlayerState[] = buildDraftPlayersForCount(4, 1500);

export default function MonopolyApp() {
  // App Lifecycle Phase: Always open on 'START_MENU' first so the game never starts automatically!
  const [appPhase, setAppPhase] = useState<
    'START_MENU' | 'LOBBY_SETUP' | 'IN_GAME'
  >('START_MENU');

  const [gameState, setGameState] = useState<GameRoomState>(() =>
    createInitialGameRoom(
      'LOCAL1',
      'LOCAL',
      DEFAULT_LOCAL_PLAYERS,
      DEFAULT_HOST_CONFIG,
      DEFAULT_TURN_TIME_LIMIT_SECONDS,
      'CLASSIC'
    )
  );

  // Board Presentation Mode: '3D' (WebGL) or '2D' (High-Contrast Easy-Read Tabletop)
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');

  // Lobby Setup State
  const [setupMode, setSetupMode] = useState<GameMode>('LOCAL');
  const [draftBoardSize, setDraftBoardSize] = useState<BoardSizeId>('CLASSIC');
  const [draftTurnLimit, setDraftTurnLimit] = useState<number>(
    DEFAULT_TURN_TIME_LIMIT_SECONDS
  );
  const [onlineAction, setOnlineAction] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [joinRoomCodeInput, setJoinRoomCodeInput] = useState('');
  const [onlinePlayerName, setOnlinePlayerName] = useState('Aurelia Sterling');
  const [onlinePlayerToken, setOnlinePlayerToken] =
    useState<TokenArchetype>('GRAND_TOURER');
  const [onlineBotCount, setOnlineBotCount] = useState(3);
  const [localDraftPlayers, setLocalDraftPlayers] = useState<PlayerState[]>(
    DEFAULT_LOCAL_PLAYERS
  );
  const [roomError, setRoomError] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string>('p-1');
  const [copiedCode, setCopiedCode] = useState(false);

  // UI & Viewport Controls
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModalTab>('NONE');
  const [portfolioTab, setPortfolioTab] = useState<
    'HOLDINGS' | 'HISTORY' | 'TRADES'
  >('HOLDINGS');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<
    'ALL' | 'ROLL' | 'BUY' | 'RENT' | 'OTHER'
  >('ALL');
  const [tradeHistoryPlayerFilter, setTradeHistoryPlayerFilter] =
    useState<string>('ALL');
  const [selectedTileIndex, setSelectedTileIndex] = useState<number>(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('OVERVIEW');
  const [diceRollTrigger, setDiceRollTrigger] = useState(0);
  const [sfxMuted, setSfxMuted] = useState(false);

  // User Display & HUD Settings (Default OFF for 3D floating text labels & corner inspector card)
  const [show3DLabelsOverlay, setShow3DLabelsOverlay] =
    useState<boolean>(false);
  const [show3DCornerInspector, setShow3DCornerInspector] =
    useState<boolean>(false);
  const [showAllPlayerTurnPopups, setShowAllPlayerTurnPopups] =
    useState<boolean>(true);
  const [botTurnDelayMs, setBotTurnDelayMs] = useState<number>(1650);

  const [hotkeyFeedback, setHotkeyFeedback] = useState<{
    text: string;
    tone: 'success' | 'warn';
  } | null>(null);
  const hotkeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Turn-Time Limit Countdown Clock Tick
  const [clockTick, setClockTick] = useState<number>(() => Date.now());
  const timeoutDispatchedKeyRef = useRef<string | null>(null);

  // AI Host Commentary & Live Voice State
  const [hostTranscript, setHostTranscript] = useState<string>(
    'Welcome to Grand Estates 3D! Switch between 3D View, Top-Down, or 2D Easy-Read Board anytime.'
  );
  const [isSynthesizingTts, setIsSynthesizingTts] = useState(false);
  const [showLiveVoice, setShowLiveVoice] = useState(false);
  const lastSpokenHeadlineRef = useRef<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Google Search Landmark Grounding State
  const [landmarkIntelCache, setLandmarkIntelCache] = useState<
    Record<
      string,
      { text: string; sources: { uri: string; title: string }[] }
    >
  >({});
  const [loadingIntelKey, setLoadingIntelKey] = useState<string | null>(null);
  const [intelError, setIntelError] = useState<string | null>(null);

  // Trade Form State
  const [tradeTargetId, setTradeTargetId] = useState<string>('p-2');
  const [tradeOfferCash, setTradeOfferCash] = useState<number>(0);
  const [tradeRequestCash, setTradeRequestCash] = useState<number>(0);
  const [tradeOfferProps, setTradeOfferProps] = useState<number[]>([]);
  const [tradeRequestProps, setTradeRequestProps] = useState<number[]>([]);

  // WebSocket reference for Online Multiplayer Rooms
  const gameWsRef = useRef<WebSocket | null>(null);

  // Active board tiles for the current boardSize (MINI=24, CLASSIC=40, MEGA=52)
  const activeTiles = useMemo(
    () => getBoardTiles(gameState.boardSize),
    [gameState.boardSize]
  );
  const activeBoardConfig =
    BOARD_SIZE_CONFIGS[gameState.boardSize] || BOARD_SIZE_CONFIGS.CLASSIC;

  // Keyboard shortcut 'H' to collapse/expand bottom control dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Build concise board context string for AI Host TTS and Live API
  const boardContextSummary = useMemo(() => {
    const cur = gameState.players[gameState.turnIndex];
    const standings = gameState.players
      .map((p) => {
        const deedCount = Object.values(gameState.properties).filter(
          (pr) => pr.ownerId === p.id
        ).length;
        return `${p.name}: $${p.cash} (${deedCount} deeds, at ${
          activeTiles[p.position]?.shortName || 'GO'
        }${p.inJail ? ', in Detention' : ''}${p.bankrupt ? ', BANKRUPT' : ''})`;
      })
      .join(' | ');
    const macroText = gameState.activeGlobalEvent
      ? `Active Global Event: ${gameState.activeGlobalEvent.event.title} (${gameState.activeGlobalEvent.remainingTurns} turns left).`
      : 'No active temporary market event.';
    return `Board: ${activeBoardConfig.name} | Current Turn: ${
      cur?.name || 'None'
    } | Phase: ${gameState.phase} | Standings: ${standings} | ${macroText}`;
  }, [gameState, activeTiles, activeBoardConfig.name]);

  // Speak commentary via gemini-3.8-flash-tts
  const triggerHostCommentary = useCallback(
    async (eventText: string, directScript?: string) => {
      if (!gameState.hostConfig.enabled) return;
      setIsSynthesizingTts(true);
      try {
        const res = await fetch('/api/host/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventSummary: eventText,
            hostConfig: gameState.hostConfig,
            boardContext: boardContextSummary,
            directScript,
          }),
        });
        const data = await res.json();
        if (data.transcript) {
          setHostTranscript(data.transcript);
        }
        if (data.audioBase64 && !sfxMuted) {
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
          }
          const audio = new Audio(
            `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`
          );
          currentAudioRef.current = audio;
          audio.play().catch(() => {});
        }
      } catch {
        // Fallback silently if offline
      } finally {
        setIsSynthesizingTts(false);
      }
    },
    [gameState.hostConfig, boardContextSummary, sfxMuted]
  );

  // Watch for important headline game events to narrate automatically when autoSpeakEvents is enabled
  useEffect(() => {
    if (appPhase !== 'IN_GAME') return;
    const headline = gameState.lastHeadlineEvent;
    if (
      headline &&
      headline !== lastSpokenHeadlineRef.current &&
      gameState.hostConfig.enabled &&
      gameState.hostConfig.autoSpeakEvents
    ) {
      lastSpokenHeadlineRef.current = headline;
      triggerHostCommentary(headline);
    }
  }, [
    appPhase,
    gameState.lastHeadlineEvent,
    gameState.hostConfig.enabled,
    gameState.hostConfig.autoSpeakEvents,
    triggerHostCommentary,
  ]);

  // Dispatch game action (either locally or via authoritative WebSocket server in ONLINE mode)
  const dispatchAction = useCallback(
    (action: Parameters<typeof applyGameAction>[1]) => {
      if (action.type === 'ROLL_DICE') {
        soundFX.playDiceRoll();
        setDiceRollTrigger((c) => c + 1);
      } else if (action.type === 'BUY_PROPERTY') {
        soundFX.playCashChime();
      } else if (action.type === 'BUILD_HOUSE') {
        soundFX.playBuildUpgrade();
      } else if (
        action.type === 'AUCTION_BID' ||
        action.type === 'DECLINE_PROPERTY'
      ) {
        soundFX.playGavelStrike();
      }

      if (
        gameState.mode === 'ONLINE' &&
        gameWsRef.current &&
        gameWsRef.current.readyState === WebSocket.OPEN
      ) {
        gameWsRef.current.send(
          JSON.stringify({
            type: 'room:action',
            action,
          })
        );
      } else {
        setGameState((prev) => applyGameAction(prev, action));
      }
    },
    [gameState.mode]
  );

  // Turn-Time Limit Visual Countdown & Automatic 'END_TURN' Dispatch on Timeout
  const remainingSeconds =
    appPhase === 'IN_GAME' &&
    gameState.status === 'PLAYING' &&
    gameState.turnTimeLimitSeconds > 0
      ? Math.max(
          0,
          gameState.turnTimeLimitSeconds -
            Math.floor(Math.max(0, clockTick - gameState.turnStartedAt) / 1000)
        )
      : null;

  useEffect(() => {
    if (
      appPhase !== 'IN_GAME' ||
      gameState.status !== 'PLAYING' ||
      gameState.turnTimeLimitSeconds <= 0
    ) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      setClockTick(now);
      const elapsedSeconds = Math.floor(
        Math.max(0, now - gameState.turnStartedAt) / 1000
      );
      const left = Math.max(
        0,
        gameState.turnTimeLimitSeconds - elapsedSeconds
      );

      const turnKey = `${gameState.turnStartedAt}-${gameState.turnIndex}`;
      if (left <= 0 && timeoutDispatchedKeyRef.current !== turnKey) {
        timeoutDispatchedKeyRef.current = turnKey;
        soundFX.playGavelStrike();
        dispatchAction({ type: 'END_TURN', isTimeout: true });
      }
    }, 250);

    return () => clearInterval(interval);
  }, [
    appPhase,
    gameState.status,
    gameState.turnTimeLimitSeconds,
    gameState.turnStartedAt,
    gameState.turnIndex,
    dispatchAction,
  ]);

  // Automatic Bot Turn Execution in LOCAL mode (only when appPhase === 'IN_GAME')
  useEffect(() => {
    if (
      appPhase !== 'IN_GAME' ||
      gameState.mode !== 'LOCAL' ||
      gameState.status !== 'PLAYING'
    )
      return;
    const nextBotMove = computeNextBotAction(gameState);
    if (!nextBotMove) return;

    const stepDelay =
      gameState.turnNotice && showAllPlayerTurnPopups
        ? botTurnDelayMs
        : Math.min(850, botTurnDelayMs);

    const timer = setTimeout(() => {
      dispatchAction(nextBotMove);
    }, stepDelay);

    return () => clearTimeout(timer);
  }, [
    appPhase,
    gameState,
    dispatchAction,
    botTurnDelayMs,
    showAllPlayerTurnPopups,
  ]);

  // Fetch Google Search Grounding Intel for a Landmark Tile
  const fetchLandmarkIntel = async (tileIdx: number) => {
    const tile = activeTiles[tileIdx];
    if (!tile) return;
    const cacheKey = `${gameState.boardSize}-${tileIdx}`;
    setLoadingIntelKey(cacheKey);
    setIntelError(null);
    try {
      const res = await fetch('/api/landmark/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tileName: tile.name,
          city: tile.city,
          country: tile.country,
          landmarkQuery: tile.landmarkQuery,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch landmark intel');
      }
      setLandmarkIntelCache((prev) => ({
        ...prev,
        [cacheKey]: {
          text: data.text,
          sources: data.sources || [],
        },
      }));
    } catch (err: unknown) {
      setIntelError(
        err instanceof Error ? err.message : 'Unable to fetch live search data'
      );
    } finally {
      setLoadingIntelKey(null);
    }
  };

  // Select a Board Size in Lobby and optionally apply its recommended player count
  const handleSelectDraftBoardSize = (
    newSize: BoardSizeId,
    applyRecommendedCount = false
  ) => {
    const cfg = BOARD_SIZE_CONFIGS[newSize];
    setDraftBoardSize(newSize);
    if (applyRecommendedCount) {
      setLocalDraftPlayers(
        buildDraftPlayersForCount(cfg.defaultPlayerCount, cfg.startingCash)
      );
      setOnlineBotCount(Math.max(1, cfg.defaultPlayerCount - 1));
    } else {
      // Clamp player list to maxAllowedPlayers and update starting cash
      setLocalDraftPlayers((prev) =>
        prev
          .slice(0, cfg.maxAllowedPlayers)
          .map((p) => ({ ...p, cash: cfg.startingCash }))
      );
    }
  };

  // Start a new Local Match
  const handleStartLocalMatch = () => {
    if (gameWsRef.current) {
      gameWsRef.current.close();
      gameWsRef.current = null;
    }
    const cfg = BOARD_SIZE_CONFIGS[draftBoardSize];
    const cleanPlayers: PlayerState[] = localDraftPlayers.map((p, idx) => ({
      ...p,
      id: `local-${idx + 1}`,
      cash: cfg.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      bankrupt: false,
      connected: true,
    }));
    const newState = createInitialGameRoom(
      'LOCAL1',
      'LOCAL',
      cleanPlayers,
      gameState.hostConfig,
      draftTurnLimit,
      draftBoardSize
    );
    setGameState(newState);
    setLocalPlayerId(cleanPlayers[0].id);
    setSelectedTileIndex(1);
    setActiveModal('NONE');
    setAppPhase('IN_GAME');
    soundFX.playCashChime();
  };

  // Quick-launch a preset board size & recommended player count from Start Menu
  const handleQuickLaunchPreset = (sizeId: BoardSizeId) => {
    if (gameWsRef.current) {
      gameWsRef.current.close();
      gameWsRef.current = null;
    }
    const cfg = BOARD_SIZE_CONFIGS[sizeId];
    setDraftBoardSize(sizeId);
    const presetPlayers = buildDraftPlayersForCount(
      cfg.defaultPlayerCount,
      cfg.startingCash
    );
    setLocalDraftPlayers(presetPlayers);
    const cleanPlayers: PlayerState[] = presetPlayers.map((p, idx) => ({
      ...p,
      id: `local-${idx + 1}`,
      cash: cfg.startingCash,
    }));
    const newState = createInitialGameRoom(
      'LOCAL1',
      'LOCAL',
      cleanPlayers,
      gameState.hostConfig,
      draftTurnLimit,
      sizeId
    );
    setGameState(newState);
    setLocalPlayerId(cleanPlayers[0].id);
    setSelectedTileIndex(1);
    setActiveModal('NONE');
    setAppPhase('IN_GAME');
    soundFX.playCashChime();
  };

  // Connect to Online Multiplayer Room (Create or Join)
  const handleConnectOnlineRoom = () => {
    setRoomError(null);
    if (gameWsRef.current) {
      gameWsRef.current.close();
      gameWsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/game`);
    gameWsRef.current = ws;

    const myId = `online-${Math.random().toString(36).slice(2, 8)}`;
    const archMeta =
      TOKEN_ARCHETYPES.find((t) => t.id === onlinePlayerToken) ||
      TOKEN_ARCHETYPES[0];
    const cfg = BOARD_SIZE_CONFIGS[draftBoardSize];

    const myPlayer: PlayerState = {
      id: myId,
      name: onlinePlayerName.trim() || 'Sovereign Contender',
      isBot: false,
      token: onlinePlayerToken,
      color: archMeta.defaultColor,
      cash: cfg.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      bankrupt: false,
      connected: true,
    };

    ws.onopen = () => {
      if (onlineAction === 'CREATE') {
        const bots: PlayerState[] = [];
        const availableTokens = TOKEN_ARCHETYPES.filter(
          (t) => t.id !== onlinePlayerToken
        );
        const botNames = CONTENDER_NAMES.slice(1);
        for (let i = 0; i < onlineBotCount; i++) {
          const bArch = availableTokens[i % availableTokens.length];
          const bColor = PLAYER_PALETTE[(i + 1) % PLAYER_PALETTE.length];
          bots.push({
            id: `bot-${i + 1}-${Date.now()}`,
            name: botNames[i % botNames.length] || `Bot Contender ${i + 1}`,
            isBot: true,
            token: bArch.id,
            color: bColor,
            cash: cfg.startingCash,
            position: 0,
            inJail: false,
            jailTurns: 0,
            getOutOfJailCards: 0,
            bankrupt: false,
            connected: true,
          });
        }
        ws.send(
          JSON.stringify({
            type: 'room:create',
            player: myPlayer,
            bots,
            hostConfig: gameState.hostConfig,
            boardSize: draftBoardSize,
            turnTimeLimitSeconds: draftTurnLimit,
          })
        );
      } else {
        ws.send(
          JSON.stringify({
            type: 'room:join',
            roomCode: joinRoomCodeInput.trim().toUpperCase(),
            player: myPlayer,
          })
        );
      }
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'room:joined') {
        setLocalPlayerId(msg.playerId);
        setGameState(msg.state);
        setSelectedTileIndex(1);
        setActiveModal('NONE');
        setAppPhase('IN_GAME');
        soundFX.playCashChime();
      } else if (msg.type === 'room:state') {
        setGameState(msg.state);
      } else if (msg.type === 'room:error') {
        setRoomError(msg.message || 'Unable to join room');
      }
    };

    ws.onerror = () => {
      setRoomError('WebSocket connection error. Please try again.');
    };
  };

  const currentPlayer =
    gameState.players[gameState.turnIndex] || gameState.players[0];
  const currentTile =
    activeTiles[currentPlayer?.position || 0] || activeTiles[0];
  const safeSelectedIndex =
    selectedTileIndex < activeTiles.length ? selectedTileIndex : 0;
  const selectedTile = activeTiles[safeSelectedIndex] || activeTiles[0];
  const selectedPropState = gameState.properties[selectedTile.index];
  const selectedOwner = selectedPropState?.ownerId
    ? gameState.players.find((p) => p.id === selectedPropState.ownerId)
    : null;
  const selectedIntelKey = `${gameState.boardSize}-${selectedTile.index}`;

  const isMyTurn =
    gameState.mode === 'LOCAL'
      ? !currentPlayer?.isBot
      : currentPlayer?.id === localPlayerId;

  const activeControllablePlayer =
    gameState.mode === 'LOCAL'
      ? currentPlayer
      : gameState.players.find((p) => p.id === localPlayerId) || currentPlayer;

  const currentEffectivePrice = getEffectivePropertyPrice(
    gameState,
    currentTile.index
  );

  const selectedEffectivePrice = getEffectivePropertyPrice(
    gameState,
    selectedTile.index
  );
  const selectedEffectiveHouseCost = getEffectiveHouseCost(
    gameState,
    selectedTile.index
  );

  // Keyboard hotkey 'B' in 2D or 3D view: attempts to trigger BUILD_HOUSE on the currently selected property
  useEffect(() => {
    if (appPhase !== 'IN_GAME') return;
    const onBuildHotkey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key.toLowerCase() !== 'b') return;

      e.preventDefault();

      // Determine the controllable human player for the selected tile
      const tileProp = gameState.properties[selectedTile.index];
      const tileOwner = tileProp?.ownerId
        ? gameState.players.find((p) => p.id === tileProp.ownerId)
        : null;
      const candidatePlayer =
        gameState.mode === 'LOCAL' && tileOwner && !tileOwner.isBot
          ? tileOwner
          : activeControllablePlayer;

      if (!candidatePlayer || candidatePlayer.isBot) {
        setHotkeyFeedback({
          text: `[B] Wait for a human player's turn to develop ${selectedTile.shortName}`,
          tone: 'warn',
        });
      } else {
        const check = canBuildHouseOnTile(
          gameState,
          candidatePlayer.id,
          selectedTile.index
        );
        if (check.allowed) {
          const nextCount = (tileProp?.houses || 0) + 1;
          const upgradeLabel =
            nextCount === 5 ? 'Grand Hotel' : `Villa #${nextCount}`;
          dispatchAction({
            type: 'BUILD_HOUSE',
            playerId: candidatePlayer.id,
            tileIndex: selectedTile.index,
          });
          setHotkeyFeedback({
            text: `[B] Constructed ${upgradeLabel} on ${selectedTile.shortName} (-$${selectedEffectiveHouseCost})`,
            tone: 'success',
          });
        } else {
          setHotkeyFeedback({
            text: `[B] ${selectedTile.shortName}: ${
              check.reason || 'Cannot build on this property'
            }`,
            tone: 'warn',
          });
        }
      }

      if (hotkeyTimerRef.current) {
        clearTimeout(hotkeyTimerRef.current);
      }
      hotkeyTimerRef.current = setTimeout(() => {
        setHotkeyFeedback(null);
      }, 2800);
    };

    window.addEventListener('keydown', onBuildHotkey);
    return () => window.removeEventListener('keydown', onBuildHotkey);
  }, [
    appPhase,
    gameState,
    selectedTile.index,
    selectedTile.shortName,
    selectedEffectiveHouseCost,
    activeControllablePlayer,
    dispatchAction,
  ]);

  const timerProgressPct =
    gameState.turnTimeLimitSeconds > 0 && remainingSeconds !== null
      ? Math.max(
          0,
          Math.min(
            100,
            (remainingSeconds / gameState.turnTimeLimitSeconds) * 100
          )
        )
      : 100;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0F0C0A] select-none">
      {/* 1A. Full-Bleed 3D WebGL Monopoly Viewport (100vw x 100vh) */}
      <MonopolyBoard3D
        gameState={gameState}
        selectedTileIndex={safeSelectedIndex}
        onSelectTile={(idx) => {
          setSelectedTileIndex(idx);
          setActiveModal('DEED');
          soundFX.playTokenHop();
        }}
        cameraPreset={cameraPreset}
        onUserOrbitStart={() => setCameraPreset('FREE_ORBIT')}
        diceRollTrigger={diceRollTrigger}
        show3DLabelsOverlay={show3DLabelsOverlay}
        show3DCornerInspector={show3DCornerInspector}
      />

      {/* 1B. Crisp 2D Top-Down Easy-Read Tabletop View (Rendered inside the 3-Column Game Arena below when viewMode === '2D') */}

      {/* 2. Top Bar Contract (Strictly 3 Zones separated by gap-8) */}
      <header className="relative z-20 flex items-center justify-between gap-8 px-6 py-3 bg-[#14100E]/95 border-b border-[#D4AF37]/25">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#board"
          onClick={(e) => {
            e.preventDefault();
            setActiveModal('NONE');
          }}
          className="text-lg font-bold tracking-tight text-[#FAF6F0] whitespace-nowrap shrink-0"
          style={{ fontFamily: 'var(--font-fraunces), serif' }}
        >
          Grand Estates 3D
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-300">
          <button
            onClick={() => {
              setViewMode('3D');
              setActiveModal('NONE');
            }}
            className={`hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0 ${
              viewMode === '3D' && activeModal === 'NONE'
                ? 'text-[#D4AF37] underline underline-offset-4'
                : ''
            }`}
          >
            3D Board
          </button>
          <button
            onClick={() => {
              setViewMode('2D');
              setActiveModal('NONE');
            }}
            className={`hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0 ${
              viewMode === '2D' && activeModal === 'NONE'
                ? 'text-[#D4AF37] underline underline-offset-4'
                : ''
            }`}
          >
            2D Board (Easy Read)
          </button>
          <button
            onClick={() =>
              setActiveModal(activeModal === 'EVENTS' ? 'NONE' : 'EVENTS')
            }
            className={`hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0 ${
              activeModal === 'EVENTS'
                ? 'text-[#D4AF37] underline underline-offset-4'
                : ''
            }`}
          >
            Macro Events
          </button>
          <button
            onClick={() =>
              setActiveModal(activeModal === 'PORTFOLIO' ? 'NONE' : 'PORTFOLIO')
            }
            className={`hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0 ${
              activeModal === 'PORTFOLIO'
                ? 'text-[#D4AF37] underline underline-offset-4'
                : ''
            }`}
          >
            Portfolio
          </button>
          <button
            onClick={() =>
              setActiveModal(activeModal === 'SETTINGS' ? 'NONE' : 'SETTINGS')
            }
            className={`hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0 ${
              activeModal === 'SETTINGS'
                ? 'text-[#D4AF37] underline underline-offset-4'
                : ''
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              if (appPhase !== 'IN_GAME') {
                setAppPhase('LOBBY_SETUP');
              } else {
                setActiveModal(activeModal === 'LOBBY' ? 'NONE' : 'LOBBY');
              }
            }}
            className="px-4 py-2 text-xs font-semibold text-[#0F0C0A] bg-[#D4AF37] rounded-lg hover:bg-[#e5c247] transition-colors whitespace-nowrap shrink-0"
          >
            Board Size & Lobby
          </button>
        </div>
      </header>

      {/* 2B. Dedicated Start Menu & Pre-Game Setup Lobby Overlay (Shown when appPhase !== 'IN_GAME') */}
      {appPhase !== 'IN_GAME' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          {appPhase === 'START_MENU' ? (
            <div className="w-full max-w-4xl rounded-2xl bg-[#14100E] border-2 border-[#D4AF37]/60 shadow-2xl p-6 md:p-10 text-[#FAF6F0] space-y-6 my-auto">
              <div className="text-center space-y-2 border-b border-[#D4AF37]/25 pb-6">
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-[#D4AF37]">
                  <span>Sovereign World Landmarks</span>
                  <span aria-hidden="true" className="text-stone-500">
                    ·
                  </span>
                  <span>2 to 16 Players</span>
                  <span aria-hidden="true" className="text-stone-500">
                    ·
                  </span>
                  <span>5 Board Scales (24 to 84 Spaces)</span>
                </div>
                <h1
                  className="text-3xl md:text-5xl font-bold text-[#FAF6F0] tracking-tight text-balance"
                  style={{ fontFamily: 'var(--font-fraunces), serif' }}
                >
                  Grand Estates 3D
                </h1>
                <p className="text-sm md:text-base text-stone-300 max-w-2xl mx-auto leading-relaxed">
                  Multiplayer 3D & 2D Luxury Landmark Monopoly with five board
                  scales (24 to 84 spaces for up to 16 players), periodic
                  macro-economic market events, and an optional AI Host.
                </p>
              </div>

              {/* Primary Start Menu Modes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setSetupMode('LOCAL');
                    setAppPhase('LOBBY_SETUP');
                  }}
                  className="p-5 rounded-xl bg-[#D4AF37] text-[#0F0C0A] hover:bg-[#e5c247] transition-all text-left flex flex-col justify-between space-y-3 shadow-xl cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-extrabold uppercase tracking-wider opacity-80">
                      Local Pass-and-Play & AI Bots
                    </div>
                    <div
                      className="text-xl md:text-2xl font-bold"
                      style={{ fontFamily: 'var(--font-fraunces), serif' }}
                    >
                      Configure Match & Lobby →
                    </div>
                    <p className="text-xs font-medium opacity-90">
                      Choose from 5 board sizes, customize 2 to 16 Human or AI
                      Bot contenders, set turn timers, and configure your AI
                      Host.
                    </p>
                  </div>
                  <div className="text-xs font-extrabold underline">
                    Open Full Match Architect
                  </div>
                </button>

                <button
                  onClick={() => {
                    setSetupMode('ONLINE');
                    setAppPhase('LOBBY_SETUP');
                  }}
                  className="p-5 rounded-xl bg-[#0F0C0A] border-2 border-[#D4AF37]/50 hover:border-[#D4AF37] text-[#FAF6F0] transition-all text-left flex flex-col justify-between space-y-3 shadow-xl cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                      Real-Time WebSocket Rooms
                    </div>
                    <div
                      className="text-xl md:text-2xl font-bold text-white"
                      style={{ fontFamily: 'var(--font-fraunces), serif' }}
                    >
                      Online Multiplayer Room →
                    </div>
                    <p className="text-xs text-stone-300">
                      Create a 6-character room invite code with up to 16
                      players & bots, or join a friend’s live room code.
                    </p>
                  </div>
                  <div className="text-xs font-bold text-[#D4AF37] underline">
                    Create or Join Room Code
                  </div>
                </button>
              </div>

              {/* Quick-Launch Board Size Presets (2 to 16 Players) */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-stone-300 flex items-center justify-between">
                  <span>
                    Or Quick-Launch Recommended Board Size Preset (2–16
                    Players):
                  </span>
                  <span className="text-[11px] text-[#D4AF37]">
                    1 Human + Recommended AI Bots
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                  {(
                    [
                      'MINI',
                      'CLASSIC',
                      'MEGA',
                      'CONTINENTAL',
                      'COLOSSAL',
                    ] as BoardSizeId[]
                  ).map((sizeId) => {
                    const cfg = BOARD_SIZE_CONFIGS[sizeId];
                    return (
                      <button
                        key={sizeId}
                        onClick={() => handleQuickLaunchPreset(sizeId)}
                        className="p-3 rounded-xl bg-[#0F0C0A] border border-white/15 hover:border-[#D4AF37] text-left transition-all flex flex-col justify-between space-y-2 cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">
                            {cfg.shortLabel}
                          </div>
                          <div className="text-[11px] font-bold text-[#D4AF37] mt-0.5">
                            {cfg.recommendedPlayers}
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-stone-400 border-t border-white/10 pt-1.5 flex items-center justify-between">
                          <span>Start ${cfg.startingCash}</span>
                          <span className="text-[#D4AF37] font-bold">
                            Play {cfg.defaultPlayerCount}P →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Pre-Game Setup Lobby (appPhase === 'LOBBY_SETUP') */
            <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#14100E] border-2 border-[#D4AF37]/60 shadow-2xl p-6 text-[#FAF6F0] space-y-5 my-auto">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="text-xs text-[#D4AF37] font-semibold">
                    Pre-Game Setup Lobby · Up to 16 Players Across 5 Board
                    Scales
                  </div>
                  <h2
                    className="text-2xl font-bold"
                    style={{ fontFamily: 'var(--font-fraunces), serif' }}
                  >
                    Configure Your Grand Estates Match
                  </h2>
                </div>
                <button
                  onClick={() => setAppPhase('START_MENU')}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-700"
                >
                  ← Back to Start Menu
                </button>
              </div>

              {/* 1. 5 Board Sizes (Up to 16 Players) */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#D4AF37]" />
                    <span>
                      1. Choose Board Size (24 to 84 Spaces · Up to 16 Players)
                    </span>
                  </label>
                  <button
                    onClick={() =>
                      handleSelectDraftBoardSize(draftBoardSize, true)
                    }
                    className="text-xs font-bold text-[#D4AF37] hover:underline"
                  >
                    Auto-Fill Recommended Contenders (
                    {BOARD_SIZE_CONFIGS[draftBoardSize].defaultPlayerCount}{' '}
                    Players)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                  {(
                    [
                      'MINI',
                      'CLASSIC',
                      'MEGA',
                      'CONTINENTAL',
                      'COLOSSAL',
                    ] as BoardSizeId[]
                  ).map((sizeId) => {
                    const cfg = BOARD_SIZE_CONFIGS[sizeId];
                    const isSelected = draftBoardSize === sizeId;
                    return (
                      <button
                        key={sizeId}
                        onClick={() => handleSelectDraftBoardSize(sizeId, true)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white shadow-lg'
                            : 'bg-[#0F0C0A] border-white/10 text-stone-300 hover:border-white/30'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-white">
                            {cfg.shortLabel}
                          </div>
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#D4AF37] text-[#0F0C0A] text-[10px] font-extrabold">
                            <Users className="w-3 h-3" />
                            <span>{cfg.recommendedPlayers}</span>
                          </div>
                          <p className="text-[10px] text-stone-400 leading-snug">
                            Max {cfg.maxAllowedPlayers}P · Start $
                            {cfg.startingCash}
                          </p>
                        </div>
                        <div className="text-[10px] font-mono text-[#D4AF37] border-t border-white/10 pt-1">
                          {cfg.gridDimension}×{cfg.gridDimension} Grid
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Starting Board View & Turn-Time Limit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#0F0C0A] border border-white/10 space-y-2">
                  <div className="text-xs font-semibold text-white">
                    2. Preferred Board View Mode
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        setViewMode('3D');
                        setCameraPreset('OVERVIEW');
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold ${
                        viewMode === '3D' && cameraPreset === 'OVERVIEW'
                          ? 'bg-[#D4AF37] text-[#0F0C0A]'
                          : 'bg-[#14100E] text-stone-300 border border-white/10'
                      }`}
                    >
                      3D Perspective
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('3D');
                        setCameraPreset('TOP_DOWN');
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold ${
                        viewMode === '3D' && cameraPreset === 'TOP_DOWN'
                          ? 'bg-[#D4AF37] text-[#0F0C0A]'
                          : 'bg-[#14100E] text-stone-300 border border-white/10'
                      }`}
                    >
                      3D Top-Down
                    </button>
                    <button
                      onClick={() => setViewMode('2D')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold ${
                        viewMode === '2D'
                          ? 'bg-[#D4AF37] text-[#0F0C0A]'
                          : 'bg-[#14100E] text-stone-300 border border-white/10'
                      }`}
                    >
                      2D Easy-Read
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0F0C0A] border border-white/10 space-y-2">
                  <div className="text-xs font-semibold text-white">
                    3. Turn-Time Limit Pacing
                  </div>
                  <div className="flex gap-1.5">
                    {[
                      [30, '30s Blitz'],
                      [60, '60s Standard'],
                      [90, '90s Relaxed'],
                      [0, 'Unlimited'],
                    ].map(([sec, label]) => (
                      <button
                        key={String(sec)}
                        onClick={() => setDraftTurnLimit(Number(sec))}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold ${
                          draftTurnLimit === Number(sec)
                            ? 'bg-[#D4AF37] text-[#0F0C0A]'
                            : 'bg-[#14100E] text-stone-300 border border-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Local vs Online Mode Switcher */}
              <div className="flex gap-2 p-1 bg-[#0F0C0A] rounded-lg border border-white/10">
                <button
                  onClick={() => setSetupMode('LOCAL')}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors ${
                    setupMode === 'LOCAL'
                      ? 'bg-[#D4AF37] text-[#0F0C0A]'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  Local Table (Pass-and-Play + AI Bots · 2–16 Players)
                </button>
                <button
                  onClick={() => setSetupMode('ONLINE')}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors ${
                    setupMode === 'ONLINE'
                      ? 'bg-[#D4AF37] text-[#0F0C0A]'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  Online Real-Time Multiplayer Room
                </button>
              </div>

              {setupMode === 'LOCAL' ? (
                <div className="space-y-3">
                  {(() => {
                    const cfg = BOARD_SIZE_CONFIGS[draftBoardSize];
                    const count = localDraftPlayers.length;
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-stone-200 font-semibold">
                            4. Contenders Roster ({count} /{' '}
                            {cfg.maxAllowedPlayers} Max for {cfg.shortLabel})
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold">
                            {cfg.recommendedPlayers}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {[4, 8, 12, 16]
                            .filter((n) => n <= cfg.maxAllowedPlayers)
                            .map((n) => (
                              <button
                                key={n}
                                onClick={() =>
                                  setLocalDraftPlayers(
                                    buildDraftPlayersForCount(
                                      n,
                                      cfg.startingCash
                                    )
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-[#0F0C0A] border border-white/15 text-[11px] text-stone-300 hover:border-[#D4AF37]"
                              >
                                Fill {n}P
                              </button>
                            ))}
                          {localDraftPlayers.length < cfg.maxAllowedPlayers && (
                            <button
                              onClick={() => {
                                const nextIdx = localDraftPlayers.length;
                                const arch =
                                  TOKEN_ARCHETYPES[
                                    nextIdx % TOKEN_ARCHETYPES.length
                                  ];
                                const color =
                                  PLAYER_PALETTE[
                                    nextIdx % PLAYER_PALETTE.length
                                  ];
                                setLocalDraftPlayers((prev) => [
                                  ...prev,
                                  {
                                    id: `draft-${Date.now()}-${nextIdx}`,
                                    name:
                                      CONTENDER_NAMES[nextIdx] ||
                                      `Contender ${nextIdx + 1}`,
                                    isBot: true,
                                    token: arch.id,
                                    color,
                                    cash: cfg.startingCash,
                                    position: 0,
                                    inJail: false,
                                    jailTurns: 0,
                                    getOutOfJailCards: 0,
                                    bankrupt: false,
                                    connected: true,
                                  },
                                ]);
                              }}
                              className="px-3 py-1 rounded bg-stone-800 text-xs text-[#D4AF37] font-semibold hover:bg-stone-700"
                            >
                              + Add Player / Bot
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {localDraftPlayers.map((p, idx) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-[#0F0C0A] border border-white/10 text-xs"
                      >
                        <span
                          className="w-3 h-3 rounded-xs shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLocalDraftPlayers((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, name: val } : item
                              )
                            );
                          }}
                          className="flex-1 min-w-[110px] px-2 py-1 rounded bg-[#14100E] border border-white/15 text-white"
                        />
                        <select
                          value={p.token}
                          onChange={(e) => {
                            const newToken = e.target.value as TokenArchetype;
                            setLocalDraftPlayers((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, token: newToken } : item
                              )
                            );
                          }}
                          className="px-2 py-1 rounded bg-[#14100E] border border-white/15 text-stone-200 text-[11px]"
                        >
                          {TOKEN_ARCHETYPES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() =>
                            setLocalDraftPlayers((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, isBot: !item.isBot }
                                  : item
                              )
                            )
                          }
                          className={`px-2 py-1 rounded font-semibold text-[11px] ${
                            p.isBot
                              ? 'bg-purple-950/90 text-purple-200 border border-purple-500/30'
                              : 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/30'
                          }`}
                        >
                          {p.isBot ? 'Bot' : 'Human'}
                        </button>
                        {localDraftPlayers.length > 2 && (
                          <button
                            onClick={() =>
                              setLocalDraftPlayers((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="p-1 text-stone-400 hover:text-red-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleStartLocalMatch}
                    className="w-full py-3 px-6 rounded-xl bg-[#D4AF37] text-[#0F0C0A] font-extrabold text-sm hover:bg-[#e5c247] transition-colors shadow-lg cursor-pointer"
                  >
                    Start Match Now — {BOARD_SIZE_CONFIGS[draftBoardSize].name}{' '}
                    ({localDraftPlayers.length} Players) →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOnlineAction('CREATE')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border ${
                        onlineAction === 'CREATE'
                          ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white'
                          : 'bg-[#0F0C0A] border-white/10 text-stone-400'
                      }`}
                    >
                      Create New Room Code
                    </button>
                    <button
                      onClick={() => setOnlineAction('JOIN')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border ${
                        onlineAction === 'JOIN'
                          ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white'
                          : 'bg-[#0F0C0A] border-white/10 text-stone-400'
                      }`}
                    >
                      Join Existing 6-Char Code
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-stone-400 mb-1">
                        Your Display Name
                      </label>
                      <input
                        type="text"
                        value={onlinePlayerName}
                        onChange={(e) => setOnlinePlayerName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#0F0C0A] border border-white/15 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-400 mb-1">
                        Your 3D Sculpted Token
                      </label>
                      <select
                        value={onlinePlayerToken}
                        onChange={(e) =>
                          setOnlinePlayerToken(e.target.value as TokenArchetype)
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#0F0C0A] border border-white/15 text-white"
                      >
                        {TOKEN_ARCHETYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {onlineAction === 'CREATE' ? (
                    <div>
                      <label className="block text-xs text-stone-400 mb-1">
                        AI Bot Contenders in Online Room (0 to{' '}
                        {BOARD_SIZE_CONFIGS[draftBoardSize].maxAllowedPlayers -
                          1}{' '}
                        ·{' '}
                        {BOARD_SIZE_CONFIGS[draftBoardSize].recommendedPlayers})
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={
                          BOARD_SIZE_CONFIGS[draftBoardSize].maxAllowedPlayers -
                          1
                        }
                        value={onlineBotCount}
                        onChange={(e) =>
                          setOnlineBotCount(
                            Math.max(
                              0,
                              Math.min(
                                BOARD_SIZE_CONFIGS[draftBoardSize]
                                  .maxAllowedPlayers - 1,
                                Number(e.target.value)
                              )
                            )
                          )
                        }
                        className="w-32 px-3 py-1.5 rounded-lg bg-[#0F0C0A] border border-white/15 text-xs text-white"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-stone-400 mb-1">
                        Enter 6-Character Room Invite Code
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={joinRoomCodeInput}
                        onChange={(e) =>
                          setJoinRoomCodeInput(e.target.value.toUpperCase())
                        }
                        placeholder="e.g. K9X4M2"
                        className="w-48 px-3 py-2 rounded-lg bg-[#0F0C0A] border border-[#D4AF37]/50 text-sm font-mono uppercase text-[#D4AF37]"
                      />
                    </div>
                  )}

                  {roomError && (
                    <p className="text-xs text-red-400">{roomError}</p>
                  )}

                  <button
                    onClick={handleConnectOnlineRoom}
                    className="w-full py-3 px-6 rounded-xl bg-[#D4AF37] text-[#0F0C0A] font-extrabold text-sm hover:bg-[#e5c247] transition-colors cursor-pointer"
                  >
                    {onlineAction === 'CREATE'
                      ? `Launch Online ${BOARD_SIZE_CONFIGS[draftBoardSize].shortLabel} Room →`
                      : 'Join Multiplayer Room Now →'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Richup.io-Inspired 3-Column Non-Overlapping Game Arena (Left Activity & Camera Rail · Center Board · Right Players & Trade Rail) */}
      {appPhase === 'IN_GAME' && (
        <div className="fixed inset-0 top-[53px] z-10 flex pointer-events-none overflow-hidden">
          {/* LEFT RAIL: View/Camera Switcher + Macro Event Status + Live Activity Feed */}
          <aside
            aria-label="Board Controls and Activity Log"
            className={`hidden lg:flex flex-col justify-between w-72 xl:w-80 h-full p-3 gap-2.5 transition-transform duration-200 ${
              dockCollapsed
                ? '-translate-x-[calc(100%+16px)] pointer-events-none'
                : 'translate-x-0 pointer-events-auto'
            } ${
              viewMode === '2D'
                ? 'bg-[#120E0C] border-r border-[#D4AF37]/20'
                : ''
            }`}
          >
            {/* Card 1: View Mode, 3D Camera Angles & Audio Bar */}
            <div className="rounded-xl bg-[#14100E]/95 border border-[#D4AF37]/30 p-3 shadow-xl space-y-2.5 text-[#FAF6F0]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
                  Board Camera & View
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowLiveVoice((v) => !v)}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 cursor-pointer ${
                      showLiveVoice
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#0F0C0A] text-[#D4AF37] border border-[#D4AF37]/35 hover:bg-[#D4AF37]/15'
                    }`}
                    title="Real-time voice conversation with AI Host"
                  >
                    <Mic className="w-3 h-3" />
                    <span>Voice</span>
                  </button>
                  <button
                    onClick={() => {
                      const next = !sfxMuted;
                      setSfxMuted(next);
                      soundFX.muted = next;
                      if (next && currentAudioRef.current) {
                        currentAudioRef.current.pause();
                      }
                    }}
                    className="p-1 rounded-md bg-[#0F0C0A] border border-white/10 text-stone-300 hover:text-white cursor-pointer"
                    aria-label={sfxMuted ? 'Unmute Audio' : 'Mute Audio'}
                  >
                    {sfxMuted ? (
                      <VolumeX className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      setActiveModal(
                        activeModal === 'SETTINGS' ? 'NONE' : 'SETTINGS'
                      )
                    }
                    className="p-1 rounded-md bg-[#0F0C0A] border border-white/10 text-stone-300 hover:text-[#D4AF37] cursor-pointer"
                    title="Board & Notification Settings"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    ['OVERVIEW', '3D Angle'],
                    ['TOP_DOWN', 'Top-Down'],
                    ['FOLLOW_TOKEN', 'Follow'],
                  ] as [CameraPreset, string][]
                ).map(([preset, label]) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setViewMode('3D');
                      setCameraPreset(preset);
                    }}
                    className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      viewMode === '3D' && cameraPreset === preset
                        ? 'bg-[#D4AF37] text-[#0F0C0A]'
                        : 'bg-[#0F0C0A] text-stone-300 hover:text-white border border-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() =>
                    setViewMode((prev) => (prev === '2D' ? '3D' : '2D'))
                  }
                  className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    viewMode === '2D'
                      ? 'bg-[#D4AF37] text-[#0F0C0A]'
                      : 'bg-[#0F0C0A] text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/15'
                  }`}
                >
                  2D View
                </button>
              </div>
            </div>

            {/* Card 2: Compact Macro Economic Event Status (Never covers board tiles!) */}
            <div className="rounded-xl bg-[#14100E]/95 border border-[#D4AF37]/30 p-3 shadow-xl space-y-1.5 text-[#FAF6F0]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                  {gameState.activeGlobalEvent ? (
                    gameState.activeGlobalEvent.event.category === 'CRASH' ||
                    gameState.activeGlobalEvent.event.category === 'AUDIT' ? (
                      <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    )
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
                  )}
                  <span>Macro Market Status</span>
                </span>
                <button
                  onClick={() => setActiveModal('EVENTS')}
                  className="text-[11px] text-[#D4AF37] hover:underline cursor-pointer"
                >
                  Details →
                </button>
              </div>

              {gameState.activeGlobalEvent ? (
                <div className="p-2 rounded-lg bg-[#0F0C0A] border border-[#D4AF37]/35 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">
                      {gameState.activeGlobalEvent.event.title}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#D4AF37] shrink-0">
                      {gameState.activeGlobalEvent.remainingTurns}T left
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-300 font-medium">
                    {gameState.activeGlobalEvent.event.impactLabel}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-stone-400 flex items-center justify-between">
                  <span>Market Stable</span>
                  <span className="font-mono text-[#D4AF37]">
                    Next Event in {gameState.turnsUntilNextEvent}T
                  </span>
                </div>
              )}
            </div>

            {/* Card 3: Richup.io Style Live Activity Log Feed */}
            <div className="flex-1 min-h-0 rounded-xl bg-[#14100E]/95 border border-[#D4AF37]/30 p-3 shadow-xl flex flex-col text-[#FAF6F0]">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
                  Activity Log
                </span>
                <button
                  onClick={() => {
                    setPortfolioTab('HISTORY');
                    setActiveModal('PORTFOLIO');
                  }}
                  className="text-[11px] text-stone-400 hover:text-[#D4AF37] cursor-pointer"
                >
                  Full History ({gameState.logs.length}) →
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1 [scrollbar-width:thin] [scrollbar-color:#3a2e25_#0F0C0A]">
                {gameState.logs.slice(0, 14).map((entry, idx) => {
                  const matchedPlayer = gameState.players.find((p) =>
                    entry.text.startsWith(p.name)
                  );
                  return (
                    <div
                      key={entry.id}
                      className={`p-2 rounded-lg text-[11px] leading-snug border ${
                        idx === 0
                          ? 'bg-[#1D1611] border-[#D4AF37]/45 text-white font-medium'
                          : 'bg-[#0F0C0A]/90 border-white/5 text-stone-300'
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        {matchedPlayer && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0 mt-1"
                            style={{ backgroundColor: matchedPlayer.color }}
                          />
                        )}
                        <span className="break-words">{entry.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Host One-Line Status at Bottom of Activity Feed */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] text-stone-400 shrink-0">
                <span className="truncate">
                  <strong className="text-[#D4AF37]">Host:</strong>{' '}
                  {hostTranscript}
                </span>
                <button
                  onClick={() => setActiveModal('HOST')}
                  className="text-[#D4AF37] hover:underline shrink-0 cursor-pointer"
                >
                  Config
                </button>
              </div>
            </div>
          </aside>

          {/* CENTER ARENA: 2D Tabletop Board OR Unobstructed 3D Viewport */}
          <div className="flex-1 h-full relative flex flex-col items-center justify-center overflow-hidden">
            {viewMode === '2D' && (
              <div className="w-full h-full pointer-events-auto">
                <MonopolyBoard2D
                  gameState={gameState}
                  selectedTileIndex={safeSelectedIndex}
                  onSelectTile={(idx, openModal) => {
                    setSelectedTileIndex(idx);
                    if (openModal) {
                      setActiveModal('DEED');
                    }
                    soundFX.playTokenHop();
                  }}
                  onDispatchAction={dispatchAction}
                  isMyTurn={isMyTurn}
                  remainingSeconds={remainingSeconds}
                  onSwitchTo3D={() => setViewMode('3D')}
                  onOpenTrade={() => setActiveModal('TRADE')}
                />
              </div>
            )}
          </div>

          {/* RIGHT RAIL: Richup.io Style Players Standings (with Owned Property Pips & 1-Click Trade) + Selected Property Card */}
          <aside
            aria-label="Players Standings and Property Inspector"
            className={`hidden lg:flex flex-col justify-between w-76 xl:w-84 h-full p-3 gap-2.5 transition-transform duration-200 ${
              dockCollapsed
                ? 'translate-x-[calc(100%+16px)] pointer-events-none'
                : 'translate-x-0 pointer-events-auto'
            } ${
              viewMode === '2D'
                ? 'bg-[#120E0C] border-l border-[#D4AF37]/20'
                : ''
            }`}
          >
            {/* Card 1: Players Standings + Property Color Pips + 1-Click Trade */}
            <div className="flex-1 min-h-0 rounded-xl bg-[#14100E]/95 border border-[#D4AF37]/30 p-3 shadow-xl flex flex-col text-[#FAF6F0]">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
                    Players ({gameState.players.filter((p) => !p.bankrupt).length}/
                    {gameState.players.length})
                  </span>
                </div>
                {gameState.mode === 'ONLINE' ? (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(gameState.roomCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[11px] text-[#D4AF37] font-mono hover:underline cursor-pointer"
                  >
                    <span>#{gameState.roomCode}</span>
                    {copiedCode ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveModal('TRADE')}
                    className="px-2 py-0.5 rounded bg-[#D4AF37] text-[#0F0C0A] text-[10px] font-extrabold hover:bg-[#e5c247] cursor-pointer"
                  >
                    + Trade Desk
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 [scrollbar-width:thin] [scrollbar-color:#3a2e25_#0F0C0A]">
                {gameState.players.map((p, idx) => {
                  const isTurn = idx === gameState.turnIndex;
                  const ownedProps = Object.values(gameState.properties).filter(
                    (pr) => pr.ownerId === p.id
                  );

                  return (
                    <div
                      key={p.id}
                      className={`p-2.5 rounded-xl border transition-all ${
                        p.bankrupt
                          ? 'bg-[#0F0C0A]/40 border-white/5 opacity-45'
                          : isTurn
                          ? 'bg-[#1E1712] border-[#D4AF37] shadow-md'
                          : 'bg-[#0F0C0A]/90 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold text-[#0F0C0A] shrink-0"
                            style={{ backgroundColor: p.color }}
                          >
                            {p.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-bold truncate ${
                                  p.bankrupt
                                    ? 'line-through text-stone-500'
                                    : 'text-white'
                                }`}
                              >
                                {p.name}
                              </span>
                              {p.isBot && (
                                <span className="text-[9px] px-1 rounded bg-white/10 text-stone-300 font-semibold">
                                  BOT
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-xs font-extrabold text-[#D4AF37] tabular-nums">
                            ${p.cash}
                          </span>
                          {!p.bankrupt &&
                            activeControllablePlayer &&
                            p.id !== activeControllablePlayer.id && (
                              <button
                                onClick={() => {
                                  setTradeTargetId(p.id);
                                  setActiveModal('TRADE');
                                }}
                                className="px-2 py-0.5 rounded bg-stone-800 border border-[#D4AF37]/40 text-[10px] font-semibold text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#0F0C0A] transition-colors cursor-pointer"
                                title={`Propose trade with ${p.name}`}
                              >
                                Trade
                              </button>
                            )}
                        </div>
                      </div>

                      {/* Richup.io Style Owned Property Color Pips */}
                      {ownedProps.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-2 pt-1.5 border-t border-white/10">
                          {ownedProps.map((pr) => {
                            const t = activeTiles[pr.tileIndex];
                            if (!t) return null;
                            return (
                              <button
                                key={pr.tileIndex}
                                onClick={() => {
                                  setSelectedTileIndex(pr.tileIndex);
                                  setActiveModal('DEED');
                                }}
                                className="h-3 px-1 rounded-xs flex items-center gap-0.5 border border-black/40 text-[8px] font-mono font-bold text-white shadow-xs hover:scale-110 transition-transform cursor-pointer"
                                style={{ backgroundColor: t.colorHex }}
                                title={`#${t.index} ${t.name} (${t.city})`}
                              >
                                {pr.houses > 0 && (
                                  <span>
                                    {pr.houses === 5 ? '★' : pr.houses}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quick Portfolio & Trade History Buttons */}
              <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setPortfolioTab('HOLDINGS');
                    setActiveModal('PORTFOLIO');
                  }}
                  className="py-1.5 px-2 rounded-lg bg-[#0F0C0A] border border-white/10 text-[11px] font-semibold text-stone-200 hover:border-[#D4AF37] cursor-pointer"
                >
                  Portfolio
                </button>
                <button
                  onClick={() => {
                    setPortfolioTab('TRADES');
                    setActiveModal('PORTFOLIO');
                  }}
                  className="py-1.5 px-2 rounded-lg bg-[#0F0C0A] border border-white/10 text-[11px] font-semibold text-stone-200 hover:border-[#D4AF37] cursor-pointer"
                >
                  Trades ({(gameState.tradeHistory || []).length})
                </button>
              </div>
            </div>

            {/* Card 2: Selected Space Quick Inspector */}
            <div className="rounded-xl bg-[#14100E]/95 border border-[#D4AF37]/30 p-3 shadow-xl space-y-2 text-[#FAF6F0] shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-stone-400">
                    Space #{selectedTile.index} · {selectedTile.city}
                  </div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate mt-0.5">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0 border border-white/25"
                      style={{ backgroundColor: selectedTile.colorHex }}
                    />
                    <span className="truncate">{selectedTile.name}</span>
                  </div>
                </div>
                {selectedTile.price && (
                  <span className="font-mono text-xs font-extrabold text-[#D4AF37] shrink-0">
                    ${selectedEffectivePrice}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px] text-stone-300">
                <span className="truncate">
                  Owner:{' '}
                  <strong className="text-white">
                    {selectedOwner
                      ? selectedOwner.name.split(' ')[0]
                      : selectedTile.price
                      ? 'Unowned'
                      : 'Sovereign'}
                  </strong>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {activeControllablePlayer &&
                    !activeControllablePlayer.isBot &&
                    canBuildHouseOnTile(
                      gameState,
                      activeControllablePlayer.id,
                      selectedTile.index
                    ).allowed && (
                      <button
                        onClick={() =>
                          dispatchAction({
                            type: 'BUILD_HOUSE',
                            playerId: activeControllablePlayer.id,
                            tileIndex: selectedTile.index,
                          })
                        }
                        className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-500 cursor-pointer"
                      >
                        Build (${selectedEffectiveHouseCost})
                      </button>
                    )}
                  <button
                    onClick={() => setActiveModal('DEED')}
                    className="px-2 py-1 rounded bg-[#0F0C0A] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#0F0C0A] text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    Deed & Intel
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 4. Monopoly Turn Resolution & Action Pop-up Modal (Buy Property, Rent Paid, Tax, Card Drawn, Detention, Bankruptcy) */}
      {appPhase === 'IN_GAME' &&
        gameState.status === 'PLAYING' &&
        gameState.turnNotice &&
        (() => {
          const notice = gameState.turnNotice;
          const noticePlayer = gameState.players.find(
            (p) => p.id === notice.playerId
          );
          const shouldShowNotice =
            showAllPlayerTurnPopups ||
            !noticePlayer?.isBot ||
            notice.kind === 'BANKRUPTCY' ||
            (notice.kind === 'RENT_PAID' &&
              notice.creditorId === localPlayerId);

          if (!shouldShowNotice) return null;

          const noticeTile = activeTiles[notice.tileIndex] || activeTiles[0];
          const noticeEffectivePrice = getEffectivePropertyPrice(
            gameState,
            noticeTile.index
          );

          return (
            <div
              className={`fixed inset-0 z-40 flex items-center justify-center p-4 ${
                isMyTurn
                  ? 'bg-black/65 pointer-events-auto'
                  : 'bg-black/35 pointer-events-none'
              }`}
            >
              <motion.div
                key={`notice-${notice.id}`}
                initial={{
                  opacity: 0,
                  scale: 0.88,
                  y: 20,
                  rotateZ: notice.kind === 'CARD_DRAWN' ? -2.5 : 0,
                }}
                animate={{ opacity: 1, scale: 1, y: 0, rotateZ: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                className="w-full max-w-md rounded-2xl bg-[#14100E] border-2 border-[#D4AF37] shadow-2xl p-5 text-[#FAF6F0] space-y-4 pointer-events-auto"
              >
                {/* Top Dice & Passed GO Status Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] font-bold uppercase">
                      {notice.kind === 'BUY_DECISION'
                        ? 'Available Title Deed'
                        : notice.kind === 'PROPERTY_BOUGHT'
                        ? 'Title Deed Purchased'
                        : notice.kind === 'RENT_PAID'
                        ? 'Rent Payment Notice'
                        : notice.kind === 'TAX_PAID'
                        ? 'Sovereign Tax Levy'
                        : notice.kind === 'CARD_DRAWN'
                        ? notice.cardDeck === 'CHANCE'
                          ? 'Fortune & Venture Card'
                          : 'Sovereign Treasury Card'
                        : notice.kind === 'JAIL_EVENT'
                        ? 'Compliance Detention'
                        : notice.kind === 'BANKRUPTCY'
                        ? 'Bankruptcy Declaration'
                        : 'Turn Resolution'}
                    </span>
                    {notice.passedGoBonus && (
                      <motion.span
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 18,
                        }}
                        className="px-2 py-0.5 rounded bg-emerald-900/90 text-emerald-300 font-mono font-bold"
                      >
                        +$200 Passed GO!
                      </motion.span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-stone-300">
                    <Dices className="w-4 h-4 text-[#D4AF37]" />
                    <span>
                      {gameState.dice[0]}+{gameState.dice[1]}=
                      {gameState.dice[0] + gameState.dice[1]}
                    </span>
                  </div>
                </div>

                {/* Official Title Deed Card Preview if BUY_DECISION */}
                {notice.kind === 'BUY_DECISION' ? (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.05, duration: 0.22 }}
                    className="rounded-xl bg-[#FAF6F0] text-[#14100E] border border-[#D4AF37] p-3.5 space-y-2.5"
                  >
                    <div
                      className="p-2.5 rounded-lg text-center text-white font-bold"
                      style={{ backgroundColor: noticeTile.colorHex }}
                    >
                      <div className="text-[10px] uppercase tracking-wider opacity-90">
                        TITLE DEED · {noticeTile.city}
                      </div>
                      <div
                        className="text-lg"
                        style={{ fontFamily: 'var(--font-fraunces), serif' }}
                      >
                        {noticeTile.name}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono border-b border-stone-300 pb-1.5">
                      <span>Acquisition Price:</span>
                      <span className="text-base font-extrabold text-stone-900">
                        ${noticeEffectivePrice}
                      </span>
                    </div>

                    {noticeTile.rent && noticeTile.rent.length > 0 && (
                      <div className="grid grid-cols-3 gap-1 text-[11px] font-mono text-center">
                        <div className="p-1 rounded bg-stone-200/80">
                          <div className="text-[9px] text-stone-500">
                            Base Rent
                          </div>
                          <div className="font-bold">${noticeTile.rent[0]}</div>
                        </div>
                        <div className="p-1 rounded bg-stone-200/80">
                          <div className="text-[9px] text-stone-500">
                            1 Villa
                          </div>
                          <div className="font-bold">
                            ${noticeTile.rent[1] ?? noticeTile.rent[0] * 2}
                          </div>
                        </div>
                        <div className="p-1 rounded bg-stone-200/80">
                          <div className="text-[9px] text-stone-500">Hotel</div>
                          <div className="font-bold text-red-700">
                            $
                            {noticeTile.rent[5] ??
                              noticeTile.rent[noticeTile.rent.length - 1]}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-300">
                      <span className="text-stone-600">
                        {noticePlayer?.name || 'Contender'}’s Treasury:
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        ${noticePlayer?.cash ?? currentPlayer?.cash ?? 0}
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  /* Standard Event / Rent / Tax / Card / Bankruptcy / Property Bought Card */
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.05, duration: 0.22 }}
                    className="p-4 rounded-xl bg-[#0F0C0A] border border-white/15 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-[#D4AF37] font-semibold">
                          {notice.subtitle}
                        </div>
                        <h3
                          className="text-xl font-bold text-white mt-0.5 flex items-center gap-2"
                          style={{ fontFamily: 'var(--font-fraunces), serif' }}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-xs shrink-0 border border-white/25"
                            style={{ backgroundColor: notice.tileColorHex }}
                          />
                          <span>{notice.title}</span>
                        </h3>
                      </div>

                      {typeof notice.amountDelta === 'number' &&
                        notice.amountDelta !== 0 && (
                          <motion.div
                            initial={{ scale: 0.5, opacity: 0, y: -8 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{
                              type: 'spring',
                              stiffness: 420,
                              damping: 18,
                              delay: 0.1,
                            }}
                            className={`px-2.5 py-1 rounded-lg font-mono text-sm font-extrabold shrink-0 ${
                              notice.amountDelta > 0
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : 'bg-red-950 text-red-300 border border-red-500/40'
                            }`}
                          >
                            {notice.amountDelta > 0
                              ? `+$${notice.amountDelta}`
                              : `-$${Math.abs(notice.amountDelta)}`}
                          </motion.div>
                        )}
                    </div>

                    <p className="text-xs text-stone-300 leading-relaxed">
                      {notice.description}
                    </p>

                    {noticePlayer && !noticePlayer.bankrupt && (
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                        <span className="text-stone-400">
                          {noticePlayer.name}’s Updated Balance:
                        </span>
                        <span className="font-mono font-bold text-[#D4AF37]">
                          ${noticePlayer.cash}
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Action Buttons */}
                {notice.kind === 'BUY_DECISION' &&
                isMyTurn &&
                gameState.phase === 'ACTION' ? (
                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      onClick={() => dispatchAction({ type: 'BUY_PROPERTY' })}
                      disabled={currentPlayer.cash < noticeEffectivePrice}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-500 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      Buy Property (${noticeEffectivePrice})
                    </button>
                    <button
                      onClick={() =>
                        dispatchAction({ type: 'DECLINE_PROPERTY' })
                      }
                      className="py-2.5 px-4 rounded-xl bg-stone-800 border border-[#D4AF37]/50 text-[#D4AF37] font-bold text-xs hover:bg-stone-700 transition-colors cursor-pointer"
                    >
                      Send to Auction
                    </button>
                  </div>
                ) : isMyTurn && gameState.phase === 'END_TURN' ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => dispatchAction({ type: 'END_TURN' })}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-[#D4AF37] text-[#0F0C0A] font-extrabold text-xs hover:bg-[#e5c247] transition-colors cursor-pointer"
                    >
                      {gameState.lastRollWasDoubles
                        ? 'Continue & Roll Again (Doubles!)'
                        : 'Acknowledge & End Turn →'}
                    </button>
                    <button
                      onClick={() =>
                        dispatchAction({ type: 'DISMISS_TURN_NOTICE' })
                      }
                      className="py-2.5 px-3 rounded-xl bg-stone-800 text-stone-200 font-semibold text-xs hover:bg-stone-700 transition-colors cursor-pointer"
                    >
                      Manage Estates First
                    </button>
                  </div>
                ) : !isMyTurn ? (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-xs">
                    <span className="text-stone-400">
                      <strong className="text-[#D4AF37]">
                        {noticePlayer?.name || 'Contender'}
                      </strong>{' '}
                      is in play (auto-advancing...)
                    </span>
                    <button
                      onClick={() =>
                        dispatchAction({ type: 'DISMISS_TURN_NOTICE' })
                      }
                      className="py-1.5 px-3 rounded-lg bg-stone-800 text-stone-200 font-semibold text-xs hover:bg-stone-700 transition-colors cursor-pointer shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      dispatchAction({ type: 'DISMISS_TURN_NOTICE' })
                    }
                    className="w-full py-2.5 px-4 rounded-xl bg-[#D4AF37] text-[#0F0C0A] font-extrabold text-xs hover:bg-[#e5c247] transition-colors cursor-pointer"
                  >
                    Continue
                  </button>
                )}
              </motion.div>
            </div>
          );
        })()}

      {/* 4B. Championship Victory Pop-up Modal (When status === 'GAME_OVER') */}
      {appPhase === 'IN_GAME' && gameState.status === 'GAME_OVER' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="w-full max-w-lg rounded-2xl bg-[#14100E] border-2 border-[#D4AF37] shadow-2xl p-6 text-[#FAF6F0] text-center space-y-4"
          >
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#D4AF37]">
              Grand Estates 3D Championship Complete
            </div>
            <h2
              className="text-3xl font-bold text-white"
              style={{ fontFamily: 'var(--font-fraunces), serif' }}
            >
              {gameState.players.find((p) => p.id === gameState.winnerId)
                ?.name || 'Sovereign Tycoon'}{' '}
              Wins!
            </h2>
            <p className="text-xs text-stone-300">
              All rival contenders have been eliminated into bankruptcy. The
              entire global landmark portfolio stands under one sovereign
              syndicate!
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setAppPhase('LOBBY_SETUP')}
                className="flex-1 py-3 px-4 rounded-xl bg-[#D4AF37] text-[#0F0C0A] font-extrabold text-xs hover:bg-[#e5c247]"
              >
                Configure New Match in Lobby
              </button>
              <button
                onClick={() => setAppPhase('START_MENU')}
                className="py-3 px-4 rounded-xl bg-stone-800 text-stone-200 font-semibold text-xs hover:bg-stone-700"
              >
                Start Menu
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 5. Live Auction Modal (Appears when phase === 'AUCTION') */}
      {gameState.phase === 'AUCTION' && gameState.activeAuction && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="w-full max-w-lg rounded-xl bg-[#14100E] border border-[#D4AF37]/40 shadow-2xl p-6 text-[#FAF6F0]"
          >
            {(() => {
              const auction = gameState.activeAuction!;
              const auctionTile =
                activeTiles[auction.tileIndex] || activeTiles[0];
              const activeBidderId =
                auction.activeBidderIds[auction.currentBidderIndex];
              const activeBidder = gameState.players.find(
                (p) => p.id === activeBidderId
              );
              const highestBidder = auction.highestBidderId
                ? gameState.players.find(
                    (p) => p.id === auction.highestBidderId
                  )
                : null;
              const minNextBid =
                auction.highestBidderId === null
                  ? auction.highestBid
                  : auction.highestBid + 10;

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <div className="text-xs text-[#D4AF37] font-medium flex items-center gap-1.5">
                        <Gavel className="w-4 h-4" />
                        Live Sotheby’s Style Deed Auction
                      </div>
                      <h2
                        className="text-xl font-bold mt-0.5"
                        style={{ fontFamily: 'var(--font-fraunces), serif' }}
                      >
                        {auctionTile.name} ({auctionTile.city})
                      </h2>
                    </div>
                    <div
                      className="text-right tabular-nums"
                      style={{ fontFamily: 'var(--font-mono), monospace' }}
                    >
                      <div className="text-xs text-stone-400">Current Bid</div>
                      <motion.div
                        key={auction.highestBid}
                        initial={{ scale: 1.25, color: '#34d399' }}
                        animate={{ scale: 1, color: '#D4AF37' }}
                        className="text-xl font-bold text-[#D4AF37]"
                      >
                        ${auction.highestBid}
                      </motion.div>
                    </div>
                  </div>

                  <div className="text-xs text-stone-300 flex items-center justify-between">
                    <span>
                      Leading Contender:{' '}
                      <strong className="text-white">
                        {highestBidder
                          ? highestBidder.name
                          : 'No bids placed yet'}
                      </strong>
                    </span>
                    <span className="tabular-nums">
                      Listed Value: ${auctionTile.price}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#0F0C0A] border border-white/10">
                    <div className="text-xs text-stone-400">
                      Floor Podium Turn:
                    </div>
                    <div className="text-sm font-semibold text-white mt-0.5 flex items-center justify-between">
                      <span>{activeBidder?.name}</span>
                      <span
                        className="text-[#D4AF37] tabular-nums"
                        style={{ fontFamily: 'var(--font-mono), monospace' }}
                      >
                        Balance: ${activeBidder?.cash || 0}
                      </span>
                    </div>
                  </div>

                  {activeBidder && !activeBidder.isBot ? (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button
                        onClick={() =>
                          dispatchAction({
                            type: 'AUCTION_BID',
                            playerId: activeBidder.id,
                            amount: minNextBid,
                          })
                        }
                        disabled={activeBidder.cash < minNextBid}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-[#D4AF37] text-[#0F0C0A] font-semibold text-xs hover:bg-[#e5c247] disabled:opacity-40 transition-colors whitespace-nowrap"
                      >
                        Bid ${minNextBid}
                      </button>
                      <button
                        onClick={() =>
                          dispatchAction({
                            type: 'AUCTION_BID',
                            playerId: activeBidder.id,
                            amount: minNextBid + 25,
                          })
                        }
                        disabled={activeBidder.cash < minNextBid + 25}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-stone-800 border border-[#D4AF37]/40 text-[#FAF6F0] font-semibold text-xs hover:bg-stone-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                      >
                        Jump Bid ${minNextBid + 25}
                      </button>
                      <button
                        onClick={() =>
                          dispatchAction({
                            type: 'AUCTION_PASS',
                            playerId: activeBidder.id,
                          })
                        }
                        className="py-2.5 px-4 rounded-lg bg-red-950/80 border border-red-500/40 text-red-200 font-semibold text-xs hover:bg-red-900 transition-colors whitespace-nowrap"
                      >
                        Pass Lot
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-[#D4AF37] py-2">
                      {activeBidder?.name} is evaluating the bid lot...
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        </div>
      )}

      {/* 6. Pending Trade Proposal Modal (For Human Recipients) */}
      {gameState.activeTrade && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 25 }}
            className="w-full max-w-lg rounded-xl bg-[#14100E] border border-[#D4AF37]/40 shadow-2xl p-6 text-[#FAF6F0] space-y-4"
          >
            {(() => {
              const trade = gameState.activeTrade!;
              const fromP = gameState.players.find(
                (p) => p.id === trade.fromPlayerId
              );
              const toP = gameState.players.find(
                (p) => p.id === trade.toPlayerId
              );
              const offerPropsVal = trade.offerProperties.reduce((sum, idx) => {
                const pr = gameState.properties[idx];
                const base = activeTiles[idx]?.price || 0;
                return sum + (pr?.mortgaged ? Math.floor(base * 0.5) : base);
              }, 0);
              const requestPropsVal = trade.requestProperties.reduce(
                (sum, idx) => {
                  const pr = gameState.properties[idx];
                  const base = activeTiles[idx]?.price || 0;
                  return sum + (pr?.mortgaged ? Math.floor(base * 0.5) : base);
                },
                0
              );
              const offerTotalVal = trade.offerCash + offerPropsVal;
              const requestTotalVal = trade.requestCash + requestPropsVal;
              const fromNetDelta = requestTotalVal - offerTotalVal;
              const toNetDelta = offerTotalVal - requestTotalVal;

              return (
                <>
                  <h3
                    className="text-lg font-bold"
                    style={{ fontFamily: 'var(--font-fraunces), serif' }}
                  >
                    Bilateral Trade Offer: {fromP?.name} → {toP?.name}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-[#0F0C0A] border border-white/10 space-y-1">
                      <div className="text-stone-400">
                        {fromP?.name} Offers (${offerTotalVal} total):
                      </div>
                      <div className="font-semibold text-emerald-400 tabular-nums">
                        ${trade.offerCash} Cash
                      </div>
                      {trade.offerProperties.map((idx) => (
                        <div key={idx} className="text-stone-200 flex justify-between gap-1">
                          <span>• {activeTiles[idx]?.name}</span>
                          <span className="text-stone-400 font-mono">${activeTiles[idx]?.price}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 rounded-lg bg-[#0F0C0A] border border-white/10 space-y-1">
                      <div className="text-stone-400">
                        In Exchange For ({toP?.name} · ${requestTotalVal} total):
                      </div>
                      <div className="font-semibold text-[#D4AF37] tabular-nums">
                        ${trade.requestCash} Cash
                      </div>
                      {trade.requestProperties.map((idx) => (
                        <div key={idx} className="text-stone-200 flex justify-between gap-1">
                          <span>• {activeTiles[idx]?.name}</span>
                          <span className="text-stone-400 font-mono">${activeTiles[idx]?.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Net Asset Impact Summary & Initiator vs Receiver Balance Bar */}
                  {(() => {
                    const fromCurrPropVal = Object.values(gameState.properties)
                      .filter((pr) => pr.ownerId === fromP?.id)
                      .reduce((sum, pr) => {
                        const base = activeTiles[pr.tileIndex]?.price || 0;
                        const deedVal = pr.mortgaged
                          ? Math.floor(base * 0.5)
                          : base;
                        const buildVal =
                          (pr.houses || 0) *
                          (activeTiles[pr.tileIndex]?.houseCost || 0);
                        return sum + deedVal + buildVal;
                      }, 0);
                    const toCurrPropVal = Object.values(gameState.properties)
                      .filter((pr) => pr.ownerId === toP?.id)
                      .reduce((sum, pr) => {
                        const base = activeTiles[pr.tileIndex]?.price || 0;
                        const deedVal = pr.mortgaged
                          ? Math.floor(base * 0.5)
                          : base;
                        const buildVal =
                          (pr.houses || 0) *
                          (activeTiles[pr.tileIndex]?.houseCost || 0);
                        return sum + deedVal + buildVal;
                      }, 0);
                    const fromPreTotal = (fromP?.cash || 0) + fromCurrPropVal;
                    const toPreTotal = (toP?.cash || 0) + toCurrPropVal;
                    const fromPostTotal = fromPreTotal + fromNetDelta;
                    const toPostTotal = toPreTotal + toNetDelta;
                    const combinedPost = Math.max(
                      1,
                      fromPostTotal + toPostTotal
                    );
                    const combinedPre = Math.max(1, fromPreTotal + toPreTotal);
                    const fromPrePct = Math.round(
                      (fromPreTotal / combinedPre) * 100
                    );
                    const fromPostPct = Math.max(
                      8,
                      Math.min(
                        92,
                        Math.round((fromPostTotal / combinedPost) * 100)
                      )
                    );
                    const toPostPct = 100 - fromPostPct;

                    return (
                      <div className="p-3.5 rounded-lg bg-[#0F0C0A] border border-[#D4AF37]/30 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-[#D4AF37]">
                            Initiator vs. Receiver Total Asset Balance
                          </span>
                          <span className="text-[11px] font-mono text-stone-400 tabular-nums">
                            Pre-trade split: {fromPrePct}% / {100 - fromPrePct}%
                          </span>
                        </div>

                        {/* Visual Progress Bar comparing Initiator vs Receiver Post-Trade Total Assets */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                            <span className="flex items-center gap-1.5">
                              <span className="text-stone-200 font-semibold">
                                Initiator ({fromP?.name}): ${fromPostTotal} (
                                {fromPostPct}%)
                              </span>
                              <span
                                className={`font-bold ${
                                  fromNetDelta > 0
                                    ? 'text-emerald-400'
                                    : fromNetDelta < 0
                                    ? 'text-red-400'
                                    : 'text-[#D4AF37]'
                                }`}
                              >
                                {fromNetDelta > 0
                                  ? `+$${fromNetDelta}`
                                  : fromNetDelta < 0
                                  ? `-$${Math.abs(fromNetDelta)}`
                                  : '$0'}
                              </span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span
                                className={`font-bold ${
                                  toNetDelta > 0
                                    ? 'text-emerald-400'
                                    : toNetDelta < 0
                                    ? 'text-red-400'
                                    : 'text-[#D4AF37]'
                                }`}
                              >
                                {toNetDelta > 0
                                  ? `+$${toNetDelta}`
                                  : toNetDelta < 0
                                  ? `-$${Math.abs(toNetDelta)}`
                                  : '$0'}
                              </span>
                              <span className="text-stone-200 font-semibold">
                                Receiver ({toP?.name}): ${toPostTotal} (
                                {toPostPct}%)
                              </span>
                            </span>
                          </div>

                          <div
                            role="progressbar"
                            aria-valuenow={fromPostPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Initiator versus Receiver total asset balance comparison"
                            className="relative w-full h-3 rounded-md bg-[#14100E] border border-white/15 overflow-hidden flex"
                          >
                            <div
                              className={`h-full transition-all duration-200 ${
                                fromNetDelta > 0
                                  ? 'bg-emerald-500'
                                  : fromNetDelta < 0
                                  ? 'bg-red-500'
                                  : 'bg-[#D4AF37]'
                              }`}
                              style={{ width: `${fromPostPct}%` }}
                            />
                            <div
                              className={`h-full transition-all duration-200 border-l border-[#0F0C0A] ${
                                toNetDelta > 0
                                  ? 'bg-emerald-500'
                                  : toNetDelta < 0
                                  ? 'bg-red-500'
                                  : 'bg-stone-600'
                              }`}
                              style={{ width: `${toPostPct}%` }}
                            />
                            {/* Pre-Trade Baseline Marker */}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none"
                              style={{ left: `${fromPrePct}%` }}
                              title={`Pre-trade balance marker: ${fromPrePct}% / ${100 - fromPrePct}%`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() =>
                        dispatchAction({ type: 'RESPOND_TRADE', accept: true })
                      }
                      className="flex-1 py-2 px-4 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500 transition-colors"
                    >
                      Accept Deal
                    </button>
                    <button
                      onClick={() =>
                        dispatchAction({ type: 'RESPOND_TRADE', accept: false })
                      }
                      className="flex-1 py-2 px-4 rounded-lg bg-red-950 border border-red-500/40 text-red-200 font-semibold text-xs hover:bg-red-900 transition-colors"
                    >
                      Decline Deal
                    </button>
                  </div>
                </>
              );
            })()}
          </motion.div>
        </div>
      )}

      {/* 7. Secondary Modal Drawers (Deed Inspector + Google Search, Macro Events, Portfolio, Trade, AI Host, Lobby, Settings) */}
      {activeModal !== 'NONE' && (
        <div
          onClick={() => setActiveModal('NONE')}
          className="fixed inset-0 top-[53px] z-50 bg-black/75 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[85vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#D4AF37_#14100E] rounded-2xl bg-[#14100E] border border-[#D4AF37]/45 shadow-2xl p-6 text-[#FAF6F0]"
          >
            {/* DEED INSPECTOR & GOOGLE SEARCH LANDMARK INTEL */}
            {activeModal === 'DEED' && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="text-xs text-stone-400">
                      Space #{selectedTile.index} · {selectedTile.city},{' '}
                      {selectedTile.country} ·{' '}
                      {COLOR_GROUP_NAMES[selectedTile.group]}
                    </div>
                    <h2
                      className="text-2xl font-bold mt-1 flex items-center gap-3"
                      style={{ fontFamily: 'var(--font-fraunces), serif' }}
                    >
                      <span
                        className="inline-block w-4 h-4 rounded-sm shrink-0 border border-white/20"
                        style={{ backgroundColor: selectedTile.colorHex }}
                      />
                      {selectedTile.name}
                    </h2>
                    <p className="text-xs text-stone-300 mt-1">
                      {selectedTile.description}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveModal('NONE')}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left column: Official Title Deed & Building Controls */}
                  <div className="p-4 rounded-xl bg-[#FAF6F0] text-[#14100E] border border-[#D4AF37] space-y-3">
                    <div
                      className="p-2.5 rounded-lg text-center text-white font-bold"
                      style={{ backgroundColor: selectedTile.colorHex }}
                    >
                      <div className="text-[11px] opacity-90">
                        TITLE DEED · {selectedTile.city.toUpperCase()}
                      </div>
                      <div
                        className="text-lg"
                        style={{ fontFamily: 'var(--font-fraunces), serif' }}
                      >
                        {selectedTile.shortName}
                      </div>
                    </div>

                    {selectedTile.price ? (
                      <div
                        className="text-xs space-y-1.5 tabular-nums"
                        style={{ fontFamily: 'var(--font-mono), monospace' }}
                      >
                        <div className="flex justify-between py-1 border-b border-stone-300 font-semibold">
                          <span>Market Acquisition Price</span>
                          <span>
                            ${selectedEffectivePrice}
                            {selectedEffectivePrice !== selectedTile.price && (
                              <span className="text-stone-500 line-through ml-1.5">
                                ${selectedTile.price}
                              </span>
                            )}
                          </span>
                        </div>
                        {selectedTile.rent &&
                          selectedTile.type === 'PROPERTY' && (
                            <>
                              <div className="flex justify-between">
                                <span>Base Site Rent</span>
                                <span>${selectedTile.rent[0]}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>With 1 Villa</span>
                                <span>${selectedTile.rent[1]}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>With 2 Villas</span>
                                <span>${selectedTile.rent[2]}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>With 3 Villas</span>
                                <span>${selectedTile.rent[3]}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>With 4 Villas</span>
                                <span>${selectedTile.rent[4]}</span>
                              </div>
                              <div className="flex justify-between font-bold text-red-700">
                                <span>With Grand Hotel</span>
                                <span>${selectedTile.rent[5]}</span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-stone-300">
                                <span>Villa / Hotel Construction</span>
                                <span>${selectedEffectiveHouseCost} each</span>
                              </div>
                            </>
                          )}
                        <div className="flex justify-between pt-1 border-t border-stone-300 text-stone-600">
                          <span>Current Title Holder</span>
                          <span className="font-bold text-stone-900">
                            {selectedOwner
                              ? `${selectedOwner.name}${
                                  selectedPropState?.mortgaged
                                    ? ' (Mortgaged)'
                                    : ''
                                }`
                              : 'Unowned (Sovereign Bank)'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-700 py-4 text-center">
                        Special Sovereign Board Space — Not a private deed.
                      </p>
                    )}

                    {/* Build / Sell / Mortgage actions if owned by active player */}
                    {selectedPropState &&
                      selectedPropState.ownerId ===
                        activeControllablePlayer?.id && (
                        <div className="pt-2 border-t border-stone-300 flex flex-wrap gap-2">
                          {selectedTile.type === 'PROPERTY' && (
                            <>
                              <button
                                onClick={() =>
                                  dispatchAction({
                                    type: 'BUILD_HOUSE',
                                    playerId: activeControllablePlayer.id,
                                    tileIndex: selectedTile.index,
                                  })
                                }
                                disabled={
                                  !canBuildHouseOnTile(
                                    gameState,
                                    activeControllablePlayer.id,
                                    selectedTile.index
                                  ).allowed
                                }
                                className="flex-1 py-1.5 px-3 rounded bg-[#14100E] text-[#D4AF37] text-xs font-semibold disabled:opacity-40"
                                title="Shortcut: Press 'B' anytime while this property is selected"
                              >
                                [B] Build (+${selectedEffectiveHouseCost})
                              </button>
                              <button
                                onClick={() =>
                                  dispatchAction({
                                    type: 'SELL_HOUSE',
                                    playerId: activeControllablePlayer.id,
                                    tileIndex: selectedTile.index,
                                  })
                                }
                                disabled={selectedPropState.houses <= 0}
                                className="py-1.5 px-3 rounded bg-stone-200 text-stone-900 text-xs font-semibold disabled:opacity-40"
                              >
                                Sell Building
                              </button>
                            </>
                          )}
                          <button
                            onClick={() =>
                              dispatchAction({
                                type: 'TOGGLE_MORTGAGE',
                                playerId: activeControllablePlayer.id,
                                tileIndex: selectedTile.index,
                              })
                            }
                            disabled={selectedPropState.houses > 0}
                            className="w-full py-1.5 px-3 rounded border border-stone-400 text-stone-800 text-xs font-semibold hover:bg-stone-200 disabled:opacity-40"
                          >
                            {selectedPropState.mortgaged
                              ? 'Unmortgage Deed'
                              : 'Mortgage Deed'}
                          </button>
                        </div>
                      )}
                  </div>

                  {/* Right column: Live Google Search Grounding City & Landmark Intelligence */}
                  <div className="p-4 rounded-xl bg-[#0F0C0A] border border-white/10 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#D4AF37] flex items-center gap-1.5">
                          <Globe className="w-4 h-4" />
                          Google Search Landmark Intelligence
                        </span>
                        <button
                          onClick={() => fetchLandmarkIntel(selectedTile.index)}
                          disabled={loadingIntelKey === selectedIntelKey}
                          className="px-3 py-1 rounded-lg bg-[#D4AF37] text-[#0F0C0A] text-xs font-semibold hover:bg-[#e5c247] disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {loadingIntelKey === selectedIntelKey
                            ? 'Searching Web...'
                            : landmarkIntelCache[selectedIntelKey]
                            ? 'Refresh Intel'
                            : 'Fetch Live City Intel'}
                        </button>
                      </div>

                      {intelError && (
                        <p className="text-xs text-red-400">{intelError}</p>
                      )}

                      {landmarkIntelCache[selectedIntelKey] ? (
                        <div className="space-y-3 text-xs text-stone-200 leading-relaxed max-h-60 overflow-y-auto pr-1">
                          <div className="markdown-body prose prose-invert prose-xs max-w-none">
                            <Markdown>
                              {landmarkIntelCache[selectedIntelKey].text}
                            </Markdown>
                          </div>
                          {landmarkIntelCache[selectedIntelKey].sources.length >
                            0 && (
                            <div className="pt-2 border-t border-white/10 space-y-1">
                              <div className="text-[11px] text-stone-400 font-semibold">
                                Verified Web Sources:
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {landmarkIntelCache[
                                  selectedIntelKey
                                ].sources.map((src, i) => (
                                  <a
                                    key={i}
                                    href={src.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-[#D4AF37] underline hover:text-white truncate max-w-[220px]"
                                  >
                                    {src.title}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 leading-relaxed pt-2">
                          Click <strong>Fetch Live City Intel</strong> to query{' '}
                          <code>gemini-3.8-flash</code> with Google Search
                          grounding for up-to-date cultural history, luxury real
                          estate benchmarks, and trivia about{' '}
                          <strong>{selectedTile.name}</strong> in{' '}
                          {selectedTile.city}.
                        </p>
                      )}
                    </div>

                    {/* Navigate through all active spaces quickly */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                      <button
                        onClick={() =>
                          setSelectedTileIndex(
                            (i) =>
                              (i - 1 + activeTiles.length) % activeTiles.length
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-stone-800 text-xs text-stone-200 hover:bg-stone-700"
                      >
                        ← Prev Space
                      </button>
                      <span className="text-xs text-stone-400 tabular-nums">
                        Tile {selectedTile.index + 1} of {activeTiles.length}
                      </span>
                      <button
                        onClick={() =>
                          setSelectedTileIndex(
                            (i) => (i + 1) % activeTiles.length
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-stone-800 text-xs text-stone-200 hover:bg-stone-700"
                      >
                        Next Space →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DYNAMIC GLOBAL MACRO EVENTS DRAWER (Engine-Managed Only) */}
            {activeModal === 'EVENTS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <div className="text-xs text-[#D4AF37] font-medium">
                      Autonomous Macro-Economic Engine · Next Scheduled Event in{' '}
                      {gameState.turnsUntilNextEvent} Turns
                    </div>
                    <h2
                      className="text-xl font-bold"
                      style={{ fontFamily: 'var(--font-fraunces), serif' }}
                    >
                      Global Market Events & Forecast
                    </h2>
                  </div>
                  <button
                    onClick={() => setActiveModal('NONE')}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {gameState.activeGlobalEvent ? (
                  <div className="p-4 rounded-xl bg-[#0F0C0A] border border-[#D4AF37]/50 space-y-1">
                    <div className="text-xs text-[#D4AF37] font-semibold">
                      CURRENTLY ACTIVE MARKET MODIFIER (
                      {gameState.activeGlobalEvent.remainingTurns} Turns
                      Remaining)
                    </div>
                    <div className="text-base font-bold text-white">
                      {gameState.activeGlobalEvent.event.title}
                    </div>
                    <p className="text-xs text-stone-300">
                      {gameState.activeGlobalEvent.event.summary}
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-[#0F0C0A] border border-white/10 text-xs text-stone-300">
                    Market conditions are currently at baseline. The game engine
                    automatically triggers a random macro-economic event every 4
                    completed turns ({gameState.turnsUntilNextEvent} turns
                    remaining until next market shift).
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {GLOBAL_EVENTS.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3.5 rounded-xl bg-[#0F0C0A] border border-white/10 flex flex-col justify-between space-y-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#D4AF37]">
                            {ev.impactLabel}
                          </span>
                          <span className="text-[10px] font-mono text-stone-400 bg-[#14100E] px-2 py-0.5 rounded border border-white/10">
                            Engine Managed
                          </span>
                        </div>
                        <h3
                          className="text-sm font-bold text-white"
                          style={{ fontFamily: 'var(--font-fraunces), serif' }}
                        >
                          {ev.title}
                        </h3>
                        <p className="text-xs text-stone-400 leading-relaxed">
                          {ev.summary}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PORTFOLIO, BUILDING MANAGER, TURN HISTORY & TRADE HISTORY */}
            {activeModal === 'PORTFOLIO' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <div className="text-xs text-[#D4AF37] font-medium flex flex-wrap items-center gap-2">
                      <span>Sovereign Asset Ledger, Construction & Activity</span>
                      <span aria-hidden="true" className="text-stone-500">
                        ·
                      </span>
                      <button
                        onClick={() => setActiveModal('TRADE')}
                        className="text-[#D4AF37] underline underline-offset-4 hover:text-[#e5c247] transition-colors font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Open Trade Desk →
                      </button>
                    </div>
                    <h2
                      className="text-xl font-bold text-balance mt-0.5"
                      style={{ fontFamily: 'var(--font-fraunces), serif' }}
                    >
                      {portfolioTab === 'HOLDINGS'
                        ? `Player Holdings & Villas (${activeBoardConfig.shortLabel})`
                        : portfolioTab === 'HISTORY'
                        ? `Turn History · Last 20 Actions (${activeBoardConfig.shortLabel})`
                        : `Bilateral Trade History (${activeBoardConfig.shortLabel})`}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0F0C0A] border border-white/10">
                      <button
                        onClick={() => setPortfolioTab('HOLDINGS')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                          portfolioTab === 'HOLDINGS'
                            ? 'bg-[#D4AF37] text-[#0F0C0A]'
                            : 'text-stone-300 hover:text-white'
                        }`}
                      >
                        Holdings & Villas
                      </button>
                      <button
                        onClick={() => setPortfolioTab('HISTORY')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                          portfolioTab === 'HISTORY'
                            ? 'bg-[#D4AF37] text-[#0F0C0A]'
                            : 'text-stone-300 hover:text-white'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Turn History ({Math.min(20, gameState.logs.length)})</span>
                      </button>
                      <button
                        onClick={() => setPortfolioTab('TRADES')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                          portfolioTab === 'TRADES'
                            ? 'bg-[#D4AF37] text-[#0F0C0A]'
                            : 'text-stone-300 hover:text-white'
                        }`}
                      >
                        <span>
                          Trade History ({(gameState.tradeHistory || []).length})
                        </span>
                      </button>
                    </div>
                    <button
                      onClick={() => setActiveModal('NONE')}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 cursor-pointer"
                      aria-label="Close Portfolio Modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {portfolioTab === 'HOLDINGS' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {gameState.players.map((p) => {
                      const owned = Object.values(gameState.properties).filter(
                        (pr) => pr.ownerId === p.id
                      );
                      return (
                        <div
                          key={p.id}
                          className="p-4 rounded-xl bg-[#0F0C0A] border border-white/10 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-xs shrink-0"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="font-bold text-sm">{p.name}</span>
                              {p.bankrupt && (
                                <span className="text-[11px] font-semibold text-red-400">
                                  · Bankrupt
                                </span>
                              )}
                            </div>
                            <span
                              className="text-sm font-bold text-[#D4AF37] tabular-nums"
                              style={{
                                fontFamily: 'var(--font-mono), monospace',
                              }}
                            >
                              ${p.cash}
                            </span>
                          </div>
                          <div className="text-xs text-stone-400 tabular-nums">
                            Position: {activeTiles[p.position]?.name} ·{' '}
                            {owned.length} Deeds Owned
                          </div>
                          {owned.length > 0 ? (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {owned.map((pr) => {
                                const t = activeTiles[pr.tileIndex];
                                if (!t) return null;
                                const canBuild = canBuildHouseOnTile(
                                  gameState,
                                  p.id,
                                  pr.tileIndex
                                ).allowed;
                                return (
                                  <div
                                    key={pr.tileIndex}
                                    className="flex items-center justify-between text-xs p-1.5 rounded bg-[#14100E] border border-white/5"
                                  >
                                    <button
                                      onClick={() => {
                                        setSelectedTileIndex(pr.tileIndex);
                                        setActiveModal('DEED');
                                      }}
                                      className="flex items-center gap-2 text-left hover:text-[#D4AF37] cursor-pointer"
                                    >
                                      <span
                                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                                        style={{ backgroundColor: t.colorHex }}
                                      />
                                      <span className="truncate max-w-[150px]">
                                        {t.shortName}
                                      </span>
                                      {pr.houses > 0 && (
                                        <span className="text-emerald-400 font-mono tabular-nums">
                                          ·{' '}
                                          {pr.houses === 5
                                            ? 'HOTEL'
                                            : `${pr.houses}V`}
                                        </span>
                                      )}
                                      {pr.mortgaged && (
                                        <span className="text-red-400">
                                          · Mortgaged
                                        </span>
                                      )}
                                    </button>
                                    {!p.isBot && canBuild && (
                                      <button
                                        onClick={() =>
                                          dispatchAction({
                                            type: 'BUILD_HOUSE',
                                            playerId: p.id,
                                            tileIndex: pr.tileIndex,
                                          })
                                        }
                                        className="px-2 py-0.5 rounded bg-[#D4AF37] text-[#0F0C0A] font-semibold text-[11px] whitespace-nowrap shrink-0 cursor-pointer"
                                      >
                                        +Build
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-stone-500 italic">
                              No landmarks acquired yet.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : portfolioTab === 'HISTORY' ? (
                  /* TURN HISTORY VIEW (LAST 20 ACTIONS) */
                  (() => {
                    const last20Logs = gameState.logs.slice(0, 20);
                    const rollCount = last20Logs.filter(
                      (l) => l.type === 'ROLL'
                    ).length;
                    const buyCount = last20Logs.filter(
                      (l) =>
                        l.type === 'BUY' ||
                        l.type === 'BUILD' ||
                        l.type === 'AUCTION'
                    ).length;
                    const rentCount = last20Logs.filter(
                      (l) => l.type === 'RENT'
                    ).length;
                    const otherCount =
                      last20Logs.length - rollCount - buyCount - rentCount;

                    const filteredLogs = last20Logs.filter((entry) => {
                      if (historyCategoryFilter === 'ALL') return true;
                      if (historyCategoryFilter === 'ROLL')
                        return entry.type === 'ROLL';
                      if (historyCategoryFilter === 'BUY')
                        return (
                          entry.type === 'BUY' ||
                          entry.type === 'BUILD' ||
                          entry.type === 'AUCTION'
                        );
                      if (historyCategoryFilter === 'RENT')
                        return entry.type === 'RENT';
                      return (
                        entry.type !== 'ROLL' &&
                        entry.type !== 'BUY' &&
                        entry.type !== 'BUILD' &&
                        entry.type !== 'AUCTION' &&
                        entry.type !== 'RENT'
                      );
                    });

                    const getActionCategoryLabel = (
                      type: GameLogEntry['type']
                    ) => {
                      switch (type) {
                        case 'ROLL':
                          return { label: 'Dice Roll', color: 'text-sky-300' };
                        case 'BUY':
                          return {
                            label: 'Purchase',
                            color: 'text-emerald-300',
                          };
                        case 'BUILD':
                          return {
                            label: 'Development',
                            color: 'text-teal-300',
                          };
                        case 'AUCTION':
                          return { label: 'Auction', color: 'text-amber-300' };
                        case 'RENT':
                          return {
                            label: 'Rent / Fee',
                            color: 'text-rose-300',
                          };
                        case 'CARD':
                          return {
                            label: 'Decree Card',
                            color: 'text-purple-300',
                          };
                        case 'JAIL':
                          return {
                            label: 'Detention',
                            color: 'text-orange-300',
                          };
                        case 'TRADE':
                          return {
                            label: 'Trade Deal',
                            color: 'text-indigo-300',
                          };
                        case 'EVENT':
                          return {
                            label: 'Macro Event',
                            color: 'text-[#D4AF37]',
                          };
                        case 'BANKRUPT':
                          return {
                            label: 'Bankruptcy',
                            color: 'text-red-400',
                          };
                        default:
                          return { label: 'System', color: 'text-stone-400' };
                      }
                    };

                    return (
                      <div className="space-y-3">
                        {/* Summary Metrics Strip for the Last 20 Actions */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="p-2.5 rounded-xl bg-[#0F0C0A] border border-white/10 flex items-center justify-between">
                            <div>
                              <div className="text-[11px] font-medium text-stone-400">
                                Dice Rolls
                              </div>
                              <div className="text-base font-bold text-sky-300 font-mono tabular-nums">
                                {rollCount}
                              </div>
                            </div>
                            <Dices className="w-4 h-4 text-sky-400/70" />
                          </div>
                          <div className="p-2.5 rounded-xl bg-[#0F0C0A] border border-white/10 flex items-center justify-between">
                            <div>
                              <div className="text-[11px] font-medium text-stone-400">
                                Deeds & Builds
                              </div>
                              <div className="text-base font-bold text-emerald-300 font-mono tabular-nums">
                                {buyCount}
                              </div>
                            </div>
                            <TrendingUp className="w-4 h-4 text-emerald-400/70" />
                          </div>
                          <div className="p-2.5 rounded-xl bg-[#0F0C0A] border border-white/10 flex items-center justify-between">
                            <div>
                              <div className="text-[11px] font-medium text-stone-400">
                                Rent Payments
                              </div>
                              <div className="text-base font-bold text-rose-300 font-mono tabular-nums">
                                {rentCount}
                              </div>
                            </div>
                            <TrendingDown className="w-4 h-4 text-rose-400/70" />
                          </div>
                          <div className="p-2.5 rounded-xl bg-[#0F0C0A] border border-white/10 flex items-center justify-between">
                            <div>
                              <div className="text-[11px] font-medium text-stone-400">
                                Cards & Events
                              </div>
                              <div className="text-base font-bold text-[#D4AF37] font-mono tabular-nums">
                                {otherCount}
                              </div>
                            </div>
                            <Clock className="w-4 h-4 text-[#D4AF37]/70" />
                          </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(
                              [
                                [
                                  'ALL',
                                  `All Last ${last20Logs.length} Actions`,
                                ],
                                ['ROLL', `Rolls (${rollCount})`],
                                ['BUY', `Purchases & Builds (${buyCount})`],
                                ['RENT', `Rent Payments (${rentCount})`],
                                ['OTHER', `Cards & Events (${otherCount})`],
                              ] as const
                            ).map(([fKey, fLabel]) => (
                              <button
                                key={fKey}
                                onClick={() => setHistoryCategoryFilter(fKey)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                  historyCategoryFilter === fKey
                                    ? 'bg-[#D4AF37] text-[#0F0C0A]'
                                    : 'bg-[#0F0C0A] text-stone-300 border border-white/10 hover:border-white/30'
                                }`}
                              >
                                {fLabel}
                              </button>
                            ))}
                          </div>
                          <span className="text-[11px] font-mono text-stone-400 tabular-nums">
                            Completed Turns: {gameState.completedTurns}
                          </span>
                        </div>

                        {/* List of the Last 20 Actions (Scrolled cleanly by the parent modal container) */}
                        <div className="space-y-2">
                          {filteredLogs.length === 0 ? (
                            <div className="p-6 rounded-xl bg-[#0F0C0A] border border-white/10 text-center text-xs text-stone-400 italic">
                              No matching actions recorded in the last 20 turns
                              yet.
                            </div>
                          ) : (
                            filteredLogs.map((entry) => {
                              const overallIdx = last20Logs.findIndex(
                                (item) => item.id === entry.id
                              );
                              const catMeta = getActionCategoryLabel(
                                entry.type
                              );
                              const matchedPlayer = gameState.players.find(
                                (p) => entry.text.startsWith(p.name)
                              );
                              const formattedTime = new Date(
                                entry.timestamp
                              ).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              });

                              return (
                                <div
                                  key={entry.id}
                                  className={`p-3 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                                    overallIdx === 0
                                      ? 'bg-[#1B1510] border-[#D4AF37]/50'
                                      : 'bg-[#0F0C0A] border-white/10'
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    {matchedPlayer && (
                                      <span
                                        className="w-2.5 h-2.5 rounded-xs shrink-0 mt-1"
                                        style={{
                                          backgroundColor: matchedPlayer.color,
                                        }}
                                        title={matchedPlayer.name}
                                      />
                                    )}
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400 tabular-nums">
                                        <span className="font-mono text-stone-500">
                                          #{overallIdx + 1}
                                        </span>
                                        <span aria-hidden="true">·</span>
                                        <span
                                          className={`font-semibold ${catMeta.color}`}
                                        >
                                          {catMeta.label}
                                        </span>
                                        <span aria-hidden="true">·</span>
                                        <span className="font-mono">
                                          {formattedTime}
                                        </span>
                                        {overallIdx === 0 && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span className="font-bold text-[#D4AF37]">
                                              Latest Action
                                            </span>
                                          </>
                                        )}
                                      </div>
                                      <p className="text-xs text-stone-100 leading-relaxed break-words">
                                        {entry.text}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* BILATERAL TRADE HISTORY VIEW */
                  (() => {
                    const allTrades = gameState.tradeHistory || [];
                    const filteredTrades = allTrades.filter((t) => {
                      if (tradeHistoryPlayerFilter === 'ALL') return true;
                      return (
                        t.fromPlayerId === tradeHistoryPlayerFilter ||
                        t.toPlayerId === tradeHistoryPlayerFilter
                      );
                    });

                    const totalVolume = allTrades.reduce(
                      (sum, t) => sum + t.offerTotalValue + t.requestTotalValue,
                      0
                    );
                    const totalDeedsSwapped = allTrades.reduce(
                      (sum, t) =>
                        sum +
                        t.offerProperties.length +
                        t.requestProperties.length,
                      0
                    );
                    const peakSwing = allTrades.reduce(
                      (max, t) =>
                        Math.max(max, Math.abs(t.fromNetAssetDelta)),
                      0
                    );

                    return (
                      <div className="space-y-3">
                        {/* Summary Metrics Strip for Completed Bilateral Trades */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="p-2.5 rounded-xl bg-[#0F0C0A] border border-white/10">
                            <div className="text-[11px] font-medium text-stone-400">
                              Completed Deals
                            </div>
                            <div className="text-base font-bold text-[#D4AF37] font-mono tabular-nums mt-0.5">
                              {allTrades.length}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-[#0F0C0A] border border-white/10">
                            <div className="text-[11px] font-medium text-stone-400">
                              Gross Volume Traded
                            </div>
                            <div className="text-base font-bold text-emerald-300 font-mono tabular-nums mt-0.5">
                              ${totalVolume}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-[#0F0C0A] border border-white/10">
                            <div className="text-[11px] font-medium text-stone-400">
                              Deeds Transferred
                            </div>
                            <div className="text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
                              {totalDeedsSwapped}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-[#0F0C0A] border border-white/10">
                            <div className="text-[11px] font-medium text-stone-400">
                              Largest Net Asset Swing
                            </div>
                            <div className="text-base font-bold text-amber-300 font-mono tabular-nums mt-0.5">
                              ${peakSwing}
                            </div>
                          </div>
                        </div>

                        {/* Participant Filter Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() => setTradeHistoryPlayerFilter('ALL')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                tradeHistoryPlayerFilter === 'ALL'
                                  ? 'bg-[#D4AF37] text-[#0F0C0A]'
                                  : 'bg-[#0F0C0A] text-stone-300 border border-white/10 hover:border-white/30'
                              }`}
                            >
                              All Syndicates ({allTrades.length})
                            </button>
                            {gameState.players.map((p) => {
                              const pTradeCount = allTrades.filter(
                                (t) =>
                                  t.fromPlayerId === p.id ||
                                  t.toPlayerId === p.id
                              ).length;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() =>
                                    setTradeHistoryPlayerFilter(p.id)
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                                    tradeHistoryPlayerFilter === p.id
                                      ? 'bg-[#D4AF37] text-[#0F0C0A]'
                                      : 'bg-[#0F0C0A] text-stone-300 border border-white/10 hover:border-white/30'
                                  }`}
                                >
                                  <span
                                    className="w-2 h-2 rounded-xs shrink-0"
                                    style={{ backgroundColor: p.color }}
                                  />
                                  <span>
                                    {p.name.split(' ')[0]} ({pTradeCount})
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <button
                            onClick={() => setActiveModal('TRADE')}
                            className="px-3 py-1 rounded-lg bg-[#D4AF37] text-[#0F0C0A] text-xs font-semibold hover:bg-[#e5c247] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            + Propose New Trade
                          </button>
                        </div>

                        {/* Completed Bilateral Trades List (Scrolled cleanly by the parent modal container) */}
                        <div className="space-y-2.5">
                          {filteredTrades.length === 0 ? (
                            <div className="p-6 rounded-xl bg-[#0F0C0A] border border-white/10 text-center space-y-2">
                              <p className="text-xs text-stone-400">
                                {allTrades.length === 0
                                  ? 'No bilateral trades have been completed in this match yet.'
                                  : 'No completed trades match the selected syndicate filter.'}
                              </p>
                              <button
                                onClick={() => setActiveModal('TRADE')}
                                className="px-3.5 py-1.5 rounded-lg bg-[#D4AF37] text-[#0F0C0A] text-xs font-semibold hover:bg-[#e5c247] transition-colors cursor-pointer"
                              >
                                Open Mergers & Acquisitions Trade Desk
                              </button>
                            </div>
                          ) : (
                            filteredTrades.map((record, idx) => {
                              const tradeDate = new Date(record.timestamp);
                              const dateStr = tradeDate.toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              });
                              const timeStr = tradeDate.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              });
                              const dealNumber = allTrades.length - idx;

                              return (
                                <div
                                  key={record.id}
                                  className="p-4 rounded-xl bg-[#0F0C0A] border border-white/10 space-y-3"
                                >
                                  {/* Unboxed Metadata Header: Deal #, Date, Time, Turn, Participating Players */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <span className="font-mono font-bold text-[#D4AF37] tabular-nums">
                                        Deal #{dealNumber}
                                      </span>
                                      <span
                                        aria-hidden="true"
                                        className="text-stone-600"
                                      >
                                        ·
                                      </span>
                                      <span className="flex items-center gap-1.5 font-semibold text-white">
                                        <span
                                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                                          style={{
                                            backgroundColor:
                                              record.fromPlayerColor,
                                          }}
                                        />
                                        <span>{record.fromPlayerName}</span>
                                      </span>
                                      <span className="text-stone-400">⇄</span>
                                      <span className="flex items-center gap-1.5 font-semibold text-white">
                                        <span
                                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                                          style={{
                                            backgroundColor:
                                              record.toPlayerColor,
                                          }}
                                        />
                                        <span>{record.toPlayerName}</span>
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-mono tabular-nums">
                                      <span>Turn #{record.turnNumber}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{dateStr}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{timeStr}</span>
                                    </div>
                                  </div>

                                  {/* Bilateral Package & Net Asset Change Grid */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    {/* Initiator Column */}
                                    <div className="p-3 rounded-lg bg-[#14100E] border border-white/5 space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-stone-200 flex items-center gap-1.5 truncate">
                                          <span
                                            className="w-2 h-2 rounded-xs shrink-0"
                                            style={{
                                              backgroundColor:
                                                record.fromPlayerColor,
                                            }}
                                          />
                                          <span className="truncate">
                                            {record.fromPlayerName}
                                          </span>
                                        </span>
                                        <span
                                          className={`font-mono font-bold tabular-nums shrink-0 ${
                                            record.fromNetAssetDelta > 0
                                              ? 'text-emerald-400'
                                              : record.fromNetAssetDelta < 0
                                              ? 'text-red-400'
                                              : 'text-[#D4AF37]'
                                          }`}
                                        >
                                          Net Asset Change:{' '}
                                          {record.fromNetAssetDelta > 0
                                            ? `+$${record.fromNetAssetDelta}`
                                            : record.fromNetAssetDelta < 0
                                            ? `-$${Math.abs(record.fromNetAssetDelta)}`
                                            : '$0'}
                                        </span>
                                      </div>

                                      <div className="text-[11px] text-stone-400 border-t border-white/5 pt-1.5 space-y-1">
                                        <div className="flex justify-between font-mono tabular-nums">
                                          <span>
                                            Transferred to {record.toPlayerName}:
                                          </span>
                                          <span className="text-stone-200 font-semibold">
                                            ${record.offerTotalValue} total
                                          </span>
                                        </div>
                                        {record.offerCash > 0 && (
                                          <div className="font-mono text-emerald-400 tabular-nums">
                                            • ${record.offerCash} Cash
                                          </div>
                                        )}
                                        {record.offerProperties.map((prop) => (
                                          <button
                                            key={prop.tileIndex}
                                            onClick={() => {
                                              setSelectedTileIndex(
                                                prop.tileIndex
                                              );
                                              setActiveModal('DEED');
                                            }}
                                            className="w-full flex items-center justify-between gap-2 text-left text-stone-200 hover:text-[#D4AF37] cursor-pointer"
                                          >
                                            <span className="flex items-center gap-1.5 truncate">
                                              <span
                                                className="w-2 h-2 rounded-xs shrink-0"
                                                style={{
                                                  backgroundColor:
                                                    prop.colorHex,
                                                }}
                                              />
                                              <span className="truncate">
                                                {prop.name}
                                              </span>
                                            </span>
                                            <span className="font-mono text-stone-400 tabular-nums shrink-0">
                                              ${prop.value}
                                            </span>
                                          </button>
                                        ))}
                                        {record.offerCash === 0 &&
                                          record.offerProperties.length ===
                                            0 && (
                                            <div className="text-stone-500 italic">
                                              No cash or deeds outgoing
                                            </div>
                                          )}
                                      </div>
                                    </div>

                                    {/* Counterparty Column */}
                                    <div className="p-3 rounded-lg bg-[#14100E] border border-white/5 space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-stone-200 flex items-center gap-1.5 truncate">
                                          <span
                                            className="w-2 h-2 rounded-xs shrink-0"
                                            style={{
                                              backgroundColor:
                                                record.toPlayerColor,
                                            }}
                                          />
                                          <span className="truncate">
                                            {record.toPlayerName}
                                          </span>
                                        </span>
                                        <span
                                          className={`font-mono font-bold tabular-nums shrink-0 ${
                                            record.toNetAssetDelta > 0
                                              ? 'text-emerald-400'
                                              : record.toNetAssetDelta < 0
                                              ? 'text-red-400'
                                              : 'text-[#D4AF37]'
                                          }`}
                                        >
                                          Net Asset Change:{' '}
                                          {record.toNetAssetDelta > 0
                                            ? `+$${record.toNetAssetDelta}`
                                            : record.toNetAssetDelta < 0
                                            ? `-$${Math.abs(record.toNetAssetDelta)}`
                                            : '$0'}
                                        </span>
                                      </div>

                                      <div className="text-[11px] text-stone-400 border-t border-white/5 pt-1.5 space-y-1">
                                        <div className="flex justify-between font-mono tabular-nums">
                                          <span>
                                            Transferred to{' '}
                                            {record.fromPlayerName}:
                                          </span>
                                          <span className="text-stone-200 font-semibold">
                                            ${record.requestTotalValue} total
                                          </span>
                                        </div>
                                        {record.requestCash > 0 && (
                                          <div className="font-mono text-[#D4AF37] tabular-nums">
                                            • ${record.requestCash} Cash
                                          </div>
                                        )}
                                        {record.requestProperties.map(
                                          (prop) => (
                                            <button
                                              key={prop.tileIndex}
                                              onClick={() => {
                                                setSelectedTileIndex(
                                                  prop.tileIndex
                                                );
                                                setActiveModal('DEED');
                                              }}
                                              className="w-full flex items-center justify-between gap-2 text-left text-stone-200 hover:text-[#D4AF37] cursor-pointer"
                                            >
                                              <span className="flex items-center gap-1.5 truncate">
                                                <span
                                                  className="w-2 h-2 rounded-xs shrink-0"
                                                  style={{
                                                    backgroundColor:
                                                      prop.colorHex,
                                                  }}
                                                />
                                                <span className="truncate">
                                                  {prop.name}
                                                </span>
                                              </span>
                                              <span className="font-mono text-stone-400 tabular-nums shrink-0">
                                                ${prop.value}
                                              </span>
                                            </button>
                                          )
                                        )}
                                        {record.requestCash === 0 &&
                                          record.requestProperties.length ===
                                            0 && (
                                            <div className="text-stone-500 italic">
                                              No cash or deeds outgoing
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* BILATERAL TRADE DESK */}
            {activeModal === 'TRADE' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <div className="text-xs text-[#D4AF37] font-medium flex flex-wrap items-center gap-2">
                      <span>Mergers & Acquisitions Desk</span>
                      <span aria-hidden="true" className="text-stone-500">
                        ·
                      </span>
                      <button
                        onClick={() => {
                          setPortfolioTab('TRADES');
                          setActiveModal('PORTFOLIO');
                        }}
                        className="text-[#D4AF37] underline underline-offset-4 hover:text-[#e5c247] transition-colors font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        View Trade History (
                        {(gameState.tradeHistory || []).length}) →
                      </button>
                    </div>
                    <h2
                      className="text-xl font-bold text-balance mt-0.5"
                      style={{ fontFamily: 'var(--font-fraunces), serif' }}
                    >
                      Propose Deed & Cash Trade
                    </h2>
                  </div>
                  <button
                    onClick={() => setActiveModal('NONE')}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 cursor-pointer"
                    aria-label="Close Trade Modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {(() => {
                  const initiator = activeControllablePlayer;
                  const partners = gameState.players.filter(
                    (p) => p.id !== initiator?.id && !p.bankrupt
                  );
                  const partner =
                    partners.find((p) => p.id === tradeTargetId) || partners[0];
                  const myProps = Object.values(gameState.properties).filter(
                    (pr) => pr.ownerId === initiator?.id && pr.houses === 0
                  );
                  const partnerProps = Object.values(
                    gameState.properties
                  ).filter(
                    (pr) => pr.ownerId === partner?.id && pr.houses === 0
                  );

                  // Helper to value any deed (accounting for mortgage status & improvements)
                  const getDeedAssetValue = (tileIdx: number) => {
                    const pr = gameState.properties[tileIdx];
                    const tile = activeTiles[tileIdx];
                    if (!tile) return 0;
                    const basePrice = tile.price || 0;
                    const deedVal = pr?.mortgaged
                      ? Math.floor(basePrice * 0.5)
                      : basePrice;
                    const buildingsVal =
                      (pr?.houses || 0) * (tile.houseCost || 0);
                    return deedVal + buildingsVal;
                  };

                  // Total current property portfolio values for both parties
                  const initiatorCurrPropVal = Object.values(
                    gameState.properties
                  )
                    .filter((pr) => pr.ownerId === initiator?.id)
                    .reduce(
                      (sum, pr) => sum + getDeedAssetValue(pr.tileIndex),
                      0
                    );

                  const partnerCurrPropVal = Object.values(gameState.properties)
                    .filter((pr) => pr.ownerId === partner?.id)
                    .reduce(
                      (sum, pr) => sum + getDeedAssetValue(pr.tileIndex),
                      0
                    );

                  const initiatorCurrCash = initiator?.cash || 0;
                  const partnerCurrCash = partner?.cash || 0;

                  const initiatorCurrTotalAssets =
                    initiatorCurrCash + initiatorCurrPropVal;
                  const partnerCurrTotalAssets =
                    partnerCurrCash + partnerCurrPropVal;

                  // Selected trade package valuations
                  const offeredPropsVal = tradeOfferProps.reduce(
                    (sum, idx) => sum + getDeedAssetValue(idx),
                    0
                  );
                  const requestedPropsVal = tradeRequestProps.reduce(
                    (sum, idx) => sum + getDeedAssetValue(idx),
                    0
                  );

                  const initiatorOutgoingTotal =
                    tradeOfferCash + offeredPropsVal;
                  const initiatorIncomingTotal =
                    tradeRequestCash + requestedPropsVal;

                  // Net Change in Total Assets (Cash + Property Values) for both parties
                  const initiatorNetDelta =
                    initiatorIncomingTotal - initiatorOutgoingTotal;
                  const partnerNetDelta =
                    initiatorOutgoingTotal - initiatorIncomingTotal;

                  // Post-Trade projected breakdowns
                  const initiatorPostCash =
                    initiatorCurrCash - tradeOfferCash + tradeRequestCash;
                  const initiatorPostPropVal =
                    initiatorCurrPropVal - offeredPropsVal + requestedPropsVal;
                  const initiatorPostTotalAssets =
                    initiatorCurrTotalAssets + initiatorNetDelta;

                  const partnerPostCash =
                    partnerCurrCash - tradeRequestCash + tradeOfferCash;
                  const partnerPostPropVal =
                    partnerCurrPropVal - requestedPropsVal + offeredPropsVal;
                  const partnerPostTotalAssets =
                    partnerCurrTotalAssets + partnerNetDelta;

                  const hasAnySelection =
                    tradeOfferCash > 0 ||
                    tradeRequestCash > 0 ||
                    tradeOfferProps.length > 0 ||
                    tradeRequestProps.length > 0;

                  const botLikelyAccepts =
                    partner?.isBot &&
                    hasAnySelection &&
                    initiatorOutgoingTotal >= initiatorIncomingTotal * 0.9;

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-stone-400">Counterparty:</span>
                        <div className="flex flex-wrap gap-2">
                          {partners.map((pt) => (
                            <button
                              key={pt.id}
                              onClick={() => {
                                setTradeTargetId(pt.id);
                                setTradeRequestProps([]);
                              }}
                              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                                partner?.id === pt.id
                                  ? 'bg-[#D4AF37] text-[#0F0C0A]'
                                  : 'bg-[#0F0C0A] text-stone-300 border border-white/10'
                              }`}
                            >
                              {pt.name} (${pt.cash})
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-[#0F0C0A] border border-white/10 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#D4AF37]">
                              Your Offer ({initiator?.name})
                            </span>
                            <span className="text-[11px] font-mono text-stone-400">
                              Package: ${initiatorOutgoingTotal}
                            </span>
                          </div>
                          <div>
                            <label className="block text-xs text-stone-400 mb-1">
                              Cash Offered (Max ${initiator?.cash || 0})
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={initiator?.cash || 0}
                              value={tradeOfferCash}
                              onChange={(e) =>
                                setTradeOfferCash(
                                  Math.max(
                                    0,
                                    Math.min(
                                      initiator?.cash || 0,
                                      Number(e.target.value)
                                    )
                                  )
                                )
                              }
                              className="w-full px-3 py-1.5 rounded bg-[#14100E] border border-white/15 text-xs text-white tabular-nums"
                            />
                          </div>
                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            <div className="text-xs text-stone-400">
                              Select Deeds to Offer ({tradeOfferProps.length}{' '}
                              selected · ${offeredPropsVal}):
                            </div>
                            {myProps.length === 0 && (
                              <div className="text-xs text-stone-500 italic">
                                No unimproved deeds owned.
                              </div>
                            )}
                            {myProps.map((pr) => {
                              const checked = tradeOfferProps.includes(
                                pr.tileIndex
                              );
                              const tile = activeTiles[pr.tileIndex];
                              const deedVal = getDeedAssetValue(pr.tileIndex);
                              return (
                                <label
                                  key={pr.tileIndex}
                                  className="flex items-center justify-between gap-2 text-xs cursor-pointer py-1 px-1.5 rounded hover:bg-white/5"
                                >
                                  <span className="flex items-center gap-2 truncate">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        setTradeOfferProps((prev) =>
                                          checked
                                            ? prev.filter(
                                                (x) => x !== pr.tileIndex
                                              )
                                            : [...prev, pr.tileIndex]
                                        )
                                      }
                                    />
                                    <span
                                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                                      style={{
                                        backgroundColor: tile?.colorHex,
                                      }}
                                    />
                                    <span className="truncate">
                                      {tile?.name}
                                      {pr.mortgaged ? ' (Mortgaged)' : ''}
                                    </span>
                                  </span>
                                  <span className="font-mono text-stone-400 shrink-0">
                                    ${deedVal}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-[#0F0C0A] border border-white/10 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-400">
                              Requested From {partner?.name}
                            </span>
                            <span className="text-[11px] font-mono text-stone-400">
                              Package: ${initiatorIncomingTotal}
                            </span>
                          </div>
                          <div>
                            <label className="block text-xs text-stone-400 mb-1">
                              Cash Requested (Max ${partner?.cash || 0})
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={partner?.cash || 0}
                              value={tradeRequestCash}
                              onChange={(e) =>
                                setTradeRequestCash(
                                  Math.max(
                                    0,
                                    Math.min(
                                      partner?.cash || 0,
                                      Number(e.target.value)
                                    )
                                  )
                                )
                              }
                              className="w-full px-3 py-1.5 rounded bg-[#14100E] border border-white/15 text-xs text-white tabular-nums"
                            />
                          </div>
                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            <div className="text-xs text-stone-400">
                              Select Deeds to Request ({tradeRequestProps.length}{' '}
                              selected · ${requestedPropsVal}):
                            </div>
                            {partnerProps.length === 0 && (
                              <div className="text-xs text-stone-500 italic">
                                Counterparty has no unimproved deeds.
                              </div>
                            )}
                            {partnerProps.map((pr) => {
                              const checked = tradeRequestProps.includes(
                                pr.tileIndex
                              );
                              const tile = activeTiles[pr.tileIndex];
                              const deedVal = getDeedAssetValue(pr.tileIndex);
                              return (
                                <label
                                  key={pr.tileIndex}
                                  className="flex items-center justify-between gap-2 text-xs cursor-pointer py-1 px-1.5 rounded hover:bg-white/5"
                                >
                                  <span className="flex items-center gap-2 truncate">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        setTradeRequestProps((prev) =>
                                          checked
                                            ? prev.filter(
                                                (x) => x !== pr.tileIndex
                                              )
                                            : [...prev, pr.tileIndex]
                                        )
                                      }
                                    />
                                    <span
                                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                                      style={{
                                        backgroundColor: tile?.colorHex,
                                      }}
                                    />
                                    <span className="truncate">
                                      {tile?.name}
                                      {pr.mortgaged ? ' (Mortgaged)' : ''}
                                    </span>
                                  </span>
                                  <span className="font-mono text-stone-400 shrink-0">
                                    ${deedVal}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* TRADE SUMMARY VIEW: NET CHANGE IN TOTAL ASSETS (CASH + PROPERTY VALUES) FOR BOTH PARTIES */}
                      <div className="p-4 rounded-xl bg-[#0F0C0A] border border-[#D4AF37]/40 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                          <div>
                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#D4AF37]">
                              Pre-Finalization Deal Valuation & Asset Summary
                            </div>
                            <div className="text-[11px] text-stone-400">
                              Net change in total assets (Cash + Property
                              Portfolio Values) for both syndicates
                            </div>
                          </div>
                          {partner && (
                            <div
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                                !hasAnySelection
                                  ? 'bg-stone-900 border-white/10 text-stone-400'
                                  : partner.isBot
                                  ? botLikelyAccepts
                                    ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                                    : 'bg-amber-950/90 border-amber-500/40 text-amber-300'
                                  : initiatorNetDelta === 0
                                  ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]'
                                  : 'bg-stone-900 border-white/15 text-stone-200'
                              }`}
                            >
                              {!hasAnySelection
                                ? 'Select cash or deeds to preview impact'
                                : partner.isBot
                                ? botLikelyAccepts
                                  ? `AI Outlook: ${partner.name} Likely to Accept`
                                  : `AI Outlook: ${partner.name} Likely to Decline (Needs ≥90% value)`
                                : initiatorNetDelta === 0
                                ? 'Balanced Parity Swap ($0 Net Spread)'
                                : `Spread: $${Math.abs(initiatorNetDelta)} ${
                                    initiatorNetDelta > 0
                                      ? `in ${initiator?.name}'s favor`
                                      : `in ${partner.name}'s favor`
                                  }`}
                            </div>
                          )}
                        </div>

                        {/* INITIATOR VS RECEIVER TOTAL ASSET BALANCE PROGRESS BAR */}
                        {(() => {
                          const combinedPreAssets = Math.max(
                            1,
                            initiatorCurrTotalAssets + partnerCurrTotalAssets
                          );
                          const combinedPostAssets = Math.max(
                            1,
                            initiatorPostTotalAssets + partnerPostTotalAssets
                          );
                          const initiatorPreSharePct = Math.round(
                            (initiatorCurrTotalAssets / combinedPreAssets) * 100
                          );
                          const initiatorPostSharePct = Math.max(
                            6,
                            Math.min(
                              94,
                              Math.round(
                                (initiatorPostTotalAssets /
                                  combinedPostAssets) *
                                  100
                              )
                            )
                          );
                          const receiverPostSharePct =
                            100 - initiatorPostSharePct;
                          const shareDeltaPct =
                            initiatorPostSharePct - initiatorPreSharePct;

                          return (
                            <div className="p-3 rounded-lg bg-[#14100E] border border-white/10 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-2 font-mono tabular-nums">
                                  <span className="font-semibold text-white">
                                    Initiator ({initiator?.name}): $
                                    {initiatorPostTotalAssets} (
                                    {initiatorPostSharePct}%)
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-bold ${
                                      initiatorNetDelta > 0
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                        : initiatorNetDelta < 0
                                        ? 'bg-red-950 text-red-300 border border-red-500/40'
                                        : 'bg-stone-800 text-[#D4AF37] border border-[#D4AF37]/30'
                                    }`}
                                  >
                                    {initiatorNetDelta > 0
                                      ? `+$${initiatorNetDelta} (${
                                          shareDeltaPct >= 0
                                            ? `+${shareDeltaPct}%`
                                            : `${shareDeltaPct}%`
                                        })`
                                      : initiatorNetDelta < 0
                                      ? `-$${Math.abs(initiatorNetDelta)} (${shareDeltaPct}%)`
                                      : '$0 (0%)'}
                                  </span>
                                </div>

                                <span className="text-stone-400 font-medium">
                                  Initiator vs. Receiver Asset Balance
                                </span>

                                <div className="flex items-center gap-2 font-mono tabular-nums">
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-bold ${
                                      partnerNetDelta > 0
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                        : partnerNetDelta < 0
                                        ? 'bg-red-950 text-red-300 border border-red-500/40'
                                        : 'bg-stone-800 text-[#D4AF37] border border-[#D4AF37]/30'
                                    }`}
                                  >
                                    {partnerNetDelta > 0
                                      ? `+$${partnerNetDelta} (${
                                          -shareDeltaPct >= 0
                                            ? `+${-shareDeltaPct}%`
                                            : `${-shareDeltaPct}%`
                                        })`
                                      : partnerNetDelta < 0
                                      ? `-$${Math.abs(partnerNetDelta)} (${-shareDeltaPct}%)`
                                      : '$0 (0%)'}
                                  </span>
                                  <span className="font-semibold text-white">
                                    Receiver ({partner?.name || 'Counterparty'}
                                    ): ${partnerPostTotalAssets} (
                                    {receiverPostSharePct}%)
                                  </span>
                                </div>
                              </div>

                              {/* Dual-Segment Progress Bar with Pre-Trade Baseline Marker */}
                              <div
                                role="progressbar"
                                aria-valuenow={initiatorPostSharePct}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label="Initiator versus Receiver total asset balance progress bar"
                                className="relative w-full h-3.5 rounded-md bg-[#0F0C0A] border border-white/15 overflow-hidden flex"
                              >
                                {/* Initiator Segment (Highlighted Green on Gain, Red on Loss, Gold on Parity) */}
                                <div
                                  className={`h-full transition-all duration-200 ${
                                    initiatorNetDelta > 0
                                      ? 'bg-emerald-500'
                                      : initiatorNetDelta < 0
                                      ? 'bg-red-500'
                                      : 'bg-[#D4AF37]'
                                  }`}
                                  style={{ width: `${initiatorPostSharePct}%` }}
                                />
                                {/* Receiver Segment (Highlighted Green on Gain, Red on Loss, Stone on Parity) */}
                                <div
                                  className={`h-full transition-all duration-200 border-l border-[#0F0C0A] ${
                                    partnerNetDelta > 0
                                      ? 'bg-emerald-500'
                                      : partnerNetDelta < 0
                                      ? 'bg-red-500'
                                      : 'bg-stone-600'
                                  }`}
                                  style={{ width: `${receiverPostSharePct}%` }}
                                />
                                {/* Pre-Trade Baseline Split Marker */}
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm pointer-events-none"
                                  style={{ left: `${initiatorPreSharePct}%` }}
                                  title={`Pre-Trade Asset Split: ${initiatorPreSharePct}% Initiator / ${
                                    100 - initiatorPreSharePct
                                  }% Receiver`}
                                />
                              </div>

                              <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 tabular-nums">
                                <span>
                                  Pre-Trade Split: {initiatorPreSharePct}% ($
                                  {initiatorCurrTotalAssets}) vs{' '}
                                  {100 - initiatorPreSharePct}% ($
                                  {partnerCurrTotalAssets})
                                </span>
                                <span>
                                  {initiatorNetDelta > 0
                                    ? `Initiator gains +$${initiatorNetDelta} net assets`
                                    : initiatorNetDelta < 0
                                    ? `Receiver gains +$${partnerNetDelta} net assets`
                                    : 'Zero net asset transfer ($0 delta)'}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* Initiator Asset Impact Card */}
                          <div className="p-3 rounded-lg bg-[#14100E] border border-white/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-xs inline-block"
                                  style={{
                                    backgroundColor:
                                      initiator?.color || '#D4AF37',
                                  }}
                                />
                                {initiator?.name} (You)
                              </span>
                              <motion.span
                                key={`init-delta-${initiatorNetDelta}`}
                                initial={{ scale: 0.85, opacity: 0.6 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-xs tabular-nums ${
                                  initiatorNetDelta > 0
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                    : initiatorNetDelta < 0
                                    ? 'bg-red-950 text-red-300 border border-red-500/40'
                                    : 'bg-stone-800 text-[#D4AF37] border border-[#D4AF37]/30'
                                }`}
                              >
                                {initiatorNetDelta > 0 ? (
                                  <TrendingUp className="w-3.5 h-3.5" />
                                ) : initiatorNetDelta < 0 ? (
                                  <TrendingDown className="w-3.5 h-3.5" />
                                ) : null}
                                {initiatorNetDelta > 0
                                  ? `+$${initiatorNetDelta} Net`
                                  : initiatorNetDelta < 0
                                  ? `-$${Math.abs(initiatorNetDelta)} Net`
                                  : '$0 Net Change'}
                              </motion.span>
                            </div>

                            <div className="space-y-1 font-mono text-[11px] text-stone-300 pt-1 border-t border-white/10 tabular-nums">
                              <div className="flex justify-between">
                                <span className="text-stone-400">
                                  Current Total Assets:
                                </span>
                                <span>
                                  ${initiatorCurrTotalAssets}{' '}
                                  <span className="text-stone-500">
                                    (${initiatorCurrCash} cash + $
                                    {initiatorCurrPropVal} deeds)
                                  </span>
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-stone-400">
                                  Outgoing / Incoming:
                                </span>
                                <span>
                                  <span className="text-red-400">
                                    -${initiatorOutgoingTotal}
                                  </span>{' '}
                                  /{' '}
                                  <span className="text-emerald-400">
                                    +${initiatorIncomingTotal}
                                  </span>
                                </span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-white/10 font-bold text-white">
                                <span>Post-Trade Total Assets:</span>
                                <span className="text-[#D4AF37]">
                                  ${initiatorPostTotalAssets}{' '}
                                  <span className="text-[10px] font-normal text-stone-400">
                                    (${initiatorPostCash} cash + $
                                    {initiatorPostPropVal} deeds)
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Counterparty Asset Impact Card */}
                          <div className="p-3 rounded-lg bg-[#14100E] border border-white/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-xs inline-block"
                                  style={{
                                    backgroundColor:
                                      partner?.color || '#10B981',
                                  }}
                                />
                                {partner?.name || 'Counterparty'}
                              </span>
                              <motion.span
                                key={`part-delta-${partnerNetDelta}`}
                                initial={{ scale: 0.85, opacity: 0.6 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-xs ${
                                  partnerNetDelta > 0
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                    : partnerNetDelta < 0
                                    ? 'bg-red-950 text-red-300 border border-red-500/40'
                                    : 'bg-stone-800 text-[#D4AF37] border border-[#D4AF37]/30'
                                }`}
                              >
                                {partnerNetDelta > 0 ? (
                                  <TrendingUp className="w-3.5 h-3.5" />
                                ) : partnerNetDelta < 0 ? (
                                  <TrendingDown className="w-3.5 h-3.5" />
                                ) : null}
                                {partnerNetDelta > 0
                                  ? `+$${partnerNetDelta} Net`
                                  : partnerNetDelta < 0
                                  ? `-$${Math.abs(partnerNetDelta)} Net`
                                  : '$0 Net Change'}
                              </motion.span>
                            </div>

                            <div className="space-y-1 font-mono text-[11px] text-stone-300 pt-1 border-t border-white/10">
                              <div className="flex justify-between">
                                <span className="text-stone-400">
                                  Current Total Assets:
                                </span>
                                <span>
                                  ${partnerCurrTotalAssets}{' '}
                                  <span className="text-stone-500">
                                    (${partnerCurrCash} cash + $
                                    {partnerCurrPropVal} deeds)
                                  </span>
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-stone-400">
                                  Outgoing / Incoming:
                                </span>
                                <span>
                                  <span className="text-red-400">
                                    -${initiatorIncomingTotal}
                                  </span>{' '}
                                  /{' '}
                                  <span className="text-emerald-400">
                                    +${initiatorOutgoingTotal}
                                  </span>
                                </span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-white/10 font-bold text-white">
                                <span>Post-Trade Total Assets:</span>
                                <span className="text-[#D4AF37]">
                                  ${partnerPostTotalAssets}{' '}
                                  <span className="text-[10px] font-normal text-stone-400">
                                    (${partnerPostCash} cash + $
                                    {partnerPostPropVal} deeds)
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (!initiator || !partner) return;
                          dispatchAction({
                            type: 'PROPOSE_TRADE',
                            offer: {
                              fromPlayerId: initiator.id,
                              toPlayerId: partner.id,
                              offerCash: tradeOfferCash,
                              requestCash: tradeRequestCash,
                              offerProperties: tradeOfferProps,
                              requestProperties: tradeRequestProps,
                            },
                          });
                          setTradeOfferCash(0);
                          setTradeRequestCash(0);
                          setTradeOfferProps([]);
                          setTradeRequestProps([]);
                          setActiveModal('NONE');
                        }}
                        disabled={!partner || !hasAnySelection}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#D4AF37] text-[#0F0C0A] font-semibold text-xs hover:bg-[#e5c247] disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        Transmit Official Trade Offer
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* OPTIONAL MALE/FEMALE AI HOST STUDIO */}
            {activeModal === 'HOST' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <div className="text-xs text-[#D4AF37] font-medium">
                      Gemini 3.8 Flash TTS & Gemini 3.8 Live Voice Showrunner
                    </div>
                    <h2
                      className="text-xl font-bold"
                      style={{ fontFamily: 'var(--font-fraunces), serif' }}
                    >
                      Optional Male / Female AI Host Studio
                    </h2>
                  </div>
                  <button
                    onClick={() => setActiveModal('NONE')}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl bg-[#0F0C0A] border border-white/10">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Enable AI Game Host
                    </div>
                    <div className="text-xs text-stone-400">
                      Toggle spoken commentary & live voice personality on or
                      off at any time.
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      dispatchAction({
                        type: 'UPDATE_HOST_CONFIG',
                        hostConfig: {
                          enabled: !gameState.hostConfig.enabled,
                        },
                      })
                    }
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      gameState.hostConfig.enabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    {gameState.hostConfig.enabled
                      ? 'AI Host: ENABLED'
                      : 'AI Host: DISABLED'}
                  </button>
                </div>

                {gameState.hostConfig.enabled && (
                  <div className="space-y-4">
                    {/* Gender & Voice Timbre Selector */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-stone-300">
                        1. Select Host Gender & Voice Persona
                      </label>
                      <div className="flex gap-2 mb-2">
                        {(['FEMALE', 'MALE'] as HostGender[]).map((g) => (
                          <button
                            key={g}
                            onClick={() => {
                              const matchingVoice =
                                HOST_VOICES.find((v) => v.gender === g) ||
                                HOST_VOICES[0];
                              dispatchAction({
                                type: 'UPDATE_HOST_CONFIG',
                                hostConfig: {
                                  gender: g,
                                  voiceName: matchingVoice.voiceName,
                                },
                              });
                            }}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                              gameState.hostConfig.gender === g
                                ? 'bg-[#D4AF37] text-[#0F0C0A] border-[#D4AF37]'
                                : 'bg-[#0F0C0A] text-stone-300 border-white/10'
                            }`}
                          >
                            {g === 'FEMALE'
                              ? 'Female AI Host Voices'
                              : 'Male AI Host Voices'}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {HOST_VOICES.filter(
                          (v) => v.gender === gameState.hostConfig.gender
                        ).map((v) => (
                          <button
                            key={v.voiceName}
                            onClick={() =>
                              dispatchAction({
                                type: 'UPDATE_HOST_CONFIG',
                                hostConfig: {
                                  voiceName: v.voiceName as HostVoiceName,
                                },
                              })
                            }
                            className={`p-3 rounded-lg border text-left transition-colors ${
                              gameState.hostConfig.voiceName === v.voiceName
                                ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white'
                                : 'bg-[#0F0C0A] border-white/10 text-stone-300 hover:border-white/25'
                            }`}
                          >
                            <div className="text-xs font-bold">
                              {v.label} ({v.voiceName})
                            </div>
                            <div className="text-[11px] text-stone-400 mt-0.5">
                              {v.timbre}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic User-Chosen Personality Preset + Custom Prompt */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-stone-300">
                        2. Choose Dynamic Host Personality
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {PERSONALITY_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() =>
                              dispatchAction({
                                type: 'UPDATE_HOST_CONFIG',
                                hostConfig: {
                                  personalityPreset:
                                    preset.id as PersonalityPresetId,
                                },
                              })
                            }
                            className={`p-3 rounded-lg border text-left transition-colors ${
                              gameState.hostConfig.personalityPreset ===
                              preset.id
                                ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white'
                                : 'bg-[#0F0C0A] border-white/10 text-stone-300 hover:border-white/25'
                            }`}
                          >
                            <div className="text-xs font-bold">
                              {preset.name}
                            </div>
                            <div className="text-[11px] text-stone-400 mt-0.5">
                              {preset.tagline}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        3. Custom Personality Direction / Backstory (Optional)
                      </label>
                      <input
                        type="text"
                        value={gameState.hostConfig.customPersonalityPrompt}
                        onChange={(e) =>
                          dispatchAction({
                            type: 'UPDATE_HOST_CONFIG',
                            hostConfig: {
                              customPersonalityPrompt: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g., Speak like a dramatic 1920s Art Deco railway tycoon who loves Mayfair..."
                        className="w-full px-3 py-2 rounded-lg bg-[#0F0C0A] border border-white/15 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        onClick={() =>
                          triggerHostCommentary(
                            `Introduce yourself as the AI Host of Grand Estates 3D and comment on the current game state: ${boardContextSummary}`
                          )
                        }
                        disabled={isSynthesizingTts}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-[#D4AF37] text-[#0F0C0A] font-semibold text-xs hover:bg-[#e5c247] disabled:opacity-50 transition-colors"
                      >
                        {isSynthesizingTts
                          ? 'Synthesizing Gemini 3.8 Flash TTS...'
                          : 'Test AI Host Voice Commentary'}
                      </button>
                      <button
                        onClick={() => {
                          setShowLiveVoice(true);
                          setActiveModal('NONE');
                        }}
                        className="py-2.5 px-4 rounded-lg bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-600 transition-colors flex items-center gap-1.5"
                      >
                        <Mic className="w-4 h-4" />
                        Open Live Voice Chat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MULTIPLAYER, BOARD SIZES & PASS-AND-PLAY LOBBY */}
            {activeModal === 'LOBBY' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <div className="text-xs text-[#D4AF37] font-medium">
                      5 Board Sizes (24 to 84 Spaces) · Up to 16 Players · Turn
                      Pacing
                    </div>
                    <h2
                      className="text-xl font-bold"
                      style={{ fontFamily: 'var(--font-fraunces), serif' }}
                    >
                      Grand Estates Match Lobby & Board Architect
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setActiveModal('NONE');
                        setAppPhase('START_MENU');
                      }}
                      className="px-2.5 py-1 rounded bg-stone-800 text-xs text-stone-200 hover:bg-stone-700"
                    >
                      Start Menu
                    </button>
                    <button
                      onClick={() => setActiveModal('NONE')}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 1. Board Size Selector with Recommended Player Sizes Across It (Up to 16 Players) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#D4AF37]" />
                      <span>
                        1. Select Board Size (Up to 16 Players Across 5 Scales)
                      </span>
                    </label>
                    <button
                      onClick={() =>
                        handleSelectDraftBoardSize(draftBoardSize, true)
                      }
                      className="text-[11px] font-semibold text-[#D4AF37] hover:underline"
                    >
                      Auto-Populate Recommended Players (
                      {BOARD_SIZE_CONFIGS[draftBoardSize].defaultPlayerCount}P)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {(
                      [
                        'MINI',
                        'CLASSIC',
                        'MEGA',
                        'CONTINENTAL',
                        'COLOSSAL',
                      ] as BoardSizeId[]
                    ).map((sizeId) => {
                      const cfg = BOARD_SIZE_CONFIGS[sizeId];
                      const isSelected = draftBoardSize === sizeId;
                      return (
                        <button
                          key={sizeId}
                          onClick={() =>
                            handleSelectDraftBoardSize(sizeId, true)
                          }
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-1.5 ${
                            isSelected
                              ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white shadow-lg'
                              : 'bg-[#0F0C0A] border-white/10 text-stone-300 hover:border-white/30'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-white">
                              {cfg.shortLabel}
                            </div>
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#D4AF37] text-[#0F0C0A] text-[10px] font-bold">
                              <Users className="w-3 h-3" />
                              <span>{cfg.recommendedPlayers}</span>
                            </div>
                            <p className="text-[10px] text-stone-400 leading-snug">
                              Max {cfg.maxAllowedPlayers}P · $
                              {cfg.startingCash}
                            </p>
                          </div>

                          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-stone-300">
                            <span>
                              {cfg.gridDimension}×{cfg.gridDimension}
                            </span>
                            <span>{cfg.estimatedDuration}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Turn-Time Limit Configuration */}
                <div className="p-3 rounded-xl bg-[#0F0C0A] border border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>2. Turn-Time Limit Pacing</span>
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Automatically dispatches End Turn when the turn countdown
                      reaches zero.
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[
                      [30, '30s Blitz'],
                      [60, '60s Standard'],
                      [90, '90s Relaxed'],
                      [0, 'Unlimited'],
                    ].map(([sec, label]) => (
                      <button
                        key={String(sec)}
                        onClick={() => {
                          setDraftTurnLimit(Number(sec));
                          dispatchAction({
                            type: 'SET_TURN_TIME_LIMIT',
                            seconds: Number(sec),
                          });
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          draftTurnLimit === Number(sec)
                            ? 'bg-[#D4AF37] text-[#0F0C0A]'
                            : 'bg-[#14100E] text-stone-300 border border-white/10 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Mode Switcher (Local vs Online) */}
                <div className="flex gap-2 p-1 bg-[#0F0C0A] rounded-lg border border-white/10">
                  <button
                    onClick={() => setSetupMode('LOCAL')}
                    className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors ${
                      setupMode === 'LOCAL'
                        ? 'bg-[#D4AF37] text-[#0F0C0A]'
                        : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    Local Table (Pass-and-Play + AI Bots · 2–16 Players)
                  </button>
                  <button
                    onClick={() => setSetupMode('ONLINE')}
                    className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors ${
                      setupMode === 'ONLINE'
                        ? 'bg-[#D4AF37] text-[#0F0C0A]'
                        : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    Online Real-Time Multiplayer Room
                  </button>
                </div>

                {setupMode === 'LOCAL' ? (
                  <div className="space-y-3">
                    {(() => {
                      const cfg = BOARD_SIZE_CONFIGS[draftBoardSize];
                      const count = localDraftPlayers.length;
                      const isOptimal =
                        count >= cfg.recommendedMinPlayers &&
                        count <= cfg.recommendedMaxPlayers;
                      return (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-stone-300 font-semibold">
                              3. Contenders ({count} of {cfg.maxAllowedPlayers}{' '}
                              Max)
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                isOptimal
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {isOptimal
                                ? `Optimal for ${cfg.shortLabel} (${cfg.recommendedPlayers})`
                                : `${cfg.shortLabel} ${cfg.recommendedPlayers}`}
                            </span>
                          </div>
                          {localDraftPlayers.length < cfg.maxAllowedPlayers && (
                            <button
                              onClick={() => {
                                const nextIdx = localDraftPlayers.length;
                                const arch =
                                  TOKEN_ARCHETYPES[
                                    nextIdx % TOKEN_ARCHETYPES.length
                                  ];
                                const color =
                                  PLAYER_PALETTE[
                                    nextIdx % PLAYER_PALETTE.length
                                  ];
                                setLocalDraftPlayers((prev) => [
                                  ...prev,
                                  {
                                    id: `draft-${Date.now()}-${nextIdx}`,
                                    name:
                                      CONTENDER_NAMES[nextIdx] ||
                                      `Contender ${nextIdx + 1}`,
                                    isBot: true,
                                    token: arch.id,
                                    color,
                                    cash: cfg.startingCash,
                                    position: 0,
                                    inJail: false,
                                    jailTurns: 0,
                                    getOutOfJailCards: 0,
                                    bankrupt: false,
                                    connected: true,
                                  },
                                ]);
                              }}
                              className="px-3 py-1 rounded bg-stone-800 text-xs text-[#D4AF37] font-semibold hover:bg-stone-700"
                            >
                              + Add Player / Bot
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                      {localDraftPlayers.map((p, idx) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-[#0F0C0A] border border-white/10 text-xs"
                        >
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLocalDraftPlayers((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, name: val } : item
                                )
                              );
                            }}
                            className="flex-1 min-w-[110px] px-2 py-1 rounded bg-[#14100E] border border-white/15 text-white"
                          />
                          <select
                            value={p.token}
                            onChange={(e) => {
                              const newToken = e.target.value as TokenArchetype;
                              setLocalDraftPlayers((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        token: newToken,
                                      }
                                    : item
                                )
                              );
                            }}
                            className="px-2 py-1 rounded bg-[#14100E] border border-white/15 text-stone-200 text-[11px]"
                          >
                            {TOKEN_ARCHETYPES.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              setLocalDraftPlayers((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, isBot: !item.isBot }
                                    : item
                                )
                              )
                            }
                            className={`px-2 py-1 rounded font-semibold text-[11px] ${
                              p.isBot
                                ? 'bg-purple-950/90 text-purple-200 border border-purple-500/30'
                                : 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/30'
                            }`}
                          >
                            {p.isBot ? 'Bot' : 'Human'}
                          </button>
                          {localDraftPlayers.length > 2 && (
                            <button
                              onClick={() =>
                                setLocalDraftPlayers((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="p-1 text-stone-400 hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleStartLocalMatch}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#D4AF37] text-[#0F0C0A] font-bold text-xs hover:bg-[#e5c247] transition-colors"
                    >
                      Launch {BOARD_SIZE_CONFIGS[draftBoardSize].name} (
                      {localDraftPlayers.length} Players)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setOnlineAction('CREATE')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border ${
                          onlineAction === 'CREATE'
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white'
                            : 'bg-[#0F0C0A] border-white/10 text-stone-400'
                        }`}
                      >
                        Create New Room Code
                      </button>
                      <button
                        onClick={() => setOnlineAction('JOIN')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border ${
                          onlineAction === 'JOIN'
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white'
                            : 'bg-[#0F0C0A] border-white/10 text-stone-400'
                        }`}
                      >
                        Join Existing 6-Char Code
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-stone-400 mb-1">
                          Your Display Name
                        </label>
                        <input
                          type="text"
                          value={onlinePlayerName}
                          onChange={(e) => setOnlinePlayerName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#0F0C0A] border border-white/15 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-stone-400 mb-1">
                          Your 3D Sculpted Token
                        </label>
                        <select
                          value={onlinePlayerToken}
                          onChange={(e) =>
                            setOnlinePlayerToken(
                              e.target.value as TokenArchetype
                            )
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#0F0C0A] border border-white/15 text-white"
                        >
                          {TOKEN_ARCHETYPES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {onlineAction === 'CREATE' ? (
                      <div>
                        <label className="block text-xs text-stone-400 mb-1">
                          Include AI Bot Contenders in Online Room (0–
                          {BOARD_SIZE_CONFIGS[draftBoardSize]
                            .maxAllowedPlayers - 1}{' '}
                          ·{' '}
                          {
                            BOARD_SIZE_CONFIGS[draftBoardSize]
                              .recommendedPlayers
                          }
                          )
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={
                            BOARD_SIZE_CONFIGS[draftBoardSize]
                              .maxAllowedPlayers - 1
                          }
                          value={onlineBotCount}
                          onChange={(e) =>
                            setOnlineBotCount(
                              Math.max(
                                0,
                                Math.min(
                                  BOARD_SIZE_CONFIGS[draftBoardSize]
                                    .maxAllowedPlayers - 1,
                                  Number(e.target.value)
                                )
                              )
                            )
                          }
                          className="w-32 px-3 py-1.5 rounded-lg bg-[#0F0C0A] border border-white/15 text-xs text-white"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs text-stone-400 mb-1">
                          Enter 6-Character Room Invite Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={joinRoomCodeInput}
                          onChange={(e) =>
                            setJoinRoomCodeInput(e.target.value.toUpperCase())
                          }
                          placeholder="e.g. K9X4M2"
                          className="w-48 px-3 py-2 rounded-lg bg-[#0F0C0A] border border-[#D4AF37]/50 text-sm font-mono uppercase text-[#D4AF37]"
                        />
                      </div>
                    )}

                    {roomError && (
                      <p className="text-xs text-red-400">{roomError}</p>
                    )}

                    <button
                      onClick={handleConnectOnlineRoom}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#D4AF37] text-[#0F0C0A] font-bold text-xs hover:bg-[#e5c247] transition-colors"
                    >
                      {onlineAction === 'CREATE'
                        ? `Launch Online ${BOARD_SIZE_CONFIGS[draftBoardSize].shortLabel} Room`
                        : 'Join Multiplayer Room Now'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* USER DISPLAY, 3D HUD & TURN NOTIFICATION SETTINGS MODAL */}
            {activeModal === 'SETTINGS' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <div className="text-xs text-[#D4AF37] font-medium flex items-center gap-1.5">
                      <Settings className="w-4 h-4" />
                      <span>User Preferences & 3D Board Display Settings</span>
                    </div>
                    <h2
                      className="text-2xl font-bold mt-0.5"
                      style={{ fontFamily: 'var(--font-fraunces), serif' }}
                    >
                      Board & Notification Settings
                    </h2>
                  </div>
                  <button
                    onClick={() => setActiveModal('NONE')}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 1. 3D Viewport Overlays (Default OFF since 3D canvas text is readable) */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                    1. 3D Board Viewport Overlays
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* 3D Crisp Text Labels Overlay Toggle (Default OFF) */}
                    <div className="p-4 rounded-xl bg-[#0F0C0A] border border-white/10 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-white">
                          3D Crisp Text Labels Overlay
                        </div>
                        <p className="text-[11px] text-stone-400 leading-relaxed">
                          Floating HTML text tags above 3D board tiles. Default
                          is OFF because high-resolution 3D board textures are
                          directly readable.
                        </p>
                      </div>
                      <button
                        onClick={() => setShow3DLabelsOverlay((v) => !v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          show3DLabelsOverlay
                            ? 'bg-[#D4AF37] text-[#0F0C0A]'
                            : 'bg-stone-800 text-stone-300 border border-white/10 hover:text-white'
                        }`}
                      >
                        {show3DLabelsOverlay ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {/* 3D Top-Left Tile Inspector Card Toggle (Default OFF) */}
                    <div className="p-4 rounded-xl bg-[#0F0C0A] border border-white/10 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-white">
                          Top-Left 3D Tile Summary Card
                        </div>
                        <p className="text-[11px] text-stone-400 leading-relaxed">
                          Floating corner mini-card showing hovered/selected
                          space details. Default is OFF to keep the 3D viewport
                          unobstructed.
                        </p>
                      </div>
                      <button
                        onClick={() => setShow3DCornerInspector((v) => !v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          show3DCornerInspector
                            ? 'bg-[#D4AF37] text-[#0F0C0A]'
                            : 'bg-stone-800 text-stone-300 border border-white/10 hover:text-white'
                        }`}
                      >
                        {show3DCornerInspector ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Turn Resolution Pop-ups & AI Bot Pacing */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                    2. Turn Resolution Pop-ups & Bot Pacing
                  </div>

                  <div className="p-4 rounded-xl bg-[#0F0C0A] border border-white/10 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white">
                        Show Turn Pop-ups When Other Players / Bots Are in Play
                      </div>
                      <p className="text-[11px] text-stone-400 leading-relaxed">
                        Keep the Turn Resolution pop-up visible during AI Bot
                        and other players’ turns (purchases, rent, tax, cards,
                        and detention) so you never miss table activity.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAllPlayerTurnPopups((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        showAllPlayerTurnPopups
                          ? 'bg-[#D4AF37] text-[#0F0C0A]'
                          : 'bg-stone-800 text-stone-300 border border-white/10 hover:text-white'
                      }`}
                    >
                      {showAllPlayerTurnPopups ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0F0C0A] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">
                          AI Bot Turn Pacing Speed
                        </div>
                        <p className="text-[11px] text-stone-400">
                          Controls how long AI Bot turn notifications stay on
                          screen before advancing to the next contender.
                        </p>
                      </div>
                      <span className="text-xs font-mono text-[#D4AF37]">
                        {(botTurnDelayMs / 1000).toFixed(2)}s / step
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          [950, 'Fast (0.95s)'],
                          [1650, 'Standard (1.65s)'],
                          [2500, 'Relaxed (2.50s)'],
                        ] as [number, string][]
                      ).map(([ms, label]) => (
                        <button
                          key={ms}
                          onClick={() => setBotTurnDelayMs(ms)}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            botTurnDelayMs === ms
                              ? 'bg-[#D4AF37] text-[#0F0C0A] font-bold'
                              : 'bg-[#14100E] text-stone-300 border border-white/10 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Audio, Turn Timer & AI Host Quick Access */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-[#0F0C0A] border border-white/10 space-y-2.5">
                    <div className="text-xs font-bold text-white">
                      Turn Countdown Timer
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          [30, '30s'],
                          [60, '60s'],
                          [90, '90s'],
                          [0, 'Off'],
                        ] as [number, string][]
                      ).map(([sec, label]) => (
                        <button
                          key={sec}
                          onClick={() => {
                            setDraftTurnLimit(sec);
                            dispatchAction({
                              type: 'SET_TURN_TIME_LIMIT',
                              seconds: sec,
                            });
                          }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer ${
                            gameState.turnTimeLimitSeconds === sec
                              ? 'bg-[#D4AF37] text-[#0F0C0A] font-bold'
                              : 'bg-[#14100E] text-stone-300 border border-white/10 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0F0C0A] border border-white/10 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-white">
                        Sound Effects & Audio
                      </div>
                      <p className="text-[11px] text-stone-400">
                        Synthesized Web Audio dice, chimes, and AI Host voice.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          const next = !sfxMuted;
                          setSfxMuted(next);
                          soundFX.muted = next;
                          if (next && currentAudioRef.current) {
                            currentAudioRef.current.pause();
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                          !sfxMuted
                            ? 'bg-[#D4AF37] text-[#0F0C0A]'
                            : 'bg-red-950 text-red-300 border border-red-500/40'
                        }`}
                      >
                        {sfxMuted ? 'Muted' : 'Audio ON'}
                      </button>
                      <button
                        onClick={() => setActiveModal('HOST')}
                        className="px-3 py-1.5 rounded-lg bg-[#14100E] border border-[#D4AF37]/40 text-xs font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/15 cursor-pointer"
                      >
                        AI Host →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. Live Voice Conversation Floating Studio (gemini-3.8-live) */}
      {showLiveVoice && (
        <LiveVoicePanel
          hostConfig={gameState.hostConfig}
          boardContext={boardContextSummary}
          onClose={() => setShowLiveVoice(false)}
        />
      )}

      {/* 9. Sleek Single-Row Center-Bottom Turn Action Bar (Only shown in 3D mode or on mobile when no modal is open) */}
      {appPhase === 'IN_GAME' && activeModal === 'NONE' && (
        <section
          aria-label="Turn Action Bar"
          className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-20 w-[94vw] max-w-xl transition-transform duration-200 ${
            viewMode === '2D' ? 'lg:hidden' : ''
          } ${
            dockCollapsed ? 'translate-y-[calc(100%-26px)]' : 'translate-y-0'
          }`}
        >
          {/* Toggle Sidebars / Zen Mode Tab */}
          <div className="flex justify-center">
            <button
              onClick={() => setDockCollapsed((c) => !c)}
              className="px-3 py-0.5 rounded-t-lg bg-[#14100E] border-t border-x border-[#D4AF37]/30 text-[10px] font-medium text-stone-300 hover:text-[#D4AF37] flex items-center gap-1 cursor-pointer"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Show HUD (H)
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Zen Mode (H)
                </>
              )}
            </button>
          </div>

          {/* Single-Row Richup.io Style Floating Turn Command Pill */}
          <div className="rounded-2xl bg-[#14100E] border border-[#D4AF37]/45 shadow-2xl px-4 py-2.5 text-[#FAF6F0] flex flex-wrap items-center justify-between gap-3">
            {/* Left: Active Player + Dice + Timer */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: currentPlayer?.color }}
                />
                <span className="text-xs font-bold text-white truncate max-w-[110px]">
                  {currentPlayer?.name}
                </span>
                <span className="font-mono text-xs font-bold text-[#D4AF37]">
                  ${currentPlayer?.cash}
                </span>
              </div>

              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0F0C0A] border border-white/10 text-xs font-mono tabular-nums">
                <Dices className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>
                  {gameState.dice[0]}+{gameState.dice[1]}=
                  {gameState.dice[0] + gameState.dice[1]}
                </span>
              </div>

              {gameState.turnTimeLimitSeconds > 0 &&
                remainingSeconds !== null && (
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0F0C0A] border border-white/10 text-xs font-mono font-bold tabular-nums ${
                      remainingSeconds <= 10 ? 'text-red-400' : 'text-stone-300'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>{remainingSeconds}s</span>
                  </div>
                )}
            </div>

            {/* Right: Primary Turn CTA Buttons */}
            <div className="flex items-center gap-2">
              {gameState.status === 'GAME_OVER' ? (
                <button
                  onClick={() => setActiveModal('LOBBY')}
                  className="px-4 py-2 rounded-xl bg-[#D4AF37] text-[#0F0C0A] text-xs font-extrabold cursor-pointer"
                >
                  Match Complete · Play Again
                </button>
              ) : isMyTurn ? (
                <>
                  {gameState.phase === 'ROLL' && (
                    <>
                      <button
                        onClick={() => dispatchAction({ type: 'ROLL_DICE' })}
                        className="px-5 py-2 rounded-xl bg-[#D4AF37] text-[#0F0C0A] text-xs font-extrabold hover:bg-[#e5c247] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Roll Dice
                      </button>
                      {currentPlayer?.inJail && currentPlayer.cash >= 50 && (
                        <button
                          onClick={() =>
                            dispatchAction({ type: 'PAY_JAIL_BAIL' })
                          }
                          className="px-3 py-2 rounded-xl bg-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-700 whitespace-nowrap cursor-pointer"
                        >
                          Bail $50
                        </button>
                      )}
                    </>
                  )}

                  {gameState.phase === 'ACTION' && (
                    <>
                      <button
                        onClick={() => dispatchAction({ type: 'BUY_PROPERTY' })}
                        disabled={currentPlayer.cash < currentEffectivePrice}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-500 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Buy {currentTile.shortName} (${currentEffectivePrice})
                      </button>
                      <button
                        onClick={() =>
                          dispatchAction({ type: 'DECLINE_PROPERTY' })
                        }
                        className="px-3 py-2 rounded-xl bg-stone-800 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-semibold hover:bg-stone-700 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Auction
                      </button>
                    </>
                  )}

                  {gameState.phase === 'END_TURN' && (
                    <button
                      onClick={() => dispatchAction({ type: 'END_TURN' })}
                      className="px-5 py-2 rounded-xl bg-[#D4AF37] text-[#0F0C0A] text-xs font-extrabold hover:bg-[#e5c247] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {gameState.lastRollWasDoubles
                        ? 'Roll Again (Doubles!)'
                        : 'End Turn →'}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-xs text-stone-300 px-2">
                  <strong className="text-[#D4AF37]">
                    {currentPlayer?.name}
                  </strong>{' '}
                  in play...
                </div>
              )}

              <button
                onClick={() => setActiveModal('TRADE')}
                className="px-3 py-2 rounded-xl bg-[#0F0C0A] border border-white/15 text-xs font-semibold text-stone-200 hover:border-[#D4AF37] cursor-pointer"
              >
                Trade
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

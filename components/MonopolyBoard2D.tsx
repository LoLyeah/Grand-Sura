'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  Clock,
  Dices,
  Gavel,
  Globe,
  Layers,
  TrendingDown,
  TrendingUp,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BOARD_SIZE_CONFIGS,
  BoardTile,
  COLOR_GROUP_NAMES,
  getBoardTiles,
} from '@/lib/monopoly-data';
import {
  applyGameAction,
  canBuildHouseOnTile,
  GameRoomState,
  getEffectiveHouseCost,
  getEffectivePropertyPrice,
} from '@/lib/monopoly-engine';

interface MonopolyBoard2DProps {
  gameState: GameRoomState;
  selectedTileIndex: number;
  onSelectTile: (index: number, openModal?: boolean) => void;
  onDispatchAction: (action: Parameters<typeof applyGameAction>[1]) => void;
  isMyTurn: boolean;
  remainingSeconds: number | null;
  onSwitchTo3D: () => void;
  onOpenTrade?: () => void;
}

/**
 * Computes 1-based CSS Grid (row, col) coordinates for any perimeter tile index (0 .. sideLength*4 - 1)
 * on a (sideLength + 1) x (sideLength + 1) square board.
 */
function getGridPosition(
  index: number,
  sideLength: number
): { row: number; col: number; side: 'BOTTOM' | 'LEFT' | 'TOP' | 'RIGHT' | 'CORNER' } {
  const N = sideLength + 1;
  const isCorner = index % sideLength === 0;
  if (index <= sideLength) {
    return { row: N, col: N - index, side: isCorner ? 'CORNER' : 'BOTTOM' };
  }
  if (index <= sideLength * 2) {
    const offset = index - sideLength;
    return { row: N - offset, col: 1, side: isCorner ? 'CORNER' : 'LEFT' };
  }
  if (index <= sideLength * 3) {
    const offset = index - sideLength * 2;
    return { row: 1, col: 1 + offset, side: isCorner ? 'CORNER' : 'TOP' };
  }
  const offset = index - sideLength * 3;
  return { row: 1 + offset, col: N, side: isCorner ? 'CORNER' : 'RIGHT' };
}

export default function MonopolyBoard2D({
  gameState,
  selectedTileIndex,
  onSelectTile,
  onDispatchAction,
  isMyTurn,
  remainingSeconds,
  onSwitchTo3D,
  onOpenTrade,
}: MonopolyBoard2DProps) {
  const [hoveredTileIndex, setHoveredTileIndex] = useState<number | null>(null);
  const [zoomedMode, setZoomedMode] = useState<boolean>(false);
  const [visualPositions, setVisualPositions] = useState<
    Record<string, number>
  >({});

  const boardConfig =
    BOARD_SIZE_CONFIGS[gameState.boardSize] || BOARD_SIZE_CONFIGS.CLASSIC;
  const tiles = getBoardTiles(gameState.boardSize);
  const sideLength = boardConfig.sideLength;
  const gridDim = boardConfig.gridDimension;

  // Step 2D tokens tile-by-tile around the perimeter when player positions advance
  useEffect(() => {
    const total = tiles.length;
    if (total === 0) return;

    const needsStep = gameState.players.some((p) => {
      if (p.bankrupt) return false;
      const vis = visualPositions[p.id];
      return vis !== undefined && vis !== p.position;
    });

    const missingInit = gameState.players.some(
      (p) => !p.bankrupt && visualPositions[p.id] === undefined
    );

    if (missingInit && !needsStep) {
      const timer = setTimeout(() => {
        setVisualPositions((prev) => {
          const next = { ...prev };
          for (const p of gameState.players) {
            if (!p.bankrupt && next[p.id] === undefined) {
              next[p.id] = p.position;
            }
          }
          return next;
        });
      }, 0);
      return () => clearTimeout(timer);
    }

    if (!needsStep) return;

    const stepTimer = setTimeout(() => {
      setVisualPositions((prev) => {
        const next = { ...prev };
        for (const p of gameState.players) {
          if (p.bankrupt) continue;
          const cur = next[p.id] ?? p.position;
          if (cur !== p.position) {
            const dist = (p.position - cur + total) % total;
            next[p.id] = dist > 0 && dist <= 16 ? (cur + 1) % total : p.position;
          }
        }
        return next;
      });
    }, 95);

    return () => clearTimeout(stepTimer);
  }, [gameState.players, tiles.length, visualPositions]);

  const currentPlayer =
    gameState.players[gameState.turnIndex] || gameState.players[0];
  const currentTile = tiles[currentPlayer?.position || 0] || tiles[0];
  const currentEffectivePrice = getEffectivePropertyPrice(
    gameState,
    currentTile.index
  );

  // Focused tile for quick preview bar
  const focusedIndex =
    hoveredTileIndex !== null && hoveredTileIndex < tiles.length
      ? hoveredTileIndex
      : selectedTileIndex < tiles.length
      ? selectedTileIndex
      : currentPlayer?.position || 0;
  const focusedTile: BoardTile = tiles[focusedIndex] || tiles[0];
  const focusedProp = gameState.properties[focusedTile.index];
  const focusedOwner = focusedProp?.ownerId
    ? gameState.players.find((p) => p.id === focusedProp.ownerId)
    : null;
  const focusedEffectivePrice = getEffectivePropertyPrice(
    gameState,
    focusedTile.index
  );
  const focusedEffectiveHouseCost = getEffectiveHouseCost(
    gameState,
    focusedTile.index
  );
  const canBuildFocused =
    currentPlayer &&
    !currentPlayer.isBot &&
    canBuildHouseOnTile(gameState, currentPlayer.id, focusedTile.index).allowed;

  const isCompactGrid = sideLength >= 13;

  return (
    <div className="w-full h-full flex items-center justify-center overflow-auto p-2 md:p-3 select-none">
      {/* Square-Proportioned Richup.io / Monopoly Tabletop Board */}
      <div
        className={`${
          zoomedMode
            ? 'w-[1260px] h-[1260px] shrink-0'
            : sideLength >= 17
            ? 'w-full h-full max-w-[1180px] max-h-[calc(100vh-76px)] min-w-[780px] min-h-[780px]'
            : 'w-full h-full max-w-[940px] max-h-[calc(100vh-76px)] aspect-square'
        } rounded-2xl bg-[#16120E] border-2 border-[#D4AF37]/45 shadow-2xl p-1.5 grid gap-1 relative`}
        style={{
          gridTemplateColumns: `1.22fr repeat(${gridDim - 2}, minmax(0, 1fr)) 1.22fr`,
          gridTemplateRows: `1.22fr repeat(${gridDim - 2}, minmax(0, 1fr)) 1.22fr`,
        }}
      >
        {/* Perimeter Board Spaces */}
        {tiles.map((tile) => {
          const { row, col } = getGridPosition(tile.index, sideLength);
          const isCorner = tile.index % sideLength === 0;
          const prop = gameState.properties[tile.index];
          const owner = prop?.ownerId
            ? gameState.players.find((p) => p.id === prop.ownerId)
            : null;
          const occupants = gameState.players.filter(
            (p) =>
              !p.bankrupt &&
              (visualPositions[p.id] ?? p.position) === tile.index
          );
          const isOccupied = occupants.length > 0;
          const isSelected = selectedTileIndex === tile.index;
          const isHovered = hoveredTileIndex === tile.index;
          const effectivePrice = getEffectivePropertyPrice(
            gameState,
            tile.index
          );
          const hasColorBand =
            tile.type === 'PROPERTY' ||
            tile.type === 'RAILROAD' ||
            tile.type === 'UTILITY';

          return (
            <div
              key={tile.index}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTile(tile.index, false)}
              onDoubleClick={() => onSelectTile(tile.index, true)}
              onMouseEnter={() => setHoveredTileIndex(tile.index)}
              onMouseLeave={() => setHoveredTileIndex(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectTile(tile.index, true);
                }
              }}
              style={{
                gridRow: row,
                gridColumn: col,
              }}
              className={`relative flex flex-col justify-between rounded-md overflow-hidden transition-all cursor-pointer text-center border ${
                isCorner
                  ? 'bg-[#1E1712] text-[#FAF6F0]'
                  : prop?.mortgaged
                  ? 'bg-stone-300/90 text-stone-800'
                  : isOccupied
                  ? 'bg-[#FFF7E0] text-[#14100E]'
                  : 'bg-[#F7F2E7] text-[#14100E]'
              } ${
                isSelected || isHovered
                  ? 'ring-2 ring-[#D4AF37] border-[#D4AF37] z-20 scale-[1.03] shadow-xl'
                  : isOccupied
                  ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/70 z-10'
                  : 'border-stone-800/70 hover:border-[#D4AF37]/80'
              }`}
            >
              {/* Top Color Group Band + Built Houses/Hotel Pips */}
              {hasColorBand ? (
                <div
                  className="w-full h-3.5 md:h-4 px-1 flex items-center justify-between shrink-0 border-b border-black/20"
                  style={{ backgroundColor: tile.colorHex }}
                >
                  <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-tight text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)] truncate">
                    {tile.city}
                  </span>
                  {prop && prop.houses > 0 && (
                    <span className="px-1 rounded-xs bg-black/75 text-[#D4AF37] font-mono text-[8px] font-extrabold leading-none">
                      {prop.houses === 5 ? '★H' : `${prop.houses}V`}
                    </span>
                  )}
                </div>
              ) : (
                <div className="w-full h-3 md:h-3.5 px-1 bg-[#14100E] flex items-center justify-center shrink-0 border-b border-white/10">
                  <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-wider text-[#D4AF37] truncate">
                    {isCorner ? tile.city : tile.type}
                  </span>
                </div>
              )}

              {/* Center Tile Label */}
              <div className="my-auto px-0.5 flex flex-col items-center justify-center min-h-0">
                <div
                  className={`font-extrabold leading-tight tracking-tight line-clamp-2 ${
                    isCorner
                      ? 'text-[10px] md:text-xs text-[#D4AF37]'
                      : isCompactGrid && !zoomedMode
                      ? 'text-[8px] md:text-[9px] text-[#14100E]'
                      : 'text-[9px] md:text-[11px] text-[#14100E]'
                  }`}
                >
                  {tile.shortName}
                </div>
              </div>

              {/* Player Tokens Hopping on This Tile */}
              {isOccupied && (
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center -space-x-1 pointer-events-none z-20">
                  <AnimatePresence mode="popLayout">
                    {occupants.map((p) => {
                      const isActivePlayer = p.id === currentPlayer?.id;
                      return (
                        <motion.span
                          layout
                          layoutId={`token-2d-${p.id}`}
                          key={p.id}
                          initial={{ scale: 0.3, y: -10, opacity: 0 }}
                          animate={{ scale: 1, y: 0, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 22,
                          }}
                          className={`inline-flex items-center justify-center w-4 h-4 md:w-5 md:h-5 rounded-full text-[8px] md:text-[9px] font-extrabold text-[#0F0C0A] shadow-md border ${
                            isActivePlayer
                              ? 'border-white ring-2 ring-[#D4AF37]'
                              : 'border-black/80'
                          }`}
                          style={{ backgroundColor: p.color }}
                        >
                          {p.name.slice(0, 2).toUpperCase()}
                        </motion.span>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

              {/* Bottom Strip: Price & Richup.io-Style Owner Color Bar */}
              <div className="w-full shrink-0">
                <div
                  className={`w-full px-1 py-0.5 text-[8px] md:text-[10px] font-mono font-bold tabular-nums leading-none flex items-center justify-center ${
                    isCorner
                      ? 'bg-black/40 text-[#D4AF37]'
                      : 'bg-[#14100E]/90 text-[#FAF6F0]'
                  }`}
                >
                  {tile.price ? (
                    <span className="text-[#D4AF37]">${effectivePrice}</span>
                  ) : tile.taxAmount ? (
                    <span className="text-red-400">-${tile.taxAmount}</span>
                  ) : (
                    <span className="text-[7px] md:text-[8px] text-stone-300 uppercase truncate">
                      {tile.type === 'GO'
                        ? '+$200'
                        : tile.type === 'CHANCE'
                        ? 'FORTUNE'
                        : tile.type === 'CHEST'
                        ? 'TREASURY'
                        : tile.shortName}
                    </span>
                  )}
                </div>

                {/* Richup.io Style Ownership Color Ribbon at Bottom Edge */}
                {owner && (
                  <div
                    className="w-full h-1.5 md:h-2"
                    style={{ backgroundColor: owner.color }}
                    title={`Owned by ${owner.name}`}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Clean Richup.io-Inspired Center Courtyard Stage */}
        <div
          style={{
            gridRow: `2 / span ${gridDim - 2}`,
            gridColumn: `2 / span ${gridDim - 2}`,
          }}
          className="rounded-xl bg-[#0E1D17] border border-[#D4AF37]/35 p-3 md:p-5 flex flex-col justify-between text-[#FAF6F0] relative overflow-hidden"
        >
          {/* Top Row of Courtyard: Subtle View Controls + Compact Active Macro Event Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              <span
                className="text-xs md:text-sm font-bold text-[#FAF6F0] tracking-tight"
                style={{ fontFamily: 'var(--font-fraunces), serif' }}
              >
                {boardConfig.shortLabel}
              </span>
              {gameState.activeGlobalEvent && (
                <div
                  className="px-2.5 py-1 rounded-md bg-[#14100E]/90 border border-[#D4AF37]/40 flex items-center gap-1.5 text-[11px]"
                  title={gameState.activeGlobalEvent.event.summary}
                >
                  {gameState.activeGlobalEvent.event.category === 'CRASH' ||
                  gameState.activeGlobalEvent.event.category === 'AUDIT' ? (
                    <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="font-semibold text-[#D4AF37] truncate max-w-[180px] sm:max-w-[260px]">
                    {gameState.activeGlobalEvent.event.title}
                  </span>
                  <span className="text-stone-400 font-mono text-[10px]">
                    ({gameState.activeGlobalEvent.remainingTurns}T)
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoomedMode((z) => !z)}
                className="px-2 py-1 rounded-md bg-[#14100E] border border-white/15 text-stone-300 hover:text-[#D4AF37] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                title="Toggle Zoomed Board View"
              >
                {zoomedMode ? (
                  <>
                    <ZoomOut className="w-3 h-3 text-[#D4AF37]" />
                    <span>Fit</span>
                  </>
                ) : (
                  <>
                    <ZoomIn className="w-3 h-3 text-[#D4AF37]" />
                    <span>Zoom</span>
                  </>
                )}
              </button>
              <button
                onClick={onSwitchTo3D}
                className="px-2.5 py-1 rounded-md bg-[#14100E] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#0F0C0A] transition-colors text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Layers className="w-3 h-3" />
                <span>3D View</span>
              </button>
            </div>
          </div>

          {/* Center Stage: Richup.io Style Dice + Active Turn Action Button */}
          <div className="my-auto flex flex-col items-center justify-center text-center space-y-3 py-2 z-10">
            {/* Active Player Turn Badge + Timer */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#14100E] border border-[#D4AF37]/35 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: currentPlayer?.color }}
              />
              <span className="font-bold text-white">
                {currentPlayer?.name}’s Turn
              </span>
              <span className="text-[#D4AF37] font-mono font-bold tabular-nums">
                (${currentPlayer?.cash})
              </span>
              {gameState.turnTimeLimitSeconds > 0 &&
                remainingSeconds !== null && (
                  <span
                    className={`ml-1 pl-2 border-l border-white/15 font-mono font-bold tabular-nums flex items-center gap-1 ${
                      remainingSeconds <= 10
                        ? 'text-red-400'
                        : 'text-stone-300'
                    }`}
                  >
                    <Clock className="w-3 h-3 text-[#D4AF37]" />
                    {remainingSeconds}s
                  </span>
                )}
            </div>

            {/* Animated 2D Dice Pair */}
            <div className="flex items-center justify-center gap-3">
              <motion.div
                key={`d1-${gameState.logs[0]?.id}-${gameState.dice[0]}`}
                initial={{ rotate: -180, scale: 0.6, y: -12 }}
                animate={{ rotate: 0, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 20 }}
                className="w-11 h-11 md:w-13 md:h-13 rounded-xl bg-[#FAF6F0] border-2 border-[#D4AF37] text-[#0F0C0A] font-mono font-extrabold text-lg md:text-xl flex items-center justify-center shadow-xl"
              >
                {gameState.dice[0]}
              </motion.div>
              <motion.div
                key={`d2-${gameState.logs[0]?.id}-${gameState.dice[1]}`}
                initial={{ rotate: 180, scale: 0.6, y: -12 }}
                animate={{ rotate: 0, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 20 }}
                className="w-11 h-11 md:w-13 md:h-13 rounded-xl bg-[#FAF6F0] border-2 border-[#D4AF37] text-[#0F0C0A] font-mono font-extrabold text-lg md:text-xl flex items-center justify-center shadow-xl"
              >
                {gameState.dice[1]}
              </motion.div>
            </div>

            <div className="text-xs text-stone-300">
              On{' '}
              <strong className="text-[#FAF6F0]">
                #{currentTile.index} {currentTile.name}
              </strong>{' '}
              <span className="text-stone-400">({currentTile.city})</span>
            </div>

            {/* Primary Turn CTA Buttons (Centered like Richup.io) */}
            {isMyTurn && gameState.status === 'PLAYING' ? (
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                {gameState.phase === 'ROLL' && (
                  <>
                    <button
                      onClick={() => onDispatchAction({ type: 'ROLL_DICE' })}
                      className="px-6 py-2.5 rounded-xl bg-[#D4AF37] text-[#0F0C0A] font-extrabold text-sm hover:bg-[#e5c247] shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Dices className="w-4 h-4" />
                      <span>Roll Dice</span>
                    </button>
                    {currentPlayer?.inJail && currentPlayer.cash >= 50 && (
                      <button
                        onClick={() =>
                          onDispatchAction({ type: 'PAY_JAIL_BAIL' })
                        }
                        className="px-3.5 py-2.5 rounded-xl bg-[#14100E] border border-white/15 text-xs font-semibold text-stone-200 hover:border-[#D4AF37] cursor-pointer"
                      >
                        Pay $50 Bail
                      </button>
                    )}
                  </>
                )}

                {gameState.phase === 'ACTION' && (
                  <>
                    <button
                      onClick={() =>
                        onDispatchAction({ type: 'BUY_PROPERTY' })
                      }
                      disabled={currentPlayer.cash < currentEffectivePrice}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-sm hover:bg-emerald-500 disabled:opacity-40 shadow-lg transition-all cursor-pointer"
                    >
                      Buy {currentTile.shortName} (${currentEffectivePrice})
                    </button>
                    <button
                      onClick={() =>
                        onDispatchAction({ type: 'DECLINE_PROPERTY' })
                      }
                      className="px-4 py-2.5 rounded-xl bg-[#14100E] border border-[#D4AF37]/50 text-[#D4AF37] font-bold text-xs hover:bg-stone-900 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      <span>Auction</span>
                    </button>
                  </>
                )}

                {gameState.phase === 'END_TURN' && (
                  <button
                    onClick={() => onDispatchAction({ type: 'END_TURN' })}
                    className="px-6 py-2.5 rounded-xl bg-[#D4AF37] text-[#0F0C0A] font-extrabold text-sm hover:bg-[#e5c247] shadow-lg transition-all cursor-pointer"
                  >
                    {gameState.lastRollWasDoubles
                      ? 'Roll Again (Doubles!)'
                      : 'End Turn →'}
                  </button>
                )}

                {onOpenTrade && (
                  <button
                    onClick={onOpenTrade}
                    className="px-3.5 py-2.5 rounded-xl bg-[#14100E] border border-white/15 text-stone-200 hover:border-[#D4AF37] text-xs font-semibold cursor-pointer"
                  >
                    Trade
                  </button>
                )}
              </div>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-[#14100E]/90 border border-white/10 text-xs text-stone-300">
                <strong className="text-[#D4AF37]">
                  {currentPlayer?.name}
                </strong>{' '}
                is taking their turn...
              </div>
            )}
          </div>

          {/* Bottom Strip of Courtyard: Compact Selected/Hovered Space Bar */}
          <div className="rounded-xl bg-[#14100E]/95 border border-white/15 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs z-10">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-xs shrink-0 border border-white/25"
                style={{ backgroundColor: focusedTile.colorHex }}
              />
              <span className="font-bold text-white truncate">
                #{focusedTile.index} {focusedTile.name}
              </span>
              <span className="text-stone-400 hidden sm:inline">
                ({ COLOR_GROUP_NAMES[focusedTile.group] })
              </span>
              {focusedTile.price && (
                <span className="font-mono font-bold text-[#D4AF37]">
                  · ${focusedEffectivePrice}
                </span>
              )}
              {focusedOwner && (
                <span className="text-stone-300 truncate">
                  · Owned by{' '}
                  <strong style={{ color: focusedOwner.color }}>
                    {focusedOwner.name.split(' ')[0]}
                  </strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {canBuildFocused && (
                <button
                  onClick={() =>
                    onDispatchAction({
                      type: 'BUILD_HOUSE',
                      playerId: currentPlayer.id,
                      tileIndex: focusedTile.index,
                    })
                  }
                  className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-500 flex items-center gap-1 cursor-pointer"
                >
                  <Building2 className="w-3 h-3" />
                  <span>Build (${focusedEffectiveHouseCost})</span>
                </button>
              )}
              <button
                onClick={() => onSelectTile(focusedTile.index, true)}
                className="px-2.5 py-1 rounded-md bg-[#0F0C0A] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#0F0C0A] transition-colors text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Globe className="w-3 h-3" />
                <span>Deed & Intel</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

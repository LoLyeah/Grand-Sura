'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  Clock,
  Dices,
  Globe,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BOARD_SIZE_CONFIGS,
  BoardSizeId,
  BoardTile,
  COLOR_GROUP_NAMES,
  getBoardTiles,
} from '@/lib/monopoly-data';
import {
  applyGameAction,
  calculateRent,
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
}

/**
 * Computes 1-based CSS Grid (row, col) coordinates for any perimeter tile index (0 .. sideLength*4 - 1)
 * on an (sideLength + 1) x (sideLength + 1) square board.
 * - Index 0 (GO): Bottom-Right corner (row = N, col = N)
 * - 0..sideLength: Bottom row right-to-left (row = N, col = N - index)
 * - sideLength (JAIL): Bottom-Left corner (row = N, col = 1)
 * - sideLength..2*sideLength: Left column bottom-to-top (row = N - (index - sideLength), col = 1)
 * - 2*sideLength (FREE_PARKING): Top-Left corner (row = 1, col = 1)
 * - 2*sideLength..3*sideLength: Top row left-to-right (row = 1, col = 1 + (index - 2*sideLength))
 * - 3*sideLength (GO_TO_JAIL): Top-Right corner (row = 1, col = N)
 * - 3*sideLength..4*sideLength-1: Right column top-to-bottom (row = 1 + (index - 3*sideLength), col = N)
 */
function getGridPosition(
  index: number,
  sideLength: number
): { row: number; col: number } {
  const N = sideLength + 1;
  if (index <= sideLength) {
    return { row: N, col: N - index };
  }
  if (index <= sideLength * 2) {
    const offset = index - sideLength;
    return { row: N - offset, col: 1 };
  }
  if (index <= sideLength * 3) {
    const offset = index - sideLength * 2;
    return { row: 1, col: 1 + offset };
  }
  const offset = index - sideLength * 3;
  return { row: 1 + offset, col: N };
}

export default function MonopolyBoard2D({
  gameState,
  selectedTileIndex,
  onSelectTile,
  onDispatchAction,
  isMyTurn,
  remainingSeconds,
  onSwitchTo3D,
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
  const gridDim = boardConfig.gridDimension; // 7, 11, or 14

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
            // Hop tile-by-tile for normal rolls (<= 16 spaces), or jump directly for Detention
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

  // Magnifier tile in center hub: shows hovered tile or currently selected tile
  const focusedIndex =
    hoveredTileIndex !== null && hoveredTileIndex < tiles.length
      ? hoveredTileIndex
      : selectedTileIndex < tiles.length
      ? selectedTileIndex
      : 0;
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
    canBuildHouseOnTile(gameState, currentPlayer.id, focusedTile.index).allowed;

  return (
    <div className="fixed inset-0 top-14 bottom-24 z-10 overflow-auto bg-[#0F0C0A] px-3 py-2 md:px-6 md:py-3 flex flex-col items-center justify-start select-none">
      {/* Top Toolbar for 2D Board Readability & Board Size Switcher */}
      <div className="w-full max-w-[1440px] flex flex-wrap items-center justify-between gap-3 mb-2 px-4 py-2.5 rounded-xl bg-[#14100E] border border-[#D4AF37]/30 text-xs text-[#FAF6F0]">
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
          <span className="font-bold text-[#D4AF37] whitespace-nowrap">
            2D High-Contrast Tabletop
          </span>
          <span aria-hidden="true" className="text-stone-500">
            ·
          </span>
          <span className="font-medium text-[#FAF6F0] whitespace-nowrap">
            {boardConfig.name}
          </span>
          <span aria-hidden="true" className="text-stone-500">
            ·
          </span>
          <span className="text-stone-300 whitespace-nowrap">
            {boardConfig.recommendedPlayers}
          </span>
          <span aria-hidden="true" className="text-stone-500">
            ·
          </span>
          <span
            className="text-emerald-300 font-medium tabular-nums whitespace-nowrap"
            title="Tiles with at least one active player are highlighted with a warm gold glow and player beacon"
          >
            Occupied Spaces:{' '}
            {
              new Set(
                gameState.players
                  .filter((p) => !p.bankrupt)
                  .map((p) => visualPositions[p.id] ?? p.position)
              ).size
            }
          </span>
        </div>

        {/* Quick Board Size Selector with Recommended Player Counts */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-stone-400 text-[11px] mr-1 whitespace-nowrap">
            Board Size:
          </span>
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
            const active = gameState.boardSize === sizeId;
            return (
              <button
                key={sizeId}
                onClick={() =>
                  onDispatchAction({
                    type: 'CHANGE_BOARD_SIZE',
                    boardSize: sizeId,
                  })
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                  active
                    ? 'bg-[#D4AF37] text-[#0F0C0A]'
                    : 'bg-[#0F0C0A] text-stone-300 border border-white/10 hover:border-[#D4AF37]/50'
                }`}
                title={`${cfg.name} — ${cfg.recommendedPlayers}`}
              >
                <span>{cfg.shortLabel}</span>
                <span
                  className={`text-[10px] tabular-nums ${
                    active ? 'text-[#0F0C0A]/80' : 'text-[#D4AF37]'
                  }`}
                >
                  ({cfg.recommendedMinPlayers}–{cfg.recommendedMaxPlayers}P)
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setZoomedMode((z) => !z)}
            className="px-2.5 py-1 rounded-lg bg-[#0F0C0A] border border-white/15 text-stone-200 hover:border-[#D4AF37] text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            title="Toggle Extra-Large Tile Text Zoom"
          >
            {zoomedMode ? (
              <>
                <ZoomOut className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Fit View</span>
              </>
            ) : (
              <>
                <ZoomIn className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Enlarge Tiles</span>
              </>
            )}
          </button>

          <button
            onClick={onSwitchTo3D}
            className="px-2.5 py-1 rounded-lg bg-stone-800 text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-stone-700 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            Switch to 3D View
          </button>
        </div>
      </div>

      {/* Main 2D Square / Rectangular CSS Grid Board */}
      <div
        className={`w-full ${
          zoomedMode
            ? 'min-w-[1480px] min-h-[1280px] max-w-[1920px]'
            : sideLength >= 21
            ? 'min-w-[1540px] min-h-[1320px] max-w-[1860px]'
            : sideLength >= 17
            ? 'min-w-[1280px] min-h-[1080px] max-w-[1640px]'
            : 'max-w-[1440px] flex-1 min-h-[620px]'
        } rounded-2xl bg-[#1A130F] border-2 border-[#D4AF37]/55 shadow-2xl p-1.5 md:p-2 grid gap-1`}
        style={{
          gridTemplateColumns: `repeat(${gridDim}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridDim}, minmax(0, 1fr))`,
        }}
      >
        {/* Render All Perimeter Tiles with Upright High-Contrast Text */}
        {tiles.map((tile) => {
          const { row, col } = getGridPosition(tile.index, sideLength);
          const isCorner = tile.index % sideLength === 0;
          const prop = gameState.properties[tile.index];
          const owner = prop?.ownerId
            ? gameState.players.find((p) => p.id === prop.ownerId)
            : null;
          const occupants = gameState.players.filter(
            (p) => !p.bankrupt && (visualPositions[p.id] ?? p.position) === tile.index
          );
          const isOccupied = occupants.length > 0;
          const hasActiveTurnPlayer = occupants.some(
            (p) => p.id === currentPlayer?.id
          );
          const primaryOccupantColor =
            occupants.find((p) => p.id === currentPlayer?.id)?.color ||
            occupants[0]?.color;
          const isSelected = selectedTileIndex === tile.index;
          const isHovered = hoveredTileIndex === tile.index;
          const effectivePrice = getEffectivePropertyPrice(
            gameState,
            tile.index
          );
          const basePrice = tile.price || 0;
          const priceModified =
            basePrice > 0 && effectivePrice !== basePrice;

          return (
            <div
              key={tile.index}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTile(tile.index, false)}
              onDoubleClick={() => onSelectTile(tile.index, true)}
              onMouseEnter={() => setHoveredTileIndex(tile.index)}
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
              className={`relative flex flex-col justify-between rounded-lg overflow-hidden transition-all cursor-pointer text-left p-1 md:p-1.5 border ${
                isCorner
                  ? isOccupied
                    ? 'bg-[#231B13] text-[#FAF6F0]'
                    : 'bg-[#17120E] text-[#FAF6F0]'
                  : prop?.mortgaged
                  ? 'bg-stone-300 text-stone-900'
                  : isOccupied
                  ? 'bg-[#FFF5D6] text-[#14100E]'
                  : 'bg-[#FAF6F0] text-[#14100E]'
              } ${
                isSelected || isHovered
                  ? 'ring-2 ring-[#D4AF37] border-[#D4AF37] z-10 scale-[1.02] shadow-lg'
                  : isOccupied
                  ? hasActiveTurnPlayer
                    ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/85 shadow-[0_0_14px_rgba(212,175,55,0.35)] z-[5]'
                    : 'border-[#D4AF37]/85 ring-1 ring-[#D4AF37]/55 shadow-[0_0_10px_rgba(212,175,55,0.22)] z-[5]'
                  : 'border-stone-800/80 hover:border-[#D4AF37]'
              }`}
            >
              {/* Subtle Left/Top Occupancy Beacon Strip when Occupied */}
              {isOccupied && (
                <div
                  className="w-full h-1 rounded-full mb-0.5 shrink-0 flex items-center overflow-hidden"
                  title={`Occupied by: ${occupants.map((p) => p.name).join(', ')}`}
                >
                  {occupants.map((occ) => (
                    <span
                      key={occ.id}
                      className="h-full flex-1"
                      style={{ backgroundColor: occ.color }}
                    />
                  ))}
                </div>
              )}

              {/* Top Color Header Bar + City Name + Space Index */}
              <div
                className="w-full rounded-xs px-1 py-0.5 flex items-center justify-between gap-1 shrink-0"
                style={{
                  backgroundColor:
                    tile.type === 'PROPERTY' ||
                    tile.type === 'RAILROAD' ||
                    tile.type === 'UTILITY'
                      ? tile.colorHex
                      : '#1C1613',
                }}
              >
                <span
                  className="text-[9px] md:text-[10px] font-bold uppercase tracking-tight truncate px-0.5 rounded-xs"
                  style={{
                    color: '#FAF6F0',
                    backgroundColor: 'rgba(15, 12, 10, 0.72)',
                  }}
                >
                  {tile.city}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  {isOccupied && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1 rounded-xs text-[8px] font-extrabold bg-[#D4AF37] text-[#0F0C0A]"
                      title={`${occupants.length} player(s) on this tile: ${occupants
                        .map((o) => o.name)
                        .join(', ')}`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: primaryOccupantColor || '#0F0C0A',
                        }}
                      />
                      {occupants.length}P
                    </span>
                  )}
                  <span className="text-[9px] font-mono font-bold text-white/90 bg-black/55 px-1 rounded-xs">
                    #{tile.index}
                  </span>
                </div>
              </div>

              {/* Center Upright Landmark Name (Clearly Readable!) */}
              <div className="my-auto py-0.5 px-0.5 flex flex-col justify-center">
                <div
                  className={`font-extrabold leading-tight tracking-tight break-words ${
                    isCorner
                      ? 'text-[11px] md:text-xs text-[#D4AF37]'
                      : zoomedMode
                      ? 'text-xs md:text-sm text-[#0F0C0A]'
                      : sideLength === 13
                      ? 'text-[10px] md:text-[11px] text-[#0F0C0A]'
                      : 'text-[11px] md:text-xs text-[#0F0C0A]'
                  }`}
                >
                  {tile.shortName}
                </div>
                {!isCorner && tile.name !== tile.shortName && zoomedMode && (
                  <div className="text-[10px] text-stone-600 leading-tight truncate">
                    {tile.name}
                  </div>
                )}
              </div>

              {/* Bottom Footer: Price / Tax + Owner Ribbon + Houses + Player Tokens */}
              <div className="space-y-0.5 shrink-0">
                {/* Owner & Houses Bar */}
                {owner && (
                  <div
                    className="w-full px-1 py-0.5 rounded-xs text-[9px] font-bold flex items-center justify-between text-[#0F0C0A]"
                    style={{ backgroundColor: owner.color }}
                  >
                    <span className="truncate">
                      {prop?.mortgaged ? 'MORTGAGED' : owner.name.split(' ')[0]}
                    </span>
                    {prop && prop.houses > 0 && (
                      <motion.span
                        key={`${tile.index}-h-${prop.houses}`}
                        initial={{ scale: 0.3, y: -4 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 18,
                        }}
                        className="px-1 rounded-xs bg-black/80 text-[#D4AF37] font-mono"
                      >
                        {prop.houses === 5 ? 'HOTEL' : `${prop.houses}V`}
                      </motion.span>
                    )}
                  </div>
                )}

                {/* Price / Special Action Strip */}
                <div className="w-full px-1 py-0.5 rounded-xs bg-[#14100E] text-[#FAF6F0] flex items-center justify-between gap-1 text-[10px] md:text-[11px] font-mono font-bold tabular-nums">
                  {tile.price ? (
                    <span
                      className={
                        priceModified
                          ? effectivePrice < basePrice
                            ? 'text-emerald-400'
                            : 'text-amber-300'
                          : 'text-[#D4AF37]'
                      }
                    >
                      ${effectivePrice}
                    </span>
                  ) : tile.taxAmount ? (
                    <span className="text-red-400">-${tile.taxAmount}</span>
                  ) : (
                    <span className="text-[#D4AF37] text-[9px] uppercase">
                      {tile.type === 'GO'
                        ? '+$200 GO'
                        : tile.type === 'CHANCE'
                        ? 'FORTUNE'
                        : tile.type === 'CHEST'
                        ? 'TREASURY'
                        : tile.shortName}
                    </span>
                  )}

                  {/* Animated Player Token Badges on this Tile (hops tile-by-tile with layoutId!) */}
                  <div className="flex items-center -space-x-1">
                    <AnimatePresence mode="popLayout">
                      {occupants.map((p) => {
                        const isActivePlayer = p.id === currentPlayer?.id;
                        return (
                          <motion.span
                            layout
                            layoutId={`token-2d-${p.id}`}
                            key={p.id}
                            initial={{ scale: 0.4, y: -8, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0, rotate: 160, opacity: 0 }}
                            transition={{
                              type: 'spring',
                              stiffness: 380,
                              damping: 22,
                            }}
                            title={`${p.name} ($${p.cash})`}
                            className={`inline-flex items-center justify-center w-4 h-4 md:w-5 md:h-5 rounded-full text-[9px] font-extrabold text-[#0F0C0A] border ${
                              isActivePlayer
                                ? 'border-white ring-2 ring-[#D4AF37]'
                                : 'border-black'
                            }`}
                            style={{ backgroundColor: p.color }}
                          >
                            {p.name.slice(0, 2).toUpperCase()}
                          </motion.span>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Central Courtyard Dashboard (Spans Inner Square of the Grid) */}
        <div
          style={{
            gridRow: `2 / span ${gridDim - 2}`,
            gridColumn: `2 / span ${gridDim - 2}`,
          }}
          className="rounded-xl bg-[#11221C] border border-[#D4AF37]/40 p-3 md:p-5 flex flex-col justify-between gap-3 overflow-y-auto text-[#FAF6F0]"
        >
          {/* Top Center Header: Grand Estates Emblem + Turn Timer + Active Turn */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/25 pb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#D4AF37] font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {boardConfig.name} · {boardConfig.recommendedPlayers}
                </span>
              </div>
              <h2
                className="text-lg md:text-2xl font-bold text-[#FAF6F0]"
                style={{ fontFamily: 'var(--font-fraunces), serif' }}
              >
                Grand Estates — 2D Strategic Overview
              </h2>
            </div>

            {/* Live Turn Countdown Clock in Center Hub */}
            <div className="flex items-center gap-3">
              {gameState.turnTimeLimitSeconds > 0 &&
                remainingSeconds !== null && (
                  <div
                    className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-xs font-mono font-bold tabular-nums ${
                      remainingSeconds <= 10
                        ? 'bg-red-950/90 border-red-400 text-red-200'
                        : remainingSeconds <= 20
                        ? 'bg-amber-950/90 border-amber-400 text-amber-200'
                        : 'bg-[#0F0C0A] border-[#D4AF37]/40 text-[#D4AF37]'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>
                      Turn Clock: {remainingSeconds}s /{' '}
                      {gameState.turnTimeLimitSeconds}s
                    </span>
                  </div>
                )}

              <div className="px-3 py-1.5 rounded-lg bg-[#0F0C0A] border border-white/15 flex items-center gap-2 text-xs">
                <span
                  className="w-3 h-3 rounded-xs shrink-0"
                  style={{ backgroundColor: currentPlayer?.color }}
                />
                <span className="font-bold">{currentPlayer?.name}</span>
                <span className="text-[#D4AF37] font-mono font-bold tabular-nums">
                  ${currentPlayer?.cash}
                </span>
              </div>
            </div>
          </div>

          {/* Middle Section: 2-Column Layout — Live Magnified Tile Card + Quick Turn & Board Size Info */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 my-auto">
            {/* Left 7 Cols: Live Magnified Tile Deed Card (Hover or Click any tile to read in large text) */}
            <div className="lg:col-span-7 rounded-xl bg-[#14100E] border border-[#D4AF37]/40 p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-2.5">
                <div>
                  <div className="flex items-center gap-2 text-xs text-stone-400">
                    <span className="font-mono text-[#D4AF37] font-bold">
                      Space #{focusedTile.index}
                    </span>
                    <span>·</span>
                    <span>
                      {focusedTile.city}, {focusedTile.country}
                    </span>
                    <span>·</span>
                    <span>{COLOR_GROUP_NAMES[focusedTile.group]}</span>
                  </div>
                  <h3
                    className="text-xl md:text-2xl font-bold text-white mt-0.5 flex items-center gap-2.5"
                    style={{ fontFamily: 'var(--font-fraunces), serif' }}
                  >
                    <span
                      className="inline-block w-4 h-4 rounded-xs border border-white/25 shrink-0"
                      style={{ backgroundColor: focusedTile.colorHex }}
                    />
                    <span>{focusedTile.name}</span>
                  </h3>
                  <p className="text-xs md:text-sm text-stone-300 mt-1 leading-relaxed">
                    {focusedTile.description}
                  </p>
                </div>

                {focusedTile.price && (
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-[11px] text-stone-400">
                      Market Price
                    </div>
                    <div className="text-xl font-bold text-[#D4AF37]">
                      ${focusedEffectivePrice}
                    </div>
                  </div>
                )}
              </div>

              {/* Rent Schedule Table in Large Easy-to-Read Type */}
              {focusedTile.rent && focusedTile.rent.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-xs">
                  {focusedTile.type === 'PROPERTY' ? (
                    [
                      ['Base', focusedTile.rent[0]],
                      ['1 Villa', focusedTile.rent[1]],
                      ['2 Villas', focusedTile.rent[2]],
                      ['3 Villas', focusedTile.rent[3]],
                      ['4 Villas', focusedTile.rent[4]],
                      ['Hotel', focusedTile.rent[5]],
                    ].map(([label, val], rIdx) => (
                      <div
                        key={String(label)}
                        className={`p-1.5 rounded-lg border ${
                          focusedProp?.houses === rIdx && focusedOwner
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white font-bold'
                            : 'bg-[#0F0C0A] border-white/10 text-stone-300'
                        }`}
                      >
                        <div className="text-[10px] text-stone-400">
                          {label}
                        </div>
                        <div className="font-mono font-bold text-[#D4AF37] tabular-nums mt-0.5">
                          ${val}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-6 p-2 rounded-lg bg-[#0F0C0A] border border-white/10 text-left flex items-center justify-between">
                      <span className="text-stone-300">
                        Current Calculated Rent (Dice{' '}
                        {gameState.dice[0] + gameState.dice[1]}):
                      </span>
                      <span className="font-mono font-bold text-[#D4AF37]">
                        $
                        {calculateRent(
                          gameState,
                          focusedTile.index,
                          gameState.dice[0] + gameState.dice[1]
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-[#0F0C0A] border border-white/10 text-xs text-stone-300">
                  Special Board Space — Click &ldquo;Inspect Landmark & Google
                  Search&rdquo; below for live city facts.
                </div>
              )}

              {/* Focused Tile Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="text-xs text-stone-300">
                  Owner:{' '}
                  <strong className="text-white">
                    {focusedOwner
                      ? `${focusedOwner.name} (${
                          focusedProp?.houses === 5
                            ? 'Grand Hotel'
                            : `${focusedProp?.houses || 0} Villas`
                        })`
                      : focusedTile.price
                      ? 'Unowned (Available)'
                      : 'Sovereign Authority'}
                  </strong>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canBuildFocused && (
                    <button
                      onClick={() =>
                        onDispatchAction({
                          type: 'BUILD_HOUSE',
                          playerId: currentPlayer.id,
                          tileIndex: focusedTile.index,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 flex items-center gap-1"
                      title="Shortcut: Press 'B' while a property is selected to build"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>[B] Build (+${focusedEffectiveHouseCost})</span>
                    </button>
                  )}
                  <button
                    onClick={() => onSelectTile(focusedTile.index, true)}
                    className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0F0C0A] text-xs font-bold hover:bg-[#e5c247] flex items-center gap-1.5"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Full Deed & Google Search</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Active Turn Controls + Board Size Guide */}
            <div className="lg:col-span-5 rounded-xl bg-[#14100E] border border-[#D4AF37]/40 p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#D4AF37]">
                    Active Turn Command
                  </span>
                  <div className="flex items-center gap-1.5">
                    <motion.div
                      key={`die1-${gameState.logs[0]?.id}-${gameState.dice[0]}`}
                      initial={{ rotate: -180, scale: 0.6, y: -10 }}
                      animate={{
                        rotate: gameState.phase === 'ROLL' ? [0, -8, 8, 0] : 0,
                        scale: 1,
                        y: 0,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 340,
                        damping: 18,
                      }}
                      className="w-7 h-7 rounded-md bg-[#FAF6F0] border-2 border-[#D4AF37] text-[#0F0C0A] font-mono font-extrabold text-xs flex items-center justify-center shadow"
                    >
                      {gameState.dice[0]}
                    </motion.div>
                    <motion.div
                      key={`die2-${gameState.logs[0]?.id}-${gameState.dice[1]}`}
                      initial={{ rotate: 180, scale: 0.6, y: -10 }}
                      animate={{
                        rotate: gameState.phase === 'ROLL' ? [0, 8, -8, 0] : 0,
                        scale: 1,
                        y: 0,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 340,
                        damping: 18,
                      }}
                      className="w-7 h-7 rounded-md bg-[#FAF6F0] border-2 border-[#D4AF37] text-[#0F0C0A] font-mono font-extrabold text-xs flex items-center justify-center shadow"
                    >
                      {gameState.dice[1]}
                    </motion.div>
                    <span className="font-mono text-xs font-bold text-[#D4AF37] bg-[#0F0C0A] px-2 py-1 rounded border border-white/10 flex items-center gap-1">
                      <Dices className="w-3.5 h-3.5 text-[#D4AF37]" />=
                      {gameState.dice[0] + gameState.dice[1]}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0F0C0A] border border-white/10 text-xs space-y-1">
                  <div className="text-stone-400">
                    Current Position ({currentPlayer?.name}):
                  </div>
                  <div className="text-sm font-bold text-white">
                    #{currentTile.index} {currentTile.name} ({currentTile.city})
                  </div>
                </div>

                {/* Direct Action Buttons inside 2D Center Hub */}
                {isMyTurn && gameState.status === 'PLAYING' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {gameState.phase === 'ROLL' && (
                      <button
                        onClick={() => onDispatchAction({ type: 'ROLL_DICE' })}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#D4AF37] text-[#0F0C0A] font-bold text-xs hover:bg-[#e5c247] transition-colors"
                      >
                        Roll Dice ({currentPlayer?.name})
                      </button>
                    )}
                    {gameState.phase === 'ACTION' && (
                      <>
                        <button
                          onClick={() =>
                            onDispatchAction({ type: 'BUY_PROPERTY' })
                          }
                          disabled={currentPlayer.cash < currentEffectivePrice}
                          className="flex-1 py-2.5 px-3 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 disabled:opacity-40"
                        >
                          Buy {currentTile.shortName} (${currentEffectivePrice})
                        </button>
                        <button
                          onClick={() =>
                            onDispatchAction({ type: 'DECLINE_PROPERTY' })
                          }
                          className="py-2.5 px-3 rounded-lg bg-stone-800 border border-[#D4AF37]/40 text-[#D4AF37] font-semibold text-xs hover:bg-stone-700"
                        >
                          Auction
                        </button>
                      </>
                    )}
                    {gameState.phase === 'END_TURN' && (
                      <button
                        onClick={() => onDispatchAction({ type: 'END_TURN' })}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#D4AF37] text-[#0F0C0A] font-bold text-xs hover:bg-[#e5c247]"
                      >
                        {gameState.lastRollWasDoubles
                          ? 'Roll Again (Doubles!)'
                          : 'End Turn →'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Active Macro Event or Board Size Recommendation Matrix */}
              {gameState.activeGlobalEvent ? (
                <div className="p-2.5 rounded-lg bg-[#1A130F] border border-[#D4AF37]/40 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-[#D4AF37] font-semibold">
                    {gameState.activeGlobalEvent.event.category === 'CRASH' ||
                    gameState.activeGlobalEvent.event.category === 'AUDIT' ? (
                      <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>
                      {gameState.activeGlobalEvent.event.title} (
                      {gameState.activeGlobalEvent.remainingTurns}T left)
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-300">
                    {gameState.activeGlobalEvent.event.impactLabel}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-[#0F0C0A] border border-white/10 text-[11px] text-stone-300 space-y-0.5">
                  <div className="font-semibold text-[#D4AF37]">
                    Board Size & Player Matrix (Up to 16 Players):
                  </div>
                  <div>• Mini (24 Spaces): 2–3 Players ($1,200)</div>
                  <div>• Classic (40 Spaces): 3–5 Players ($1,500)</div>
                  <div>• Mega (52 Spaces): 5–8 Players ($2,000)</div>
                  <div>• Continental (68 Spaces): 8–12 Players ($2,500)</div>
                  <div>• Colossal (84 Spaces): 12–16 Players ($3,000)</div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Strip of Center Hub: Latest Log Line */}
          <div className="text-xs text-stone-300 border-t border-[#D4AF37]/20 pt-2 flex items-center justify-between gap-2">
            <span className="truncate">
              <strong className="text-[#D4AF37]">Latest Action:</strong>{' '}
              {gameState.logs[0]?.text}
            </span>
            <span className="text-[11px] text-stone-400 shrink-0">
              Hover any space to magnify · Double-click for Google Search
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

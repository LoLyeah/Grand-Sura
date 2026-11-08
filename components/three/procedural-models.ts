import * as THREE from 'three';
import { BOARD_TILES, BoardTile, TokenArchetype } from '@/lib/monopoly-data';

/**
 * Generates a soft radial contact shadow texture to ground all 3D tokens & buildings
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a procedural mahogany wood grain texture + bump texture
 */
export function createMahoganyTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#24120B';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 220; i++) {
    const y = Math.random() * 512;
    const h = 2 + Math.random() * 8;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(58, 26, 14, 0.35)' : 'rgba(18, 8, 5, 0.35)';
    ctx.fillRect(0, y, 512, h);
  }

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 180; i++) {
    bCtx.fillStyle = i % 2 === 0 ? '#909090' : '#707070';
    bCtx.fillRect(0, Math.random() * 256, 256, 1 + Math.random() * 2);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

/**
 * Generates the central emerald felt & gold medallion texture for the board
 */
export function createBoardCenterTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Velvet emerald radial backdrop
  const grad = ctx.createRadialGradient(512, 512, 60, 512, 512, 700);
  grad.addColorStop(0, '#124A3B');
  grad.addColorStop(0.65, '#0C3328');
  grad.addColorStop(1, '#071F18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle geometric guilloche grid lines
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
  ctx.lineWidth = 2;
  for (let i = 64; i < 1024; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 40);
    ctx.lineTo(i, 984);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(40, i);
    ctx.lineTo(984, i);
    ctx.stroke();
  }

  // Outer double gold border
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, 968, 968);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(42, 42, 940, 940);

  // Compass rose rings
  ctx.save();
  ctx.translate(512, 512);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 260, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 195, 0, Math.PI * 2);
  ctx.stroke();

  // Diagonal banner
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#0F0C0A';
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 5;
  ctx.fillRect(-330, -68, 660, 136);
  ctx.strokeRect(-330, -68, 660, 136);

  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GRAND ESTATES', 0, -10);

  ctx.fillStyle = '#FAF6F0';
  ctx.font = '600 20px sans-serif';
  ctx.fillText('SOVEREIGN WORLD LANDMARKS · EDITION III', 0, 36);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates high-DPI, high-contrast procedural CanvasTexture for each board tile.
 * Automatically orients ALL 4 EDGES (Bottom, Left, Top, Right) so that in 3D Top-Down and Overview modes,
 * every single tile's text is 100% HORIZONTAL (left-to-right, upright) and uses large, ultra-bold typography.
 */
export function createTileTexture(
  tile: BoardTile,
  maxAnisotropy: number,
  ownerColor: string | null = null,
  isMortgaged = false,
  sideLength = 10
): THREE.CanvasTexture {
  const isCorner = tile.index % sideLength === 0;
  const isBottomEdge = !isCorner && tile.index > 0 && tile.index < sideLength;
  const isLeftEdge =
    !isCorner && tile.index > sideLength && tile.index < sideLength * 2;
  const isTopEdge =
    !isCorner && tile.index > sideLength * 2 && tile.index < sideLength * 3;
  const isRightEdge =
    !isCorner && tile.index > sideLength * 3 && tile.index < sideLength * 4;

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  // High-contrast warm ivory card surface
  ctx.fillStyle = isMortgaged ? '#CBD5E1' : '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  // Outer bold frame
  ctx.strokeStyle = '#14100E';
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  if (isCorner) {
    // Corner medallion styling (always upright because corner rotationY = 0)
    ctx.fillStyle = '#14100E';
    ctx.fillRect(24, 24, w - 48, h - 48);

    ctx.strokeStyle = tile.colorHex;
    ctx.lineWidth = 12;
    ctx.strokeRect(44, 44, w - 88, h - 88);

    ctx.fillStyle = tile.colorHex;
    ctx.font = '900 92px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tile.shortName.toUpperCase(), w / 2, 260, w - 110);

    ctx.fillStyle = '#FAF6F0';
    ctx.font = '800 54px sans-serif';
    ctx.fillText(tile.city.toUpperCase(), w / 2, 395, w - 110);

    ctx.fillStyle = '#D4AF37';
    ctx.font = '900 52px monospace';
    if (tile.type === 'GO') {
      ctx.fillText('+$200 GO', w / 2, 535, w - 100);
    } else if (tile.type === 'JAIL') {
      ctx.fillText('DETENTION', w / 2, 535, w - 100);
    } else if (tile.type === 'FREE_PARKING') {
      ctx.fillText('SANCTUARY', w / 2, 535, w - 100);
    } else if (tile.type === 'GO_TO_JAIL') {
      ctx.fillText('SUBPOENA', w / 2, 535, w - 100);
    }
  } else {
    const hasColorHeader =
      tile.type === 'PROPERTY' ||
      tile.type === 'RAILROAD' ||
      tile.type === 'UTILITY';

    // 1. Keep property color header band on the inner board edge (top of canvas in local tile space)
    if (hasColorHeader) {
      ctx.fillStyle = tile.colorHex;
      ctx.fillRect(16, 16, w - 32, 165);

      ctx.fillStyle = '#14100E';
      ctx.fillRect(16, 181, w - 32, 12);
    } else {
      ctx.fillStyle = '#181310';
      ctx.fillRect(16, 16, w - 32, 140);
    }

    // 2. Rotate the text canvas so that in 3D World Space, ALL 4 EDGES read horizontally left-to-right!
    ctx.save();
    ctx.translate(w / 2, h / 2);
    if (isTopEdge) {
      ctx.rotate(Math.PI);
    } else if (isLeftEdge) {
      ctx.rotate(Math.PI / 2);
    } else if (isRightEdge) {
      ctx.rotate(-Math.PI / 2);
    }
    ctx.translate(-w / 2, -h / 2);

    // For Left/Right edges, the color band is on the right/left side of the rotated coordinate frame;
    // Center our upright text cleanly in the bright white body of the tile
    const textCenterX = isLeftEdge
      ? w * 0.42
      : isRightEdge
      ? w * 0.58
      : w * 0.5;
    const maxTextW = isLeftEdge || isRightEdge ? w * 0.68 : w - 64;

    // Top City Pill Badge
    const cityY = isBottomEdge ? 245 : isTopEdge ? 140 : 165;
    ctx.fillStyle = '#14100E';
    ctx.fillRect(
      textCenterX - maxTextW * 0.46,
      cityY - 42,
      maxTextW * 0.92,
      78
    );
    ctx.fillStyle = '#D4AF37';
    ctx.font = '900 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tile.city.toUpperCase(), textCenterX, cityY, maxTextW * 0.86);

    // Center HUGE Landmark Short Name (100% upright & horizontal on all 4 sides)
    ctx.fillStyle = '#0F0C0A';
    ctx.font = '900 82px sans-serif';
    const words = tile.shortName.toUpperCase().split(' ');
    const nameY = isBottomEdge ? 415 : isTopEdge ? 335 : 370;

    if (words.length >= 2) {
      ctx.fillText(words[0], textCenterX, nameY - 46, maxTextW);
      ctx.fillText(
        words.slice(1).join(' '),
        textCenterX,
        nameY + 46,
        maxTextW
      );
    } else {
      ctx.fillText(tile.shortName.toUpperCase(), textCenterX, nameY, maxTextW);
    }

    // Owner Ribbon if owned
    if (ownerColor) {
      const ribbonY = isBottomEdge ? 535 : isTopEdge ? 465 : 500;
      ctx.fillStyle = ownerColor;
      ctx.fillRect(
        textCenterX - maxTextW * 0.46,
        ribbonY - 34,
        maxTextW * 0.92,
        68
      );
      ctx.fillStyle = '#0F0C0A';
      ctx.font = '900 42px sans-serif';
      ctx.fillText(
        isMortgaged ? 'MORTGAGED' : 'OWNED',
        textCenterX,
        ribbonY,
        maxTextW * 0.86
      );
    }

    // Bottom High-Contrast Price / Tax / Deck Badge
    const priceY = isBottomEdge ? 660 : isTopEdge ? 600 : 635;
    ctx.fillStyle = '#14100E';
    ctx.fillRect(
      textCenterX - maxTextW * 0.48,
      priceY - 56,
      maxTextW * 0.96,
      112
    );

    ctx.font = '900 76px monospace';
    if (tile.price) {
      ctx.fillStyle = '#D4AF37';
      ctx.fillText(`$${tile.price}`, textCenterX, priceY, maxTextW * 0.9);
    } else if (tile.taxAmount) {
      ctx.fillStyle = '#F87171';
      ctx.fillText(`-$${tile.taxAmount}`, textCenterX, priceY, maxTextW * 0.9);
    } else {
      ctx.fillStyle = '#38BDF8';
      ctx.font = '900 58px sans-serif';
      ctx.fillText(
        tile.type === 'CHANCE' ? 'FORTUNE' : 'TREASURY',
        textCenterX,
        priceY,
        maxTextW * 0.9
      );
    }

    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Disable trilinear mipmap downsampling blur so text stays razor-sharp in 3D Top-Down and angled views
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates 6 materials for a 3D die with recessed brass pips
 */
export function createDiceMaterials(
  maxAnisotropy: number
): THREE.MeshPhysicalMaterial[] {
  const pipCoords: Record<number, [number, number][]> = {
    1: [[0.5, 0.5]],
    2: [
      [0.28, 0.28],
      [0.72, 0.72],
    ],
    3: [
      [0.26, 0.26],
      [0.5, 0.5],
      [0.74, 0.74],
    ],
    4: [
      [0.28, 0.28],
      [0.72, 0.28],
      [0.28, 0.72],
      [0.72, 0.72],
    ],
    5: [
      [0.26, 0.26],
      [0.74, 0.26],
      [0.5, 0.5],
      [0.26, 0.74],
      [0.74, 0.74],
    ],
    6: [
      [0.28, 0.24],
      [0.72, 0.24],
      [0.28, 0.5],
      [0.72, 0.5],
      [0.28, 0.76],
      [0.72, 0.76],
    ],
  };

  // Standard cube face order in Three.js BoxGeometry: +X(1), -X(6), +Y(2), -Y(5), +Z(3), -Z(4)
  const faceNumbers = [1, 6, 2, 5, 3, 4];

  return faceNumbers.map((num) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#FAF6F0';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 236, 236);

    for (const [nx, ny] of pipCoords[num]) {
      ctx.beginPath();
      ctx.arc(nx * 256, ny * 256, 22, 0, Math.PI * 2);
      ctx.fillStyle = num === 1 || num === 4 ? '#DC2626' : '#14110F';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#D4AF37';
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;

    return new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 0.18,
      metalness: 0.1,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });
  });
}

/**
 * Computes the 3D world position and rotation for any board tile across MINI (sideLength=6),
 * CLASSIC (sideLength=10), or MEGA (sideLength=13).
 * Board spans [-11, +11] in X and Z (total 22x22 units).
 */
export function getTileTransform(
  index: number,
  sideLength = 10
): {
  x: number;
  z: number;
  rotationY: number;
  width: number;
  depth: number;
} {
  const cornerSize = 3.2;
  const edgeLength = 22 - cornerSize * 2; // 15.6
  const innerCount = Math.max(1, sideLength - 1); // 5 for MINI, 9 for CLASSIC, 12 for MEGA
  const tileW = edgeLength / innerCount;
  const halfSpan = 11 - cornerSize / 2; // 9.4
  const midOffset = sideLength / 2;

  // Keep corners upright (rotationY = 0) so corner text is always horizontal!
  if (index === 0) {
    return {
      x: halfSpan,
      z: halfSpan,
      rotationY: 0,
      width: cornerSize,
      depth: cornerSize,
    };
  }
  if (index > 0 && index < sideLength) {
    const offset = index - midOffset;
    return {
      x: -offset * tileW,
      z: halfSpan,
      rotationY: 0,
      width: tileW,
      depth: cornerSize,
    };
  }
  if (index === sideLength) {
    return {
      x: -halfSpan,
      z: halfSpan,
      rotationY: 0,
      width: cornerSize,
      depth: cornerSize,
    };
  }
  if (index > sideLength && index < sideLength * 2) {
    const offset = index - (sideLength + midOffset);
    return {
      x: -halfSpan,
      z: -offset * tileW,
      rotationY: Math.PI / 2,
      width: tileW,
      depth: cornerSize,
    };
  }
  if (index === sideLength * 2) {
    return {
      x: -halfSpan,
      z: -halfSpan,
      rotationY: 0,
      width: cornerSize,
      depth: cornerSize,
    };
  }
  if (index > sideLength * 2 && index < sideLength * 3) {
    const offset = index - (sideLength * 2 + midOffset);
    return {
      x: offset * tileW,
      z: -halfSpan,
      rotationY: Math.PI,
      width: tileW,
      depth: cornerSize,
    };
  }
  if (index === sideLength * 3) {
    return {
      x: halfSpan,
      z: -halfSpan,
      rotationY: 0,
      width: cornerSize,
      depth: cornerSize,
    };
  }
  const offset = index - (sideLength * 3 + midOffset);
  return {
    x: halfSpan,
    z: offset * tileW,
    rotationY: -Math.PI / 2,
    width: tileW,
    depth: cornerSize,
  };
}

/**
 * Builds a composite 3-12 part procedural 3D Player Token pivoted at bottom-center (y = 0)
 * with varied roughness/metalness across primary silhouette, secondary details, and accents.
 */
export function createPlayerTokenMesh(
  archetype: TokenArchetype,
  colorHex: string,
  shadowTexture: THREE.Texture,
  isSoftwareGl: boolean
): THREE.Group {
  const group = new THREE.Group();

  // Contact shadow plane at y = 0.015
  const shadowGeo = new THREE.PlaneGeometry(1.15, 1.15);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.015;
  group.add(shadowMesh);

  // Primary luxury metallic material
  const primaryMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colorHex),
    metalness: 0.88,
    roughness: 0.18,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
  });

  // Secondary contrasting dark satin material (roughness differs by > 0.35)
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b18,
    metalness: 0.35,
    roughness: 0.65,
  });

  // Accent polished gold/chrome trim material
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: 0xfef08a,
    metalness: 0.96,
    roughness: 0.12,
  });

  // Glass visor material
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    metalness: 0.1,
    roughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.85,
    transparent: true,
    opacity: isSoftwareGl ? 0.5 : 1,
  });

  // 1. Base plinth disc (Part 1)
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.46, 0.1, 28),
    secondaryMat
  );
  plinth.position.y = 0.05;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const plinthRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.025, 12, 28),
    accentMat
  );
  plinthRing.rotation.x = Math.PI / 2;
  plinthRing.position.y = 0.1;
  group.add(plinthRing);

  switch (archetype) {
    case 'GRAND_TOURER': {
      // Extruded streamlined car hull
      const hullShape = new THREE.Shape();
      hullShape.moveTo(-0.38, 0);
      hullShape.lineTo(0.38, 0);
      hullShape.lineTo(0.34, 0.14);
      hullShape.lineTo(0.12, 0.16);
      hullShape.lineTo(0.02, 0.26);
      hullShape.lineTo(-0.2, 0.25);
      hullShape.lineTo(-0.35, 0.14);
      hullShape.closePath();

      const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
        depth: 0.34,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 3,
      });
      hullGeo.center();
      const hull = new THREE.Mesh(hullGeo, primaryMat);
      hull.position.y = 0.26;
      hull.castShadow = true;
      group.add(hull);

      // Windshield canopy
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.12, 0.3),
        glassMat
      );
      canopy.position.set(-0.04, 0.36, 0);
      group.add(canopy);

      // 4 Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.07, 18);
      wheelGeo.rotateX(Math.PI / 2);
      const wheelOffsets: [number, number][] = [
        [0.22, 0.2],
        [0.22, -0.2],
        [-0.22, 0.2],
        [-0.22, -0.2],
      ];
      for (const [wx, wz] of wheelOffsets) {
        const wheel = new THREE.Mesh(wheelGeo, secondaryMat);
        wheel.position.set(wx, 0.18, wz);
        wheel.castShadow = true;
        group.add(wheel);
      }

      // Twin headlamps
      const lampGeo = new THREE.SphereGeometry(0.035, 12, 12);
      const lampL = new THREE.Mesh(lampGeo, accentMat);
      lampL.position.set(0.38, 0.24, 0.11);
      const lampR = new THREE.Mesh(lampGeo, accentMat);
      lampR.position.set(0.38, 0.24, -0.11);
      group.add(lampL, lampR);
      break;
    }

    case 'LOCOMOTIVE': {
      // Base chassis bed
      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.1, 0.34),
        secondaryMat
      );
      bed.position.y = 0.18;
      bed.castShadow = true;
      group.add(bed);

      // Cylindrical steam boiler
      const boilerGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.46, 20);
      boilerGeo.rotateZ(Math.PI / 2);
      const boiler = new THREE.Mesh(boilerGeo, primaryMat);
      boiler.position.set(0.08, 0.34, 0);
      boiler.castShadow = true;
      group.add(boiler);

      // Engineer cab
      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.32, 0.32),
        primaryMat
      );
      cab.position.set(-0.22, 0.38, 0);
      cab.castShadow = true;
      group.add(cab);

      // Smokestack via LatheGeometry
      const stackPts = [
        new THREE.Vector2(0.04, 0),
        new THREE.Vector2(0.05, 0.12),
        new THREE.Vector2(0.08, 0.18),
        new THREE.Vector2(0.03, 0.19),
      ];
      const stack = new THREE.Mesh(
        new THREE.LatheGeometry(stackPts, 16),
        accentMat
      );
      stack.position.set(0.22, 0.46, 0);
      group.add(stack);

      // Brass steam dome
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 16, 12),
        accentMat
      );
      dome.position.set(0.04, 0.48, 0);
      group.add(dome);
      break;
    }

    case 'TOP_HAT': {
      // Velvet cushion base
      const cushion = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.12, 0.56),
        secondaryMat
      );
      cushion.position.y = 0.16;
      cushion.castShadow = true;
      group.add(cushion);

      // Hat brim
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.04, 28),
        primaryMat
      );
      brim.position.y = 0.24;
      brim.castShadow = true;
      group.add(brim);

      // Flared crown via LatheGeometry
      const crownPts = [
        new THREE.Vector2(0.2, 0),
        new THREE.Vector2(0.21, 0.22),
        new THREE.Vector2(0.24, 0.42),
        new THREE.Vector2(0, 0.43),
      ];
      const crown = new THREE.Mesh(
        new THREE.LatheGeometry(crownPts, 28),
        primaryMat
      );
      crown.position.y = 0.25;
      crown.castShadow = true;
      group.add(crown);

      // Gold silk ribbon band
      const ribbon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.212, 0.208, 0.07, 28),
        accentMat
      );
      ribbon.position.y = 0.3;
      group.add(ribbon);
      break;
    }

    case 'YACHT': {
      // Lower hull
      const hull = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 0.78, 4),
        primaryMat
      );
      hull.rotation.z = -Math.PI / 2;
      hull.rotation.x = Math.PI / 4;
      hull.scale.set(1, 1, 0.55);
      hull.position.set(0.04, 0.22, 0);
      hull.castShadow = true;
      group.add(hull);

      // Main salon cabin
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.14, 0.24),
        accentMat
      );
      cabin.position.set(-0.04, 0.32, 0);
      cabin.castShadow = true;
      group.add(cabin);

      // Tinted bridge windshield
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.1, 0.2),
        glassMat
      );
      bridge.position.set(-0.08, 0.43, 0);
      group.add(bridge);

      // Radar arch
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.02, 10, 20, Math.PI),
        primaryMat
      );
      arch.position.set(-0.14, 0.46, 0);
      group.add(arch);
      break;
    }

    case 'CROWNED_KNIGHT': {
      // Stepped chess pedestal via LatheGeometry
      const basePts = [
        new THREE.Vector2(0.3, 0),
        new THREE.Vector2(0.28, 0.08),
        new THREE.Vector2(0.2, 0.16),
        new THREE.Vector2(0.22, 0.22),
      ];
      const ped = new THREE.Mesh(
        new THREE.LatheGeometry(basePts, 24),
        secondaryMat
      );
      ped.position.y = 0.1;
      ped.castShadow = true;
      group.add(ped);

      // Sculpted Knight Neck & Head via ExtrudeGeometry
      const knightShape = new THREE.Shape();
      knightShape.moveTo(-0.16, 0);
      knightShape.lineTo(0.14, 0);
      knightShape.lineTo(0.18, 0.22);
      knightShape.lineTo(0.24, 0.26);
      knightShape.lineTo(0.22, 0.34);
      knightShape.lineTo(0.06, 0.42);
      knightShape.lineTo(-0.08, 0.46);
      knightShape.lineTo(-0.18, 0.28);
      knightShape.closePath();

      const knightGeo = new THREE.ExtrudeGeometry(knightShape, {
        depth: 0.16,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 2,
      });
      knightGeo.center();
      const body = new THREE.Mesh(knightGeo, primaryMat);
      body.position.y = 0.48;
      body.castShadow = true;
      group.add(body);

      // Royal gold crown
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.07, 0.09, 8),
        accentMat
      );
      crown.position.set(-0.02, 0.74, 0);
      group.add(crown);
      break;
    }

    case 'BIPLANE': {
      // Fuselage
      const fuselageGeo = new THREE.CylinderGeometry(0.08, 0.05, 0.64, 16);
      fuselageGeo.rotateZ(Math.PI / 2);
      const fuselage = new THREE.Mesh(fuselageGeo, primaryMat);
      fuselage.position.y = 0.32;
      fuselage.castShadow = true;
      group.add(fuselage);

      // Lower & Upper wings
      const wingGeo = new THREE.BoxGeometry(0.18, 0.025, 0.68);
      const lowerWing = new THREE.Mesh(wingGeo, primaryMat);
      lowerWing.position.set(0.06, 0.26, 0);
      lowerWing.castShadow = true;
      const upperWing = new THREE.Mesh(wingGeo, accentMat);
      upperWing.position.set(0.08, 0.44, 0);
      upperWing.castShadow = true;
      group.add(lowerWing, upperWing);

      // Tail fin
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.16, 0.03),
        accentMat
      );
      tail.position.set(-0.26, 0.38, 0);
      group.add(tail);

      // Propeller blade
      const prop = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.28, 0.04),
        secondaryMat
      );
      prop.position.set(0.34, 0.32, 0);
      group.add(prop);
      break;
    }
  }

  return group;
}

/**
 * Builds a 5-part procedural 3D Villa (House) mesh grounded at y = 0
 */
export function createLuxuryVillaMesh(): THREE.Group {
  const group = new THREE.Group();

  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x44403c,
    roughness: 0.75,
    metalness: 0.1,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    roughness: 0.35,
    metalness: 0.25,
  });
  const roofMat = new THREE.MeshPhysicalMaterial({
    color: 0x059669,
    roughness: 0.22,
    metalness: 0.55,
    clearcoat: 0.5,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.2,
    metalness: 0.9,
  });

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.05, 0.32),
    plinthMat
  );
  plinth.position.y = 0.025;
  group.add(plinth);

  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.2, 0.26),
    wallMat
  );
  walls.position.y = 0.15;
  walls.castShadow = true;
  group.add(walls);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.18, 4),
    roofMat
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.34;
  roof.castShadow = true;
  group.add(roof);

  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.14, 0.05),
    goldMat
  );
  chimney.position.set(0.07, 0.35, 0.07);
  group.add(chimney);

  return group;
}

/**
 * Builds a 7-part Art Deco Grand Hotel mesh grounded at y = 0
 */
export function createGrandHotelMesh(): THREE.Group {
  const group = new THREE.Group();

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b18,
    roughness: 0.6,
    metalness: 0.3,
  });
  const crimsonMat = new THREE.MeshPhysicalMaterial({
    color: 0xdc2626,
    roughness: 0.2,
    metalness: 0.45,
    clearcoat: 0.8,
  });
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4af37,
    roughness: 0.15,
    metalness: 0.92,
  });

  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.08, 0.38),
    baseMat
  );
  podium.position.y = 0.04;
  group.add(podium);

  const mainTower = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.44, 0.28),
    crimsonMat
  );
  mainTower.position.y = 0.3;
  mainTower.castShadow = true;
  group.add(mainTower);

  const leftWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.3, 0.24),
    crimsonMat
  );
  leftWing.position.set(-0.18, 0.23, 0);
  leftWing.castShadow = true;

  const rightWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.3, 0.24),
    crimsonMat
  );
  rightWing.position.set(0.18, 0.23, 0);
  rightWing.castShadow = true;
  group.add(leftWing, rightWing);

  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.1, 0.2),
    brassMat
  );
  crown.position.y = 0.57;
  group.add(crown);

  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.22, 12),
    brassMat
  );
  spire.position.y = 0.73;
  group.add(spire);

  return group;
}

/**
 * Builds the ornate central Grand Estates 3D centerpiece monument + card deck holders
 */
export function createCenterpieceMonument(isSoftwareGl: boolean): {
  root: THREE.Group;
  rotatingGlobe: THREE.Group;
} {
  const root = new THREE.Group();
  const rotatingGlobe = new THREE.Group();

  const obsidianMat = new THREE.MeshStandardMaterial({
    color: 0x14110f,
    roughness: 0.4,
    metalness: 0.3,
  });

  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4af37,
    roughness: 0.16,
    metalness: 0.94,
    clearcoat: 0.6,
  });

  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0xfef08a,
    roughness: 0.08,
    metalness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.9,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 1,
    ior: 1.6,
  });

  // Octagonal stepped pedestal
  const step1 = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.35, 0.18, 8),
    obsidianMat
  );
  step1.position.y = 0.09;
  step1.receiveShadow = true;
  root.add(step1);

  const step2 = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.75, 0.22, 8),
    goldMat
  );
  step2.position.y = 0.28;
  step2.castShadow = true;
  root.add(step2);

  // Rotating armillary rings + crystal core
  rotatingGlobe.position.y = 1.35;
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    crystalMat
  );
  rotatingGlobe.add(core);

  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.04, 16, 48),
    goldMat
  );
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.035, 16, 48),
    goldMat
  );
  ring2.rotation.y = Math.PI / 2;
  ring2.rotation.x = Math.PI / 4;
  rotatingGlobe.add(ring1, ring2);

  root.add(rotatingGlobe);

  // Two 3D Card Deck Vaults (Fortune & Sovereign Treasury)
  const createDeckPedestal = (
    x: number,
    z: number,
    rotY: number,
    deckColor: number
  ) => {
    const deckGroup = new THREE.Group();
    deckGroup.position.set(x, 0, z);
    deckGroup.rotation.y = rotY;

    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.14, 1.5),
      obsidianMat
    );
    tray.position.y = 0.07;
    tray.castShadow = true;
    deckGroup.add(tray);

    const cardStack = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.22, 1.25),
      new THREE.MeshPhysicalMaterial({
        color: deckColor,
        roughness: 0.25,
        metalness: 0.5,
      })
    );
    cardStack.position.y = 0.22;
    cardStack.castShadow = true;
    deckGroup.add(cardStack);

    root.add(deckGroup);
  };

  createDeckPedestal(-4.2, -4.2, Math.PI / 4, 0xf97316); // Chance / Fortune
  createDeckPedestal(4.2, 4.2, Math.PI / 4, 0x38bdf8); // Treasury / Chest

  return { root, rotatingGlobe };
}

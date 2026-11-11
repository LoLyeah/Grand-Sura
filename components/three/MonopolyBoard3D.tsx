'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BOARD_SIZE_CONFIGS,
  BoardSizeId,
  getBoardTiles,
} from '@/lib/monopoly-data';
import { GameRoomState } from '@/lib/monopoly-engine';
import {
  createBoardCenterTexture,
  createCenterpieceMonument,
  createContactShadowTexture,
  createDiceMaterials,
  createGrandHotelMesh,
  createLuxuryVillaMesh,
  createMahoganyTextures,
  createPlayerTokenMesh,
  createTileTexture,
  getTileTransform,
} from './procedural-models';

export type CameraPreset = 'OVERVIEW' | 'FOLLOW_TOKEN' | 'TOP_DOWN' | 'FREE_ORBIT';

interface MonopolyBoard3DProps {
  gameState: GameRoomState;
  selectedTileIndex: number | null;
  onSelectTile: (index: number) => void;
  cameraPreset: CameraPreset;
  onUserOrbitStart: () => void;
  diceRollTrigger: number;
  show3DLabelsOverlay?: boolean;
  show3DCornerInspector?: boolean;
}

// Pre-allocated scratch math helpers at module scope (zero GC in render loop)
const _scratchVecA = new THREE.Vector3();
const _scratchVecB = new THREE.Vector3();
const _scratchDummy = new THREE.Object3D();

export default function MonopolyBoard3D({
  gameState,
  selectedTileIndex,
  onSelectTile,
  cameraPreset,
  onUserOrbitStart,
  diceRollTrigger,
  show3DLabelsOverlay = false,
  show3DCornerInspector = false,
}: MonopolyBoard3DProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const labelNodesRef = useRef<(HTMLButtonElement | null)[]>([]);
  const diceBadgeRef = useRef<HTMLDivElement | null>(null);
  const lastRollLogIdRef = useRef<string | null>(null);
  const [hoveredTileIdx, setHoveredTileIdx] = React.useState<number | null>(
    null
  );

  // Store latest props & callbacks in refs so the WebGL canvas never re-mounts
  const gameStateRef = useRef<GameRoomState>(gameState);
  const selectedTileRef = useRef<number | null>(selectedTileIndex);
  const onSelectTileRef = useRef(onSelectTile);
  const cameraPresetRef = useRef<CameraPreset>(cameraPreset);
  const onUserOrbitStartRef = useRef(onUserOrbitStart);
  const show3DLabelsRef = useRef<boolean>(show3DLabelsOverlay);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    selectedTileRef.current = selectedTileIndex;
  }, [selectedTileIndex]);

  useEffect(() => {
    onSelectTileRef.current = onSelectTile;
  }, [onSelectTile]);

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
  }, [cameraPreset]);

  useEffect(() => {
    onUserOrbitStartRef.current = onUserOrbitStart;
  }, [onUserOrbitStart]);

  useEffect(() => {
    show3DLabelsRef.current = show3DLabelsOverlay;
  }, [show3DLabelsOverlay]);

  // Mutable scene handles for incremental updates without recreating WebGL context
  const sceneHandlesRef = useRef<{
    scene: THREE.Scene | null;
    tilesGroup: THREE.Group | null;
    builtBoardSize: BoardSizeId | null;
    tileMeshes: THREE.Mesh[];
    tileMaterials: THREE.MeshStandardMaterial[];
    tileOwnerSignatures: string[];
    tokenGroups: Map<string, THREE.Group>;
    tokenTargetPos: Map<string, THREE.Vector3>;
    tokenVisualTile: Map<string, number>;
    tokenTargetTile: Map<string, number>;
    tokenStepProgress: Map<string, number>;
    bankruptExitTokens: Map<
      string,
      {
        group: THREE.Group;
        ring: THREE.Mesh;
        progress: number;
        startPos: THREE.Vector3;
      }
    >;
    buildingGroups: Map<number, THREE.Group>;
    buildingCounts: Map<number, number>;
    buildingSpawnAnim: Map<number, number>;
    selectionRing: THREE.Mesh | null;
    diceMeshes: [THREE.Mesh, THREE.Mesh] | null;
    diceShadows: [THREE.Mesh, THREE.Mesh] | null;
    diceHalos: [THREE.Mesh, THREE.Mesh] | null;
    diceAnimTime: number;
    diceAnimDuration: number;
    diceStartPos: [[number, number], [number, number]];
    diceEndPos: [[number, number], [number, number]];
    diceTargetYaw: [number, number];
    maxAnisotropy: number;
    shadowTexture: THREE.Texture | null;
    isSoftwareGl: boolean;
    tokensRoot: THREE.Group | null;
    buildingsRoot: THREE.Group | null;
    cameraTargetGoal: THREE.Vector3;
    cameraPosGoal: THREE.Vector3;
    hasActiveCameraTransition: boolean;
  }>({
    scene: null,
    tilesGroup: null,
    builtBoardSize: null,
    tileMeshes: [],
    tileMaterials: [],
    tileOwnerSignatures: [],
    tokenGroups: new Map(),
    tokenTargetPos: new Map(),
    tokenVisualTile: new Map(),
    tokenTargetTile: new Map(),
    tokenStepProgress: new Map(),
    bankruptExitTokens: new Map(),
    buildingGroups: new Map(),
    buildingCounts: new Map(),
    buildingSpawnAnim: new Map(),
    selectionRing: null,
    diceMeshes: null,
    diceShadows: null,
    diceHalos: null,
    diceAnimTime: 0,
    diceAnimDuration: 1.25,
    diceStartPos: [
      [-3.1, 5.1],
      [3.1, 5.3],
    ],
    diceEndPos: [
      [-1.15, 2.8],
      [1.15, 2.8],
    ],
    diceTargetYaw: [0.22, -0.28],
    maxAnisotropy: 1,
    shadowTexture: null,
    isSoftwareGl: false,
    tokensRoot: null,
    buildingsRoot: null,
    cameraTargetGoal: new THREE.Vector3(0, 0, 0),
    cameraPosGoal: new THREE.Vector3(0, 20, 21),
    hasActiveCameraTransition: false,
  });

  // Helper to launch a fresh 3D dice throw trajectory
  const trigger3DDiceThrow = React.useCallback(() => {
    const handles = sceneHandlesRef.current;
    const angleOffset = (Math.random() - 0.5) * 0.7;
    handles.diceAnimDuration = 1.25;
    handles.diceAnimTime = 1.25;
    handles.diceStartPos = [
      [-3.2 + Math.sin(angleOffset) * 0.8, 5.2],
      [3.2 + Math.cos(angleOffset) * 0.8, 5.4],
    ];
    handles.diceEndPos = [
      [-1.18 + (Math.random() - 0.5) * 0.24, 2.75 + (Math.random() - 0.5) * 0.24],
      [1.18 + (Math.random() - 0.5) * 0.24, 2.75 + (Math.random() - 0.5) * 0.24],
    ];
    handles.diceTargetYaw = [
      (Math.random() - 0.5) * 0.65,
      (Math.random() - 0.5) * 0.65,
    ];
  }, []);

  // Trigger 3D dice tumble animation whenever diceRollTrigger increments
  useEffect(() => {
    if (diceRollTrigger > 0) {
      trigger3DDiceThrow();
    }
  }, [diceRollTrigger, trigger3DDiceThrow]);

  // Also trigger 3D dice animation whenever a new ROLL log entry occurs (e.g. Bot or Online player roll)
  useEffect(() => {
    const latestLog = gameState.logs[0];
    if (
      latestLog &&
      latestLog.type === 'ROLL' &&
      latestLog.id !== lastRollLogIdRef.current
    ) {
      lastRollLogIdRef.current = latestLog.id;
      if (sceneHandlesRef.current.diceAnimTime <= 0.9) {
        trigger3DDiceThrow();
      }
    }
  }, [gameState.logs, trigger3DDiceThrow]);

  // Update camera preset goals smoothly when cameraPreset or turn changes
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    const sideLength =
      BOARD_SIZE_CONFIGS[gameState.boardSize]?.sideLength || 10;
    if (cameraPreset === 'OVERVIEW') {
      handles.cameraPosGoal.set(0, 19.5, 20.5);
      handles.cameraTargetGoal.set(0, 0, 0);
      handles.hasActiveCameraTransition = true;
    } else if (cameraPreset === 'TOP_DOWN') {
      handles.cameraPosGoal.set(0, 22.4, 0.01);
      handles.cameraTargetGoal.set(0, 0, 0);
      handles.hasActiveCameraTransition = true;
    } else if (cameraPreset === 'FOLLOW_TOKEN') {
      const activePlayer =
        gameState.players[gameState.turnIndex] || gameState.players[0];
      if (activePlayer) {
        const tf = getTileTransform(activePlayer.position, sideLength);
        handles.cameraTargetGoal.set(tf.x, 0.5, tf.z);
        handles.cameraPosGoal.set(tf.x * 1.45, 9.5, tf.z * 1.45);
        handles.hasActiveCameraTransition = true;
      }
    }
  }, [cameraPreset, gameState.turnIndex, gameState.players, gameState.boardSize]);

  // Helper to rebuild the 3D perimeter tiles whenever boardSize changes
  const rebuildBoardTilesForSize = (boardSize: BoardSizeId) => {
    const handles = sceneHandlesRef.current;
    if (!handles.tilesGroup || !handles.buildingsRoot) return;

    // Dispose old tile meshes/materials
    for (const mesh of handles.tileMeshes) {
      handles.tilesGroup.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const mat of handles.tileMaterials) {
      mat.map?.dispose();
      mat.dispose();
    }
    for (const [, bGroup] of handles.buildingGroups) {
      handles.buildingsRoot.remove(bGroup);
    }
    handles.buildingGroups.clear();
    handles.buildingCounts.clear();

    const tiles = getBoardTiles(boardSize);
    const sideLength = BOARD_SIZE_CONFIGS[boardSize].sideLength;
    const newMeshes: THREE.Mesh[] = [];
    const newMaterials: THREE.MeshStandardMaterial[] = [];

    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x292524,
      roughness: 0.5,
      metalness: 0.3,
    });

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const tf = getTileTransform(i, sideLength);
      const tex = createTileTexture(
        tile,
        handles.maxAnisotropy,
        null,
        false,
        sideLength
      );

      const topMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.32,
        metalness: 0.08,
      });

      const geo = new THREE.BoxGeometry(tf.width - 0.03, 0.08, tf.depth - 0.03);
      const mesh = new THREE.Mesh(geo, [
        sideMat,
        sideMat,
        topMat,
        sideMat,
        sideMat,
        sideMat,
      ]);
      mesh.position.set(tf.x, 0.28, tf.z);
      mesh.rotation.y = tf.rotationY;
      mesh.receiveShadow = true;
      mesh.layers.enable(1);
      mesh.userData = { tileIndex: i };

      handles.tilesGroup.add(mesh);
      newMeshes.push(mesh);
      newMaterials.push(topMat);
    }

    handles.tileMeshes = newMeshes;
    handles.tileMaterials = newMaterials;
    handles.tileOwnerSignatures = new Array(tiles.length).fill('');
    handles.builtBoardSize = boardSize;
  };

  // Synchronize board size, ownership textures, 3D houses/hotels, and token target positions
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (
      !handles.tokensRoot ||
      !handles.buildingsRoot ||
      !handles.shadowTexture ||
      !handles.tilesGroup
    )
      return;

    if (handles.builtBoardSize !== gameState.boardSize) {
      rebuildBoardTilesForSize(gameState.boardSize);
    }

    const tiles = getBoardTiles(gameState.boardSize);
    const sideLength = BOARD_SIZE_CONFIGS[gameState.boardSize].sideLength;

    // 1. Update tile textures if ownership or mortgage status changed
    for (let i = 0; i < tiles.length; i++) {
      const prop = gameState.properties[i];
      const owner = prop?.ownerId
        ? gameState.players.find((p) => p.id === prop.ownerId)
        : null;
      const sig = `${owner?.color || 'none'}-${prop?.mortgaged ? 'm' : 'u'}`;
      if (handles.tileOwnerSignatures[i] !== sig && handles.tileMaterials[i]) {
        handles.tileOwnerSignatures[i] = sig;
        const oldMap = handles.tileMaterials[i].map;
        const newMap = createTileTexture(
          tiles[i],
          handles.maxAnisotropy,
          owner?.color || null,
          Boolean(prop?.mortgaged),
          sideLength
        );
        handles.tileMaterials[i].map = newMap;
        handles.tileMaterials[i].needsUpdate = true;
        oldMap?.dispose();
      }

      // 2. Update 3D Houses / Grand Hotels on property tiles
      const houseCount = prop?.houses || 0;
      const prevCount = handles.buildingCounts.get(i) ?? 0;
      if (houseCount !== prevCount) {
        handles.buildingCounts.set(i, houseCount);
        const existingGroup = handles.buildingGroups.get(i);
        if (existingGroup) {
          handles.buildingsRoot.remove(existingGroup);
          handles.buildingGroups.delete(i);
        }

        if (houseCount > 0) {
          const tf = getTileTransform(i, sideLength);
          const bGroup = new THREE.Group();
          bGroup.position.set(tf.x, 0.32, tf.z);
          bGroup.rotation.y = tf.rotationY;

          if (houseCount === 5) {
            const hotel = createGrandHotelMesh();
            hotel.position.set(0, 0, -tf.depth * 0.31);
            bGroup.add(hotel);
          } else {
            const spacing = tf.width / (houseCount + 1);
            for (let h = 0; h < houseCount; h++) {
              const villa = createLuxuryVillaMesh();
              const offsetX = -tf.width / 2 + spacing * (h + 1);
              villa.position.set(offsetX, 0, -tf.depth * 0.31);
              bGroup.add(villa);
            }
          }
          if (houseCount > prevCount) {
            bGroup.scale.set(0.05, 0.05, 0.05);
            handles.buildingSpawnAnim.set(i, 0);
          }
          handles.buildingsRoot.add(bGroup);
          handles.buildingGroups.set(i, bGroup);
        }
      }
    }

    // 3. Synchronize Player 3D Tokens & target positions
    const activeIds = new Set(
      gameState.players.filter((p) => !p.bankrupt).map((p) => p.id)
    );
    const bankruptIds = new Set(
      gameState.players.filter((p) => p.bankrupt).map((p) => p.id)
    );

    // Transition newly bankrupt tokens into a 3D exit animation, or remove tokens from prior matches
    for (const [id, meshGroup] of handles.tokenGroups.entries()) {
      if (!activeIds.has(id)) {
        handles.tokenGroups.delete(id);
        handles.tokenTargetPos.delete(id);

        if (bankruptIds.has(id) && !handles.bankruptExitTokens.has(id)) {
          // Prepare mesh materials for smooth opacity fade-out and subtle crimson tint
          meshGroup.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              if (Array.isArray(mesh.material)) {
                mesh.material = mesh.material.map((m) => {
                  const cloned = m.clone();
                  cloned.transparent = true;
                  return cloned;
                });
              } else if (mesh.material) {
                const cloned = mesh.material.clone();
                cloned.transparent = true;
                if (
                  'emissive' in cloned &&
                  cloned.emissive instanceof THREE.Color
                ) {
                  cloned.emissive.setHex(0x7f1d1d);
                  (cloned as THREE.MeshStandardMaterial).emissiveIntensity = 0.45;
                }
                mesh.material = cloned;
              }
            }
          });

          // Create an expanding crimson-gold liquidation ring on the tile
          const ringGeo = new THREE.RingGeometry(0.28, 0.46, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0xef4444,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
            opacity: 0.85,
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.rotation.x = -Math.PI / 2;
          ringMesh.position.set(
            meshGroup.position.x,
            0.33,
            meshGroup.position.z
          );
          handles.tokensRoot.add(ringMesh);

          handles.bankruptExitTokens.set(id, {
            group: meshGroup,
            ring: ringMesh,
            progress: 0,
            startPos: meshGroup.position.clone(),
          });
        } else {
          handles.tokensRoot.remove(meshGroup);
        }
      }
    }

    // Group players sharing the same tile so they arrange neatly without overlapping
    const playersByTile = new Map<number, string[]>();
    for (const p of gameState.players) {
      if (p.bankrupt) continue;
      const list = playersByTile.get(p.position) || [];
      list.push(p.id);
      playersByTile.set(p.position, list);
    }

    for (const p of gameState.players) {
      if (p.bankrupt) continue;
      let tokenMesh = handles.tokenGroups.get(p.id);
      if (!tokenMesh) {
        tokenMesh = createPlayerTokenMesh(
          p.token,
          p.color,
          handles.shadowTexture,
          handles.isSoftwareGl
        );
        const tf = getTileTransform(p.position, sideLength);
        tokenMesh.position.set(tf.x, 0.32, tf.z);
        handles.tokensRoot.add(tokenMesh);
        handles.tokenGroups.set(p.id, tokenMesh);
        handles.tokenVisualTile.set(p.id, p.position);
        handles.tokenTargetTile.set(p.id, p.position);
        handles.tokenStepProgress.set(p.id, 0);
      } else {
        handles.tokenTargetTile.set(p.id, p.position);
      }

      const occupants = playersByTile.get(p.position) || [p.id];
      const slotIdx = occupants.indexOf(p.id);
      const count = occupants.length;
      const angle = (slotIdx / Math.max(1, count)) * Math.PI * 2;
      const radius = count > 1 ? 0.42 : 0;

      const tf = getTileTransform(p.position, sideLength);
      const targetX = tf.x + Math.cos(angle) * radius;
      const targetZ = tf.z + Math.sin(angle) * radius;

      handles.tokenTargetPos.set(
        p.id,
        new THREE.Vector3(targetX, 0.32, targetZ)
      );
    }
  }, [gameState]);

  // Main WebGL initialization (runs once on mount)
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    };
    const handleContextRestored = () => {
      if (!unmounted) {
        frameId = requestAnimationFrame(tick);
      }
    };
    renderer.domElement.addEventListener(
      'webglcontextlost',
      handleContextLost,
      false
    );
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      handleContextRestored,
      false
    );

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Horizon Fog & Studio RoomEnvironment
    const scene = new THREE.Scene();
    const bgColor = new THREE.Color(0x0f0c0a);
    scene.background = bgColor;
    scene.fog = new THREE.FogExp2(0x0f0c0a, 0.015);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // 3. Camera & Damped OrbitControls
    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      150
    );
    camera.position.set(0, 19.5, 20.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.08;
    controls.minDistance = 4.5;
    controls.maxDistance = 42;
    controls.target.set(0, 0, 0);

    controls.addEventListener('start', () => {
      sceneHandlesRef.current.hasActiveCameraTransition = false;
      onUserOrbitStartRef.current();
    });

    // 4. Studio 3-Point Lighting Rig (Warm Key + Cool Hemisphere Fill + Rim)
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x24120b, 0.85);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff3d6, 2.2);
    keyLight.position.set(14, 24, 16);
    keyLight.castShadow = !isSoftwareGl;
    const d = 15;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 55;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rimLight.position.set(-16, 14, -15);
    scene.add(rimLight);

    // 5. Luxury Salon Table Pedestal & Mahogany Board Frame
    const { map: mahoganyMap, bumpMap: mahoganyBump } =
      createMahoganyTextures(maxAnisotropy);

    const salonFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(36, 38, 0.6, 64),
      new THREE.MeshStandardMaterial({
        color: 0x16110e,
        roughness: 0.75,
        metalness: 0.15,
      })
    );
    salonFloor.position.y = -0.5;
    salonFloor.receiveShadow = true;
    scene.add(salonFloor);

    const mahoganyFrame = new THREE.Mesh(
      new THREE.BoxGeometry(23.6, 0.56, 23.6),
      new THREE.MeshPhysicalMaterial({
        map: mahoganyMap,
        bumpMap: mahoganyBump,
        bumpScale: 0.015,
        roughness: 0.24,
        metalness: 0.12,
        clearcoat: 0.75,
        clearcoatRoughness: 0.18,
      })
    );
    mahoganyFrame.position.y = 0.02;
    mahoganyFrame.receiveShadow = true;
    mahoganyFrame.castShadow = true;
    scene.add(mahoganyFrame);

    // 6. InstancedMesh for 40 Brass Perimeter Rivets (>20 repeated items rule)
    const studGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.08, 14);
    const studMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      roughness: 0.15,
      metalness: 0.92,
    });
    const studInstanced = new THREE.InstancedMesh(studGeo, studMat, 40);
    for (let i = 0; i < 40; i++) {
      const tf = getTileTransform(i, 10);
      const normX = Math.abs(tf.x) > 9 ? Math.sign(tf.x) * 11.45 : tf.x;
      const normZ = Math.abs(tf.z) > 9 ? Math.sign(tf.z) * 11.45 : tf.z;
      _scratchDummy.position.set(normX, 0.32, normZ);
      _scratchDummy.rotation.set(0, 0, 0);
      _scratchDummy.scale.setScalar(1);
      _scratchDummy.updateMatrix();
      studInstanced.setMatrixAt(i, _scratchDummy.matrix);
    }
    studInstanced.instanceMatrix.needsUpdate = true;
    studInstanced.computeBoundingSphere();
    scene.add(studInstanced);

    // 7. Central Felt Board Surface (offset on Y to prevent coplanar Z-fighting)
    const centerTex = createBoardCenterTexture(maxAnisotropy);
    const centerBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(15.6, 15.6),
      new THREE.MeshStandardMaterial({
        map: centerTex,
        roughness: 0.65,
        metalness: 0.08,
      })
    );
    centerBoard.rotation.x = -Math.PI / 2;
    centerBoard.position.y = 0.315;
    centerBoard.receiveShadow = true;
    scene.add(centerBoard);

    // 8. Interactive Board Tiles Group
    const tilesGroup = new THREE.Group();
    scene.add(tilesGroup);

    // 9. Selection Highlight Ring (with polygonOffset to prevent Z-fighting)
    const ringGeo = new THREE.RingGeometry(0.85, 1.02, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.34;
    selectionRing.visible = false;
    scene.add(selectionRing);

    // 10. Centerpiece Monument & 3D Dice Pair
    const { root: centerpieceRoot, rotatingGlobe } =
      createCenterpieceMonument(isSoftwareGl);
    centerpieceRoot.position.y = 0.315;
    scene.add(centerpieceRoot);

    const shadowTexture = createContactShadowTexture();

    const diceMaterials = createDiceMaterials(maxAnisotropy);
    const dieGeo = new THREE.BoxGeometry(0.76, 0.76, 0.76);
    const die1 = new THREE.Mesh(dieGeo, diceMaterials);
    const die2 = new THREE.Mesh(dieGeo, diceMaterials);
    // Use 'YXZ' Euler order so Rx and Rz place the exact pip face on +Y while Ry spins flat on the table
    die1.rotation.order = 'YXZ';
    die2.rotation.order = 'YXZ';
    die1.position.set(-1.15, 0.7, 2.8);
    die2.position.set(1.15, 0.7, 2.8);
    die1.castShadow = true;
    die2.castShadow = true;
    scene.add(die1, die2);

    // Contact shadows directly beneath each 3D die
    const dieShadowGeo = new THREE.PlaneGeometry(1.35, 1.35);
    const dieShadowMat1 = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const dieShadowMat2 = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const dieShadow1 = new THREE.Mesh(dieShadowGeo, dieShadowMat1);
    const dieShadow2 = new THREE.Mesh(dieShadowGeo, dieShadowMat2);
    dieShadow1.rotation.x = -Math.PI / 2;
    dieShadow2.rotation.x = -Math.PI / 2;
    dieShadow1.position.set(-1.15, 0.324, 2.8);
    dieShadow2.position.set(1.15, 0.324, 2.8);
    scene.add(dieShadow1, dieShadow2);

    // Golden impact / ROLL-phase halo rings beneath the dice
    const dieHaloGeo = new THREE.RingGeometry(0.48, 0.66, 32);
    const dieHaloMat1 = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    });
    const dieHaloMat2 = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    });
    const dieHalo1 = new THREE.Mesh(dieHaloGeo, dieHaloMat1);
    const dieHalo2 = new THREE.Mesh(dieHaloGeo, dieHaloMat2);
    dieHalo1.rotation.x = -Math.PI / 2;
    dieHalo2.rotation.x = -Math.PI / 2;
    dieHalo1.position.set(-1.15, 0.328, 2.8);
    dieHalo2.position.set(1.15, 0.328, 2.8);
    scene.add(dieHalo1, dieHalo2);

    const tokensRoot = new THREE.Group();
    const buildingsRoot = new THREE.Group();
    scene.add(tokensRoot, buildingsRoot);

    sceneHandlesRef.current = {
      ...sceneHandlesRef.current,
      scene,
      tilesGroup,
      selectionRing,
      diceMeshes: [die1, die2],
      diceShadows: [dieShadow1, dieShadow2],
      diceHalos: [dieHalo1, dieHalo2],
      maxAnisotropy,
      shadowTexture,
      isSoftwareGl,
      tokensRoot,
      buildingsRoot,
    };

    // Build initial board tiles for initial boardSize
    const initState = gameStateRef.current;
    rebuildBoardTilesForSize(initState.boardSize);
    const initSideLength =
      BOARD_SIZE_CONFIGS[initState.boardSize]?.sideLength || 10;

    for (const p of initState.players) {
      if (p.bankrupt) continue;
      const tokenMesh = createPlayerTokenMesh(
        p.token,
        p.color,
        shadowTexture,
        isSoftwareGl
      );
      const tf = getTileTransform(p.position, initSideLength);
      tokenMesh.position.set(tf.x, 0.32, tf.z);
      tokensRoot.add(tokenMesh);
      sceneHandlesRef.current.tokenGroups.set(p.id, tokenMesh);
      sceneHandlesRef.current.tokenTargetPos.set(
        p.id,
        new THREE.Vector3(tf.x, 0.32, tf.z)
      );
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 11. Raycasting (Layer 1, throttled pointermove + click selection)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let lastHoverTime = 0;

    const getIntersectedTile = (
      clientX: number,
      clientY: number
    ): number | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(
        sceneHandlesRef.current.tileMeshes,
        false
      );
      if (hits.length > 0) {
        const idx = hits[0].object.userData?.tileIndex;
        if (typeof idx === 'number') return idx;
      }
      return null;
    };

    let pointerDownPos = { x: 0, y: 0 };
    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (dist < 6) {
        const idx = getIntersectedTile(e.clientX, e.clientY);
        if (idx !== null) {
          onSelectTileRef.current(idx);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;
      const idx = getIntersectedTile(e.clientX, e.clientY);
      renderer.domElement.style.cursor = idx !== null ? 'pointer' : 'grab';
      setHoveredTileIdx((prev) => (prev === idx ? prev : idx));
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // 12. Render Loop with Software-WebGL Fence Sync Pacing (`afterDraw`)
    const clock = new THREE.Clock();
    let frameId = 0;
    let unmounted = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (unmounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    // Target Euler rotations for each die value (1-6) on top face (+Y)
    const dieTopRotations: Record<number, [number, number, number]> = {
      1: [0, 0, Math.PI / 2],
      2: [0, 0, 0],
      3: [-Math.PI / 2, 0, 0],
      4: [Math.PI / 2, 0, 0],
      5: [Math.PI, 0, 0],
      6: [0, 0, -Math.PI / 2],
    };

    function tick() {
      if (unmounted) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const handles = sceneHandlesRef.current;

      // Rotate centerpiece crystal globe
      rotatingGlobe.rotation.y += dt * 0.45;
      rotatingGlobe.position.y = 1.35 + Math.sin(elapsed * 1.8) * 0.06;

      const curSideLength =
        BOARD_SIZE_CONFIGS[gameStateRef.current.boardSize]?.sideLength || 10;
      const curTotalTiles = curSideLength * 4;

      // Animate 3D Villas & Grand Hotels spring pop-in when newly built
      if (handles.buildingSpawnAnim.size > 0) {
        for (const [tileIdx, prog] of handles.buildingSpawnAnim.entries()) {
          const bGroup = handles.buildingGroups.get(tileIdx);
          if (!bGroup) {
            handles.buildingSpawnAnim.delete(tileIdx);
            continue;
          }
          const nextProg = Math.min(1, prog + dt * 2.2);
          handles.buildingSpawnAnim.set(tileIdx, nextProg);
          // Elastic spring overshoot curve: 0 -> 1.18 -> 1.0
          const overshoot =
            nextProg < 0.7
              ? (nextProg / 0.7) * 1.18
              : 1.18 - ((nextProg - 0.7) / 0.3) * 0.18;
          bGroup.scale.set(overshoot, overshoot, overshoot);
          if (nextProg >= 1) {
            bGroup.scale.set(1, 1, 1);
            handles.buildingSpawnAnim.delete(tileIdx);
          }
        }
      }

      // Tile-by-Tile Perimeter Hopping for 3D Player Tokens (like real Monopoly pieces!)
      for (const [id, group] of handles.tokenGroups.entries()) {
        const finalTarget = handles.tokenTargetPos.get(id);
        const visTile = handles.tokenVisualTile.get(id) ?? 0;
        const tgtTile = handles.tokenTargetTile.get(id) ?? visTile;

        if (visTile !== tgtTile && curTotalTiles > 0) {
          const forwardSteps =
            (tgtTile - visTile + curTotalTiles) % curTotalTiles;
          // If step count is <= 16 (normal roll or card advance), hop tile-by-tile along the perimeter
          if (forwardSteps > 0 && forwardSteps <= 16) {
            const nextTile = (visTile + 1) % curTotalTiles;
            const prevStepProg = handles.tokenStepProgress.get(id) ?? 0;
            // Faster stepping when many spaces remain
            const stepSpeed = forwardSteps > 6 ? 11.5 : 8.5;
            const nextStepProg = prevStepProg + dt * stepSpeed;

            if (nextStepProg >= 1) {
              handles.tokenVisualTile.set(id, nextTile);
              handles.tokenStepProgress.set(id, 0);
              const arrivedTf = getTileTransform(nextTile, curSideLength);
              group.position.x = arrivedTf.x;
              group.position.z = arrivedTf.z;
              group.position.y = 0.32;
            } else {
              handles.tokenStepProgress.set(id, nextStepProg);
              const fromTf = getTileTransform(visTile, curSideLength);
              const toTf = getTileTransform(nextTile, curSideLength);
              const tx = THREE.MathUtils.lerp(fromTf.x, toTf.x, nextStepProg);
              const tz = THREE.MathUtils.lerp(fromTf.z, toTf.z, nextStepProg);
              const hopArc = Math.sin(nextStepProg * Math.PI) * 0.62;

              group.position.x = tx;
              group.position.z = tz;
              group.position.y = 0.32 + hopArc;

              const moveAngle = Math.atan2(
                toTf.x - fromTf.x,
                toTf.z - fromTf.z
              );
              group.rotation.y = THREE.MathUtils.damp(
                group.rotation.y,
                moveAngle,
                14,
                dt
              );
            }
            continue;
          } else {
            // Direct flight (e.g. Sent to Detention across the board)
            handles.tokenVisualTile.set(id, tgtTile);
            handles.tokenStepProgress.set(id, 0);
          }
        }

        if (finalTarget) {
          _scratchVecA.set(group.position.x, 0, group.position.z);
          _scratchVecB.set(finalTarget.x, 0, finalTarget.z);
          const distXZ = _scratchVecA.distanceTo(_scratchVecB);

          group.position.x = THREE.MathUtils.damp(
            group.position.x,
            finalTarget.x,
            8.5,
            dt
          );
          group.position.z = THREE.MathUtils.damp(
            group.position.z,
            finalTarget.z,
            8.5,
            dt
          );

          const hopHeight = distXZ > 0.08 ? Math.min(1.3, distXZ * 0.32) : 0;
          group.position.y = THREE.MathUtils.damp(
            group.position.y,
            0.32 + hopHeight,
            10,
            dt
          );

          if (distXZ > 0.05) {
            const angle = Math.atan2(
              finalTarget.x - group.position.x,
              finalTarget.z - group.position.z
            );
            group.rotation.y = THREE.MathUtils.damp(
              group.rotation.y,
              angle,
              8,
              dt
            );
          }
        }
      }

      // Animate bankrupt tokens exiting the board (lift, tilt, spin, scale down & fade out)
      if (handles.bankruptExitTokens.size > 0 && handles.tokensRoot) {
        for (const [id, exitState] of handles.bankruptExitTokens.entries()) {
          exitState.progress = Math.min(1, exitState.progress + dt * 0.62);
          const p = exitState.progress;
          const easeOut = 1 - Math.pow(1 - p, 2);

          // Ascend & spiral while tilting and shrinking
          exitState.group.position.y = exitState.startPos.y + easeOut * 2.15;
          exitState.group.rotation.y += dt * (4.5 + p * 8.0);
          exitState.group.rotation.z = Math.sin(p * Math.PI * 3) * 0.35;
          exitState.group.rotation.x = p * 0.55;

          const scaleFactor = Math.max(0.02, 1 - Math.pow(p, 1.6));
          exitState.group.scale.setScalar(scaleFactor);

          const opacity = Math.max(0, 1 - Math.pow(p, 1.35));
          exitState.group.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mat = (child as THREE.Mesh).material;
              if (Array.isArray(mat)) {
                for (const m of mat) m.opacity = opacity;
              } else if (mat) {
                mat.opacity = opacity;
              }
            }
          });

          // Expand and fade out the liquidation ring on the tile
          const ringScale = 1 + easeOut * 3.1;
          exitState.ring.scale.set(ringScale, ringScale, 1);
          (exitState.ring.material as THREE.MeshBasicMaterial).opacity =
            Math.max(0, 0.85 * (1 - p));

          if (p >= 1) {
            handles.tokensRoot.remove(exitState.group);
            handles.tokensRoot.remove(exitState.ring);
            exitState.ring.geometry.dispose();
            (exitState.ring.material as THREE.Material).dispose();
            handles.bankruptExitTokens.delete(id);
          }
        }
      }

      // Animate 3D Dice:
      // 1) Active Multi-Bounce Throw Trajectory (when handles.diceAnimTime > 0), landing on gameState.dice
      // 2) 'ROLL' Phase Pre-Roll Wind-Up Hover Animation (when phase === 'ROLL' and diceAnimTime === 0)
      // 3) Settled Rest State showing the exact rolled top face (when phase !== 'ROLL' and diceAnimTime === 0)
      if (handles.diceMeshes) {
        const [dMesh1, dMesh2] = handles.diceMeshes;
        const [val1, val2] = gameStateRef.current.dice;
        const phase = gameStateRef.current.phase;
        const r1 = dieTopRotations[val1] || [0, 0, 0];
        const r2 = dieTopRotations[val2] || [0, 0, 0];
        const restY = 0.7;

        if (handles.diceAnimTime > 0) {
          handles.diceAnimTime = Math.max(0, handles.diceAnimTime - dt);
          const duration = handles.diceAnimDuration || 1.25;
          const u = 1 - handles.diceAnimTime / duration; // 0 (throw release) -> 1 (settled)
          const easeOut = 1 - Math.pow(1 - u, 3);

          // Horizontal parabolic path from release coordinates to landing spot
          const [s1x, s1z] = handles.diceStartPos[0];
          const [s2x, s2z] = handles.diceStartPos[1];
          const [e1x, e1z] = handles.diceEndPos[0];
          const [e2x, e2z] = handles.diceEndPos[1];

          dMesh1.position.x = THREE.MathUtils.lerp(s1x, e1x, easeOut);
          dMesh1.position.z = THREE.MathUtils.lerp(s1z, e1z, easeOut);
          dMesh2.position.x = THREE.MathUtils.lerp(s2x, e2x, easeOut);
          dMesh2.position.z = THREE.MathUtils.lerp(s2z, e2z, easeOut);

          // Multi-bounce vertical curve (3 decaying arcs landing flush at restY)
          const computeBounceHeight = (prog: number, stagger: number) => {
            const p = Math.min(1, Math.max(0, prog * (1 + stagger)));
            if (p < 0.52) {
              // First high drop & lob from throw height
              const local = p / 0.52;
              return (
                (1 - local) * 2.1 + Math.sin(local * Math.PI) * 1.15
              );
            }
            if (p < 0.8) {
              // Second bounce after first board impact
              const local = (p - 0.52) / 0.28;
              return Math.sin(local * Math.PI) * 1.05;
            }
            // Third subtle settling bounce
            const local = (p - 0.8) / 0.2;
            return Math.sin(local * Math.PI) * 0.32;
          };

          dMesh1.position.y = restY + computeBounceHeight(u, 0);
          dMesh2.position.y = restY + computeBounceHeight(u, 0.04);

          // Continuous multi-axis tumble that decays smoothly to 0 mod 2*PI so each die lands on r1 / r2
          const spinDecay = Math.pow(1 - u, 2.35);
          const fullSpinsX = Math.PI * 6; // 3 full turns
          const fullSpinsZ = Math.PI * 4; // 2 full turns
          const fullSpinsY = Math.PI * 4; // 2 full horizontal turns

          dMesh1.rotation.x = r1[0] + spinDecay * fullSpinsX;
          dMesh1.rotation.z = r1[2] + spinDecay * fullSpinsZ;
          dMesh1.rotation.y = handles.diceTargetYaw[0] + spinDecay * fullSpinsY;

          dMesh2.rotation.x = r2[0] - spinDecay * fullSpinsX;
          dMesh2.rotation.z = r2[2] + spinDecay * fullSpinsZ;
          dMesh2.rotation.y = handles.diceTargetYaw[1] - spinDecay * fullSpinsY;
        } else if (phase === 'ROLL') {
          // During 'ROLL' phase: active 3D wind-up hover & spin animation awaiting the roll result
          const hoverY1 = restY + 0.68 + Math.sin(elapsed * 4.2) * 0.16;
          const hoverY2 = restY + 0.68 + Math.cos(elapsed * 4.2) * 0.16;
          const orbitX1 = -1.25 + Math.cos(elapsed * 2.4) * 0.18;
          const orbitZ1 = 2.8 + Math.sin(elapsed * 2.4) * 0.18;
          const orbitX2 = 1.25 - Math.cos(elapsed * 2.4) * 0.18;
          const orbitZ2 = 2.8 - Math.sin(elapsed * 2.4) * 0.18;

          dMesh1.position.x = THREE.MathUtils.damp(
            dMesh1.position.x,
            orbitX1,
            8,
            dt
          );
          dMesh1.position.y = THREE.MathUtils.damp(
            dMesh1.position.y,
            hoverY1,
            8,
            dt
          );
          dMesh1.position.z = THREE.MathUtils.damp(
            dMesh1.position.z,
            orbitZ1,
            8,
            dt
          );

          dMesh2.position.x = THREE.MathUtils.damp(
            dMesh2.position.x,
            orbitX2,
            8,
            dt
          );
          dMesh2.position.y = THREE.MathUtils.damp(
            dMesh2.position.y,
            hoverY2,
            8,
            dt
          );
          dMesh2.position.z = THREE.MathUtils.damp(
            dMesh2.position.z,
            orbitZ2,
            8,
            dt
          );

          dMesh1.rotation.x += dt * 3.2;
          dMesh1.rotation.y += dt * 2.6;
          dMesh1.rotation.z += dt * 1.9;

          dMesh2.rotation.x -= dt * 2.9;
          dMesh2.rotation.y -= dt * 3.1;
          dMesh2.rotation.z += dt * 2.2;
        } else {
          // Settled on the randomly determined result [val1, val2]
          const [e1x, e1z] = handles.diceEndPos[0];
          const [e2x, e2z] = handles.diceEndPos[1];

          dMesh1.position.x = THREE.MathUtils.damp(
            dMesh1.position.x,
            e1x,
            10,
            dt
          );
          dMesh1.position.y = THREE.MathUtils.damp(
            dMesh1.position.y,
            restY,
            12,
            dt
          );
          dMesh1.position.z = THREE.MathUtils.damp(
            dMesh1.position.z,
            e1z,
            10,
            dt
          );

          dMesh2.position.x = THREE.MathUtils.damp(
            dMesh2.position.x,
            e2x,
            10,
            dt
          );
          dMesh2.position.y = THREE.MathUtils.damp(
            dMesh2.position.y,
            restY,
            12,
            dt
          );
          dMesh2.position.z = THREE.MathUtils.damp(
            dMesh2.position.z,
            e2z,
            10,
            dt
          );

          dMesh1.rotation.x = THREE.MathUtils.damp(
            dMesh1.rotation.x,
            r1[0],
            12,
            dt
          );
          dMesh1.rotation.y = THREE.MathUtils.damp(
            dMesh1.rotation.y,
            handles.diceTargetYaw[0],
            12,
            dt
          );
          dMesh1.rotation.z = THREE.MathUtils.damp(
            dMesh1.rotation.z,
            r1[2],
            12,
            dt
          );

          dMesh2.rotation.x = THREE.MathUtils.damp(
            dMesh2.rotation.x,
            r2[0],
            12,
            dt
          );
          dMesh2.rotation.y = THREE.MathUtils.damp(
            dMesh2.rotation.y,
            handles.diceTargetYaw[1],
            12,
            dt
          );
          dMesh2.rotation.z = THREE.MathUtils.damp(
            dMesh2.rotation.z,
            r2[2],
            12,
            dt
          );
        }

        // Update dynamic contact shadows and gold landing halos beneath both dice
        if (handles.diceShadows) {
          const [sh1, sh2] = handles.diceShadows;
          sh1.position.x = dMesh1.position.x;
          sh1.position.z = dMesh1.position.z;
          sh2.position.x = dMesh2.position.x;
          sh2.position.z = dMesh2.position.z;

          const h1 = Math.max(0, dMesh1.position.y - restY);
          const h2 = Math.max(0, dMesh2.position.y - restY);
          const sc1 = Math.max(0.55, 1 - h1 * 0.16);
          const sc2 = Math.max(0.55, 1 - h2 * 0.16);
          sh1.scale.set(sc1, sc1, 1);
          sh2.scale.set(sc2, sc2, 1);
          (sh1.material as THREE.MeshBasicMaterial).opacity = Math.max(
            0.18,
            0.6 - h1 * 0.15
          );
          (sh2.material as THREE.MeshBasicMaterial).opacity = Math.max(
            0.18,
            0.6 - h2 * 0.15
          );
        }

        if (handles.diceHalos) {
          const [hl1, hl2] = handles.diceHalos;
          hl1.position.x = dMesh1.position.x;
          hl1.position.z = dMesh1.position.z;
          hl2.position.x = dMesh2.position.x;
          hl2.position.z = dMesh2.position.z;

          const haloScale =
            handles.diceAnimTime > 0
              ? 1.15
              : phase === 'ROLL'
              ? 1.05 + Math.sin(elapsed * 4.2) * 0.12
              : 1.0;
          hl1.scale.set(haloScale, haloScale, 1);
          hl2.scale.set(haloScale, haloScale, 1);
        }

        // Project 3D Dice Status Badge directly above the dice pair
        if (diceBadgeRef.current) {
          const midX = (dMesh1.position.x + dMesh2.position.x) * 0.5;
          const midZ = (dMesh1.position.z + dMesh2.position.z) * 0.5;
          const maxY = Math.max(dMesh1.position.y, dMesh2.position.y) + 0.85;
          _scratchVecA.set(midX, maxY, midZ).project(camera);
          if (_scratchVecA.z > 1) {
            diceBadgeRef.current.style.display = 'none';
          } else {
            const cw = container?.clientWidth || window.innerWidth;
            const ch = container?.clientHeight || window.innerHeight;
            const bx = (_scratchVecA.x * 0.5 + 0.5) * cw;
            const by = (-_scratchVecA.y * 0.5 + 0.5) * ch;
            diceBadgeRef.current.style.display = 'flex';
            diceBadgeRef.current.style.transform = `translate3d(${bx.toFixed(
              1
            )}px, ${by.toFixed(1)}px, 0) translate(-50%, -50%)`;
          }
        }
      }

      // Update selection ring position
      const selIdx = selectedTileRef.current;
      const sideLength =
        BOARD_SIZE_CONFIGS[gameStateRef.current.boardSize]?.sideLength || 10;
      const totalTiles = sideLength * 4;
      if (handles.selectionRing) {
        if (selIdx !== null && selIdx >= 0 && selIdx < totalTiles) {
          const tf = getTileTransform(selIdx, sideLength);
          handles.selectionRing.visible = true;
          handles.selectionRing.position.x = THREE.MathUtils.damp(
            handles.selectionRing.position.x,
            tf.x,
            12,
            dt
          );
          handles.selectionRing.position.z = THREE.MathUtils.damp(
            handles.selectionRing.position.z,
            tf.z,
            12,
            dt
          );
          handles.selectionRing.rotation.z = elapsed * 0.8;
        } else {
          handles.selectionRing.visible = false;
        }
      }

      // Smoothly damp camera when a preset transition is active
      if (handles.hasActiveCameraTransition) {
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          handles.cameraPosGoal.x,
          4.5,
          dt
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          handles.cameraPosGoal.y,
          4.5,
          dt
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          handles.cameraPosGoal.z,
          4.5,
          dt
        );
        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          handles.cameraTargetGoal.x,
          5.5,
          dt
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          handles.cameraTargetGoal.y,
          5.5,
          dt
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          handles.cameraTargetGoal.z,
          5.5,
          dt
        );

        if (
          camera.position.distanceTo(handles.cameraPosGoal) < 0.08 &&
          controls.target.distanceTo(handles.cameraTargetGoal) < 0.08
        ) {
          handles.hasActiveCameraTransition = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      // Project 3D Tile coordinates to 2D Screen Space for Crisp HTML Labels only when enabled in Settings
      const shouldShowLabels = Boolean(show3DLabelsRef.current);
      const cw = container?.clientWidth || window.innerWidth;
      const ch = container?.clientHeight || window.innerHeight;
      const labelNodes = labelNodesRef.current;

      for (let i = 0; i < totalTiles; i++) {
        const el = labelNodes[i];
        if (!el) continue;
        if (!shouldShowLabels) {
          el.style.display = 'none';
          continue;
        }
        const tf = getTileTransform(i, sideLength);
        _scratchVecA.set(tf.x, 0.36, tf.z).project(camera);
        if (_scratchVecA.z > 1) {
          el.style.display = 'none';
          continue;
        }
        const sx = (_scratchVecA.x * 0.5 + 0.5) * cw;
        const sy = (-_scratchVecA.y * 0.5 + 0.5) * ch;
        el.style.display = 'flex';
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(
          1
        )}px, 0) translate(-50%, -50%)`;
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        handleContextLost
      );
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        handleContextRestored
      );
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  const tiles = getBoardTiles(gameState.boardSize);
  const sideLength = BOARD_SIZE_CONFIGS[gameState.boardSize]?.sideLength || 10;
  const inspectedIdx =
    hoveredTileIdx !== null && hoveredTileIdx < tiles.length
      ? hoveredTileIdx
      : selectedTileIndex !== null && selectedTileIndex < tiles.length
      ? selectedTileIndex
      : null;
  const inspectedTile = inspectedIdx !== null ? tiles[inspectedIdx] : null;
  const inspectedProp =
    inspectedTile != null
      ? gameState.properties[inspectedTile.index]
      : undefined;
  const inspectedOwner = inspectedProp?.ownerId
    ? gameState.players.find((p) => p.id === inspectedProp.ownerId)
    : null;

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden select-none z-0">
      {/* 1. WebGL 3D Canvas Mount */}
      <div
        ref={canvasMountRef}
        className="w-full h-full"
        aria-label="Grand Estates 3D Interactive Monopoly Board"
      />

      {/* 2. Crisp Native HTML/CSS Projected 3D Tile Labels (Guarantees 100% Sharp Readability in 3D Top-Down & 3D Views!) */}
      <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
        {tiles.map((tile, idx) => {
          const isCorner = idx % sideLength === 0;
          const prop = gameState.properties[idx];
          const owner = prop?.ownerId
            ? gameState.players.find((p) => p.id === prop.ownerId)
            : null;
          const isSelected = selectedTileIndex === idx;
          const isCompact = sideLength >= 17;

            return (
            <button
              key={`${gameState.boardSize}-${idx}`}
              ref={(el) => {
                labelNodesRef.current[idx] = el;
              }}
              onClick={() => onSelectTile(idx)}
              style={{
                top: 0,
                left: 0,
                borderColor: owner
                  ? owner.color
                  : isSelected
                  ? '#D4AF37'
                  : 'rgba(212,175,55,0.45)',
              }}
              className={`pointer-events-auto absolute flex-col items-center justify-center rounded-md border shadow-md transition-colors cursor-pointer ${
                isCorner
                  ? 'bg-[#14100E] text-[#D4AF37] px-1.5 py-1'
                  : 'bg-[#FAF6F0] text-[#0F0C0A] px-1 py-0.5'
              } ${
                isSelected ? 'ring-2 ring-[#D4AF37] z-20' : 'hover:z-20'
              }`}
            >
              {/* Top Color Bar + Short Name */}
              <div className="flex items-center gap-1 leading-none">
                {!isCorner && (
                  <span
                    className="w-2 h-2 rounded-xs shrink-0 border border-black/30"
                    style={{ backgroundColor: tile.colorHex }}
                  />
                )}
                <span
                  className={`font-extrabold tracking-tight whitespace-nowrap ${
                    isCompact ? 'text-[9px]' : 'text-[10px] md:text-[11px]'
                  }`}
                >
                  {tile.shortName}
                </span>
              </div>

              {/* Price / Tax / Owner Sub-line */}
              <div
                className={`font-mono font-bold leading-none mt-0.5 flex items-center gap-1 ${
                  isCompact ? 'text-[8px]' : 'text-[9px] md:text-[10px]'
                }`}
              >
                {tile.price ? (
                  <span
                    className={
                      isCorner ? 'text-[#D4AF37]' : 'text-stone-800 font-extrabold'
                    }
                  >
                    ${tile.price}
                  </span>
                ) : tile.taxAmount ? (
                  <span className="text-red-600 font-extrabold">
                    -${tile.taxAmount}
                  </span>
                ) : (
                  <span className="text-[#D4AF37]">#{tile.index}</span>
                )}
                {owner && (
                  <span
                    className="px-1 rounded-xs text-[8px] font-extrabold text-[#0F0C0A]"
                    style={{ backgroundColor: owner.color }}
                  >
                    {owner.name.slice(0, 3).toUpperCase()}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {/* Projected 3D Dice Status & Result Badge anchored above the 3D dice */}
        <div
          ref={diceBadgeRef}
          style={{ top: 0, left: 0 }}
          className="absolute pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14100E] border border-[#D4AF37] text-[#FAF6F0] shadow-xl whitespace-nowrap z-20"
        >
          {gameState.phase === 'ROLL' ? (
            <>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#D4AF37]">
                Roll Phase
              </span>
              <span className="text-[10px] text-stone-300">
                · 3D Dice Ready
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold text-stone-300">
                Rolled:
              </span>
              <span className="text-xs font-mono font-extrabold text-[#D4AF37]">
                {gameState.dice[0]} + {gameState.dice[1]} ={' '}
                {gameState.dice[0] + gameState.dice[1]}
              </span>
              {gameState.lastRollWasDoubles && (
                <span className="px-1.5 py-0.2 rounded bg-[#D4AF37] text-[#0F0C0A] text-[9px] font-extrabold">
                  DOUBLES
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* 3. Optional Top-Left 3D Tile Inspector (Controlled via User Settings — Default OFF) */}
      {show3DCornerInspector && inspectedTile && (
        <div className="fixed top-16 left-4 z-15 flex flex-col gap-2 max-w-xs pointer-events-auto">
          <div className="rounded-xl bg-[#14100E] border-2 border-[#D4AF37]/60 shadow-2xl p-3 text-[#FAF6F0] space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-stone-300">
              <span className="font-mono font-bold text-[#D4AF37]">
                Space #{inspectedTile.index} · {inspectedTile.city}
              </span>
              {inspectedTile.price && (
                <span className="font-mono font-extrabold text-sm text-[#D4AF37]">
                  ${inspectedTile.price}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-xs shrink-0 border border-white/30"
                style={{ backgroundColor: inspectedTile.colorHex }}
              />
              <span
                className="text-base font-bold text-white leading-tight"
                style={{ fontFamily: 'var(--font-fraunces), serif' }}
              >
                {inspectedTile.name}
              </span>
            </div>
            <div className="text-xs text-stone-300 flex items-center justify-between pt-0.5">
              <span>
                {inspectedOwner
                  ? `Owner: ${inspectedOwner.name}`
                  : inspectedTile.price
                  ? 'Unowned (Available)'
                  : inspectedTile.description}
              </span>
              <button
                onClick={() => onSelectTile(inspectedTile.index)}
                className="px-2 py-0.5 rounded bg-[#D4AF37] text-[#0F0C0A] font-bold text-[11px] hover:bg-[#e5c247] shrink-0 cursor-pointer"
              >
                Deed Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import * as THREE from "three";
import {
  BEDROCK_Y,
  advancePlanetPosition,
  blockKey,
  canCraft,
  CHUNK_SIZE,
  CITY_BEACH_OUTER_RADIUS,
  CITY_RADIUS,
  createChunkBlocks,
  FISH_TYPE_BY_ID,
  HARBOR_DOCK_MAX_Z,
  HARBOR_DOCK_MIN_Z,
  HARBOR_WATER_OUTER_RADIUS,
  isNearHarbor,
  MAX_CITY_BUILDING_HEIGHT,
  MAX_PLANET_CHUNK_X,
  MAX_PLANET_CHUNK_Z,
  MIN_PLANET_CHUNK_X,
  MIN_PLANET_CHUNK_Z,
  PLANET_LATITUDE_BLOCKS,
  PLANET_LONGITUDE_BLOCKS,
  PLANET_MAX_Z,
  PLANET_MIN_X,
  PLANET_MIN_Z,
  PLANET_RADIUS,
  planetFrameAt,
  planetPointAt,
  RECIPES,
  WORLD_LOCATIONS,
  terrainHeightAt,
  wrapPlanetX,
} from "../shared/world.js";
import grassTextureUrl from "./assets/blocks/own/grass_top.png";
import dirtTextureUrl from "./assets/blocks/own/dirt.png";
import stoneTextureUrl from "./assets/blocks/own/stone.png";
import planksTextureUrl from "./assets/blocks/own/oak_planks.png";
import logTextureUrl from "./assets/blocks/own/oak_log_side.png";
import glassTextureUrl from "./assets/blocks/own/glass.png";
import leavesTextureUrl from "./assets/blocks/own/oak_leaves.png";
import sandTextureUrl from "./assets/blocks/own/sand.png";
import obsidianTextureUrl from "./assets/blocks/own/obsidian.png";
import snowTextureUrl from "./assets/blocks/own/snow.png";
import iceTextureUrl from "./assets/blocks/pixel-perfection/ice.png";
import brickTextureUrl from "./assets/blocks/vibes/brick_red.png";
import blackConcreteTextureUrl from "./assets/blocks/own/black_concrete.png";
import whiteConcreteTextureUrl from "./assets/blocks/own/white_concrete.png";
import blueConcreteTextureUrl from "./assets/blocks/own/blue_concrete.png";
import redConcreteTextureUrl from "./assets/blocks/own/red_concrete.png";
import craftingTableTextureUrl from "./assets/blocks/vibes/table.png";
import waterTextureUrl from "./assets/blocks/own/water.png";
import "./style.css";

const canvas = document.querySelector("#world");
const statusText = document.querySelector("#connection-status");
const statusDot = document.querySelector("#connection-dot");
const toast = document.querySelector("#toast");
const playerNameInput = document.querySelector("#player-name");
const multiplayerMenu = document.querySelector("#multiplayer-menu");
const lobbyPlayerNameInput = document.querySelector("#lobby-player-name");
const lobbyStatus = document.querySelector("#lobby-status");
const lobbyNotice = document.querySelector("#lobby-notice");
const lobbyRoomList = document.querySelector("#lobby-room-list");
const savedGameList = document.querySelector("#saved-game-list");
const savedGamesToggle = document.querySelector("#toggle-saved-games-button");
const lobbyHome = document.querySelector("#lobby-home");
const lobbyWaiting = document.querySelector("#lobby-waiting");
const roomNotice = document.querySelector("#room-notice");
const roomTitle = document.querySelector("#room-title");
const roomStateLabel = document.querySelector("#room-state-label");
const roomMemberList = document.querySelector("#room-member-list");
const startRoomButton = document.querySelector("#start-room-button");
const gameMenu = document.querySelector("#game-menu");
const gameMenuToggle = document.querySelector("#game-menu-toggle");
const gameMenuStatus = document.querySelector("#game-menu-status");
const worldMapPanel = document.querySelector("#world-map-panel");
const worldMapCanvas = document.querySelector("#world-map-canvas");
const worldMapMarkers = document.querySelector("#world-map-markers");
const teleportTarget = document.querySelector("#teleport-target");
const teleportButton = document.querySelector("#teleport-button");
const hotbar = document.querySelector("#hotbar");
const inventoryPanel = document.querySelector("#inventory-panel");
const inventoryList = document.querySelector("#inventory-list");
const recipeList = document.querySelector("#recipe-list");
const joystick = document.querySelector("#joystick");
const joystickKnob = document.querySelector("#joystick-knob");
const healthProgress = document.querySelector("#health-progress");
const healthValue = document.querySelector("#health-value");
const xpHud = document.querySelector("#xp-hud");
const coinHud = document.querySelector("#coin-hud");
const respawnButton = document.querySelector("#respawn-button");
const attackButton = document.querySelector("#attack-button");
const fishButton = document.querySelector("#fish-button");
const savedPlayerName = localStorage.getItem("player-name");
const activeRoomStorageKey = "active-room-id";
let resumeRequested = false;
if (savedPlayerName) {
  playerNameInput.value = savedPlayerName;
  lobbyPlayerNameInput.value = savedPlayerName;
}
const blockChoices = [
  ["grass", "Grass", grassTextureUrl],
  ["dirt", "Dirt", dirtTextureUrl],
  ["stone", "Stone", stoneTextureUrl],
  ["oak_planks", "Planks", planksTextureUrl],
  ["oak_log", "Log", logTextureUrl],
  ["glass", "Glass", glassTextureUrl],
  ["leaves", "Leaves", leavesTextureUrl],
  ["sand", "Sand", sandTextureUrl],
  ["campfire", "Campfire", null],
  ["brick", "Brick", brickTextureUrl],
  ["obsidian", "Obsidian", obsidianTextureUrl],
  ["snow", "Snow", snowTextureUrl],
  ["ice", "Ice", iceTextureUrl],
  ["black_concrete", "Road", blackConcreteTextureUrl],
  ["white_concrete", "Concrete", whiteConcreteTextureUrl],
  ["blue_concrete", "Blue Concrete", blueConcreteTextureUrl],
  ["red_concrete", "Red Concrete", redConcreteTextureUrl],
  ["crafting_table", "Crafting Table", craftingTableTextureUrl],
  ["water", "Water", waterTextureUrl],
  ["fishing_rod", "Fishing Rod", null],
  ["raw_fish", "Bluegill", null],
  ["sunfish", "Sunfish", null],
  ["gold_fish", "Goldfish", null],
  ["salmon", "Salmon", null],
];
const blockNames = new Map(blockChoices.map(([id, name]) => [id, name]));
const blockChoiceById = new Map(blockChoices.map((choice) => [choice[0], choice]));
const HOTBAR_SIZE = 6;
const hotbarItems = Array(HOTBAR_SIZE).fill(null);
const textureLoader = new THREE.TextureLoader();
const materials = new Map();

function createFishTexture(color = "#91d8db") {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 16;
  textureCanvas.height = 16;
  const context = textureCanvas.getContext("2d");
  context.fillStyle = color;
  context.fillRect(4, 6, 8, 5);
  context.fillRect(2, 7, 2, 3);
  context.fillRect(12, 7, 2, 3);
  context.fillStyle = "#eaf3d1";
  context.fillRect(5, 7, 6, 3);
  context.fillStyle = "#203c43";
  context.fillRect(10, 7, 1, 1);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function createCampfireTexture() {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 16;
  textureCanvas.height = 16;
  const context = textureCanvas.getContext("2d");
  context.fillStyle = "#302a27";
  context.fillRect(0, 0, 16, 16);
  context.fillStyle = "#604230";
  context.fillRect(1, 11, 14, 3);
  context.fillRect(3, 9, 10, 2);
  context.fillStyle = "#8c5a36";
  context.fillRect(2, 14, 12, 1);
  context.fillStyle = "#ed7338";
  context.fillRect(4, 5, 2, 5);
  context.fillRect(6, 3, 3, 7);
  context.fillRect(9, 6, 3, 4);
  context.fillStyle = "#ffd56a";
  context.fillRect(6, 5, 3, 4);
  context.fillRect(10, 7, 1, 2);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function createFishingRodTexture() {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 16;
  textureCanvas.height = 16;
  const context = textureCanvas.getContext("2d");
  context.fillStyle = "#b2875b";
  context.fillRect(7, 2, 2, 8);
  context.fillStyle = "#8b5d3a";
  context.fillRect(5, 10, 6, 2);
  context.strokeStyle = "#fff0d8";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(8, 0);
  context.lineTo(12, 6);
  context.stroke();
  context.strokeStyle = "#d3d5d9";
  context.beginPath();
  context.moveTo(12, 6);
  context.lineTo(14, 10);
  context.stroke();
  context.fillStyle = "#c67b4f";
  context.fillRect(13, 9, 2, 2);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

for (const [id, name, url] of blockChoices) {
  const texture = url
    ? textureLoader.load(url)
    : id === "raw_fish"
      ? createFishTexture("#91d8db")
      : id === "sunfish"
        ? createFishTexture("#f5c76a")
        : id === "gold_fish"
          ? createFishTexture("#e4c15d")
          : id === "salmon"
            ? createFishTexture("#ff8a5b")
            : id === "fishing_rod"
              ? createFishingRodTexture()
              : createCampfireTexture();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  materials.set(
    id,
    new THREE.MeshLambertMaterial({
      map: texture,
      transparent: id === "glass" || id === "water",
      opacity: id === "glass" ? 0.58 : id === "water" ? 0.62 : 1,
      depthWrite: id !== "glass" && id !== "water",
    }),
  );
}

const scene = new THREE.Scene();
scene.background = new THREE.Color("#a9d8ed");
scene.fog = new THREE.Fog("#a9d8ed", 34, 70);
const camera = new THREE.PerspectiveCamera(74, 1, 0.1, 90);
camera.rotation.order = "YXZ";
camera.position.set(0, 1.65, 0);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight("#e6f5ff", "#566147", 2.1));
const sunlight = new THREE.DirectionalLight("#fff1ce", 2.2);
sunlight.position.set(-10, 18, 9);
scene.add(sunlight);

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const blockMeshes = [];
const remotePlayers = new Map();
const botAvatars = new Map();
const droppedItemMeshes = new Map();
const players = new Map();
const bots = new Map();
const worldBlocks = new Map();
const loadedChunks = new Map();
const renderCandidatesByChunk = new Map();
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const clock = new THREE.Clock();
const moveKeys = new Set();
const joystickVector = new THREE.Vector2();
const playerPosition = new THREE.Vector3(0, 1.65, 0);
const look = { yaw: 0, pitch: 0 };
let lastChunkX = null;
let lastChunkZ = null;
const state = {
  id: null,
  seed: 1,
  socket: null,
  connected: false,
  mode: "survival",
  selected: null,
  health: 100,
  xp: 0,
  level: 0,
  coins: 0,
  lastSentAt: 0,
  lastPickupAt: 0,
  jumpVelocity: 0,
  inventory: new Map(),
  pendingHotbarItem: null,
  fishingCast: null,
};
let lobbyRoom = null;
let toastTimer;
let worldRenderTimer;

function notify(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function updateCamera() {
  const frame = planetFrameAt(playerPosition.x, playerPosition.z);
  const point = planetPointAt(playerPosition.x, playerPosition.y + 1, playerPosition.z);
  const up = new THREE.Vector3(frame.up.x, frame.up.y, frame.up.z);
  const east = new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z);
  const north = new THREE.Vector3(frame.north.x, frame.north.y, frame.north.z);
  const forward = north.multiplyScalar(Math.cos(look.yaw)).addScaledVector(east, -Math.sin(look.yaw));
  forward.multiplyScalar(Math.cos(look.pitch)).addScaledVector(up, Math.sin(look.pitch));
  camera.position.set(point.x, point.y, point.z);
  camera.up.copy(up);
  camera.lookAt(camera.position.clone().add(forward));
}

function surfaceQuaternionAt(x, z, yaw = 0) {
  const frame = planetFrameAt(x, z);
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z),
    new THREE.Vector3(frame.up.x, frame.up.y, frame.up.z),
    new THREE.Vector3(-frame.north.x, -frame.north.y, -frame.north.z),
  );
  const orientation = new THREE.Quaternion().setFromRotationMatrix(basis);
  orientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  return orientation;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function chunkKey(chunkX, chunkZ) {
  return `${chunkX},${chunkZ}`;
}

function wrapPlanetChunkX(chunkX) {
  const chunkCount = MAX_PLANET_CHUNK_X - MIN_PLANET_CHUNK_X + 1;
  return ((chunkX - MIN_PLANET_CHUNK_X) % chunkCount + chunkCount) % chunkCount + MIN_PLANET_CHUNK_X;
}

function getChunkRenderCandidates(chunkX, chunkZ, chunk) {
  const candidates = new Set();
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;
  for (let x = startX; x < startX + CHUNK_SIZE; x += 1) {
    for (let z = startZ; z < startZ + CHUNK_SIZE; z += 1) {
      const surface = terrainHeightAt(x, z, state.seed);
      const lowestNeighbor = Math.min(
        terrainHeightAt(x - 1, z, state.seed),
        terrainHeightAt(x + 1, z, state.seed),
        terrainHeightAt(x, z - 1, state.seed),
        terrainHeightAt(x, z + 1, state.seed),
      );
      const isChunkEdge =
        x === startX || x === startX + CHUNK_SIZE - 1 || z === startZ || z === startZ + CHUNK_SIZE - 1;
      const firstVisibleY = isChunkEdge
        ? BEDROCK_Y + 1
        : Math.min(surface, lowestNeighbor + 1);
      const renderTopY = Math.hypot(x, z) <= CITY_RADIUS
        ? MAX_CITY_BUILDING_HEIGHT
        : surface + 7;
      for (let y = firstVisibleY; y <= renderTopY; y += 1) {
        const key = blockKey(x, y, z);
        if (chunk.has(key)) candidates.add(key);
      }
    }
  }
  return candidates;
}

function addRenderCandidatesAround(x, y, z) {
  for (const [candidateX, candidateY, candidateZ] of [
    [x, y, z],
    [x, y + 1, z],
    [x, y - 1, z],
    [x + 1, y, z],
    [x - 1, y, z],
    [x, y, z + 1],
    [x, y, z - 1],
  ]) {
    const key = chunkKey(
      Math.floor(wrapPlanetX(candidateX) / CHUNK_SIZE),
      Math.floor(candidateZ / CHUNK_SIZE),
    );
    renderCandidatesByChunk.get(key)?.add(blockKey(candidateX, candidateY, candidateZ));
  }
}

function ensureChunkLoaded(chunkX, chunkZ) {
  chunkX = wrapPlanetChunkX(chunkX);
  if (chunkZ < MIN_PLANET_CHUNK_Z || chunkZ > MAX_PLANET_CHUNK_Z) return;
  const key = chunkKey(chunkX, chunkZ);
  if (loadedChunks.has(key)) return;

  const chunk = createChunkBlocks(chunkX, chunkZ, state.seed);
  loadedChunks.set(key, chunk);
  renderCandidatesByChunk.set(key, getChunkRenderCandidates(chunkX, chunkZ, chunk));
  for (const [block, type] of chunk) worldBlocks.set(block, type);
  if (state.socket?.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify({ type: "chunk", x: chunkX, z: chunkZ }));
  }
}

function updateChunkWindow(force = false) {
  const chunkX = Math.floor(wrapPlanetX(playerPosition.x) / CHUNK_SIZE);
  const chunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
  if (!force && chunkX === lastChunkX && chunkZ === lastChunkZ) return false;
  lastChunkX = chunkX;
  lastChunkZ = chunkZ;

  const loadRadius = 2;
  const unloadRadius = loadRadius + 1;
  let changed = false;
  for (const [key, chunk] of loadedChunks) {
    const [loadedX, loadedZ] = key.split(",").map(Number);
    const deltaX = Math.abs(loadedX - chunkX);
    const wrappedDeltaX = Math.min(deltaX, MAX_PLANET_CHUNK_X - MIN_PLANET_CHUNK_X + 1 - deltaX);
    if (Math.max(wrappedDeltaX, Math.abs(loadedZ - chunkZ)) <= unloadRadius) continue;
    for (const block of chunk.keys()) worldBlocks.delete(block);
    loadedChunks.delete(key);
    renderCandidatesByChunk.delete(key);
    changed = true;
  }

  for (let x = chunkX - loadRadius; x <= chunkX + loadRadius; x += 1) {
    for (let z = chunkZ - loadRadius; z <= chunkZ + loadRadius; z += 1) {
      if (z < MIN_PLANET_CHUNK_Z || z > MAX_PLANET_CHUNK_Z) continue;
      const wrappedX = wrapPlanetChunkX(x);
      if (!loadedChunks.has(chunkKey(wrappedX, z))) {
        ensureChunkLoaded(x, z);
        changed = true;
      }
    }
  }
  return changed;
}

function renderWorld() {
  for (const mesh of blockMeshes) scene.remove(mesh);
  blockMeshes.length = 0;

  const grouped = new Map();
  const playerChunkX = Math.floor(wrapPlanetX(playerPosition.x) / CHUNK_SIZE);
  const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
  for (const [chunkKey, candidates] of renderCandidatesByChunk) {
    const [chunkX, chunkZ] = chunkKey.split(",").map(Number);
    const chunkDeltaX = Math.abs(chunkX - playerChunkX);
    const wrappedDeltaX = Math.min(chunkDeltaX, MAX_PLANET_CHUNK_X - MIN_PLANET_CHUNK_X + 1 - chunkDeltaX);
    const isDistant = Math.max(wrappedDeltaX, Math.abs(chunkZ - playerChunkZ)) > 1;
    for (const key of candidates) {
      const type = worldBlocks.get(key);
      if (!materials.has(type)) continue;
      const [x, y, z] = key.split(",").map(Number);
      if (y === BEDROCK_Y) continue;
      if (
        isDistant &&
        (type === "grass" || type === "dirt" || type === "stone") &&
        y < terrainHeightAt(x, z, state.seed)
      ) continue;
      const visible = (neighborX, neighborY, neighborZ) => {
        const neighborType = worldBlocks.get(blockKey(neighborX, neighborY, neighborZ));
        const neighborIsTransparent = neighborType === "glass" || neighborType === "water";
        return !neighborType || neighborIsTransparent || type === "glass" || type === "water";
      };
      const hasVisibleFace =
        visible(x, y + 1, z) ||
        visible(x, y - 1, z) ||
        visible(x + 1, y, z) ||
        visible(x - 1, y, z) ||
        visible(x, y, z + 1) ||
        visible(x, y, z - 1);
      if (!hasVisibleFace) continue;
      if (!grouped.has(type)) grouped.set(type, []);
      grouped.get(type).push([x, y, z]);
    }
  }

  const matrix = new THREE.Object3D();
  const east = new THREE.Vector3();
  const up = new THREE.Vector3();
  const westNorth = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const orientation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (const [type, coordinates] of grouped) {
    const mesh = new THREE.InstancedMesh(cubeGeometry, materials.get(type), coordinates.length);
    mesh.userData.coordinates = coordinates;
    mesh.userData.blockType = type;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    for (let index = 0; index < coordinates.length; index += 1) {
      const [x, y, z] = coordinates[index];
      const frame = planetFrameAt(x, z);
      const point = planetPointAt(x, y + 0.5, z);
      east.set(frame.east.x, frame.east.y, frame.east.z);
      up.set(frame.up.x, frame.up.y, frame.up.z);
      westNorth.set(-frame.north.x, -frame.north.y, -frame.north.z);
      basis.makeBasis(east, up, westNorth);
      orientation.setFromRotationMatrix(basis);
      const blockRadius = PLANET_RADIUS + y + 1;
      scale.set(
        Math.max(0.05, 2 * Math.cos(frame.latitude) * blockRadius * Math.tan(Math.PI / PLANET_LONGITUDE_BLOCKS)),
        1,
        2 * blockRadius * Math.tan(Math.PI / (2 * PLANET_LATITUDE_BLOCKS)),
      );
      matrix.position.set(point.x, point.y, point.z);
      matrix.quaternion.copy(orientation);
      matrix.scale.copy(scale);
      matrix.updateMatrix();
      mesh.setMatrixAt(index, matrix.matrix);
    }
    scene.add(mesh);
    blockMeshes.push(mesh);
  }
}

function scheduleWorldRender() {
  window.clearTimeout(worldRenderTimer);
  worldRenderTimer = window.setTimeout(renderWorld, 100);
}

function avatarLabel(text, color) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 256;
  labelCanvas.height = 64;
  const context = labelCanvas.getContext("2d");
  context.fillStyle = "rgba(20, 31, 27, 0.8)";
  context.roundRect(4, 4, 248, 56, 18);
  context.fill();
  context.fillStyle = color;
  context.font = "bold 30px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text.slice(0, 16), 128, 34);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(1.65, 0.42, 1);
  sprite.position.y = 1.65;
  return sprite;
}

function makeAvatar(entity, isBot = false) {
  const group = new THREE.Group();
  const skin = isBot ? "#e4c39c" : "#ecd2b4";
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: entity.color ?? "#7eaa80" });
  const skinMaterial = new THREE.MeshLambertMaterial({ color: skin });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.68, 0.32), bodyMaterial);
  body.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMaterial);
  head.position.y = 1.34;
  const armGeometry = new THREE.BoxGeometry(0.17, 0.55, 0.21);
  const legGeometry = new THREE.BoxGeometry(0.19, 0.48, 0.23);
  const bootGeometry = new THREE.BoxGeometry(0.2, 0.12, 0.25);
  const bootMaterial = new THREE.MeshLambertMaterial({ color: "#514d45" });
  const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
  const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
  const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
  const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
  const leftBoot = new THREE.Mesh(bootGeometry, bootMaterial);
  const rightBoot = new THREE.Mesh(bootGeometry, bootMaterial);
  leftArm.position.set(-0.32, 0.8, 0);
  rightArm.position.set(0.32, 0.8, 0);
  leftLeg.position.set(-0.13, 0.26, 0);
  rightLeg.position.set(0.13, 0.26, 0);
  leftBoot.position.set(-0.13, 0.06, -0.015);
  rightBoot.position.set(0.13, 0.06, -0.015);
  group.add(
    body,
    head,
    avatarLabel(entity.name, "#ffffff"),
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftBoot,
    rightBoot,
  );
  const point = planetPointAt(entity.x, terrainHeightAt(entity.x, entity.z, state.seed) + 1, entity.z);
  group.position.set(point.x, point.y, point.z);
  group.quaternion.copy(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0));
  scene.add(group);
  return group;
}

function updateAvatars(current, target, isBot = false) {
  const ids = new Set(current.map((item) => item.id));
  const avatars = isBot ? botAvatars : remotePlayers;
  for (const [id, avatar] of avatars) {
    if (!ids.has(id)) {
      scene.remove(avatar);
      avatars.delete(id);
    }
  }

  for (const entity of current) {
    if (entity.id === state.id) continue;
    let avatar = avatars.get(entity.id);
    if (!avatar) {
      avatar = makeAvatar(entity, isBot);
      avatars.set(entity.id, avatar);
    }
    avatar.children[2].visible = true;
    const surfaceHeight = terrainHeightAt(entity.x, entity.z, state.seed) + 1;
    const point = planetPointAt(entity.x, surfaceHeight, entity.z);
    const target = new THREE.Vector3(point.x, point.y, point.z);
    avatar.position.lerp(target, 0.32);
    avatar.position.setLength(PLANET_RADIUS + surfaceHeight);
    avatar.quaternion.copy(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0));
  }
  target.clear();
  for (const entity of current) target.set(entity.id, entity);
}

function renderDroppedItems(drops) {
  const ids = new Set(drops.map((drop) => drop.id));
  for (const [id, mesh] of droppedItemMeshes) {
    if (!ids.has(id)) {
      scene.remove(mesh);
      droppedItemMeshes.delete(id);
    }
  }

  for (const drop of drops) {
    let mesh = droppedItemMeshes.get(drop.id);
    if (!mesh) {
      const material = materials.get(drop.item);
      if (!material) continue;
      mesh = new THREE.Mesh(cubeGeometry, material);
      mesh.scale.setScalar(0.32);
      mesh.userData.item = drop.item;
      scene.add(mesh);
      droppedItemMeshes.set(drop.id, mesh);
    }
    mesh.userData.baseY = terrainHeightAt(drop.x, drop.z, state.seed) + 0.65;
    const point = planetPointAt(drop.x, mesh.userData.baseY, drop.z);
    mesh.position.set(point.x, point.y, point.z);
    mesh.userData.basePosition = mesh.position.clone();
    mesh.quaternion.copy(surfaceQuaternionAt(drop.x, drop.z));
    mesh.userData.count = drop.count;
  }
}

function applySnapshot(message) {
  const playerList = message.players ?? [];
  const botList = message.bots ?? [];
  state.roomPlayers = playerList;
  const self = playerList.find((player) => player.id === state.id);
  if (self) updateHealth(self.health);
  updateAvatars(playerList, players);
  updateAvatars(botList, bots, true);
  renderDroppedItems(message.drops ?? []);
  renderWorldMapMarkers(playerList);
}

function updateHealth(health) {
  state.health = Math.max(0, Math.min(100, health ?? state.health));
  healthProgress.value = state.health;
  healthValue.textContent = String(state.health);
  respawnButton.hidden = state.health > 0;
}

function updateXp(xp, level) {
  state.xp = Number.isFinite(Number(xp)) ? Number(xp) : state.xp;
  state.level = Number.isFinite(Number(level)) ? Number(level) : state.level;
  xpHud.textContent = `XP ${state.xp} · Lv ${state.level}`;
}

function updateCoins(coins) {
  state.coins = Number.isFinite(Number(coins)) ? Number(coins) : state.coins;
  coinHud.textContent = `Coins ${state.coins}`;
}

function drawWorldMap() {
  if (state.mapSeed === state.seed) return;
  state.mapSeed = state.seed;
  const context = worldMapCanvas.getContext("2d");
  const columns = 80;
  const rows = 40;
  worldMapCanvas.width = columns * 4;
  worldMapCanvas.height = rows * 4;
  const cellWidth = worldMapCanvas.width / columns;
  const cellHeight = worldMapCanvas.height / rows;
  let row = 0;
  const drawRows = () => {
    const endRow = Math.min(row + 3, rows);
    for (; row < endRow; row += 1) {
      const z = PLANET_MAX_Z - (row + 0.5) / rows * PLANET_LATITUDE_BLOCKS;
      for (let column = 0; column < columns; column += 1) {
        const x = PLANET_MIN_X + (column + 0.5) / columns * PLANET_LONGITUDE_BLOCKS;
        const distance = Math.hypot(x, z);
        const height = terrainHeightAt(x, z, state.seed);
        let color;
        if (distance <= CITY_RADIUS) {
          color = Math.abs(Math.floor(x / 16) + Math.floor(z / 16)) % 2 ? "#68716a" : "#8a9188";
        } else if (distance <= CITY_BEACH_OUTER_RADIUS) {
          color = "#d2c38b";
        } else if (distance <= HARBOR_WATER_OUTER_RADIUS) {
          color = "#286a75";
        } else if (height >= 20) {
          color = "#92988a";
        } else if (distance < 228) {
          color = height < 4 ? "#64865b" : "#3d714e";
        } else {
          color = height < 5 ? "#8a9b62" : "#61794f";
        }
        context.fillStyle = color;
        context.fillRect(column * cellWidth, row * cellHeight, cellWidth + 1, cellHeight + 1);
      }
    }
    if (row < rows) requestAnimationFrame(drawRows);
  };
  requestAnimationFrame(drawRows);
}

function renderWorldMapMarkers(playerList = state.roomPlayers ?? []) {
  const currentTarget = teleportTarget.value;
  teleportTarget.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a player or location";
  teleportTarget.append(placeholder);
  worldMapMarkers.replaceChildren();

  for (const player of playerList) {
    const isSelf = player.id === state.id;
    if (!isSelf) {
      const option = document.createElement("option");
      option.value = player.id;
      option.textContent = player.name;
      teleportTarget.append(option);
    }
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `map-marker${isSelf ? " self" : ""}`;
    marker.style.left = `${(wrapPlanetX(player.x) - PLANET_MIN_X) / PLANET_LONGITUDE_BLOCKS * 100}%`;
    marker.style.top = `${(PLANET_MAX_Z - player.z) / PLANET_LATITUDE_BLOCKS * 100}%`;
    marker.title = isSelf ? `${player.name} (you)` : player.name;
    marker.setAttribute("aria-label", isSelf ? `${player.name}, your location` : `${player.name}, tap to show name`);
    marker.setAttribute("aria-pressed", "false");
    const dot = document.createElement("span");
    dot.className = "map-marker-dot";
    const label = document.createElement("span");
    label.className = "map-marker-name";
    label.textContent = isSelf ? `${player.name} (you)` : player.name;
    marker.append(dot, label);
    marker.addEventListener("click", () => {
      for (const otherMarker of worldMapMarkers.querySelectorAll(".map-marker")) {
        otherMarker.setAttribute("aria-pressed", String(otherMarker === marker && marker.getAttribute("aria-pressed") !== "true"));
      }
      if (!isSelf) teleportTarget.value = player.id;
      teleportButton.disabled = !teleportTarget.value;
    });
    worldMapMarkers.append(marker);
  }

  for (const location of WORLD_LOCATIONS) {
    const option = document.createElement("option");
    option.value = `location:${location.id}`;
    option.textContent = location.name;
    teleportTarget.append(option);

    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "map-marker location-marker";
    const visualOffset = location.id === "beach" ? -1.6 : location.id === "harbor" ? 1.6 : 0;
    marker.style.left = `${(wrapPlanetX(location.x) - PLANET_MIN_X) / PLANET_LONGITUDE_BLOCKS * 100 + visualOffset}%`;
    marker.style.top = `${(PLANET_MAX_Z - location.z) / PLANET_LATITUDE_BLOCKS * 100}%`;
    marker.title = `${location.name} (teleport point)`;
    marker.setAttribute("aria-label", `${location.name}, teleport point`);
    marker.setAttribute("aria-pressed", "false");
    const dot = document.createElement("span");
    dot.className = "map-marker-dot";
    const label = document.createElement("span");
    label.className = "map-marker-name";
    label.textContent = location.name;
    marker.append(dot, label);
    marker.addEventListener("click", () => {
      for (const otherMarker of worldMapMarkers.querySelectorAll(".map-marker")) {
        otherMarker.setAttribute("aria-pressed", String(otherMarker === marker));
      }
      teleportTarget.value = `location:${location.id}`;
      teleportButton.disabled = false;
    });
    worldMapMarkers.append(marker);
  }

  teleportTarget.value = [...teleportTarget.options].some((option) => option.value === currentTarget)
    ? currentTarget
    : "";
  teleportButton.disabled = !teleportTarget.value;
}

function setLobbyStatus(label, online = false) {
  lobbyStatus.innerHTML = `<i></i>${label}`;
  lobbyStatus.classList.toggle("online", online);
}

function showLobbyNotice(message, inRoom = false) {
  (inRoom ? roomNotice : lobbyNotice).textContent = message;
}

function renderRoomList(container, rooms, emptyMessage) {
  container.replaceChildren();
  if (!rooms.length) {
    const empty = document.createElement("p");
    empty.className = "lobby-empty";
    empty.textContent = emptyMessage;
    container.append(empty);
    return;
  }

  for (const room of rooms) {
    const row = document.createElement("div");
    row.className = "lobby-room";
    const description = document.createElement("div");
    const name = document.createElement("div");
    name.className = "lobby-room-name";
    name.textContent = room.name;
    const meta = document.createElement("div");
    meta.className = "lobby-room-meta";
    meta.textContent = `${room.mode === "design" ? "Design" : "Survival"} · ${room.saved ? "Saved" : `${room.players}/${room.maxPlayers} players · ${room.started ? "In progress" : "Waiting"}`}`;
    description.append(name, meta);
    const join = document.createElement("button");
    join.type = "button";
    join.className = "room-join-button";
    join.dataset.roomId = room.id;
    join.textContent = room.saved ? "Resume" : "Join";
    row.append(description, join);
    container.append(row);
  }
}

function renderLobbyRooms(rooms) {
  renderRoomList(lobbyRoomList, rooms.filter((room) => !room.saved), "No open worlds yet. Create one to get started.");
  renderRoomList(savedGameList, rooms.filter((room) => room.saved), "No saved games on this server yet.");
}

function renderRoomState(message) {
  lobbyRoom = message;
  roomTitle.textContent = message.room.name;
  roomStateLabel.textContent = message.room.started ? "WORLD IN PROGRESS" : "ROOM LOBBY";
  roomMemberList.replaceChildren();
  for (const member of message.members) {
    const row = document.createElement("div");
    row.className = "room-member";
    const name = document.createElement("span");
    name.className = "room-member-name";
    name.textContent = member.name;
    const role = document.createElement("span");
    role.className = "room-member-role";
    role.textContent = member.id === message.hostId ? "HOST" : "PLAYER";
    row.append(name, role);
    roomMemberList.append(row);
  }
  startRoomButton.hidden = message.hostId !== state.id;
  startRoomButton.disabled = message.room.started;
  startRoomButton.textContent = message.room.started ? "World started" : "Start world";
  if (!state.connected) {
    lobbyHome.hidden = true;
    lobbyWaiting.hidden = false;
  }
}

function sendLobbyMessage(message) {
  if (state.socket?.readyState !== WebSocket.OPEN) {
    showLobbyNotice("Waiting for the multiplayer server.", Boolean(lobbyRoom));
    return false;
  }
  state.socket.send(JSON.stringify(message));
  return true;
}

function updatePlayerName() {
  const name = lobbyPlayerNameInput.value.trim().slice(0, 16);
  if (!name) {
    showLobbyNotice("Enter a player name first.", Boolean(lobbyRoom));
    return false;
  }
  playerNameInput.value = name;
  localStorage.setItem("player-name", name);
  return sendLobbyMessage({ type: "name", name });
}

function showLobbyHome() {
  state.connected = false;
  moveKeys.clear();
  lobbyRoom = null;
  multiplayerMenu.hidden = false;
  lobbyHome.hidden = false;
  lobbyWaiting.hidden = true;
  gameMenu.hidden = true;
  worldMapPanel.hidden = true;
  gameMenuToggle.setAttribute("aria-expanded", "false");
  gameMenuStatus.textContent = "";
  showLobbyNotice("");
}

function connect() {
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${scheme}//${location.host}/ws`);
  state.socket = socket;
  socket.addEventListener("open", () => {
    state.connected = false;
    statusText.textContent = "Lobby";
    statusDot.classList.add("online");
    setLobbyStatus("Online", true);
    socket.send(JSON.stringify({ type: "name", name: lobbyPlayerNameInput.value.trim() || "Explorer" }));
    socket.send(JSON.stringify({ type: "list_rooms" }));
  });
  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      notify("Received an unreadable server update.");
      return;
    }
    if (message.type === "lobby") {
      state.id = message.playerId;
      renderLobbyRooms(message.rooms ?? []);
      setLobbyStatus("Online", true);
    } else if (message.type === "room_list") {
      renderLobbyRooms(message.rooms ?? []);
    } else if (message.type === "room_created" || message.type === "room_joined") {
      localStorage.setItem(activeRoomStorageKey, message.room.id);
      resumeRequested = false;
      lobbyRoom = { room: message.room, hostId: message.hostId, members: [] };
      lobbyHome.hidden = true;
      lobbyWaiting.hidden = false;
      showLobbyNotice(message.type === "room_created" ? "World created. Friends can join from the lobby." : "Joined. Waiting for room details.", true);
    } else if (message.type === "room_state") {
      renderRoomState(message);
    } else if (message.type === "room_left") {
      localStorage.removeItem(activeRoomStorageKey);
      resumeRequested = false;
      showLobbyHome();
    } else if (message.type === "name_result") {
      playerNameInput.value = message.name;
      lobbyPlayerNameInput.value = message.name;
      localStorage.setItem("player-name", message.name);
      const activeRoomId = localStorage.getItem(activeRoomStorageKey);
      if (activeRoomId && !resumeRequested && !state.connected && !lobbyRoom) {
        resumeRequested = true;
        sendLobbyMessage({ type: "join_room", roomId: activeRoomId });
      }
    } else if (message.type === "save_result") {
      gameMenuStatus.textContent = message.message;
    } else if (message.type === "fish_result") {
      if (message.caught) {
        triggerFishingCast(message.item);
      }
      notify(message.message);
    } else if (message.type === "attack_result") {
      if (message.hit) notify(`Hit for ${message.damage} damage.`);
      else if (message.message) notify(message.message);
    } else if (message.type === "respawn_result") {
      playerPosition.x = message.position.x;
      playerPosition.z = message.position.z;
      playerPosition.y = terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 1.65;
      look.yaw = message.position.yaw;
      state.jumpVelocity = 0;
      updateHealth(message.health);
      updateChunkWindow(true);
      renderWorld();
      notify("You are back in the world.");
    } else if (message.type === "teleport_result") {
      playerPosition.x = message.position.x;
      playerPosition.z = message.position.z;
      playerPosition.y = terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 1.65;
      look.yaw = message.position.yaw;
      state.jumpVelocity = 0;
      updateChunkWindow(true);
      renderWorld();
      gameMenu.hidden = true;
      worldMapPanel.hidden = true;
      gameMenuToggle.setAttribute("aria-expanded", "false");
      gameMenuStatus.textContent = "";
      notify("Teleported to player.");
    } else if (message.type === "init") {
      state.connected = true;
      multiplayerMenu.hidden = true;
      statusText.textContent = "Connected";
      state.id = message.id;
      state.seed = message.seed;
      state.mode = message.mode === "design" ? "design" : "survival";
      if (message.position) {
        playerPosition.x = message.position.x;
        playerPosition.z = message.position.z;
        look.yaw = message.position.yaw;
      }
      updateHealth(message.health);
      updateXp(message.xp ?? state.xp, message.level ?? state.level);
      updateCoins(message.coins ?? state.coins);
      hotbarItems.splice(0, HOTBAR_SIZE, ...(state.mode === "design"
        ? blockChoices.slice(0, HOTBAR_SIZE).map(([id]) => id)
        : Array(HOTBAR_SIZE).fill(null)));
      updateHotbar();
      selectBlock(state.mode === "design" ? hotbarItems[0] : null);
      worldBlocks.clear();
      loadedChunks.clear();
      renderCandidatesByChunk.clear();
      lastChunkX = null;
      lastChunkZ = null;
      updateInventory(message.inventory ?? []);
      updateChunkWindow(true);
      renderWorld();
      applySnapshot(message);
      notify("Welcome! Your shared world is ready.");
    } else if (message.type === "snapshot") {
      applySnapshot(message);
    } else if (message.type === "chunk") {
      const key = chunkKey(message.x, message.z);
      if (!loadedChunks.has(key)) return;
      for (const [[x, y, z], type] of message.blockChanges) {
        const block = blockKey(x, y, z);
        if (type === null) worldBlocks.delete(block);
        else worldBlocks.set(block, type);
        addRenderCandidatesAround(x, y, z);
      }
      scheduleWorldRender();
    } else if (message.type === "inventory") {
      updateInventory(message.items);
    } else if (message.type === "currency") {
      updateCoins(message.coins);
    } else if (message.type === "xp") {
      updateXp(message.xp, message.level);
      notify(`Crafting XP +2. Total XP: ${message.xp} · Level: ${message.level}`);
    } else if (message.type === "sell_result") {
      updateCoins(message.coins);
      notify(message.message);
    } else if (message.type === "block") {
      const { x, y, z } = message.position;
      const key = blockKey(x, y, z);
      if (loadedChunks.has(chunkKey(Math.floor(wrapPlanetX(x) / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)))) {
        if (message.action === "remove") worldBlocks.delete(key);
        else worldBlocks.set(key, message.block);
        addRenderCandidatesAround(x, y, z);
        renderWorld();
      }
    } else if (message.type === "error") {
      if (resumeRequested) {
        localStorage.removeItem(activeRoomStorageKey);
        resumeRequested = false;
        showLobbyHome();
      }
      showLobbyNotice(message.message, Boolean(lobbyRoom));
      notify(message.message);
    }
  });
  socket.addEventListener("close", () => {
    showLobbyHome();
    setLobbyStatus("Reconnecting");
    statusText.textContent = "Reconnecting…";
    statusDot.classList.remove("online");
    window.setTimeout(connect, 1500);
  });
  socket.addEventListener("error", () => {
    statusText.textContent = "Connection issue";
    statusDot.classList.remove("online");
  });
}
connect();

playerNameInput.addEventListener("change", () => {
  lobbyPlayerNameInput.value = playerNameInput.value;
  updatePlayerName();
});

lobbyPlayerNameInput.addEventListener("change", updatePlayerName);
document.querySelector("#create-room-button").addEventListener("click", () => {
  if (updatePlayerName()) {
    sendLobbyMessage({
      type: "create_room",
      roomName: document.querySelector("#room-name-input").value,
      mode: document.querySelector("#world-mode").value,
    });
  }
});
lobbyRoomList.addEventListener("click", (event) => {
  const joinButton = event.target.closest("button[data-room-id]");
  if (joinButton && updatePlayerName()) {
    sendLobbyMessage({ type: "join_room", roomId: joinButton.dataset.roomId });
  }
});
savedGameList.addEventListener("click", (event) => {
  const resumeButton = event.target.closest("button[data-room-id]");
  if (resumeButton && updatePlayerName()) {
    sendLobbyMessage({ type: "join_room", roomId: resumeButton.dataset.roomId });
  }
});
savedGamesToggle.addEventListener("click", () => {
  savedGameList.hidden = !savedGameList.hidden;
  savedGamesToggle.setAttribute("aria-expanded", String(!savedGameList.hidden));
  savedGamesToggle.textContent = savedGameList.hidden ? "Show" : "Hide";
});
document.querySelector("#refresh-rooms-button").addEventListener("click", () => sendLobbyMessage({ type: "list_rooms" }));
document.querySelector("#leave-room-button").addEventListener("click", () => sendLobbyMessage({ type: "leave_room" }));
startRoomButton.addEventListener("click", () => sendLobbyMessage({ type: "start_room" }));
gameMenuToggle.addEventListener("click", () => {
  gameMenu.hidden = !gameMenu.hidden;
  gameMenuToggle.setAttribute("aria-expanded", String(!gameMenu.hidden));
});
document.querySelector("#save-world-button").addEventListener("click", () => {
  gameMenuStatus.textContent = "Saving…";
  sendLobbyMessage({ type: "save_room" });
});
document.querySelector("#logout-button").addEventListener("click", () => {
  sendLobbyMessage({ type: "leave_room" });
});
document.querySelector("#open-world-map-button").addEventListener("click", () => {
  drawWorldMap();
  renderWorldMapMarkers();
  worldMapPanel.hidden = false;
  gameMenu.hidden = true;
  gameMenuToggle.setAttribute("aria-expanded", "false");
});
document.querySelector("#close-world-map-button").addEventListener("click", () => {
  worldMapPanel.hidden = true;
});
teleportTarget.addEventListener("change", () => {
  teleportButton.disabled = !teleportTarget.value;
});
teleportButton.addEventListener("click", () => {
  if (teleportTarget.value.startsWith("location:")) {
    sendLobbyMessage({ type: "teleport", locationId: teleportTarget.value.slice("location:".length) });
  } else if (teleportTarget.value) {
    sendLobbyMessage({ type: "teleport", targetId: teleportTarget.value });
  }
});

function selectBlock(id) {
  state.selected = id;
  for (const button of hotbar.querySelectorAll("button")) {
    button.classList.toggle("selected", button.dataset.block === id);
  }
}

function updateInventory(items) {
  const previousInventory = state.inventory;
  state.inventory = new Map(items);
  for (const [item, count] of state.inventory) {
    if (count <= (previousInventory.get(item) ?? 0) || hotbarItems.includes(item)) continue;
    const emptySlot = hotbarItems.indexOf(null);
    if (emptySlot < 0) break;
    hotbarItems[emptySlot] = item;
  }
  updateHotbar();
  if (!state.selected) {
    selectBlock(hotbarItems.find((item) => item) ?? null);
  }
  renderInventory();
}

function renderInventory() {
  inventoryList.replaceChildren();
  if (state.inventory.size === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "inventory-empty";
    emptyMessage.textContent = "No items yet. Mine a block to collect it.";
    inventoryList.append(emptyMessage);
  }

  for (const [id, count] of state.inventory) {
    const item = document.createElement("div");
    item.className = "inventory-item";
    const supportsTouch = window.matchMedia("(pointer: coarse)").matches;
    item.draggable = !supportsTouch;
    item.classList.toggle("hotbar-armed", state.pendingHotbarItem === id);
    if (!supportsTouch) {
      item.addEventListener("dragstart", (event) => {
        if (!event.dataTransfer) return;
        event.dataTransfer.setData("text/plain", id);
        event.dataTransfer.effectAllowed = "copy";
        state.pendingHotbarItem = id;
      });
      item.addEventListener("dragend", () => {
        state.pendingHotbarItem = null;
        for (const choice of inventoryList.querySelectorAll(".inventory-item")) {
          choice.classList.remove("hotbar-armed");
        }
      });
    }
    item.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      state.pendingHotbarItem = id;
      for (const choice of inventoryList.querySelectorAll(".inventory-item")) {
        choice.classList.toggle("hotbar-armed", choice === item);
      }
      notify(`Tap a hotbar slot to assign ${blockNames.get(id) ?? id}.`);
    });
    const swatch = document.createElement("span");
    swatch.className = "inventory-swatch";
    swatch.style.backgroundImage = id === "campfire"
      ? "linear-gradient(135deg, #ffd56a, #ed7338 55%, #604230 56%)"
      : `url("${blockChoices.find(([block]) => block === id)?.[2] ?? ""}")`;
    const itemName = document.createElement("span");
    itemName.className = "inventory-item-name";
    itemName.textContent = blockNames.get(id) ?? id;
    const amount = document.createElement("span");
    amount.className = "inventory-amount";
    amount.textContent = `×${count}`;
    const dropButton = document.createElement("button");
    dropButton.className = "drop-item";
    dropButton.type = "button";
    dropButton.draggable = false;
    dropButton.textContent = "Drop 1";
    dropButton.setAttribute("aria-label", `Drop one ${blockNames.get(id) ?? id}`);
    dropButton.addEventListener("click", () => sendInventoryAction({ type: "drop", item: id, count: 1 }));
    if (FISH_TYPE_BY_ID.has(id)) {
      const sellButton = document.createElement("button");
      sellButton.className = "drop-item";
      sellButton.type = "button";
      sellButton.draggable = false;
      sellButton.textContent = "Sell 1";
      sellButton.setAttribute("aria-label", `Sell one ${blockNames.get(id) ?? id}`);
      sellButton.addEventListener("click", () => sendInventoryAction({ type: "sell", item: id, count: 1 }));
      item.append(sellButton);
    }
    const dragHandle = document.createElement("button");
    dragHandle.className = "inventory-drag-handle";
    dragHandle.type = "button";
    dragHandle.textContent = "↗";
    dragHandle.setAttribute("aria-label", `Drag ${blockNames.get(id) ?? id} to a hotbar slot`);
    dragHandle.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      event.preventDefault();
      dragHandle.setPointerCapture(event.pointerId);
      beginTouchHotbarDrag(id, event.pointerId, event.clientX, event.clientY);
    });
    dragHandle.addEventListener("pointermove", (event) => {
      if (state.touchHotbarDrag?.pointerId !== event.pointerId) return;
      moveTouchHotbarDrag(event.clientX, event.clientY);
    });
    dragHandle.addEventListener("pointerup", (event) => {
      if (state.touchHotbarDrag?.pointerId !== event.pointerId) return;
      finishTouchHotbarDrag(event.clientX, event.clientY);
    });
    dragHandle.addEventListener("pointercancel", (event) => {
      if (state.touchHotbarDrag?.pointerId === event.pointerId) cancelTouchHotbarDrag();
    });
    item.append(swatch, itemName, amount, dragHandle, dropButton);
    inventoryList.append(item);
  }

  recipeList.replaceChildren();
  for (const recipe of RECIPES) {
    const recipeButton = document.createElement("button");
    recipeButton.className = "recipe-button";
    recipeButton.type = "button";
    recipeButton.disabled = !canCraft(state.inventory, recipe);
    const title = document.createElement("strong");
    title.textContent = recipe.label;
    const ingredients = document.createElement("span");
    ingredients.textContent = Object.entries(recipe.ingredients)
      .map(([item, amount]) => `${amount} ${blockNames.get(item) ?? item}`)
      .join(" + ");
    recipeButton.append(title, ingredients);
    recipeButton.addEventListener("click", () => {
      sendInventoryAction({ type: "craft", recipe: recipe.id });
    });
    recipeList.append(recipeButton);
  }
}

function sendInventoryAction(message) {
  if (state.socket?.readyState !== WebSocket.OPEN) {
    notify("Waiting for the world connection.");
    return;
  }
  state.socket.send(JSON.stringify(message));
}

function beginTouchHotbarDrag(item, pointerId, x, y) {
  const ghost = document.createElement("div");
  ghost.className = "hotbar-drag-ghost";
  ghost.textContent = blockNames.get(item) ?? item;
  document.body.append(ghost);
  state.touchHotbarDrag = { item, ghost, pointerId };
  moveTouchHotbarDrag(x, y);
}

function moveTouchHotbarDrag(x, y) {
  const drag = state.touchHotbarDrag;
  if (!drag) return;
  drag.ghost.style.left = `${x}px`;
  drag.ghost.style.top = `${y}px`;
  for (const slot of hotbar.querySelectorAll(".block-choice")) {
    const bounds = slot.getBoundingClientRect();
    const overSlot = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    slot.classList.toggle("drag-over", overSlot);
  }
}

function finishTouchHotbarDrag(x, y) {
  const drag = state.touchHotbarDrag;
  if (!drag) return;
  const target = document.elementFromPoint(x, y)?.closest(".block-choice");
  cancelTouchHotbarDrag();
  if (target) {
    const index = [...hotbar.querySelectorAll(".block-choice")].indexOf(target);
    if (index >= 0) assignHotbarSlot(index, drag.item);
  }
}

function cancelTouchHotbarDrag() {
  state.touchHotbarDrag?.ghost.remove();
  state.touchHotbarDrag = null;
  for (const slot of hotbar.querySelectorAll(".block-choice")) {
    slot.classList.remove("drag-over");
  }
}

function toggleInventory(open = inventoryPanel.hidden) {
  inventoryPanel.hidden = !open;
  document.querySelector("#inventory-toggle").setAttribute("aria-expanded", String(open));
  if (open) renderInventory();
}

document.querySelector("#inventory-toggle").addEventListener("click", () => toggleInventory());
document.querySelector("#close-inventory").addEventListener("click", () => toggleInventory(false));

function updateHotbar() {
  for (const [index, button] of [...hotbar.querySelectorAll(".block-choice")].entries()) {
    const id = hotbarItems[index];
    const choice = blockChoiceById.get(id);
    const [, name, textureUrl] = choice ?? [];
    button.dataset.block = id ?? "";
    button.setAttribute("aria-label", id ? `${name} block, shortcut ${index + 1}` : `Empty slot ${index + 1}`);
    button.querySelector(".block-swatch").style.backgroundImage = textureUrl
      ? `url("${textureUrl}")`
      : id === "campfire" ? "linear-gradient(135deg, #ffd56a, #ed7338 55%, #604230 56%)" : "none";
    button.querySelector(".block-label").textContent = name ?? "";
    const count = id ? state.inventory.get(id) ?? 0 : 0;
    const counter = button.querySelector(".block-count");
    counter.textContent = String(count);
    counter.hidden = count === 0;
    button.classList.toggle("selected", state.selected === id);
    button.classList.remove("drag-over");
    button.ondragover = (event) => {
      event.preventDefault();
      button.classList.add("drag-over");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    button.ondragleave = () => button.classList.remove("drag-over");
    button.ondrop = (event) => {
      event.preventDefault();
      const item = event.dataTransfer?.getData("text/plain") || state.pendingHotbarItem;
      state.pendingHotbarItem = null;
      button.classList.remove("drag-over");
      if (item) assignHotbarSlot(index, item);
    };
  }
}

function assignHotbarSlot(index, item) {
  if (!blockChoiceById.has(item)) return;
  const existingIndex = hotbarItems.indexOf(item);
  if (existingIndex >= 0 && existingIndex !== index) {
    hotbarItems[existingIndex] = hotbarItems[index];
  }
  hotbarItems[index] = item;
  state.pendingHotbarItem = null;
  updateHotbar();
  selectBlock(item);
  notify(`${blockNames.get(item)} assigned to slot ${index + 1}.`);
  if (!inventoryPanel.hidden) renderInventory();
}

function handleHotbarSlot(index) {
  if (state.pendingHotbarItem) {
    assignHotbarSlot(index, state.pendingHotbarItem);
    return;
  }
  if (hotbarItems[index]) selectBlock(hotbarItems[index]);
}

for (let index = 0; index < HOTBAR_SIZE; index += 1) {
  const button = document.createElement("button");
  button.className = "block-choice";
  button.type = "button";
  button.dataset.block = "";
  button.setAttribute("aria-label", `Empty slot ${index + 1}`);
  button.innerHTML = `<span class="block-swatch"></span><span class="block-label"></span><span class="block-count" hidden></span><kbd>${index + 1}</kbd>`;
  button.addEventListener("click", () => handleHotbarSlot(index));
  hotbar.append(button);
}
updateHotbar();
selectBlock(null);

function targetBlock() {
  raycaster.setFromCamera(center, camera);
  const hits = raycaster.intersectObjects(blockMeshes, false);
  const hit = hits.find((candidate) => candidate.instanceId !== undefined && candidate.distance < 6);
  if (!hit) return null;
  const coords = hit.object.userData.coordinates[hit.instanceId];
  return { coords, normal: hit.face.normal.clone() };
}

function findCombatTarget() {
  const latitude = (playerPosition.z - PLANET_MIN_Z + 0.5) / PLANET_LATITUDE_BLOCKS * Math.PI - Math.PI / 2;
  const forwardEast = -Math.sin(look.yaw);
  const forwardNorth = Math.cos(look.yaw);
  let closest = null;
  let closestDistance = 3.5;
  for (const player of state.roomPlayers ?? []) {
    if (player.id === state.id || player.health <= 0) continue;
    const east = wrapPlanetX(player.x - playerPosition.x) * Math.cos(latitude);
    const north = player.z - playerPosition.z;
    const distance = Math.hypot(east, north);
    if (distance >= closestDistance) continue;
    const facing = (east * forwardEast + north * forwardNorth) / Math.max(distance, 0.001);
    if (facing < 0.2) continue;
    closest = player;
    closestDistance = distance;
  }
  return closest;
}

function attackPlayer() {
  if (!state.connected || state.health <= 0) return;
  const target = findCombatTarget();
  if (!target) {
    notify("No player in reach. Face a nearby player to punch.");
    return;
  }
  state.socket.send(JSON.stringify({ type: "attack", targetId: target.id }));
}

function fishAtHarbor() {
  if (!state.connected || state.health <= 0) return;
  if ((state.inventory.get("fishing_rod") ?? 0) < 1) {
    notify("You need a fishing rod to fish.");
    return;
  }
  if (!isNearHarbor(playerPosition.x, playerPosition.z)) {
    notify("Walk to the harbor pier to fish.");
    return;
  }
  sendLobbyMessage({ type: "fish" });
}

function triggerFishingCast(itemId) {
  if (state.fishingCast) {
    scene.remove(state.fishingCast.mesh);
    state.fishingCast = null;
  }
  const fish = FISH_TYPE_BY_ID.get(itemId) ?? FISH_TYPE_BY_ID.get("raw_fish");
  const bobber = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 12),
    new THREE.MeshBasicMaterial({
      color: fish.rarity === "rare" ? "#ffd166" : fish.rarity === "epic" ? "#f7617b" : "#8dd3ff",
      transparent: true,
      opacity: 0.95,
    }),
  );
  const origin = new THREE.Vector3(0, 1.7, 0);
  const direction = new THREE.Vector3(-Math.sin(look.yaw), 0.28, -Math.cos(look.yaw)).normalize();
  const end = origin.clone().add(direction.multiplyScalar(2.6));
  bobber.position.copy(origin);
  scene.add(bobber);
  state.fishingCast = { mesh: bobber, origin, end, age: 0 };
}

function sendEdit(action) {
  if (state.socket?.readyState !== WebSocket.OPEN) {
    notify("Waiting for the world connection.");
    return;
  }
  const target = targetBlock();
  if (!target) {
    notify("Look at a block within reach.");
    return;
  }
  const [x, y, z] = target.coords;
  if (action === "place" && !state.selected) {
    notify("Choose a block from your inventory first.");
    return;
  }
  if (action === "place" && state.mode !== "design" && (state.inventory.get(state.selected) ?? 0) < 1) {
    notify(`No ${blockNames.get(state.selected)} in your inventory.`);
    return;
  }
  const normal = target.normal;
  const position = action === "remove"
    ? { x, y, z }
    : {
        x: wrapPlanetX(x + Math.round(normal.x)),
        y: y + Math.round(normal.y),
        z: z - Math.round(normal.z),
      };
  state.socket.send(
    JSON.stringify({
      type: "edit",
      action,
      position,
      block: state.selected,
    }),
  );
}

document.querySelector("#break-button").addEventListener("click", () => sendEdit("remove"));
document.querySelector("#place-button").addEventListener("click", () => sendEdit("place"));
attackButton.addEventListener("click", attackPlayer);
fishButton.addEventListener("click", fishAtHarbor);
document.querySelector("#fish-menu-button").addEventListener("click", fishAtHarbor);
respawnButton.addEventListener("click", () => sendLobbyMessage({ type: "respawn" }));
document.querySelector("#jump-button").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  jump();
});
document.querySelector("#close-help").addEventListener("click", () => {
  document.querySelector("#help-card").hidden = true;
});
document.querySelector("#help-toggle").addEventListener("click", () => {
  document.querySelector("#help-card").hidden = false;
});

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.code === "Escape" && !inventoryPanel.hidden) {
    toggleInventory(false);
    return;
  }
  if (event.code === "KeyI") {
    toggleInventory();
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat) jump();
    return;
  }
  if (event.code === "KeyF") {
    attackPlayer();
    return;
  }
  if (event.code === "KeyR") {
    fishAtHarbor();
    return;
  }
  moveKeys.add(event.code);
  if (/^Digit[1-6]$/.test(event.code)) {
    selectBlock(hotbarItems[Number(event.code.at(-1)) - 1]);
  }
  if (event.code === "KeyE") sendEdit("place");
  if (event.code === "KeyQ") sendEdit("remove");
});
window.addEventListener("keyup", (event) => moveKeys.delete(event.code));
window.addEventListener("blur", () => moveKeys.clear());
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

let pointerId = null;
let pointerStart = null;
let pointerMoved = false;
canvas.addEventListener("pointerdown", (event) => {
  if (event.ctrlKey || (event.button !== 0 && event.button !== 2)) return;
  pointerId = event.pointerId;
  pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
  pointerMoved = false;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (pointerId !== event.pointerId || !pointerStart) return;
  if (event.ctrlKey) {
    pointerStart.x = event.clientX;
    pointerStart.y = event.clientY;
    pointerMoved = true;
    return;
  }
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) pointerMoved = true;
  if (pointerMoved) {
    look.yaw -= dx * 0.004;
    look.pitch = THREE.MathUtils.clamp(look.pitch - dy * 0.004, -1.35, 1.35);
    pointerStart.x = event.clientX;
    pointerStart.y = event.clientY;
  }
});
canvas.addEventListener("pointerup", (event) => {
  if (pointerId !== event.pointerId || !pointerStart) return;
  if (!event.ctrlKey && !pointerMoved) sendEdit(pointerStart.button === 2 ? "place" : "remove");
  pointerId = null;
  pointerStart = null;
});
canvas.addEventListener("pointercancel", () => {
  pointerId = null;
  pointerStart = null;
});

let joystickPointer = null;
function updateJoystick(event) {
  const bounds = joystick.getBoundingClientRect();
  const radius = bounds.width * 0.31;
  const dx = event.clientX - (bounds.left + bounds.width / 2);
  const dy = event.clientY - (bounds.top + bounds.height / 2);
  const length = Math.hypot(dx, dy);
  const scale = length > radius ? radius / length : 1;
  const x = dx * scale;
  const y = dy * scale;
  joystickVector.set(x / radius, -y / radius);
  joystickKnob.style.transform = `translate(${x}px, ${y}px)`;
}
joystick.addEventListener("pointerdown", (event) => {
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  updateJoystick(event);
});
joystick.addEventListener("pointermove", (event) => {
  if (joystickPointer === event.pointerId) updateJoystick(event);
});
function resetJoystick(event) {
  if (joystickPointer !== event.pointerId) return;
  joystickPointer = null;
  joystickVector.set(0, 0);
  joystickKnob.style.transform = "translate(0, 0)";
}
joystick.addEventListener("pointerup", resetJoystick);
joystick.addEventListener("pointercancel", resetJoystick);

function groundEyeAt(x, z, referenceEyeY) {
  const blockX = Math.round(x);
  const blockZ = Math.round(z);
  const firstBlockY = Math.floor(referenceEyeY - 0.15);
  for (let y = firstBlockY; y >= BEDROCK_Y; y -= 1) {
    if (worldBlocks.has(blockKey(blockX, y, blockZ))) return y + 1.65;
  }
  return BEDROCK_Y + 1.65;
}

function hasWallAt(x, z, eyeY) {
  const blockX = Math.round(x);
  const blockZ = Math.round(z);
  const firstBlockY = Math.floor(eyeY - 0.15);
  return (
    worldBlocks.has(blockKey(blockX, firstBlockY, blockZ)) ||
    worldBlocks.has(blockKey(blockX, firstBlockY + 1, blockZ))
  );
}

function jump() {
  const groundY = groundEyeAt(playerPosition.x, playerPosition.z, playerPosition.y);
  if (playerPosition.y <= groundY + 0.02) {
    playerPosition.y = groundY;
    state.jumpVelocity = 7.5;
  }
}

function updateMovement(delta) {
  if (!state.connected || !gameMenu.hidden || !worldMapPanel.hidden) return;
  let forwardInput = (moveKeys.has("KeyW") || moveKeys.has("ArrowUp") ? 1 : 0)
    - (moveKeys.has("KeyS") || moveKeys.has("ArrowDown") ? 1 : 0);
  let strafeInput = (moveKeys.has("KeyD") || moveKeys.has("ArrowRight") ? 1 : 0)
    - (moveKeys.has("KeyA") || moveKeys.has("ArrowLeft") ? 1 : 0);
  forwardInput += joystickVector.y;
  strafeInput += joystickVector.x;
  const magnitude = Math.hypot(forwardInput, strafeInput);
  if (magnitude > 1) {
    forwardInput /= magnitude;
    strafeInput /= magnitude;
  }

  const speed = 4.2 * delta;
  const eastDistance = (-Math.sin(look.yaw) * forwardInput + Math.cos(look.yaw) * strafeInput) * speed;
  const northDistance = (Math.cos(look.yaw) * forwardInput + Math.sin(look.yaw) * strafeInput) * speed;
  const nextPosition = advancePlanetPosition(
    playerPosition.x,
    playerPosition.z,
    eastDistance,
    northDistance,
    look.yaw,
  );
  const nextX = nextPosition.x;
  const nextZ = nextPosition.z;
  const currentGround = groundEyeAt(playerPosition.x, playerPosition.z, playerPosition.y);
  const grounded = state.jumpVelocity <= 0 && playerPosition.y <= currentGround + 0.04;
  if (nextPosition.yaw !== look.yaw) {
    const nextGround = groundEyeAt(nextX, nextZ, playerPosition.y);
    if (
      !hasWallAt(nextX, nextZ, grounded ? nextGround : playerPosition.y) &&
      (!grounded || nextGround <= currentGround + 1.05)
    ) {
      playerPosition.x = nextX;
      playerPosition.z = nextZ;
      look.yaw = nextPosition.yaw;
      if (grounded && nextGround > currentGround) playerPosition.y = nextGround;
    }
  } else {
    const nextXGround = groundEyeAt(nextX, playerPosition.z, playerPosition.y);
    if (
      !hasWallAt(nextX, playerPosition.z, grounded ? nextXGround : playerPosition.y) &&
      (!grounded || nextXGround <= currentGround + 1.05)
    ) {
      playerPosition.x = nextX;
      if (grounded && nextXGround > currentGround) playerPosition.y = nextXGround;
    }
    const nextZGround = groundEyeAt(playerPosition.x, nextZ, playerPosition.y);
    const nowGround = groundEyeAt(playerPosition.x, playerPosition.z, playerPosition.y);
    if (
      !hasWallAt(playerPosition.x, nextZ, grounded ? nextZGround : playerPosition.y) &&
      (!grounded || nextZGround <= nowGround + 1.05)
    ) {
      playerPosition.z = nextZ;
      if (grounded && nextZGround > nowGround) playerPosition.y = nextZGround;
    }
  }

  const groundY = groundEyeAt(playerPosition.x, playerPosition.z, playerPosition.y);
  if (playerPosition.y > groundY || state.jumpVelocity > 0) {
    playerPosition.y += state.jumpVelocity * delta;
    state.jumpVelocity -= 22 * delta;
    if (playerPosition.y <= groundY) {
      playerPosition.y = groundY;
      state.jumpVelocity = 0;
    }
  } else {
    playerPosition.y = groundY;
    state.jumpVelocity = 0;
  }
  updateCamera();
  if (updateChunkWindow()) renderWorld();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  updateMovement(delta);
  const now = performance.now();
  if (state.connected && now - state.lastSentAt > 70) {
    state.socket.send(
      JSON.stringify({
        type: "move",
        position: { x: playerPosition.x, z: playerPosition.z, yaw: look.yaw },
      }),
    );
    state.lastSentAt = now;
  }
  if (state.connected && now - state.lastPickupAt > 600) {
    state.socket.send(JSON.stringify({ type: "pickup" }));
    state.lastPickupAt = now;
  }
  for (const mesh of droppedItemMeshes.values()) {
    const basePosition = mesh.userData.basePosition;
    const bob = Math.sin(now * 0.003 + mesh.position.x) * 0.08;
    mesh.position.copy(basePosition).addScaledVector(basePosition.clone().normalize(), bob);
    mesh.rotateY(delta * 1.8);
  }
  if (state.fishingCast) {
    const cast = state.fishingCast;
    cast.age += delta;
    const t = Math.min(cast.age * 1.7, 1);
    const current = cast.origin.clone().lerp(cast.end, t);
    current.y += Math.sin(t * Math.PI) * 0.7;
    cast.mesh.position.copy(current);
    cast.mesh.scale.setScalar(1 + Math.sin(cast.age * 12) * 0.18);
    if (cast.age >= 1.2) {
      scene.remove(cast.mesh);
      state.fishingCast = null;
    }
  }
  renderer.render(scene, camera);
}
animate();

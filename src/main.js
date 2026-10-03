import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
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
import {
  MODEL_CATALOG,
  MODEL_CATEGORIES_LIST,
  MODEL_ITEM_BY_ID,
} from "../shared/models.js";
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
import alpacaModelUrl from "./assets/animals/Alpaca.gltf?url";
import cowModelUrl from "./assets/animals/Cow.gltf?url";
import foxModelUrl from "./assets/animals/Fox.gltf?url";
import wolfModelUrl from "./assets/animals/Wolf.gltf?url";
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
const shopPanel = document.querySelector("#shop-panel");
const shopItems = document.querySelector("#shop-items");
const shopCategory = document.querySelector("#shop-category");
const shopSearch = document.querySelector("#shop-search");
const shopNotice = document.querySelector("#shop-notice");
const shopCoins = document.querySelector("#shop-coins");
const thirdPersonToggle = document.querySelector("#third-person-toggle");
const autosaveToggle = document.querySelector("#autosave-toggle");
const profileDialog = document.querySelector("#profile-dialog");
const profileNameInput = document.querySelector("#profile-name");
const profileColorInput = document.querySelector("#profile-color");
const profileStatus = document.querySelector("#profile-status");
const worldMapPanel = document.querySelector("#world-map-panel");
const worldMapCanvas = document.querySelector("#world-map-canvas");
const worldMapMarkers = document.querySelector("#world-map-markers");
const teleportTarget = document.querySelector("#teleport-target");
const teleportButton = document.querySelector("#teleport-button");
const mapTargetOptions = new Map();
const mapMarkerElements = new Map();
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
const waterControls = document.querySelector("#water-controls");
const waterRiseButton = document.querySelector("#water-rise-button");
const waterDiveButton = document.querySelector("#water-dive-button");
const savedPlayerName = localStorage.getItem("player-name");

function createBrowserProfileId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") globalThis.crypto.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let playerProfileId = localStorage.getItem("player-profile-id");
if (!playerProfileId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerProfileId)) {
  playerProfileId = createBrowserProfileId();
  localStorage.setItem("player-profile-id", playerProfileId);
}
let thirdPersonView = localStorage.getItem("camera-view-mode") === "third-person";
thirdPersonToggle.checked = thirdPersonView;
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
function itemName(id) {
  return blockNames.get(id) ?? MODEL_ITEM_BY_ID.get(id)?.name ?? id ?? "";
}
const HOTBAR_SIZE = 6;
const hotbarItems = Array(HOTBAR_SIZE).fill(null);
const textureLoader = new THREE.TextureLoader();
const materials = new Map();
const modelPlacementMeshes = [];
const modelTargetMeshes = [];

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
let rendererAvailable = true;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
} catch (error) {
  rendererAvailable = false;
  console.error("WebGL is unavailable; the multiplayer lobby will run without 3D rendering.", error);
  const context = canvas.getContext("2d");
  renderer = {
    shadowMap: { enabled: false },
    setSize(width, height) {
      canvas.width = width;
      canvas.height = height;
      if (!context) return;
      context.fillStyle = "#a9d8ed";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "rgba(21, 33, 29, 0.78)";
      context.fillRect(width / 2 - 160, height / 2 - 22, 320, 44);
      context.fillStyle = "#ffffff";
      context.font = "14px sans-serif";
      context.textAlign = "center";
      context.fillText("Enable WebGL to render the 3D world", width / 2, height / 2 + 5);
    },
    render() {},
  };
}
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight("#e6f5ff", "#566147", 2.1));
const sunlight = new THREE.DirectionalLight("#fff1ce", 2.2);
sunlight.position.set(-10, 18, 9);
scene.add(sunlight);
const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(3.2, 16, 12),
  new THREE.MeshBasicMaterial({ color: "#ffd475" }),
);
scene.add(sunMesh);
const cloudMaterial = new THREE.MeshBasicMaterial({
  color: "#f7fbf2",
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
});
const cloudGeometry = new THREE.SphereGeometry(2.4, 10, 8);
const skyClouds = Array.from({ length: 7 }, (_, index) => {
  const group = new THREE.Group();
  for (const [offsetX, offsetY, scaleX, scaleY, scaleZ] of [
    [-2.4, 0, 1.25, 0.52, 0.68],
    [0, 0.55, 1.35, 0.68, 0.72],
    [2.6, 0.05, 1.2, 0.5, 0.64],
  ]) {
    const puff = new THREE.Mesh(cloudGeometry, cloudMaterial);
    puff.position.set(offsetX, offsetY, 0);
    puff.scale.set(scaleX, scaleY, scaleZ);
    group.add(puff);
  }
  scene.add(group);
  return {
    group,
    east: (index % 3 - 1) * 34,
    north: Math.floor(index / 3) * 36 - 34,
    height: 18 + index % 3 * 4,
    phase: index * 1.7,
  };
});

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const blockMeshes = [];
const remotePlayers = new Map();
const botAvatars = new Map();
const monsterAvatars = new Map();
const animalAvatars = new Map();
const animalModels = new Map();
const animalModelLoads = new Map();
let animalModelRefreshPending = false;
const animalModelLoader = new GLTFLoader();
const animalModelUrls = new Map([
  ["alpaca", alpacaModelUrl],
  ["cow", cowModelUrl],
  ["fox", foxModelUrl],
  ["wolf", wolfModelUrl],
]);
const droppedItemMeshes = new Map();
const marinePlantMeshes = [];
const ambientFish = [];
const players = new Map();
const bots = new Map();
const monsters = new Map();
let selfAvatar = null;
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
  swimDirection: 0,
  isSwimming: false,
  inventory: new Map(),
  roomAnimals: [],
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

function loadAnimalModels(animals) {
  const pending = [];
  for (const modelType of new Set(animals.map((animal) => animal.model))) {
    const url = animalModelUrls.get(modelType);
    if (!url || animalModels.has(modelType)) continue;
    let loading = animalModelLoads.get(modelType);
    if (!loading) {
      loading = animalModelLoader.loadAsync(url)
        .then((model) => animalModels.set(modelType, model))
        .catch((error) => {
          console.error(`Unable to load the ${modelType} animal model.`, error);
          if (state.connected) notify(`The ${modelType} model couldn't load.`);
        });
      animalModelLoads.set(modelType, loading);
    }
    pending.push(loading);
  }
  if (pending.length && !animalModelRefreshPending) {
    animalModelRefreshPending = true;
    void Promise.all(pending).then(() => {
      animalModelRefreshPending = false;
      refreshAnimalModels();
    });
  }
}

function updateCamera() {
  const frame = planetFrameAt(playerPosition.x, playerPosition.z);
  const point = planetPointAt(playerPosition.x, playerPosition.y, playerPosition.z);
  const up = new THREE.Vector3(frame.up.x, frame.up.y, frame.up.z);
  const east = new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z);
  const north = new THREE.Vector3(frame.north.x, frame.north.y, frame.north.z);
  const forward = north.multiplyScalar(Math.cos(look.yaw)).addScaledVector(east, -Math.sin(look.yaw));
  forward.multiplyScalar(Math.cos(look.pitch)).addScaledVector(up, Math.sin(look.pitch));
  camera.up.copy(up);
  if (thirdPersonView) {
    const target = planetPointAt(playerPosition.x, playerPosition.y + 0.2, playerPosition.z);
    camera.position.set(target.x, target.y, target.z).addScaledVector(forward, -4.5).addScaledVector(up, 1.7);
    camera.lookAt(target.x, target.y, target.z);
  } else {
    camera.position.set(point.x, point.y, point.z);
    camera.lookAt(camera.position.clone().add(forward));
  }
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

function updateSkyObjects(now) {
  const frame = planetFrameAt(playerPosition.x, playerPosition.z);
  const east = new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z);
  const north = new THREE.Vector3(frame.north.x, frame.north.y, frame.north.z);
  const sunPosition = planetPointAt(playerPosition.x, playerPosition.y + 43, playerPosition.z);
  sunMesh.position.copy(sunPosition).addScaledVector(north, 34);
  sunlight.position.copy(sunMesh.position);
  const orientation = surfaceQuaternionAt(playerPosition.x, playerPosition.z);
  for (const cloud of skyClouds) {
    const cloudPosition = planetPointAt(playerPosition.x, playerPosition.y + cloud.height, playerPosition.z);
    const drift = Math.sin(now * 0.00008 + cloud.phase) * 5;
    cloud.group.position.copy(cloudPosition)
      .addScaledVector(east, cloud.east + drift)
      .addScaledVector(north, cloud.north);
    cloud.group.quaternion.copy(orientation);
  }
}

function createUnderwaterLife(seed) {
  for (const group of marinePlantMeshes) scene.remove(group);
  marinePlantMeshes.length = 0;
  for (const fish of ambientFish) scene.remove(fish.group);
  ambientFish.length = 0;

  let randomState = Number(seed) >>> 0 || 1;
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 0x1_0000_0000;
  };
  const leafGeometry = new THREE.PlaneGeometry(0.16, 1, 1, 3);
  const leafMaterials = ["#2e8b62", "#43a871", "#287552"].map((color) => new THREE.MeshLambertMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
  }));

  for (let x = -190; x <= 190; x += 6) {
    for (let z = -190; z <= 190; z += 6) {
      const radius = Math.hypot(x, z);
      if (radius < 145 || radius > 188 || random() > 0.2) continue;
      const seabed = terrainHeightAt(x, z, seed);
      const availableHeight = -seabed - 1.05;
      if (availableHeight < 1.2) continue;
      const height = Math.min(availableHeight, 1.2 + random() * 2.8);
      const plant = new THREE.Group();
      for (let bladeIndex = 0; bladeIndex < 3; bladeIndex += 1) {
        const blade = new THREE.Mesh(leafGeometry, leafMaterials[Math.floor(random() * leafMaterials.length)]);
        blade.position.set((bladeIndex - 1) * 0.13, height / 2, 0);
        blade.scale.y = height * (0.72 + random() * 0.28);
        blade.rotation.y = bladeIndex * Math.PI / 3;
        blade.rotation.z = (random() - 0.5) * 0.28;
        plant.add(blade);
      }
      const point = planetPointAt(x, seabed + 0.55, z);
      plant.position.set(point.x, point.y, point.z);
      plant.quaternion.copy(surfaceQuaternionAt(x, z));
      scene.add(plant);
      marinePlantMeshes.push(plant);
    }
  }

  const fishColors = ["#efa44f", "#5ec9d1", "#e9d169", "#de7fa5"];
  for (let index = 0; index < 32; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 146 + random() * 39;
    const x = Math.round(Math.cos(angle) * radius);
    const z = Math.round(Math.sin(angle) * radius);
    const seabed = terrainHeightAt(x, z, seed);
    const fish = new THREE.Group();
    const color = fishColors[Math.floor(random() * fishColors.length)];
    const material = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 7), material);
    body.scale.set(0.78, 0.34, 0.38);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 3), material);
    tail.position.x = -0.34;
    tail.rotation.z = Math.PI / 2;
    fish.add(body, tail);
    scene.add(fish);
    ambientFish.push({
      group: fish,
      anchorX: x,
      anchorZ: z,
      depth: seabed + 1.3 + random() * Math.max(0.2, -seabed - 2.3),
      yaw: angle + Math.PI / 2,
      phase: random() * Math.PI * 2,
    });
  }
}

function updateUnderwaterLife(now) {
  for (const fish of ambientFish) {
    const swim = Math.sin(now * 0.00075 + fish.phase) * 1.5;
    const x = fish.anchorX + Math.cos(fish.yaw) * swim;
    const z = fish.anchorZ + Math.sin(fish.yaw) * swim;
    const point = planetPointAt(x, fish.depth + Math.sin(now * 0.0013 + fish.phase) * 0.12, z);
    fish.group.position.set(point.x, point.y, point.z);
    fish.group.quaternion.copy(surfaceQuaternionAt(x, z, fish.yaw));
  }
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

function createPlacedModel(model, x, y, z) {
  const group = new THREE.Group();
  const color = new THREE.Color(model.color);
  color.offsetHSL(((model.variant * 0.61803398875) % 1 - 0.5) * 0.22, 0.08, ((model.variant % 7) - 3) * 0.012);
  const primary = new THREE.MeshLambertMaterial({ color });
  const wood = new THREE.MeshLambertMaterial({ color: "#765034" });
  const accent = new THREE.MeshLambertMaterial({ color: "#e1c980", emissive: model.category === "crystal" || model.category === "dragon" ? color : "#000000", emissiveIntensity: 0.25 });
  const dark = new THREE.MeshLambertMaterial({ color: "#30343a" });
  const add = (geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.userData.blockCoordinates = [x, y, z];
    group.add(mesh);
    modelTargetMeshes.push(mesh);
    return mesh;
  };
  const box = (material, position, scale, rotation) =>
    add(new THREE.BoxGeometry(1, 1, 1), material, position, scale, rotation);
  const sphere = (material, position, scale) =>
    add(new THREE.SphereGeometry(0.5, 9, 7), material, position, scale);
  const rod = (material, position, length, radius = 0.055, rotation = [0, 0, 0]) =>
    add(new THREE.CylinderGeometry(radius * 0.8, radius, length, 7), material, position, [1, 1, 1], rotation);
  const cone = (material, position, height, radius, rotation = [0, 0, 0]) =>
    add(new THREE.ConeGeometry(radius, height, 7), material, position, [1, 1, 1], rotation);
  const form = model.variant % 5;

  if (model.category === "furniture") {
    if (form === 0) {
      box(primary, [0, 0.72, 0], [0.8, 0.13, 0.72]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(wood, [sx * 0.31, 0.35, sz * 0.27], [0.1, 0.66, 0.1]);
    } else if (form === 1) {
      box(primary, [0, 0.48, 0], [0.78, 0.16, 0.75]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(wood, [sx * 0.31, 0.23, sz * 0.28], [0.1, 0.43, 0.1]);
    } else if (form === 2) {
      box(wood, [0, 0.51, 0], [0.72, 0.72, 0.28]);
      for (let shelf = 0; shelf < 3; shelf += 1) box(primary, [0, 0.25 + shelf * 0.24, -0.02], [0.7, 0.06, 0.34]);
    } else if (form === 3) {
      box(wood, [0, 0.33, 0], [0.78, 0.34, 0.9]);
      box(primary, [0, 0.55, 0], [0.85, 0.12, 0.96]);
      box(accent, [0, 0.65, 0], [0.79, 0.08, 0.22]);
    } else {
      box(primary, [0, 0.44, 0], [0.8, 0.12, 0.7]);
      for (const sx of [-1, 1]) box(wood, [sx * 0.32, 0.22, 0.25], [0.1, 0.43, 0.1]);
      box(wood, [0, 0.7, 0.32], [0.78, 0.52, 0.1]);
    }
  } else if (model.category === "plant") {
    rod(wood, [0, 0.33, 0], 0.66, 0.07);
    const leafCount = 3 + model.variant % 5;
    for (let leaf = 0; leaf < leafCount; leaf += 1) {
      const angle = leaf / leafCount * Math.PI * 2;
      sphere(primary, [Math.cos(angle) * 0.23, 0.58 + (leaf % 3) * 0.12, Math.sin(angle) * 0.23], [0.32, 0.2, 0.32]);
    }
    box(wood, [0, 0.07, 0], [0.45, 0.14, 0.45]);
  } else if (model.category === "animal" || model.category === "monster") {
    sphere(primary, [0, 0.44, 0], model.category === "animal" ? [0.72, 0.44, 0.46] : [0.64, 0.68, 0.58]);
    sphere(accent, [0, 0.64, -0.26], [0.32, 0.33, 0.3]);
    for (const side of [-1, 1]) {
      sphere(dark, [side * 0.1, 0.68, -0.4], [0.07, 0.09, 0.06]);
      if (model.category === "monster") cone(primary, [side * 0.2, 0.92, -0.15], 0.32, 0.13);
      else rod(dark, [side * 0.2, 0.19, 0.08], 0.36, 0.045);
    }
    if (model.category === "monster") {
      for (let spike = 0; spike < 3; spike += 1) cone(primary, [(spike - 1) * 0.19, 0.83, 0.13], 0.27, 0.1);
    }
  } else if (model.category === "dragon") {
    sphere(primary, [0, 0.48, 0.06], [0.6, 0.43, 0.76]);
    sphere(primary, [0, 0.68, -0.39], [0.32, 0.3, 0.35]);
    cone(accent, [0, 0.69, -0.65], 0.32, 0.13, [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1]) {
      const wing = box(primary, [0.44, 0.045, 0.37], [side * 0.42, 0.73, 0.06], [0, 0, side * -0.28]);
      wing.material = primary;
      cone(accent, [side * 0.18, 0.94, -0.42], 0.24, 0.09);
    }
    cone(primary, [0, 0.33, 0.57], 0.55, 0.15, [Math.PI / 2, 0, 0]);
  } else if (model.category === "armor") {
    box(primary, [0, 0.49, 0], [0.58, 0.62, 0.34]);
    sphere(accent, [0, 0.94, 0], [0.42, 0.38, 0.4]);
    box(dark, [0, 0.9, -0.2], [0.26, 0.1, 0.05]);
    box(wood, [0, 0.08, 0], [0.5, 0.14, 0.5]);
  } else if (model.category === "weapon" || model.category === "tool") {
    rod(wood, [0, 0.45, 0], 0.76, 0.07, [0, 0, 0.18]);
    if (model.category === "weapon" && form === 3) {
      add(new THREE.TorusGeometry(0.3, 0.035, 6, 10), primary, [0, 0.86, 0], [1, 1.15, 1]);
    } else if (model.category === "weapon" && form === 1) {
      box(primary, [0, 0.81, 0], [0.52, 0.13, 0.14], [0, 0, 0.35]);
      cone(primary, [0, 1.02, 0], 0.36, 0.22);
    } else {
      box(primary, [0, 0.88, 0], model.category === "weapon" ? [0.15, 0.5, 0.08] : [0.5, 0.18, 0.16], [0, 0, 0.16]);
    }
  } else if (model.category === "crystal") {
    cone(primary, [0, 0.45, 0], 0.86, 0.31);
    cone(accent, [0.13, 0.38, 0.06], 0.57, 0.18, [0, 0, 0.28]);
    box(wood, [0, 0.06, 0], [0.5, 0.12, 0.5]);
  } else {
    box(wood, [0, 0.12, 0], [0.64, 0.24, 0.64]);
    box(primary, [0, 0.48, 0], [0.48, 0.48, 0.34]);
    sphere(accent, [0, 0.86, 0], [0.42, 0.4, 0.4]);
  }

  const frame = planetFrameAt(x, z);
  const point = planetPointAt(x, y, z);
  const orientation = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z),
    new THREE.Vector3(frame.up.x, frame.up.y, frame.up.z),
    new THREE.Vector3(-frame.north.x, -frame.north.y, -frame.north.z),
  );
  group.position.set(point.x, point.y, point.z);
  group.quaternion.setFromRotationMatrix(orientation);
  const blockRadius = PLANET_RADIUS + y + 1;
  group.scale.set(
    Math.max(0.05, 2 * Math.cos(frame.latitude) * blockRadius * Math.tan(Math.PI / PLANET_LONGITUDE_BLOCKS)),
    1,
    2 * blockRadius * Math.tan(Math.PI / (2 * PLANET_LATITUDE_BLOCKS)),
  );
  scene.add(group);
  modelPlacementMeshes.push(group);
  return group;
}

function renderWorld() {
  for (const mesh of blockMeshes) {
    scene.remove(mesh);
  }
  blockMeshes.length = 0;
  for (const model of modelPlacementMeshes) {
    scene.remove(model);
    model.traverse((part) => {
      part.geometry?.dispose();
      if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose());
      else part.material?.dispose();
    });
  }
  modelPlacementMeshes.length = 0;
  modelTargetMeshes.length = 0;

  const grouped = new Map();
  const placedModels = [];
  const playerChunkX = Math.floor(wrapPlanetX(playerPosition.x) / CHUNK_SIZE);
  const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
  for (const [chunkKey, candidates] of renderCandidatesByChunk) {
    const [chunkX, chunkZ] = chunkKey.split(",").map(Number);
    const chunkDeltaX = Math.abs(chunkX - playerChunkX);
    const wrappedDeltaX = Math.min(chunkDeltaX, MAX_PLANET_CHUNK_X - MIN_PLANET_CHUNK_X + 1 - chunkDeltaX);
    const isDistant = Math.max(wrappedDeltaX, Math.abs(chunkZ - playerChunkZ)) > 1;
    for (const key of candidates) {
      const type = worldBlocks.get(key);
      const model = MODEL_ITEM_BY_ID.get(type);
      if (!model && !materials.has(type)) continue;
      const [x, y, z] = key.split(",").map(Number);
      if (y === BEDROCK_Y) continue;
      if (model) {
        placedModels.push([model, x, y, z]);
        continue;
      }
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
  for (const [model, x, y, z] of placedModels) createPlacedModel(model, x, y, z);
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

function avatarHealthBar(health) {
  const barCanvas = document.createElement("canvas");
  barCanvas.width = 128;
  barCanvas.height = 18;
  const context = barCanvas.getContext("2d");
  const texture = new THREE.CanvasTexture(barCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(0.9, 0.14, 1);
  sprite.position.y = 2.02;
  sprite.userData.context = context;
  sprite.userData.texture = texture;
  sprite.userData.health = null;
  updateAvatarHealth(sprite, health);
  return sprite;
}

function updateAvatarHealth(sprite, health) {
  if (health === null || health === undefined || !Number.isFinite(Number(health))) {
    sprite.visible = false;
    sprite.userData.health = null;
    return;
  }
  sprite.visible = true;
  const value = Math.max(0, Math.min(100, Number(health) || 0));
  if (sprite.userData.health === value) return;
  const context = sprite.userData.context;
  context.clearRect(0, 0, 128, 18);
  context.fillStyle = "rgba(14, 24, 20, 0.88)";
  context.roundRect(1, 1, 126, 16, 5);
  context.fill();
  if (value > 0) {
    context.fillStyle = value > 50 ? "#8ee071" : value > 25 ? "#f1c65b" : "#ef6b5c";
    context.roundRect(4, 4, 120 * value / 100, 10, 3);
    context.fill();
  }
  sprite.userData.health = value;
  sprite.userData.texture.needsUpdate = true;
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
  const healthBar = avatarHealthBar(entity.health);
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
    healthBar,
  );
  group.userData.healthBar = healthBar;
  const point = planetPointAt(entity.x, terrainHeightAt(entity.x, entity.z, state.seed) + 1, entity.z);
  group.position.set(point.x, point.y, point.z);
  group.quaternion.copy(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0));
  scene.add(group);
  return group;
}

function makeMonster(entity) {
  const group = new THREE.Group();
  const material = (color, options = {}) => new THREE.MeshLambertMaterial({ color, ...options });
  const shellMaterial = material(entity.color ?? "#e58154");
  const darkMaterial = material("#382c32");
  const eyeMaterial = material("#fff4d6", { emissive: "#d18d48", emissiveIntensity: 0.35 });
  const glowMaterial = material(entity.color ?? "#79c66f", { emissive: entity.color ?? "#79c66f", emissiveIntensity: 0.35 });
  const addPart = (geometry, partMaterial, position, scale) => {
    const part = new THREE.Mesh(geometry, partMaterial);
    part.position.set(...position);
    part.scale.set(...scale);
    group.add(part);
    return part;
  };

  if (entity.species === "crab") {
    addPart(new THREE.SphereGeometry(0.55, 12, 8), shellMaterial, [0, 0.48, 0], [1.25, 0.78, 1]);
    addPart(new THREE.SphereGeometry(0.39, 10, 7), darkMaterial, [0, 0.67, 0.04], [1.2, 0.8, 0.9]);
    for (const side of [-1, 1]) {
      addPart(new THREE.SphereGeometry(0.09, 8, 6), eyeMaterial, [side * 0.22, 0.88, -0.37], [1, 1, 0.65]);
      const leg = addPart(new THREE.CylinderGeometry(0.045, 0.065, 0.62, 6), darkMaterial, [side * 0.52, 0.28, -0.23], [1, 1, 1]);
      leg.rotation.z = side * 0.95;
      const rearLeg = addPart(new THREE.CylinderGeometry(0.04, 0.055, 0.55, 6), darkMaterial, [side * 0.55, 0.25, 0.22], [1, 1, 1]);
      rearLeg.rotation.z = side * 1.05;
      addPart(new THREE.SphereGeometry(0.2, 8, 6), shellMaterial, [side * 0.77, 0.47, -0.22], [0.8, 1, 0.85]);
      addPart(new THREE.ConeGeometry(0.16, 0.35, 5), shellMaterial, [side * 0.84, 0.7, -0.33], [1, 1, 1]);
    }
  } else if (entity.species === "slime") {
    addPart(new THREE.SphereGeometry(0.58, 14, 10), glowMaterial, [0, 0.58, 0], [1.05, 0.82, 0.9]);
    for (const side of [-1, 1]) {
      addPart(new THREE.SphereGeometry(0.075, 8, 6), darkMaterial, [side * 0.19, 0.67, -0.48], [1, 1.1, 0.7]);
    }
    addPart(new THREE.BoxGeometry(0.2, 0.055, 0.035), darkMaterial, [0, 0.46, -0.52], [1, 1, 1]);
    addPart(new THREE.SphereGeometry(0.16, 8, 6), shellMaterial, [0, 1.03, 0.05], [1.3, 0.5, 1]);
  } else {
    addPart(new THREE.SphereGeometry(0.48, 12, 9), glowMaterial, [0, 0.87, 0], [0.85, 1.15, 0.85]);
    const wispTail = addPart(new THREE.ConeGeometry(0.42, 0.85, 8), glowMaterial, [0, 0.35, 0.08], [1, 1, 1]);
    wispTail.rotation.x = Math.PI;
    addPart(new THREE.TorusGeometry(0.58, 0.035, 6, 18), eyeMaterial, [0, 0.7, 0], [1, 1, 0.65]).rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      addPart(new THREE.SphereGeometry(0.08, 8, 6), eyeMaterial, [side * 0.17, 0.92, -0.38], [1, 1, 0.7]);
    }
  }

  const labelColor = entity.species === "crab" ? "#ffd18b" : entity.species === "slime" ? "#caff9c" : "#a5f7ff";
  group.add(avatarLabel(entity.name, labelColor));
  const healthBar = avatarHealthBar(entity.health);
  group.add(healthBar);
  group.userData.healthBar = healthBar;
  const point = planetPointAt(entity.x, terrainHeightAt(entity.x, entity.z, state.seed) + 1, entity.z);
  group.position.set(point.x, point.y, point.z);
  group.quaternion.copy(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0));
  scene.add(group);
  return group;
}

function updateAvatars(
  current,
  target,
  isBot = false,
  avatarMeshes = isBot ? botAvatars : remotePlayers,
  createAvatar = (entity) => makeAvatar(entity, isBot),
) {
  const ids = new Set(current.map((item) => item.id));
  for (const [id, avatar] of avatarMeshes) {
    if (!ids.has(id)) {
      scene.remove(avatar);
      avatarMeshes.delete(id);
    }
  }

  for (const entity of current) {
    if (entity.id === state.id && !isBot) {
      if (!selfAvatar) selfAvatar = makeAvatar(entity);
      selfAvatar.visible = thirdPersonView && state.connected;
      updateAvatarHealth(selfAvatar.userData.healthBar, entity.health);
      continue;
    }
    let avatar = avatarMeshes.get(entity.id);
    if (!avatar) {
      avatar = createAvatar(entity);
      avatarMeshes.set(entity.id, avatar);
    }
    if (!avatar.userData.healthBar) avatar.children[2].visible = true;
    if (entity.color) avatar.children[0].material.color.set(entity.color);
    updateAvatarHealth(avatar.userData.healthBar, entity.health);
    const surfaceHeight = entity.y === undefined
      ? terrainHeightAt(entity.x, entity.z, state.seed) + 1
      : entity.y - 0.65;
    const point = planetPointAt(entity.x, surfaceHeight, entity.z);
    const target = new THREE.Vector3(point.x, point.y, point.z);
    avatar.position.lerp(target, 0.32);
    avatar.position.setLength(PLANET_RADIUS + surfaceHeight);
    avatar.quaternion.copy(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0));
  }
  target.clear();
  for (const entity of current) target.set(entity.id, entity);
}

function makeAnimal(entity) {
  const modelAsset = animalModels.get(entity.model);
  if (modelAsset) return makeAnimatedAnimal(entity, modelAsset);
  if (entity.model === "fish") return makeFish(entity);
  const palettes = {
    cow: { body: "#f0eee5", head: "#f0eee5", face: "#d89582", legs: "#51473f", patch: "#413b38", scale: 1 },
    alpaca: { body: "#eee9da", head: "#eee9da", face: "#d89582", legs: "#62584d", patch: "#d6d0c1", scale: 1 },
    fox: { body: "#d77c4b", head: "#d77c4b", face: "#eee9da", legs: "#51473f", patch: "#eee9da", scale: 1 },
    wolf: { body: "#8a8d8e", head: "#a6a6a1", face: "#d6d0c1", legs: "#514d49", patch: "#d6d0c1", scale: 1 },
  };
  const palette = palettes[entity.model] ?? palettes.cow;
  const group = new THREE.Group();
  group.scale.setScalar(entity.scale ?? palette.scale);
  const material = (color) => new THREE.MeshLambertMaterial({ color });
  const bodyMaterial = material(palette.body);
  const headMaterial = material(palette.head);
  const faceMaterial = material(palette.face);
  const legMaterial = material(palette.legs);
  const accentMaterial = material(palette.patch);
  const eyeMaterial = material("#282521");
  const hornMaterial = material("#e9dfc8");
  const addBox = (parent, size, position, partMaterial) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), partMaterial);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };
  const bodySize = entity.species === "chicken" ? [0.58, 0.52, 0.68] : [0.9, 0.66, 0.62];
  const bodyY = entity.species === "chicken" ? 0.55 : 0.72;
  const body = addBox(group, bodySize, [0, bodyY, 0], bodyMaterial);
  const head = new THREE.Group();
  head.position.set(0, entity.species === "chicken" ? 0.82 : 0.9, entity.species === "chicken" ? -0.3 : -0.48);
  group.add(head);
  const headSize = entity.species === "chicken" ? [0.32, 0.32, 0.3] : [0.4, 0.42, 0.38];
  addBox(head, headSize, [0, 0, -0.06], headMaterial);
  addBox(head, entity.species === "chicken" ? [0.2, 0.12, 0.18] : [0.26, 0.18, 0.18], [0, -0.1, -0.26], faceMaterial);
  for (const side of [-1, 1]) addBox(head, [0.055, 0.06, 0.025], [side * 0.13, 0.08, -0.25], eyeMaterial);
  if (entity.species === "cow") {
    for (const side of [-1, 1]) {
      addBox(head, [0.1, 0.2, 0.1], [side * 0.16, 0.27, -0.04], accentMaterial);
      addBox(head, [0.08, 0.18, 0.08], [side * 0.16, 0.43, -0.04], hornMaterial);
    }
    addBox(group, [0.24, 0.22, 0.025], [-0.2, 0.77, -0.315], accentMaterial);
    addBox(group, [0.2, 0.2, 0.025], [0.22, 0.68, -0.315], accentMaterial);
  } else if (entity.species === "pig") {
    for (const side of [-1, 1]) addBox(head, [0.13, 0.22, 0.12], [side * 0.19, 0.26, -0.03], headMaterial);
  } else if (entity.species === "sheep") {
    for (const side of [-1, 1]) addBox(head, [0.16, 0.1, 0.12], [side * 0.27, -0.01, -0.02], accentMaterial);
    for (const [x, y, z] of [[-0.28, 0.73, 0], [0.28, 0.73, 0], [0, 1.03, 0], [0, 0.73, 0.25]]) {
      addBox(group, [0.3, 0.3, 0.3], [x, y, z], bodyMaterial);
    }
  } else if (entity.species === "chicken") {
    addBox(head, [0.11, 0.13, 0.08], [0, 0.21, -0.02], accentMaterial);
  }

  const legs = [];
  const legHeight = entity.species === "chicken" ? 0.29 : 0.48;
  const legWidth = entity.species === "chicken" ? 0.09 : 0.17;
  const legTop = entity.species === "chicken" ? 0.36 : 0.49;
  for (const x of [-0.27, 0.27]) {
    for (const z of [-0.2, 0.2]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, legTop, z);
      addBox(pivot, [legWidth, legHeight, legWidth], [0, -legHeight / 2, 0], legMaterial);
      group.add(pivot);
      legs.push(pivot);
    }
  }
  const tail = new THREE.Group();
  tail.position.set(0, bodyY + 0.05, 0.32);
  addBox(tail, [0.11, 0.28, 0.11], [0, 0.13, 0.08], accentMaterial);
  group.add(tail);
  group.userData.legs = legs;
  group.userData.tail = tail;
  group.userData.body = body;
  group.userData.gait = Math.random() * Math.PI * 2;
  group.userData.walking = Boolean(entity.walking);
  group.userData.species = entity.species;
  const ground = terrainHeightAt(entity.x, entity.z, state.seed);
  const surfaceHeight = (entity.y ?? ground + 0.08) + (entity.aquatic ? 0 : 0.92);
  const point = planetPointAt(entity.x, surfaceHeight, entity.z);
  group.position.set(point.x, point.y, point.z);
  group.quaternion.copy(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0));
  group.userData.color = entity.color;
  group.userData.pattern = entity.pattern;
  group.userData.species = entity.species;
  group.add(avatarLabel(entity.name, "#fff1c6"));
  scene.add(group);
  return group;
}

function makeAnimatedAnimal(entity, modelAsset) {
  const group = new THREE.Group();
  const model = cloneSkeleton(modelAsset.scene);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const height = entity.species === "cow" || entity.species === "alpaca" ? 1.45 : 1.05;
  const scale = height / size.y;
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  if (entity.color) {
    const tint = new THREE.Color(entity.color);
    model.traverse((part) => {
      if (!part.isMesh) return;
      const applyTint = (source) => {
        const material = source.clone();
        if (!/(eye|black|hoof|nose)/i.test(material.name)) {
          material.color.lerp(tint, 0.35 + (entity.pattern ?? 0) * 0.06);
        }
        return material;
      };
      part.material = Array.isArray(part.material)
        ? part.material.map(applyTint)
        : applyTint(part.material);
    });
  }
  group.add(model);
  group.add(avatarLabel(entity.name, "#fff1c6"));

  const mixer = new THREE.AnimationMixer(model);
  const idleClip = modelAsset.animations.find((clip) => clip.name.toLowerCase() === "idle");
  const walkClip = modelAsset.animations.find((clip) => clip.name.toLowerCase().includes("walk"));
  const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
  const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
  idleAction?.play();
  group.userData.mixer = mixer;
  group.userData.idleAction = idleAction;
  group.userData.walkAction = walkAction;
  group.userData.lastWalking = false;
  group.userData.species = entity.species;
  group.userData.walking = Boolean(entity.walking);
  group.userData.color = entity.color;
  group.userData.pattern = entity.pattern;
  group.scale.setScalar(entity.scale ?? 1);
  const ground = terrainHeightAt(entity.x, entity.z, state.seed);
  const surfaceHeight = (entity.y ?? ground + 0.08) + (entity.aquatic ? 0 : 0.92);
  const point = planetPointAt(entity.x, surfaceHeight, entity.z);
  group.position.set(point.x, point.y, point.z);
  group.quaternion.copy(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0));
  scene.add(group);
  return group;
}

function makeFish(entity) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: entity.color ?? "#76b9c9" });
  const finMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color(entity.color ?? "#76b9c9").multiplyScalar(0.68) });
  const eyeMaterial = new THREE.MeshLambertMaterial({ color: "#1e2a36" });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 7), bodyMaterial);
  body.scale.set(0.76, 0.8, 1.5);
  group.add(body);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), eyeMaterial);
    eye.position.set(side * 0.16, 0.07, -0.28);
    group.add(eye);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), finMaterial);
    fin.position.set(side * 0.2, -0.04, 0.02);
    fin.rotation.z = side * Math.PI / 2;
    group.add(fin);
  }
  const tail = new THREE.Group();
  tail.position.z = 0.35;
  const tailFin = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.38, 4), finMaterial);
  tailFin.rotation.x = Math.PI / 2;
  tailFin.position.z = 0.15;
  tail.add(tailFin);
  group.add(tail);
  group.userData.tail = tail;
  group.userData.species = entity.species;
  group.userData.walking = Boolean(entity.walking);
  group.userData.color = entity.color;
  group.userData.pattern = entity.pattern;
  group.userData.gait = Math.random() * Math.PI * 2;
  group.add(avatarLabel(entity.name, "#c6f2ff"));
  const ground = terrainHeightAt(entity.x, entity.z, state.seed);
  const surfaceHeight = entity.y ?? ground + 3;
  const point = planetPointAt(entity.x, surfaceHeight, entity.z);
  group.position.set(point.x, point.y, point.z);
  group.quaternion.copy(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0));
  group.scale.setScalar(entity.scale ?? 1);
  scene.add(group);
  return group;
}

function updateAnimals(current = []) {
  const ids = new Set(current.map((animal) => animal.id));
  for (const [id, animal] of animalAvatars) {
    if (ids.has(id)) continue;
    scene.remove(animal);
    animalAvatars.delete(id);
  }
  for (const entity of current) {
    let animal = animalAvatars.get(entity.id);
    if (animal && (animal.userData.species !== entity.species || animal.userData.color !== entity.color)) {
      scene.remove(animal);
      animalAvatars.delete(entity.id);
      animal = null;
    }
    if (!animal) {
      animal = makeAnimal(entity);
      animalAvatars.set(entity.id, animal);
    }
    animal.userData.walking = Boolean(entity.walking);
    const ground = terrainHeightAt(entity.x, entity.z, state.seed);
    const surfaceHeight = (entity.y ?? ground + 0.08) + (entity.aquatic ? 0 : 0.92);
    const point = planetPointAt(entity.x, surfaceHeight, entity.z);
    const target = new THREE.Vector3(point.x, point.y, point.z);
    animal.position.lerp(target, 0.32);
    animal.position.setLength(PLANET_RADIUS + surfaceHeight);
    animal.quaternion.copy(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0));
    animal.scale.setScalar(entity.scale ?? 1);
  }
}

function refreshAnimalModels() {
  for (const animal of animalAvatars.values()) scene.remove(animal);
  animalAvatars.clear();
  updateAnimals(state.roomAnimals);
}

function animateAnimals(delta) {
  for (const animal of animalAvatars.values()) {
    if (animal.userData.mixer) {
      const walking = animal.userData.walking;
      if (walking !== animal.userData.lastWalking) {
        const from = walking ? animal.userData.idleAction : animal.userData.walkAction;
        const to = walking ? animal.userData.walkAction : animal.userData.idleAction;
        if (to) {
          to.reset().play();
          from?.crossFadeTo(to, 0.2, false);
        }
        animal.userData.lastWalking = walking;
      }
      animal.userData.mixer.update(delta);
      continue;
    }
    animal.userData.gait += delta * (animal.userData.walking ? 10 : 2);
    if (animal.userData.tail && !animal.userData.legs) {
      animal.userData.tail.rotation.y = Math.sin(animal.userData.gait) * 0.45;
      continue;
    }
    const stride = animal.userData.walking ? Math.sin(animal.userData.gait) * 0.55 : 0;
    animal.userData.legs.forEach((leg, index) => {
      leg.rotation.x = stride * (index === 0 || index === 3 ? 1 : -1);
    });
    animal.userData.tail.rotation.x = Math.sin(animal.userData.gait * 0.7) * 0.24;
    animal.userData.body.position.y = 0.72 + (animal.userData.walking ? Math.abs(stride) * 0.025 : 0);
  }
}

function updateLocalAvatar() {
  if (!selfAvatar) return;
  selfAvatar.visible = thirdPersonView && state.connected;
  if (!selfAvatar.visible) return;
  const surfaceHeight = playerPosition.y - 0.65;
  const point = planetPointAt(playerPosition.x, surfaceHeight, playerPosition.z);
  selfAvatar.position.set(point.x, point.y, point.z);
  selfAvatar.quaternion.copy(surfaceQuaternionAt(playerPosition.x, playerPosition.z, look.yaw));
  updateAvatarHealth(selfAvatar.userData.healthBar, state.health);
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
  state.roomAnimals = message.animals ?? [];
  loadAnimalModels(state.roomAnimals);
  state.roomPlayers = playerList;
  const self = playerList.find((player) => player.id === state.id);
  if (self) {
    const previousHealth = state.health;
    updateHealth(self.health);
    if (self.health < previousHealth) {
      notify(`A nearby creature hit you for ${previousHealth - self.health} damage.`);
    }
  }
  updateAvatars(playerList, players);
  updateAvatars(botList, bots, true);
  updateAvatars(message.monsters ?? [], monsters, true, monsterAvatars, makeMonster);
  updateAnimals(state.roomAnimals);
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
  shopCoins.textContent = `Coins ${state.coins}`;
  if (!shopPanel.hidden) renderShop();
}

function renderPlayerProfile(profile) {
  profileNameInput.value = profile.name;
  profileColorInput.value = profile.color;
  playerNameInput.value = profile.name;
  lobbyPlayerNameInput.value = profile.name;
  localStorage.setItem("player-name", profile.name);
  const statElements = {
    blocksMined: "#profile-blocks-mined",
    blocksPlaced: "#profile-blocks-placed",
    itemsCrafted: "#profile-items-crafted",
    creaturesDefeated: "#profile-creatures-defeated",
    worldsSaved: "#profile-worlds-saved",
  };
  for (const [key, selector] of Object.entries(statElements)) {
    document.querySelector(selector).textContent = String(profile.stats?.[key] ?? 0);
  }
  if (selfAvatar) selfAvatar.children[0].material.color.set(profile.color);
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

function upsertMapMarker({ key, className, x, z, offset = 0, title, ariaLabel, label, targetValue }) {
  let marker = mapMarkerElements.get(key);
  if (!marker) {
    marker = document.createElement("button");
    marker.type = "button";
    const dot = document.createElement("span");
    dot.className = "map-marker-dot";
    const markerLabel = document.createElement("span");
    markerLabel.className = "map-marker-name";
    marker.append(dot, markerLabel);
    marker.addEventListener("click", () => {
      const pressed = marker.getAttribute("aria-pressed") === "true";
      for (const otherMarker of mapMarkerElements.values()) otherMarker.setAttribute("aria-pressed", "false");
      marker.setAttribute("aria-pressed", String(!pressed));
      if (targetValue) teleportTarget.value = targetValue;
      teleportButton.disabled = !teleportTarget.value;
    });
    mapMarkerElements.set(key, marker);
    worldMapMarkers.append(marker);
  }
  marker.className = className;
  marker.style.left = `${(wrapPlanetX(x) - PLANET_MIN_X) / PLANET_LONGITUDE_BLOCKS * 100 + offset}%`;
  marker.style.top = `${(PLANET_MAX_Z - z) / PLANET_LATITUDE_BLOCKS * 100}%`;
  marker.title = title;
  marker.setAttribute("aria-label", ariaLabel);
  marker.children[1].textContent = label;
  return marker;
}

function renderWorldMapMarkers(playerList = state.roomPlayers ?? []) {
  const activeOptions = new Set();
  const activeMarkers = new Set();
  const placeholder = teleportTarget.options[0];
  if (placeholder && placeholder.textContent !== "Choose a player or location") {
    placeholder.textContent = "Choose a player or location";
  }

  const ensureOption = (value, label) => {
    let option = mapTargetOptions.get(value);
    if (!option) {
      option = document.createElement("option");
      option.value = value;
      mapTargetOptions.set(value, option);
      teleportTarget.append(option);
    }
    if (option.textContent !== label) option.textContent = label;
    activeOptions.add(value);
  };

  for (const player of playerList) {
    const isSelf = player.id === state.id;
    const targetValue = isSelf ? "" : player.id;
    if (targetValue) ensureOption(targetValue, player.name);
    const key = `player:${player.id}`;
    activeMarkers.add(key);
    upsertMapMarker({
      key,
      className: `map-marker${isSelf ? " self" : ""}`,
      x: player.x,
      z: player.z,
      title: isSelf ? `${player.name} (you)` : player.name,
      ariaLabel: isSelf ? `${player.name}, your location` : `${player.name}, tap to show name`,
      label: isSelf ? `${player.name} (you)` : player.name,
      targetValue,
    });
  }

  for (const location of WORLD_LOCATIONS) {
    const targetValue = `location:${location.id}`;
    ensureOption(targetValue, location.name);
    const key = `location:${location.id}`;
    activeMarkers.add(key);
    upsertMapMarker({
      key,
      className: "map-marker location-marker",
      x: location.x,
      z: location.z,
      offset: location.id === "beach" ? -1.6 : location.id === "harbor" ? 1.6 : 0,
      title: `${location.name} (teleport point)`,
      ariaLabel: `${location.name}, teleport point`,
      label: location.name,
      targetValue,
    });
  }

  for (const [value, option] of mapTargetOptions) {
    if (!activeOptions.has(value)) {
      option.remove();
      mapTargetOptions.delete(value);
    }
  }
  for (const [key, marker] of mapMarkerElements) {
    if (!activeMarkers.has(key)) {
      marker.remove();
      mapMarkerElements.delete(key);
    }
  }

  if (teleportTarget.value && !activeOptions.has(teleportTarget.value)) teleportTarget.value = "";
  const teleportDisabled = !teleportTarget.value;
  if (teleportButton.disabled !== teleportDisabled) teleportButton.disabled = teleportDisabled;
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
    socket.send(JSON.stringify({ type: "profile_load", profileId: playerProfileId }));
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
    } else if (message.type === "profile_data") {
      renderPlayerProfile(message.profile);
      profileStatus.textContent = "Profile saved and synced.";
    } else if (message.type === "autosave_result") {
      autosaveToggle.checked = message.enabled;
      gameMenuStatus.textContent = message.message;
    } else if (message.type === "save_result") {
      gameMenuStatus.textContent = message.message;
    } else if (message.type === "fish_result") {
      if (message.caught) {
        triggerFishingCast(message.item);
      }
      notify(message.message);
    } else if (message.type === "attack_result") {
      if (message.hit && message.killed && message.reward) {
        updateXp(message.reward.xp, message.reward.level);
        updateCoins(message.reward.coins);
        notify(`Monster defeated! +${message.reward.xpGained} XP · +${message.reward.coinsGained} coins.`);
      } else if (message.hit) notify(`Hit for ${message.damage} damage.`);
      else if (message.message) notify(message.message);
    } else if (message.type === "respawn_result") {
      playerPosition.x = message.position.x;
      playerPosition.z = message.position.z;
      playerPosition.y = message.position.y ?? terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 1.65;
      look.yaw = message.position.yaw;
      state.jumpVelocity = 0;
      updateHealth(message.health);
      updateChunkWindow(true);
      renderWorld();
      notify("You are back in the world.");
    } else if (message.type === "teleport_result") {
      playerPosition.x = message.position.x;
      playerPosition.z = message.position.z;
      playerPosition.y = message.position.y ?? terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 1.65;
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
      createUnderwaterLife(state.seed);
      state.mode = message.mode === "design" ? "design" : "survival";
      autosaveToggle.checked = message.autosaveEnabled !== false;
      if (message.position) {
        playerPosition.x = message.position.x;
        playerPosition.z = message.position.z;
        playerPosition.y = message.position.y ?? terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 1.65;
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
    } else if (message.type === "buy_result") {
      updateCoins(message.coins);
      shopNotice.textContent = message.message;
      notify(message.message);
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
      if (profileDialog.open) profileStatus.textContent = message.message;
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
autosaveToggle.addEventListener("change", () => {
  const enabled = autosaveToggle.checked;
  gameMenuStatus.textContent = "Updating autosave…";
  if (!sendLobbyMessage({ type: "set_autosave", enabled })) autosaveToggle.checked = !enabled;
});
document.querySelector("#open-profile-button").addEventListener("click", () => {
  profileStatus.textContent = "Loading profile…";
  profileDialog.showModal();
  gameMenu.hidden = true;
  gameMenuToggle.setAttribute("aria-expanded", "false");
  sendLobbyMessage({ type: "profile_load", profileId: playerProfileId });
});
document.querySelector("#close-profile-button").addEventListener("click", () => profileDialog.close());
document.querySelector("#save-profile-button").addEventListener("click", () => {
  const name = profileNameInput.value.trim().slice(0, 16);
  if (!name) {
    profileStatus.textContent = "Enter a player name first.";
    return;
  }
  profileStatus.textContent = "Saving profile…";
  sendLobbyMessage({ type: "profile_update", name, color: profileColorInput.value });
});
thirdPersonToggle.addEventListener("change", () => {
  thirdPersonView = thirdPersonToggle.checked;
  localStorage.setItem("camera-view-mode", thirdPersonView ? "third-person" : "first-person");
  updateCamera();
  updateLocalAvatar();
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
document.querySelector("#open-shop-button").addEventListener("click", () => {
  shopPanel.hidden = false;
  gameMenu.hidden = true;
  gameMenuToggle.setAttribute("aria-expanded", "false");
  renderShop();
});
document.querySelector("#close-shop-button").addEventListener("click", () => {
  shopPanel.hidden = true;
});
shopCategory.addEventListener("change", renderShop);
shopSearch.addEventListener("input", renderShop);
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
    item.classList.toggle("hotbar-armed", state.pendingHotbarItem === id);
    item.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      state.pendingHotbarItem = id;
      for (const choice of inventoryList.querySelectorAll(".inventory-item")) {
        choice.classList.toggle("hotbar-armed", choice === item);
      }
      notify(`Tap a hotbar slot to assign ${itemName(id)}.`);
    });
    const swatch = document.createElement("span");
    swatch.className = "inventory-swatch";
    const model = MODEL_ITEM_BY_ID.get(id);
    swatch.style.backgroundImage = model
      ? `linear-gradient(135deg, ${model.color}, #f3e9ca)`
      : id === "campfire"
      ? "linear-gradient(135deg, #ffd56a, #ed7338 55%, #604230 56%)"
      : `url("${blockChoices.find(([block]) => block === id)?.[2] ?? ""}")`;
    const itemNameLabel = document.createElement("span");
    itemNameLabel.className = "inventory-item-name";
    itemNameLabel.textContent = itemName(id);
    const amount = document.createElement("span");
    amount.className = "inventory-amount";
    amount.textContent = `×${count}`;
    const dropButton = document.createElement("button");
    dropButton.className = "drop-item";
    dropButton.type = "button";
    dropButton.draggable = false;
    dropButton.textContent = "Drop 1";
    dropButton.setAttribute("aria-label", `Drop one ${itemName(id)}`);
    dropButton.addEventListener("click", () => sendInventoryAction({ type: "drop", item: id, count: 1 }));
    if (FISH_TYPE_BY_ID.has(id)) {
      const sellButton = document.createElement("button");
      sellButton.className = "drop-item";
      sellButton.type = "button";
      sellButton.draggable = false;
      sellButton.textContent = "Sell 1";
      sellButton.setAttribute("aria-label", `Sell one ${itemName(id)}`);
      sellButton.addEventListener("click", () => sendInventoryAction({ type: "sell", item: id, count: 1 }));
      item.append(sellButton);
    }
    const dragHandle = document.createElement("button");
    dragHandle.className = "inventory-drag-handle";
    dragHandle.type = "button";
    dragHandle.draggable = !supportsTouch;
    dragHandle.textContent = "↗";
    dragHandle.setAttribute("aria-label", `Drag ${itemName(id)} to a hotbar slot`);
    dragHandle.addEventListener("dragstart", (event) => {
      if (!event.dataTransfer) return;
      event.dataTransfer.setData("text/plain", id);
      event.dataTransfer.effectAllowed = "copy";
      state.pendingHotbarItem = id;
    });
    dragHandle.addEventListener("dragend", () => {
      state.pendingHotbarItem = null;
    });
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
    item.append(swatch, itemNameLabel, amount, dragHandle, dropButton);
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
      .map(([item, amount]) => `${amount} ${itemName(item)}`)
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
  ghost.textContent = itemName(item);
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

function renderShop() {
  if (shopCategory.options.length === 0) {
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "All model types";
    shopCategory.append(all);
    for (const category of MODEL_CATEGORIES_LIST) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.label;
      shopCategory.append(option);
    }
  }

  const query = shopSearch.value.trim().toLowerCase();
  const category = shopCategory.value;
  const filtered = MODEL_CATALOG.filter((model) =>
    (!category || model.category === category) &&
    (!query || `${model.name} ${model.categoryLabel}`.toLowerCase().includes(query)),
  );
  const atMarket = Math.hypot(wrapPlanetX(playerPosition.x), playerPosition.z) <= 16;
  shopNotice.textContent = atMarket
    ? `${filtered.length.toLocaleString()} models available. Choose one to decorate your home.`
    : "Visit the village market near the world spawn to buy models.";
  shopItems.replaceChildren();
  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "shop-notice";
    empty.textContent = "No models match that search.";
    shopItems.append(empty);
    return;
  }

  for (const model of filtered.slice(0, 100)) {
    const row = document.createElement("div");
    row.className = "shop-item";
    const name = document.createElement("span");
    name.textContent = `${model.name} · ${model.categoryLabel}`;
    const button = document.createElement("button");
    button.type = "button";
    const free = state.mode === "design";
    button.textContent = free ? "Add free" : `Buy · ${model.price}`;
    button.disabled = !atMarket || (!free && state.coins < model.price);
    button.addEventListener("click", () => {
      shopNotice.textContent = "Processing purchase…";
      sendInventoryAction({ type: "buy_model", item: model.id });
    });
    row.append(name, button);
    shopItems.append(row);
  }
  if (filtered.length > 100) {
    const more = document.createElement("p");
    more.className = "shop-notice";
    more.textContent = `Showing 100 of ${filtered.length.toLocaleString()} results. Search to narrow the list.`;
    shopItems.append(more);
  }
}

function updateHotbar() {
  for (const [index, button] of [...hotbar.querySelectorAll(".block-choice")].entries()) {
    const id = hotbarItems[index];
    const choice = blockChoiceById.get(id);
    const model = MODEL_ITEM_BY_ID.get(id);
    const [, blockLabel, textureUrl] = choice ?? [];
    const name = blockLabel ?? model?.name;
    button.dataset.block = id ?? "";
    button.setAttribute("aria-label", id ? `${name} block, shortcut ${index + 1}` : `Empty slot ${index + 1}`);
    button.querySelector(".block-swatch").style.backgroundImage = model
      ? `linear-gradient(135deg, ${model.color}, #f3e9ca)`
      : textureUrl
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
  if (!blockChoiceById.has(item) && !MODEL_ITEM_BY_ID.has(item)) return;
  const existingIndex = hotbarItems.indexOf(item);
  if (existingIndex >= 0 && existingIndex !== index) {
    hotbarItems[existingIndex] = hotbarItems[index];
  }
  hotbarItems[index] = item;
  state.pendingHotbarItem = null;
  updateHotbar();
  selectBlock(item);
  notify(`${itemName(item)} assigned to slot ${index + 1}.`);
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
  const hits = raycaster.intersectObjects([...blockMeshes, ...modelTargetMeshes], false);
  const hit = hits.find((candidate) =>
    (candidate.instanceId !== undefined || candidate.object.userData.blockCoordinates) &&
    candidate.distance < 6,
  );
  if (!hit) return null;
  const coords = hit.instanceId !== undefined
    ? hit.object.userData.coordinates[hit.instanceId]
    : hit.object.userData.blockCoordinates;
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
    notify(`No ${itemName(state.selected)} in your inventory.`);
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
function bindSwimControl(button, direction) {
  const release = () => {
    if (state.swimDirection === direction) state.swimDirection = 0;
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (!state.isSwimming) return;
    button.setPointerCapture(event.pointerId);
    state.swimDirection = direction;
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}
bindSwimControl(waterRiseButton, 1);
bindSwimControl(waterDiveButton, -1);
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
    if (state.isSwimming) state.swimDirection = 1;
    else if (!event.repeat) jump();
    return;
  }
  if ((event.code === "ShiftLeft" || event.code === "ShiftRight") && state.isSwimming) {
    event.preventDefault();
    state.swimDirection = -1;
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
window.addEventListener("keyup", (event) => {
  moveKeys.delete(event.code);
  if (event.code === "Space" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
    state.swimDirection = 0;
  }
});
window.addEventListener("blur", () => {
  moveKeys.clear();
  state.swimDirection = 0;
});
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
  const firstBlockY = Math.floor(referenceEyeY - 1.65 + 0.05);
  for (let y = firstBlockY; y >= BEDROCK_Y; y -= 1) {
    if (worldBlocks.has(blockKey(blockX, y, blockZ))) return y + 1.65;
  }
  return BEDROCK_Y + 1.65;
}

function hasWallAt(x, z, eyeY) {
  const blockX = Math.round(x);
  const blockZ = Math.round(z);
  const firstBlockY = Math.floor(eyeY - 0.15);
  return [firstBlockY, firstBlockY + 1].some((blockY) => {
    const type = worldBlocks.get(blockKey(blockX, blockY, blockZ));
    return type !== undefined && type !== null && type !== "water";
  });
}

function waterSurfaceEyeAt(x, z) {
  const blockX = Math.round(wrapPlanetX(x));
  const blockZ = Math.round(z);
  for (let blockY = 0; blockY >= BEDROCK_Y; blockY -= 1) {
    if (worldBlocks.get(blockKey(blockX, blockY, blockZ)) === "water") return blockY + 1.65;
  }
  return null;
}

function jump() {
  const groundY = groundEyeAt(playerPosition.x, playerPosition.z, playerPosition.y);
  if (playerPosition.y <= groundY + 0.02) {
    playerPosition.y = groundY;
    state.jumpVelocity = 7.5;
  }
}

function updateMovement(delta) {
  if (!state.connected || !gameMenu.hidden || !worldMapPanel.hidden || !shopPanel.hidden) return;
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

  const waterSurfaceEyeY = waterSurfaceEyeAt(playerPosition.x, playerPosition.z);
  const waterFloorEyeY = terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 1.65;
  const swimming = waterSurfaceEyeY !== null &&
    playerPosition.y >= waterFloorEyeY &&
    playerPosition.y <= waterSurfaceEyeY + 0.3;
  state.isSwimming = swimming;
  waterControls.hidden = !swimming;
  if (swimming) {
    state.jumpVelocity = 0;
    const verticalSpeed = state.swimDirection === 0 ? 0.45 : state.swimDirection * 3.2;
    playerPosition.y = THREE.MathUtils.clamp(
      playerPosition.y + verticalSpeed * delta,
      waterFloorEyeY,
      waterSurfaceEyeY + 0.15,
    );
  } else {
    state.swimDirection = 0;
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
  }
  updateCamera();
  updateLocalAvatar();
  if (updateChunkWindow()) renderWorld();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  updateMovement(delta);
  animateAnimals(delta);
  const now = performance.now();
  updateSkyObjects(now);
  updateUnderwaterLife(now);
  if (state.connected && now - state.lastSentAt > 70) {
    state.socket.send(
      JSON.stringify({
        type: "move",
        position: { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z, yaw: look.yaw },
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

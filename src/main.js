import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  BEDROCK_Y,
  advancePlanetPosition,
  BLOCK_TYPES,
  blockKey,
  canCraft,
  CHUNK_SIZE,
  cityPropertyNear,
  isNearRestaurant,
  CITY_BEACH_OUTER_RADIUS,
  CITY_BLOCK_SIZE,
  CITY_POLICE_STATION,
  CITY_RADIUS,
  createChunkBlocks,
  FISH_TYPE_BY_ID,
  HARBOR_DOCK_MAX_Z,
  HARBOR_DOCK_MIN_Z,
  HARBOR_WATER_OUTER_RADIUS,
  isNearBoatWorkshop,
  isNearHarbor,
  listCityProperties,
  listCityShops,
  MAX_BUILD_HEIGHT,
  MAX_STACK_SIZE,
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
import { RESTAURANT_MENU, RESTAURANT_MENU_BY_ID } from "../shared/food.js";
import grassTextureUrl from "./assets/blocks/own/grass_top.png";
import dirtTextureUrl from "./assets/new/PixelTexturePack/Textures/Rocks/DIRT.png";
import stoneTextureUrl from "./assets/new/PixelTexturePack/Textures/Rocks/GRAYROCKS.png";
import planksTextureUrl from "./assets/new/PixelTexturePack/Textures/Wood/WOODA.png";
import logTextureUrl from "./assets/new/PixelTexturePack/Textures/Wood/TRUNKS.png";
import glassTextureUrl from "./assets/blocks/own/glass.png";
import leavesTextureUrl from "./assets/blocks/own/oak_leaves.png";
import sandTextureUrl from "./assets/new/PixelTexturePack/Textures/Elements/SAND.png";
import obsidianTextureUrl from "./assets/blocks/own/obsidian.png";
import snowTextureUrl from "./assets/new/PixelTexturePack/Textures/Elements/SNOW.png";
import iceTextureUrl from "./assets/blocks/pixel-perfection/ice.png";
import brickTextureUrl from "./assets/new/PixelTexturePack/Textures/Bricks/REDBRICKS.png";
import blackConcreteTextureUrl from "./assets/new/PixelTexturePack/Textures/Urban/PAVEMENT.png";
import whiteConcreteTextureUrl from "./assets/new/PixelTexturePack/Textures/Urban/GRAYWALL.png";
import blueConcreteTextureUrl from "./assets/new/PixelTexturePack/Textures/Tech/HIGHTECH.png";
import redConcreteTextureUrl from "./assets/blocks/own/red_concrete.png";
import craftingTableTextureUrl from "./assets/blocks/vibes/table.png";
import waterTextureUrl from "./assets/new/PixelTexturePack/Textures/Elements/WATER.png";
import cityBrickTextureUrl from "./assets/new/ambientcg/Bricks060/Color.jpg";
import cityPavingTextureUrl from "./assets/new/ambientcg/PavingStones036/Color.jpg";
import furnitureWoodTextureUrl from "./assets/new/PixelTexturePack/Textures/Wood/WOODA.png";
import metalTextureUrl from "./assets/new/PixelTexturePack/Textures/Industrial/METALTILE.png";
import goldTextureUrl from "./assets/new/PixelTexturePack/Textures/Rocks/GOLDROCKS.png";
import stoneTextureDetailUrl from "./assets/new/PixelTexturePack/Textures/Rocks/FLATSTONES.png";
import blockBitsTextureUrl from "./assets/Textures/block_bits_texture.png?url";
import pirateShipUrl from "./assets/new/eclair_pirate_ships_boats_11_cc0_native_glb_v1/Models/GLB format/ship-pirate-small.glb?url";
import rowboatUrl from "./assets/new/eclair_pirate_ships_boats_11_cc0_native_glb_v1/Models/GLB format/boat-row-small.glb?url";
import pirateShipTextureUrl from "./assets/new/eclair_pirate_ships_boats_11_cc0_native_glb_v1/Models/GLB format/Textures/colormap.png?url";
import "./style.css";

const canvas = document.querySelector("#world");
const rainOverlay = document.querySelector("#rain-overlay");
const weatherHud = document.querySelector("#weather-hud");
const statusText = document.querySelector("#connection-status");
const statusDot = document.querySelector("#connection-dot");
const toast = document.querySelector("#toast");
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
const boatWorkshopButton = document.querySelector("#open-boat-workshop-button");
const boatWorkshopDialog = document.querySelector("#boat-workshop-dialog");
const boatWorkshopForm = document.querySelector("#boat-workshop-form");
const boatWorkshopPreview = document.querySelector("#boat-design-preview");
const boatWorkshopMaterials = document.querySelector("#boat-workshop-materials");
const shopPanel = document.querySelector("#shop-panel");
const shopItems = document.querySelector("#shop-items");
const shopCategory = document.querySelector("#shop-category");
const shopSearch = document.querySelector("#shop-search");
const shopNotice = document.querySelector("#shop-notice");
const shopCoins = document.querySelector("#shop-coins");
const restaurantPanel = document.querySelector("#restaurant-panel");
const restaurantItems = document.querySelector("#restaurant-items");
const restaurantNotice = document.querySelector("#restaurant-notice");
const restaurantCoins = document.querySelector("#restaurant-coins");
const restaurantTitle = document.querySelector("#restaurant-title");
const restaurantSeatButton = document.querySelector("#restaurant-seat-button");
const homeProperties = document.querySelector("#home-properties");
const homeNotice = document.querySelector("#home-notice");
const thirdPersonToggle = document.querySelector("#third-person-toggle");
const flyToggle = document.querySelector("#fly-toggle");
const flyButton = document.querySelector("#fly-button");
const desktopFlyButton = document.querySelector("#desktop-fly-button");
const flyUpButton = document.querySelector("#fly-up-button");
const flyDownButton = document.querySelector("#fly-down-button");
const tankAimLeftButton = document.querySelector("#tank-aim-left-button");
const tankAimRightButton = document.querySelector("#tank-aim-right-button");
const tankAimUpButton = document.querySelector("#tank-aim-up-button");
const tankAimDownButton = document.querySelector("#tank-aim-down-button");
const tankFireButton = document.querySelector("#tank-fire-button");
const jumpButton = document.querySelector("#jump-button");
const autosaveToggle = document.querySelector("#autosave-toggle");
const profileDialog = document.querySelector("#profile-dialog");
const profileNameInput = document.querySelector("#profile-name");
const profileColorInput = document.querySelector("#profile-color");
const profileStatus = document.querySelector("#profile-status");
const profileCharacterModel = document.querySelector("#profile-character-model");
const profileCharacterName = document.querySelector("#profile-character-name");
const profileCharacterLevel = document.querySelector("#profile-character-level");
const profileGearList = document.querySelector("#profile-gear-list");
const worldMapPanel = document.querySelector("#world-map-panel");
const worldMapCanvas = document.querySelector("#world-map-canvas");
const worldMapMarkers = document.querySelector("#world-map-markers");
const worldMapSelection = document.querySelector("#world-map-selection");
const mapTeleportButton = document.querySelector("#map-teleport-button");
const expandWorldMapButton = document.querySelector("#expand-world-map-button");
const aimCrosshair = document.querySelector(".aim-crosshair");
const teleportTarget = document.querySelector("#teleport-target");
const teleportButton = document.querySelector("#teleport-button");
const mapTargetOptions = new Map();
const mapMarkerElements = new Map();
let selectedMapTarget = null;
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
const healthHud = document.querySelector(".health-hud");
const toggleHealthHudButton = document.querySelector("#toggle-health-hud-button");
const respawnOverlay = document.querySelector("#respawn-overlay");
const respawnButton = document.querySelector("#respawn-button");
const attackButton = document.querySelector("#attack-button");
const fishButton = document.querySelector("#fish-button");
const fishMenuButton = document.querySelector("#fish-menu-button");
const breakButton = document.querySelector("#break-button");
const placeButton = document.querySelector("#place-button");
const vehicleButton = document.querySelector("#vehicle-button");
const waterControls = document.querySelector("#water-controls");
const waterRiseButton = document.querySelector("#water-rise-button");
const waterDiveButton = document.querySelector("#water-dive-button");
const savedPlayerName = localStorage.getItem("player-name");
const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
let healthHudHidden = localStorage.getItem("health-hud-visible") === "false";
let lastSkyUpdateAt = 0;
let lastUnderwaterUpdateAt = 0;
let playerAttackTime = 0;
const PLAYER_ATTACK_ANIMATION_DURATION = 0.38;

function renderHealthHudVisibility() {
  healthHud.hidden = healthHudHidden;
  toggleHealthHudButton.textContent = healthHudHidden ? "Show health & XP bar" : "Hide health & XP bar";
  toggleHealthHudButton.setAttribute("aria-pressed", String(healthHudHidden));
}

function nearestAvailableHorse() {
  if (state.vehicleId || state.mountId) return null;
  let nearest = null;
  let nearestDistance = 3.5;
  for (const animal of state.roomAnimals) {
    if (animal.model !== "horse" || animal.riderId) continue;
    const distance = Math.hypot(
      wrapPlanetX(animal.x - playerPosition.x),
      animal.z - playerPosition.z,
    );
    if (distance < nearestDistance) {
      nearest = animal;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function nearestFoodShop(maxDistance = 7) {
  let nearest = null;
  let nearestDistance = maxDistance;
  for (const shop of listCityShops(state.seed)) {
    if (!shop.foodShop) continue;
    const distance = Math.hypot(wrapPlanetX(shop.x - playerPosition.x), shop.z - playerPosition.z);
    if (distance < nearestDistance) {
      nearest = shop;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function nearestRestaurantBot(maxDistance = 4) {
  let nearest = null;
  let nearestDistance = maxDistance;
  for (const bot of state.roomBots) {
    if (!bot.restaurantShopId || !bot.restaurantRole) continue;
    const distance = Math.hypot(wrapPlanetX(bot.x - playerPosition.x), bot.z - playerPosition.z);
    if (distance < nearestDistance) {
      nearest = bot;
      nearestDistance = distance;
    }
  }
  return nearest;
}

renderHealthHudVisibility();

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
let thirdPersonView = localStorage.getItem("camera-view-mode") !== "first-person";
thirdPersonToggle.checked = thirdPersonView;
document.documentElement.classList.toggle("first-person-view", !thirdPersonView);
const activeRoomStorageKey = "active-room-id";
let resumeRequested = false;
if (savedPlayerName) {
  lobbyPlayerNameInput.value = savedPlayerName;
  profileNameInput.value = savedPlayerName;
}
const blockChoices = [
  ["grass", "Grass", grassTextureUrl],
  ["dirt", "Dirt", dirtTextureUrl],
  ["stone", "Stone", stoneTextureUrl],
  ["oak_planks", "Planks", planksTextureUrl],
  ["oak_door", "Door", planksTextureUrl],
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
  ["stone_pickaxe", "Stone Pickaxe", null],
  ["iron_pickaxe", "Iron Pickaxe", null],
  ["iron_axe", "Iron Axe", null],
  ["iron_sword", "Iron Sword", null],
  ["steel_pickaxe", "Steel Pickaxe", null],
  ["steel_axe", "Steel Axe", null],
  ["steel_sword", "Steel Sword", null],
  ["lantern", "Lantern", null],
  ["torch", "Torch", null],
  ["shield", "Shield", null],
  ["compass", "Compass", null],
  ["map", "Map", null],
  ["spyglass", "Spyglass", null],
];
const blockNames = new Map(blockChoices.map(([id, name]) => [id, name]));
const blockChoiceById = new Map(blockChoices.map((choice) => [choice[0], choice]));
function itemName(id) {
  return blockNames.get(id) ?? MODEL_ITEM_BY_ID.get(id)?.name ?? RESTAURANT_MENU_BY_ID.get(id)?.name ?? id ?? "";
}
const HOTBAR_SIZE = 6;
const hotbarItems = Array(HOTBAR_SIZE).fill(null);
const textureLoader = new THREE.TextureLoader();
const materials = new Map();
const modelPlacementMeshes = [];
const modelTargetMeshes = [];
const cityShopSigns = [];
const importedSurfaceTextures = new Map();
let importedFabricTexture;
const cityBrickTexture = textureLoader.load(cityBrickTextureUrl);
cityBrickTexture.colorSpace = THREE.SRGBColorSpace;
cityBrickTexture.wrapS = THREE.RepeatWrapping;
cityBrickTexture.wrapT = THREE.RepeatWrapping;
cityBrickTexture.magFilter = THREE.LinearFilter;
cityBrickTexture.minFilter = THREE.LinearMipmapLinearFilter;
cityBrickTexture.anisotropy = 4;
const cityPavingTexture = textureLoader.load(cityPavingTextureUrl);
cityPavingTexture.colorSpace = THREE.SRGBColorSpace;
cityPavingTexture.wrapS = THREE.RepeatWrapping;
cityPavingTexture.wrapT = THREE.RepeatWrapping;
cityPavingTexture.magFilter = THREE.LinearFilter;
cityPavingTexture.minFilter = THREE.LinearMipmapLinearFilter;
cityPavingTexture.anisotropy = 4;

function loadImportedSurfaceTexture(url) {
  if (!importedSurfaceTextures.has(url)) {
    importedSurfaceTextures.set(url, textureLoader.loadAsync(url).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestMipmapNearestFilter;
      return texture;
    }));
  }
  return importedSurfaceTextures.get(url);
}

async function repairImportedFbxMaterials(scene) {
  const updates = [];
  scene.traverse((part) => {
    if (!part.isMesh) return;
    const hasMaterialArray = Array.isArray(part.material);
    const sourceMaterials = hasMaterialArray ? part.material : [part.material];
    const repairedMaterials = sourceMaterials.map((material) => {
      const repaired = material.clone();
      const name = material.name.toLowerCase();
      let textureUrl = null;
      let color = null;
      if (name.includes("wood") || name.includes("leg")) {
        textureUrl = furnitureWoodTextureUrl;
        color = name.includes("dark") ? "#6a4931" : "#b18450";
      } else if (name.includes("gold")) {
        textureUrl = goldTextureUrl;
        color = "#e0b849";
      } else if (name.includes("steel") || name.includes("metal") || name.includes("grey")) {
        textureUrl = metalTextureUrl;
        color = name.includes("dark") ? "#687078" : "#c1c9d2";
      } else if (name.includes("stone")) {
        textureUrl = stoneTextureDetailUrl;
        color = "#a9a69f";
      } else {
        textureUrl = null;
        color = name.includes("mattress") || name.includes("pillow") ? "#eee4cf"
          : name.includes("comforter") ? "#6482a0"
            : name.includes("cush") ? "#bca88f"
              : name.includes("cover") ? "#a44748"
                : name.includes("page") ? "#d4c58f"
                  : name.includes("sofa") ? "#6480a2"
                    : name.includes("chair") ? "#486e9a"
                      : name.includes("grey") ? "#aab1b6"
                        : name.includes("black") ? "#34383d"
                          : "#b2a393";
      }
      if (color) repaired.color.set(color);
      repaired.opacity = 1;
      repaired.transparent = false;
      repaired.depthWrite = true;
      if (textureUrl) {
        updates.push(loadImportedSurfaceTexture(textureUrl).then((texture) => {
          repaired.map = texture;
          repaired.needsUpdate = true;
        }));
      } else {
        repaired.map = importedFabricTexture ??= createFabricTexture();
        repaired.needsUpdate = true;
      }
      return repaired;
    });
    part.material = hasMaterialArray ? repairedMaterials : repairedMaterials[0];
  });
  await Promise.all(updates);
}

function createFabricTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  context.fillStyle = "#e2ddd4";
  context.fillRect(0, 0, 32, 32);
  for (let y = 1; y < 32; y += 4) {
    context.fillStyle = y % 8 === 1 ? "#cbc4b9" : "#f2eee7";
    context.fillRect(0, y, 32, 1);
  }
  for (let x = 2; x < 32; x += 4) {
    context.fillStyle = "#d5cec3";
    context.fillRect(x, 0, 1, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createFallbackBlockTexture(itemId) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d");
  const palettes = itemId.includes("copper") ? ["#73503f", "#c5794b", "#e1a176"]
    : itemId.includes("gold") ? ["#74623c", "#d4ae4c", "#f3d676"]
      : itemId.includes("silver") ? ["#606d73", "#aebac1", "#e0e5e7"]
        : itemId.includes("iron") ? ["#625950", "#a79a8d", "#d0bca7"]
          : itemId.includes("ruby") ? ["#5c303e", "#bd4f68", "#ef91a0"]
            : itemId.includes("emerald") ? ["#285b4b", "#47a27b", "#a2d18c"]
              : itemId.includes("coal") ? ["#272b2d", "#555b60", "#899095"]
                : itemId.includes("wood") || itemId.includes("plank") ? ["#4b3427", "#9a6840", "#c89a60"]
                    : itemId.includes("paper") || itemId === "map" ? ["#b39461", "#e8d39c", "#fff0c8"]
                      : ["#444951", "#89939b", "#c7d0d4"];
  context.fillStyle = palettes[0];
  context.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const noise = (x * 17 + y * 31 + itemId.length * 13) % 11;
      if (noise > 3) continue;
      context.fillStyle = palettes[1 + (noise % 2)];
      context.fillRect(x, y, 1 + (noise % 2), 1);
    }
  }
  if (itemId.endsWith("_ore")) {
    for (const [x, y] of [[3, 4], [10, 3], [7, 11], [13, 13]]) {
      context.fillStyle = palettes[2];
      context.fillRect(x, y, 2, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

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

const fishingRodTexture = createFishingRodTexture();
const fishingRodIconUrl = fishingRodTexture.image.toDataURL();

for (const [id, name, url] of blockChoices) {
  const texture = url
    ? textureLoader.load(url)
    : id === "fishing_rod"
      ? fishingRodTexture
      : id === "raw_fish"
      ? createFishTexture("#91d8db")
      : id === "sunfish"
        ? createFishTexture("#f5c76a")
        : id === "gold_fish"
          ? createFishTexture("#e4c15d")
          : id === "salmon"
            ? createFishTexture("#ff8a5b")
              : id === "campfire"
                ? createCampfireTexture()
                : createFallbackBlockTexture(id);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  materials.set(
    id,
    new THREE.MeshLambertMaterial({
      map: texture,
      side: id === "glass" || id === "water" ? THREE.FrontSide : THREE.DoubleSide,
      transparent: id === "glass" || id === "water",
      opacity: id === "glass" ? 0.58 : id === "water" ? 0.62 : 1,
      depthWrite: id !== "glass" && id !== "water",
    }),
  );
}
for (const itemId of BLOCK_TYPES) {
  if (materials.has(itemId)) continue;
  const texture = createFallbackBlockTexture(itemId);
  materials.set(itemId, new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide }));
}
materials.get("brick").map = cityBrickTexture;
materials.get("brick").needsUpdate = true;
materials.get("white_concrete").map = cityBrickTexture;
materials.get("white_concrete").color.set("#d9d6d0");
materials.get("white_concrete").needsUpdate = true;
materials.get("black_concrete").map = cityPavingTexture;
materials.get("black_concrete").color.set("#90969a");
materials.get("black_concrete").needsUpdate = true;

const scene = new THREE.Scene();
const daySkyColor = new THREE.Color("#a9d8ed");
const nightSkyColor = new THREE.Color("#111b35");
const nightHemisphereColor = new THREE.Color("#4c5f8a");
const nightGroundColor = new THREE.Color("#171d32");
const nightSunlightColor = new THREE.Color("#8597c8");
scene.background = daySkyColor.clone();
const renderDistance = isCoarsePointer ? 27 : 43;
scene.fog = new THREE.Fog(daySkyColor, renderDistance * 0.58, renderDistance);
const camera = new THREE.PerspectiveCamera(74, 1, 0.1, 90);
camera.far = renderDistance + 8;
camera.updateProjectionMatrix();
camera.rotation.order = "YXZ";
camera.position.set(0, 1.65, 0);
const cameraAssetWeapon = new THREE.Group();
cameraAssetWeapon.position.set(0.34, -0.3, -0.68);
cameraAssetWeapon.rotation.set(-0.1, -0.15, 0.1);
cameraAssetWeapon.visible = false;
camera.add(cameraAssetWeapon);
const cameraFishingRod = createFishingRodModel();
cameraFishingRod.position.set(0.38, -0.32, -0.72);
cameraFishingRod.rotation.set(-0.12, -0.2, 0.42);
cameraFishingRod.visible = false;
camera.add(cameraFishingRod);
const cameraSword = createSwordModel();
cameraSword.position.set(0.38, -0.36, -0.72);
cameraSword.rotation.set(-0.12, -0.2, 0.42);
cameraSword.visible = false;
camera.add(cameraSword);
const cameraFist = new THREE.Group();
const cameraFistSleeve = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.37, 0.22),
  new THREE.MeshLambertMaterial({ color: "#7eaa80" }),
);
cameraFistSleeve.position.y = -0.18;
const cameraFistHand = new THREE.Mesh(
  new THREE.BoxGeometry(0.23, 0.2, 0.24),
  new THREE.MeshLambertMaterial({ color: "#ecd2b4" }),
);
cameraFistHand.position.set(0, -0.43, -0.025);
cameraFist.add(cameraFistSleeve, cameraFistHand);
cameraFist.position.set(0.34, -0.3, -0.68);
cameraFist.rotation.set(-0.2, -0.16, 0.1);
cameraFist.visible = false;
camera.add(cameraFist);
scene.add(camera);
let rendererAvailable = true;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarsePointer ? 0.9 : 1.15));
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
const hemisphereLight = new THREE.HemisphereLight("#e6f5ff", "#566147", 2.1);
scene.add(hemisphereLight);
const sunlight = new THREE.DirectionalLight("#fff1ce", 2.2);
sunlight.position.set(-10, 18, 9);
scene.add(sunlight);
const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(3.2, 16, 12),
  new THREE.MeshBasicMaterial({ color: "#ffd475" }),
);
scene.add(sunMesh);
const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(2.3, 16, 12),
  new THREE.MeshBasicMaterial({ color: "#dce8ff" }),
);
scene.add(moonMesh);
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
const doorGeometry = new THREE.BoxGeometry(1, 1, 1);
const doorTrimMaterial = new THREE.MeshLambertMaterial({ color: "#4b2e1b" });
const doorPanelMaterial = new THREE.MeshLambertMaterial({ color: "#95643a" });
const doorInsetMaterial = new THREE.MeshLambertMaterial({ color: "#bd8a55" });
const doorHandleMaterial = new THREE.MeshLambertMaterial({ color: "#e4bd67" });
const waterSurfaceGeometry = new THREE.PlaneGeometry(1, 1);
const waterSurfaceMaterial = new THREE.MeshLambertMaterial({
  color: "#5ca9c4",
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const blockMeshes = [];
const cityLightSources = [];
const cityInfrastructureMeshes = [];
const remotePlayers = new Map();
const botAvatars = new Map();
const monsterAvatars = new Map();
const animalAvatars = new Map();
const vehicleMeshes = new Map();
const tankShells = [];
const blockBitsGltfSources = import.meta.glob("./assets/Assets/gltf/*.gltf", {
  query: "?raw",
  import: "default",
});
const harborAssetLoader = new GLTFLoader();
const blockBitsBinaryUrls = import.meta.glob("./assets/Assets/gltf/*.bin", {
  query: "?url",
  import: "default",
  eager: true,
});
const kenneyBlasterUrls = import.meta.glob("./assets/kenney-blaster-kit/*.glb", {
  query: "?url",
  import: "default",
  eager: true,
});
const foodPackAssetUrls = import.meta.glob("./assets/new/LowPolyFoodPack/Assets/*.glb", {
  query: "?url",
  import: "default",
  eager: true,
});
const modAssetUrls = {
  ...import.meta.glob("./assets/mods/**/*.glb", {
    query: "?url",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob("./assets/mods/**/*.fbx", {
    query: "?url",
    import: "default",
    eager: true,
  }),
};
const planeTextureUrls = import.meta.glob("./assets/mods/lowPolyPlanePack/**/*.png", {
  query: "?url",
  import: "default",
  eager: true,
});
const placedAssetModels = new Map();
const placedAssetModelLoads = new Map();
const placedAssetModelLoader = new GLTFLoader();
const placedAssetFbxLoader = new FBXLoader();
const modelPreviewImages = new Map();
const modelPreviewLoads = new Map();
let shopPreviewObserver;
const assetModelFiles = new Map(
  Object.keys(blockBitsGltfSources).map((path) => [
    `block-bits/${path.split("/").at(-1).replace(/\.gltf$/, "")}`,
    path,
  ]),
);
for (const path of Object.keys(kenneyBlasterUrls)) {
  assetModelFiles.set(`kenney-blaster-kit/${path.split("/").at(-1)}`, path);
}
for (const path of Object.keys(modAssetUrls)) {
  const fileName = path.split("/").at(-1);
  const assetPrefix = path.includes("/quaternius-furniture/")
    ? "quaternius-furniture"
    : path.includes("/quaternius-medieval-weapons/")
      ? "quaternius-medieval-weapons"
      : fileName.endsWith(".glb")
        ? "mod-car-kit"
        : "mod-low-poly-plane";
  assetModelFiles.set(`${assetPrefix}/${fileName}`, path);
}
for (const path of Object.keys(foodPackAssetUrls)) {
  assetModelFiles.set(`food-pack/${path.split("/").at(-1)}`, path);
}
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
const pendingChunks = new Set();
let chunkGeneration = 0;
const raycaster = new THREE.Raycaster();
const tankRaycaster = new THREE.Raycaster();
const tankRayObjects = [];
const cameraRayOrigin = new THREE.Vector3();
const cameraRaySample = new THREE.Vector3();
const cameraRayOffset = new THREE.Vector3();
const cameraRayRelative = new THREE.Vector3();
const cameraRayEast = new THREE.Vector3();
const cameraRayNorth = new THREE.Vector3();
const center = new THREE.Vector2(0, 0);
const clock = new THREE.Clock();
const moveKeys = new Set();
const joystickVector = new THREE.Vector2();
const gamepadMoveVector = new THREE.Vector2();
const playerPosition = new THREE.Vector3(0, 1.65, 0);
const look = { yaw: 0, pitch: 0 };
const previousGamepadButtons = new Set();
let activeGamepadIndex = null;
let lastChunkX = null;
let lastChunkZ = null;
let gamepadNavigationDirection = 0;
let gamepadNavigationRepeatAt = 0;
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
  playerName: "",
  properties: [],
  lastSentAt: 0,
  lastPickupAt: 0,
  jumpVelocity: 0,
  swimDirection: 0,
  isSwimming: false,
  inventory: new Map(),
  roomAnimals: [],
  roomBots: [],
  roomMonsters: [],
  openDoors: new Set(),
  vehicles: [],
  vehicleId: null,
  vehicleType: null,
  mountId: null,
  sittingAt: null,
  activeFoodShopId: null,
  pendingHotbarItem: null,
  fishingCast: null,
  isFlying: false,
  flyVerticalDirection: 0,
  aircraftAltitudeTarget: null,
  tankTurretDirection: 0,
  tankTurretPitchDirection: 0,
};
let lobbyRoom = null;
let toastTimer;
let worldRenderTimer;
let chunkWorker = null;

function notify(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function updateCamera() {
  const frame = planetFrameAt(playerPosition.x, playerPosition.z);
  const point = planetPointAt(playerPosition.x, playerPosition.y, playerPosition.z);
  const up = new THREE.Vector3(frame.up.x, frame.up.y, frame.up.z);
  const east = new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z);
  const north = new THREE.Vector3(frame.north.x, frame.north.y, frame.north.z);
  const tank = state.vehicleType === "tank"
    ? state.vehicles.find(({ id }) => id === state.vehicleId)
    : null;
  const cameraYaw = tank?.turretYaw ?? look.yaw;
  const cameraPitch = tank?.turretPitch ?? look.pitch;
  const forward = north.multiplyScalar(Math.cos(cameraYaw)).addScaledVector(east, -Math.sin(cameraYaw));
  forward.multiplyScalar(Math.cos(cameraPitch)).addScaledVector(up, Math.sin(cameraPitch));
  camera.up.copy(up);
  if (thirdPersonView || state.vehicleType === "tank") {
    const target = planetPointAt(playerPosition.x, playerPosition.y + 0.2, playerPosition.z);
    if (tank) {
      const hullForward = north.clone()
        .multiplyScalar(Math.cos(tank.yaw))
        .addScaledVector(east, -Math.sin(tank.yaw));
      const levelAimForward = north.clone()
        .multiplyScalar(Math.cos(cameraYaw))
        .addScaledVector(east, -Math.sin(cameraYaw));
      camera.position.set(target.x, target.y, target.z)
        .addScaledVector(hullForward, -5)
        .addScaledVector(up, 2.2);
      camera.lookAt(new THREE.Vector3(target.x, target.y, target.z).addScaledVector(levelAimForward, 10));
    } else {
      camera.position.set(target.x, target.y, target.z)
        .addScaledVector(forward, -4.5)
        .addScaledVector(up, 1.7);
    }
    cameraRayOrigin.set(target.x, target.y, target.z);
    cameraRayOffset.subVectors(camera.position, cameraRayOrigin);
    const cameraDistance = cameraRayOffset.length();
    cameraRayOffset.normalize();
    cameraRayEast.set(frame.east.x, frame.east.y, frame.east.z);
    cameraRayNorth.set(frame.north.x, frame.north.y, frame.north.z);
    for (let distance = 0.2; distance < cameraDistance; distance += 0.15) {
      cameraRaySample.copy(cameraRayOrigin).addScaledVector(cameraRayOffset, distance);
      cameraRayRelative.subVectors(cameraRaySample, cameraRayOrigin);
      const mapPosition = advancePlanetPosition(
        playerPosition.x,
        playerPosition.z,
        cameraRayRelative.dot(cameraRayEast),
        cameraRayRelative.dot(cameraRayNorth),
      );
      const blockY = Math.floor(cameraRaySample.length() - PLANET_RADIUS);
      const block = worldBlocks.get(blockKey(
        Math.round(mapPosition.x),
        blockY,
        Math.round(mapPosition.z),
      ));
      if (block !== undefined && block !== null && block !== "water") {
        camera.position.copy(cameraRayOrigin)
          .addScaledVector(cameraRayOffset, Math.max(0.2, distance - 0.25));
        break;
      }
    }
    if (!tank) camera.lookAt(target.x, target.y, target.z);
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
  const up = new THREE.Vector3(frame.up.x, frame.up.y, frame.up.z);
  const dayPhase = (now % 240_000) / 240_000;
  const solarAngle = dayPhase * Math.PI * 2;
  const daylight = THREE.MathUtils.smoothstep(Math.sin(solarAngle), -0.12, 0.3);
  const night = 1 - daylight;
  const rainPhase = (now % 180_000) / 180_000;
  const raining = rainPhase >= 0.58 && rainPhase < 0.82;
  scene.background.copy(daySkyColor).lerp(nightSkyColor, night);
  scene.fog.color.copy(scene.background);
  hemisphereLight.intensity = 0.35 + daylight * 1.75;
  hemisphereLight.color.set("#e6f5ff").lerp(nightHemisphereColor, night);
  hemisphereLight.groundColor.set("#566147").lerp(nightGroundColor, night);
  sunlight.intensity = 0.08 + daylight * (raining ? 1.1 : 2.12);
  sunlight.color.set("#fff1ce").lerp(nightSunlightColor, night);
  sunMesh.visible = daylight > 0.025;
  moonMesh.visible = night > 0.25;
  rainOverlay.classList.toggle("active", raining);
  weatherHud.textContent = `${night > 0.5 ? "NIGHT" : "DAY"}${raining ? " · RAIN" : ""}`;
  for (const light of cityLightSources) {
    light.intensity = night * (raining ? 2.8 : 2.2);
  }
  const activeVehicle = vehicleMeshes.get(state.vehicleId);
  for (const vehicle of vehicleMeshes.values()) {
    for (const headlight of vehicle.userData.headlights ?? []) {
      headlight.intensity = vehicle === activeVehicle ? night * (raining ? 46 : 38) : 0;
    }
  }
  const sunPosition = planetPointAt(playerPosition.x, playerPosition.y + 43, playerPosition.z);
  sunMesh.position.copy(sunPosition)
    .addScaledVector(north, Math.cos(solarAngle) * 34)
    .addScaledVector(up, Math.sin(solarAngle) * 34);
  sunlight.position.copy(sunMesh.position);
  const moonPosition = planetPointAt(playerPosition.x, playerPosition.y + 43, playerPosition.z);
  moonMesh.position.copy(moonPosition)
    .addScaledVector(north, -Math.cos(solarAngle) * 34)
    .addScaledVector(up, -Math.sin(solarAngle) * 34);
  const orientation = surfaceQuaternionAt(playerPosition.x, playerPosition.z);
  cloudMaterial.opacity = raining ? 0.96 : 0.82;
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
      const point = planetPointAt(x, seabed + 1.05, z);
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
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.26, 0.3), material);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.12), material);
    tail.position.x = -0.38;
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
  updateTankAimCrosshair();
}
window.addEventListener("resize", resize);
resize();

function chunkKey(chunkX, chunkZ) {
  return `${chunkX},${chunkZ}`;
}

function isDoorOpenAt(x, y, z) {
  const doorKey = blockKey(x, y, z);
  return state.openDoors.has(doorKey) || state.openDoors.has(blockKey(x, y - 1, z));
}

function wrapPlanetChunkX(chunkX) {
  const chunkCount = MAX_PLANET_CHUNK_X - MIN_PLANET_CHUNK_X + 1;
  return ((chunkX - MIN_PLANET_CHUNK_X) % chunkCount + chunkCount) % chunkCount + MIN_PLANET_CHUNK_X;
}

function getChunkRenderCandidates(chunk) {
  const candidates = new Set();
  for (const [key, type] of chunk) {
    if (type === "water") {
      const [x, y, z] = key.split(",").map(Number);
      if (worldBlocks.get(blockKey(x, y + 1, z)) !== "water" && chunk.get(blockKey(x, y + 1, z)) !== "water") {
        candidates.add(key);
      }
      continue;
    }
    if (type === "oak_door" || MODEL_ITEM_BY_ID.has(type) || type === "glass") {
      candidates.add(key);
      continue;
    }
    const [x, y, z] = key.split(",").map(Number);
    const hasVisibleFace = [
      [x, y + 1, z],
      [x, y - 1, z],
      [x + 1, y, z],
      [x - 1, y, z],
      [x, y, z + 1],
      [x, y, z - 1],
    ].some(([neighborX, neighborY, neighborZ]) => {
      const neighbor = worldBlocks.get(blockKey(neighborX, neighborY, neighborZ))
        ?? chunk.get(blockKey(neighborX, neighborY, neighborZ));
      return !neighbor || neighbor === "glass" || neighbor === "water";
    });
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const atChunkEdge = localX === 0 || localX === CHUNK_SIZE - 1 ||
      localZ === 0 || localZ === CHUNK_SIZE - 1;
    if (hasVisibleFace || atChunkEdge) candidates.add(key);
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

function commitChunk(chunkX, chunkZ, chunk) {
  chunkX = wrapPlanetChunkX(chunkX);
  if (chunkZ < MIN_PLANET_CHUNK_Z || chunkZ > MAX_PLANET_CHUNK_Z) return;
  const key = chunkKey(chunkX, chunkZ);
  if (loadedChunks.has(key)) return false;
  loadedChunks.set(key, chunk);
  for (const [block, type] of chunk) worldBlocks.set(block, type);
  renderCandidatesByChunk.set(key, getChunkRenderCandidates(chunk));
  if (state.socket?.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify({ type: "chunk", x: chunkX, z: chunkZ }));
  }
  return true;
}

function initializeChunkWorker() {
  if (chunkWorker || typeof Worker === "undefined") return;
  try {
    chunkWorker = new Worker(new URL("./chunk-worker.js", import.meta.url), { type: "module" });
    chunkWorker.addEventListener("message", (event) => {
      const { chunkX, chunkZ, generation, blocks, error } = event.data;
      if (generation !== chunkGeneration) return;
      const key = chunkKey(chunkX, chunkZ);
      pendingChunks.delete(key);
      if (error) {
        console.error(`Unable to generate world chunk ${key}: ${error}`);
        notify("A world region could not be generated.");
        if (
          chunkDistanceFromPlayer(chunkX, chunkZ) <= 2 &&
          commitChunk(chunkX, chunkZ, createChunkBlocks(chunkX, chunkZ, state.seed))
        ) {
          scheduleWorldRender();
        }
        return;
      }
      if (!(blocks instanceof Map)) {
        console.error(`World chunk ${key} returned invalid block data.`);
        notify("A world region could not be generated.");
        if (
          chunkDistanceFromPlayer(chunkX, chunkZ) <= 2 &&
          commitChunk(chunkX, chunkZ, createChunkBlocks(chunkX, chunkZ, state.seed))
        ) {
          scheduleWorldRender();
        }
        return;
      }
      if (chunkDistanceFromPlayer(chunkX, chunkZ) > 2) return;
      if (commitChunk(chunkX, chunkZ, blocks)) scheduleWorldRender();
    });
    chunkWorker.addEventListener("error", (error) => {
      console.error("The world-generation worker failed.", error);
      notify("World generation encountered an error.");
      chunkWorker?.terminate();
      chunkWorker = null;
      const queuedChunks = [...pendingChunks];
      pendingChunks.clear();
      for (const key of queuedChunks) {
        const [chunkX, chunkZ] = key.split(",").map(Number);
        if (chunkDistanceFromPlayer(chunkX, chunkZ) > 2) continue;
        commitChunk(chunkX, chunkZ, createChunkBlocks(chunkX, chunkZ, state.seed));
      }
      scheduleWorldRender();
    });
  } catch (error) {
    console.error("Unable to start the world-generation worker.", error);
    chunkWorker = null;
  }
}

function ensureChunkLoaded(chunkX, chunkZ) {
  chunkX = wrapPlanetChunkX(chunkX);
  if (chunkZ < MIN_PLANET_CHUNK_Z || chunkZ > MAX_PLANET_CHUNK_Z) return false;
  const key = chunkKey(chunkX, chunkZ);
  if (loadedChunks.has(key) || pendingChunks.has(key)) return false;

  initializeChunkWorker();
  if (chunkWorker) {
    pendingChunks.add(key);
    chunkWorker.postMessage({ chunkX, chunkZ, seed: state.seed, generation: chunkGeneration });
    return true;
  }

  return commitChunk(chunkX, chunkZ, createChunkBlocks(chunkX, chunkZ, state.seed));
}

function chunkDistanceFromPlayer(chunkX, chunkZ) {
  if (lastChunkX === null || lastChunkZ === null) return 0;
  const deltaX = Math.abs(wrapPlanetChunkX(chunkX) - wrapPlanetChunkX(lastChunkX));
  const wrappedDeltaX = Math.min(deltaX, MAX_PLANET_CHUNK_X - MIN_PLANET_CHUNK_X + 1 - deltaX);
  return Math.max(wrappedDeltaX, Math.abs(chunkZ - lastChunkZ));
}

function updateChunkWindow(force = false) {
  const chunkX = Math.floor(wrapPlanetX(playerPosition.x) / CHUNK_SIZE);
  const chunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
  if (!force && chunkX === lastChunkX && chunkZ === lastChunkZ) return false;
  lastChunkX = chunkX;
  lastChunkZ = chunkZ;

  const loadRadius = state.vehicleId ? 1 : isCoarsePointer ? 1 : 2;
  const unloadRadius = loadRadius + 1;
  let changed = false;
  let unloaded = false;
  for (const [key, chunk] of loadedChunks) {
    const [loadedX, loadedZ] = key.split(",").map(Number);
    if (chunkDistanceFromPlayer(loadedX, loadedZ) <= unloadRadius) continue;
    for (const block of chunk.keys()) worldBlocks.delete(block);
    loadedChunks.delete(key);
    renderCandidatesByChunk.delete(key);
    changed = true;
    unloaded = true;
  }

  const chunksToLoad = [];
  for (let x = chunkX - loadRadius; x <= chunkX + loadRadius; x += 1) {
    for (let z = chunkZ - loadRadius; z <= chunkZ + loadRadius; z += 1) {
      if (z < MIN_PLANET_CHUNK_Z || z > MAX_PLANET_CHUNK_Z) continue;
      const wrappedX = wrapPlanetChunkX(x);
      if (loadedChunks.has(chunkKey(wrappedX, z)) || pendingChunks.has(chunkKey(wrappedX, z))) continue;
      chunksToLoad.push({ x: wrappedX, z });
    }
  }
  chunksToLoad.sort((a, b) =>
    chunkDistanceFromPlayer(a.x, a.z) - chunkDistanceFromPlayer(b.x, b.z),
  );
  for (const chunk of chunksToLoad) {
    if (ensureChunkLoaded(chunk.x, chunk.z)) changed = true;
  }
  if (!chunkWorker && changed) {
    scheduleWorldRender();
  }
  if (unloaded && chunkWorker) scheduleWorldRender();
  return false;
}

function loadPlacedAssetModel(assetKey) {
  const loaded = placedAssetModels.get(assetKey);
  if (loaded) return Promise.resolve(loaded);
  const pending = placedAssetModelLoads.get(assetKey);
  if (pending) return pending;

  const sourcePath = assetModelFiles.get(assetKey);
  if (!sourcePath) {
    const error = new Error(`Unknown placed asset model: ${assetKey}`);
    console.error(error);
    if (state.connected) notify("That asset model is unavailable.");
    return Promise.resolve(null);
  }

  const loading = (async () => {
    let scene;
    if (assetKey.startsWith("block-bits/")) {
      const loadSource = blockBitsGltfSources[sourcePath];
      const modelName = sourcePath.split("/").at(-1).replace(/\.gltf$/, "");
      const binaryUrl = blockBitsBinaryUrls[`./assets/Assets/gltf/${modelName}.bin`];
      if (!loadSource || typeof binaryUrl !== "string") {
        throw new Error(`The Block Bits files for ${modelName} are incomplete.`);
      }
      const document = JSON.parse(await loadSource());
      if (!Array.isArray(document.buffers) || !Array.isArray(document.images)) {
        throw new Error(`The Block Bits model ${modelName} has missing geometry or texture data.`);
      }
      for (const buffer of document.buffers) buffer.uri = binaryUrl;
      for (const image of document.images) image.uri = blockBitsTextureUrl;
      const gltf = await placedAssetModelLoader.parseAsync(JSON.stringify(document), "");
      scene = gltf.scene;
    } else {
      const url = modAssetUrls[sourcePath] ?? kenneyBlasterUrls[sourcePath] ?? foodPackAssetUrls[sourcePath];
      if (typeof url !== "string") {
        throw new Error(`The model for ${assetKey} is unavailable.`);
      }
      const loader = sourcePath.endsWith(".fbx") ? placedAssetFbxLoader : placedAssetModelLoader;
      const asset = await loader.loadAsync(url);
      scene = asset.scene ?? asset;
      if (sourcePath.includes("/lowPolyPlanePack/")) {
        const fileName = sourcePath.split("/").at(-1).replace(/\.fbx$/i, "");
        const liveryName = {
          basicPlane: "basicPlane.fbm/basicPlaneLivery1.png",
          biPlane: "biPlane.fbm/BiPlaneLivery1.png",
          spaceShuttle: "spaceShuttle.fbm/shuttleBaseColour.png",
          stuntPlane: "stuntPlane.fbm/SPLivery1Diff.png",
        }[fileName];
        const textureUrl = liveryName
          ? planeTextureUrls[`./assets/mods/lowPolyPlanePack/${liveryName}`]
          : null;
        if (typeof textureUrl !== "string") {
          throw new Error(`The livery texture for ${fileName} is unavailable.`);
        }
        const texture = await textureLoader.loadAsync(textureUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
        scene.traverse((part) => {
          if (!part.isMesh) return;
          const hasMaterialArray = Array.isArray(part.material);
          const sourceMaterials = hasMaterialArray ? part.material : [part.material];
          const texturedMaterials = sourceMaterials.map((sourceMaterial) => {
            const material = sourceMaterial.clone();
            material.map = texture;
            material.color.set("#ffffff");
            material.needsUpdate = true;
            return material;
          });
          part.material = hasMaterialArray ? texturedMaterials : texturedMaterials[0];
        });
      }
    }

    if (assetKey.startsWith("quaternius-furniture/") || assetKey.startsWith("quaternius-medieval-weapons/")) {
      await repairImportedFbxMaterials(scene);
    }

    placedAssetModels.set(assetKey, scene);
    scheduleWorldRender();
    return scene;
  })().catch((error) => {
    console.error(`Unable to load placed asset model "${assetKey}".`, error);
    const itemName = MODEL_CATALOG.find((item) => item.assetKey === assetKey)?.name ?? "asset";
    if (state.connected) notify(`The ${itemName} model couldn't load.`);
    return null;
  }).finally(() => {
    placedAssetModelLoads.delete(assetKey);
  });
  placedAssetModelLoads.set(assetKey, loading);
  return loading;
}

function createPlacedAssetModel(model, x, y, z, preview = false) {
  const assetScene = placedAssetModels.get(model.assetKey);
  if (!assetScene) {
    void loadPlacedAssetModel(model.assetKey);
    return null;
  }

  const instance = assetScene.clone(true);
  instance.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(instance);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (preview) {
    const scale = 0.9 / Math.max(size.x, size.y, size.z, 0.01);
    instance.scale.setScalar(scale);
    instance.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    const group = new THREE.Group();
    group.add(instance);
    return group;
  }
  const maximumHorizontalSize = Math.max(size.x, size.z, 0.01);
  const scale = Math.min(0.85 / maximumHorizontalSize, 1.8 / Math.max(size.y, 0.01));
  instance.scale.setScalar(scale);
  instance.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);

  const group = new THREE.Group();
  group.add(instance);
  const frame = planetFrameAt(x, z);
  const point = planetPointAt(x, y + 1, z);
  const orientation = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z),
    new THREE.Vector3(frame.up.x, frame.up.y, frame.up.z),
    new THREE.Vector3(-frame.north.x, -frame.north.y, -frame.north.z),
  );
  group.position.set(point.x, point.y, point.z);
  group.quaternion.setFromRotationMatrix(orientation);
  group.userData.sharedAssetModel = true;
  instance.traverse((part) => {
    if (!part.isMesh) return;
    part.userData.blockCoordinates = [x, y, z];
    modelTargetMeshes.push(part);
  });
  scene.add(group);
  modelPlacementMeshes.push(group);
  return group;
}

function setHeldAssetModel(container, assetKey) {
  if (container.userData.assetKey === assetKey) return;
  container.userData.assetKey = assetKey;
  container.clear();
  void loadPlacedAssetModel(assetKey).then((assetScene) => {
    if (!assetScene || container.userData.assetKey !== assetKey) return;
    const instance = assetScene.clone(true);
    instance.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(instance);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 0.55 / Math.max(size.x, size.y, size.z, 0.01);
    instance.scale.setScalar(scale);
    instance.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    container.add(instance);
  });
}

function updateHeldAssetVisibility() {
  const selectedModel = MODEL_ITEM_BY_ID.get(state.selected);
  const assetKey = selectedModel?.category === "weapon" && selectedModel.assetKey
    ? selectedModel.assetKey
    : null;
  const isHeld = Boolean(assetKey && (state.inventory.get(state.selected) ?? 0) > 0);
  cameraAssetWeapon.visible = Boolean(isHeld && !thirdPersonView);
  if (assetKey) setHeldAssetModel(cameraAssetWeapon, assetKey);
  if (selfAvatar?.userData.assetWeapon) {
    selfAvatar.userData.assetWeapon.visible = Boolean(isHeld && thirdPersonView);
    if (assetKey) setHeldAssetModel(selfAvatar.userData.assetWeapon, assetKey);
  }
}

function updateHeldWeaponVisibility() {
  const isSword = ["wooden_sword", "stone_sword", "iron_sword", "steel_sword"].includes(state.selected);
  const selectedModel = MODEL_ITEM_BY_ID.get(state.selected);
  const hasAssetWeapon = selectedModel?.category === "weapon"
    && Boolean(selectedModel.assetKey)
    && (state.inventory.get(state.selected) ?? 0) > 0;
  cameraSword.visible = isSword && !thirdPersonView;
  cameraFist.visible = !isSword && !hasAssetWeapon && !thirdPersonView && state.connected && !state.vehicleId;
  if (selfAvatar?.userData.sword) {
    selfAvatar.userData.sword.visible = isSword && thirdPersonView;
    if (isSword) {
      const color = state.selected === "wooden_sword" ? "#8a5b32"
        : state.selected === "stone_sword" ? "#9da4a9"
          : state.selected === "iron_sword" ? "#d2dde0" : "#8ce1e3";
      selfAvatar.userData.sword.userData.blade.material.color.set(color);
    }
  }
  if (isSword) {
    const color = state.selected === "wooden_sword" ? "#8a5b32"
      : state.selected === "stone_sword" ? "#9da4a9"
        : state.selected === "iron_sword" ? "#d2dde0" : "#8ce1e3";
    cameraSword.userData.blade.material.color.set(color);
  }
}

function createPlacedModel(model, x, y, z, preview = false) {
  if (model.assetKey) return createPlacedAssetModel(model, x, y, z, preview);

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
    group.add(mesh);
    if (!preview) {
      mesh.userData.blockCoordinates = [x, y, z];
      modelTargetMeshes.push(mesh);
    }
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

  if (preview) return group;

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

function renderPublicBuildingFurniture(renderDistance, longitudeScale) {
  const addFurniture = (x, floorY, z, kind) => {
    let deltaX = wrapPlanetX(x - playerPosition.x);
    if (deltaX > PLANET_LONGITUDE_BLOCKS / 2) deltaX -= PLANET_LONGITUDE_BLOCKS;
    if (Math.hypot(deltaX * longitudeScale, z - playerPosition.z) > renderDistance) return;

    const group = new THREE.Group();
    const addPart = (color, position, dimensions) => {
      const part = new THREE.Mesh(
        new THREE.BoxGeometry(...dimensions),
        new THREE.MeshLambertMaterial({ color }),
      );
      part.position.set(...position);
      group.add(part);
    };
    if (kind === "bed") {
      addPart("#553b2a", [0, 0.14, 0], [1.18, 0.2, 0.78]);
      addPart("#e2d5bd", [0, 0.36, 0], [1.08, 0.24, 0.7]);
      addPart("#9d4650", [0, 0.5, 0.17], [1.02, 0.08, 0.4]);
      addPart("#f4ead5", [0, 0.53, -0.23], [0.46, 0.12, 0.38]);
    } else {
      const topColor = kind === "workbench" ? "#82532f" : "#9a7046";
      addPart(topColor, [0, 0.76, 0], [1.12, 0.16, 0.76]);
      for (const xSide of [-0.43, 0.43]) {
        for (const zSide of [-0.27, 0.27]) {
          addPart("#503823", [xSide, 0.39, zSide], [0.1, 0.74, 0.1]);
        }
      }
      if (kind === "workbench") {
        addPart("#aab2b3", [-0.2, 0.91, 0], [0.1, 0.14, 0.1]);
        addPart("#d3a94f", [0.16, 0.9, 0.08], [0.34, 0.08, 0.08]);
      } else {
        for (const zSide of [-0.58, 0.58]) {
          addPart("#704a2d", [0, 0.43, zSide], [0.64, 0.12, 0.38]);
          addPart("#503823", [0, 0.22, zSide + (zSide < 0 ? -0.12 : 0.12)], [0.56, 0.42, 0.08]);
        }
      }
    }

    const frame = planetFrameAt(x, z);
    const point = planetPointAt(x, floorY, z);
    const orientation = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z),
      new THREE.Vector3(frame.up.x, frame.up.y, frame.up.z),
      new THREE.Vector3(-frame.north.x, -frame.north.y, -frame.north.z),
    );
    group.position.set(point.x, point.y, point.z);
    group.quaternion.setFromRotationMatrix(orientation);
    const blockRadius = PLANET_RADIUS + floorY;
    group.scale.set(
      Math.max(0.05, 2 * Math.cos(frame.latitude) * blockRadius * Math.tan(Math.PI / PLANET_LONGITUDE_BLOCKS)),
      1,
      2 * blockRadius * Math.tan(Math.PI / (2 * PLANET_LATITUDE_BLOCKS)),
    );
    scene.add(group);
    modelPlacementMeshes.push(group);
  };

  addFurniture(4, 1, 4, "bed");
  addFurniture(6, 1, 5, "table");
  for (const location of WORLD_LOCATIONS) {
    if (location.id === "boat-workshop") {
      addFurniture(8, 1, 131, "workbench");
      addFurniture(15, 1, 131, "workbench");
      continue;
    }
    if (location.type !== "village") continue;
    if (location.id !== "village" && ![
      "ember-village", "storm-village", "verdant-village", "frost-village",
    ].includes(location.id)) continue;
    if (location.id === "village") continue;
    const floorY = terrainHeightAt(location.x, location.z, state.seed) + 2;
    addFurniture(location.x - 6, floorY, location.z - 5, "bed");
    addFurniture(location.x + 6, floorY, location.z - 5, "table");
  }
}

function renderWorld() {
  const activeRenderDistance = state.vehicleId ? Math.min(renderDistance, 32) : renderDistance;
  const cityGeometries = new Set();
  const cityMaterials = new Set();
  const cityTextures = new Set();
  for (const mesh of cityInfrastructureMeshes) {
    scene.remove(mesh);
    mesh.traverse((part) => {
      if (part.geometry) cityGeometries.add(part.geometry);
      if (Array.isArray(part.material)) {
        part.material.forEach((material) => cityMaterials.add(material));
      } else if (part.material) {
        cityMaterials.add(part.material);
      }
    });
  }
  for (const material of cityMaterials) {
    if (material.map) cityTextures.add(material.map);
    material.dispose();
  }
  for (const geometry of cityGeometries) geometry.dispose();
  for (const texture of cityTextures) texture.dispose();
  cityInfrastructureMeshes.length = 0;
  cityLightSources.length = 0;
  for (const sign of cityShopSigns) {
    scene.remove(sign);
    sign.traverse((part) => {
      part.geometry?.dispose();
      if (Array.isArray(part.material)) {
        for (const material of part.material) {
          material.map?.dispose();
          material.dispose();
        }
      } else if (part.material) {
        part.material.map?.dispose();
        part.material.dispose();
      }
    });
  }
  cityShopSigns.length = 0;
  for (const mesh of blockMeshes) {
    scene.remove(mesh);
  }
  blockMeshes.length = 0;
  for (const model of modelPlacementMeshes) {
    scene.remove(model);
    if (model.userData.sharedAssetModel) continue;
    model.traverse((part) => {
      part.geometry?.dispose();
      if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose());
      else part.material?.dispose();
    });
  }
  modelPlacementMeshes.length = 0;
  modelTargetMeshes.length = 0;

  const grouped = new Map();
  const doorCoordinates = [];
  const waterSurfaceCoordinates = [];
  const placedModels = [];
  const latitude = (playerPosition.z - PLANET_MIN_Z + 0.5) / PLANET_LATITUDE_BLOCKS * Math.PI - Math.PI / 2;
  const longitudeScale = Math.max(0.1, Math.cos(latitude));
  for (const [chunkKey, candidates] of renderCandidatesByChunk) {
    for (const key of candidates) {
      const type = worldBlocks.get(key);
      const model = MODEL_ITEM_BY_ID.get(type);
      if (!model && !materials.has(type)) continue;
      const [x, y, z] = key.split(",").map(Number);
      let deltaX = wrapPlanetX(x - playerPosition.x);
      if (deltaX > PLANET_LONGITUDE_BLOCKS / 2) deltaX -= PLANET_LONGITUDE_BLOCKS;
      const mapDistance = Math.hypot(deltaX * longitudeScale, z - playerPosition.z);
      if (mapDistance > activeRenderDistance) continue;
      if (model) {
        placedModels.push([model, x, y, z]);
        continue;
      }
      if (type === "oak_door") {
        doorCoordinates.push([x, y, z]);
        continue;
      }
      if (type === "water") {
        if (worldBlocks.get(blockKey(x, y + 1, z)) !== "water") {
          waterSurfaceCoordinates.push([x, y, z]);
        }
        continue;
      }
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
  const north = new THREE.Vector3();
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
  for (const [x, y, z] of doorCoordinates) {
    if (worldBlocks.get(blockKey(x, y - 1, z)) === "oak_door") continue;
    const height = worldBlocks.get(blockKey(x, y + 1, z)) === "oak_door" ? 2 : 1;
    const frame = planetFrameAt(x, z);
    const worldPoint = planetPointAt(x, y + height / 2, z);
    const point = new THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z);
    const outward = new THREE.Vector3(-frame.north.x, -frame.north.y, -frame.north.z);
    point.addScaledVector(outward, 0.07);
    east.set(frame.east.x, frame.east.y, frame.east.z);
    up.set(frame.up.x, frame.up.y, frame.up.z);
    westNorth.set(-frame.north.x, -frame.north.y, -frame.north.z);
    basis.makeBasis(east, up, westNorth);
    orientation.setFromRotationMatrix(basis);
    const blockRadius = PLANET_RADIUS + y + height / 2;
    scale.set(
      Math.max(0.05, 2 * Math.cos(frame.latitude) * blockRadius * Math.tan(Math.PI / PLANET_LONGITUDE_BLOCKS)),
      1,
      2 * blockRadius * Math.tan(Math.PI / (2 * PLANET_LATITUDE_BLOCKS)),
    );
    const door = new THREE.Group();
    door.rotation.y = isDoorOpenAt(x, y, z) ? Math.PI / 2 : 0;
    door.position.copy(point);
    door.quaternion.copy(orientation);
    door.scale.copy(scale);
    const addDoorPart = (material, position, dimensions) => {
      const part = new THREE.Mesh(doorGeometry, material);
      part.position.set(...position);
      part.scale.set(...dimensions);
      part.userData.blockType = "oak_door";
      part.userData.blockCoordinates = [x, y + (height === 2 && position[1] > 0 ? 1 : 0), z];
      door.add(part);
      blockMeshes.push(part);
    };
    const panelHeight = height === 2 ? 1.82 : 0.86;
    addDoorPart(doorTrimMaterial, [-0.43, 0, 0], [0.09, height * 0.96, 0.12]);
    addDoorPart(doorTrimMaterial, [0.43, 0, 0], [0.09, height * 0.96, 0.12]);
    addDoorPart(doorTrimMaterial, [0, height * 0.46, 0], [0.95, 0.1, 0.12]);
    addDoorPart(doorPanelMaterial, [0, 0, 0], [0.76, panelHeight, 0.09]);
    if (height === 2) {
      addDoorPart(doorInsetMaterial, [-0.2, 0.43, 0.052], [0.27, 0.58, 0.018]);
      addDoorPart(doorInsetMaterial, [0.2, 0.43, 0.052], [0.27, 0.58, 0.018]);
      addDoorPart(doorInsetMaterial, [-0.2, -0.42, 0.052], [0.27, 0.58, 0.018]);
      addDoorPart(doorInsetMaterial, [0.2, -0.42, 0.052], [0.27, 0.58, 0.018]);
    }
    addDoorPart(doorHandleMaterial, [0.26, 0, 0.11], [0.055, 0.12, 0.06]);
    scene.add(door);
    blockMeshes.push(door);
  }
  renderPublicBuildingFurniture(activeRenderDistance, longitudeScale);
  if (waterSurfaceCoordinates.length > 0) {
    const waterMesh = new THREE.InstancedMesh(
      waterSurfaceGeometry,
      waterSurfaceMaterial,
      waterSurfaceCoordinates.length,
    );
    waterMesh.userData.coordinates = waterSurfaceCoordinates;
    waterMesh.userData.blockType = "water";
    for (let index = 0; index < waterSurfaceCoordinates.length; index += 1) {
      const [x, y, z] = waterSurfaceCoordinates[index];
      const frame = planetFrameAt(x, z);
      const blockRadius = PLANET_RADIUS + y + 1;
      east.set(frame.east.x, frame.east.y, frame.east.z);
      north.set(frame.north.x, frame.north.y, frame.north.z);
      up.set(frame.up.x, frame.up.y, frame.up.z);
      basis.makeBasis(east, north, up);
      orientation.setFromRotationMatrix(basis);
      matrix.position.copy(planetPointAt(x, y + 1.006, z));
      matrix.quaternion.copy(orientation);
      matrix.scale.set(
        Math.max(0.05, 2 * Math.cos(frame.latitude) * blockRadius * Math.tan(Math.PI / PLANET_LONGITUDE_BLOCKS)),
        2 * blockRadius * Math.tan(Math.PI / (2 * PLANET_LATITUDE_BLOCKS)),
        1,
      );
      matrix.updateMatrix();
      waterMesh.setMatrixAt(index, matrix.matrix);
    }
    scene.add(waterMesh);
    blockMeshes.push(waterMesh);
  }
  for (const [model, x, y, z] of placedModels) createPlacedModel(model, x, y, z);
  for (const shop of listCityShops(state.seed)) {
    let deltaX = wrapPlanetX(shop.x - playerPosition.x);
    if (deltaX > PLANET_LONGITUDE_BLOCKS / 2) deltaX -= PLANET_LONGITUDE_BLOCKS;
    if (Math.hypot(deltaX * longitudeScale, shop.z - playerPosition.z) > activeRenderDistance) continue;
    const signCanvas = document.createElement("canvas");
    signCanvas.width = 384;
    signCanvas.height = 128;
    const context = signCanvas.getContext("2d");
    context.fillStyle = "#302a25";
    context.roundRect(4, 4, 376, 120, 20);
    context.fill();
    context.strokeStyle = "#e2b968";
    context.lineWidth = 8;
    context.roundRect(12, 12, 360, 104, 14);
    context.stroke();
    context.fillStyle = "#f2d794";
    context.font = "bold 42px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(shop.name, 192, 51, 330);
    context.fillStyle = "#f5eee0";
    context.font = "bold 19px system-ui, sans-serif";
    context.fillText(
      shop.bakery ? "FRESH BREAD  ·  E TO TALK" : shop.foodShop ? "DINING  ·  E TO TALK" : "OPEN DAILY  ·  CITY MARKET",
      192,
      91,
    );
    const texture = new THREE.CanvasTexture(signCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Group();
    const frameMaterial = new THREE.MeshLambertMaterial({ color: "#302a25" });
    const bracketMaterial = new THREE.MeshLambertMaterial({ color: "#b88a42" });
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.7, 1.2, 0.16), frameMaterial);
    board.position.z = 0.05;
    sign.add(board);
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(3.48, 0.98), new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    }));
    signFace.position.z = 0.14;
    sign.add(signFace);
    for (const side of [-1, 1]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.1), bracketMaterial);
      bracket.position.set(side * 1.35, 0.28, -0.5);
      sign.add(bracket);
    }
    const point = planetPointAt(shop.x, shop.y, shop.z);
    sign.position.set(point.x, point.y, point.z);
    sign.quaternion.copy(surfaceQuaternionAt(shop.x, shop.z));
    scene.add(sign);
    cityShopSigns.push(sign);
  }
  const addCityFixture = (group, x, y, z) => {
    let deltaX = wrapPlanetX(x - playerPosition.x);
    if (deltaX > PLANET_LONGITUDE_BLOCKS / 2) deltaX -= PLANET_LONGITUDE_BLOCKS;
    if (Math.hypot(deltaX * longitudeScale, z - playerPosition.z) > activeRenderDistance + 10) return false;
    const frame = planetFrameAt(x, z);
    const point = planetPointAt(x, y, z);
    const orientation = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z),
      new THREE.Vector3(frame.up.x, frame.up.y, frame.up.z),
      new THREE.Vector3(-frame.north.x, -frame.north.y, -frame.north.z),
    );
    group.position.copy(point);
    group.quaternion.setFromRotationMatrix(orientation);
    const blockRadius = PLANET_RADIUS + y;
    group.scale.set(
      Math.max(0.05, 2 * Math.cos(frame.latitude) * blockRadius * Math.tan(Math.PI / PLANET_LONGITUDE_BLOCKS)),
      1,
      2 * blockRadius * Math.tan(Math.PI / (2 * PLANET_LATITUDE_BLOCKS)),
    );
    scene.add(group);
    cityInfrastructureMeshes.push(group);
    return true;
  };
  const isCityFixtureNearby = (x, z) => {
    let deltaX = wrapPlanetX(x - playerPosition.x);
    if (deltaX > PLANET_LONGITUDE_BLOCKS / 2) deltaX -= PLANET_LONGITUDE_BLOCKS;
    return Math.hypot(deltaX * longitudeScale, z - playerPosition.z) <= activeRenderDistance + 10;
  };
  const awningCanvas = document.createElement("canvas");
  awningCanvas.width = 64;
  awningCanvas.height = 32;
  const awningContext = awningCanvas.getContext("2d");
  awningContext.fillStyle = "#f2dfbe";
  awningContext.fillRect(0, 0, 64, 32);
  awningContext.fillStyle = "#bd5147";
  for (let x = 0; x < 64; x += 16) awningContext.fillRect(x, 0, 8, 32);
  const awningTexture = new THREE.CanvasTexture(awningCanvas);
  awningTexture.colorSpace = THREE.SRGBColorSpace;
  const diningMaterials = [
    new THREE.MeshLambertMaterial({ color: "#8a5838" }),
    new THREE.MeshLambertMaterial({ color: "#b8875e" }),
    new THREE.MeshLambertMaterial({ map: awningTexture, side: THREE.DoubleSide }),
  ];
  const diningGeometries = {
    tabletop: new THREE.BoxGeometry(1.8, 0.14, 1.2),
    tableLeg: new THREE.CylinderGeometry(0.07, 0.09, 0.76, 6),
    bench: new THREE.BoxGeometry(1.35, 0.16, 0.42),
    benchLeg: new THREE.BoxGeometry(0.12, 0.45, 0.12),
    parasolPole: new THREE.CylinderGeometry(0.035, 0.05, 2.5, 6),
    parasolTop: new THREE.ConeGeometry(1.12, 0.48, 8),
  };
  for (const restaurant of listCityShops(state.seed).filter(({ foodShop }) => foodShop)) {
    if (!isCityFixtureNearby(restaurant.x, restaurant.z - 4)) continue;
    const seating = new THREE.Group();
    const addDiningPart = (geometry, material, x, y, z) => {
      const part = new THREE.Mesh(geometry, material);
      part.position.set(x, y, z);
      seating.add(part);
    };
    addDiningPart(diningGeometries.tabletop, diningMaterials[0], 0, 0.86, 0);
    for (const x of [-0.68, 0.68]) {
      for (const z of [-0.42, 0.42]) addDiningPart(diningGeometries.tableLeg, diningMaterials[0], x, 0.43, z);
    }
    for (const z of [-1.05, 1.05]) {
      addDiningPart(diningGeometries.bench, diningMaterials[1], 0, 0.5, z);
      for (const x of [-0.52, 0.52]) addDiningPart(diningGeometries.benchLeg, diningMaterials[0], x, 0.23, z);
    }
    addDiningPart(diningGeometries.parasolPole, diningMaterials[0], 0, 2.05, 0);
    addDiningPart(diningGeometries.parasolTop, diningMaterials[2], 0, 3.42, 0);
    addCityFixture(seating, restaurant.x, terrainHeightAt(restaurant.x, restaurant.z, state.seed), restaurant.z - 4);

    const interior = new THREE.Group();
    const addInteriorPart = (geometry, material, x, y, z) => {
      const part = new THREE.Mesh(geometry, material);
      part.position.set(x, y, z);
      interior.add(part);
    };
    const chairSeat = new THREE.BoxGeometry(0.78, 0.16, 0.78);
    const chairLeg = new THREE.BoxGeometry(0.11, 0.46, 0.11);
    const chairBack = new THREE.BoxGeometry(0.78, 0.76, 0.13);
    const plate = new THREE.CylinderGeometry(0.28, 0.25, 0.055, 12);
    const foodBowl = new THREE.SphereGeometry(0.2, 10, 7);
    const dishMaterial = new THREE.MeshLambertMaterial({ color: "#e8dfc9" });
    const mealMaterial = new THREE.MeshLambertMaterial({ color: restaurant.bakery ? "#c98e48" : "#d79e4c" });
    addInteriorPart(diningGeometries.tabletop, diningMaterials[0], 0, 0.86, 0);
    for (const x of [-0.68, 0.68]) {
      for (const z of [-0.42, 0.42]) addInteriorPart(diningGeometries.tableLeg, diningMaterials[0], x, 0.43, z);
    }
    for (const x of [-1.55, 1.55]) {
      addInteriorPart(chairSeat, diningMaterials[1], x, 0.49, 1.12);
      addInteriorPart(chairBack, diningMaterials[0], x, 0.88, 1.44);
      for (const z of [0.84, 1.4]) {
        addInteriorPart(chairLeg, diningMaterials[0], x - 0.28, 0.23, z);
        addInteriorPart(chairLeg, diningMaterials[0], x + 0.28, 0.23, z);
      }
    }
    addInteriorPart(plate, dishMaterial, -0.42, 0.96, 0);
    addInteriorPart(foodBowl, mealMaterial, -0.42, 1.08, 0);
    addInteriorPart(plate, dishMaterial, 0.42, 0.96, 0);
    addInteriorPart(foodBowl, mealMaterial, 0.42, 1.08, 0);
    addInteriorPart(new THREE.BoxGeometry(3.2, 0.84, 0.72), diningMaterials[0], 0, 0.42, 3.1);
    addInteriorPart(new THREE.BoxGeometry(3.35, 0.14, 0.82), diningMaterials[1], 0, 0.92, 3.1);
    addCityFixture(
      interior,
      restaurant.x,
      terrainHeightAt(restaurant.x, restaurant.interiorZ, state.seed),
      restaurant.interiorZ,
    );
  }
  const streetLampPole = new THREE.MeshLambertMaterial({ color: "#343d46" });
  const streetLampGlow = new THREE.MeshBasicMaterial({ color: "#ffe8a0" });
  const streetLampPoleGeometry = new THREE.CylinderGeometry(0.08, 0.13, 4.2, 7);
  const streetLampArmGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.8);
  const streetLampFixtureGeometry = new THREE.BoxGeometry(0.48, 0.16, 0.4);
  const addStreetLamp = (x, z) => {
    if (!isCityFixtureNearby(x, z)) return;
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(streetLampPoleGeometry, streetLampPole);
    pole.position.y = 2.1;
    lamp.add(pole);
    const arm = new THREE.Mesh(streetLampArmGeometry, streetLampPole);
    arm.position.set(0.2, 4.05, 0);
    lamp.add(arm);
    const fixture = new THREE.Mesh(streetLampFixtureGeometry, streetLampGlow);
    fixture.position.set(0.42, 3.93, 0);
    lamp.add(fixture);
    if (cityLightSources.length < 4) {
      const bulb = new THREE.PointLight("#ffd987", 0, 15, 2);
      bulb.position.set(0.42, 3.78, 0);
      lamp.add(bulb);
      if (addCityFixture(lamp, x, terrainHeightAt(x, z, state.seed), z)) cityLightSources.push(bulb);
      return;
    }
    addCityFixture(lamp, x, terrainHeightAt(x, z, state.seed), z);
  };
  const streetLampPositions = new Set();
  for (let street = -4; street <= 4; street += 1) {
    for (const side of [-1, 1]) {
      const streetX = street * CITY_BLOCK_SIZE + side * 11;
      const streetZ = street * CITY_BLOCK_SIZE + side * 11;
      for (let alongStreet = -108; alongStreet <= 108; alongStreet += 24) {
        if (Math.hypot(streetX, alongStreet) <= CITY_RADIUS) {
          streetLampPositions.add(`${streetX},${alongStreet}`);
        }
        if (Math.hypot(alongStreet, streetZ) <= CITY_RADIUS) {
          streetLampPositions.add(`${alongStreet},${streetZ}`);
        }
      }
    }
  }
  for (const position of [...streetLampPositions]
    .map((value) => value.split(",").map(Number))
    .sort((left, right) => Math.hypot(left[0] - playerPosition.x, left[1] - playerPosition.z)
      - Math.hypot(right[0] - playerPosition.x, right[1] - playerPosition.z))) {
    const [x, z] = position;
    addStreetLamp(x, z);
  }
  for (const x of [-22, 22]) {
    for (const z of [110, 122, 134]) addStreetLamp(x, z);
  }
  const stationX = CITY_POLICE_STATION.x;
  const stationZ = CITY_POLICE_STATION.z;
  let stationDeltaX = wrapPlanetX(stationX - playerPosition.x);
  if (stationDeltaX > PLANET_LONGITUDE_BLOCKS / 2) stationDeltaX -= PLANET_LONGITUDE_BLOCKS;
  if (Math.hypot(stationDeltaX * longitudeScale, stationZ - playerPosition.z) <= activeRenderDistance + 10) {
    const stationSignCanvas = document.createElement("canvas");
    stationSignCanvas.width = 512;
    stationSignCanvas.height = 128;
    const stationSignContext = stationSignCanvas.getContext("2d");
    stationSignContext.fillStyle = "#143568";
    stationSignContext.fillRect(0, 0, 512, 128);
    stationSignContext.fillStyle = "#dbe8ff";
    stationSignContext.font = "bold 58px system-ui, sans-serif";
    stationSignContext.textAlign = "center";
    stationSignContext.textBaseline = "middle";
    stationSignContext.fillText("POLICE", 256, 66);
    stationSignContext.fillStyle = "#d64e52";
    stationSignContext.fillRect(0, 0, 512, 12);
    stationSignContext.fillStyle = "#568ce2";
    stationSignContext.fillRect(0, 116, 512, 12);
    const stationSignTexture = new THREE.CanvasTexture(stationSignCanvas);
    stationSignTexture.colorSpace = THREE.SRGBColorSpace;
    const stationSign = new THREE.Group();
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 1.35, 0.16),
      new THREE.MeshLambertMaterial({ color: "#172b48" }),
    );
    stationSign.add(signBoard);
    const signFace = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 1.15),
      new THREE.MeshBasicMaterial({ map: stationSignTexture, toneMapped: false }),
    );
    signFace.position.z = 0.09;
    stationSign.add(signFace);
    addCityFixture(stationSign, stationX, 4.8, stationZ - 8.15);
    const entranceLamps = new THREE.Group();
    for (const side of [-1, 1]) {
      const entranceLight = new THREE.PointLight("#9dbfff", 0, 11, 2);
      entranceLight.position.set(side * 4.4, 4.2, 0);
      entranceLamps.add(entranceLight);
      cityLightSources.push(entranceLight);
    }
    addCityFixture(entranceLamps, stationX, 0, stationZ - 8.7);
  }
}

function scheduleWorldRender() {
  if (worldRenderTimer !== undefined) return;
  worldRenderTimer = window.setTimeout(() => {
    worldRenderTimer = undefined;
    renderWorld();
  }, state.vehicleId ? 400 : 100);
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

function createFishingRodModel() {
  const group = new THREE.Group();
  const rodMaterial = new THREE.MeshLambertMaterial({ color: "#a87543" });
  const gripMaterial = new THREE.MeshLambertMaterial({ color: "#45342b" });
  const metalMaterial = new THREE.MeshLambertMaterial({ color: "#c8d0d3" });
  const bobberMaterial = new THREE.MeshLambertMaterial({ color: "#d65d43" });
  const addCylinder = (radiusTop, radiusBottom, height, material, position) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 7),
      material,
    );
    mesh.position.set(...position);
    group.add(mesh);
    return mesh;
  };
  const handle = addCylinder(0.035, 0.045, 0.24, gripMaterial, [0, 0.12, 0]);
  handle.rotation.z = 0.18;
  const shaft = addCylinder(0.008, 0.024, 0.76, rodMaterial, [-0.09, 0.57, 0]);
  shaft.rotation.z = 0.2;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.035, 10), metalMaterial);
  reel.position.set(0.025, 0.28, 0.025);
  reel.rotation.x = Math.PI / 2;
  group.add(reel);
  const reelHandle = addCylinder(0.012, 0.012, 0.12, metalMaterial, [0.11, 0.28, 0.02]);
  reelHandle.rotation.z = Math.PI / 2;
  const linePoints = [
    new THREE.Vector3(-0.17, 0.94, 0),
    new THREE.Vector3(-0.19, 0.61, -0.035),
    new THREE.Vector3(-0.08, 0.36, -0.035),
  ];
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(linePoints),
    new THREE.LineBasicMaterial({ color: "#eee8d6" }),
  );
  group.add(line);
  const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), bobberMaterial);
  bobber.position.copy(linePoints[2]);
  group.add(bobber);
  return group;
}

function createSwordModel() {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, 0.68, 0.045),
    new THREE.MeshLambertMaterial({ color: "#d2dde0" }),
  );
  blade.position.y = 0.48;
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.07, 0.1),
    new THREE.MeshLambertMaterial({ color: "#c19b4b" }),
  );
  guard.position.y = 0.12;
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.26, 0.09),
    new THREE.MeshLambertMaterial({ color: "#65452e" }),
  );
  handle.position.y = -0.04;
  const pommel = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.08, 0.11),
    new THREE.MeshLambertMaterial({ color: "#c19b4b" }),
  );
  pommel.position.y = -0.2;
  group.add(blade, guard, handle, pommel);
  group.userData.blade = blade;
  group.scale.setScalar(0.72);
  return group;
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
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
  const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
  const leftBoot = new THREE.Mesh(bootGeometry, bootMaterial);
  const rightBoot = new THREE.Mesh(bootGeometry, bootMaterial);
  const armorMaterial = new THREE.MeshLambertMaterial({ color: "#9caeb6" });
  const helmetMaterial = new THREE.MeshLambertMaterial({ color: "#d1b46d" });
  const bodyArmor = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.58, 0.37), armorMaterial);
  bodyArmor.position.y = 0.8;
  bodyArmor.visible = false;
  const headArmor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.48), helmetMaterial);
  headArmor.position.y = 1.55;
  headArmor.visible = false;
  const healthBar = avatarHealthBar(entity.health);
  leftArm.position.set(-0.32, 1.05, 0);
  rightArm.position.set(0.32, 1.05, 0);
  const leftArmMesh = new THREE.Mesh(armGeometry, bodyMaterial);
  const rightArmMesh = new THREE.Mesh(armGeometry, bodyMaterial);
  leftArmMesh.position.y = -0.275;
  rightArmMesh.position.y = -0.275;
  leftArm.add(leftArmMesh);
  rightArm.add(rightArmMesh);
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
    bodyArmor,
    headArmor,
    healthBar,
  );
  group.userData.bodyArmor = bodyArmor;
  group.userData.headArmor = headArmor;
  if (!isBot && entity.id === state.id) {
    const fishingRod = createFishingRodModel();
    fishingRod.position.set(0.04, -0.33, -0.18);
    fishingRod.rotation.z = 0.45;
    fishingRod.scale.setScalar(0.68);
    fishingRod.visible = state.selected === "fishing_rod" && thirdPersonView;
    rightArm.add(fishingRod);
    group.userData.fishingRod = fishingRod;
    const assetWeapon = new THREE.Group();
    assetWeapon.position.set(0.02, -0.37, -0.28);
    assetWeapon.rotation.set(0, Math.PI, 0.35);
    assetWeapon.visible = false;
    rightArm.add(assetWeapon);
    group.userData.assetWeapon = assetWeapon;
    const sword = createSwordModel();
    sword.position.set(0.04, -0.38, -0.2);
    sword.rotation.set(-0.1, Math.PI, 0.25);
    sword.visible = false;
    rightArm.add(sword);
    group.userData.sword = sword;
  }
  group.userData.healthBar = healthBar;
  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;
  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.userData.walking = false;
  group.userData.gait = Math.random() * Math.PI * 2;
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
  } else if (entity.species === "spider") {
    addPart(new THREE.SphereGeometry(0.38, 10, 8), shellMaterial, [0, 0.52, 0.1], [1.45, 0.8, 1.3]);
    addPart(new THREE.SphereGeometry(0.25, 10, 8), darkMaterial, [0, 0.56, -0.37], [1.1, 0.9, 0.9]);
    for (const side of [-1, 1]) {
      addPart(new THREE.SphereGeometry(0.065, 8, 6), eyeMaterial, [side * 0.12, 0.68, -0.57], [1, 1, 0.7]);
      for (let leg = 0; leg < 4; leg += 1) {
        const joint = addPart(new THREE.CylinderGeometry(0.035, 0.055, 0.62, 6), darkMaterial,
          [side * (0.36 + leg * 0.025), 0.34, -0.38 + leg * 0.25], [1, 1, 1]);
        joint.rotation.z = side * (0.85 - leg * 0.18);
      }
    }
  } else if (entity.species === "golem") {
    addPart(new THREE.BoxGeometry(0.92, 1.04, 0.72), shellMaterial, [0, 0.82, 0]);
    addPart(new THREE.BoxGeometry(0.62, 0.58, 0.56), glowMaterial, [0, 1.57, -0.03]);
    addPart(new THREE.BoxGeometry(0.32, 0.1, 0.06), eyeMaterial, [0, 1.61, -0.32]);
    for (const side of [-1, 1]) {
      addPart(new THREE.BoxGeometry(0.36, 0.82, 0.42), darkMaterial, [side * 0.61, 0.84, 0]);
      addPart(new THREE.BoxGeometry(0.32, 0.52, 0.4), shellMaterial, [side * 0.29, 0.26, 0.02]);
    }
    addPart(new THREE.BoxGeometry(0.2, 0.42, 0.1), glowMaterial, [0, 0.92, -0.39]);
  } else if (entity.species === "phantom") {
    addPart(new THREE.SphereGeometry(0.42, 12, 9), glowMaterial, [0, 0.93, 0], [0.9, 1.2, 0.8]);
    addPart(new THREE.SphereGeometry(0.27, 10, 8), shellMaterial, [0, 1.27, -0.1], [1, 0.8, 0.9]);
    for (const side of [-1, 1]) {
      const wing = addPart(new THREE.BoxGeometry(0.95, 0.08, 0.42), glowMaterial, [side * 0.62, 1.03, 0.12], [1, 1, 1]);
      wing.rotation.z = side * -0.32;
      addPart(new THREE.SphereGeometry(0.08, 8, 6), eyeMaterial, [side * 0.13, 1.32, -0.31], [1, 1, 0.7]);
    }
  } else if (entity.species === "skeleton") {
    addPart(new THREE.BoxGeometry(0.44, 0.58, 0.3), shellMaterial, [0, 0.95, 0]);
    addPart(new THREE.SphereGeometry(0.28, 10, 8), shellMaterial, [0, 1.52, -0.02]);
    addPart(new THREE.BoxGeometry(0.3, 0.1, 0.07), eyeMaterial, [0, 1.55, -0.27]);
    for (const ribY of [0.78, 0.94, 1.1]) {
      addPart(new THREE.BoxGeometry(0.62, 0.07, 0.34), shellMaterial, [0, ribY, -0.02]);
    }
    for (const side of [-1, 1]) {
      const arm = addPart(new THREE.CylinderGeometry(0.07, 0.08, 0.62, 6), shellMaterial, [side * 0.38, 0.98, 0]);
      arm.rotation.z = side * 0.24;
      addPart(new THREE.CylinderGeometry(0.08, 0.09, 0.68, 6), shellMaterial, [side * 0.18, 0.35, 0]);
    }
  } else if (entity.species === "warden" || entity.species === "boss") {
    addPart(new THREE.BoxGeometry(0.9, 1.14, 0.7), shellMaterial, [0, 0.82, 0]);
    addPart(new THREE.BoxGeometry(0.64, 0.62, 0.58), glowMaterial, [0, 1.62, -0.04]);
    addPart(new THREE.BoxGeometry(0.38, 0.12, 0.08), eyeMaterial, [0, 1.66, -0.34]);
    for (const side of [-1, 1]) {
      addPart(new THREE.ConeGeometry(0.2, 0.48, 5), shellMaterial, [side * 0.43, 1.81, 0.06]);
      addPart(new THREE.BoxGeometry(0.38, 0.86, 0.46), shellMaterial, [side * 0.62, 0.83, 0]);
      addPart(new THREE.CylinderGeometry(0.1, 0.13, 0.62, 7), darkMaterial, [side * 0.28, 0.26, 0]);
    }
    if (entity.species === "boss") {
      for (let spike = 0; spike < 5; spike += 1) {
        addPart(new THREE.ConeGeometry(0.15, 0.42, 5), glowMaterial, [(spike - 2) * 0.18, 1.48, 0.33]);
      }
    }
  } else {
    addPart(new THREE.SphereGeometry(0.48, 12, 9), glowMaterial, [0, 0.87, 0], [0.85, 1.15, 0.85]);
    const wispTail = addPart(new THREE.ConeGeometry(0.42, 0.85, 8), glowMaterial, [0, 0.35, 0.08], [1, 1, 1]);
    wispTail.rotation.x = Math.PI;
    addPart(new THREE.TorusGeometry(0.58, 0.035, 6, 18), eyeMaterial, [0, 0.7, 0], [1, 1, 0.65]).rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      addPart(new THREE.SphereGeometry(0.08, 8, 6), eyeMaterial, [side * 0.17, 0.92, -0.38], [1, 1, 0.7]);
    }
  }

  const labelColors = {
    crab: "#ffd18b", slime: "#caff9c", spider: "#f6b18d", golem: "#e7d3bc",
    phantom: "#d8c8ff", skeleton: "#e6edf2", warden: "#b8f7e6", boss: "#ffcc8a",
  };
  const labelColor = labelColors[entity.species] ?? "#a5f7ff";
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

function setAvatarSeatedPose(avatar, seated, eating = false, gait = 0) {
  avatar.userData.seated = seated;
  avatar.userData.eating = eating;
  const legAngle = seated ? Math.PI / 2 : 0;
  avatar.userData.leftLeg.rotation.x = legAngle;
  avatar.userData.rightLeg.rotation.x = legAngle;
  avatar.userData.leftArm.rotation.x = seated ? 1.1 : 0;
  avatar.userData.rightArm.rotation.x = seated
    ? eating ? 0.9 + Math.sin(gait) * 0.22 : 1.1
    : 0;
  avatar.userData.leftArm.rotation.z = 0;
  avatar.userData.rightArm.rotation.z = eating ? Math.sin(gait * 0.5) * 0.08 : 0;
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
      if (!selfAvatar) {
        selfAvatar = makeAvatar(entity);
        updateHeldAssetVisibility();
      }
      updateCharacterArmor();
      selfAvatar.visible = thirdPersonView && state.connected && (!state.vehicleId || entity.mountId);
      updateAvatarHealth(selfAvatar.userData.healthBar, entity.health);
      setAvatarSeatedPose(selfAvatar, Boolean(entity.sittingAt));
      continue;
    }
    let avatar = avatarMeshes.get(entity.id);
    if (!avatar) {
      avatar = createAvatar(entity);
      avatarMeshes.set(entity.id, avatar);
    }
    if (!avatar.userData.healthBar) avatar.children[2].visible = true;
    avatar.visible = !entity.vehicleId;
    if (entity.color) avatar.children[0].material.color.set(entity.color);
    updateAvatarHealth(avatar.userData.healthBar, entity.health);
    avatar.userData.walking = Boolean(entity.walking);
    const seated = Boolean(entity.sittingAt || entity.seated);
    setAvatarSeatedPose(avatar, seated, Boolean(entity.eating), avatar.userData.gait);
    const surfaceHeight = entity.y === undefined
      ? terrainHeightAt(entity.x, entity.z, state.seed) + (entity.seated ? 0.48 : 1)
      : entity.y - 1.65 - (entity.sittingAt ? 0.5 : 0);
    const point = planetPointAt(entity.x, surfaceHeight, entity.z);
    const target = new THREE.Vector3(point.x, point.y, point.z);
    avatar.position.lerp(target, isBot ? 0.42 : 0.32);
    avatar.position.setLength(PLANET_RADIUS + surfaceHeight);
    avatar.quaternion.slerp(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0), isBot ? 0.32 : 0.5);
  }
  target.clear();
  for (const entity of current) target.set(entity.id, entity);
}

function animateBots(delta) {
  for (const bot of botAvatars.values()) {
    bot.userData.gait += delta * (bot.userData.walking ? 10 : 2);
    if (bot.userData.seated) {
      setAvatarSeatedPose(bot, true, bot.userData.eating, bot.userData.gait);
      continue;
    }
    const stride = bot.userData.walking ? Math.sin(bot.userData.gait) * 0.55 : 0;
    bot.userData.leftLeg.rotation.x = stride;
    bot.userData.rightLeg.rotation.x = -stride;
    bot.userData.leftArm.rotation.x = -stride * 0.7;
    bot.userData.rightArm.rotation.x = stride * 0.7;
  }
}

function animatePlayerAttack(delta) {
  playerAttackTime = Math.max(0, playerAttackTime - delta);
  const progress = 1 - playerAttackTime / PLAYER_ATTACK_ANIMATION_DURATION;
  const strike = Math.sin(Math.PI * progress);
  if (selfAvatar) {
    selfAvatar.userData.gait += delta * (selfAvatar.userData.walking ? 10 : 2);
    if (selfAvatar.userData.seated) {
      setAvatarSeatedPose(selfAvatar, true, false, selfAvatar.userData.gait);
    } else {
      const stride = selfAvatar.userData.walking ? Math.sin(selfAvatar.userData.gait) * 0.55 : 0;
      selfAvatar.userData.leftLeg.rotation.x = stride;
      selfAvatar.userData.rightLeg.rotation.x = -stride;
      selfAvatar.userData.leftArm.rotation.x = -stride * 0.7;
      selfAvatar.userData.rightArm.rotation.x = stride * 0.7 + strike * 1.5;
      selfAvatar.userData.rightArm.rotation.z = -strike * 0.32;
    }
  }
  cameraFist.position.set(0.34 + strike * 0.05, -0.3 + strike * 0.04, -0.68 - strike * 0.34);
  cameraFist.rotation.set(-0.2 + strike * 1.25, -0.16, 0.1 - strike * 0.12);
  cameraSword.position.set(0.38 + strike * 0.1, -0.36 + strike * 0.08, -0.72 - strike * 0.12);
  cameraSword.rotation.set(-0.12 - strike * 1.1, -0.2, 0.42 + strike * 0.65);
  cameraAssetWeapon.position.set(0.34 + strike * 0.1, -0.3 + strike * 0.06, -0.68 - strike * 0.2);
  cameraAssetWeapon.rotation.set(-0.1 - strike * 1.1, -0.15, 0.1 + strike * 0.6);
}

function makeAnimal(entity) {
  if (entity.model === "fish") return makeFish(entity);
  const palettes = {
    cow: { body: "#f0eee5", head: "#f0eee5", face: "#d89582", legs: "#51473f", patch: "#413b38", scale: 1 },
    alpaca: { body: "#eee9da", head: "#eee9da", face: "#d89582", legs: "#62584d", patch: "#d6d0c1", scale: 1 },
    fox: { body: "#d77c4b", head: "#d77c4b", face: "#eee9da", legs: "#51473f", patch: "#eee9da", scale: 1 },
    wolf: { body: "#8a8d8e", head: "#a6a6a1", face: "#d6d0c1", legs: "#514d49", patch: "#d6d0c1", scale: 1 },
    horse: { body: "#b58b5c", head: "#c89f6f", face: "#2f261d", legs: "#463a31", patch: "#d6c59d", scale: 1.1 },
    dragon: { body: "#9d5d42", head: "#b66e4f", face: "#ffe8b5", legs: "#4b2c25", patch: "#d6a77a", scale: 1.15 },
  };
  const palette = {
    ...(palettes[entity.model] ?? palettes.cow),
    body: entity.color ?? (palettes[entity.model] ?? palettes.cow).body,
    head: entity.color ?? (palettes[entity.model] ?? palettes.cow).head,
  };
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
  const bodySize = entity.model === "alpaca" ? [0.66, 0.86, 0.6]
    : entity.model === "fox" || entity.model === "wolf" ? [0.94, 0.58, 0.58]
      : entity.model === "horse" ? [1.12, 0.72, 0.72]
        : entity.model === "dragon" ? [0.96, 0.66, 0.8]
          : [0.9, 0.66, 0.62];
  const bodyY = entity.model === "alpaca" ? 0.88 : entity.model === "horse" ? 0.8 : 0.72;
  const body = addBox(group, bodySize, [0, bodyY, 0], bodyMaterial);
  const wings = [];
  if (entity.model === "dragon") {
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.42, 0.98, 0.08);
      const upper = addBox(wing, [1.24, 0.08, 0.12], [side * 0.48, 0, 0.18], accentMaterial);
      upper.rotation.y = side * 0.2;
      addBox(wing, [0.76, 0.07, 0.1], [side * 0.56, -0.02, -0.5], accentMaterial).rotation.y = side * 0.62;
      group.add(wing);
      wings.push(wing);
    }
  }
  const head = new THREE.Group();
  const headPosition = entity.model === "alpaca" ? [0, 1.22, -0.3]
    : entity.model === "cow" ? [0, 0.96, -0.48]
      : entity.model === "horse" ? [0, 1.08, -0.68]
        : entity.model === "dragon" ? [0, 0.98, -0.7]
          : [0, 0.89, -0.5];
  head.position.set(...headPosition);
  group.add(head);
  const headSize = entity.model === "alpaca" ? [0.34, 0.42, 0.34]
    : entity.model === "cow" ? [0.4, 0.42, 0.38]
      : entity.model === "horse" ? [0.42, 0.38, 0.42]
        : entity.model === "dragon" ? [0.46, 0.38, 0.4]
          : [0.34, 0.36, 0.34];
  addBox(head, headSize, [0, 0, -0.06], headMaterial);
  addBox(head, [0.26, 0.18, 0.2], [0, -0.1, -0.26], faceMaterial);
  for (const side of [-1, 1]) addBox(head, [0.055, 0.06, 0.025], [side * 0.13, 0.08, -0.25], eyeMaterial);
  if (entity.model === "cow") {
    for (const side of [-1, 1]) {
      addBox(head, [0.1, 0.2, 0.1], [side * 0.16, 0.27, -0.04], accentMaterial);
      addBox(head, [0.08, 0.18, 0.08], [side * 0.16, 0.43, -0.04], hornMaterial);
    }
    addBox(group, [0.24, 0.22, 0.025], [-0.2, 0.77, -0.315], accentMaterial);
    addBox(group, [0.2, 0.2, 0.025], [0.22, 0.68, -0.315], accentMaterial);
  } else if (entity.model === "alpaca") {
    addBox(group, [0.28, 0.66, 0.3], [0, 1.05, -0.25], bodyMaterial);
    for (const side of [-1, 1]) addBox(head, [0.1, 0.34, 0.12], [side * 0.17, 0.34, 0], headMaterial);
  } else if (entity.model === "horse") {
    addBox(group, [0.5, 0.22, 0.18], [0, 0.95, 0.36], accentMaterial);
    addBox(head, [0.22, 0.18, 0.18], [0.16, -0.04, -0.18], accentMaterial);
    addBox(head, [0.18, 0.13, 0.13], [-0.16, -0.04, -0.18], accentMaterial);
    addBox(group, [0.96, 0.12, 0.12], [0, 0.24, 0.42], accentMaterial);
    addBox(group, [0.64, 0.12, 0.48], [0, 1.17, 0.03], material("#563b2d"));
    addBox(group, [0.72, 0.08, 0.3], [0, 1.09, 0.03], material("#98704b"));
  } else if (entity.model === "dragon") {
    addBox(head, [0.28, 0.24, 0.24], [0, 0.1, -0.08], accentMaterial);
    addBox(group, [0.2, 0.2, 0.2], [0, 0.76, 0.3], accentMaterial);
    addBox(head, [0.08, 0.08, 0.18], [0.22, 0.14, -0.28], eyeMaterial);
    addBox(head, [0.08, 0.08, 0.18], [-0.22, 0.14, -0.28], eyeMaterial);
  } else {
    for (const side of [-1, 1]) {
      addBox(head, [0.14, 0.28, 0.14], [side * 0.14, 0.28, 0.02], headMaterial);
    }
    if (entity.model === "fox") {
      addBox(group, [0.16, 0.16, 0.16], [0, 0.55, 0.45], accentMaterial);
    }
  }

  const legs = [];
  const legHeight = entity.model === "alpaca" ? 0.62 : entity.model === "fox" || entity.model === "wolf" ? 0.42 : entity.model === "horse" ? 0.65 : 0.48;
  const legWidth = entity.model === "alpaca" ? 0.12 : entity.model === "horse" ? 0.15 : 0.17;
  const legTop = entity.model === "alpaca" ? 0.62 : entity.model === "horse" ? 0.72 : 0.49;
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
  group.userData.wings = wings;
  group.userData.flying = Boolean(entity.flying);
  group.userData.bodyBaseY = bodyY;
  group.userData.gait = Math.random() * Math.PI * 2;
  group.userData.walking = Boolean(entity.walking);
  group.userData.species = entity.species;
  const ground = terrainHeightAt(entity.x, entity.z, state.seed);
  const surfaceHeight = entity.y ?? ground + 1;
  const point = planetPointAt(entity.x, surfaceHeight, entity.z);
  group.position.set(point.x, point.y, point.z);
  group.quaternion.copy(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0));
  group.userData.color = entity.color;
  group.userData.pattern = entity.pattern;
  group.userData.species = entity.species;
  group.add(avatarLabel(`${entity.name} · Lv ${entity.level ?? 1}`, "#fff1c6"));
  scene.add(group);
  return group;
}

function makeFish(entity) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: entity.color ?? "#76b9c9" });
  const finMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color(entity.color ?? "#76b9c9").multiplyScalar(0.68) });
  const eyeMaterial = new THREE.MeshLambertMaterial({ color: "#1e2a36" });
  const addBox = (size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    group.add(mesh);
    return mesh;
  };
  addBox([0.52, 0.38, 0.82], [0, 0, 0], bodyMaterial);
  for (const side of [-1, 1]) {
    addBox([0.05, 0.07, 0.03], [side * 0.2, 0.09, -0.32], eyeMaterial);
    addBox([0.22, 0.08, 0.34], [side * 0.35, -0.02, 0.02], finMaterial);
  }
  const tail = new THREE.Group();
  tail.position.z = 0.4;
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.34), finMaterial);
  tailFin.position.z = 0.16;
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

function isAircraftType(type) {
  return type === "plane" || type === "jet";
}

function isCarType(type) {
  return type === "car" || type === "police";
}

function makeVehicle(vehicle) {
  const group = new THREE.Group();
  const design = vehicle.design ?? {};
  const paint = new THREE.MeshLambertMaterial({
    color: vehicle.type === "boat"
      ? design.hullColor ?? "#765238"
      : vehicle.color ?? (vehicle.type === "plane" || vehicle.type === "jet" ? "#e9eee8" : "#c84e3f"),
  });
  const trim = new THREE.MeshLambertMaterial({ color: vehicle.accent ?? "#343c40" });
  const glass = new THREE.MeshLambertMaterial({
    color: "#83c9dc",
    transparent: true,
    opacity: 0.75,
  });
  const addBox = (size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    group.add(mesh);
    return mesh;
  };

  if (vehicle.type === "boat") {
    const dimensions = design.size === "galleon"
      ? { width: 3.8, length: 7.2 }
      : design.size === "skiff" ? { width: 1.8, length: 3.6 } : { width: 2.8, length: 5.4 };
    const { width, length } = dimensions;
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-width * 0.42, length * 0.35);
    hullShape.lineTo(-width * 0.3, -length * 0.27);
    hullShape.lineTo(0, -length * 0.5);
    hullShape.lineTo(width * 0.3, -length * 0.27);
    hullShape.lineTo(width * 0.42, length * 0.35);
    hullShape.lineTo(width * 0.28, length * 0.5);
    hullShape.lineTo(-width * 0.28, length * 0.5);
    hullShape.closePath();
    const hull = new THREE.Mesh(
      new THREE.ExtrudeGeometry(hullShape, { depth: 0.42, bevelEnabled: false }),
      paint,
    );
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.78;
    group.add(hull);
    const deck = new THREE.Mesh(
      new THREE.ShapeGeometry(hullShape),
      new THREE.MeshLambertMaterial({ color: "#bd9b70" }),
    );
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.78;
    group.add(deck);
    const boatTrim = new THREE.MeshLambertMaterial({ color: "#e0bd7c" });
    const cabinMaterial = new THREE.MeshLambertMaterial({ color: design.hullColor ?? "#765238" });
    const windowMaterial = new THREE.MeshLambertMaterial({
      color: "#7dd7e8",
      emissive: "#153941",
      transparent: true,
      opacity: 0.86,
    });
    const addBoatBox = (size, position, material = boatTrim) => addBox(size, position, material);
    const railHeight = 1.02;
    for (const side of [-1, 1]) {
      addBoatBox([0.09, 0.23, length * 0.64], [side * width * 0.37, railHeight, length * 0.12]);
    }
    if (design.cabin !== false) {
      const cabinWidth = Math.min(width * 0.62, 1.75);
      const cabinLength = Math.min(length * 0.4, 1.7);
      const cabinY = 1.2;
      const windowCount = design.windows ?? 4;
      const panesPerSide = Math.max(1, Math.ceil(windowCount / 2));
      for (const side of [-1, 1]) {
        addBoatBox([0.12, 0.24, cabinLength], [side * cabinWidth / 2, cabinY - 0.24, 0.25], cabinMaterial);
        addBoatBox([0.12, 0.12, cabinLength], [side * cabinWidth / 2, cabinY + 0.3, 0.25], cabinMaterial);
        for (let index = 0; index < panesPerSide; index += 1) {
          const z = 0.25 - cabinLength * 0.27 + index * (cabinLength * 0.54 / Math.max(1, panesPerSide - 1));
          addBoatBox([0.025, 0.25, 0.28], [side * (cabinWidth / 2 + 0.066), cabinY + 0.025, z], windowMaterial);
          addBoatBox([0.04, 0.045, 0.34], [side * (cabinWidth / 2 + 0.09), cabinY - 0.11, z], boatTrim);
          addBoatBox([0.04, 0.045, 0.34], [side * (cabinWidth / 2 + 0.09), cabinY + 0.16, z], boatTrim);
        }
        for (let index = 0; index <= panesPerSide; index += 1) {
          const z = 0.25 - cabinLength * 0.42 + index * (cabinLength * 0.84 / panesPerSide);
          addBoatBox([0.045, 0.48, 0.07], [side * (cabinWidth / 2 + 0.09), cabinY, z], cabinMaterial);
        }
      }
      const front = 0.25 - cabinLength / 2;
      addBoatBox([cabinWidth, 0.72, 0.12], [0, cabinY, front], cabinMaterial);
      if (design.size === "galleon") {
        for (let index = 0; index < 3; index += 1) {
          addBoatBox([0.58, 0.46, 0.48], [index === 1 ? 0 : index === 0 ? -0.72 : 0.72, 1.02, length * 0.27], cabinMaterial);
        }
      }
      const doorwayWidth = cabinWidth * 0.42;
      const rear = 0.25 + cabinLength / 2;
      addBoatBox([(cabinWidth - doorwayWidth) / 2, 0.72, 0.12], [-(cabinWidth + doorwayWidth) / 4, cabinY, rear], cabinMaterial);
      addBoatBox([(cabinWidth - doorwayWidth) / 2, 0.72, 0.12], [(cabinWidth + doorwayWidth) / 4, cabinY, rear], cabinMaterial);
      addBoatBox([doorwayWidth, 0.12, 0.12], [0, cabinY + 0.3, rear], cabinMaterial);
      const door = addBoatBox([doorwayWidth * 0.72, 0.61, 0.055], [0, cabinY - 0.055, rear - 0.045], paint);
      addBoatBox([0.045, 0.045, 0.025], [doorwayWidth * 0.18, cabinY - 0.08, rear - 0.08], boatTrim);
      door.userData.isBoatDoor = true;
      addBoatBox([cabinWidth + 0.25, 0.12, cabinLength + 0.3], [0, cabinY + 0.42, 0.25], boatTrim);
    }
    if (design.sail !== false) {
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, length * 0.58, 7),
        boatTrim,
      );
      mast.position.set(0, 1.25 + length * 0.29, -length * 0.22);
      group.add(mast);
      const sail = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.8, length * 0.42),
        new THREE.MeshLambertMaterial({
          color: design.sailColor ?? "#eee2c6",
          side: THREE.DoubleSide,
        }),
      );
      sail.position.set(0, 1.35 + length * 0.27, -length * 0.22);
      group.add(sail);
      addBoatBox([width * 0.95, 0.08, 0.08], [0, 1.25 + length * 0.49, -length * 0.22], boatTrim);
    }
    group.add(avatarLabel(design.name ?? "Sea Rover", "#fff0d0"));
  } else if (vehicle.type === "jet") {
    const metal = new THREE.MeshLambertMaterial({ color: "#8998a2", metalness: 0.35 });
    const darkMetal = new THREE.MeshLambertMaterial({ color: "#424c54", metalness: 0.25 });
    const engineGlow = new THREE.MeshBasicMaterial({ color: "#8ce5ff" });
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.34, 4.7, 8), paint);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.set(0, 0.56, -0.1);
    group.add(fuselage);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.19, 1.25, 8), metal);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.56, -3.05);
    group.add(nose);
    const wingShape = new THREE.Shape();
    wingShape.moveTo(-0.32, -0.4);
    wingShape.lineTo(-2.45, 1.65);
    wingShape.lineTo(-2.72, 1.88);
    wingShape.lineTo(-2.53, 2.08);
    wingShape.lineTo(-0.42, 0.92);
    wingShape.lineTo(0.42, 0.92);
    wingShape.lineTo(2.53, 2.08);
    wingShape.lineTo(2.72, 1.88);
    wingShape.lineTo(2.45, 1.65);
    wingShape.lineTo(0.32, -0.4);
    wingShape.closePath();
    const wings = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), paint);
    wings.rotation.x = -Math.PI / 2;
    wings.position.y = 0.61;
    group.add(wings);
    addBox([0.16, 0.08, 3.25], [0, 0.62, 0.15], metal);
    addBox([1.4, 0.1, 0.68], [0, 0.88, 1.68], paint);
    for (const side of [-1, 1]) {
      addBox([0.28, 0.12, 1.25], [side * 1.22, 0.42, 0.92], darkMetal);
      const missile = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.92, 7), metal);
      missile.rotation.x = Math.PI / 2;
      missile.position.set(side * 1.25, 0.38, -0.28);
      group.add(missile);
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.55, 10), darkMetal);
      engine.rotation.x = Math.PI / 2;
      engine.position.set(side * 0.38, 0.48, 1.95);
      group.add(engine);
      const exhaust = new THREE.Mesh(new THREE.CircleGeometry(0.15, 10), engineGlow);
      exhaust.position.set(side * 0.38, 0.48, 2.24);
      group.add(exhaust);
    }
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      glass,
    );
    canopy.scale.set(0.8, 1, 1.5);
    canopy.rotation.x = Math.PI / 2;
    canopy.position.set(0, 0.83, -0.95);
    group.add(canopy);
    group.userData.jetExhausts = [];
    group.traverse((part) => {
      if (part.material === engineGlow) group.userData.jetExhausts.push(part);
    });
  } else if (vehicle.type === "plane") {
    addBox([0.62, 0.58, 3.2], [0, 0.48, 0], paint);
    addBox([4.6, 0.12, 0.82], [0, 0.58, 0.14], paint);
    addBox([1.6, 0.1, 0.58], [0, 1.05, 1.18], paint);
    addBox([0.1, 0.62, 0.7], [0, 0.84, 1.18], paint);
    addBox([0.52, 0.44, 0.76], [0, 0.86, -0.56], glass);
    const propeller = new THREE.Group();
    propeller.position.set(0, 0.48, -1.72);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 0.08), trim);
    propeller.add(blade);
    group.add(propeller);
    group.userData.propeller = propeller;
  } else {
    if (vehicle.type === "tank") {
      const hull = new THREE.MeshLambertMaterial({ color: vehicle.color ?? "#687a45" });
      const armor = new THREE.MeshLambertMaterial({ color: vehicle.accent ?? "#829458" });
      const darkMetal = new THREE.MeshLambertMaterial({ color: "#303735" });
      const track = new THREE.MeshLambertMaterial({ color: "#252c2b" });
      const detail = new THREE.MeshLambertMaterial({ color: vehicle.accent ?? "#b18b4b" });
      addBox([2.15, 0.62, 3.5], [0, 0.76, 0], hull);
      addBox([1.62, 0.2, 2.2], [0, 1.16, 0.02], armor);
      for (const side of [-1, 1]) {
        addBox([0.48, 0.7, 3.75], [side * 1.14, 0.42, 0], track);
        for (let index = 0; index < 6; index += 1) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.52, 8), darkMetal);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(side * 1.14, 0.38, -1.38 + index * 0.55);
          group.add(wheel);
        }
        addBox([0.08, 0.46, 0.1], [side * 1.39, 0.44, -1.68], detail);
      }
      const turret = new THREE.Group();
      turret.position.set(0, 1.25, -0.02);
      group.add(turret);
      const turretBody = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.58, 1.55), armor);
      turret.add(turretBody);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.14, 1.95, 8), darkMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.06, -1.48);
      turret.add(barrel);
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 8), detail);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, 0.06, -2.48);
      turret.add(muzzle);
      const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 8), hull);
      hatch.position.set(0.32, 0.38, 0.25);
      turret.add(hatch);
      group.userData.turret = turret;
    } else {
      addBox([1.85, 0.48, 3.2], [0, 0.55, 0], paint);
      addBox([1.35, 0.66, 1.45], [0, 1.08, 0.22], glass);
      addBox([1.95, 0.16, 1.25], [0, 0.88, -0.95], paint);
      for (const side of [-1, 1]) {
        addBox([0.035, 0.09, 1.45], [side * 0.93, 0.63, 0.12], trim);
        addBox([0.04, 0.045, 1.5], [side * 0.94, 0.37, 0.12], paint);
        addBox([0.13, 0.08, 0.35], [side * 0.83, 0.88, -0.56], trim);
      }
      for (const x of [-0.98, 0.98]) {
        for (const z of [-1.05, 1.08]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10), trim);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, 0.34, z);
          group.add(wheel);
        }
      }
      if (vehicle.type === "police") {
        addBox([0.68, 0.1, 0.22], [0, 1.47, 0.22], trim);
        const redLight = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.16, 0.2),
          new THREE.MeshBasicMaterial({ color: "#ff3048" }),
        );
        redLight.position.set(-0.2, 1.58, 0.22);
        group.add(redLight);
        const blueLight = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.16, 0.2),
          new THREE.MeshBasicMaterial({ color: "#3284ff" }),
        );
        blueLight.position.set(0.2, 1.58, 0.22);
        group.add(blueLight);
        group.userData.policeLights = [redLight, blueLight];
      }
    }
  }
  group.userData.vehicleType = vehicle.type;
  group.userData.propeller = group.userData.propeller ?? null;
  group.userData.jetExhausts = group.userData.jetExhausts ?? [];
  group.userData.policeLights = group.userData.policeLights ?? [];
  scene.add(group);
  return group;
}

function rewriteGlbImageUrls(buffer, imageUrl) {
  const source = new DataView(buffer);
  if (
    buffer.byteLength < 20 ||
    source.getUint32(0, true) !== 0x46546c67 ||
    source.getUint32(4, true) !== 2
  ) {
    throw new Error("The harbor model is not a valid GLB 2.0 file.");
  }

  const chunks = [];
  for (let offset = 12; offset < buffer.byteLength;) {
    const length = source.getUint32(offset, true);
    const type = source.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + length > buffer.byteLength) throw new Error("The harbor model contains an invalid chunk.");
    if (type === 0x4e4f534a) {
      const document = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, length)).trim());
      for (const image of document.images ?? []) {
        if (image.uri) image.uri = imageUrl;
      }
      const json = new TextEncoder().encode(JSON.stringify(document));
      const paddedLength = Math.ceil(json.length / 4) * 4;
      const paddedJson = new Uint8Array(paddedLength).fill(0x20);
      paddedJson.set(json);
      chunks.push({ type, data: paddedJson });
    } else {
      chunks.push({ type, data: new Uint8Array(buffer.slice(start, start + length)) });
    }
    offset = start + length;
  }

  const totalLength = 12 + chunks.reduce((total, chunk) => total + 8 + chunk.data.length, 0);
  const result = new ArrayBuffer(totalLength);
  const output = new DataView(result);
  output.setUint32(0, 0x46546c67, true);
  output.setUint32(4, 2, true);
  output.setUint32(8, totalLength, true);
  let offset = 12;
  for (const chunk of chunks) {
    output.setUint32(offset, chunk.data.length, true);
    output.setUint32(offset + 4, chunk.type, true);
    new Uint8Array(result, offset + 8, chunk.data.length).set(chunk.data);
    offset += 8 + chunk.data.length;
  }
  return result;
}

async function loadHarborDecoration(url, x, z, yaw, scale, height) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Harbor model request failed (${response.status}).`);
  const buffer = await response.arrayBuffer();
  const glb = rewriteGlbImageUrls(buffer, pirateShipTextureUrl);
  const { scene: model } = await harborAssetLoader.parseAsync(glb, "");
  model.scale.setScalar(scale);
  const point = planetPointAt(x, height, z);
  model.position.set(point.x, point.y, point.z);
  model.quaternion.copy(surfaceQuaternionAt(x, z, yaw));
  scene.add(model);
}

function loadHarborFleet() {
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 512;
  signCanvas.height = 128;
  const signContext = signCanvas.getContext("2d");
  signContext.fillStyle = "#33271d";
  signContext.fillRect(0, 0, signCanvas.width, signCanvas.height);
  signContext.strokeStyle = "#d9ae64";
  signContext.lineWidth = 8;
  signContext.strokeRect(8, 8, signCanvas.width - 16, signCanvas.height - 16);
  signContext.fillStyle = "#fff0d0";
  signContext.font = "bold 48px system-ui, sans-serif";
  signContext.textAlign = "center";
  signContext.textBaseline = "middle";
  signContext.fillText("BOAT WORKSHOP", signCanvas.width / 2, signCanvas.height / 2);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const workshopSign = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.35, 0.18), new THREE.MeshLambertMaterial({ color: "#593d27" }));
  workshopSign.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(4.92, 1.08), new THREE.MeshBasicMaterial({
    map: signTexture,
    side: THREE.DoubleSide,
  }));
  face.position.z = 0.105;
  workshopSign.add(face);
  for (const side of [-1, 1]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.72), new THREE.MeshLambertMaterial({ color: "#d9ae64" }));
    bracket.position.set(side * 1.8, -0.72, -0.3);
    workshopSign.add(bracket);
  }
  const workshopPoint = planetPointAt(11, 4.4, 125);
  workshopSign.position.set(workshopPoint.x, workshopPoint.y, workshopPoint.z);
  workshopSign.quaternion.copy(surfaceQuaternionAt(11, 125));
  scene.add(workshopSign);

  const assets = [
    loadHarborDecoration(pirateShipUrl, -30, 158, Math.PI / 2, 0.58, 0.45),
    loadHarborDecoration(rowboatUrl, 23, 156, Math.PI / 2, 1, 0.15),
  ];
  void Promise.all(assets).catch((error) => {
    console.error("Unable to load the harbor boats.", error);
    if (state.connected) notify("Some harbor models could not be loaded.");
  });
}

function nearestAvailableVehicle() {
  if (state.vehicleId) return null;
  let nearest = null;
  let nearestDistance = 3.5;
  for (const vehicle of state.vehicles) {
    if (vehicle.occupantId) continue;
    const distance = Math.hypot(
      wrapPlanetX(vehicle.x - playerPosition.x),
      vehicle.z - playerPosition.z,
    );
    if (distance < nearestDistance) {
      nearest = vehicle;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function updateTankAimCrosshair() {
  const vehicle = state.vehicles.find(({ id }) => id === state.vehicleId);
  if (!vehicle || vehicle.type !== "tank") {
    aimCrosshair.style.top = "";
    aimCrosshair.style.left = "";
    return;
  }
  const pitch = vehicle.turretPitch ?? 0;
  const projectedOffset = Math.tan(pitch) * window.innerHeight /
    (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const crosshairY = THREE.MathUtils.clamp(
    window.innerHeight / 2 - projectedOffset,
    18,
    window.innerHeight - 18,
  );
  aimCrosshair.style.left = `${window.innerWidth / 2}px`;
  aimCrosshair.style.top = `${crosshairY}px`;
}

function updateVehicleHeadlights() {
  const activeId = state.vehicleId;
  for (const [id, mesh] of vehicleMeshes) {
    const shouldHaveHeadlights = id === activeId &&
      (isAircraftType(mesh.userData.vehicleType) || isCarType(mesh.userData.vehicleType));
    if (shouldHaveHeadlights && !mesh.userData.headlights?.length) {
      mesh.userData.headlights = [];
      mesh.userData.headlightParts = [];
      for (const x of [-0.48, 0.48]) {
        const headlight = new THREE.SpotLight("#fff1cf", 0, 48, Math.PI / 5, 0.45, 1.4);
        headlight.position.set(x, 0.58, -1.45);
        headlight.target.position.set(x, 0, -30);
        headlight.castShadow = false;
        const lens = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 6),
          new THREE.MeshBasicMaterial({ color: "#fff2c4" }),
        );
        lens.position.set(x, 0.58, -1.5);
        mesh.add(headlight, headlight.target, lens);
        mesh.userData.headlights.push(headlight);
        mesh.userData.headlightParts.push(headlight.target, lens);
      }
    } else if (!shouldHaveHeadlights && mesh.userData.headlights?.length) {
      for (const headlight of mesh.userData.headlights) {
        mesh.remove(headlight);
      }
      for (const part of mesh.userData.headlightParts) {
        mesh.remove(part);
        part.geometry?.dispose();
        if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose());
        else part.material?.dispose();
      }
      mesh.userData.headlights = [];
      mesh.userData.headlightParts = [];
    }
  }
}

function updateVehicleButton() {
  const current = state.vehicles.find(({ id }) => id === state.vehicleId);
  const nearby = current ? null : nearestAvailableVehicle();
  const mountedHorse = state.roomAnimals.find(({ id }) => id === state.mountId);
  const nearbyHorse = current || mountedHorse ? null : nearestAvailableHorse();
  const restaurantBot = !current && !mountedHorse ? nearestRestaurantBot() : null;
  const atRestaurant = !current && !mountedHorse &&
    isNearRestaurant(playerPosition.x, playerPosition.z, state.seed);
  const inVehicle = Boolean(current || mountedHorse);
  const activeAircraft = current && isAircraftType(current.type) ? current : null;
  updateVehicleHeadlights();
  document.documentElement.classList.toggle("tank-aiming", state.vehicleType === "tank");
  document.documentElement.classList.toggle("aircraft-aiming", Boolean(activeAircraft?.airborne));
  if (state.vehicleType === "tank") {
    center.set(0, 0);
    updateTankAimCrosshair();
  } else {
    state.tankTurretDirection = 0;
    state.tankTurretPitchDirection = 0;
    updateTankAimCrosshair();
  }
  flyToggle.closest(".game-menu-view-toggle").hidden = inVehicle;
  breakButton.hidden = inVehicle;
  placeButton.hidden = inVehicle;
  fishButton.hidden = inVehicle;
  fishMenuButton.hidden = inVehicle;
  vehicleButton.hidden = !current && !nearby && !mountedHorse && !nearbyHorse &&
    !atRestaurant && !restaurantBot && !state.sittingAt;
  vehicleButton.textContent = current
    ? `Exit ${current.type}`
    : mountedHorse
      ? "Dismount horse"
      : state.sittingAt
        ? "Stand up"
        : restaurantBot
          ? `Talk to ${restaurantBot.name}`
      : atRestaurant
        ? "Enter dining shop"
        : nearby
          ? `Enter ${nearby.type}`
          : nearbyHorse
            ? "Ride horse"
            : "Vehicle";
  vehicleButton.setAttribute("aria-label", vehicleButton.textContent);
  attackButton.textContent = state.vehicleType === "tank"
    ? "Fire"
    : activeAircraft ? "Shoot" : "Punch";
  attackButton.setAttribute("aria-label", state.vehicleType === "tank"
    ? "Fire tank cannon"
    : activeAircraft ? "Fire aircraft guns" : "Punch");
  const canFlyVertically = state.isFlying || Boolean(activeAircraft?.airborne);
  jumpButton.hidden = inVehicle;
  flyUpButton.hidden = !canFlyVertically && !activeAircraft;
  flyDownButton.hidden = !canFlyVertically;
  flyButton.hidden = inVehicle && !activeAircraft;
  desktopFlyButton.hidden = inVehicle && !activeAircraft;
  if (activeAircraft) {
    flyButton.textContent = activeAircraft.airborne ? "Land" : "Take Off";
    desktopFlyButton.textContent = activeAircraft.airborne ? "Land" : "Take Off";
  }
  tankAimLeftButton.hidden = state.vehicleType !== "tank";
  tankAimRightButton.hidden = state.vehicleType !== "tank";
  tankAimUpButton.hidden = state.vehicleType !== "tank";
  tankAimDownButton.hidden = state.vehicleType !== "tank";
  tankFireButton.hidden = state.vehicleType !== "tank";
  attackButton.hidden = state.vehicleType === "tank";
}

function updateVehicles(current = []) {
  state.vehicles = current;
  const ids = new Set(current.map(({ id }) => id));
  for (const [id, mesh] of vehicleMeshes) {
    if (ids.has(id)) continue;
    scene.remove(mesh);
    vehicleMeshes.delete(id);
  }
  for (const vehicle of current) {
    let mesh = vehicleMeshes.get(vehicle.id);
    if (!mesh || mesh.userData.vehicleType !== vehicle.type) {
      if (mesh) scene.remove(mesh);
      mesh = makeVehicle(vehicle);
      vehicleMeshes.set(vehicle.id, mesh);
    }
    updateVehicleMesh(vehicle, mesh);
  }
  updateVehicleButton();
}

function updateVehicleMesh(vehicle, mesh) {
  const surfaceHeight = vehicle.y + (vehicle.type === "boat" ? 0 : 1.05);
  const point = planetPointAt(vehicle.x, surfaceHeight, vehicle.z);
  mesh.position.set(point.x, point.y, point.z);
  mesh.quaternion.copy(surfaceQuaternionAt(vehicle.x, vehicle.z, vehicle.yaw));
  if (mesh.userData.turret) {
    mesh.userData.turret.rotation.y = (vehicle.turretYaw ?? vehicle.yaw) - vehicle.yaw;
    mesh.userData.turret.rotation.x = vehicle.turretPitch ?? 0;
  }
}

function animateVehicles(delta) {
  for (const vehicle of vehicleMeshes.values()) {
    if (vehicle.userData.propeller) vehicle.userData.propeller.rotation.z += delta * 18;
    if (vehicle.userData.jetExhausts?.length) {
      const flicker = 0.9 + Math.sin(performance.now() * 0.024) * 0.12;
      for (const exhaust of vehicle.userData.jetExhausts) exhaust.scale.setScalar(flicker);
    }
    if (vehicle.userData.policeLights?.length) {
      const flash = Math.floor(performance.now() / 180) % 2;
      vehicle.userData.policeLights[0].visible = flash === 0;
      vehicle.userData.policeLights[1].visible = flash === 1;
    }
  }
}

function fireTankShell(target, impact) {
  const vehicle = state.vehicles.find(({ id }) => id === state.vehicleId);
  if (!vehicle || vehicle.type !== "tank") return;
  const tankMesh = vehicleMeshes.get(vehicle.id);
  tankMesh?.updateMatrixWorld(true);
  const aimYaw = vehicle.turretYaw ?? vehicle.yaw;
  const forwardEast = -Math.sin(aimYaw);
  const forwardNorth = Math.cos(aimYaw);
  const frame = planetFrameAt(vehicle.x, vehicle.z);
  const direction = new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z)
    .multiplyScalar(forwardEast)
    .addScaledVector(new THREE.Vector3(frame.north.x, frame.north.y, frame.north.z), forwardNorth)
    .multiplyScalar(Math.cos(vehicle.turretPitch ?? 0))
    .addScaledVector(new THREE.Vector3(frame.up.x, frame.up.y, frame.up.z), Math.sin(vehicle.turretPitch ?? 0))
    .normalize();
  const turret = tankMesh?.userData.turret;
  const fallbackOrigin = planetPointAt(vehicle.x, vehicle.y + 2.3, vehicle.z);
  const origin = turret
    ? turret.localToWorld(new THREE.Vector3(0, 0.06, -2.5))
    : new THREE.Vector3(fallbackOrigin.x, fallbackOrigin.y, fallbackOrigin.z);
  const endpoint = impact?.point
    ? new THREE.Vector3(impact.point.x, impact.point.y, impact.point.z)
    : new THREE.Vector3().copy(origin).addScaledVector(direction, 48);
  if (!impact?.point && target) {
    const targetGround = terrainHeightAt(target.x, target.z, state.seed);
    const targetPoint = planetPointAt(
      target.x,
      Number.isFinite(target.y) ? Math.max(targetGround + 1, target.y - 1.15) : targetGround + 1.2,
      target.z,
    );
    const targetVector = new THREE.Vector3(targetPoint.x, targetPoint.y, targetPoint.z);
    const distanceAlongShot = THREE.MathUtils.clamp(
      targetVector.sub(origin).dot(direction),
      0,
      48,
    );
    endpoint.copy(origin).addScaledVector(direction, distanceAlongShot);
  }
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: "#ffd16a" }),
  );
  shell.position.copy(origin);
  shell.userData.start = origin.clone();
  shell.userData.end = new THREE.Vector3(endpoint.x, endpoint.y, endpoint.z);
  shell.userData.age = 0;
  shell.userData.duration = Math.max(0.08, origin.distanceTo(shell.userData.end) / 180);
  scene.add(shell);
  tankShells.push(shell);
}

function findTankImpact() {
  const vehicle = state.vehicles.find(({ id }) => id === state.vehicleId);
  if (!vehicle || vehicle.type !== "tank") return null;
  const mesh = vehicleMeshes.get(vehicle.id);
  if (!mesh?.userData.turret) return null;
  mesh.updateMatrixWorld(true);
  const frame = planetFrameAt(vehicle.x, vehicle.z);
  const aimYaw = vehicle.turretYaw ?? vehicle.yaw;
  const east = -Math.sin(aimYaw);
  const north = Math.cos(aimYaw);
  const direction = new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z)
    .multiplyScalar(east)
    .addScaledVector(new THREE.Vector3(frame.north.x, frame.north.y, frame.north.z), north)
    .multiplyScalar(Math.cos(vehicle.turretPitch ?? 0))
    .addScaledVector(new THREE.Vector3(frame.up.x, frame.up.y, frame.up.z), Math.sin(vehicle.turretPitch ?? 0))
    .normalize();
  const origin = mesh.userData.turret.localToWorld(new THREE.Vector3(0, 0.06, -2.5));
  tankRaycaster.set(origin, direction);
  tankRaycaster.near = 0;
  tankRaycaster.far = 48;
  tankRayObjects.length = 0;
  tankRayObjects.push(...blockMeshes, ...modelTargetMeshes);
  for (const [id, vehicleMesh] of vehicleMeshes) {
    if (id === vehicle.id) continue;
    vehicleMesh.userData.targetVehicleId = id;
    tankRayObjects.push(vehicleMesh);
  }
  const hits = tankRaycaster.intersectObjects(tankRayObjects, true);
  const hit = hits.find((candidate) => {
    let object = candidate.object;
    while (object && object !== scene) {
      if (object.userData.targetVehicleId) return true;
      object = object.parent;
    }
    return candidate.object.userData.blockType !== "water" &&
      (candidate.instanceId !== undefined || candidate.object.userData.blockCoordinates);
  });
  if (!hit) return null;
  let hitObject = hit.object;
  while (hitObject && !hitObject.userData.targetVehicleId) hitObject = hitObject.parent;
  if (hitObject?.userData.targetVehicleId) {
    return {
      targetVehicleId: hitObject.userData.targetVehicleId,
      point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
    };
  }
  const coords = hit.instanceId !== undefined
    ? hit.object.userData.coordinates[hit.instanceId]
    : hit.object.userData.blockCoordinates;
  return {
    coords,
    point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
  };
}

function animateTankShells(delta) {
  for (let index = tankShells.length - 1; index >= 0; index -= 1) {
    const shell = tankShells[index];
    shell.userData.age += delta;
    const progress = Math.min(1, shell.userData.age / shell.userData.duration);
    shell.position.lerpVectors(shell.userData.start, shell.userData.end, progress);
    if (progress < 1) continue;
    scene.remove(shell);
    shell.geometry.dispose();
    shell.material.dispose();
    tankShells.splice(index, 1);
  }
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
    animal.userData.ridden = Boolean(entity.riderId);
    const ground = terrainHeightAt(entity.x, entity.z, state.seed);
    const surfaceHeight = entity.y ?? ground + 1;
    const point = planetPointAt(entity.x, surfaceHeight, entity.z);
    const target = new THREE.Vector3(point.x, point.y, point.z);
    animal.position.lerp(target, 0.32);
    animal.position.setLength(PLANET_RADIUS + surfaceHeight);
    animal.quaternion.copy(surfaceQuaternionAt(entity.x, entity.z, entity.yaw ?? 0));
    animal.scale.setScalar(entity.scale ?? 1);
  }
}

function animateAnimals(delta) {
  for (const animal of animalAvatars.values()) {
    animal.userData.gait += delta * (animal.userData.walking ? 10 : 2);
    if (animal.userData.wings?.length) {
      const flap = Math.sin(animal.userData.gait * 4) * 0.65;
      animal.userData.wings.forEach((wing, index) => {
        wing.rotation.z = (index === 0 ? -1 : 1) * flap;
      });
    }
    if (animal.userData.tail && !animal.userData.legs) {
      animal.userData.tail.rotation.y = Math.sin(animal.userData.gait) * 0.45;
      continue;
    }
    const stride = animal.userData.walking ? Math.sin(animal.userData.gait) * 0.55 : 0;
    animal.userData.legs.forEach((leg, index) => {
      leg.rotation.x = stride * (index === 0 || index === 3 ? 1 : -1);
    });
    animal.userData.tail.rotation.x = Math.sin(animal.userData.gait * 0.7) * 0.24;
    animal.userData.body.position.y = animal.userData.bodyBaseY + (animal.userData.walking ? Math.abs(stride) * 0.025 : 0);
  }
}

function updateLocalAvatar() {
  if (!selfAvatar) return;
  selfAvatar.visible = thirdPersonView && state.connected && (!state.vehicleId || state.mountId);
  if (!selfAvatar.visible) return;
  const surfaceHeight = playerPosition.y - 1.65 - (state.sittingAt ? 0.5 : 0);
  const point = planetPointAt(playerPosition.x, surfaceHeight, playerPosition.z);
  selfAvatar.position.set(point.x, point.y, point.z);
  selfAvatar.quaternion.copy(surfaceQuaternionAt(playerPosition.x, playerPosition.z, look.yaw));
  updateAvatarHealth(selfAvatar.userData.healthBar, state.health);
}

function updateCharacterArmor() {
  const hasIronArmor = (state.inventory.get("iron_armor") ?? 0) > 0;
  const hasSteelArmor = (state.inventory.get("steel_armor") ?? 0) > 0;
  const hasGuardianHelm = (state.inventory.get("guardian_helm") ?? 0) > 0;
  const armorColor = hasSteelArmor ? "#a8c3ce" : "#a7a8ad";
  const helmetColor = hasGuardianHelm ? "#d3aa54" : armorColor;
  if (selfAvatar?.userData.bodyArmor) {
    selfAvatar.userData.bodyArmor.visible = hasIronArmor || hasSteelArmor;
    selfAvatar.userData.bodyArmor.material.color.set(armorColor);
  }
  if (selfAvatar?.userData.headArmor) {
    selfAvatar.userData.headArmor.visible = hasGuardianHelm;
    selfAvatar.userData.headArmor.material.color.set(helmetColor);
  }
  updateHeldAssetVisibility();
  updateHeldWeaponVisibility();
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
      if (drop.item === "fishing_rod") {
        mesh = createFishingRodModel();
        mesh.scale.setScalar(0.55);
      } else {
        const material = materials.get(drop.item);
        if (!material) continue;
        mesh = new THREE.Mesh(cubeGeometry, material);
        mesh.scale.setScalar(0.32);
      }
      mesh.userData.item = drop.item;
      scene.add(mesh);
      droppedItemMeshes.set(drop.id, mesh);
    }
    mesh.userData.baseY = terrainHeightAt(drop.x, drop.z, state.seed) + 1.16;
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
  state.roomBots = botList;
  state.roomPlayers = playerList;
  state.properties = message.properties ?? state.properties;
  state.roomMonsters = message.monsters ?? [];
  if (Array.isArray(message.openDoors)) {
    const nextOpenDoors = new Set(message.openDoors);
    if (
      nextOpenDoors.size !== state.openDoors.size ||
      [...nextOpenDoors].some((key) => !state.openDoors.has(key))
    ) {
      state.openDoors = nextOpenDoors;
      scheduleWorldRender();
    }
  }
  updateVehicles(message.vehicles ?? state.vehicles);
  const self = playerList.find((player) => player.id === state.id);
  if (self?.name) state.playerName = self.name;
  const previousVehicleId = state.vehicleId;
  state.vehicleId = self?.vehicleId ?? null;
  state.mountId = self?.mountId ?? null;
  state.sittingAt = self?.sittingAt ?? null;
  state.vehicleType = state.vehicles.find(({ id }) => id === state.vehicleId)?.type ?? null;
  if (previousVehicleId !== state.vehicleId) {
    updateChunkWindow(true);
    scheduleWorldRender();
  }
  updateVehicleButton();
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
  if (!shopPanel.hidden) renderHomeProperties();
}

function updateHealth(health) {
  state.health = Math.max(0, Math.min(100, health ?? state.health));
  healthProgress.value = state.health;
  healthValue.textContent = String(state.health);
  respawnOverlay.hidden = state.health > 0;
}

function updateXp(xp, level) {
  state.xp = Number.isFinite(Number(xp)) ? Number(xp) : state.xp;
  state.level = Number.isFinite(Number(level)) ? Number(level) : state.level;
  const xpToNextLevel = Math.max(0, 100 * (state.level + 1) * (state.level + 2) / 2 - state.xp);
  xpHud.textContent = `XP ${state.xp} · Lv ${state.level} · ${xpToNextLevel} to next`;
  renderCharacterProfile();
}

function updateCoins(coins) {
  state.coins = Number.isFinite(Number(coins)) ? Number(coins) : state.coins;
  coinHud.textContent = `Coins ${state.coins}`;
  shopCoins.textContent = `Coins ${state.coins}`;
  restaurantCoins.textContent = `Coins ${state.coins}`;
  if (!shopPanel.hidden) renderShop();
  if (!restaurantPanel.hidden) renderRestaurantMenu();
}

function renderPlayerProfile(profile) {
  profileNameInput.value = profile.name;
  profileColorInput.value = profile.color;
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
  profileCharacterModel.style.setProperty("--character-color", profile.color);
  renderCharacterProfile();
}

function renderCharacterProfile() {
  profileCharacterName.textContent = profileNameInput.value.trim() || "Explorer";
  profileCharacterLevel.textContent = `Level ${state.level}`;
  const armor = (state.inventory.get("steel_armor") ?? 0) > 0
    ? "steel"
    : (state.inventory.get("iron_armor") ?? 0) > 0 ? "iron" : "";
  const helmet = (state.inventory.get("guardian_helm") ?? 0) > 0;
  profileCharacterModel.classList.toggle("wearing-armor", Boolean(armor));
  profileCharacterModel.classList.toggle("wearing-steel", armor === "steel");
  profileCharacterModel.classList.toggle("wearing-iron", armor === "iron");
  profileCharacterModel.classList.toggle("wearing-helmet", helmet);
  profileGearList.replaceChildren();
  const gear = [
    ["iron_armor", "Iron chestplate"],
    ["steel_armor", "Steel chestplate"],
    ["guardian_helm", "Guardian helmet"],
    ["iron_sword", "Iron sword"],
    ["steel_sword", "Steel sword"],
    ["shield", "Shield"],
  ];
  const selectedWeapon = ["wooden_sword", "stone_sword", "iron_sword", "steel_sword"].includes(state.selected)
    ? state.selected
    : null;
  if (selectedWeapon && (state.inventory.get(selectedWeapon) ?? 0) > 0) {
    const tag = document.createElement("span");
    tag.className = "profile-gear-item";
    tag.textContent = `Equipped: ${itemName(selectedWeapon)}`;
    profileGearList.append(tag);
  }
  for (const [id, label] of gear) {
    const count = state.inventory.get(id) ?? 0;
    if (count < 1) continue;
    const tag = document.createElement("span");
    tag.className = "profile-gear-item";
    tag.textContent = `${label}${count > 1 ? ` ×${count}` : ""}`;
    profileGearList.append(tag);
  }
  if (!profileGearList.childElementCount) {
    const empty = document.createElement("span");
    empty.className = "profile-gear-empty";
    empty.textContent = "No armor or combat gear yet";
    profileGearList.append(empty);
  }
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
      for (const otherMarker of mapMarkerElements.values()) otherMarker.setAttribute("aria-pressed", "false");
      marker.setAttribute("aria-pressed", "true");
      selectedMapTarget = targetValue || null;
      if (selectedMapTarget) teleportTarget.value = selectedMapTarget;
      worldMapSelection.textContent = targetValue?.startsWith("location:")
        ? `${title.replace(" (teleport point)", "")} selected.`
        : targetValue ? `${label} selected.` : "This is your current location.";
      mapTeleportButton.hidden = !selectedMapTarget;
    });
    mapMarkerElements.set(key, marker);
    worldMapMarkers.append(marker);
  }
  marker.className = className;
  marker.style.left = `${(wrapPlanetX(x) - PLANET_MIN_X) / PLANET_LONGITUDE_BLOCKS * 100 + offset}%`;
  marker.style.top = `${(PLANET_MAX_Z - z) / PLANET_LATITUDE_BLOCKS * 100}%`;
  marker.title = title;
  marker.setAttribute("aria-label", ariaLabel);
  marker.setAttribute("aria-pressed", String(Boolean(targetValue && targetValue === selectedMapTarget)));
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
  if (selectedMapTarget && !activeOptions.has(selectedMapTarget)) {
    selectedMapTarget = null;
    mapTeleportButton.hidden = true;
    worldMapSelection.textContent = "Select a location marker to choose a destination.";
  }
  const teleportDisabled = !teleportTarget.value;
  if (teleportButton.disabled !== teleportDisabled) teleportButton.disabled = teleportDisabled;
}

renderWorldMapMarkers([]);

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
    if (room.saved) {
      const actions = document.createElement("div");
      actions.className = "lobby-room-actions";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "room-delete-button";
      remove.dataset.roomId = room.id;
      remove.dataset.roomName = room.name;
      remove.textContent = "Delete";
      remove.disabled = room.players > 0;
      remove.title = room.players > 0 ? "Players must leave this world before it can be deleted." : "Delete this saved world";
      actions.append(join, remove);
      row.append(description, actions);
    } else {
      row.append(description, join);
    }
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
  profileNameInput.value = name;
  renderCharacterProfile();
  localStorage.setItem("player-name", name);
  return sendLobbyMessage({ type: "name", name });
}

function showLobbyHome() {
  state.connected = false;
  moveKeys.clear();
  restaurantPanel.hidden = true;
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
      lobbyPlayerNameInput.value = message.name;
      profileNameInput.value = message.name;
      renderCharacterProfile();
      localStorage.setItem("player-name", message.name);
      const activeRoomId = localStorage.getItem(activeRoomStorageKey);
      if (activeRoomId && !resumeRequested && !state.connected && !lobbyRoom) {
        resumeRequested = true;
        sendLobbyMessage({ type: "join_room", roomId: activeRoomId });
      }
    } else if (message.type === "profile_data") {
      renderPlayerProfile(message.profile);
      profileStatus.textContent = "Profile saved and synced.";
    } else if (message.type === "fly_result") {
      state.isFlying = message.enabled === true;
      const aircraft = state.vehicles.find(({ id }) => id === message.vehicleId);
      if (aircraft && isAircraftType(aircraft.type)) {
        aircraft.airborne = state.isFlying;
        if (message.position && !state.isFlying) {
          playerPosition.set(message.position.x, message.position.y, message.position.z);
          aircraft.y = message.position.y - 2.65;
        }
      }
      if (!state.isFlying) {
        state.flyVerticalDirection = 0;
        state.aircraftAltitudeTarget = null;
      }
      flyToggle.checked = state.isFlying;
      flyButton.setAttribute("aria-pressed", String(state.isFlying));
      flyButton.textContent = state.isFlying ? "Land" : "Fly";
      desktopFlyButton.setAttribute("aria-pressed", String(state.isFlying));
      desktopFlyButton.textContent = state.isFlying ? "Land" : "Fly";
      updateVehicleButton();
      notify(message.message);
    } else if (message.type === "boat_result") {
      if (message.success) boatWorkshopDialog.close();
      notify(message.message);
    } else if (message.type === "vehicle_result") {
      state.vehicleId = message.vehicleId;
      state.vehicleType = message.vehicleType ?? null;
      state.mountId = null;
      if (state.vehicleId) {
        const vehicle = state.vehicles.find(({ id }) => id === state.vehicleId);
        if (vehicle) {
          playerPosition.x = vehicle.x;
          playerPosition.z = vehicle.z;
          playerPosition.y = vehicle.y + 2.65;
          look.yaw = vehicle.yaw;
        }
        if (state.isFlying) requestFlight(false);
        state.isFlying = false;
        state.flyVerticalDirection = 0;
        flyToggle.checked = false;
        flyButton.setAttribute("aria-pressed", "false");
        desktopFlyButton.setAttribute("aria-pressed", "false");
        flyButton.textContent = "Fly";
        desktopFlyButton.textContent = "Fly";
      }
      updateVehicleButton();
      notify(message.message);
    } else if (message.type === "animal_mount_result") {
      state.mountId = message.mountId ?? null;
      if (message.position) {
        playerPosition.set(message.position.x, message.position.y, message.position.z);
        look.yaw = message.position.yaw ?? look.yaw;
      } else if (state.mountId) {
        const mount = state.roomAnimals.find(({ id }) => id === state.mountId);
        if (mount) playerPosition.set(mount.x, mount.y + 2.65, mount.z);
      }
      if (state.mountId) {
        if (state.isFlying) requestFlight(false);
        state.isFlying = false;
        state.flyVerticalDirection = 0;
        flyToggle.checked = false;
      }
      updateVehicleButton();
      updateCamera();
      updateLocalAvatar();
      notify(message.message);
    } else if (message.type === "restaurant_dialogue") {
      const shop = listCityShops(state.seed).find(({ id }) => id === message.shopId);
      state.activeFoodShopId = message.shopId;
      openRestaurantMenu(shop);
      restaurantTitle.textContent = message.shopName;
      restaurantNotice.textContent = `${message.botName}: ${message.greeting}`;
    } else if (message.type === "restaurant_seat_result") {
      if (message.seated === true || message.seated === false) {
        state.sittingAt = message.seated ? state.activeFoodShopId : null;
      }
      if (message.position) {
        playerPosition.set(message.position.x, message.position.y, message.position.z);
        look.yaw = message.position.yaw ?? look.yaw;
        updateCamera();
        updateLocalAvatar();
      }
      if (!restaurantPanel.hidden) renderRestaurantMenu();
      updateVehicleButton();
      notify(message.message);
    } else if (message.type === "door_result") {
      notify(message.message);
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
      if (message.tank && Array.isArray(message.loot)) {
        if (Array.isArray(message.inventory)) updateInventory(message.inventory);
        if (message.loot.length > 0) {
          const collected = message.loot
            .map(({ item, count }) => `${itemName(item)} ×${count}`)
            .join(", ");
          const totals = message.loot
            .map(({ item, total }) => `${itemName(item)} ×${total}`)
            .join(", ");
          notify(`Collected ${collected}. Inventory: ${totals}.`);
        } else if (message.message) notify(message.message);
      } else if (message.vehicleHit) {
        notify(message.message);
      } else if (message.hitByAircraft) {
        notify(message.message);
      } else if (message.aircraft && message.hit && message.killed && message.reward) {
        updateXp(message.reward.xp, message.reward.level);
        updateCoins(message.reward.coins);
        notify(`Aircraft guns defeated a monster! +${message.reward.xpGained} XP · +${message.reward.coinsGained} coins.`);
      } else if (message.aircraft && message.message) {
        notify(message.message);
      } else if (message.hit && message.killed && message.reward) {
        updateXp(message.reward.xp, message.reward.level);
        updateCoins(message.reward.coins);
        notify(`${message.tank ? "Tank defeated a monster!" : "Monster defeated!"} +${message.reward.xpGained} XP · +${message.reward.coinsGained} coins.`);
      } else if (message.hit) notify(`${message.tank ? "Cannon hit" : "Hit"} for ${message.damage} damage.`);
      else if (message.message) notify(message.message);
    } else if (message.type === "respawn_result") {
      playerPosition.x = message.position.x;
      playerPosition.z = message.position.z;
      playerPosition.y = message.position.y ?? terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 2.65;
      look.yaw = message.position.yaw;
      state.jumpVelocity = 0;
      updateHealth(message.health);
      updateChunkWindow(true);
      renderWorld();
      notify("You are back in the world.");
    } else if (message.type === "teleport_result") {
      playerPosition.x = message.position.x;
      playerPosition.z = message.position.z;
      playerPosition.y = message.position.y ?? terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 2.65;
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
      restaurantPanel.hidden = true;
      multiplayerMenu.hidden = true;
      statusText.textContent = "Connected";
      state.id = message.id;
      state.seed = message.seed;
      state.openDoors = new Set(Array.isArray(message.openDoors) ? message.openDoors : []);
      createUnderwaterLife(state.seed);
      state.mode = message.mode === "design" ? "design" : "survival";
      state.isFlying = message.flying === true;
      flyToggle.checked = state.isFlying;
      flyButton.setAttribute("aria-pressed", String(state.isFlying));
      flyButton.textContent = state.isFlying ? "Land" : "Fly";
      desktopFlyButton.setAttribute("aria-pressed", String(state.isFlying));
      desktopFlyButton.textContent = state.isFlying ? "Land" : "Fly";
      autosaveToggle.checked = message.autosaveEnabled !== false;
      if (message.position) {
        playerPosition.x = message.position.x;
        playerPosition.z = message.position.z;
        playerPosition.y = message.position.y ?? terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 2.65;
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
      pendingChunks.clear();
      chunkGeneration += 1;
      lastChunkX = null;
      lastChunkZ = null;
      updateInventory(message.inventory ?? []);
      updateChunkWindow(true);
      renderWorld();
      applySnapshot(message);
      notify("Welcome! Your shared world is ready.");
    } else if (message.type === "snapshot") {
      applySnapshot(message);
    } else if (message.type === "move_rejected") {
      if (message.position) {
        const movedChunks =
          Math.floor(message.position.x / CHUNK_SIZE) !== Math.floor(playerPosition.x / CHUNK_SIZE) ||
          Math.floor(message.position.z / CHUNK_SIZE) !== Math.floor(playerPosition.z / CHUNK_SIZE);
        playerPosition.x = message.position.x;
        playerPosition.y = message.position.y;
        playerPosition.z = message.position.z;
        look.yaw = message.position.yaw ?? look.yaw;
        if (movedChunks) updateChunkWindow(true);
        updateCamera();
      }
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
    } else if (message.type === "home_result") {
      if (Number.isFinite(Number(message.coins))) updateCoins(message.coins);
      if (Array.isArray(message.properties)) state.properties = message.properties;
      if (message.success && message.position) {
        playerPosition.set(message.position.x, message.position.y, message.position.z);
        look.yaw = message.position.yaw;
        state.jumpVelocity = 0;
        updateChunkWindow(true);
        renderWorld();
        shopPanel.hidden = true;
        gameMenu.hidden = true;
        updateCamera();
      }
      homeNotice.textContent = message.message;
      gameMenuStatus.textContent = message.message;
      notify(message.message);
      if (!shopPanel.hidden) renderHomeProperties();
    } else if (message.type === "buy_result") {
      updateCoins(message.coins);
      shopNotice.textContent = message.message;
      notify(message.message);
    } else if (message.type === "food_result") {
      if (Number.isFinite(Number(message.coins))) updateCoins(message.coins);
      if (Number.isFinite(Number(message.health))) updateHealth(message.health);
      restaurantNotice.textContent = message.message;
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
      if (!shopPanel.hidden) shopNotice.textContent = message.message;
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
  const roomButton = event.target.closest("button[data-room-id]");
  if (!roomButton) return;
  if (roomButton.classList.contains("room-delete-button")) {
    deleteSavedWorldFromAdmin(roomButton);
  } else if (updatePlayerName()) {
    sendLobbyMessage({ type: "join_room", roomId: roomButton.dataset.roomId });
  }
});

async function deleteSavedWorldFromAdmin(roomButton) {
  const name = roomButton.dataset.roomName ?? roomButton.dataset.roomId;
  try {
    const sessionResponse = await fetch("/api/admin/session", { cache: "no-store" });
    if (sessionResponse.status === 401) {
      lobbyNotice.textContent = "Sign in at /admin/ before deleting saved worlds.";
      return;
    }
    if (!sessionResponse.ok) {
      lobbyNotice.textContent = "Could not verify admin access. Please try again.";
      return;
    }
    if (!window.confirm(`Permanently delete the saved world "${name}"? This cannot be undone.`)) return;

    roomButton.disabled = true;
    const response = await fetch("/api/admin/saved-worlds/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: roomButton.dataset.roomId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The saved world could not be deleted.");
    lobbyNotice.textContent = result.message;
    sendLobbyMessage({ type: "list_rooms" });
  } catch (error) {
    lobbyNotice.textContent = error.message || "The saved world could not be deleted.";
    roomButton.disabled = false;
  }
}

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
toggleHealthHudButton.addEventListener("click", () => {
  healthHudHidden = !healthHudHidden;
  localStorage.setItem("health-hud-visible", String(!healthHudHidden));
  renderHealthHudVisibility();
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
  renderCharacterProfile();
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
profileNameInput.addEventListener("input", renderCharacterProfile);
profileColorInput.addEventListener("input", () => {
  profileCharacterModel.style.setProperty("--character-color", profileColorInput.value);
});
function requestFlight(enabled) {
  if (enabled && state.mountId) {
    flyToggle.checked = false;
    notify("Dismount your horse before taking off.");
    return;
  }
  if (enabled && state.vehicleType === "boat") {
    flyToggle.checked = false;
    notify("Leave your boat before taking off.");
    return;
  }
  if (state.vehicleId && !isAircraftType(state.vehicleType)) {
    notify("Only an aircraft can take off while you are in a vehicle.");
    return;
  }
  if (!state.connected) {
    flyToggle.checked = state.isFlying;
    notify("Start a world before enabling flight.");
    return;
  }
  if (!enabled) {
    state.flyVerticalDirection = 0;
    state.aircraftAltitudeTarget = null;
  }
  sendLobbyMessage({ type: "fly_toggle", enabled });
}
function useVehicleOrPlace() {
  if (state.sittingAt) {
    sendLobbyMessage({ type: "restaurant_seat" });
    return;
  }
  const target = targetBlock();
  if (target && worldBlocks.get(blockKey(...target.coords)) === "oak_door") {
    if (state.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify({ type: "door_toggle", position: { x: target.coords[0], y: target.coords[1], z: target.coords[2] } }));
    }
    return;
  }
  if (state.vehicleId) {
    sendLobbyMessage({ type: "vehicle_exit" });
    return;
  }
  if (state.mountId) {
    sendLobbyMessage({ type: "animal_mount", animalId: state.mountId });
    return;
  }
  const restaurantBot = nearestRestaurantBot();
  if (restaurantBot) {
    sendLobbyMessage({
      type: "restaurant_talk",
      botId: restaurantBot.id,
      shopId: restaurantBot.restaurantShopId,
    });
    return;
  }
  const foodShop = nearestFoodShop();
  if (foodShop) {
    openRestaurantMenu(foodShop);
    return;
  }
  const horse = nearestAvailableHorse();
  if (horse) {
    if (state.isFlying) requestFlight(false);
    sendLobbyMessage({ type: "animal_mount", animalId: horse.id });
    return;
  }
  const vehicle = nearestAvailableVehicle();
  if (vehicle) {
    sendLobbyMessage({ type: "vehicle_enter", vehicleId: vehicle.id });
    return;
  }
  sendEdit("place");
}
function boatDesignFromForm() {
  const form = new FormData(boatWorkshopForm);
  return {
    name: String(form.get("name") ?? ""),
    size: String(form.get("size") ?? ""),
    hullColor: String(form.get("hullColor") ?? ""),
    sailColor: String(form.get("sailColor") ?? ""),
    windows: Number(form.get("windows")),
    cabin: form.has("cabin"),
    sail: form.has("sail"),
  };
}

function renderBoatWorkshopPreview() {
  const design = boatDesignFromForm();
  const context = boatWorkshopPreview.getContext("2d");
  const width = boatWorkshopPreview.width;
  const height = boatWorkshopPreview.height;
  const dimensions = design.size === "galleon"
    ? { hull: 92, length: 148, planks: 40 }
    : design.size === "skiff" ? { hull: 50, length: 92, planks: 12 } : { hull: 70, length: 120, planks: 24 };
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#d1edf0";
  context.font = "12px system-ui, sans-serif";
  context.fillText("BOW", width / 2 - 12, 18);
  const centerX = width / 2;
  const centerY = height / 2 + 10;
  const halfWidth = dimensions.hull / 2;
  const halfLength = dimensions.length / 2;
  context.beginPath();
  context.moveTo(centerX - halfWidth, centerY + halfLength * 0.58);
  context.lineTo(centerX - halfWidth * 0.7, centerY - halfLength * 0.65);
  context.lineTo(centerX, centerY - halfLength);
  context.lineTo(centerX + halfWidth * 0.7, centerY - halfLength * 0.65);
  context.lineTo(centerX + halfWidth, centerY + halfLength * 0.58);
  context.lineTo(centerX + halfWidth * 0.65, centerY + halfLength);
  context.lineTo(centerX - halfWidth * 0.65, centerY + halfLength);
  context.closePath();
  context.fillStyle = design.hullColor;
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = "#dfbf83";
  context.stroke();
  context.fillStyle = "#c9a578";
  context.fillRect(centerX - halfWidth * 0.72, centerY - halfLength * 0.4, halfWidth * 1.44, halfLength * 1.16);
  if (design.cabin) {
    context.fillStyle = "#63462f";
    context.fillRect(centerX - halfWidth * 0.42, centerY - halfLength * 0.12, halfWidth * 0.84, halfLength * 0.44);
    context.fillStyle = "#7dd7e8";
    const paneCount = Math.max(1, Math.ceil(design.windows / 2));
    for (const side of [-1, 1]) {
      for (let pane = 0; pane < paneCount; pane += 1) {
        context.fillRect(
          centerX + side * halfWidth * 0.3 - 4,
          centerY - halfLength * 0.15 + pane * 24 - (paneCount - 1) * 12,
          5,
          12,
        );
      }
    }
    context.fillStyle = "#a97947";
    context.fillRect(centerX - 7, centerY + halfLength * 0.13, 14, halfLength * 0.18);
    context.strokeStyle = "#f0d4a1";
    context.strokeRect(centerX - 7, centerY + halfLength * 0.13, 14, halfLength * 0.18);
  }
  if (design.sail) {
    context.fillStyle = design.sailColor;
    context.beginPath();
    context.moveTo(centerX + halfWidth * 0.08, centerY - halfLength * 0.64);
    context.lineTo(centerX + halfWidth * 0.78, centerY - halfLength * 0.08);
    context.lineTo(centerX + halfWidth * 0.08, centerY - halfLength * 0.08);
    context.closePath();
    context.fill();
    context.fillStyle = "#dfbf83";
    context.fillRect(centerX + halfWidth * 0.05, centerY - halfLength * 0.7, 4, halfLength * 0.78);
  }
  const glass = design.cabin ? design.windows : 0;
  boatWorkshopMaterials.textContent = state.mode === "design"
    ? "Design mode: materials are free."
    : `${dimensions.planks} oak planks${glass ? ` · ${glass} glass` : ""}${design.cabin ? " · 1 oak door" : ""} required`;
}

boatWorkshopForm.addEventListener("input", renderBoatWorkshopPreview);
boatWorkshopForm.addEventListener("change", renderBoatWorkshopPreview);
boatWorkshopForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isNearBoatWorkshop(playerPosition.x, playerPosition.z)) {
    notify("Return to the harbor Boat Workshop to launch your design.");
    return;
  }
  sendLobbyMessage({ type: "boat_build", design: boatDesignFromForm() });
});
boatWorkshopButton.addEventListener("click", () => {
  gameMenu.hidden = true;
  gameMenuToggle.setAttribute("aria-expanded", "false");
  if (!state.connected) {
    notify("Start a world before using the Boat Workshop.");
    return;
  }
  if (!isNearBoatWorkshop(playerPosition.x, playerPosition.z)) {
    notify("The Boat Workshop is the glass-windowed boathouse on the harbor pier.");
    return;
  }
  renderBoatWorkshopPreview();
  boatWorkshopDialog.showModal();
});
document.querySelector("#close-boat-workshop-button").addEventListener("click", () => boatWorkshopDialog.close());
document.querySelector("#boat-workshop-dialog").addEventListener("click", (event) => {
  if (event.target === boatWorkshopDialog) boatWorkshopDialog.close();
});
flyToggle.addEventListener("change", () => requestFlight(flyToggle.checked));
flyButton.addEventListener("click", () => requestFlight(!state.isFlying));
desktopFlyButton.addEventListener("click", () => requestFlight(!state.isFlying));
vehicleButton.addEventListener("click", useVehicleOrPlace);
thirdPersonToggle.addEventListener("change", () => {
  thirdPersonView = thirdPersonToggle.checked;
  document.documentElement.classList.toggle("first-person-view", !thirdPersonView);
  localStorage.setItem("camera-view-mode", thirdPersonView ? "third-person" : "first-person");
  updateFishingRodVisibility();
  updateHeldAssetVisibility();
  updateHeldWeaponVisibility();
  updateCamera();
  updateLocalAvatar();
});
document.querySelector("#logout-button").addEventListener("click", () => {
  sendLobbyMessage({ type: "leave_room" });
});
document.querySelector("#open-world-map-button").addEventListener("click", () => {
  drawWorldMap();
  renderWorldMapMarkers();
  worldMapPanel.classList.remove("expanded");
  expandWorldMapButton.setAttribute("aria-pressed", "false");
  expandWorldMapButton.textContent = "Expand map";
  selectedMapTarget = null;
  mapTeleportButton.hidden = true;
  worldMapSelection.textContent = "Select a location marker to choose a destination.";
  worldMapPanel.hidden = false;
  gameMenu.hidden = true;
  gameMenuToggle.setAttribute("aria-expanded", "false");
});
expandWorldMapButton.addEventListener("click", () => {
  const expanded = worldMapPanel.classList.toggle("expanded");
  expandWorldMapButton.setAttribute("aria-pressed", String(expanded));
  expandWorldMapButton.textContent = expanded ? "Shrink map" : "Expand map";
});
document.querySelector("#close-world-map-button").addEventListener("click", () => {
  worldMapPanel.hidden = true;
});
document.querySelector("#open-shop-button").addEventListener("click", () => {
  restaurantPanel.hidden = true;
  shopPanel.hidden = false;
  gameMenu.hidden = true;
  gameMenuToggle.setAttribute("aria-expanded", "false");
  renderShop();
});
document.querySelector("#close-shop-button").addEventListener("click", () => {
  shopPanel.hidden = true;
});
document.querySelector("#close-restaurant-button").addEventListener("click", () => {
  restaurantPanel.hidden = true;
});
restaurantSeatButton.addEventListener("click", () => {
  if (state.sittingAt) {
    sendLobbyMessage({ type: "restaurant_seat" });
    return;
  }
  const shop = listCityShops(state.seed).find(({ id }) => id === state.activeFoodShopId) ?? nearestFoodShop();
  if (!shop) {
    notify("Choose a seat inside a diner or bakery.");
    return;
  }
  sendLobbyMessage({ type: "restaurant_seat", shopId: shop.id });
});
document.querySelector("#go-home-button").addEventListener("click", () => {
  const home = state.properties.find(
    ({ ownerName }) => ownerName?.toLowerCase() === state.playerName.toLowerCase(),
  );
  if (!home) {
    gameMenuStatus.textContent = "Buy a Glass City residence first.";
    return;
  }
  sendLobbyMessage({ type: "home_teleport", propertyId: home.id });
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
mapTeleportButton.addEventListener("click", () => {
  if (!selectedMapTarget) return;
  if (selectedMapTarget.startsWith("location:")) {
    sendLobbyMessage({ type: "teleport", locationId: selectedMapTarget.slice("location:".length) });
  } else {
    sendLobbyMessage({ type: "teleport", targetId: selectedMapTarget });
  }
});

function selectBlock(id) {
  state.selected = id;
  for (const button of hotbar.querySelectorAll("button")) {
    button.classList.toggle("selected", button.dataset.block === id);
  }
  updateFishingRodVisibility();
  updateHeldAssetVisibility();
  updateHeldWeaponVisibility();
  renderCharacterProfile();
}

function updateFishingRodVisibility() {
  cameraFishingRod.visible = state.selected === "fishing_rod" && !thirdPersonView;
  if (selfAvatar?.userData.fishingRod) {
    selfAvatar.userData.fishingRod.visible = state.selected === "fishing_rod" && thirdPersonView;
  }
}

function updateInventory(items) {
  const previousInventory = state.inventory;
  state.inventory = new Map(items);
  for (const [item, count] of state.inventory) {
    if (RESTAURANT_MENU_BY_ID.has(item) || count <= (previousInventory.get(item) ?? 0) || hotbarItems.includes(item)) continue;
    const emptySlot = hotbarItems.indexOf(null);
    if (emptySlot < 0) break;
    hotbarItems[emptySlot] = item;
  }
  updateHotbar();
  updateCharacterArmor();
  renderCharacterProfile();
  if (!state.selected) {
    const starterWeapon = ["wooden_sword", "stone_sword", "iron_sword", "steel_sword"]
      .find((item) => hotbarItems.includes(item) && (state.inventory.get(item) ?? 0) > 0);
    selectBlock(starterWeapon ?? hotbarItems.find((item) => item) ?? null);
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

  for (const [id, totalCount] of state.inventory) {
    for (let stackOffset = 0; stackOffset < totalCount; stackOffset += MAX_STACK_SIZE) {
      const count = Math.min(MAX_STACK_SIZE, totalCount - stackOffset);
      const stackNumber = Math.floor(stackOffset / MAX_STACK_SIZE) + 1;
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
        : id === "fishing_rod"
        ? `url("${fishingRodIconUrl}")`
        : id === "campfire"
        ? "linear-gradient(135deg, #ffd56a, #ed7338 55%, #604230 56%)"
        : `url("${blockChoices.find(([block]) => block === id)?.[2] ?? ""}")`;
      const itemNameLabel = document.createElement("span");
      itemNameLabel.className = "inventory-item-name";
      itemNameLabel.textContent = itemName(id);
      const amount = document.createElement("span");
      amount.className = "inventory-amount";
      amount.textContent = `×${count}`;
      const stackLabel = document.createElement("span");
      stackLabel.className = "inventory-amount";
      stackLabel.textContent = totalCount > MAX_STACK_SIZE ? `Stack ${stackNumber}` : "";
      const dropButton = document.createElement("button");
      dropButton.className = "drop-item";
      dropButton.type = "button";
      dropButton.draggable = false;
      dropButton.textContent = "Drop 1";
      dropButton.setAttribute("aria-label", `Drop one ${itemName(id)}`);
      dropButton.addEventListener("click", () => sendInventoryAction({ type: "drop", item: id, count: 1 }));
      const isFood = RESTAURANT_MENU_BY_ID.has(id);
      const itemActions = [];
      if (isFood) {
        const eatButton = document.createElement("button");
        eatButton.className = "drop-item";
        eatButton.type = "button";
        eatButton.textContent = "Eat 1";
        eatButton.setAttribute("aria-label", `Eat one ${itemName(id)}`);
        eatButton.addEventListener("click", () => sendInventoryAction({ type: "eat_food", item: id }));
        itemActions.push(eatButton);
      } else {
        const equipButton = document.createElement("button");
        equipButton.className = "drop-item";
        equipButton.type = "button";
        equipButton.textContent = state.selected === id ? "Equipped" : "Equip";
        equipButton.disabled = state.selected === id;
        equipButton.setAttribute("aria-label", `Equip ${itemName(id)}`);
        equipButton.addEventListener("click", () => equipInventoryItem(id));
        itemActions.push(equipButton);
      }
      if (FISH_TYPE_BY_ID.has(id)) {
        const sellButton = document.createElement("button");
        sellButton.className = "drop-item";
        sellButton.type = "button";
        sellButton.draggable = false;
        sellButton.textContent = "Sell 1";
        sellButton.setAttribute("aria-label", `Sell one ${itemName(id)}`);
        sellButton.addEventListener("click", () => sendInventoryAction({ type: "sell", item: id, count: 1 }));
        itemActions.push(sellButton);
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
      item.append(swatch, itemNameLabel, amount, stackLabel, ...itemActions, dragHandle, dropButton);
      inventoryList.append(item);
    }
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

async function createModelPreviewImage(model) {
  let modelObject;
  if (model.assetKey) {
    const assetScene = await loadPlacedAssetModel(model.assetKey);
    if (!assetScene) return null;
    modelObject = createPlacedAssetModel(model, 0, 0, 0, true);
  } else {
    modelObject = createPlacedModel(model, 0, 0, 0, true);
  }
  if (!modelObject) return null;

  const bounds = new THREE.Box3().setFromObject(modelObject);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 0.9 / Math.max(size.x, size.y, size.z, 0.01);
  modelObject.scale.multiplyScalar(scale);
  modelObject.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

  const imageCanvas = document.createElement("canvas");
  imageCanvas.width = 124;
  imageCanvas.height = 96;
  const context = imageCanvas.getContext("2d");
  if (!context) throw new Error("A 2D canvas is unavailable for market previews.");
  context.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
  context.fillStyle = "rgba(0, 0, 0, 0.18)";
  context.beginPath();
  context.ellipse(62, 79, 31, 7, 0, 0, Math.PI * 2);
  context.fill();

  const cameraPosition = new THREE.Vector3(1.8, 1.35, 2.4).normalize();
  const forward = cameraPosition.clone().negate();
  const right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
  const up = right.clone().cross(forward).normalize();
  const focalLength = imageCanvas.height / (2 * Math.tan(THREE.MathUtils.degToRad(32) / 2));
  const triangles = [];
  const project = (x, y, z, matrix) => {
    const elements = matrix.elements;
    const worldX = elements[0] * x + elements[4] * y + elements[8] * z + elements[12];
    const worldY = elements[1] * x + elements[5] * y + elements[9] * z + elements[13];
    const worldZ = elements[2] * x + elements[6] * y + elements[10] * z + elements[14];
    const depth = 2.7 - (worldX * forward.x + worldY * forward.y + worldZ * forward.z);
    if (depth <= 0.05) return null;
    return {
      x: 62 + (worldX * right.x + worldY * right.y + worldZ * right.z) * focalLength / depth,
      y: 47 - (worldX * up.x + worldY * up.y + worldZ * up.z) * focalLength / depth,
      z: worldX,
      worldY,
      worldZ,
      depth,
    };
  };
  const boxCorners = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) boxCorners.push([x, y, z]);
    }
  }
  let bestYaw = 0;
  let bestProjectedArea = 0;
  for (let step = 0; step < 24; step += 1) {
    modelObject.rotation.y = step * Math.PI / 12;
    modelObject.updateMatrixWorld(true);
    const corners = boxCorners.map(([x, y, z]) => project(x, y, z, modelObject.matrixWorld)).filter(Boolean);
    if (corners.length !== boxCorners.length) continue;
    const width = Math.max(...corners.map(({ x }) => x)) - Math.min(...corners.map(({ x }) => x));
    const height = Math.max(...corners.map(({ y }) => y)) - Math.min(...corners.map(({ y }) => y));
    const projectedArea = width * height;
    if (projectedArea <= bestProjectedArea) continue;
    bestProjectedArea = projectedArea;
    bestYaw = modelObject.rotation.y;
  }
  modelObject.rotation.y = bestYaw;
  modelObject.updateMatrixWorld(true);
  const colorChannels = (color) => [
    Math.round(((color >> 16) & 255)),
    Math.round(((color >> 8) & 255)),
    Math.round(color & 255),
  ];

  modelObject.traverse((part) => {
    if (!part.isMesh || !part.geometry?.attributes?.position) return;
    const geometry = part.geometry;
    const positions = geometry.attributes.position;
    const vertexColors = geometry.attributes.color;
    const indices = geometry.index;
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    const ranges = geometry.groups.length
      ? geometry.groups
      : [{ start: 0, count: indices?.count ?? positions.count, materialIndex: 0 }];
    for (const range of ranges) {
      const material = materials[range.materialIndex] ?? materials[0];
      if (!material || material.visible === false || material.opacity === 0) continue;
      const materialColor = material.color?.getHex() ?? 0xcccccc;
      const [baseRed, baseGreen, baseBlue] = colorChannels(materialColor);
      const start = Math.max(range.start, geometry.drawRange.start);
      const end = Math.min(range.start + range.count, geometry.drawRange.start + geometry.drawRange.count);
      for (let index = start; index + 2 < end; index += 3) {
        const vertexIndices = [0, 1, 2].map((offset) => indices ? indices.getX(index + offset) : index + offset);
        const points = vertexIndices.map((vertexIndex) => project(
          positions.getX(vertexIndex),
          positions.getY(vertexIndex),
          positions.getZ(vertexIndex),
          part.matrixWorld,
        ));
        if (points.some((point) => !point)) continue;
        const [a, b, c] = points;
        const ab = new THREE.Vector3(b.z - a.z, b.worldY - a.worldY, b.worldZ - a.worldZ);
        const ac = new THREE.Vector3(c.z - a.z, c.worldY - a.worldY, c.worldZ - a.worldZ);
        const normal = ab.cross(ac).normalize();
        const light = Math.min(1.25, 0.72 + Math.max(0, normal.dot(new THREE.Vector3(-0.35, 0.8, 0.65).normalize())) * 0.5);
        const vertexTint = vertexColors
          ? vertexIndices.reduce((sum, vertexIndex) => sum + (vertexColors.getX(vertexIndex) + vertexColors.getY(vertexIndex) + vertexColors.getZ(vertexIndex)) / 3, 0) / 3
          : 1;
        triangles.push({
          points,
          depth: (a.depth + b.depth + c.depth) / 3,
          fill: `rgb(${Math.round(baseRed * light * vertexTint)}, ${Math.round(baseGreen * light * vertexTint)}, ${Math.round(baseBlue * light * vertexTint)})`,
          opacity: material.opacity ?? 1,
        });
      }
    }
  });
  triangles.sort((a, b) => b.depth - a.depth);
  for (const triangle of triangles) {
    context.globalAlpha = triangle.opacity;
    context.fillStyle = triangle.fill;
    context.beginPath();
    context.moveTo(triangle.points[0].x, triangle.points[0].y);
    context.lineTo(triangle.points[1].x, triangle.points[1].y);
    context.lineTo(triangle.points[2].x, triangle.points[2].y);
    context.closePath();
    context.fill();
  }
  context.globalAlpha = 1;
  if (!triangles.length) throw new Error(`The ${model.name} preview has no renderable triangles.`);
  const image = imageCanvas.toDataURL("image/png");

  if (!model.assetKey) {
    const geometries = new Set();
    const materials = new Set();
    modelObject.traverse((part) => {
      if (!part.isMesh) return;
      geometries.add(part.geometry);
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
  return image;
}

function requestModelPreview(model, previewImage) {
  const cached = modelPreviewImages.get(model.id);
  if (cached) {
    previewImage.src = cached;
    previewImage.closest(".shop-model-preview")?.classList.add("has-image");
    return;
  }

  let loading = modelPreviewLoads.get(model.id);
  if (!loading) {
    loading = createModelPreviewImage(model);
    modelPreviewLoads.set(model.id, loading);
  }
  void loading.then((image) => {
    if (!image) return;
    modelPreviewImages.set(model.id, image);
    for (const imageElement of document.querySelectorAll("img[data-model-id]")) {
      if (imageElement.dataset.modelId !== model.id) continue;
      imageElement.src = image;
      imageElement.closest(".shop-model-preview")?.classList.add("has-image");
    }
  }).catch((error) => {
    console.error(`Unable to render a market preview for "${model.name}".`, error);
  }).finally(() => {
    modelPreviewLoads.delete(model.id);
  });
}

function renderRestaurantMenu() {
  const shop = listCityShops(state.seed).find(({ id }) => id === state.activeFoodShopId) ?? nearestFoodShop();
  restaurantSeatButton.textContent = state.sittingAt ? "Stand up" : "Take a seat";
  restaurantSeatButton.disabled = !shop;
  restaurantItems.replaceChildren();
  for (const meal of RESTAURANT_MENU) {
    const row = document.createElement("div");
    row.className = "restaurant-item";
    const preview = document.createElement("div");
    preview.className = "shop-model-preview restaurant-preview";
    preview.style.setProperty("--preview-color", MODEL_ITEM_BY_ID.get(`dining_${meal.assetKey.split("/").at(-1).replace(/\.glb$/, "")}`)?.color ?? "#b77943");
    const fallback = document.createElement("span");
    fallback.textContent = meal.icon;
    const image = document.createElement("img");
    image.alt = `${meal.name} dish preview`;
    image.dataset.modelId = MODEL_ITEM_BY_ID.get(`dining_${meal.assetKey.split("/").at(-1).replace(/\.glb$/, "")}`)?.id ?? "";
    preview.append(fallback, image);
    const details = document.createElement("div");
    details.className = "shop-item-details";
    const name = document.createElement("strong");
    name.textContent = meal.name;
    const description = document.createElement("span");
    description.textContent = `${meal.description} Restores up to ${meal.healing} health.`;
    details.append(name, description);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = state.mode === "design" ? "Order free" : `Order · ${meal.price}`;
    button.disabled = state.mode !== "design" && state.coins < meal.price;
    button.addEventListener("click", () => {
      restaurantNotice.textContent = `Ordering ${meal.name}…`;
      sendInventoryAction({ type: "buy_food", item: meal.id });
    });
    row.append(preview, details, button);
    restaurantItems.append(row);
    const model = MODEL_ITEM_BY_ID.get(image.dataset.modelId);
    if (model) requestModelPreview(model, image);
  }
}

function openRestaurantMenu(shop = nearestFoodShop()) {
  if (!shop || !shop.foodShop || !isNearRestaurant(playerPosition.x, playerPosition.z, state.seed)) {
    notify("Visit the Sunset Diner, Parkside Cafe, or Glass City Bakery to order food.");
    return;
  }
  state.activeFoodShopId = shop.id;
  restaurantTitle.textContent = shop.name;
  shopPanel.hidden = true;
  gameMenu.hidden = true;
  restaurantPanel.hidden = false;
  restaurantNotice.textContent = "Talk to the staff, take a seat, then order a meal.";
  renderRestaurantMenu();
}

function renderShop() {
  renderHomeProperties();
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
    (!category || (category === "imported" ? Boolean(model.assetKey) : model.category === category)) &&
    (!query || `${model.name} ${model.categoryLabel}`.toLowerCase().includes(query)),
  );
  shopNotice.textContent =
    `${filtered.length.toLocaleString()} models available anywhere. Balance: ${state.coins} coins. Earn coins by defeating monsters or selling fish.`;
  if (shopPreviewObserver) {
    for (const preview of shopItems.querySelectorAll(".shop-model-preview")) {
      shopPreviewObserver.unobserve(preview);
    }
  }
  shopItems.replaceChildren();
  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "shop-notice";
    empty.textContent = "No models match that search.";
    shopItems.append(empty);
    return;
  }

  if (typeof IntersectionObserver !== "undefined" && !shopPreviewObserver) {
    shopPreviewObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const model = MODEL_ITEM_BY_ID.get(entry.target.dataset.modelId);
        const image = entry.target.querySelector("img");
        if (model && image) requestModelPreview(model, image);
      }
    }, { root: shopItems, rootMargin: "80px" });
  }

  for (const model of filtered.slice(0, 100)) {
    const row = document.createElement("div");
    row.className = "shop-item";
    const preview = document.createElement("div");
    preview.className = "shop-model-preview";
    preview.dataset.modelId = model.id;
    preview.style.setProperty("--preview-color", model.color);
    const fallback = document.createElement("span");
    fallback.textContent = model.categoryLabel;
    const previewImage = document.createElement("img");
    previewImage.alt = `${model.name} 3D model preview`;
    previewImage.dataset.modelId = model.id;
    preview.append(fallback, previewImage);
    const details = document.createElement("div");
    details.className = "shop-item-details";
    const name = document.createElement("span");
    name.textContent = `${model.name} · ${model.categoryLabel}`;
    const button = document.createElement("button");
    button.type = "button";
    const free = state.mode === "design";
    button.textContent = free ? "Add free" : `Buy · ${model.price}`;
    const canAfford = free || state.coins >= model.price;
    button.disabled = !canAfford;
    button.title = !canAfford
      ? `You need ${model.price} coins; your balance is ${state.coins}.`
      : free
        ? "Add this model to your inventory for free."
        : `Buy for ${model.price} coins and add it to your inventory.`;
    button.addEventListener("click", () => {
      shopNotice.textContent = "Processing purchase…";
      sendInventoryAction({ type: "buy_model", item: model.id });
    });
    details.append(name);
    row.append(preview, details, button);
    shopItems.append(row);
    if (shopPreviewObserver) shopPreviewObserver.observe(preview);
    else requestModelPreview(model, previewImage);
  }
  if (filtered.length > 100) {
    const more = document.createElement("p");
    more.className = "shop-notice";
    more.textContent = `Showing 100 of ${filtered.length.toLocaleString()} results. Search to narrow the list.`;
    shopItems.append(more);
  }
}

function equipInventoryItem(item) {
  if ((state.inventory.get(item) ?? 0) < 1) {
    notify(`You do not have ${itemName(item)} to equip.`);
    return;
  }
  const assignedIndex = hotbarItems.indexOf(item);
  if (assignedIndex >= 0) {
    selectBlock(item);
    renderInventory();
  } else {
    const emptyIndex = hotbarItems.indexOf(null);
    if (emptyIndex < 0) {
      state.pendingHotbarItem = item;
      renderInventory();
      notify(`Hotbar full. Tap a hotbar slot to replace its item with ${itemName(item)}.`);
      return;
    }
    assignHotbarSlot(emptyIndex, item, false);
  }
  if (["wooden_sword", "stone_sword", "iron_sword", "steel_sword"].includes(item)) {
    notify(`${itemName(item)} equipped. Face an enemy and attack.`);
  } else {
    notify(`${itemName(item)} equipped in your hotbar.`);
  }
}

function renderHomeProperties() {
  if (!homeProperties) return;
  const catalog = listCityProperties(state.seed);
  const ownedIds = new Set(
    state.properties
      .filter((property) => property.ownerName?.toLowerCase() === state.playerName.toLowerCase())
      .map(({ id }) => id),
  );
  const properties = catalog
    .map((property) => ({
      ...property,
      owned: ownedIds.has(property.id),
      distance: Math.hypot(playerPosition.x - property.entranceX, playerPosition.z - property.entranceZ),
      ownerName: state.properties.find(({ id }) => id === property.id)?.ownerName,
    }))
    .sort((left, right) =>
      Number(right.owned) - Number(left.owned) ||
      left.distance - right.distance,
    );
  homeProperties.replaceChildren();
  for (const property of properties) {
    const row = document.createElement("div");
    row.className = "home-property";
    const name = document.createElement("span");
    name.textContent = property.owned
      ? `${property.name} · Yours`
      : property.ownerName
        ? `${property.name} · Owned by ${property.ownerName}`
        : `${property.name} · ${Math.ceil(property.height / 4)} floors · ${property.price} coins`;
    const button = document.createElement("button");
    button.type = "button";
    if (property.owned) {
      button.textContent = "Go home";
      button.addEventListener("click", () => sendLobbyMessage({
        type: "home_teleport",
        propertyId: property.id,
      }));
    } else {
      button.textContent = state.mode === "design" ? "Claim free" : `Buy · ${property.price}`;
      button.disabled = Boolean(property.ownerName) ||
        property.distance > 5 ||
        (state.mode !== "design" && state.coins < property.price);
      button.addEventListener("click", () => {
        homeNotice.textContent = "Processing home purchase…";
        sendLobbyMessage({ type: "buy_home" });
      });
    }
    row.append(name, button);
    homeProperties.append(row);
  }
  if (properties.length === 0) {
    homeNotice.textContent = "No residences are available in this city.";
  } else if (!properties.some(({ owned }) => owned)) {
    homeNotice.textContent = cityPropertyNear(playerPosition.x, playerPosition.z, state.seed)
      ? "You are beside a residence. Choose Buy to purchase it."
      : "Walk to a building entrance to buy a home.";
  } else {
    homeNotice.textContent = "Your owned home is saved with this world.";
  }
}

function cycleHotbar(direction) {
  const currentIndex = Math.max(0, hotbarItems.indexOf(state.selected));
  const nextIndex = (currentIndex + direction + HOTBAR_SIZE) % HOTBAR_SIZE;
  selectBlock(hotbarItems[nextIndex]);
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
      : id === "fishing_rod" ? `url("${fishingRodIconUrl}")`
        : id === "campfire" ? "linear-gradient(135deg, #ffd56a, #ed7338 55%, #604230 56%)" : "none";
    button.querySelector(".block-label").textContent = name ?? "";
    const count = id ? Math.min(state.inventory.get(id) ?? 0, MAX_STACK_SIZE) : 0;
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

function assignHotbarSlot(index, item, notifyAssignment = true) {
  if (!blockChoiceById.has(item) && !MODEL_ITEM_BY_ID.has(item)) return;
  const existingIndex = hotbarItems.indexOf(item);
  if (existingIndex >= 0 && existingIndex !== index) {
    hotbarItems[existingIndex] = hotbarItems[index];
  }
  hotbarItems[index] = item;
  state.pendingHotbarItem = null;
  updateHotbar();
  selectBlock(item);
  if (notifyAssignment) notify(`${itemName(item)} assigned to slot ${index + 1}.`);
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
    candidate.object.userData.blockType !== "water" &&
    candidate.distance < (state.vehicleType === "tank" ? 48 : 6),
  );
  if (!hit) return null;
  const coords = hit.instanceId !== undefined
    ? hit.object.userData.coordinates[hit.instanceId]
    : hit.object.userData.blockCoordinates;
  return { coords, normal: hit.face.normal.clone() };
}

function findCombatTarget() {
  const tankCombat = state.vehicleType === "tank";
  const tank = tankCombat ? state.vehicles.find(({ id }) => id === state.vehicleId) : null;
  const aimYaw = tank?.turretYaw ?? tank?.yaw ?? look.yaw;
  const latitude = (playerPosition.z - PLANET_MIN_Z + 0.5) / PLANET_LATITUDE_BLOCKS * Math.PI - Math.PI / 2;
  const forwardEast = -Math.sin(aimYaw);
  const forwardNorth = Math.cos(aimYaw);
  let closest = null;
  let closestDistance = tankCombat ? 48 : 3.5;
  for (const candidate of [
    ...(state.roomMonsters ?? []),
    ...(state.roomPlayers ?? []).filter((player) => player.id !== state.id),
  ]) {
    if (candidate.health <= 0) continue;
    const east = wrapPlanetX(candidate.x - playerPosition.x) * Math.cos(latitude);
    const north = candidate.z - playerPosition.z;
    const distance = Math.hypot(east, north);
    if (distance >= closestDistance) continue;
    const facing = (east * forwardEast + north * forwardNorth) / Math.max(distance, 0.001);
    if (facing < 0.2) continue;
    closest = candidate;
    closestDistance = distance;
  }
  return closest;
}

function attackPlayer() {
  if (!state.connected || state.health <= 0) return;
  if (isAircraftType(state.vehicleType)) {
    const aircraft = state.vehicles.find(({ id }) => id === state.vehicleId);
    if (!aircraft?.airborne) {
      notify("Take off before firing the aircraft guns.");
      return;
    }
    state.socket.send(JSON.stringify({
      type: "aircraft_fire",
      aimYaw: look.yaw,
      aimPitch: look.pitch,
    }));
    return;
  }
  if (state.vehicleType === "tank") {
    const target = findCombatTarget();
    const impact = findTankImpact();
    const vehicle = state.vehicles.find(({ id }) => id === state.vehicleId);
    const impactPosition = impact
      && !impact.targetVehicleId
      ? {
          x: impact.coords[0],
          y: impact.coords[1],
          z: impact.coords[2],
        }
      : null;
    fireTankShell(target, impact);
    state.socket.send(JSON.stringify({
      type: "tank_fire",
      ...(target ? { targetId: target.id } : {}),
      ...(impact?.targetVehicleId ? { targetVehicleId: impact.targetVehicleId } : {}),
      ...(impactPosition ? { impactPosition } : {}),
      ...(vehicle ? {
        aimYaw: vehicle.turretYaw ?? vehicle.yaw,
        aimPitch: vehicle.turretPitch ?? 0,
      } : {}),
    }));
    return;
  }
  playerAttackTime = PLAYER_ATTACK_ANIMATION_DURATION;
  const target = findCombatTarget();
  if (!target) {
    notify("No enemy in reach. Face a nearby monster or player to attack.");
    return;
  }
  const weapon = ["wooden_sword", "stone_sword", "iron_sword", "steel_sword"].includes(state.selected)
    && (state.inventory.get(state.selected) ?? 0) > 0
    ? state.selected
    : null;
  state.socket.send(JSON.stringify({ type: "attack", targetId: target.id, ...(weapon ? { weapon } : {}) }));
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
  if (action === "remove" && worldBlocks.get(blockKey(x, y, z)) === "oak_door") {
    state.socket.send(JSON.stringify({ type: "door_toggle", position: { x, y, z } }));
    return;
  }
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
tankFireButton.addEventListener("click", attackPlayer);
fishButton.addEventListener("click", fishAtHarbor);
document.querySelector("#fish-menu-button").addEventListener("click", fishAtHarbor);
respawnButton.addEventListener("click", () => sendLobbyMessage({ type: "respawn" }));
document.querySelector("#jump-button").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  jump();
});
function bindFlightControl(button, direction) {
  const release = () => {
    if (state.flyVerticalDirection === direction) state.flyVerticalDirection = 0;
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (!state.isFlying && !isAircraftType(state.vehicleType)) return;
    if (isAircraftType(state.vehicleType)) {
      const groundY = terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 2.65;
      if (!state.isFlying && direction > 0) requestFlight(true);
      const currentTarget = state.aircraftAltitudeTarget ?? playerPosition.y;
      state.aircraftAltitudeTarget = THREE.MathUtils.clamp(
        currentTarget + direction * 8,
        groundY,
        MAX_BUILD_HEIGHT + 2,
      );
    }
    button.setPointerCapture(event.pointerId);
    state.flyVerticalDirection = direction;
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}
bindFlightControl(flyUpButton, 1);
bindFlightControl(flyDownButton, -1);
function bindTankTurretControl(button, direction) {
  const release = () => {
    if (state.tankTurretDirection === direction) state.tankTurretDirection = 0;
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state.vehicleType !== "tank") return;
    button.setPointerCapture(event.pointerId);
    state.tankTurretDirection = direction;
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}
function bindTankElevationControl(button, direction) {
  const release = () => {
    if (state.tankTurretPitchDirection === direction) state.tankTurretPitchDirection = 0;
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state.vehicleType !== "tank") return;
    button.setPointerCapture(event.pointerId);
    state.tankTurretPitchDirection = direction;
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}
bindTankTurretControl(tankAimLeftButton, 1);
bindTankTurretControl(tankAimRightButton, -1);
bindTankElevationControl(tankAimUpButton, 1);
bindTankElevationControl(tankAimDownButton, -1);
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
  if (event.code === "Escape" && !restaurantPanel.hidden) {
    restaurantPanel.hidden = true;
    return;
  }
  if (event.code === "KeyE" && !restaurantPanel.hidden) {
    if (state.sittingAt) sendLobbyMessage({ type: "restaurant_seat" });
    restaurantPanel.hidden = true;
    return;
  }
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
    if (isAircraftType(state.vehicleType) && !state.isFlying) {
      requestFlight(true);
      state.flyVerticalDirection = 1;
    } else if (state.isFlying || isAircraftType(state.vehicleType)) state.flyVerticalDirection = 1;
    else if (state.isSwimming) state.swimDirection = 1;
    else if (!state.vehicleId && !state.mountId && !event.repeat) jump();
    return;
  }
  if (event.code === "PageUp" && (state.isFlying || isAircraftType(state.vehicleType))) {
    event.preventDefault();
    if (isAircraftType(state.vehicleType) && !state.isFlying) requestFlight(true);
    state.flyVerticalDirection = 1;
    return;
  }
  if (event.code === "PageDown" && (state.isFlying || isAircraftType(state.vehicleType))) {
    event.preventDefault();
    state.flyVerticalDirection = -1;
    return;
  }
  if (state.vehicleType === "tank" && (event.code === "KeyZ" || event.code === "KeyC")) {
    event.preventDefault();
    state.tankTurretDirection = event.code === "KeyZ" ? 1 : -1;
    return;
  }
  if (
    (event.code === "ShiftLeft" || event.code === "ShiftRight") &&
    (state.isFlying || isAircraftType(state.vehicleType))
  ) {
    event.preventDefault();
    state.flyVerticalDirection = -1;
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
  if (event.code === "KeyG" && !event.repeat) {
    event.preventDefault();
    requestFlight(!state.isFlying);
    return;
  }
  moveKeys.add(event.code);
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
  if (/^Digit[1-6]$/.test(event.code)) {
    selectBlock(hotbarItems[Number(event.code.at(-1)) - 1]);
  }
  if (event.code === "KeyE") useVehicleOrPlace();
  if (event.code === "KeyQ") sendEdit("remove");
});
window.addEventListener("keyup", (event) => {
  moveKeys.delete(event.code);
  if (event.code === "Space" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
    state.flyVerticalDirection = 0;
  }
  if (event.code === "PageUp" || event.code === "PageDown") state.flyVerticalDirection = 0;
  if (event.code === "KeyZ" || event.code === "KeyC") state.tankTurretDirection = 0;
  if (event.code === "Space" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
    state.swimDirection = 0;
  }
});
window.addEventListener("blur", () => {
  moveKeys.clear();
  state.flyVerticalDirection = 0;
  state.tankTurretDirection = 0;
  state.tankTurretPitchDirection = 0;
  state.swimDirection = 0;
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

let pointerId = null;
let pointerStart = null;
let pointerMoved = false;
function updateAimFromPointer(event) {
  if (state.vehicleType === "tank" || isAircraftType(state.vehicleType)) {
    center.set(0, 0);
    if (state.vehicleType === "tank") updateTankAimCrosshair();
    aimCrosshair.classList.remove("is-aiming");
    return;
  }
  if (activeGamepadIndex !== null) {
    center.set(0, 0);
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
    && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  if (event.pointerType === "mouse" && inside) {
    center.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    aimCrosshair.style.left = `${event.clientX}px`;
    aimCrosshair.style.top = `${event.clientY}px`;
    aimCrosshair.classList.add("is-aiming");
  } else if (event.pointerType !== "mouse") {
    center.set(0, 0);
  }
}
canvas.addEventListener("pointerdown", (event) => {
  if (event.ctrlKey || (event.button !== 0 && event.button !== 2)) return;
  updateAimFromPointer(event);
  pointerId = event.pointerId;
  pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
  pointerMoved = false;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  updateAimFromPointer(event);
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
canvas.addEventListener("pointerleave", () => {
  if (pointerStart) return;
  aimCrosshair.classList.remove("is-aiming");
  center.set(0, 0);
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
    const type = worldBlocks.get(blockKey(blockX, y, blockZ));
    if (type !== undefined && type !== null && type !== "water") return y + 2.65;
  }
  return BEDROCK_Y + 2.65;
}

function playerOccupiesSolidBlock(x, z, eyeY) {
  const blockX = Math.round(wrapPlanetX(x));
  const blockZ = Math.round(z);
  const feetY = Math.floor(eyeY - 1.65 + 0.05);
  const headY = Math.floor(eyeY - 0.1);
  for (let blockY = feetY; blockY <= headY; blockY += 1) {
    const type = worldBlocks.get(blockKey(blockX, blockY, blockZ));
    if (
      type !== undefined &&
      type !== null &&
      type !== "water" &&
      (type !== "oak_door" || !isDoorOpenAt(blockX, blockY, blockZ))
    ) return true;
  }
  return false;
}

function hasWallAt(x, z, eyeY) {
  const feetY = Math.floor(eyeY - 1.65 + 0.05);
  const blockX = Math.round(wrapPlanetX(x));
  const blockZ = Math.round(z);
  const headY = Math.floor(eyeY - 0.1);
  for (let blockY = feetY; blockY <= headY; blockY += 1) {
    const type = worldBlocks.get(blockKey(blockX, blockY, blockZ));
    if (
      type !== undefined &&
      type !== null &&
      type !== "water" &&
      (type !== "oak_door" || !isDoorOpenAt(blockX, blockY, blockZ))
    ) return true;
  }
  return false;
}

function waterSurfaceEyeAt(x, z) {
  const blockX = Math.round(wrapPlanetX(x));
  const blockZ = Math.round(z);
  for (let blockY = 0; blockY >= BEDROCK_Y; blockY -= 1) {
    if (worldBlocks.get(blockKey(blockX, blockY, blockZ)) === "water") return blockY + 2.65;
  }
  return null;
}

function jump() {
  if (state.vehicleId || state.mountId || state.sittingAt) return;
  const groundY = groundEyeAt(playerPosition.x, playerPosition.z, playerPosition.y);
  if (playerPosition.y <= groundY + 0.02) {
    playerPosition.y = groundY;
    state.jumpVelocity = 7.5;
  }
}

function applyGamepadButton(gamepad, buttonIndex, action) {
  const button = gamepad.buttons[buttonIndex];
  const pressed = Boolean(button?.pressed || (button?.value ?? 0) > 0.5);
  const wasPressed = previousGamepadButtons.has(buttonIndex);
  if (pressed && !wasPressed) action();
  if (pressed) previousGamepadButtons.add(buttonIndex);
  else previousGamepadButtons.delete(buttonIndex);
  return pressed;
}

function deadzoneAxis(value, deadzone = 0.16) {
  if (Math.abs(value) <= deadzone) return 0;
  return Math.sign(value) * (Math.abs(value) - deadzone) / (1 - deadzone);
}

function gamepadOverlayControls() {
  const overlay = !respawnOverlay.hidden
    ? respawnOverlay
    : profileDialog.open
      ? profileDialog
      : !inventoryPanel.hidden
        ? inventoryPanel
        : !shopPanel.hidden
          ? shopPanel
          : !worldMapPanel.hidden
            ? worldMapPanel
            : !gameMenu.hidden
              ? gameMenu
              : null;
  return overlay
    ? [...overlay.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)")]
    : [];
}

function closeGamepadOverlay() {
  if (!respawnOverlay.hidden) return;
  if (profileDialog.open) profileDialog.close();
  else if (!inventoryPanel.hidden) toggleInventory(false);
  else if (!shopPanel.hidden) shopPanel.hidden = true;
  else if (!worldMapPanel.hidden) worldMapPanel.hidden = true;
  else if (!gameMenu.hidden) {
    gameMenu.hidden = true;
    gameMenuToggle.setAttribute("aria-expanded", "false");
  }
}

function focusGamepadControl(direction) {
  const controls = gamepadOverlayControls();
  if (controls.length === 0) return;
  const currentIndex = controls.indexOf(document.activeElement);
  const nextIndex = currentIndex < 0
    ? direction > 0 ? 0 : controls.length - 1
    : (currentIndex + direction + controls.length) % controls.length;
  controls[nextIndex].focus();
}

function navigateGamepadControls(direction, now) {
  if (direction === 0) {
    gamepadNavigationDirection = 0;
    return;
  }
  if (direction === gamepadNavigationDirection && now < gamepadNavigationRepeatAt) return;
  gamepadNavigationDirection = direction;

  const focused = document.activeElement;
  if (focused instanceof HTMLSelectElement) {
    const step = direction > 0 ? 1 : -1;
    focused.selectedIndex = (focused.selectedIndex + step + focused.options.length) % focused.options.length;
    focused.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    focusGamepadControl(direction > 0 ? 1 : -1);
  }
  gamepadNavigationRepeatAt = now + 220;
}

function pollGamepad(delta) {
  const gamepads = navigator.getGamepads?.() ?? [];
  const gamepad = activeGamepadIndex === null
    ? Array.from(gamepads).find(Boolean)
    : gamepads[activeGamepadIndex];
  if (!gamepad) {
    activeGamepadIndex = null;
    document.documentElement.classList.remove("gamepad-aiming");
    gamepadMoveVector.set(0, 0);
    state.flyVerticalDirection = 0;
    previousGamepadButtons.clear();
    gamepadNavigationDirection = 0;
    return;
  }

  activeGamepadIndex = gamepad.index;
  const overlayControls = gamepadOverlayControls();
  const overlayOpen = overlayControls.length > 0;
  if (overlayOpen) {
    applyGamepadButton(gamepad, 0, () => {
      const focused = overlayControls.includes(document.activeElement)
        ? document.activeElement
        : overlayControls[0];
      focused?.click();
    });
  }
  applyGamepadButton(gamepad, 1, () => {
    if (overlayOpen) {
      closeGamepadOverlay();
    } else if (!state.isFlying && state.vehicleType !== "plane") {
      attackPlayer();
    }
  });
  applyGamepadButton(gamepad, 8, () => {
    if (overlayOpen) closeGamepadOverlay();
    else toggleInventory();
  });
  applyGamepadButton(gamepad, 9, () => {
    if (overlayOpen) closeGamepadOverlay();
    else {
      gameMenu.hidden = false;
      gameMenuToggle.setAttribute("aria-expanded", "true");
    }
  });
  const dpadUp = Boolean(gamepad.buttons[12]?.pressed);
  const dpadDown = Boolean(gamepad.buttons[13]?.pressed);
  const dpadLeft = Boolean(gamepad.buttons[14]?.pressed);
  const dpadRight = Boolean(gamepad.buttons[15]?.pressed);
  const navigationDirection = dpadDown || deadzoneAxis(gamepad.axes[1] ?? 0, 0.55) > 0
    ? 1
    : dpadUp || deadzoneAxis(gamepad.axes[1] ?? 0, 0.55) < 0
      ? -1
      : dpadRight || deadzoneAxis(gamepad.axes[0] ?? 0, 0.55) > 0
        ? 2
        : dpadLeft || deadzoneAxis(gamepad.axes[0] ?? 0, 0.55) < 0
          ? -2
          : 0;
  if (overlayOpen) navigateGamepadControls(navigationDirection, performance.now());
  else gamepadNavigationDirection = 0;
  for (const [index, pressed] of [
    [12, dpadUp],
    [13, dpadDown],
    [14, dpadLeft],
    [15, dpadRight],
  ]) {
    if (pressed) previousGamepadButtons.add(index);
    else previousGamepadButtons.delete(index);
  }
  const gameplayActive = state.connected && gameMenu.hidden && worldMapPanel.hidden &&
    shopPanel.hidden && inventoryPanel.hidden;
  document.documentElement.classList.toggle("gamepad-aiming", gameplayActive);
  if (!gameplayActive) {
    gamepadMoveVector.set(0, 0);
    state.flyVerticalDirection = 0;
    for (const index of [...previousGamepadButtons]) {
      if (![0, 1, 8, 9, 12, 13, 14, 15].includes(index)) previousGamepadButtons.delete(index);
    }
    return;
  }

  gamepadMoveVector.set(
    deadzoneAxis(gamepad.axes[0] ?? 0),
    -deadzoneAxis(gamepad.axes[1] ?? 0),
  );
  center.set(0, 0);
  look.yaw -= deadzoneAxis(gamepad.axes[2] ?? 0) * delta * 2.4;
  look.pitch = THREE.MathUtils.clamp(
    look.pitch - deadzoneAxis(gamepad.axes[3] ?? 0) * delta * 1.8,
    -1.35,
    1.35,
  );

  const jumpButtonPressed = Boolean(gamepad.buttons[0]?.pressed || (gamepad.buttons[0]?.value ?? 0) > 0.5);
  const jumpWasPressed = previousGamepadButtons.has(0);
  if (jumpButtonPressed && !jumpWasPressed && isAircraftType(state.vehicleType) && !state.isFlying) {
    requestFlight(true);
  } else if (jumpButtonPressed && !jumpWasPressed && !state.isFlying && !state.vehicleId && !state.mountId) {
    jump();
  }
  if (jumpButtonPressed) previousGamepadButtons.add(0);
  else previousGamepadButtons.delete(0);
  applyGamepadButton(gamepad, 2, useVehicleOrPlace);
  applyGamepadButton(gamepad, 3, () => requestFlight(!state.isFlying));

  const descendButtonPressed = Boolean(gamepad.buttons[1]?.pressed || (gamepad.buttons[1]?.value ?? 0) > 0.5);
  const leftTrigger = gamepad.buttons[6]?.value ?? 0;
  const rightTrigger = gamepad.buttons[7]?.value ?? 0;
  if (state.isFlying || isAircraftType(state.vehicleType)) {
    state.flyVerticalDirection = jumpButtonPressed ? 1 : descendButtonPressed ? -1 : 0;
  }
  if (state.vehicleType === "tank") {
    if (rightTrigger > 0.5 && !previousGamepadButtons.has(7)) attackPlayer();
  } else if (isAircraftType(state.vehicleType)) {
    if (rightTrigger > 0.5 && !previousGamepadButtons.has(7)) attackPlayer();
  } else if (!state.vehicleId) {
    if (rightTrigger > 0.5 && !previousGamepadButtons.has(7)) sendEdit("remove");
    if (leftTrigger > 0.5 && !previousGamepadButtons.has(6)) sendEdit("place");
  }
  for (const [index, value] of [[6, leftTrigger], [7, rightTrigger]]) {
    if (value > 0.5) previousGamepadButtons.add(index);
    else previousGamepadButtons.delete(index);
  }

  applyGamepadButton(gamepad, 4, () => cycleHotbar(-1));
  applyGamepadButton(gamepad, 5, () => cycleHotbar(1));
}

window.addEventListener("gamepadconnected", (event) => {
  activeGamepadIndex = event.gamepad.index;
  notify(`${event.gamepad.id || "Controller"} connected. Use the left stick to move.`);
});
window.addEventListener("gamepaddisconnected", (event) => {
  if (activeGamepadIndex !== event.gamepad.index) return;
  activeGamepadIndex = null;
  document.documentElement.classList.remove("gamepad-aiming");
  gamepadMoveVector.set(0, 0);
  state.flyVerticalDirection = 0;
  previousGamepadButtons.clear();
  notify("Controller disconnected.");
});

function updateMovement(delta) {
  if (!state.connected || state.sittingAt || !gameMenu.hidden || !worldMapPanel.hidden || !shopPanel.hidden || !restaurantPanel.hidden || boatWorkshopDialog.open) return;
  if (playerOccupiesSolidBlock(playerPosition.x, playerPosition.z, playerPosition.y)) {
    let safeEyeY = groundEyeAt(playerPosition.x, playerPosition.z, playerPosition.y);
    while (
      safeEyeY <= MAX_BUILD_HEIGHT + 2.65 &&
      playerOccupiesSolidBlock(playerPosition.x, playerPosition.z, safeEyeY)
    ) {
      safeEyeY += 1;
    }
    playerPosition.y = Math.min(safeEyeY, MAX_BUILD_HEIGHT + 2.65);
    state.jumpVelocity = 0;
  }
  let forwardInput = (moveKeys.has("KeyW") || moveKeys.has("ArrowUp") ? 1 : 0)
    - (moveKeys.has("KeyS") || moveKeys.has("ArrowDown") ? 1 : 0);
  let strafeInput = (moveKeys.has("KeyD") || moveKeys.has("ArrowRight") ? 1 : 0)
    - (moveKeys.has("KeyA") || moveKeys.has("ArrowLeft") ? 1 : 0);
  forwardInput += joystickVector.y;
  strafeInput += joystickVector.x;
  forwardInput += gamepadMoveVector.y;
  strafeInput += gamepadMoveVector.x;
  const magnitude = Math.hypot(forwardInput, strafeInput);
  if (magnitude > 1) {
    forwardInput /= magnitude;
    strafeInput /= magnitude;
  }

  const activeVehicle = state.vehicles.find(({ id }) => id === state.vehicleId);
  const mountedHorse = state.roomAnimals.find(({ id }) => id === state.mountId);
  if ((activeVehicle || mountedHorse) && strafeInput !== 0) {
    look.yaw -= strafeInput * delta * (
      mountedHorse ? 1.8 : isAircraftType(activeVehicle.type) ? 1.6 : 2.1
    );
    strafeInput = 0;
  }
  const speed = (
    mountedHorse
      ? 8.5
      : activeVehicle?.type === "jet"
      ? 24
      : activeVehicle?.type === "plane"
        ? 16
        : isCarType(activeVehicle?.type)
          ? 9
          : activeVehicle?.type === "tank"
            ? 7
            : activeVehicle?.type === "boat"
              ? activeVehicle.design?.size === "galleon" ? 5.5 : activeVehicle.design?.size === "skiff" ? 8 : 7
              : 4.2
  ) * delta;
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
  if (mountedHorse) {
    const currentGround = terrainHeightAt(playerPosition.x, playerPosition.z, state.seed);
    const nextGround = terrainHeightAt(nextX, nextZ, state.seed);
    if (
      magnitude > 0.01 &&
      nextGround >= 0 &&
      nextGround <= currentGround + 1.05 &&
      !hasWallAt(nextX, nextZ, nextGround + 3.65)
    ) {
      playerPosition.x = nextX;
      playerPosition.z = nextZ;
      look.yaw = nextPosition.yaw;
      mountedHorse.x = nextX;
      mountedHorse.z = nextZ;
    }
    playerPosition.y = terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 3.65;
    mountedHorse.y = terrainHeightAt(mountedHorse.x, mountedHorse.z, state.seed) + 1;
    mountedHorse.yaw = look.yaw;
    mountedHorse.walking = magnitude > 0.01;
    const horseMesh = animalAvatars.get(mountedHorse.id);
    if (horseMesh) {
      const point = planetPointAt(mountedHorse.x, mountedHorse.y, mountedHorse.z);
      horseMesh.position.set(point.x, point.y, point.z);
      horseMesh.quaternion.copy(surfaceQuaternionAt(mountedHorse.x, mountedHorse.z, mountedHorse.yaw));
      horseMesh.userData.walking = mountedHorse.walking;
    }
    state.jumpVelocity = 0;
  } else if (activeVehicle?.type === "boat") {
    if (
      terrainHeightAt(nextX, nextZ, state.seed) < 0 &&
      !hasWallAt(nextX, nextZ, activeVehicle.y + 2.65)
    ) {
      playerPosition.x = nextX;
      playerPosition.z = nextZ;
      look.yaw = nextPosition.yaw;
    }
    playerPosition.y = activeVehicle.y + 2.65;
    state.jumpVelocity = 0;
  } else if (state.isFlying || (isAircraftType(activeVehicle?.type) && activeVehicle.airborne)) {
    if (!hasWallAt(nextX, nextZ, playerPosition.y)) {
      playerPosition.x = nextX;
      playerPosition.z = nextZ;
      look.yaw = nextPosition.yaw;
    }
    let verticalStep = state.flyVerticalDirection * 7 * delta;
    if (isAircraftType(activeVehicle?.type) && state.aircraftAltitudeTarget !== null) {
      const difference = state.aircraftAltitudeTarget - playerPosition.y;
      if (Math.abs(difference) < 0.1) {
        state.aircraftAltitudeTarget = null;
        verticalStep = 0;
      } else {
        verticalStep = Math.sign(difference) * Math.min(Math.abs(difference), 7 * delta);
      }
    }
    const nextY = THREE.MathUtils.clamp(
      playerPosition.y + verticalStep,
      BEDROCK_Y + 2.65,
      MAX_BUILD_HEIGHT + 2,
    );
    if (!playerOccupiesSolidBlock(playerPosition.x, playerPosition.z, nextY)) {
      playerPosition.y = nextY;
    } else {
      state.flyVerticalDirection = 0;
    }
    state.jumpVelocity = 0;
  } else {
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
  }

  if (activeVehicle) {
    const previousVehicleYaw = activeVehicle.yaw;
    activeVehicle.x = playerPosition.x;
    activeVehicle.y = playerPosition.y - 2.65;
    activeVehicle.z = playerPosition.z;
    activeVehicle.yaw = look.yaw;
    if (activeVehicle.type === "tank") {
      const turretYaw = activeVehicle.turretYaw ?? activeVehicle.yaw;
      const hullTurn = Math.atan2(
        Math.sin(activeVehicle.yaw - previousVehicleYaw),
        Math.cos(activeVehicle.yaw - previousVehicleYaw),
      );
      const turretTurn = state.tankTurretDirection * 1.35 * delta;
      activeVehicle.turretYaw = Math.atan2(
        Math.sin(turretYaw + hullTurn + turretTurn),
        Math.cos(turretYaw + hullTurn + turretTurn),
      );
      activeVehicle.turretPitch = THREE.MathUtils.clamp(
        (activeVehicle.turretPitch ?? 0) + state.tankTurretPitchDirection * 0.9 * delta,
        -0.45,
        0.65,
      );
      updateTankAimCrosshair();
    }
    const activeVehicleMesh = vehicleMeshes.get(activeVehicle.id);
    if (activeVehicleMesh) updateVehicleMesh(activeVehicle, activeVehicleMesh);
  }

  const waterSurfaceEyeY = waterSurfaceEyeAt(playerPosition.x, playerPosition.z);
  const waterFloorEyeY = terrainHeightAt(playerPosition.x, playerPosition.z, state.seed) + 2.65;
  const swimming = !activeVehicle && !mountedHorse && waterSurfaceEyeY !== null &&
    playerPosition.y >= waterFloorEyeY &&
    playerPosition.y <= waterSurfaceEyeY + 0.3;
  state.isSwimming = swimming;
  waterControls.hidden = !swimming;
  if (mountedHorse) {
    state.isSwimming = false;
    state.swimDirection = 0;
    waterControls.hidden = true;
  } else if (activeVehicle?.type === "boat") {
    state.isSwimming = false;
    state.swimDirection = 0;
    waterControls.hidden = true;
    playerPosition.y = activeVehicle.y + 2.65;
  } else if (state.isFlying || (isAircraftType(activeVehicle?.type) && activeVehicle.airborne)) {
    state.isSwimming = false;
    state.swimDirection = 0;
    waterControls.hidden = true;
  } else if (swimming) {
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
  pollGamepad(delta);
  updateMovement(delta);
  animatePlayerAttack(delta);
  animateBots(delta);
  animateAnimals(delta);
  animateVehicles(delta);
  animateTankShells(delta);
  const now = performance.now();
  if (now - lastSkyUpdateAt >= 250) {
    updateSkyObjects(now);
    lastSkyUpdateAt = now;
  }
  if (now - lastUnderwaterUpdateAt >= 66) {
    updateUnderwaterLife(now);
    lastUnderwaterUpdateAt = now;
  }
  if (state.connected && now - state.lastSentAt > 70) {
    state.socket.send(
      JSON.stringify({
        type: "move",
        position: {
          x: playerPosition.x,
          y: playerPosition.y,
          z: playerPosition.z,
          yaw: look.yaw,
          ...(state.vehicleType === "tank"
            ? {
                turretYaw: state.vehicles.find(({ id }) => id === state.vehicleId)?.turretYaw ?? look.yaw,
                turretPitch: state.vehicles.find(({ id }) => id === state.vehicleId)?.turretPitch ?? 0,
              }
            : {}),
        },
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

loadHarborFleet();
animate();

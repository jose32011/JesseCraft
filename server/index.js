import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { WebSocket, WebSocketServer } from "ws";
import {
  BLOCK_TYPES,
  BEDROCK_Y,
  blockKey,
  canCraft,
  canEditBlock,
  CHUNK_SIZE,
  CITY_BEACH_OUTER_RADIUS,
  CITY_BLOCK_SIZE,
  CITY_POLICE_STATION,
  CITY_RADIUS,
  FISH_TYPES,
  FISH_TYPE_BY_ID,
  getBaseBlockAt,
  HARBOR_WATER_OUTER_RADIUS,
  MAX_PLANET_CHUNK_X,
  MAX_PLANET_CHUNK_Z,
  MIN_PLANET_CHUNK_X,
  MIN_PLANET_CHUNK_Z,
  MAX_STACK_SIZE,
  MAX_BUILD_HEIGHT,
  cityPropertyNear,
  isNearRestaurant,
  listCityProperties,
  isInsideResidence,
  listCityShops,
  PLANET_MAX_X,
  PLANET_MAX_Z,
  PLANET_LONGITUDE_BLOCKS,
  PLANET_MIN_X,
  PLANET_MIN_Z,
  RECIPES,
  WORLD_LOCATIONS,
  isNearBoatWorkshop,
  isNearHarbor,
  rollFishReward,
  raceTrackFootprint,
  terrainHeightAt,
  wrapPlanetX,
} from "./world.js";
import { MODEL_CATALOG, MODEL_ITEM_BY_ID } from "../shared/models.js";
import { CREATURE_HABITATS, getCreatureSpecies } from "../shared/creatures.js";
import { RESTAURANT_MENU_BY_ID } from "../shared/food.js";
import {
  CROP_HARVEST_ITEM,
  CROP_HEALING,
  CROP_HARVEST_SEEDS,
  CROP_HARVEST_YIELD,
  CROP_SEED_ITEM,
  cropStage,
  FARM_PLOTS,
  STARTING_SEED_COUNT,
} from "../shared/farm.js";
import {
  acceptMission,
  addMissionToBoard,
  MISSION_TEMPLATE_BY_ID,
  MISSION_TEMPLATES,
  createEmptyMissions,
  failMission,
  isMissionExpired,
  normalizeMissions,
  progressMission,
  refreshDailyMissions,
} from "../shared/missions.js";

const GAME_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST_DIR = resolve(GAME_DIR, "dist");
const DEFAULT_SAVE_DIRECTORY = resolve(GAME_DIR, ".data", "saves");
const ROOM_RECONNECT_GRACE_MS = 5 * 60 * 1000;
const AUTO_SAVE_INTERVAL_MS = 60_000;
const MAX_PLAYER_HEALTH = 100;
const DEFAULT_PROFILE_STATS = {
  blocksMined: 0,
  blocksPlaced: 0,
  itemsCrafted: 0,
  creaturesDefeated: 0,
  worldsSaved: 0,
};
const PLAYER_ATTACK_DAMAGE = 20;
const PLAYER_ATTACK_RANGE = 3.5;
const PLAYER_ATTACK_COOLDOWN_MS = 650;
const STARTING_COINS = 100;
const TANK_ATTACK_RANGE = 48;
const TANK_ATTACK_COOLDOWN_MS = 1800;
const TANK_ATTACK_DAMAGE = 45;
const TANK_BLAST_RADIUS = 2;
const BLOCK_REBUILD_DELAY_MS = 3 * 60 * 1000;
const STARTING_LOADOUT = [
  ["iron_armor", 1],
  ["wooden_sword", 1],
  ["shield", 1],
  [CROP_SEED_ITEM, STARTING_SEED_COUNT],
];
const PLAYER_WEAPON_DAMAGE = new Map([
  ["wooden_sword", 24],
  ["stone_sword", 28],
  ["iron_sword", 34],
  ["steel_sword", 42],
]);
const MONSTER_KILL_XP = 50;
const MONSTER_KILL_COINS = 25;
const XP_PER_LEVEL = 100;
const MONSTER_ATTACK_RANGE = 2;
const MONSTER_RESPAWN_MS = 8000;
const MAX_PLAYER_MAGIC_POTION_STACK = 3;
const AIRPORT = WORLD_LOCATIONS.find(({ id }) => id === "airport");
const ARMY_BASE = WORLD_LOCATIONS.find(({ id }) => id === "army-base");
const VEHICLE_SPAWNS = [
  { id: "starter-car", type: "car", x: -12, z: 0, color: "#d84f43", accent: "#f4d76a" },
  { id: "airport-plane", type: "plane", x: AIRPORT.x, z: AIRPORT.z - 20, yaw: Math.PI },
  { id: "airport-jet-1", type: "jet", x: AIRPORT.x, z: AIRPORT.z - 9, yaw: Math.PI, color: "#dfe6e8", accent: "#45a3c6" },
  { id: "airport-jet-2", type: "jet", x: AIRPORT.x, z: AIRPORT.z + 2, yaw: Math.PI, color: "#46505d", accent: "#e05d43" },
  { id: "airport-jet-3", type: "jet", x: AIRPORT.x, z: AIRPORT.z + 13, yaw: Math.PI, color: "#d7d2c8", accent: "#738854" },
  { id: "airport-car", type: "car", x: AIRPORT.x + 5, z: AIRPORT.z + 34, color: "#4385c5", accent: "#dcecff" },
  { id: "city-tank-1", type: "tank", x: ARMY_BASE.x + 10, z: ARMY_BASE.z + 10, color: "#687a45", accent: "#d0b16c" },
  { id: "city-tank-2", type: "tank", x: ARMY_BASE.x + 10, z: ARMY_BASE.z + 5, color: "#52614c", accent: "#d7d2bc" },
  { id: "city-tank-3", type: "tank", x: ARMY_BASE.x + 10, z: ARMY_BASE.z, color: "#53677a", accent: "#d9b468" },
  { id: "city-tank-4", type: "tank", x: ARMY_BASE.x + 10, z: ARMY_BASE.z - 5, color: "#786242", accent: "#c8d0d4" },
  { id: "city-tank-5", type: "tank", x: ARMY_BASE.x + 10, z: ARMY_BASE.z - 10, color: "#596b53", accent: "#b7c2a1" },
];
const CITY_CAR_PAINTS = [
  ["#d84f43", "#f4d76a"],
  ["#4385c5", "#dcecff"],
  ["#43a57b", "#f0d37a"],
  ["#e1a640", "#563f5c"],
  ["#865bb0", "#e4d0f0"],
  ["#e7e5df", "#303944"],
  ["#29333e", "#df5146"],
  ["#e77e48", "#fff0cf"],
  ["#ce5f88", "#f3d4df"],
  ["#52a8b5", "#eaf8ef"],
];

const RIVAL_TANK_PAINTS = [
  ["#8a3f3a", "#e8c17a"],
  ["#3e5a7a", "#d9e4ea"],
  ["#5b4a7a", "#f0d37a"],
  ["#4f6f4a", "#e0b070"],
  ["#7a6a3f", "#dfe8ea"],
];

const RACE_TRACK_POINTS = 48;
const RACE_CAR_STEP = 1.1; // units per race tick (250ms)
const RACE_CAR_COUNT = 4;
const RACE_CAR_PAINTS = [
  ["#f2c230", "#1d1d1d"],
  ["#e8e8e8", "#c4201b"],
  ["#2d8f4e", "#f5f5f5"],
  ["#1e5fbf", "#ffd23f"],
];

function isRaceCar(vehicle) {
  return vehicle.id.startsWith("race-car-");
}

// Average distance between track waypoints, used to convert car speed into waypoint progress.
function raceTrackSpacing(track) {
  let length = 0;
  for (let index = 0; index < track.length; index += 1) {
    const from = track[index];
    const to = track[(index + 1) % track.length];
    length += Math.hypot(to.x - from.x, to.z - from.z);
  }
  return length / track.length;
}

// Finds flat dry land for a racing oval and returns its waypoints, or null when none fits.
const raceTrackCache = new Map();
function findRaceTrack(seed) {
  if (raceTrackCache.has(seed)) return raceTrackCache.get(seed);
  const track = raceTrackFootprint(seed);
  raceTrackCache.set(seed, track);
  return track;
}

// Teleport/map entry for the racing track: its centre, using the track's waypoints for the seed.
function raceTrackLocation(seed) {
  const track = findRaceTrack(seed);
  if (!track) return null;
  const x = track.reduce((sum, point) => sum + point.x, 0) / track.length;
  const z = track.reduce((sum, point) => sum + point.z, 0) / track.length;
  return { id: "racing-track", name: "Racing Track", x, z, yaw: 0, type: "racing" };
}

function residenceLandingSpot(room, property) {
  const landingSpots = [
    [property.entranceX, property.entranceZ],
    [property.entranceX, property.entranceZ - 2],
    [property.entranceX - 2, property.entranceZ],
    [property.entranceX + 2, property.entranceZ],
    [property.entranceX, property.entranceZ + 2],
  ];
  return landingSpots.find(([x, z]) =>
    playerCanOccupy(room, x, terrainHeightAt(x, z, room.seed) + 2.65, z),
  );
}

// Finds dry land for the second army base, away from the first one.
function findRivalBaseCenter(seed) {
  for (let radius = 60; radius <= 220; radius += 10) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      const x = Math.round(ARMY_BASE.x + Math.cos(angle) * radius);
      const z = Math.round(ARMY_BASE.z + Math.sin(angle) * radius);
      if (terrainHeightAt(x, z, seed) < 3) continue;
      if (vehicleHasGroundClearance({ type: "tank" }, x, z, 0, seed)) return { x, z };
    }
  }
  return null;
}

function vehicleFootprint(type) {
  if (type === "tank") return { halfWidth: 1.45, halfLength: 1.9 };
  if (type === "plane") return { halfWidth: 2.4, halfLength: 1.9 };
  if (type === "jet") return { halfWidth: 2.8, halfLength: 3.15 };
  if (type === "car" || type === "police") return { halfWidth: 1.05, halfLength: 1.75 };
  return null;
}

function vehicleHasGroundClearance(vehicle, x, z, yaw, seed, blocks = null) {
  const footprint = vehicleFootprint(vehicle.type);
  if (!footprint || vehicle.airborne) return true;

  const ground = terrainHeightAt(x, z, seed);
  if (ground < 0) return false;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const blockMargin = (Math.abs(cos) + Math.abs(sin)) / 2;
  const searchRadius = Math.ceil(Math.hypot(footprint.halfWidth, footprint.halfLength) + 1);
  for (let blockX = Math.floor(x) - searchRadius; blockX <= Math.ceil(x) + searchRadius; blockX += 1) {
    for (let blockZ = Math.floor(z) - searchRadius; blockZ <= Math.ceil(z) + searchRadius; blockZ += 1) {
      const dx = wrapPlanetX(blockX - x);
      const dz = blockZ - z;
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;
      if (
        Math.abs(localX) > footprint.halfWidth + blockMargin ||
        Math.abs(localZ) > footprint.halfLength + blockMargin
      ) continue;
      if (terrainHeightAt(blockX, blockZ, seed) > ground) return false;
      for (let blockY = ground + 1; blockY <= ground + 2; blockY += 1) {
        const key = blockKey(blockX, blockY, blockZ);
        const type = blocks?.has(key) ? blocks.get(key) : getBaseBlockAt(blockX, blockY, blockZ, seed);
        if (type && type !== "water") return false;
      }
    }
  }
  return true;
}

function findClearVehiclePosition(vehicle, seed, blocks = null) {
  if (vehicleHasGroundClearance(vehicle, vehicle.x, vehicle.z, vehicle.yaw, seed, blocks)) {
    return { x: vehicle.x, z: vehicle.z, yaw: vehicle.yaw };
  }

  const isCityTraffic = vehicle.id.startsWith("city-car-") || vehicle.id.startsWith("city-police-");
  for (let radius = 1; radius <= 32; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const x = Math.round(vehicle.x + dx);
        const z = Math.round(vehicle.z + dz);
        if (isCityTraffic && getBaseBlockAt(x, 0, z, seed) !== "black_concrete") continue;
        const localX = ((x + CITY_BLOCK_SIZE / 2) % CITY_BLOCK_SIZE + CITY_BLOCK_SIZE) % CITY_BLOCK_SIZE - CITY_BLOCK_SIZE / 2;
        let yaw = vehicle.yaw;
        if (isCityTraffic) yaw = Math.abs(localX) >= 14 ? 0 : Math.PI / 2;
        if (vehicleHasGroundClearance(vehicle, x, z, yaw, seed, blocks)) return { x, z, yaw };
      }
    }
  }
  return null;
}
const BOAT_SIZES = new Map([
  ["skiff", { width: 1.8, length: 3.6, planks: 12 }],
  ["cutter", { width: 2.8, length: 5.4, planks: 24 }],
  ["galleon", { width: 3.8, length: 7.2, planks: 40 }],
]);
const BOAT_HULL_COLORS = new Set(["#765238", "#a16c42", "#4b6173", "#7c3f3f", "#4d6949"]);
const BOAT_SAIL_COLORS = new Set(["#eee2c6", "#b94a48", "#426c83", "#d4a84f", "#465348"]);

function levelForExperience(xp) {
  return Math.floor((Math.sqrt(1 + 8 * Math.max(0, xp) / XP_PER_LEVEL) - 1) / 2);
}

// Applies progress to the player's active mission, failing it first if its deadline has passed.
// Returns a notice string for the player, or null when nothing changed for them.
// Fails the active mission if its deadline has passed. Returns a notice string or null.
function expireMissionIfDue(player) {
  const missions = player.missions ?? createEmptyMissions();
  if (!isMissionExpired(missions, Date.now())) return null;
  const failed = failMission(missions);
  player.missions = failed.missions;
  player.coins = Math.max(0, (player.coins ?? 0) - failed.penalty);
  return `Mission expired. -${failed.penalty} coins.`;
}

function applyMissionEvent(player, type, amount) {
  let notice = expireMissionIfDue(player);
  let missions = player.missions ?? createEmptyMissions();
  const result = progressMission(missions, type, amount);
  missions = result.missions;
  if (result.completed) {
    player.coins = (player.coins ?? 0) + result.completed;
    if (result.xp) {
      player.xp = (player.xp ?? 0) + result.xp;
      player.level = levelForExperience(player.xp);
      writeJson(player.socket, { type: "xp", xp: player.xp, level: player.level });
    }
    notice = `Mission complete! +${result.completed} coins${result.xp ? ` · +${result.xp} XP` : ""}.`;
  }
  player.missions = missions;
  return notice;
}

// Records a job action (mining, cooking, repairs) and tells the player about any change.
function recordJobProgress(player, type, amount) {
  const notice = applyMissionEvent(player, type, amount);
  sendMissionState(player);
  writeJson(player.socket, { type: "currency", coins: player.coins });
  if (notice) writeJson(player.socket, { type: "mission_result", message: notice });
}

function sendMissionState(player) {
  writeJson(player.socket, { type: "missions", missions: player.missions ?? createEmptyMissions(), now: Date.now() });
}

function awardMonsterKill(player, monster) {
  const monsterLevel = Math.max(1, Math.floor(monster.level ?? 1));
  const xpGained = MONSTER_KILL_XP * monsterLevel;
  const coinsGained = MONSTER_KILL_COINS * monsterLevel;
  player.xp = (player.xp ?? 0) + xpGained;
  player.level = levelForExperience(player.xp);
  player.coins = (player.coins ?? 0) + coinsGained;
  const missionNotice = applyMissionEvent(player, "defeat", 1);
  sendMissionState(player);
  return {
    xp: player.xp,
    level: player.level,
    coins: player.coins,
    xpGained,
    coinsGained,
    monsterLevel,
    ...(missionNotice ? { missionNotice } : {}),
  };
}

function normalizeBoatDesign(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const size = BOAT_SIZES.has(input.size) ? input.size : null;
  const windows = [2, 4, 6].includes(input.windows) ? input.windows : null;
  const hullColor = BOAT_HULL_COLORS.has(input.hullColor) ? input.hullColor : null;
  const sailColor = BOAT_SAIL_COLORS.has(input.sailColor) ? input.sailColor : null;
  if (
    !size ||
    windows === null ||
    !hullColor ||
    !sailColor ||
    typeof input.cabin !== "boolean" ||
    typeof input.sail !== "boolean"
  ) return null;
  const name = typeof input.name === "string"
    ? input.name.replace(/[^\p{L}\p{N} -]/gu, "").trim().slice(0, 20)
    : "";
  return {
    name: name || "Sea Rover",
    size,
    windows,
    hullColor,
    sailColor,
    cabin: input.cabin,
    sail: input.sail,
  };
}

function boatMaterials(design) {
  const size = BOAT_SIZES.get(design.size);
  return {
    oak_planks: size.planks,
    glass: design.cabin ? design.windows : 0,
    oak_door: design.cabin ? 1 : 0,
  };
}

function createBoatSpawn(room) {
  for (let z = 168; z <= 184; z += 4) {
    for (let x = 17; x >= -17; x -= 5) {
      const surfaceKey = blockKey(x, 0, z);
      const surfaceBlock = room.blocks.has(surfaceKey)
        ? room.blocks.get(surfaceKey)
        : getBaseBlockAt(x, 0, z, room.seed);
      if (surfaceBlock !== "water") continue;
      const occupied = [...room.vehicles.values()].some((vehicle) =>
        Math.hypot(wrapPlanetX(vehicle.x - x), vehicle.z - z) < 7,
      );
      if (!occupied) return { x, z };
    }
  }
  return null;
}
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function writeJson(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function createBots(seed = 1) {
  const bots = new Map([
    ["bot-moss", { id: "bot-moss", name: "Moss", x: -4, z: -2, homeX: -4, homeZ: -2, yaw: 0, color: "#76b86d", targetX: -4, targetZ: -2, behavior: "idle", walking: false, nextDecisionAt: 0, stuckTicks: 0 }],
    ["bot-pebble", { id: "bot-pebble", name: "Pebble", x: 1, z: -5, homeX: 1, homeZ: -5, yaw: 0, color: "#d3a36e", targetX: 1, targetZ: -5, behavior: "idle", walking: false, nextDecisionAt: 0, stuckTicks: 0 }],
    ["bot-fern", { id: "bot-fern", name: "Fern", x: 8, z: 1, homeX: 8, homeZ: 1, yaw: 0, color: "#8f8ed3", targetX: 8, targetZ: 1, behavior: "idle", walking: false, nextDecisionAt: 0, stuckTicks: 0 }],
  ]);
  bots.set("bot-wren", { id: "bot-wren", name: "Wren", x: 4, z: 3, homeX: 4, homeZ: 3, yaw: Math.PI, color: "#e0a84b", targetX: 4, targetZ: 3, behavior: "idle", walking: false, nextDecisionAt: 0, stuckTicks: 0, missionGiver: true, missionTemplateId: "defeat-small" });
  addRoamingBots(bots, seed);
  const restaurantNames = ["Mira", "Ollie", "Rae", "Pip", "Jules", "Nori"];
  const restaurantColors = ["#a96f48", "#7d9b75", "#b56f62", "#7485a2", "#b68a4f", "#9479a8"];
  for (const shop of listCityShops(seed).filter(({ foodShop }) => foodShop)) {
    for (const [seat, role] of [[0, "server"], [1, "diner"]]) {
      const id = `${shop.id}-bot-${role}`;
      const x = shop.x + (seat === 0 ? -3 : 3);
      const z = shop.interiorZ + (seat === 0 ? -3 : -1);
      bots.set(id, {
        id,
        name: shop.bakery && role === "server" ? "Baker Bea" : restaurantNames[(Math.abs(shop.x) / CITY_BLOCK_SIZE + seat) % restaurantNames.length],
        x,
        z,
        homeX: x,
        homeZ: z,
        yaw: seat === 0 ? Math.PI / 2 : -Math.PI / 2,
        color: restaurantColors[(Math.abs(shop.x) / CITY_BLOCK_SIZE + seat) % restaurantColors.length],
        targetX: x,
        targetZ: z,
        behavior: role === "diner" ? "eating" : "serving",
        walking: false,
        seated: role === "diner",
        eating: role === "diner",
        restaurantShopId: shop.id,
        restaurantRole: role,
      });
    }
  }
  for (const [index, name] of ["Sage", "Tansy"].entries()) {
    const x = -30 + (index === 0 ? -10 : 10);
    const z = 22 + 8;
    bots.set(`bot-farmer-${index + 1}`, {
      id: `bot-farmer-${index + 1}`,
      name,
      x,
      z,
      homeX: x,
      homeZ: z,
      yaw: 0,
      color: "#c9a04d",
      targetX: x,
      targetZ: z,
      behavior: "farm",
      walking: false,
      nextDecisionAt: 0,
      stuckTicks: 0,
      farmer: true,
      farmPlotId: null,
      farmWaitUntil: 0,
    });
  }
  return bots;
}

const ROAMING_BOT_COUNT = 200;

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function addRoamingBots(bots, seed) {
  const random = createSeededRandom(seed + 7919);
  const firstNames = ["Ada", "Bram", "Cass", "Dov", "Eli", "Fae", "Gus", "Hana", "Ivo", "Juno", "Kit", "Lark", "Milo", "Nell", "Otto", "Pia"];
  const lastNames = ["Ash", "Brook", "Cole", "Dune", "Early", "Frost", "Glen", "Holt", "Lane", "Marsh", "North", "Rowe"];
  const colors = ["#c46b6b", "#6b9ac4", "#7fb069", "#c9a04d", "#9b6bc4", "#4dbfb0"];
  let placed = 0;
  const maxAttempts = ROAMING_BOT_COUNT * 200;
  for (let attempt = 0; attempt < maxAttempts && placed < ROAMING_BOT_COUNT; attempt += 1) {
    const x = Math.round(random() * 180 - 90);
    const z = Math.round(random() * 180 - 90);
    if (Math.hypot(x, z) < 12) continue;
    const ground = terrainHeightAt(x, z, seed);
    if (getBaseBlockAt(x, ground, z, seed) === "water") continue;
    const feetType = getBaseBlockAt(x, ground + 1, z, seed);
    const headType = getBaseBlockAt(x, ground + 2, z, seed);
    if ((feetType && feetType !== "water") || (headType && headType !== "water")) continue;
    let crowded = false;
    for (const other of bots.values()) {
      if (Math.hypot(other.x - x, other.z - z) < 4) {
        crowded = true;
        break;
      }
    }
    if (crowded) continue;
    const id = `bot-roam-${placed}`;
    const name = `${firstNames[placed % firstNames.length]} ${lastNames[Math.floor(placed / firstNames.length) % lastNames.length]}`;
    bots.set(id, {
      id,
      name,
      x,
      z,
      homeX: x,
      homeZ: z,
      yaw: 0,
      color: colors[placed % colors.length],
      targetX: x,
      targetZ: z,
      behavior: "idle",
      walking: false,
      nextDecisionAt: 0,
      stuckTicks: 0,
      missionGiver: placed % 3 === 0,
      missionTemplateId: MISSION_TEMPLATES[Math.floor(placed / 3) % MISSION_TEMPLATES.length].id,
    });
    placed += 1;
  }
}

// Some vehicles spawn damaged and need a repair job before they are fixed. The choice is fixed per vehicle id.
function spawnsDamaged(id) {
  if (id.startsWith("race-car-") || id.startsWith("player-boat-")) return false;
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3 === 0;
}

function createVehicles(seed = 1, mode = "survival") {
  const spawns = VEHICLE_SPAWNS.map((spawn) => {
    const position = findClearVehiclePosition({ ...spawn, yaw: spawn.yaw ?? 0 }, seed);
    return position ? { ...spawn, ...position } : spawn;
  });
  if (mode === "tank-war") {
    const rivalBase = findRivalBaseCenter(seed);
    if (rivalBase) {
      RIVAL_TANK_PAINTS.forEach(([color, accent], index) => {
        const candidate = {
          id: `rival-tank-${index + 1}`,
          type: "tank",
          x: rivalBase.x + 10,
          z: rivalBase.z + 10 - index * 5,
          color,
          accent,
        };
        const position = findClearVehiclePosition({ ...candidate, yaw: 0 }, seed);
        if (position) spawns.push({ ...candidate, ...position });
      });
    }
  }
  const raceTrack = findRaceTrack(seed);
  if (raceTrack) {
    RACE_CAR_PAINTS.forEach(([color, accent], index) => {
      const progress = (index * RACE_TRACK_POINTS) / RACE_CAR_COUNT;
      const start = raceTrack[Math.floor(progress)];
      const next = raceTrack[(Math.floor(progress) + 1) % raceTrack.length];
      spawns.push({
        id: `race-car-${index + 1}`,
        type: "car",
        x: start.x,
        z: start.z,
        yaw: Math.atan2(-(next.x - start.x), next.z - start.z),
        color,
        accent,
      });
    });
  }
  const cityRoadCandidates = [];
  for (let x = -100; x <= 100; x += 4) {
    for (let z = -100; z <= 100; z += 4) {
      const radius = Math.hypot(x, z);
      if (
        radius < 24 ||
        radius > 103 ||
        getBaseBlockAt(x, 0, z, seed) !== "black_concrete" ||
        getBaseBlockAt(x, 1, z, seed) !== null ||
        getBaseBlockAt(x, 2, z, seed) !== null
      ) continue;
      const localX = ((x + CITY_BLOCK_SIZE / 2) % CITY_BLOCK_SIZE + CITY_BLOCK_SIZE) % CITY_BLOCK_SIZE - CITY_BLOCK_SIZE / 2;
      const localZ = ((z + CITY_BLOCK_SIZE / 2) % CITY_BLOCK_SIZE + CITY_BLOCK_SIZE) % CITY_BLOCK_SIZE - CITY_BLOCK_SIZE / 2;
      const candidate = {
        x,
        z,
        yaw: Math.abs(localX) >= 14 ? 0 : Math.PI / 2,
      };
      if (vehicleHasGroundClearance({ type: "car" }, x, z, candidate.yaw, seed)) {
        cityRoadCandidates.push(candidate);
      }
    }
  }
  for (let index = 0; index < Math.min(20, cityRoadCandidates.length); index += 1) {
    const candidate = cityRoadCandidates[Math.floor((index + 0.5) * cityRoadCandidates.length / 20)];
    if (!candidate) continue;
    if (spawns.some((spawn) => Math.hypot(spawn.x - candidate.x, spawn.z - candidate.z) < 9)) continue;
    const [color, accent] = CITY_CAR_PAINTS[index % CITY_CAR_PAINTS.length];
    spawns.push({ id: `city-car-${index + 1}`, type: "car", ...candidate, color, accent });
  }
  let policeIndex = 0;
  for (const candidate of cityRoadCandidates) {
    const stationDistance = Math.hypot(candidate.x - CITY_POLICE_STATION.x, candidate.z - CITY_POLICE_STATION.z);
    if (stationDistance < 13 || stationDistance > 37) continue;
    if (spawns.some((spawn) => Math.hypot(spawn.x - candidate.x, spawn.z - candidate.z) < 9)) continue;
    spawns.push({
      id: `city-police-${policeIndex + 1}`,
      type: "police",
      ...candidate,
      color: "#f3f2e9",
      accent: "#2355a5",
    });
    policeIndex += 1;
    if (policeIndex >= 3) break;
  }
  const vehicles = new Map(spawns.map(({ id, type, x, z, yaw = 0, color, accent }) => [
    id,
    {
      id,
      type,
      ...(color ? { color, accent } : {}),
      ...(id.startsWith("city-car-") || id.startsWith("city-police-")
        ? { laneAxis: yaw === 0 ? "z" : "x", laneDir: 1, stopped: false }
        : {}),
      ...(id.startsWith("race-car-")
        ? { raceProgress: ((Number(id.slice("race-car-".length)) - 1) * RACE_TRACK_POINTS) / RACE_CAR_COUNT }
        : {}),
      x,
      y: terrainHeightAt(x, z, seed),
      z,
      yaw,
      turretYaw: 0,
      turretPitch: 0,
      health: 100,
      maxHealth: 100,
      airborne: false,
      damaged: spawnsDamaged(id),
      occupantId: null,
    },
  ]));
  vehicles.raceTrack = raceTrack;
  return vehicles;
}

function restoreVehicles(savedVehicles, seed, blocks = null) {
  const vehicles = createVehicles(seed);
  if (!Array.isArray(savedVehicles)) return vehicles;
  for (const savedVehicle of savedVehicles) {
    if (
      !savedVehicle ||
      typeof savedVehicle.id !== "string" ||
      !Number.isFinite(savedVehicle.x) ||
      !Number.isFinite(savedVehicle.z)
    ) continue;
    const existing = vehicles.get(savedVehicle.id);
    if (!existing) {
      const design = savedVehicle.type === "boat" ? normalizeBoatDesign(savedVehicle.design) : null;
      if (
        !design ||
        !/^player-boat-[0-9a-f-]{36}$/i.test(savedVehicle.id) ||
        typeof savedVehicle.ownerId !== "string" ||
        !Number.isFinite(savedVehicle.yaw)
      ) continue;
      vehicles.set(savedVehicle.id, {
        id: savedVehicle.id,
        type: "boat",
        x: wrapPlanetX(savedVehicle.x),
        y: 0,
        z: savedVehicle.z,
        yaw: savedVehicle.yaw,
        design,
        ownerId: savedVehicle.ownerId,
        occupantId: null,
      });
      continue;
    }
    const restoredVehicle = {
      ...existing,
      ...savedVehicle,
      y: Number.isFinite(savedVehicle.y) ? savedVehicle.y : existing.y,
      turretYaw: Number.isFinite(savedVehicle.turretYaw)
        ? Math.atan2(Math.sin(savedVehicle.turretYaw), Math.cos(savedVehicle.turretYaw))
        : Number.isFinite(savedVehicle.yaw) ? savedVehicle.yaw : existing.turretYaw,
      turretPitch: Number.isFinite(savedVehicle.turretPitch)
        ? Math.max(-0.45, Math.min(0.65, savedVehicle.turretPitch))
        : existing.turretPitch,
      health: Number.isFinite(savedVehicle.health)
        ? Math.max(1, Math.min(existing.maxHealth ?? 100, savedVehicle.health))
        : existing.health,
      airborne: savedVehicle.type === "plane" || savedVehicle.type === "jet"
        ? savedVehicle.airborne === true
        : false,
      occupantId: null,
    };
    if (!vehicleHasGroundClearance(
      restoredVehicle,
      restoredVehicle.x,
      restoredVehicle.z,
      restoredVehicle.yaw,
      seed,
      blocks,
    )) {
      const safePosition = findClearVehiclePosition(existing, seed, blocks);
      if (safePosition) {
        Object.assign(restoredVehicle, safePosition, { y: terrainHeightAt(safePosition.x, safePosition.z, seed) });
      } else {
        Object.assign(restoredVehicle, existing);
      }
    }
    vehicles.set(savedVehicle.id, restoredVehicle);
  }
  return vehicles;
}

function createAnimals(seed = 1) {
  const animals = new Map();
  for (const [habitatIndex, habitat] of CREATURE_HABITATS.entries()) {
    habitat.spawnPoints.forEach(([x, z], slot) => {
      const speciesIndex = ((Math.imul(seed >>> 0, 31) >>> 0) + habitatIndex * 67 + slot * 43) % habitat.species.length;
      const species = getCreatureSpecies(habitat.id, speciesIndex);
      const id = `animal-${habitat.id}-${slot}`;
      const ground = terrainHeightAt(x, z, seed);
      const horse = habitat.id === "farm" && slot < 2;
      animals.set(id, {
        id,
        species: species.id,
        name: horse ? (slot === 0 ? "Meadow Horse" : "Chestnut Horse") : species.name,
        model: horse ? "horse" : species.model,
        color: horse ? (slot === 0 ? "#b58b5c" : "#75472f") : species.color,
        habitat: species.habitat,
        aquatic: species.aquatic,
        scale: species.scale,
        pattern: species.pattern,
        x,
        y: species.aquatic ? ground + 3 : ground + 1,
        z,
        yaw: 0,
        homeX: x,
        homeZ: z,
        targetX: x,
        targetZ: z,
        walking: false,
        riderId: null,
      });
    });
  }
  const dragonHomes = [
    { x: 484, z: 52, name: "Emberwing" },
    { x: -516, z: -100, name: "Stormscale" },
    { x: 112, z: 350, name: "Cloudfire" },
    { x: 30, z: 64, name: "Sunstreak" },
    { x: -180, z: 250, name: "Peakflame" },
    { x: -270, z: -336, name: "Frostglide" },
  ];
  dragonHomes.forEach((home, index) => {
    const x = home.x + ((seed >>> 0) % 13) - 6;
    const z = home.z + (((seed >>> 4) >>> 0) % 13) - 6;
    const id = `animal-dragon-${index}`;
    animals.set(id, {
      id,
      species: `dragon-${index}`,
      name: home.name,
      model: "dragon",
      color: ["#c85d3a", "#6879bf", "#d69b4c", "#e7a83d", "#8a5eb5", "#8dc9dc"][index],
      habitat: "sky",
      aquatic: false,
      flying: true,
      scale: 1.4,
      pattern: index,
      x,
      y: terrainHeightAt(x, z, seed) + 24,
      z,
      yaw: 0,
      homeX: x,
      homeZ: z,
      targetX: x,
      targetZ: z,
      walking: false,
      flightPhase: index * 2,
      flightAltitude: 24 + index * 3,
      flightSpeed: 0.16 + index * 0.02,
    });
  });
  return animals;
}

function serializeCrops(room) {
  const now = Date.now();
  return FARM_PLOTS.flatMap((plot) => {
    const crop = room.crops?.get(plot.id);
    if (!crop) return [];
    return [{ id: plot.id, x: plot.x, z: plot.z, stage: cropStage(crop, now) }];
  });
}

function serializeAnimals(room) {
  return [...room.animals.values()].map(({ id, species, name, model, color, habitat, aquatic, flying, scale, pattern, x, y, z, yaw, walking, riderId }) => ({
    id,
    species,
    name,
    model,
    color,
    habitat,
    aquatic,
    flying,
    scale,
    pattern,
    x,
    y,
    z,
    yaw,
    walking,
    riderId: riderId ?? null,
  }));
}

function createMonsters() {
  return new Map([
    ["monster-crab", {
      id: "monster-crab", name: "Dune Crab", species: "crab", level: 1, damage: 8, x: 0, z: 126, yaw: 0, color: "#e58154",
      homeX: 0, homeZ: 126, targetX: 0, targetZ: 126, health: 60, maxHealth: 60, respawnAt: 0, boss: false, active: true,
    }],
    ["monster-slime", {
      id: "monster-slime", name: "Moss Slime", species: "slime", level: 2, damage: 10, x: 4, z: 210, yaw: 0, color: "#79c66f",
      homeX: 4, homeZ: 210, targetX: 4, targetZ: 210, health: 70, maxHealth: 70, respawnAt: 0, boss: false, active: true,
    }],
    ["monster-wisp", {
      id: "monster-wisp", name: "Highland Wisp", species: "wisp", level: 3, damage: 12, x: 44, z: 284, yaw: 0, color: "#76cbd1",
      homeX: 44, homeZ: 284, targetX: 44, targetZ: 284, health: 90, maxHealth: 90, respawnAt: 0, boss: false, active: true,
    }],
    ["monster-skeleton", {
      id: "monster-skeleton", name: "Crypt Skeleton", species: "skeleton", level: 4, damage: 14, x: -150, z: 112, yaw: 0, color: "#d0dae8",
      homeX: -150, homeZ: 112, targetX: -150, targetZ: 112, health: 120, maxHealth: 120, respawnAt: 0, boss: false, active: false,
    }],
    ["monster-warden", {
      id: "monster-warden", name: "Mine Warden", species: "warden", level: 6, damage: 18, x: -120, z: -171, yaw: 0, color: "#a9e0b3",
      homeX: -120, homeZ: -171, targetX: -120, targetZ: -171, health: 180, maxHealth: 180, respawnAt: 0, boss: false, active: false,
    }],
    ["boss-ashen-king", {
      id: "boss-ashen-king", name: "Ashen King", species: "boss", level: 10, damage: 26, x: 160, z: -120, yaw: 0, color: "#ffb166",
      homeX: 160, homeZ: -120, targetX: 160, targetZ: -120, health: 320, maxHealth: 320, respawnAt: 0, boss: true, active: false,
    }],
    ["monster-spider", {
      id: "monster-spider", name: "Thicket Spider", species: "spider", level: 3, damage: 12, x: 12, z: 222, yaw: 0, color: "#a56e52",
      homeX: 12, homeZ: 222, targetX: 12, targetZ: 222, health: 90, maxHealth: 90, respawnAt: 0, boss: false, active: false,
    }],
    ["monster-golem", {
      id: "monster-golem", name: "Ashvault Golem", species: "golem", level: 7, damage: 20, x: 523, z: 35, yaw: 0, color: "#92776b",
      homeX: 523, homeZ: 35, targetX: 523, targetZ: 35, health: 220, maxHealth: 220, respawnAt: 0, boss: false, active: false,
    }],
    ["monster-phantom", {
      id: "monster-phantom", name: "Dragonpeak Phantom", species: "phantom", level: 8, damage: 22, x: -180, z: 250, yaw: 0, color: "#8872d6",
      homeX: -180, homeZ: 250, targetX: -180, targetZ: 250, health: 250, maxHealth: 250, respawnAt: 0, boss: false, active: false,
    }],
    ["monster-dragon", {
      id: "monster-dragon", name: "Cinderwing Dragon", species: "dragon", level: 9, damage: 24, x: 220, z: 270, yaw: 0, color: "#d96b45",
      homeX: 220, homeZ: 270, targetX: 220, targetZ: 270, health: 300, maxHealth: 300, respawnAt: 0, boss: true, active: false,
    }],
  ]);
}

function serializeMonsters(room) {
  return [...room.monsters.values()]
    .filter((monster) => monster.health > 0 && monster.active !== false)
    .map(({ id, name, species, level, x, z, yaw, color, health, maxHealth, boss }) => ({
      id,
      name,
      species,
      level,
      x,
      z,
      yaw,
      color,
      health,
      maxHealth,
      boss: Boolean(boss),
    }));
}

function validPlayerPosition(position) {
  return (
    position !== null &&
    typeof position === "object" &&
    Number.isFinite(position.x) &&
    (position.y === undefined || (
      Number.isFinite(position.y) &&
      position.y >= BEDROCK_Y &&
      position.y <= MAX_BUILD_HEIGHT + 2
    )) &&
    Number.isFinite(position.z) &&
    Number.isFinite(position.yaw) &&
    position.x >= PLANET_MIN_X &&
    position.x < PLANET_MIN_X + PLANET_LONGITUDE_BLOCKS &&
    position.z >= PLANET_MIN_Z &&
    position.z <= PLANET_MAX_Z
  );
}

function safeName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/[<>]/g, "").slice(0, 16);
  return name.length > 0 ? name : null;
}

function createInventory(mode = "survival") {
  return mode === "design"
    ? new Map([...new Set([...BLOCK_TYPES, ...MODEL_CATALOG.map(({ id }) => id)])].map((item) => [item, 64]))
    : new Map(STARTING_LOADOUT);
}

function fillDesignInventory(inventory) {
  for (const [item, count] of createInventory("design")) {
    inventory.set(item, Math.max(Number(inventory.get(item)) || 0, count));
  }
  return inventory;
}

function addItems(inventory, item, amount) {
  const current = inventory.get(item) ?? 0;
  inventory.set(item, current + amount);
  return true;
}

function removeItems(inventory, item, amount) {
  const remaining = (inventory.get(item) ?? 0) - amount;
  if (remaining < 0) return false;
  if (remaining === 0) inventory.delete(item);
  else inventory.set(item, remaining);
  return true;
}

function inventoryItems(inventory) {
  return [...inventory].sort(([left], [right]) => left.localeCompare(right));
}

function getPlayerAttackPower(player) {
  const base = PLAYER_ATTACK_DAMAGE + (player.gearTier ?? 0) * 6;
  if ((player.buffs ?? {}).strengthPotion) return base + 12;
  return base;
}

function applyPotionEffect(player, potionId) {
  if (potionId === "health_potion") {
    player.health = Math.min(MAX_PLAYER_HEALTH + (player.gearTier ?? 0) * 8, (player.health ?? 0) + 24);
    return { type: "health", amount: 24, message: "You feel your wounds close." };
  }
  if (potionId === "strength_potion") {
    player.buffs = { ...(player.buffs ?? {}), strengthPotion: Date.now() + 25_000 };
    return { type: "strength", amount: 12, message: "Your strength surges for a short time." };
  }
  return { type: "none", amount: 0, message: "That item does not work as a potion." };
}

function doorBaseYAt(room, x, y, z) {
  if (getRoomBlockAt(room, x, y - 1, z) === "oak_door") return y - 1;
  if (getRoomBlockAt(room, x, y, z) === "oak_door") return y;
  return null;
}

function getRoomBlockAt(room, x, y, z) {
  const key = blockKey(x, y, z);
  return room.blocks.has(key) ? room.blocks.get(key) : getBaseBlockAt(x, y, z, room.seed);
}

// True when a block of the given type sits within three cells of the player.
function hasNearbyBlock(room, player, blockType) {
  if (!room) return false;
  const px = Math.round(player.x);
  const py = Math.round(player.y);
  const pz = Math.round(player.z);
  for (let dx = -3; dx <= 3; dx += 1) {
    for (let dy = -1; dy <= 2; dy += 1) {
      for (let dz = -3; dz <= 3; dz += 1) {
        if (getRoomBlockAt(room, wrapPlanetX(px + dx), py + dy, pz + dz) === blockType) return true;
      }
    }
  }
  return false;
}

function cachedBaseBlockAt(room, x, y, z) {
  room.baseBlockCache ??= new Map();
  const key = blockKey(x, y, z);
  if (!room.baseBlockCache.has(key)) room.baseBlockCache.set(key, getBaseBlockAt(x, y, z, room.seed));
  return room.baseBlockCache.get(key);
}

function entityCanOccupy(room, x, z, feetY, radius = 0.3) {
  for (const offsetX of [-radius, 0, radius]) {
    for (const offsetZ of [-radius, 0, radius]) {
      const blockX = Math.round(x + offsetX);
      const blockZ = Math.round(z + offsetZ);
      for (const blockY of [feetY, feetY + 1]) {
        const key = blockKey(blockX, blockY, blockZ);
        const type = room.blocks.has(key)
          ? room.blocks.get(key)
          : cachedBaseBlockAt(room, blockX, blockY, blockZ);
        const doorBaseY = type === "oak_door" ? doorBaseYAt(room, blockX, blockY, blockZ) : null;
        const openDoor = doorBaseY !== null &&
          room.openDoors?.has(blockKey(blockX, doorBaseY, blockZ));
        if (type && type !== "water" && (type !== "oak_door" || !openDoor)) return false;
      }
    }
  }
  return true;
}

function botCanMove(room, bot, x, z) {
  const blockX = Math.round(x);
  const blockZ = Math.round(z);
  const nextGround = terrainHeightAt(blockX, blockZ, room.seed);
  const currentGround = terrainHeightAt(Math.round(bot.x), Math.round(bot.z), room.seed);
  if (nextGround > currentGround + 1.05) return false;
  return entityCanOccupy(room, x, z, nextGround + 1, bot.aquatic ? 0.2 : 0.35);
}

const BOT_SIMULATION_RANGE = 60;

// Bots far from every player are not simulated or sent to clients.
function isBotNearPlayers(room, players, bot) {
  for (const id of room.members) {
    const candidate = players.get(id);
    if (candidate && Math.hypot(candidate.x - bot.x, candidate.z - bot.z) <= BOT_SIMULATION_RANGE) return true;
  }
  return false;
}

function chooseBotStep(room, bot, step) {
  const targetX = bot.targetX - bot.x;
  const targetZ = bot.targetZ - bot.z;
  const distance = Math.hypot(targetX, targetZ);
  if (distance < 0.001) return null;
  const desiredAngle = Math.atan2(targetZ, targetX);
  const direction = Math.sign((bot.id.charCodeAt(bot.id.length - 1) || 0) % 2 ? 1 : -1);
  const offsets = [0, direction * Math.PI / 6, -direction * Math.PI / 6, direction * Math.PI / 3, -direction * Math.PI / 3, direction * Math.PI / 2, -direction * Math.PI / 2];
  let best = null;
  let bestScore = -Infinity;
  for (const offset of offsets) {
    const angle = desiredAngle + offset;
    const probeX = bot.x + Math.cos(angle) * Math.max(step * 2, 0.8);
    const probeZ = bot.z + Math.sin(angle) * Math.max(step * 2, 0.8);
    if (!botCanMove(room, bot, probeX, probeZ)) continue;
    const nextX = bot.x + Math.cos(angle) * step;
    const nextZ = bot.z + Math.sin(angle) * step;
    if (!botCanMove(room, bot, nextX, nextZ)) continue;
    let separationScore = 0;
    let collidesWithBot = false;
    for (const other of room.bots.values()) {
      if (other.id === bot.id) continue;
      const currentDistance = Math.hypot(bot.x - other.x, bot.z - other.z);
      const nextDistance = Math.hypot(nextX - other.x, nextZ - other.z);
      if (nextDistance < 1.15 && nextDistance <= currentDistance) {
        collidesWithBot = true;
        break;
      }
      separationScore += Math.min(nextDistance, 4) * 0.08;
    }
    if (collidesWithBot) continue;
    const alignment = Math.cos(offset);
    const score = alignment - Math.abs(offset) * 0.06 + separationScore;
    if (score > bestScore) {
      best = { x: nextX, z: nextZ, angle };
      bestScore = score;
    }
  }
  return best;
}

const BOT_TALK_DURATION_MS = 10000;
const BOT_STEP = 1.05; // units per bot tick (250ms), matching the 4.2 units/s on-foot player speed
const CITY_CAR_STEP = 1.2; // units per traffic tick (250ms)
const CITY_CAR_STOP_AHEAD = 5; // a city car stops when someone is this close ahead in its lane
const ROAD_CAR_CLEARANCE = 9; // bots wait before stepping onto a road this close to a moving car

function isCityCar(vehicle) {
  return vehicle.id.startsWith("city-car-") || vehicle.id.startsWith("city-police-");
}

function isRoadAt(room, x, z) {
  return getBaseBlockAt(Math.round(x), 0, Math.round(z), room.seed) === "black_concrete";
}

// Cars drive on black or white street tiles, since crosswalks and lane lines at crossings are white.
function isCityStreetAt(room, x, z) {
  const type = getBaseBlockAt(Math.round(x), 0, Math.round(z), room.seed);
  return type === "black_concrete" || type === "white_concrete";
}

// True when a moving city car is close enough that a bot should wait before stepping onto the road.
function movingCarNear(room, x, z) {
  for (const vehicle of room.vehicles.values()) {
    if (!isCityCar(vehicle) || vehicle.occupantId || vehicle.stopped) continue;
    if (Math.hypot(wrapPlanetX(vehicle.x - x), vehicle.z - z) <= ROAD_CAR_CLEARANCE) return true;
  }
  return false;
}

// True when a player or bot stands on the car's lane a few units ahead of it.
function pedestrianAhead(room, vehicle, axis, dir, players) {
  const isBlocking = (x, z) => {
    const offsetX = wrapPlanetX(x - vehicle.x);
    const along = (axis === "z" ? z - vehicle.z : offsetX) * dir;
    const across = axis === "z" ? Math.abs(offsetX) : Math.abs(z - vehicle.z);
    return along > 0 && along <= CITY_CAR_STOP_AHEAD && across <= 1.5;
  };
  for (const id of room.members) {
    const player = players.get(id);
    if (!player || player.health <= 0 || player.vehicleId) continue;
    if (isBlocking(player.x, player.z)) return true;
  }
  for (const bot of room.bots.values()) {
    if (!bot.restaurantShopId && isBlocking(bot.x, bot.z)) return true;
  }
  return false;
}

// Streets run along the cell grid, centred on x and z = 16 + 32k. Cars drive about 2 units either side of a
// street centre line, and crossings fall on the centre lines.
const CITY_LANE_OFFSET = 2;

// The nearest street centre line to a coordinate.
function nearestCityStreet(value) {
  const origin = CITY_BLOCK_SIZE / 2;
  return CITY_BLOCK_SIZE * Math.round((value - origin) / CITY_BLOCK_SIZE) + origin;
}

// The next crossing ahead of a coordinate when travelling in direction dir (+1 or -1).
function nextCityStreetAhead(value, dir) {
  const nearest = nearestCityStreet(value);
  return (nearest - value) * dir >= -1e-6 ? nearest : nearest + dir * CITY_BLOCK_SIZE;
}

// Drives unoccupied city cars around the street grid. Cars never U-turn on a straight street. At each crossing
// they pick straight on, left or right at random, so they keep circulating. They only turn around at a dead end.
export function updateCityTraffic(room, players) {
  for (const vehicle of room.vehicles.values()) {
    if (!isCityCar(vehicle) || vehicle.occupantId) continue;
    let axis = vehicle.laneAxis ?? "z";
    let dir = vehicle.laneDir ?? 1;
    if (pedestrianAhead(room, vehicle, axis, dir, players)) {
      vehicle.stopped = true;
      continue;
    }
    vehicle.stopped = false;

    const along = axis === "x" ? vehicle.x : vehicle.z;
    const ahead = nextCityStreetAhead(along, dir);
    const crossingKey = `${axis}:${ahead}`;
    if ((ahead - along) * dir <= CITY_CAR_STEP && vehicle.crossingKey !== crossingKey) {
      vehicle.crossingKey = crossingKey;
      // Reach the crossing, then pick a route: straight on, or turn left or right.
      if (axis === "x") vehicle.x = ahead;
      else vehicle.z = ahead;
      const perp = axis === "x" ? "z" : "x";
      const perpValue = axis === "x" ? vehicle.z : vehicle.x;
      const side = perpValue >= nearestCityStreet(perpValue) ? 1 : -1;
      const routes = [
        { axis, dir },
        { axis: perp, dir: side },
        { axis: perp, dir: -side },
      ].sort(() => Math.random() - 0.5);
      const route = routes.find((candidate) => {
        const trialX = candidate.axis === "x" ? vehicle.x + candidate.dir * CITY_CAR_STEP : vehicle.x;
        const trialZ = candidate.axis === "z" ? vehicle.z + candidate.dir * CITY_CAR_STEP : vehicle.z;
        return isCityStreetAt(room, trialX, trialZ);
      });
      if (route) {
        if (route.axis !== axis) {
          // Turning: move onto the lane of the new street, keeping the same side of its centre line.
          if (route.axis === "x") vehicle.z = nearestCityStreet(vehicle.z) + side * CITY_LANE_OFFSET;
          else vehicle.x = nearestCityStreet(vehicle.x) + side * CITY_LANE_OFFSET;
        }
        axis = route.axis;
        dir = route.dir;
      } else {
        dir = -dir;
      }
      vehicle.laneAxis = axis;
      vehicle.laneDir = dir;
    }

    const nextX = axis === "x" ? vehicle.x + dir * CITY_CAR_STEP : vehicle.x;
    const nextZ = axis === "z" ? vehicle.z + dir * CITY_CAR_STEP : vehicle.z;
    if (!isCityStreetAt(room, nextX, nextZ)) {
      // Dead end, such as the edge of the city: turn around.
      vehicle.laneDir = -dir;
      continue;
    }
    vehicle.x = nextX;
    vehicle.z = nextZ;
    vehicle.y = terrainHeightAt(nextX, nextZ, room.seed);
    vehicle.yaw = axis === "z" ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
}

// Racer cars loop the racing oval at a steady pace. A player can still enter one and drive it.
function updateRaceCars(room) {
  const track = room.vehicles.raceTrack;
  if (!track) return;
  const spacing = raceTrackSpacing(track);
  for (const vehicle of room.vehicles.values()) {
    if (!isRaceCar(vehicle) || vehicle.occupantId) continue;
    const count = track.length;
    vehicle.raceProgress = (vehicle.raceProgress + RACE_CAR_STEP / spacing) % count;
    const index = Math.floor(vehicle.raceProgress);
    const fraction = vehicle.raceProgress - index;
    const from = track[index];
    const to = track[(index + 1) % count];
    const x = from.x + (to.x - from.x) * fraction;
    const z = from.z + (to.z - from.z) * fraction;
    vehicle.x = x;
    vehicle.z = z;
    vehicle.y = terrainHeightAt(x, z, room.seed);
    vehicle.yaw = Math.atan2(-(to.x - from.x), to.z - from.z);
  }
}

// Two-player racing: a host invites a player, both ready up, then each drives a free race car.
const RACE_DUEL_HIT_DISTANCE = 3;
const RACE_DUEL_HIT_DAMAGE = 25;
const RACE_DUEL_HIT_COOLDOWN_MS = 800;
const RACE_DUEL_OFF_TRACK_DISTANCE = 6;
const RACE_DUEL_TIME_LIMIT_MS = 60000;
const RACE_CAR_RESPAWN_MS = 30000;

function sendToPlayers(ids, message) {
  for (const id of ids) {
    const target = players.get(id);
    if (target?.socket) writeJson(target.socket, message);
  }
}

function distanceToRaceTrack(track, x, z) {
  let best = Infinity;
  for (const point of track) best = Math.min(best, Math.hypot(wrapPlanetX(x - point.x), z - point.z));
  return best;
}

function endRaceDuel(room, winnerId, reason) {
  const duel = room.raceDuel;
  if (!duel) return;
  const ids = [duel.hostId, duel.guestId];
  room.raceDuel = null;
  for (const id of ids) {
    const participant = players.get(id);
    if (participant) releaseVehicle(room, participant);
  }
  sendToPlayers(ids, { type: "race_duel", status: "ended", winnerId: winnerId ?? null, reason });
  broadcastToRoom(room, roomSnapshot(room));
}

// Runs each tick while a duel is racing: pushes the cars apart on contact, applies damage,
// destroys cars that run out of health, and ends the duel when a car leaves the track.
function updateRaceDuels(room, now = Date.now()) {
  const duel = room.raceDuel;
  if (!duel || duel.status !== "racing") return;
  const hostPlayer = players.get(duel.hostId);
  const guestPlayer = players.get(duel.guestId);
  const hostCar = hostPlayer?.vehicleId ? room.vehicles.get(hostPlayer.vehicleId) : null;
  const guestCar = guestPlayer?.vehicleId ? room.vehicles.get(guestPlayer.vehicleId) : null;
  if (!hostCar || !guestCar) {
    const winner = hostCar ? duel.hostId : guestCar ? duel.guestId : null;
    endRaceDuel(room, winner, "A driver left the race.");
    return;
  }
  if (now - duel.startedAt > RACE_DUEL_TIME_LIMIT_MS) {
    const winner = hostCar.health === guestCar.health ? null : hostCar.health > guestCar.health ? duel.hostId : duel.guestId;
    endRaceDuel(room, winner, "Time is up.");
    return;
  }

  const dx = wrapPlanetX(hostCar.x - guestCar.x);
  const dz = hostCar.z - guestCar.z;
  const distance = Math.hypot(dx, dz);
  if (distance < RACE_DUEL_HIT_DISTANCE) {
    const length = distance || 1;
    const push = (RACE_DUEL_HIT_DISTANCE - distance) / 2 + 0.5;
    const nx = dx / length;
    const nz = dz / length;
    const moves = [
      [hostPlayer, hostCar, nx, nz],
      [guestPlayer, guestCar, -nx, -nz],
    ];
    for (const [participant, car, sx, sz] of moves) {
      car.x = wrapPlanetX(car.x + sx * push);
      car.z += sz * push;
      car.y = terrainHeightAt(car.x, car.z, room.seed);
      participant.x = car.x;
      participant.z = car.z;
      participant.y = car.y + 2.65;
      sendToPlayers([participant.id], {
        type: "teleport_result",
        position: { x: participant.x, y: participant.y, z: participant.z, yaw: participant.yaw },
        targetId: null,
        locationId: null,
        locationName: null,
      });
    }
    if (now - duel.lastHitAt > RACE_DUEL_HIT_COOLDOWN_MS) {
      duel.lastHitAt = now;
      hostCar.health = Math.max(0, hostCar.health - RACE_DUEL_HIT_DAMAGE);
      guestCar.health = Math.max(0, guestCar.health - RACE_DUEL_HIT_DAMAGE);
    }
  }

  const track = room.vehicles.raceTrack;
  const cars = [
    { participantId: duel.hostId, car: hostCar, otherId: duel.guestId },
    { participantId: duel.guestId, car: guestCar, otherId: duel.hostId },
  ];
  for (const { participantId, car, otherId } of cars) {
    if (car.health <= 0) {
      room.vehicles.delete(car.id);
      const respawn = { ...car, health: car.maxHealth, occupantId: null };
      setTimeout(() => room.vehicles.set(respawn.id, respawn), RACE_CAR_RESPAWN_MS);
      endRaceDuel(room, otherId, "A race car was destroyed.");
      return;
    }
    if (track && distanceToRaceTrack(track, car.x, car.z) > RACE_DUEL_OFF_TRACK_DISTANCE) {
      endRaceDuel(room, otherId, "A driver was pushed off the track.");
      return;
    }
  }
}

// Farmer bots walk to a ripe plot to harvest it, or an empty plot to plant it, then wait briefly.
function updateFarmerBot(room, bot, now) {
  if (now < bot.farmWaitUntil) return;
  room.crops ??= new Map();
  const ripe = FARM_PLOTS.find((plot) => {
    const crop = room.crops.get(plot.id);
    return crop && cropStage(crop, now) === "ripe";
  });
  const claimedByOther = (plot) => [...room.bots.values()].some((other) => (
    other !== bot && other.farmer && other.farmPlotId === plot.id
  ));
  const plot = ripe ?? FARM_PLOTS.find((candidate) => !room.crops.has(candidate.id) && !claimedByOther(candidate));
  if (!plot) return;
  bot.farmPlotId = plot.id;
  bot.targetX = plot.x + 2;
  bot.targetZ = plot.z;
  if (Math.hypot(wrapPlanetX(bot.x - plot.x), bot.z - plot.z) > 2.5) return;
  if (ripe) room.crops.delete(plot.id);
  else room.crops.set(plot.id, { plantedAt: now, ownerId: bot.id });
  bot.farmPlotId = null;
  bot.farmWaitUntil = now + 2000;
  bot.targetX = bot.x;
  bot.targetZ = bot.z;
}

// While a player talks to a villager, the villager stands still and faces that player.
function engageBotWithPlayer(bot, player, now = Date.now()) {
  bot.talkingPlayerId = player.id;
  bot.talkUntil = now + BOT_TALK_DURATION_MS;
  bot.targetX = bot.x;
  bot.targetZ = bot.z;
  bot.walking = false;
  bot.stuckTicks = 0;
  faceBotToward(bot, player);
}

function faceBotToward(bot, target) {
  const angle = Math.atan2(target.z - bot.z, wrapPlanetX(target.x - bot.x));
  bot.yaw = Math.atan2(-Math.cos(angle), Math.sin(angle));
}

function chooseBotWanderTarget(room, bot) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * 9;
    const x = bot.homeX + Math.cos(angle) * radius;
    const z = bot.homeZ + Math.sin(angle) * radius;
    if (botCanMove(room, bot, x, z)) return { x, z };
  }
  return { x: bot.homeX, z: bot.homeZ };
}

function playerCanOccupy(room, x, eyeY, z) {
  const feetY = Math.floor(eyeY - 1.65 + 0.05);
  return entityCanOccupy(room, x, z, feetY, 0);
}

function releaseVehicle(room, player) {
  const vehicle = room?.vehicles.get(player.vehicleId);
  if (vehicle?.occupantId === player.id) vehicle.occupantId = null;
  const mount = room?.animals.get(player.mountId);
  if (mount?.riderId === player.id) {
    mount.riderId = null;
    mount.walking = false;
    mount.homeX = mount.x;
    mount.homeZ = mount.z;
    mount.targetX = mount.x;
    mount.targetZ = mount.z;
  }
  player.vehicleId = null;
  player.mountId = null;
  player.sittingAt = null;
}

function restoreSavedRoom(saved) {
  if (!saved || typeof saved !== "object") return null;
  const blockChanges = new Map(Array.isArray(saved.blockChanges) ? saved.blockChanges : []);
  const savedPlayers = new Map((Array.isArray(saved.players) ? saved.players : [])
    .filter((player) => typeof player.name === "string" && Array.isArray(player.inventory))
    .map((player) => [player.name.toLowerCase(), {
      ...player,
      xp: Number.isFinite(Number(player.xp)) ? Number(player.xp) : 0,
      level: Number.isFinite(Number(player.level)) ? Number(player.level) : 0,
      coins: saved.mode === "design" ? 20_000 : Number.isFinite(Number(player.coins)) ? Number(player.coins) : 0,
    }]));
  return {
    id: saved.id,
    name: typeof saved.name === "string" ? saved.name : "Saved world",
    hostId: null,
    members: new Set(),
    mode: saved.mode === "design" ? "design" : "survival",
    seed: Number.isSafeInteger(saved.seed) ? saved.seed : 1,
    started: true,
    blocks: new Map(blockChanges),
    blockChanges,
    openDoors: new Set(Array.isArray(saved.openDoors) ? saved.openDoors.filter((key) => typeof key === "string") : []),
    blockRebuilds: new Map(
      Array.isArray(saved.blockRebuilds)
        ? saved.blockRebuilds.filter((entry) =>
          Array.isArray(entry) &&
          typeof entry[0] === "string" &&
          entry[1] &&
          typeof entry[1].block === "string" &&
          Number.isFinite(entry[1].rebuildAt),
        )
        : [],
    ),
    blockRebuildTimers: new Map(),
    droppedItems: new Map(Array.isArray(saved.droppedItems) ? saved.droppedItems : []),
    vehicles: restoreVehicles(
      saved.vehicles,
      Number.isSafeInteger(saved.seed) ? saved.seed : 1,
      blockChanges,
    ),
    properties: new Map(
      Array.isArray(saved.properties)
        ? saved.properties.filter(([id, property]) => typeof id === "string" && property && typeof property.ownerId === "string")
        : [],
    ),
    savedPlayers,
    bots: createBots(Number.isSafeInteger(saved.seed) ? saved.seed : 1),
    animals: createAnimals(Number.isSafeInteger(saved.seed) ? saved.seed : 1),
    monsters: createMonsters(),
    autosaveEnabled: saved.autosaveEnabled !== false,
    lastAutosaveAt: Date.now(),
    saved: true,
  };
}

function loadSavedRooms(saveDirectory) {
  if (!existsSync(saveDirectory)) return [];
  const rooms = [];
  for (const filename of readdirSync(saveDirectory)) {
    const id = filename.replace(/\.json$/i, "");
    if (!/^[A-Z0-9]{6}$/.test(id) || !filename.endsWith(".json")) continue;
    try {
      const saved = JSON.parse(readFileSync(resolve(saveDirectory, filename), "utf8"));
      const room = restoreSavedRoom({ ...saved, id });
      if (room) rooms.push(room);
    } catch {
      continue;
    }
  }
  return rooms;
}

function roomSaveData(room, players) {
  const savedPlayers = new Map(room.savedPlayers ?? []);
  for (const id of room.members) {
    const player = players.get(id);
    if (!player) continue;
    savedPlayers.set(player.name.toLowerCase(), {
      name: player.name,
      x: player.x,
      y: player.y,
      z: player.z,
      yaw: player.yaw,
      inventory: inventoryItems(player.inventory),
      xp: player.xp ?? 0,
      level: player.level ?? 0,
      coins: player.coins ?? 0,
      missions: player.missions ?? createEmptyMissions(),
    });
  }
  room.savedPlayers = savedPlayers;
  room.saved = true;
  return {
    id: room.id,
    name: room.name,
    mode: room.mode,
    seed: room.seed,
    started: room.started,
    autosaveEnabled: room.autosaveEnabled !== false,
    blockChanges: [...room.blockChanges],
    blockRebuilds: [...room.blockRebuilds],
    openDoors: [...(room.openDoors ?? [])],
    droppedItems: [...room.droppedItems],
    vehicles: [...room.vehicles.values()].map(({ occupantId, ...vehicle }) => vehicle),
    properties: [...(room.properties ?? new Map())],
    players: [...savedPlayers.values()],
  };
}

function persistRoom(room, players, saveDirectory) {
  mkdirSync(saveDirectory, { recursive: true });
  writeFileSync(resolve(saveDirectory, `${room.id}.json`), JSON.stringify(roomSaveData(room, players)));
}

async function initializeDatabase(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS voxland_worlds (
      id CHAR(6) PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS voxland_profiles (
      profile_id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      stats JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const { rows } = await pool.query("SELECT payload FROM voxland_worlds");
  return rows.map(({ payload }) => restoreSavedRoom(payload)).filter(Boolean);
}

async function persistRoomToDatabase(room, players, pool) {
  const payload = roomSaveData(room, players);
  await pool.query(`
    INSERT INTO voxland_worlds (id, payload)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (id) DO UPDATE
    SET payload = EXCLUDED.payload, updated_at = NOW()
  `, [room.id, JSON.stringify(payload)]);
}

async function removeSavedRoom(room, saveDirectory, pool) {
  if (pool) {
    await pool.query("DELETE FROM voxland_worlds WHERE id = $1", [room.id]);
  } else {
    const savePath = resolve(saveDirectory, `${room.id}.json`);
    if (existsSync(savePath)) unlinkSync(savePath);
  }
}

async function persistPlayerProfile(player, profiles, pool) {
  if (!player.profileId) return;
  const profile = {
    profileId: player.profileId,
    name: player.name,
    color: player.color,
    stats: { ...DEFAULT_PROFILE_STATS, ...player.profileStats },
  };
  profiles.set(player.profileId, profile);
  if (!pool) return;
  await pool.query(`
    INSERT INTO voxland_profiles (profile_id, name, color, stats)
    VALUES ($1, $2, $3, $4::jsonb)
    ON CONFLICT (profile_id) DO UPDATE
    SET name = EXCLUDED.name, color = EXCLUDED.color, stats = EXCLUDED.stats, updated_at = NOW()
  `, [profile.profileId, profile.name, profile.color, JSON.stringify(profile.stats)]);
}

async function loadPlayerProfile(profileId, player, profiles, pool) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    throw new TypeError("Invalid player profile ID.");
  }
  let profile = profiles.get(profileId);
  if (pool) {
    const { rows } = await pool.query(
      "SELECT profile_id, name, color, stats FROM voxland_profiles WHERE profile_id = $1",
      [profileId],
    );
    profile = rows[0];
  }
  if (!profile) {
    profile = {
      profileId,
      name: player.name,
      color: player.color,
      stats: { ...DEFAULT_PROFILE_STATS },
    };
  }
  player.profileId = profileId;
  player.name = safeName(profile.name) ?? player.name;
  player.color = /^#[0-9a-f]{6}$/i.test(profile.color) ? profile.color : player.color;
  player.profileStats = Object.fromEntries(Object.keys(DEFAULT_PROFILE_STATS).map((key) => [
    key,
    Number.isSafeInteger(Number(profile.stats?.[key])) && Number(profile.stats[key]) >= 0
      ? Number(profile.stats[key])
      : 0,
  ]));
  await persistPlayerProfile(player, profiles, pool);
  return {
    name: player.name,
    color: player.color,
    stats: player.profileStats,
  };
}

async function incrementProfileStat(player, stat, amount, profiles, pool) {
  if (!player.profileId || !Object.hasOwn(DEFAULT_PROFILE_STATS, stat)) return;
  player.profileStats[stat] = (player.profileStats[stat] ?? 0) + amount;
  await persistPlayerProfile(player, profiles, pool);
}

function staticResponse(request, response) {
  if (!existsSync(DIST_DIR)) {
    response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    response.end("Build the client first with npm run build.");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  let filePath = resolve(DIST_DIR, `.${pathname}`);
  if (!filePath.startsWith(`${DIST_DIR}${sep}`) && filePath !== DIST_DIR) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  if (pathname === "/" || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = resolve(DIST_DIR, "index.html");
  }

  if (!existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": MIME_TYPES.get(extname(filePath)) ?? "application/octet-stream",
    "cache-control": "no-cache",
  });
  response.end(readFileSync(filePath));
}

export function createGameServer({
  host = "0.0.0.0",
  port = 3001,
  httpServer: sharedHttpServer,
  seed: requestedSeed,
  saveDirectory = DEFAULT_SAVE_DIRECTORY,
  databaseUrl = process.env.DATABASE_URL,
  autosaveIntervalMs = AUTO_SAVE_INTERVAL_MS,
  blockRebuildDelayMs = BLOCK_REBUILD_DELAY_MS,
  accessControl,
  resolveClientIp = request => request.socket.remoteAddress,
} = {}) {
  if (process.env.RAILWAY_ENVIRONMENT && !databaseUrl) {
    throw new Error("DATABASE_URL must be set for Railway deployments.");
  }
  const configuredSeed = requestedSeed ?? process.env.WORLD_SEED;
  const seed = configuredSeed === undefined ? randomInt(0, 0x1_0000_0000) : Number(configuredSeed);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError("WORLD_SEED must be an integer between 0 and 4294967295.");
  }
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  const players = new Map();
  const profiles = new Map();
  const rooms = new Map(pool ? [] : loadSavedRooms(saveDirectory).map((room) => [room.id, room]));
  let databaseInitialized = false;
  const bots = createBots(seed);
  const ownsHttpServer = !sharedHttpServer;
  const httpServer = sharedHttpServer ?? createServer(staticResponse);
  const webSocketServer = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    maxPayload: 4096,
    verifyClient: (info, callback) => {
      try {
        const clientIp = resolveClientIp(info.req);
        info.req.clientIp = clientIp;
        if (accessControl?.isBlocked(clientIp)) {
          callback(false, 403, "Forbidden");
          return;
        }
        callback(true);
      } catch (error) {
        console.error("Failed to verify JesseCraft connection address:", error);
        callback(false, 400, "Invalid client address");
      }
    },
  });

  const roomSummary = (room) => ({
    id: room.id,
    name: room.name,
    players: room.members.size,
    maxPlayers: 8,
    started: room.started,
    mode: room.mode,
    saved: Boolean(room.saved),
    autosaveEnabled: room.autosaveEnabled !== false,
  });

  const lobbyRooms = () => [...rooms.values()]
    .filter((room) => !room.deleting && room.members.size < 8)
    .map(roomSummary);

  const sendLobbyRooms = () => {
    for (const player of players.values()) {
      if (!player.roomId && player.socket.readyState === WebSocket.OPEN) {
        writeJson(player.socket, { type: "room_list", rooms: lobbyRooms() });
      }
    }
  };

  const sendRoomState = (room) => {
    const message = {
      type: "room_state",
      room: roomSummary(room),
      hostId: room.hostId,
      members: [...room.members].map((id) => {
        const member = players.get(id);
        return member ? { id, name: member.name } : null;
      }).filter(Boolean),
    };
    for (const id of room.members) {
      const member = players.get(id);
      if (member?.socket.readyState === WebSocket.OPEN) writeJson(member.socket, message);
    }
  };

  const roomSnapshot = (room) => ({
    type: "snapshot",
    players: [...room.members].map((id) => players.get(id)).filter(Boolean).map(({ id, name, x, y, z, yaw, color, health, vehicleId, mountId, sittingAt }) => ({
      id,
      name,
      x,
      y,
      z,
      yaw,
      color,
      health,
      vehicleId: vehicleId ?? null,
      mountId: mountId ?? null,
      sittingAt: sittingAt ?? null,
    })),
    bots: [...room.bots.values()].filter((bot) => bot.restaurantShopId || isBotNearPlayers(room, players, bot)),
    animals: serializeAnimals(room),
    monsters: serializeMonsters(room),
    drops: [...room.droppedItems.values()].map(({ id, item, count, x, z }) => ({
      id,
      item,
      count,
      x,
      z,
    })),
    vehicles: [...room.vehicles.values()],
    raceTrack: room.vehicles.raceTrack?.map(({ x, z }) => ({ x, z, y: terrainHeightAt(x, z, room.seed) })) ?? null,
    crops: serializeCrops(room),
    openDoors: [...(room.openDoors ?? [])],
    properties: [...(room.properties ?? new Map()).entries()].map(([id, property]) => ({ id, ...property })),
  });

  const broadcastToRoom = (room, message) => {
    const encoded = JSON.stringify(message);
    for (const id of room.members) {
      const member = players.get(id);
      if (member?.socket.readyState === WebSocket.OPEN) member.socket.send(encoded);
    }
  };

  const restoreDestroyedBlock = (room, key, record) => {
    if (
      rooms.get(room.id) !== room ||
      room.blockRebuilds.get(key) !== record ||
      room.blocks.get(key) !== null
    ) return;
    const [x, y, z] = key.split(",").map(Number);
    room.blocks.set(key, record.block);
    room.blockChanges.set(key, record.block);
    room.blockRebuilds.delete(key);
    room.blockRebuildTimers.delete(key);
    broadcastToRoom(room, {
      type: "block",
      action: "rebuild",
      position: { x, y, z },
      block: record.block,
    });
  };

  const scheduleBlockRebuild = (room, key, record) => {
    const previousTimer = room.blockRebuildTimers.get(key);
    if (previousTimer) clearTimeout(previousTimer);
    room.blockRebuilds.set(key, record);
    const timer = setTimeout(
      () => restoreDestroyedBlock(room, key, record),
      Math.max(0, record.rebuildAt - Date.now()),
    );
    timer.unref?.();
    room.blockRebuildTimers.set(key, timer);
  };

  const sendInitial = (player, room) => writeJson(player.socket, {
    type: "init",
    id: player.id,
    seed: room.seed,
    mode: room.mode,
    autosaveEnabled: room.autosaveEnabled !== false,
    chunkSize: CHUNK_SIZE,
    players: [...room.members].map((id) => players.get(id)).filter(Boolean).map(({ id, name, x, y, z, yaw, color, health, vehicleId, mountId, sittingAt }) => ({
      id,
      name,
      x,
      y,
      z,
      yaw,
      color,
      health,
      vehicleId: vehicleId ?? null,
      mountId: mountId ?? null,
      sittingAt: sittingAt ?? null,
    })),
    bots: [...room.bots.values()],
    animals: serializeAnimals(room),
    monsters: serializeMonsters(room),
    drops: [...room.droppedItems.values()].map(({ id, item, count, x, z }) => ({ id, item, count, x, z })),
    vehicles: [...room.vehicles.values()],
    raceTrack: room.vehicles.raceTrack?.map(({ x, z }) => ({ x, z, y: terrainHeightAt(x, z, room.seed) })) ?? null,
    openDoors: [...(room.openDoors ?? [])],
    properties: [...(room.properties ?? new Map()).entries()].map(([id, property]) => ({ id, ...property })),
    position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
    inventory: inventoryItems(player.inventory),
    health: player.health,
    flying: Boolean(player.flightEnabled),
    xp: player.xp ?? 0,
    level: player.level ?? 0,
    coins: player.coins ?? 0,
  });

  const snapshotTimer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      for (const [id, drop] of room.droppedItems) {
        if (drop.expiresAt <= now) room.droppedItems.delete(id);
      }
      if (room.started) broadcastToRoom(room, roomSnapshot(room));
    }
  }, 100);
  const autosaveTimer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.deleting || !room.started || !room.autosaveEnabled || room.autosaveInProgress || now - room.lastAutosaveAt < autosaveIntervalMs) continue;
      room.lastAutosaveAt = now;
      room.autosaveInProgress = true;
      const save = pool
        ? persistRoomToDatabase(room, players, pool)
        : Promise.resolve().then(() => persistRoom(room, players, saveDirectory));
      room.autosavePromise = save.catch(() => {
        room.lastAutosaveAt = Date.now() - autosaveIntervalMs;
      }).finally(() => {
        room.autosaveInProgress = false;
        room.autosavePromise = null;
      });
    }
  }, autosaveIntervalMs);
  const botTimer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (!room.started) continue;
      for (const bot of room.bots.values()) {
        if (!bot.restaurantShopId && !isBotNearPlayers(room, players, bot)) continue;
        if (bot.restaurantShopId) {
          bot.walking = false;
          continue;
        }
        if (bot.talkUntil) {
          if (now < bot.talkUntil) {
            const talker = players.get(bot.talkingPlayerId);
            if (talker) faceBotToward(bot, talker);
            bot.walking = false;
            continue;
          }
          // Talk finished: pause briefly before wandering again.
          bot.talkUntil = 0;
          bot.talkingPlayerId = null;
          bot.behavior = "idle";
          bot.nextDecisionAt = now + 1500 + Math.random() * 2000;
        }
        if (bot.farmer) updateFarmerBot(room, bot, now);
        else if (now >= bot.nextDecisionAt) {
          if (bot.behavior === "follow" || bot.behavior === "idle"
            || Math.hypot(bot.targetX - bot.x, bot.targetZ - bot.z) < 1) {
            const target = chooseBotWanderTarget(room, bot);
            bot.targetX = target.x;
            bot.targetZ = target.z;
            bot.behavior = "wander";
          }
          bot.nextDecisionAt = now + 700;
        }

        const deltaX = bot.targetX - bot.x;
        const deltaZ = bot.targetZ - bot.z;
        const distance = Math.hypot(deltaX, deltaZ);
        const stopDistance = 0.45;
        if (distance <= stopDistance) {
          if (bot.behavior === "wander") {
            // Arrived: idle for a moment instead of turning toward a new target every tick.
            bot.behavior = "idle";
            bot.nextDecisionAt = now + 1500 + Math.random() * 2000;
          }
          bot.walking = false;
          bot.stuckTicks = 0;
          continue;
        }

        const step = Math.min(BOT_STEP, distance - stopDistance);
        const movement = chooseBotStep(room, bot, step);
        if (movement && isRoadAt(room, movement.x, movement.z) && movingCarNear(room, movement.x, movement.z)) {
          // Wait for passing traffic before crossing onto the road.
          bot.walking = false;
          continue;
        }
        if (movement) {
          bot.x = movement.x;
          bot.z = movement.z;
          bot.yaw = Math.atan2(-Math.cos(movement.angle), Math.sin(movement.angle));
          bot.walking = true;
          bot.stuckTicks = 0;
        } else {
          bot.walking = false;
          bot.stuckTicks += 1;
          if (bot.stuckTicks >= 4) {
            const target = chooseBotWanderTarget(room, bot);
            bot.targetX = target.x;
            bot.targetZ = target.z;
            bot.behavior = "wander";
            bot.nextDecisionAt = now + 700;
            bot.stuckTicks = 0;
          }
        }
      }
      updateCityTraffic(room, players);
      updateRaceCars(room);
      updateRaceDuels(room);
      for (const animal of room.animals.values()) {
        if (animal.riderId) continue;
        if (animal.flying) {
          animal.flightPhase += 0.12;
          if (Math.hypot(animal.targetX - animal.x, animal.targetZ - animal.z) < 8) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 18 + Math.random() * 32;
            animal.targetX = animal.homeX + Math.cos(angle) * radius;
            animal.targetZ = animal.homeZ + Math.sin(angle) * radius;
          }
          const dx = animal.targetX - animal.x;
          const dz = animal.targetZ - animal.z;
          const distance = Math.hypot(dx, dz);
          const step = Math.min(animal.flightSpeed, distance);
          if (distance > 0) {
            animal.x = wrapPlanetX(animal.x + dx / distance * step);
            animal.z += dz / distance * step;
            animal.yaw = Math.atan2(-dx, dz);
          }
          animal.y = terrainHeightAt(animal.x, animal.z, room.seed)
            + animal.flightAltitude + Math.sin(animal.flightPhase) * 2;
          animal.walking = false;
          continue;
        }
        const deltaX = animal.targetX - animal.x;
        const deltaZ = animal.targetZ - animal.z;
        const distance = Math.hypot(deltaX, deltaZ);

        if (distance < 0.3) {
          const wanderRange = animal.aquatic ? 7 : 5;
          animal.targetX = animal.homeX + Math.round((Math.random() * wanderRange * 2 - wanderRange) * 2) / 2;
          animal.targetZ = animal.homeZ + Math.round((Math.random() * wanderRange * 2 - wanderRange) * 2) / 2;
          animal.walking = false;
          continue;
        }

        const step = Math.min(animal.aquatic ? 0.11 : 0.08, distance);
        const nextX = animal.x + deltaX / distance * step;
        const nextZ = animal.z + deltaZ / distance * step;
        const habitatRadius = animal.aquatic ? 12 : 8;
        const inHabitat = Math.hypot(nextX - animal.homeX, nextZ - animal.homeZ) <= habitatRadius;
        const canMove = animal.aquatic
          ? Math.hypot(nextX, nextZ) > CITY_BEACH_OUTER_RADIUS
            && Math.hypot(nextX, nextZ) < HARBOR_WATER_OUTER_RADIUS
            && terrainHeightAt(nextX, nextZ, room.seed) < 0
          : botCanMove(room, animal, nextX, nextZ);
        if (inHabitat && canMove) {
          animal.x = nextX;
          animal.z = nextZ;
          animal.y = animal.aquatic
            ? terrainHeightAt(nextX, nextZ, room.seed) + 3
            : terrainHeightAt(nextX, nextZ, room.seed) + 1;
          animal.yaw = Math.atan2(-deltaX, deltaZ);
          animal.walking = true;
        } else {
          const wanderRange = animal.aquatic ? 7 : 5;
          animal.targetX = animal.homeX + Math.round((Math.random() * wanderRange * 2 - wanderRange) * 2) / 2;
          animal.targetZ = animal.homeZ + Math.round((Math.random() * wanderRange * 2 - wanderRange) * 2) / 2;
          animal.walking = false;
        }
      }
    }
  }, 250);
  const monsterTimer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (!room.started) continue;
      for (const monster of room.monsters.values()) {
        if (monster.active === false) {
          const playerNearSpawn = [...room.members].some((id) => {
            const player = players.get(id);
            if (!player || player.health <= 0) return false;
            return Math.hypot(wrapPlanetX(player.x - monster.homeX), player.z - monster.homeZ) <= (monster.boss ? 40 : 28);
          });
          if (playerNearSpawn) monster.active = true;
        }
      }
      let changed = false;
      for (const monster of room.monsters.values()) {
        if (monster.active === false) continue;
        if (monster.health <= 0) {
          if (now < monster.respawnAt) continue;
          monster.x = monster.homeX;
          monster.z = monster.homeZ;
          monster.targetX = monster.homeX;
          monster.targetZ = monster.homeZ;
          monster.health = monster.maxHealth;
          monster.respawnAt = 0;
          changed = true;
          continue;
        }

        let closestPlayer = null;
        let closestDistance = 14;
        for (const id of room.members) {
          const candidate = players.get(id);
          if (!candidate || candidate.health <= 0) continue;
          const east = wrapPlanetX(candidate.x - monster.x);
          const north = candidate.z - monster.z;
          const distance = Math.hypot(east, north);
          const surfaceY = terrainHeightAt(candidate.x, candidate.z, room.seed) + 2.65;
          const insideCity = Math.hypot(wrapPlanetX(candidate.x), candidate.z) <= CITY_RADIUS;
          if (insideCity || isNearHarbor(candidate.x, candidate.z) || candidate.y < surfaceY - 1.5) continue;
          if (distance < closestDistance) {
            closestPlayer = candidate;
            closestDistance = distance;
          }
        }

        if (closestPlayer && closestDistance <= MONSTER_ATTACK_RANGE) {
          continue;
        }

        if (closestPlayer) {
          monster.targetX = closestPlayer.x;
          monster.targetZ = closestPlayer.z;
        } else if (Math.hypot(monster.targetX - monster.x, monster.targetZ - monster.z) < 0.3) {
          monster.targetX = monster.homeX + Math.round((Math.random() * 12 - 6) * 2) / 2;
          monster.targetZ = monster.homeZ + Math.round((Math.random() * 12 - 6) * 2) / 2;
        }

        const deltaX = wrapPlanetX(monster.targetX - monster.x);
        const deltaZ = monster.targetZ - monster.z;
        const distance = Math.hypot(deltaX, deltaZ);
        if (distance > 0.3) {
          const step = Math.min(closestPlayer ? 0.28 : 0.1, distance);
          monster.x = wrapPlanetX(monster.x + deltaX / distance * step);
          monster.z += deltaZ / distance * step;
          monster.yaw = Math.atan2(-deltaX, deltaZ);
          changed = true;
        }
      }
      if (changed) broadcastToRoom(room, roomSnapshot(room));
    }
  }, 250);

  webSocketServer.on("connection", (socket, request) => {
    const id = randomUUID();
    const clientIp = request.clientIp;
    if (accessControl && !accessControl.connected({
      connectionId: `jesseCraft:${id}`,
      game: "JesseCraft",
      ip: clientIp,
    })) {
      socket.close(1008, "Connection not allowed");
      return;
    }
    const colors = ["#e58b64", "#70a8d2", "#d4bd68", "#c27db7"];
    const player = {
      id,
      clientIp,
      name: `Guest-${id.slice(0, 4)}`,
      x: 0,
      y: terrainHeightAt(0, 0, seed) + 2.65,
      z: 0,
      yaw: 0,
      mountId: null,
      health: MAX_PLAYER_HEALTH,
      xp: 0,
      level: 0,
      coins: STARTING_COINS,
      missions: createEmptyMissions(),
      profileId: null,
      profileStats: { ...DEFAULT_PROFILE_STATS },
      lastAttackAt: 0,
      lastFishAt: 0,
      flightEnabled: false,
      color: colors[Math.floor(Math.random() * colors.length)],
      inventory: createInventory(),
      socket,
      roomId: null,
      gearTier: 0,
      buffs: {},
    };
    players.set(id, player);
    writeJson(socket, { type: "lobby", playerId: id, rooms: lobbyRooms() });

    socket.on("message", async (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        writeJson(socket, { type: "error", message: "The server could not read that message." });
        return;
      }
      if (message === null || typeof message !== "object") {
        writeJson(socket, { type: "error", message: "Unsupported message." });
        return;
      }

      if (message.type === "list_rooms") {
        writeJson(socket, { type: "room_list", rooms: lobbyRooms() });
        return;
      }

      if (message.type === "create_room") {
        if (player.roomId) {
          writeJson(socket, { type: "error", message: "Leave your current room first." });
          return;
        }
        const roomName = typeof message.roomName === "string"
          ? message.roomName.trim().replace(/[<>]/g, "").slice(0, 30)
          : "";
        let roomId = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
        while (rooms.has(roomId)) roomId = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
        const room = {
          id: roomId,
          name: roomName || `${player.name}'s World`,
          hostId: player.id,
          members: new Set([player.id]),
          mode: message.mode === "design" ? "design" : message.mode === "tank-war" ? "tank-war" : "survival",
          seed,
          started: false,
          blocks: new Map(),
          blockChanges: new Map(),
          openDoors: new Set(),
          blockRebuilds: new Map(),
          blockRebuildTimers: new Map(),
          droppedItems: new Map(),
          vehicles: createVehicles(seed, message.mode === "tank-war" ? "tank-war" : "survival"),
          properties: new Map(),
          savedPlayers: new Map(),
          bots: new Map([...bots].map(([botId, bot]) => [botId, { ...bot }])),
          animals: createAnimals(seed),
          monsters: createMonsters(),
          autosaveEnabled: true,
          lastAutosaveAt: 0,
          disconnectTimer: null,
          saved: false,
        };
        rooms.set(roomId, room);
        player.roomId = roomId;
        player.inventory = createInventory(room.mode);
        if (room.mode === "design") player.coins = 20_000;
        writeJson(socket, { type: "room_created", room: roomSummary(room), hostId: room.hostId });
        sendRoomState(room);
        sendLobbyRooms();
        return;
      }

      if (message.type === "join_room") {
        const room = rooms.get(String(message.roomId ?? "").toUpperCase());
        if (!room || room.deleting || room.members.size >= 8) {
          writeJson(socket, { type: "error", message: "That room is unavailable." });
          return;
        }
        if (player.roomId) {
          writeJson(socket, { type: "error", message: "Leave your current room first." });
          return;
        }
        if (room.disconnectTimer) {
          clearTimeout(room.disconnectTimer);
          room.disconnectTimer = null;
        }
        room.members.add(player.id);
        player.roomId = room.id;
        const savedPlayer = room.savedPlayers?.get(player.name.toLowerCase());
        player.missions = normalizeMissions(savedPlayer?.missions);
        player.inventory = savedPlayer
          ? new Map(savedPlayer.inventory)
          : createInventory(room.mode);
        if (room.mode === "design") {
          fillDesignInventory(player.inventory);
          player.coins = 20_000;
        }
        if (savedPlayer) {
          player.x = savedPlayer.x;
          const currentSurfaceEyeY = terrainHeightAt(savedPlayer.x, savedPlayer.z, room.seed) + 2.65;
          const previousSurfaceEyeY = currentSurfaceEyeY - 0.5;
          player.y = Number.isFinite(savedPlayer.y)
            ? Math.abs(savedPlayer.y - previousSurfaceEyeY) < 0.001
              ? currentSurfaceEyeY
              : savedPlayer.y
            : currentSurfaceEyeY;
          player.z = savedPlayer.z;
          player.yaw = savedPlayer.yaw;
          player.xp = Number.isFinite(Number(savedPlayer.xp)) ? Number(savedPlayer.xp) : 0;
          player.level = levelForExperience(player.xp);
          player.coins = room.mode === "design"
            ? 20_000
            : Number.isFinite(Number(savedPlayer.coins)) ? Number(savedPlayer.coins) : 0;
          player.health = Math.max(1, Math.min(MAX_PLAYER_HEALTH, savedPlayer.health ?? MAX_PLAYER_HEALTH));
        }
        if (!room.hostId) room.hostId = player.id;
        writeJson(socket, { type: "room_joined", room: roomSummary(room), hostId: room.hostId });
        sendRoomState(room);
        if (room.started) {
          sendInitial(player, room);
          broadcastToRoom(room, roomSnapshot(room));
        }
        sendLobbyRooms();
        return;
      }

      if (message.type === "leave_room") {
        const room = rooms.get(player.roomId);
        if (room) {
          releaseVehicle(room, player);
          room.members.delete(player.id);
          player.roomId = null;
          if (room.members.size === 0 && !room.saved) {
            if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
            rooms.delete(room.id);
          }
          else {
            if (room.hostId === player.id) room.hostId = room.members.values().next().value;
            sendRoomState(room);
          }
        }
        writeJson(socket, { type: "room_left" });
        sendLobbyRooms();
        return;
      }

      if (message.type === "start_room") {
        const room = rooms.get(player.roomId);
        if (!room || room.hostId !== player.id) {
          writeJson(socket, { type: "error", message: "Only the room host can start the world." });
          return;
        }
        room.started = true;
        if (room.mode === "tank-war") {
          // Each player owns one army base; the second base goes to the next member, if any.
          const otherMemberId = [...room.members].find((id) => id !== room.hostId) ?? null;
          room.tankWarOwners = [room.hostId, otherMemberId];
          room.tankWarOver = false;
          for (const vehicle of room.vehicles.values()) {
            if (vehicle.id.startsWith("city-tank-")) vehicle.ownerId = room.tankWarOwners[0];
            if (vehicle.id.startsWith("rival-tank-")) vehicle.ownerId = room.tankWarOwners[1];
          }
        }
        for (const memberId of room.members) {
          const member = players.get(memberId);
          if (member) sendInitial(member, room);
        }
        broadcastToRoom(room, roomSnapshot(room));
        sendRoomState(room);
        sendLobbyRooms();
        return;
      }

      if (message.type === "set_autosave") {
        const room = rooms.get(player.roomId);
        if (!room?.started) {
          writeJson(socket, { type: "autosave_result", enabled: false, message: "Start a world before changing autosave." });
          return;
        }
        const previousSetting = room.autosaveEnabled;
        room.autosaveEnabled = message.enabled === true;
        room.lastAutosaveAt = Date.now();
        try {
          if (pool) await persistRoomToDatabase(room, players, pool);
          else persistRoom(room, players, saveDirectory);
          writeJson(socket, {
            type: "autosave_result",
            enabled: room.autosaveEnabled,
            message: room.autosaveEnabled ? "Autosave is on." : "Autosave is off.",
          });
          sendRoomState(room);
        } catch {
          room.autosaveEnabled = previousSetting;
          writeJson(socket, { type: "autosave_result", enabled: previousSetting, message: "Autosave setting could not be saved." });
        }
        return;
      }

      if (message.type === "save_room") {
        const room = rooms.get(player.roomId);
        if (!room?.started) {
          writeJson(socket, { type: "save_result", saved: false, message: "Start a world before saving." });
          return;
        }
        try {
          if (pool) await persistRoomToDatabase(room, players, pool);
          else persistRoom(room, players, saveDirectory);
          await incrementProfileStat(player, "worldsSaved", 1, profiles, pool);
          writeJson(socket, { type: "save_result", saved: true, message: "World saved." });
          sendLobbyRooms();
        } catch {
          writeJson(socket, { type: "save_result", saved: false, message: "World could not be saved." });
        }
        return;
      }

      if (message.type === "profile_load") {
        try {
          const profile = await loadPlayerProfile(message.profileId, player, profiles, pool);
          writeJson(socket, { type: "profile_data", profile });
          writeJson(socket, { type: "name_result", name: player.name });
        } catch (error) {
          writeJson(socket, { type: "error", message: error.message === "Invalid player profile ID." ? error.message : "Player profile could not be loaded." });
        }
        return;
      }

      if (message.type === "profile_update") {
        const name = safeName(message.name);
        const validColor = typeof message.color === "string" && /^#[0-9a-f]{6}$/i.test(message.color);
        if (!player.profileId || !name || !validColor) {
          writeJson(socket, { type: "error", message: "Enter a valid name and character color." });
          return;
        }
        const previousName = player.name;
        player.name = name;
        player.color = message.color;
        const room = rooms.get(player.roomId);
        for (const property of room?.properties.values() ?? []) {
          if (property.ownerId === (player.profileId || previousName.toLowerCase())) {
            property.ownerName = player.name;
          }
        }
        try {
          await persistPlayerProfile(player, profiles, pool);
          writeJson(socket, {
            type: "profile_data",
            profile: { name: player.name, color: player.color, stats: player.profileStats },
          });
          if (room) {
            sendRoomState(room);
            if (room.started) broadcastToRoom(room, roomSnapshot(room));
          }
        } catch {
          writeJson(socket, { type: "error", message: "Player profile could not be saved." });
        }
        return;
      }

      if (message.type === "name") {
        const name = safeName(message.name);
        if (!name) {
          writeJson(socket, { type: "error", message: "Choose a name between 1 and 16 characters." });
          return;
        }
        player.name = name;
        if (player.profileId) {
          try {
            await persistPlayerProfile(player, profiles, pool);
          } catch {
            writeJson(socket, { type: "error", message: "Player profile could not be saved." });
            return;
          }
        }
        const room = rooms.get(player.roomId);
        if (room) {
          sendRoomState(room);
          if (room.started) broadcastToRoom(room, roomSnapshot(room));
        }
        writeJson(socket, { type: "name_result", name });
        return;
      }

      if (message.type === "teleport") {
        const room = rooms.get(player.roomId);
        const location = room?.started
          ? message.locationId === "racing-track"
            ? raceTrackLocation(room.seed)
            : WORLD_LOCATIONS.find((candidate) => candidate.id === message.locationId)
          : null;
        const target = room?.started && room.members.has(message.targetId)
          ? players.get(message.targetId)
          : null;
        if (!target && !location) {
          writeJson(socket, {
            type: "error",
            message: message.targetId ? "That player is not in your world." : "That world location is unknown.",
          });
          return;
        }
        releaseVehicle(room, player);
        player.x = location ? location.x : wrapPlanetX(target.x + 2);
        player.z = location ? location.z : target.z;
        player.y = terrainHeightAt(player.x, player.z, room.seed) + 2.65;
        player.yaw = location ? location.yaw : target.yaw;
        writeJson(socket, {
          type: "teleport_result",
          position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
          targetId: target?.id ?? null,
          locationId: location?.id ?? null,
          locationName: location?.name ?? null,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "buy_home") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0) return;
        const property = cityPropertyNear(player.x, player.z, room.seed);
        if (!property) {
          writeJson(socket, {
            type: "home_result",
            success: false,
            message: "Stand by a Glass City building entrance to buy it.",
          });
          return;
        }
        if (room.properties.has(property.id)) {
          writeJson(socket, {
            type: "home_result",
            success: false,
            message: "That residence already has an owner.",
            properties: [...room.properties.entries()].map(([id, entry]) => ({ id, ...entry })),
          });
          return;
        }
        if (room.mode !== "design" && player.coins < property.price) {
          writeJson(socket, {
            type: "home_result",
            success: false,
            message: `You need ${property.price} coins to buy this residence.`,
            properties: [...room.properties.entries()].map(([id, entry]) => ({ id, ...entry })),
          });
          return;
        }
        if (room.mode !== "design") player.coins -= property.price;
        const ownerId = player.profileId || player.name.toLowerCase();
        room.properties.set(property.id, { ownerId, ownerName: player.name });
        const properties = [...room.properties.entries()].map(([id, entry]) => ({ id, ...entry }));
        writeJson(socket, {
          type: "home_result",
          success: true,
          message: `You now own ${property.name}.`,
          coins: player.coins,
          properties,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "kick_resident") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0) return;
        const ownerId = player.profileId || player.name.toLowerCase();
        const property = listCityProperties(room.seed).find(({ id }) =>
          id === message.propertyId && room.properties.get(id)?.ownerId === ownerId,
        );
        if (!property) {
          writeJson(socket, { type: "home_result", success: false, message: "You do not own that residence in this world." });
          return;
        }
        const resident = players.get(message.playerId);
        if (
          !resident ||
          resident.id === player.id ||
          !room.members.has(resident.id) ||
          !isInsideResidence(property, resident.x, resident.z)
        ) {
          writeJson(socket, { type: "home_result", success: false, message: "That player is not inside your residence." });
          return;
        }
        const landing = residenceLandingSpot(room, property);
        if (!landing) {
          writeJson(socket, { type: "home_result", success: false, message: "There is no clear ground-level landing spot by that residence." });
          return;
        }
        releaseVehicle(room, resident);
        resident.x = landing[0];
        resident.z = landing[1];
        resident.y = terrainHeightAt(resident.x, resident.z, room.seed) + 2.65;
        resident.yaw = 0;
        writeJson(resident.socket, {
          type: "home_result",
          success: true,
          message: `${player.name} asked you to leave ${property.name}.`,
          position: { x: resident.x, y: resident.y, z: resident.z, yaw: resident.yaw },
        });
        writeJson(socket, { type: "home_result", success: true, message: `${resident.name} was kicked out of ${property.name}.` });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "home_teleport") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0) return;
        const ownerId = player.profileId || player.name.toLowerCase();
        const property = listCityProperties(room.seed).find(({ id }) =>
          id === message.propertyId && room.properties.get(id)?.ownerId === ownerId,
        );
        if (!property) {
          writeJson(socket, {
            type: "home_result",
            success: false,
            message: "You do not own that residence in this world.",
          });
          return;
        }
        const landing = residenceLandingSpot(room, property);
        if (!landing) {
          writeJson(socket, {
            type: "home_result",
            success: false,
            message: "There is no clear ground-level landing spot by that residence.",
          });
          return;
        }
        releaseVehicle(room, player);
        player.x = landing[0];
        player.z = landing[1];
        player.y = terrainHeightAt(player.x, player.z, room.seed) + 2.65;
        player.yaw = 0;
        writeJson(socket, {
          type: "home_result",
          success: true,
          message: `Welcome home to ${property.name}.`,
          position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (
        message.type === "attack" ||
        message.type === "tank_fire" ||
        message.type === "aircraft_fire"
      ) {
        const room = rooms.get(player.roomId);
        const isTankAttack = message.type === "tank_fire";
        const vehicle = room?.vehicles.get(player.vehicleId);
        const requestedTankAimYaw = Number.isFinite(message.aimYaw)
          ? Math.atan2(Math.sin(message.aimYaw), Math.cos(message.aimYaw))
          : null;
        const requestedTankAimPitch = Number.isFinite(message.aimPitch)
          ? Math.max(-0.45, Math.min(0.65, message.aimPitch))
          : null;
        const playerTarget = room?.started && room.members.has(message.targetId)
          ? players.get(message.targetId)
          : null;
        let target = playerTarget ?? (room?.started ? room.monsters.get(message.targetId) : null);
        const rawImpactPosition = message.impactPosition;
        const impactPosition = isTankAttack &&
          rawImpactPosition &&
          Number.isFinite(rawImpactPosition.x) &&
          Number.isFinite(rawImpactPosition.y) &&
          Number.isFinite(rawImpactPosition.z)
          ? {
              x: Math.round(wrapPlanetX(rawImpactPosition.x)),
              y: Math.round(rawImpactPosition.y),
              z: Math.round(rawImpactPosition.z),
            }
          : null;
        const now = Date.now();
        if (
          isTankAttack &&
          (!vehicle || vehicle.type !== "tank" || vehicle.occupantId !== player.id)
        ) {
          writeJson(socket, {
            type: "attack_result",
            hit: false,
            tank: true,
            message: "You must be driving a tank to fire.",
          });
          return;
        }

        if (message.type === "aircraft_fire") {
          const room = rooms.get(player.roomId);
          const aircraft = room?.vehicles.get(player.vehicleId);
          if (
            !room?.started ||
            player.health <= 0 ||
            !aircraft ||
            (aircraft.type !== "plane" && aircraft.type !== "jet") ||
            aircraft.occupantId !== player.id ||
            !aircraft.airborne
          ) {
            writeJson(socket, {
              type: "attack_result",
              hit: false,
              aircraft: true,
              message: "Take off in a plane or jet before firing.",
            });
            return;
          }
          const now = Date.now();
          if (now - player.lastAttackAt < PLAYER_ATTACK_COOLDOWN_MS) {
            writeJson(socket, {
              type: "attack_result",
              hit: false,
              aircraft: true,
              message: "Aircraft guns are reloading.",
            });
            return;
          }
          const aimYaw = Number.isFinite(message.aimYaw) ? message.aimYaw : player.yaw;
          const aimPitch = Number.isFinite(message.aimPitch)
            ? Math.max(-1.2, Math.min(1.2, message.aimPitch))
            : 0;
          const direction = {
            east: -Math.sin(aimYaw) * Math.cos(aimPitch),
            north: Math.cos(aimYaw) * Math.cos(aimPitch),
            up: Math.sin(aimPitch),
          };
          let target = null;
          let closestAlong = 140;
          const candidates = [
            ...[...room.members]
              .filter((id) => id !== player.id)
              .map((id) => players.get(id))
              .filter(Boolean),
            ...room.monsters.values(),
          ];
          for (const candidate of candidates) {
            if (candidate.health <= 0) continue;
            const deltaEast = wrapPlanetX(candidate.x - player.x);
            const deltaNorth = candidate.z - player.z;
            const deltaUp = candidate.y - player.y;
            const along = deltaEast * direction.east + deltaNorth * direction.north + deltaUp * direction.up;
            if (along <= 0 || along >= closestAlong) continue;
            const missDistance = Math.sqrt(Math.max(
              0,
              deltaEast ** 2 + deltaNorth ** 2 + deltaUp ** 2 - along ** 2,
            ));
            if (missDistance > 4) continue;
            target = candidate;
            closestAlong = along;
          }
          player.lastAttackAt = now;
          if (!target) {
            writeJson(socket, {
              type: "attack_result",
              hit: false,
              aircraft: true,
              message: "Aircraft guns missed. Aim at an enemy.",
            });
            return;
          }
          target.health = Math.max(0, target.health - 25);
          const monsterTarget = room.monsters.get(target.id);
          let reward = null;
          if (monsterTarget && target.health === 0) {
            target.respawnAt = now + MONSTER_RESPAWN_MS;
            await incrementProfileStat(player, "creaturesDefeated", 1, profiles, pool);
            reward = awardMonsterKill(player, monsterTarget);
          }
          writeJson(socket, {
            type: "attack_result",
            hit: true,
            aircraft: true,
            targetId: target.id,
            damage: 25,
            monster: Boolean(monsterTarget),
            killed: Boolean(monsterTarget && target.health === 0),
            reward,
            message: `Aircraft guns hit ${target.name ?? "the monster"} for 25 damage.`,
          });
          if (!monsterTarget) {
            writeJson(target.socket, {
              type: "attack_result",
              hit: true,
              aircraft: true,
              hitByAircraft: true,
              damage: 25,
              message: "You were hit by aircraft guns for 25 damage.",
            });
          }
          broadcastToRoom(room, roomSnapshot(room));
          return;
        }
        if (
          !room?.started ||
          player.health <= 0 ||
          now - player.lastAttackAt < (isTankAttack ? TANK_ATTACK_COOLDOWN_MS : PLAYER_ATTACK_COOLDOWN_MS)
        ) {
          writeJson(socket, {
            type: "attack_result",
            hit: false,
            tank: isTankAttack,
            ...(isTankAttack ? { message: "Cannon is reloading." } : {}),
          });
          return;
        }
        if (isTankAttack) {
          if (requestedTankAimYaw !== null) vehicle.turretYaw = requestedTankAimYaw;
          if (requestedTankAimPitch !== null) vehicle.turretPitch = requestedTankAimPitch;
        }
        if (!isTankAttack && vehicle?.type === "tank") {
          writeJson(socket, {
            type: "attack_result",
            hit: false,
            message: "Use the tank cannon while driving.",
          });
          return;
        }
        player.lastAttackAt = now;
        const aimYaw = isTankAttack
          ? requestedTankAimYaw ?? vehicle.turretYaw ?? vehicle.yaw
          : player.yaw;
        const isInTankFiringArc = (candidate) => {
          if (!candidate || candidate.id === player.id || candidate.health <= 0) return false;
          const east = wrapPlanetX(candidate.x - player.x);
          const north = candidate.z - player.z;
          const distance = Math.hypot(east, north);
          const facing = (east * -Math.sin(aimYaw) + north * Math.cos(aimYaw)) / Math.max(distance, 0.001);
          const sidewaysDistance = Math.abs(east * Math.cos(aimYaw) + north * Math.sin(aimYaw));
          return distance <= TANK_ATTACK_RANGE && facing >= 0 && sidewaysDistance <= 2.5;
        };
        if (isTankAttack && typeof message.targetVehicleId === "string") {
          const targetVehicle = room.vehicles.get(message.targetVehicleId);
          if (!targetVehicle || targetVehicle.id === vehicle.id) {
            writeJson(socket, {
              type: "attack_result",
              hit: false,
              tank: true,
              message: "That vehicle is no longer a valid target.",
            });
            return;
          }
          const targetEast = wrapPlanetX(targetVehicle.x - vehicle.x);
          const targetNorth = targetVehicle.z - vehicle.z;
          const targetUp = targetVehicle.y + 1.1 - (vehicle.y + 2.0);
          const pitch = requestedTankAimPitch ?? vehicle.turretPitch ?? 0;
          const directionEast = -Math.sin(aimYaw) * Math.cos(pitch);
          const directionNorth = Math.cos(aimYaw) * Math.cos(pitch);
          const directionUp = Math.sin(pitch);
          const along = targetEast * directionEast + targetNorth * directionNorth + targetUp * directionUp;
          const targetDistance = Math.hypot(targetEast, targetNorth, targetUp);
          const missDistance = Math.sqrt(Math.max(0, targetDistance ** 2 - along ** 2));
          if (along <= 0 || along > TANK_ATTACK_RANGE || missDistance > 3.5) {
            writeJson(socket, {
              type: "attack_result",
              hit: false,
              tank: true,
              message: "Aim the cannon directly at the vehicle.",
            });
            return;
          }
          targetVehicle.health = Math.max(0, (targetVehicle.health ?? targetVehicle.maxHealth ?? 100) - 100);
          const destroyed = targetVehicle.health <= 0;
          if (destroyed) {
            const occupantId = targetVehicle.occupantId;
            if (occupantId) {
              const occupant = players.get(occupantId);
              if (occupant) {
                occupant.vehicleId = null;
                occupant.x = wrapPlanetX(targetVehicle.x + 3);
                occupant.z = targetVehicle.z;
                occupant.y = terrainHeightAt(occupant.x, occupant.z, room.seed) + 2.65;
                occupant.yaw = targetVehicle.yaw;
                writeJson(occupant.socket, {
                  type: "vehicle_result",
                  vehicleId: null,
                  message: "Your vehicle was destroyed. You were ejected safely.",
                });
              }
            }
            room.vehicles.delete(targetVehicle.id);
            if (room.mode === "tank-war" && !room.tankWarOver) {
              const hasTanks = (prefix) => [...room.vehicles.values()].some((tank) => tank.id.startsWith(prefix));
              const cityAlive = hasTanks("city-tank-");
              const rivalAlive = hasTanks("rival-tank-");
              if (!cityAlive || !rivalAlive) {
                room.tankWarOver = true;
                room.winnerId = cityAlive ? room.tankWarOwners[0] : room.tankWarOwners[1];
                broadcastToRoom(room, { type: "tank_war_over", winnerId: room.winnerId ?? null });
              }
            }
          }
          writeJson(socket, {
            type: "attack_result",
            hit: true,
            tank: true,
            vehicleHit: true,
            vehicleId: targetVehicle.id,
            damage: 100,
            health: targetVehicle.health,
            destroyed,
            message: destroyed
              ? `The ${targetVehicle.type} was destroyed.`
              : `The ${targetVehicle.type} took 100 damage.`,
          });
          broadcastToRoom(room, roomSnapshot(room));
          return;
        }
        if (isTankAttack && !impactPosition && !isInTankFiringArc(target)) {
          target = null;
          let closestDistance = TANK_ATTACK_RANGE;
          const candidates = [
            ...room.monsters.values(),
            ...[...room.members]
              .filter((id) => id !== player.id)
              .map((id) => players.get(id))
              .filter(Boolean),
          ];
          for (const candidate of candidates) {
            if (!isInTankFiringArc(candidate)) continue;
            const east = wrapPlanetX(candidate.x - player.x);
            const north = candidate.z - player.z;
            const distance = Math.hypot(east, north);
            if (distance >= closestDistance) continue;
            target = candidate;
            closestDistance = distance;
          }
        }
        if (isTankAttack && impactPosition) target = null;
        if (!target || target.id === player.id || target.health <= 0) {
          if (isTankAttack && impactPosition) {
            const east = wrapPlanetX(impactPosition.x - player.x);
            const north = impactPosition.z - player.z;
            const horizontalDistance = Math.hypot(east, north);
            const facing = (east * -Math.sin(aimYaw) + north * Math.cos(aimYaw))
              / Math.max(horizontalDistance, 0.001);
            if (
              impactPosition.y < BEDROCK_Y ||
              impactPosition.y > MAX_BUILD_HEIGHT ||
              horizontalDistance > TANK_ATTACK_RANGE ||
              facing < 0.2
            ) {
              writeJson(socket, {
                type: "attack_result",
                hit: false,
                tank: true,
                message: "Aim the cannon at a block within range.",
              });
              return;
            }
            let demolished = 0;
            const collected = new Map();
            for (let offsetX = -TANK_BLAST_RADIUS; offsetX <= TANK_BLAST_RADIUS; offsetX += 1) {
              for (let offsetY = -TANK_BLAST_RADIUS; offsetY <= TANK_BLAST_RADIUS; offsetY += 1) {
                for (let offsetZ = -TANK_BLAST_RADIUS; offsetZ <= TANK_BLAST_RADIUS; offsetZ += 1) {
                  if (offsetX ** 2 + offsetY ** 2 + offsetZ ** 2 > TANK_BLAST_RADIUS ** 2) continue;
                  const x = wrapPlanetX(impactPosition.x + offsetX);
                  const y = impactPosition.y + offsetY;
                  const z = impactPosition.z + offsetZ;
                  if (y < BEDROCK_Y || y > MAX_BUILD_HEIGHT) continue;
                  const key = blockKey(x, y, z);
                  const block = room.blocks.has(key)
                    ? room.blocks.get(key)
                    : getBaseBlockAt(x, y, z, room.seed);
                  if (!block) continue;
                  room.blocks.set(key, null);
                  room.blockChanges.set(key, null);
                  addItems(player.inventory, block, 1);
                  collected.set(block, (collected.get(block) ?? 0) + 1);
                  scheduleBlockRebuild(room, key, {
                    block,
                    rebuildAt: now + blockRebuildDelayMs,
                  });
                  broadcastToRoom(room, {
                    type: "block",
                    action: "remove",
                    position: { x, y, z },
                    block,
                  });
                  demolished += 1;
                }
              }
            }
            writeJson(socket, {
              type: "attack_result",
              hit: demolished > 0,
              tank: true,
              demolished,
              loot: [...collected].map(([item, count]) => ({
                item,
                count,
                total: player.inventory.get(item),
              })),
              inventory: inventoryItems(player.inventory),
              message: demolished > 0
                ? `Cannon destroyed ${demolished} block${demolished === 1 ? "" : "s"}. Repairs in 3 minutes.`
                : "Nothing to destroy at the impact point.",
            });
            if (demolished > 0) {
              writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
            }
            return;
          }
          writeJson(socket, {
            type: "attack_result",
            hit: false,
            tank: isTankAttack,
            ...(isTankAttack ? { message: "No target in reach. Aim the turret at an enemy." } : {}),
          });
          return;
        }

        const weapon = !isTankAttack && typeof message.weapon === "string" ? message.weapon : null;
        if (weapon && (!PLAYER_WEAPON_DAMAGE.has(weapon) || (player.inventory.get(weapon) ?? 0) < 1)) {
          writeJson(socket, { type: "attack_result", hit: false, message: "You do not have that weapon equipped." });
          return;
        }

        const east = wrapPlanetX(target.x - player.x);
        const north = target.z - player.z;
        const distance = Math.hypot(east, north);
        const facing = (east * -Math.sin(aimYaw) + north * Math.cos(aimYaw)) / Math.max(distance, 0.001);
        if (distance > (isTankAttack ? TANK_ATTACK_RANGE : PLAYER_ATTACK_RANGE) || facing < 0.2) {
          writeJson(socket, {
            type: "attack_result",
            hit: false,
            tank: isTankAttack,
            message: "No target in reach.",
          });
          return;
        }

        const damage = isTankAttack
          ? TANK_ATTACK_DAMAGE
          : weapon
            ? PLAYER_WEAPON_DAMAGE.get(weapon) + (player.gearTier ?? 0) * 6
            : getPlayerAttackPower(player);
        target.health = Math.max(0, target.health - damage);
        const monsterTarget = room.monsters.get(target.id);
        let reward = null;
        if (monsterTarget && target.health === 0) {
          target.respawnAt = now + MONSTER_RESPAWN_MS;
          await incrementProfileStat(player, "creaturesDefeated", 1, profiles, pool);
          reward = awardMonsterKill(player, monsterTarget);
        }
        writeJson(socket, {
          type: "attack_result",
          hit: true,
          targetId: target.id,
          damage,
          health: target.health,
          monster: Boolean(monsterTarget),
          tank: isTankAttack,
          killed: Boolean(monsterTarget && target.health === 0),
          reward,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "mission_offers") {
        expireMissionIfDue(player);
        player.missions = refreshDailyMissions(player.missions ?? createEmptyMissions(), Date.now());
        sendMissionState(player);
        return;
      }

      if (message.type === "mission_accept") {
        expireMissionIfDue(player);
        const result = acceptMission(player.missions, String(message.offerId ?? ""), Date.now());
        player.missions = result.missions;
        sendMissionState(player);
        writeJson(socket, {
          type: "mission_result",
          message: result.error ?? `Mission accepted: ${player.missions.active.label}.`,
        });
        return;
      }

      if (message.type === "mission_abandon") {
        expireMissionIfDue(player);
        if (!player.missions.active) {
          writeJson(socket, { type: "mission_result", message: "You have no active mission." });
          return;
        }
        const failed = failMission(player.missions);
        player.missions = failed.missions;
        player.coins = Math.max(0, (player.coins ?? 0) - failed.penalty);
        sendMissionState(player);
        writeJson(socket, { type: "currency", coins: player.coins });
        writeJson(socket, { type: "mission_result", message: `Mission abandoned. -${failed.penalty} coins.` });
        return;
      }

      if (message.type === "fish") {
        const room = rooms.get(player.roomId);
        const now = Date.now();
        if (!room?.started || player.health <= 0) return;
        if ((player.inventory.get("fishing_rod") ?? 0) < 1) {
          writeJson(socket, { type: "fish_result", caught: false, message: "You need a fishing rod to fish." });
          return;
        }
        if (!isNearHarbor(player.x, player.z)) {
          writeJson(socket, { type: "fish_result", caught: false, message: "Go to the harbor pier to fish." });
          return;
        }
        if (now - player.lastFishAt < 2500) {
          writeJson(socket, { type: "fish_result", caught: false, message: "Give the line a moment before casting again." });
          return;
        }
        const fish = rollFishReward();
        player.lastFishAt = now;
        addItems(player.inventory, fish.id, 1);
        writeJson(socket, {
          type: "fish_result",
          caught: true,
          item: fish.id,
          rarity: fish.rarity,
          value: fish.value,
          message: `You caught a ${fish.label}!`,
        });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        recordJobProgress(player, "catch", 1);
        return;
      }

      if (message.type === "sell") {
        const room = rooms.get(player.roomId);
        if (!room?.started) return;
        const item = typeof message.item === "string" ? message.item : "";
        const count = Number(message.count);
        const fish = FISH_TYPE_BY_ID.get(item);
        if (!fish || !Number.isInteger(count) || count < 1 || !removeItems(player.inventory, item, count)) {
          writeJson(socket, { type: "error", message: "You do not have that many fish to sell." });
          return;
        }
        const payout = fish.value * count;
        player.coins = (player.coins ?? 0) + payout;
        const missionNotice = applyMissionEvent(player, "sell_fish", count);
        sendMissionState(player);
        writeJson(socket, {
          type: "sell_result",
          item,
          count,
          value: payout,
          coins: player.coins,
          message: `Sold ${count} ${fish.label} for ${payout} coins.${missionNotice ? ` ${missionNotice}` : ""}`,
        });
        writeJson(socket, { type: "currency", coins: player.coins });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        return;
      }

      if (message.type === "buy_model") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0) return;
        const model = MODEL_ITEM_BY_ID.get(message.item);
        if (!model) {
          writeJson(socket, { type: "error", message: "That shop item is unavailable." });
          return;
        }
        if (room.mode !== "design" && player.coins < model.price) {
          writeJson(socket, { type: "error", message: `You need ${model.price} coins to buy ${model.name}.` });
          return;
        }
        if (room.mode !== "design") player.coins -= model.price;
        addItems(player.inventory, model.id, 1);
        writeJson(socket, {
          type: "buy_result",
          item: model.id,
          coins: player.coins,
          message: `Bought ${model.name} for ${room.mode === "design" ? 0 : model.price} coins.`,
        });
        writeJson(socket, { type: "currency", coins: player.coins });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        return;
      }

      if (message.type === "buy_food") {
        const room = rooms.get(player.roomId);
        const meal = RESTAURANT_MENU_BY_ID.get(message.item);
        if (!room?.started || player.health <= 0) return;
        if (!meal) {
          writeJson(socket, { type: "error", message: "That restaurant item is unavailable." });
          return;
        }
        if (!isNearRestaurant(player.x, player.z, room.seed)) {
          writeJson(socket, { type: "error", message: "Visit the Sunset Diner, Parkside Cafe, or Glass City Bakery to order food." });
          return;
        }
        if (room.mode !== "design" && player.coins < meal.price) {
          writeJson(socket, { type: "error", message: `You need ${meal.price} coins to buy ${meal.name}.` });
          return;
        }
        if (room.mode !== "design") player.coins -= meal.price;
        addItems(player.inventory, meal.id, 1);
        writeJson(socket, {
          type: "food_result",
          action: "buy",
          item: meal.id,
          coins: player.coins,
          message: `Bought ${meal.name} for ${room.mode === "design" ? 0 : meal.price} coins. Eat it from your inventory.`,
        });
        writeJson(socket, { type: "currency", coins: player.coins });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        return;
      }

      if (message.type === "bot_trade") {
        const room = rooms.get(player.roomId);
        const bot = room?.bots.get(message.botId);
        const item = typeof message.item === "string" ? message.item : "";
        const count = Number(message.count);
        if (!room?.started || player.health <= 0 || !bot?.missionGiver || !Number.isInteger(count) || count < 1 ||
          Math.hypot(wrapPlanetX(bot.x - player.x), bot.z - player.z) > 4) {
          writeJson(socket, { type: "error", message: "Move closer to a villager to trade." });
          return;
        }
        if (!removeItems(player.inventory, item, count)) {
          writeJson(socket, { type: "error", message: "You do not have that many of that item." });
          return;
        }
        const fish = FISH_TYPE_BY_ID.get(item);
        const payout = fish ? fish.value * count : 0;
        player.coins = (player.coins ?? 0) + payout;
        if (fish) {
          applyMissionEvent(player, "sell_fish", count);
          sendMissionState(player);
        }
        writeJson(socket, {
          type: "bot_trade_result",
          botName: bot.name,
          item,
          count,
          value: payout,
          coins: player.coins,
          message: payout > 0
            ? `${bot.name} bought ${count} for ${payout} coins.`
            : `${bot.name} thanks you for the gift!`,
        });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        writeJson(socket, { type: "currency", coins: player.coins });
        return;
      }

      if (message.type === "bot_talk") {
        const room = rooms.get(player.roomId);
        const bot = room?.bots.get(message.botId);
        if (!room?.started || player.health <= 0 || !bot?.missionGiver ||
          Math.hypot(wrapPlanetX(bot.x - player.x), bot.z - player.z) > 4) {
          writeJson(socket, { type: "error", message: "Move closer to a villager to talk." });
          return;
        }
        engageBotWithPlayer(bot, player);
        const greetings = ["Good to see you! Got a minute?", "The creatures have been restless lately.", "Fair weather for a walk, isn't it?", "Stop by the board if you want work."];
        expireMissionIfDue(player);
        const added = bot.missionTemplateId ? addMissionToBoard(player.missions, bot.missionTemplateId, Date.now()) : null;
        if (added) player.missions = added.missions;
        sendMissionState(player);
        const index = bot.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % greetings.length;
        writeJson(socket, { type: "bot_greeting", botId: bot.id, botName: bot.name, greeting: added ? (added.error ?? `I've added "${MISSION_TEMPLATE_BY_ID.get(bot.missionTemplateId).label}" to your mission board. Want to take it?`) : greetings[index] });
        return;
      }

      if (message.type === "restaurant_talk") {
        const room = rooms.get(player.roomId);
        const bot = room?.bots.get(message.botId);
        const shop = bot?.restaurantShopId
          ? listCityShops(room.seed).find(({ id }) => id === bot.restaurantShopId && id === message.shopId)
          : null;
        if (!room?.started || player.health <= 0 || !bot || !shop ||
          Math.hypot(wrapPlanetX(bot.x - player.x), bot.z - player.z) > 4) {
          writeJson(socket, { type: "error", message: "Move closer to a diner or bakery worker to talk." });
          return;
        }
        const greeting = bot.restaurantRole === "server"
          ? shop.bakery
            ? "Welcome! We have fresh bread and warm treats. What can I get for you?"
            : `Welcome to ${shop.name}! Take a seat and have a look at today's menu.`
          : "This is a lovely place to eat. The food is fresh and filling!";
        writeJson(socket, {
          type: "restaurant_dialogue",
          botId: bot.id,
          botName: bot.name,
          shopId: shop.id,
          shopName: shop.name,
          greeting,
        });
        return;
      }

      if (message.type === "restaurant_seat") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0 || player.vehicleId || player.mountId) return;
        if (player.sittingAt) {
          player.sittingAt = null;
          player.y = terrainHeightAt(player.x, player.z, room.seed) + 2.65;
          writeJson(socket, {
            type: "restaurant_seat_result",
            seated: false,
            position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
            message: "You stand up.",
          });
          broadcastToRoom(room, roomSnapshot(room));
          return;
        }
        const shop = listCityShops(room.seed).find(({ id, foodShop, x, doorZ, interiorZ }) =>
          foodShop && id === message.shopId &&
          Math.abs(wrapPlanetX(player.x - x)) <= 5 &&
          player.z >= doorZ + 1 &&
          player.z <= interiorZ + 2,
        );
        if (!shop) {
          writeJson(socket, { type: "restaurant_seat_result", seated: false, message: "Choose a seat inside a diner or bakery." });
          return;
        }
        player.x = wrapPlanetX(shop.x - 3);
        player.z = shop.interiorZ - 1;
        player.y = terrainHeightAt(player.x, player.z, room.seed) + 2.65;
        player.yaw = 0;
        player.sittingAt = shop.id;
        writeJson(socket, {
          type: "restaurant_seat_result",
          seated: true,
          position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
          message: `You sit down at ${shop.name}. Press E to stand.`,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "plant_crop" || message.type === "harvest_crop") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0) return;
        const plot = FARM_PLOTS[Number(message.plot)];
        if (!plot) {
          writeJson(socket, { type: "error", message: "That plot does not exist." });
          return;
        }
        if (Math.hypot(wrapPlanetX(player.x - plot.x), player.z - plot.z) > 6) {
          writeJson(socket, { type: "error", message: "Walk up to the plot first." });
          return;
        }
        room.crops ??= new Map();
        const crop = room.crops.get(plot.id);
        if (message.type === "plant_crop") {
          if (crop) {
            writeJson(socket, { type: "error", message: "This plot is already planted." });
            return;
          }
          if (!removeItems(player.inventory, CROP_SEED_ITEM, 1)) {
            writeJson(socket, { type: "error", message: "You need a wheat seed to plant." });
            return;
          }
          room.crops.set(plot.id, { plantedAt: Date.now(), ownerId: player.id });
          writeJson(socket, { type: "farm_result", action: "plant", plot: plot.id, message: "Planted wheat." });
        } else {
          if (!crop || cropStage(crop) !== "ripe") {
            writeJson(socket, { type: "error", message: "Nothing ripe to harvest here." });
            return;
          }
          room.crops.delete(plot.id);
          addItems(player.inventory, CROP_HARVEST_ITEM, CROP_HARVEST_YIELD);
          addItems(player.inventory, CROP_SEED_ITEM, CROP_HARVEST_SEEDS);
          writeJson(socket, { type: "farm_result", action: "harvest", plot: plot.id, message: "Harvested wheat." });
        }
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        return;
      }

      if (message.type === "eat_food") {
        const room = rooms.get(player.roomId);
        const meal = RESTAURANT_MENU_BY_ID.get(message.item)
          ?? (message.item === CROP_HARVEST_ITEM ? { id: CROP_HARVEST_ITEM, name: "Wheat", healing: CROP_HEALING } : null);
        if (!room?.started || player.health <= 0) return;
        if (!meal) {
          writeJson(socket, { type: "error", message: "That food cannot be eaten." });
          return;
        }
        if ((player.inventory.get(meal.id) ?? 0) < 1) {
          writeJson(socket, { type: "error", message: `You do not have ${meal.name}.` });
          return;
        }
        const maxHealth = MAX_PLAYER_HEALTH + (player.gearTier ?? 0) * 10;
        if (player.health >= maxHealth) {
          writeJson(socket, { type: "error", message: "Your health is already full." });
          return;
        }
        const previousHealth = player.health;
        removeItems(player.inventory, meal.id, 1);
        player.health = Math.min(maxHealth, player.health + meal.healing);
        const restoredHealth = player.health - previousHealth;
        writeJson(socket, {
          type: "food_result",
          action: "eat",
          item: meal.id,
          health: player.health,
          message: `Ate ${meal.name} and restored ${restoredHealth} health.`,
        });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        return;
      }

      if (message.type === "use_potion") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0) return;
        const potionId = typeof message.item === "string" ? message.item : "";
        if (!potionId || !(potionId === "health_potion" || potionId === "strength_potion")) {
          writeJson(socket, { type: "error", message: "That is not a usable potion." });
          return;
        }
        if ((player.inventory.get(potionId) ?? 0) < 1) {
          writeJson(socket, { type: "error", message: `You need a ${potionId.replace("_", " ")} to use that.` });
          return;
        }
        removeItems(player.inventory, potionId, 1);
        const effect = applyPotionEffect(player, potionId);
        writeJson(socket, {
          type: "potion_result",
          item: potionId,
          health: player.health,
          message: effect.message,
        });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        return;
      }

      if (message.type === "upgrade_gear") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0) return;
        const gearTier = Math.min((player.gearTier ?? 0) + 1, 4);
        const requirements = new Map([
          [1, { iron_ingot: 3, emerald: 1 }],
          [2, { steel_ingot: 3, ruby: 1 }],
          [3, { steel_armor: 1, guardian_helm: 1 }],
          [4, { boss_key: 1, strength_potion: 1 }],
        ]);
        const needed = requirements.get(gearTier);
        if (!needed) {
          writeJson(socket, { type: "error", message: "You already have the strongest gear tier." });
          return;
        }
        if (!Object.entries(needed).every(([item, amount]) => (player.inventory.get(item) ?? 0) >= amount)) {
          writeJson(socket, { type: "error", message: "You are missing items to upgrade your gear." });
          return;
        }
        for (const [item, amount] of Object.entries(needed)) removeItems(player.inventory, item, amount);
        player.gearTier = gearTier;
        player.health = Math.min(MAX_PLAYER_HEALTH + gearTier * 10, player.health + 12);
        writeJson(socket, {
          type: "upgrade_result",
          gearTier,
          health: player.health,
          message: `Your gear is now tier ${gearTier}.`,
        });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        return;
      }

      if (message.type === "respawn") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health > 0) return;
        releaseVehicle(room, player);
        player.health = MAX_PLAYER_HEALTH;
        player.x = 0;
        player.z = 0;
        player.y = terrainHeightAt(player.x, player.z, room.seed) + 2.65;
        player.yaw = 0;
        writeJson(socket, {
          type: "respawn_result",
          position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
          health: player.health,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "move") {
        if (!rooms.get(player.roomId)?.started || player.health <= 0) return;
        if (player.sittingAt) return;
        if (!validPlayerPosition(message.position)) {
          writeJson(socket, { type: "error", message: "Movement was outside the world." });
          return;
        }
        const room = rooms.get(player.roomId);
        const vehicle = room?.vehicles.get(player.vehicleId);
        if (player.vehicleId && vehicle?.occupantId !== player.id) return;
        const mount = room?.animals.get(player.mountId);
        if (player.mountId && mount?.riderId !== player.id) return;
        if (
          vehicle?.type === "boat" &&
          terrainHeightAt(message.position.x, message.position.z, room.seed) >= 0
        ) {
          writeJson(socket, {
            type: "move_rejected",
            position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
          });
          return;
        }
        if (mount && terrainHeightAt(message.position.x, message.position.z, room.seed) < 0) {
          writeJson(socket, {
            type: "move_rejected",
            position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
          });
          return;
        }
        const aircraft = vehicle?.type === "plane" || vehicle?.type === "jet" ? vehicle : null;
        const requestedY = mount
          ? terrainHeightAt(message.position.x, message.position.z, room.seed) + 3.65
          : aircraft && !aircraft.airborne
          ? terrainHeightAt(message.position.x, message.position.z, room.seed) + 2.65
          : aircraft
            ? Math.max(
                terrainHeightAt(message.position.x, message.position.z, room.seed) + 2.65,
                Math.min(MAX_BUILD_HEIGHT + 2.65, message.position.y ?? player.y),
              )
            : message.position.y ?? player.y;
        const groundVehicle = vehicle &&
          (vehicle.type === "car" || vehicle.type === "police" || vehicle.type === "tank");
        if (
          !room ||
          !playerCanOccupy(
            room,
            message.position.x,
            requestedY,
            message.position.z,
          ) ||
          (groundVehicle && !vehicleHasGroundClearance(
            vehicle,
            message.position.x,
            message.position.z,
            message.position.yaw,
            room.seed,
            room.blocks,
          ))
        ) {
          writeJson(socket, {
            type: "move_rejected",
            position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
          });
          return;
        }
        player.x = message.position.x;
        player.z = message.position.z;
        player.y = Number.isFinite(requestedY)
          ? requestedY
          : terrainHeightAt(player.x, player.z, room.seed) + 2.65;
        if (vehicle?.type === "boat") player.y = vehicle.y + 2.65;
        player.yaw = message.position.yaw;
        if (mount) {
          const previousX = mount.x;
          const previousZ = mount.z;
          mount.x = player.x;
          mount.z = player.z;
          mount.y = terrainHeightAt(mount.x, mount.z, room.seed) + 1;
          mount.yaw = player.yaw;
          mount.walking = Math.hypot(wrapPlanetX(mount.x - previousX), mount.z - previousZ) > 0.01;
        }
        if (vehicle) {
          const previousVehicleYaw = vehicle.yaw;
          const previousVehicleX = vehicle.x;
          const previousVehicleZ = vehicle.z;
          vehicle.x = player.x;
          vehicle.y = player.y - 2.65;
          vehicle.z = player.z;
          vehicle.yaw = player.yaw;
          if (aircraft) vehicle.airborne = aircraft.airborne;
          if (vehicle.type === "tank" && Number.isFinite(message.position.turretYaw)) {
            vehicle.turretYaw = Math.atan2(
              Math.sin(message.position.turretYaw),
              Math.cos(message.position.turretYaw),
            );
            if (Number.isFinite(message.position.turretPitch)) {
              vehicle.turretPitch = Math.max(-0.45, Math.min(0.65, message.position.turretPitch));
            }
          } else if (vehicle.type === "tank") {
            const turretYaw = vehicle.turretYaw ?? previousVehicleYaw;
            const hullTurn = Math.atan2(
              Math.sin(vehicle.yaw - previousVehicleYaw),
              Math.cos(vehicle.yaw - previousVehicleYaw),
            );
            vehicle.turretYaw = Math.atan2(
              Math.sin(turretYaw + hullTurn),
              Math.cos(turretYaw + hullTurn),
            );
          }
          if (vehicle.type === "tank") {
            const segmentX = wrapPlanetX(vehicle.x - previousVehicleX);
            const segmentZ = vehicle.z - previousVehicleZ;
            const segmentLengthSquared = segmentX ** 2 + segmentZ ** 2;
            const now = Date.now();
            for (const id of room.members) {
              if (id === player.id) continue;
              const target = players.get(id);
              if (!target || target.health <= 0 || target.vehicleId || now - (target.lastRunOverAt ?? 0) < 800) continue;
              if (Math.abs(target.y - 1.65 - vehicle.y) > 2.6) continue;
              const targetX = wrapPlanetX(target.x - previousVehicleX);
              const targetZ = target.z - previousVehicleZ;
              const progress = segmentLengthSquared > 0
                ? Math.max(0, Math.min(1, (targetX * segmentX + targetZ * segmentZ) / segmentLengthSquared))
                : 0;
              const distance = Math.hypot(targetX - segmentX * progress, targetZ - segmentZ * progress);
              if (distance > 1.8) continue;
              target.lastRunOverAt = now;
              target.health = Math.max(0, target.health - 35);
              writeJson(target.socket, {
                type: "attack_result",
                hit: true,
                hitByVehicle: true,
                damage: 35,
                message: "You were run over by a tank for 35 damage.",
              });
              writeJson(socket, {
                type: "attack_result",
                hit: true,
                vehicleHit: true,
                damage: 35,
                targetId: target.id,
                message: `Tank ran over ${target.name} for 35 damage.`,
              });
            }
          }
        }
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "boat_build") {
        const room = rooms.get(player.roomId);
        const design = normalizeBoatDesign(message.design);
        if (!room?.started || player.health <= 0) {
          writeJson(socket, { type: "boat_result", success: false, message: "Start a world before building a boat." });
          return;
        }
        if (!isNearBoatWorkshop(player.x, player.z)) {
          writeJson(socket, { type: "boat_result", success: false, message: "Build boats at the harbor Boat Workshop." });
          return;
        }
        if (!design) {
          writeJson(socket, { type: "boat_result", success: false, message: "That boat design is invalid." });
          return;
        }
        const ownedBoats = [...room.vehicles.values()].filter(({ ownerId }) => ownerId === player.id).length;
        if (ownedBoats >= 4) {
          writeJson(socket, { type: "boat_result", success: false, message: "You can launch up to four boats. Remove one before building another." });
          return;
        }
        const spawn = createBoatSpawn(room);
        if (!spawn) {
          writeJson(socket, { type: "boat_result", success: false, message: "The harbor launch is full. Try again when a boat has moved away." });
          return;
        }
        const materials = boatMaterials(design);
        if (room.mode !== "design") {
          const missing = Object.entries(materials).find(([item, count]) => (player.inventory.get(item) ?? 0) < count);
          if (missing) {
            writeJson(socket, {
              type: "boat_result",
              success: false,
              message: `You need ${materials.oak_planks} planks, ${materials.glass} glass${design.cabin ? " and one door" : ""} to build this boat.`,
            });
            return;
          }
          for (const [item, count] of Object.entries(materials)) {
            if (count > 0) removeItems(player.inventory, item, count);
          }
          writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        }
        const boat = {
          id: `player-boat-${randomUUID()}`,
          type: "boat",
          x: spawn.x,
          y: 0,
          z: spawn.z,
          yaw: 0,
          design,
          health: 100,
          maxHealth: 100,
          ownerId: player.id,
          occupantId: null,
        };
        room.vehicles.set(boat.id, boat);
        writeJson(socket, {
          type: "boat_result",
          success: true,
          vehicleId: boat.id,
          message: `${design.name} launched! Walk to the waterline and press E or Vehicle to board.`,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "animal_mount") {
        const room = rooms.get(player.roomId);
        const mount = room?.animals.get(message.animalId);
        if (!room?.started || player.health <= 0) return;
        if (mount?.id === player.mountId && mount.riderId === player.id) {
          mount.riderId = null;
          mount.walking = false;
          player.mountId = null;
          player.y = terrainHeightAt(player.x, player.z, room.seed) + 2.65;
          writeJson(socket, {
            type: "animal_mount_result",
            mountId: null,
            position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
            message: "You dismounted the horse.",
          });
          broadcastToRoom(room, roomSnapshot(room));
          return;
        }
        if (
          !mount ||
          mount.model !== "horse" ||
          mount.riderId ||
          player.vehicleId ||
          Math.hypot(wrapPlanetX(mount.x - player.x), mount.z - player.z) > 4
        ) {
          writeJson(socket, {
            type: "animal_mount_result",
            mountId: player.mountId ?? null,
            message: "Move closer to an available horse to ride.",
          });
          return;
        }
        if (!playerCanOccupy(room, mount.x, mount.y + 2.65, mount.z)) {
          writeJson(socket, {
            type: "animal_mount_result",
            mountId: player.mountId ?? null,
            message: "There is not enough room to ride here.",
          });
          return;
        }
        releaseVehicle(room, player);
        mount.riderId = player.id;
        player.mountId = mount.id;
        player.flightEnabled = false;
        player.x = mount.x;
        player.z = mount.z;
        player.y = mount.y + 2.65;
        player.yaw = mount.yaw;
        writeJson(socket, {
          type: "animal_mount_result",
          mountId: mount.id,
          position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
          message: `Riding ${mount.name}. Press E or Vehicle to dismount.`,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "race_invite") {
        const room = rooms.get(player.roomId);
        if (!room?.started || !room.members.has(message.targetId) || message.targetId === player.id || room.raceDuel) {
          writeJson(socket, { type: "error", message: "You cannot invite that player right now." });
          return;
        }
        room.raceInvites ??= new Map();
        room.raceInvites.set(message.targetId, player.id);
        sendToPlayers([message.targetId], { type: "race_invite", fromId: player.id, fromName: player.name });
        writeJson(socket, { type: "race_status", message: "Invite sent." });
        return;
      }

      if (message.type === "race_accept" || message.type === "race_decline") {
        const room = rooms.get(player.roomId);
        const hostId = room?.raceInvites?.get(player.id);
        if (!room || !hostId) {
          writeJson(socket, { type: "error", message: "No race invite to answer." });
          return;
        }
        room.raceInvites.delete(player.id);
        if (message.type === "race_decline" || room.raceDuel) {
          sendToPlayers([hostId], { type: "race_status", message: `${player.name} did not join the race.` });
          return;
        }
        room.raceDuel = { hostId, guestId: player.id, ready: new Set(), status: "ready", startedAt: 0, lastHitAt: 0 };
        sendToPlayers([hostId, player.id], { type: "race_duel", status: "ready", hostId, guestId: player.id });
        return;
      }

      if (message.type === "race_ready" || message.type === "race_leave") {
        const room = rooms.get(player.roomId);
        const duel = room?.raceDuel;
        if (!duel || (duel.hostId !== player.id && duel.guestId !== player.id)) {
          writeJson(socket, { type: "error", message: "You are not in a race." });
          return;
        }
        if (message.type === "race_leave") {
          endRaceDuel(room, duel.hostId === player.id ? duel.guestId : duel.hostId, "A player left the race.");
          return;
        }
        if (duel.status !== "ready") return;
        duel.ready.add(player.id);
        if (duel.ready.size < 2) {
          sendToPlayers([duel.hostId, duel.guestId], { type: "race_duel", status: "waiting", readyIds: [...duel.ready] });
          return;
        }
        const freeCars = [...room.vehicles.values()].filter((vehicle) => isRaceCar(vehicle) && !vehicle.occupantId);
        if (freeCars.length < 2) {
          duel.ready.clear();
          writeJson(socket, { type: "error", message: "Two race cars must be free to start a race." });
          return;
        }
        const seat = (participantId, car) => {
          const participant = players.get(participantId);
          if (!participant) return;
          releaseVehicle(room, participant);
          car.occupantId = participantId;
          participant.vehicleId = car.id;
          participant.x = car.x;
          participant.z = car.z;
          participant.y = car.y + 2.65;
          participant.yaw = car.yaw;
          sendToPlayers([participantId], {
            type: "teleport_result",
            position: { x: participant.x, y: participant.y, z: participant.z, yaw: participant.yaw },
            targetId: null,
            locationId: null,
            locationName: null,
          });
        };
        seat(duel.hostId, freeCars[0]);
        seat(duel.guestId, freeCars[1]);
        duel.status = "racing";
        duel.startedAt = Date.now();
        sendToPlayers([duel.hostId, duel.guestId], { type: "race_duel", status: "racing", hostId: duel.hostId, guestId: duel.guestId });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "vehicle_enter" || message.type === "vehicle_exit" || message.type === "race_car_join") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0) return;
        if (message.type === "vehicle_exit") {
          const vehicle = room.vehicles.get(player.vehicleId);
          if (
            (vehicle?.type === "plane" || vehicle?.type === "jet") &&
            vehicle.airborne
          ) {
            writeJson(socket, { type: "error", message: "Land the aircraft before exiting." });
            return;
          }
          releaseVehicle(room, player);
          writeJson(socket, { type: "vehicle_result", vehicleId: null, message: "You left the vehicle." });
          broadcastToRoom(room, roomSnapshot(room));
          return;
        }
        const vehicle = room.vehicles.get(message.vehicleId);
        if (
          !vehicle ||
          (vehicle.occupantId && vehicle.occupantId !== player.id) ||
          (room.mode === "tank-war" && vehicle.type === "tank" && vehicle.ownerId !== player.id) ||
          (message.type === "race_car_join" && !isRaceCar(vehicle)) ||
          (message.type !== "race_car_join" && Math.hypot(wrapPlanetX(vehicle.x - player.x), vehicle.z - player.z) > 4)
        ) {
          writeJson(socket, { type: "vehicle_result", vehicleId: null, message: "Move closer to an available vehicle." });
          return;
        }
        releaseVehicle(room, player);
        if (message.type === "race_car_join") {
          player.x = vehicle.x;
          player.z = vehicle.z;
        }
        if (!playerCanOccupy(room, vehicle.x, vehicle.y + 2.65, vehicle.z)) {
          writeJson(socket, { type: "vehicle_result", vehicleId: null, message: "There is not enough room to enter that vehicle." });
          return;
        }
        vehicle.occupantId = player.id;
        player.vehicleId = vehicle.id;
        player.x = vehicle.x;
        player.z = vehicle.z;
        player.y = vehicle.y + 2.65;
        player.yaw = vehicle.yaw;
        if (message.type === "race_car_join") {
          writeJson(socket, {
            type: "teleport_result",
            position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
            targetId: null,
            locationId: null,
            locationName: null,
          });
        }
        writeJson(socket, {
          type: "vehicle_result",
          vehicleId: vehicle.id,
          vehicleType: vehicle.type,
          message: `Entered ${vehicle.type}. Press E to exit.`,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "repair_vehicle") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0) return;
        const vehicle = [...room.vehicles.values()].find((entry) =>
          Math.hypot(wrapPlanetX(entry.x - player.x), entry.z - player.z) <= 4);
        if (!vehicle) {
          writeJson(socket, { type: "error", message: "Move closer to a vehicle to repair it." });
          return;
        }
        if (!vehicle.damaged) {
          writeJson(socket, { type: "error", message: "That vehicle doesn't need repairs." });
          return;
        }
        if (!removeItems(player.inventory, "iron_ingot", 1)) {
          writeJson(socket, { type: "error", message: "You need an iron ingot to repair a vehicle." });
          return;
        }
        vehicle.damaged = false;
        broadcastToRoom(room, roomSnapshot(room));
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        recordJobProgress(player, "repair", 1);
        return;
      }

      if (message.type === "fly_toggle") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0 || typeof message.enabled !== "boolean" || (message.enabled && player.mountId)) {
          writeJson(socket, { type: "fly_result", enabled: false, message: "Flight is unavailable right now." });
          return;
        }
        const vehicle = room.vehicles.get(player.vehicleId);
        const isAircraft = vehicle?.type === "plane" || vehicle?.type === "jet";
        if (vehicle && !isAircraft) {
          writeJson(socket, { type: "fly_result", enabled: false, message: "This vehicle cannot fly." });
          return;
        }
        if (isAircraft && vehicle.occupantId !== player.id) return;
        if (isAircraft) {
          vehicle.airborne = message.enabled;
          if (!message.enabled) {
            player.y = terrainHeightAt(player.x, player.z, room.seed) + 2.65;
            vehicle.y = player.y - 2.65;
          }
        } else {
          player.flightEnabled = message.enabled;
        }
        writeJson(socket, {
          type: "fly_result",
          enabled: isAircraft ? vehicle.airborne : player.flightEnabled,
          vehicleId: isAircraft ? vehicle.id : null,
          ...(!vehicle || (isAircraft && !vehicle.airborne)
            ? { position: { x: player.x, y: player.y, z: player.z } }
            : {}),
          message: (isAircraft ? vehicle.airborne : player.flightEnabled)
            ? "Takeoff enabled. Use Up to climb and Down to descend."
            : isAircraft ? "Landed safely." : "Flight disabled.",
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "chunk") {
        const room = rooms.get(player.roomId);
        if (!room?.started) return;
        const { x, z } = message;
        if (
          !Number.isSafeInteger(x) ||
          !Number.isSafeInteger(z) ||
          x < MIN_PLANET_CHUNK_X ||
          x > MAX_PLANET_CHUNK_X ||
          z < MIN_PLANET_CHUNK_Z ||
          z > MAX_PLANET_CHUNK_Z
        ) {
          writeJson(socket, { type: "error", message: "That world region is outside the supported range." });
          return;
        }
        const blockChangesInChunk = [];
        for (const [key, type] of room.blockChanges) {
          const [blockX, blockY, blockZ] = key.split(",").map(Number);
          if (Math.floor(blockX / CHUNK_SIZE) === x && Math.floor(blockZ / CHUNK_SIZE) === z) {
            blockChangesInChunk.push([[blockX, blockY, blockZ], type]);
          }
        }
        writeJson(socket, { type: "chunk", x, z, blockChanges: blockChangesInChunk });
        return;
      }

      if (message.type === "drop") {
        const room = rooms.get(player.roomId);
        if (!room?.started) return;
        const { item, count } = message;
        if (
          typeof item !== "string" ||
          !BLOCK_TYPES.has(item) ||
          !Number.isInteger(count) ||
          count < 1 ||
          count > MAX_STACK_SIZE ||
          !removeItems(player.inventory, item, count)
        ) {
          writeJson(socket, { type: "error", message: "You do not have that many items to drop." });
          return;
        }
        const dropId = randomUUID();
        room.droppedItems.set(dropId, {
          id: dropId,
          item,
          count,
          x: wrapPlanetX(player.x - Math.sin(player.yaw) * 2.2),
          z: player.z - Math.cos(player.yaw) * 2.2,
          expiresAt: Date.now() + 300_000,
        });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "pickup") {
        const room = rooms.get(player.roomId);
        if (!room?.started) return;
        let closest;
        let closestDistance = 1.8;
        for (const drop of room.droppedItems.values()) {
          const distance = Math.hypot(wrapPlanetX(drop.x - player.x), drop.z - player.z);
          if (distance < closestDistance) {
            closest = drop;
            closestDistance = distance;
          }
        }
        if (!closest) return;

        const amount = closest.count;
        if (amount < 1) return;
        addItems(player.inventory, closest.item, amount);
        closest.count -= amount;
        if (closest.count === 0) room.droppedItems.delete(closest.id);
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "craft") {
        const recipe = RECIPES.find((candidate) => candidate.id === message.recipe);
        if (!recipe || !canCraft(player.inventory, recipe)) {
          writeJson(socket, { type: "error", message: "You do not have the materials for that recipe." });
          return;
        }
        if (recipe.station && !hasNearbyBlock(rooms.get(player.roomId), player, recipe.station)) {
          writeJson(socket, { type: "error", message: `Place a ${recipe.station.replace("_", " ")} next to you to cook this.` });
          return;
        }
        for (const [item, amount] of Object.entries(recipe.ingredients)) {
          removeItems(player.inventory, item, amount);
        }
        addItems(player.inventory, recipe.result, recipe.resultCount);
        player.xp = (player.xp ?? 0) + 2;
        player.level = levelForExperience(player.xp);
        await incrementProfileStat(player, "itemsCrafted", recipe.resultCount, profiles, pool);
        writeJson(socket, { type: "xp", xp: player.xp, level: player.level });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        if (recipe.cooked) recordJobProgress(player, "cook", 1);
        if (recipe.smelted) recordJobProgress(player, "smelt", recipe.resultCount);
        return;
      }

      if (message.type === "door_toggle") {
        const room = rooms.get(player.roomId);
        const position = message.position;
        if (
          !room?.started ||
          player.health <= 0 ||
          !position ||
          !Number.isSafeInteger(position.x) ||
          !Number.isSafeInteger(position.y) ||
          !Number.isSafeInteger(position.z)
        ) return;
        const x = Math.round(wrapPlanetX(position.x));
        const z = Math.round(position.z);
        const baseY = doorBaseYAt(room, x, position.y, z);
        if (
          baseY === null ||
          Math.hypot(wrapPlanetX(x - player.x), z - player.z) > 4 ||
          Math.abs(baseY + 1 - player.y) > 3.5
        ) {
          writeJson(socket, { type: "door_result", open: false, message: "Move closer to a door to use it." });
          return;
        }
        const property = listCityProperties(room.seed).find((candidate) =>
          Math.round(wrapPlanetX(candidate.x)) === x && candidate.entranceZ + 1 === z,
        );
        if (property) {
          const owner = room.properties.get(property.id);
          const ownerId = player.profileId || player.name.toLowerCase();
          if (!owner) {
            writeJson(socket, {
              type: "door_result",
              open: false,
              message: `Locked: purchase ${property.name} to unlock this home.`,
            });
            return;
          }
          if (owner.ownerId !== ownerId) {
            writeJson(socket, {
              type: "door_result",
              open: false,
              message: `Locked: ${property.name} belongs to ${owner.ownerName}.`,
            });
            return;
          }
        }
        const key = blockKey(x, baseY, z);
        const isOpen = !room.openDoors.has(key);
        if (isOpen) room.openDoors.add(key);
        else room.openDoors.delete(key);
        writeJson(socket, {
          type: "door_result",
          open: isOpen,
          message: isOpen ? "Door opened." : "Door closed.",
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "edit") {
        const room = rooms.get(player.roomId);
        if (!room?.started) return;
        const { action, position, block } = message;
        if (!canEditBlock(position, block, action, room.blocks, room.seed)) {
          writeJson(socket, { type: "error", message: "That block cannot be changed." });
          return;
        }
        const key = blockKey(position.x, position.y, position.z);
        const rebuildTimer = room.blockRebuildTimers.get(key);
        if (rebuildTimer) clearTimeout(rebuildTimer);
        room.blockRebuildTimers.delete(key);
        room.blockRebuilds.delete(key);
        const currentBlock = room.blocks.has(key)
          ? room.blocks.get(key)
          : getBaseBlockAt(position.x, position.y, position.z, room.seed);
        const changedBlock = action === "remove" ? currentBlock : block;
        if (action === "remove") {
          room.blocks.set(key, null);
          addItems(player.inventory, changedBlock, 1);
        } else {
          if (room.mode !== "design" && !removeItems(player.inventory, block, 1)) {
            writeJson(socket, { type: "error", message: "You need that block in your inventory to place it." });
            return;
          }
          room.blocks.set(key, block);
        }
        room.blockChanges.set(key, action === "remove" ? null : block);
        await incrementProfileStat(player, action === "remove" ? "blocksMined" : "blocksPlaced", 1, profiles, pool);
        if (action === "remove") recordJobProgress(player, "mine", 1);
        broadcastToRoom(room, { type: "block", action, position, block: changedBlock });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
      }
    });

    socket.on("close", () => {
      const room = rooms.get(player.roomId);
      if (room) {
        releaseVehicle(room, player);
        room.savedPlayers.set(player.name.toLowerCase(), {
          name: player.name,
          x: player.x,
          y: player.y,
          z: player.z,
          yaw: player.yaw,
          health: player.health,
          inventory: inventoryItems(player.inventory),
          xp: player.xp ?? 0,
          level: player.level ?? 0,
          coins: player.coins ?? 0,
        });
        room.members.delete(player.id);
        if (room.hostId === player.id) room.hostId = room.members.values().next().value ?? null;
        if (room.members.size === 0 && !room.saved) {
          room.disconnectTimer = setTimeout(() => {
            if (rooms.get(room.id) === room && room.members.size === 0 && !room.saved) {
              rooms.delete(room.id);
              sendLobbyRooms();
            }
          }, ROOM_RECONNECT_GRACE_MS);
          room.disconnectTimer.unref?.();
        } else {
          sendRoomState(room);
          if (room.started) broadcastToRoom(room, roomSnapshot(room));
        }
      }
      players.delete(id);
      sendLobbyRooms();
      accessControl?.disconnected(`jesseCraft:${id}`);
    });
  });

  return {
    rooms,
    players,
    bots,
    listSavedWorlds() {
      return [...rooms.values()]
        .filter((room) => room.saved && !room.deleting)
        .map((room) => ({ id: room.id, name: room.name, mode: room.mode, players: room.members.size }));
    },
    async deleteSavedWorld(requestedRoomId) {
      const roomId = typeof requestedRoomId === "string" ? requestedRoomId.toUpperCase() : "";
      const room = rooms.get(roomId);
      if (!/^[A-Z0-9]{6}$/.test(roomId) || !room?.saved) {
        return { success: false, status: 404, message: "That saved world could not be found." };
      }
      if (room.deleting) {
        return { success: false, status: 409, message: "That saved world is already being deleted." };
      }

      room.deleting = true;
      try {
        await room.autosavePromise;
        if (rooms.get(room.id) !== room) {
          room.deleting = false;
          return {
            success: false,
            status: 409,
            message: "That world changed while deletion was starting. Refresh and try again."
          };
        }
        await removeSavedRoom(room, saveDirectory, pool);
        for (const memberId of room.members) {
          const member = players.get(memberId);
          if (!member) continue;
          releaseVehicle(room, member);
          member.roomId = null;
          writeJson(member.socket, { type: "room_left", message: `${room.name} was deleted by an admin.` });
        }
        room.members.clear();
        room.hostId = null;
        if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
        rooms.delete(room.id);
        sendLobbyRooms();
        return { success: true, message: `${room.name} was deleted.` };
      } catch (error) {
        room.deleting = false;
        console.error(`Failed to delete saved world ${room.id}:`, error);
        return {
          success: false,
          status: 503,
          message: "The saved world could not be deleted."
        };
      }
    },
    async listen() {
      if (pool && !databaseInitialized) {
        const savedRooms = await initializeDatabase(pool);
        for (const room of savedRooms) rooms.set(room.id, room);
        databaseInitialized = true;
      }
      for (const room of rooms.values()) {
        for (const [key, record] of room.blockRebuilds) scheduleBlockRebuild(room, key, record);
      }
      if (!ownsHttpServer) {
        if (!httpServer.listening) {
          throw new Error("The shared HTTP server must be listening before the game server starts.");
        }
        return httpServer.address();
      }
      return new Promise((resolveListen, rejectListen) => {
        httpServer.once("error", rejectListen);
        httpServer.listen(port, host, () => {
          httpServer.off("error", rejectListen);
          resolveListen(httpServer.address());
        });
      });
    },
    async close() {
      clearInterval(snapshotTimer);
      clearInterval(autosaveTimer);
      clearInterval(botTimer);
      clearInterval(monsterTimer);
      for (const room of rooms.values()) {
        for (const timer of room.blockRebuildTimers.values()) clearTimeout(timer);
        room.blockRebuildTimers.clear();
      }
      for (const socket of webSocketServer.clients) socket.terminate();
      if (ownsHttpServer) {
        await new Promise((resolveClose) => {
          webSocketServer.close(() => httpServer.close(() => resolveClose()));
        });
      } else {
        await new Promise((resolveClose) => webSocketServer.close(resolveClose));
      }
      await pool?.end();
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await import("dotenv/config");
  const gameServer = createGameServer({
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3001),
  });
  const address = await gameServer.listen();
  console.log(`Voxland server listening on ${JSON.stringify(address)}`);

  const shutdown = async () => {
    await gameServer.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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
  listCityProperties,
  PLANET_MAX_X,
  PLANET_MAX_Z,
  PLANET_LATITUDE_BLOCKS,
  PLANET_LONGITUDE_BLOCKS,
  PLANET_MIN_X,
  PLANET_MIN_Z,
  RECIPES,
  WORLD_LOCATIONS,
  isNearBoatWorkshop,
  isNearHarbor,
  rollFishReward,
  terrainHeightAt,
  wrapPlanetX,
} from "./world.js";
import { MODEL_CATALOG, MODEL_ITEM_BY_ID } from "../shared/models.js";
import { CREATURE_HABITATS, getCreatureSpecies } from "../shared/creatures.js";

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
const MONSTER_ATTACK_DAMAGE = 8;
const MONSTER_ATTACK_COOLDOWN_MS = 1400;
const MONSTER_RESPAWN_MS = 8000;
const MAX_PLAYER_MAGIC_POTION_STACK = 3;
const VEHICLE_SPAWNS = [
  { id: "starter-car", type: "car", x: -12, z: 0, color: "#d84f43", accent: "#f4d76a" },
  { id: "airport-plane", type: "plane", x: 70, z: -72 },
  { id: "airport-jet-1", type: "jet", x: 71, z: -81, color: "#dfe6e8", accent: "#45a3c6" },
  { id: "airport-jet-2", type: "jet", x: 71, z: -88, color: "#46505d", accent: "#e05d43" },
  { id: "airport-jet-3", type: "jet", x: 71, z: -95, color: "#d7d2c8", accent: "#738854" },
  { id: "airport-car", type: "car", x: 83, z: -62, color: "#4385c5", accent: "#dcecff" },
  { id: "city-tank-1", type: "tank", x: 0, z: 90, color: "#687a45", accent: "#d0b16c" },
  { id: "city-tank-2", type: "tank", x: 80, z: 0, color: "#52614c", accent: "#d7d2bc" },
  { id: "city-tank-3", type: "tank", x: -80, z: 0, color: "#53677a", accent: "#d9b468" },
  { id: "city-tank-4", type: "tank", x: 0, z: -80, color: "#786242", accent: "#c8d0d4" },
  { id: "city-tank-5", type: "tank", x: 0, z: 80, color: "#596b53", accent: "#b7c2a1" },
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
const BOAT_SIZES = new Map([
  ["skiff", { width: 1.8, length: 3.6, planks: 12 }],
  ["cutter", { width: 2.8, length: 5.4, planks: 24 }],
  ["galleon", { width: 3.8, length: 7.2, planks: 40 }],
]);
const BOAT_HULL_COLORS = new Set(["#765238", "#a16c42", "#4b6173", "#7c3f3f", "#4d6949"]);
const BOAT_SAIL_COLORS = new Set(["#eee2c6", "#b94a48", "#426c83", "#d4a84f", "#465348"]);

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
  for (let z = 164; z <= 184; z += 4) {
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

function createBots() {
  return new Map([
    ["bot-moss", { id: "bot-moss", name: "Moss", x: -4, z: -2, homeX: -4, homeZ: -2, yaw: 0, color: "#76b86d", targetX: -4, targetZ: -2, behavior: "idle", walking: false, nextDecisionAt: 0, stuckTicks: 0 }],
    ["bot-pebble", { id: "bot-pebble", name: "Pebble", x: 1, z: -5, homeX: 1, homeZ: -5, yaw: 0, color: "#d3a36e", targetX: 1, targetZ: -5, behavior: "idle", walking: false, nextDecisionAt: 0, stuckTicks: 0 }],
    ["bot-fern", { id: "bot-fern", name: "Fern", x: 8, z: 1, homeX: 8, homeZ: 1, yaw: 0, color: "#8f8ed3", targetX: 8, targetZ: 1, behavior: "idle", walking: false, nextDecisionAt: 0, stuckTicks: 0 }],
  ]);
}

function createVehicles(seed = 1) {
  const spawns = [...VEHICLE_SPAWNS];
  const cityRoadCandidates = [];
  for (let x = -100; x <= 100; x += 4) {
    for (let z = -100; z <= 100; z += 4) {
      const radius = Math.hypot(x, z);
      if (
        radius < 24 ||
        radius > 103 ||
        Math.hypot(x - 72, z + 72) < 32 ||
        getBaseBlockAt(x, 0, z, seed) === null ||
        getBaseBlockAt(x, 1, z, seed) !== null ||
        getBaseBlockAt(x, 2, z, seed) !== null
      ) continue;
      cityRoadCandidates.push({ x, z });
    }
  }
  let tankIndex = 0;
  for (const candidate of cityRoadCandidates) {
    if (tankIndex >= 4) break;
    if (spawns.some((spawn) => Math.hypot(spawn.x - candidate.x, spawn.z - candidate.z) < 12)) continue;
    const [color, accent] = [
      ["#53677a", "#d9b468"],
      ["#786242", "#c8d0d4"],
      ["#596b53", "#b7c2a1"],
      ["#73514e", "#d1a768"],
    ][tankIndex];
    spawns.push({
      id: `city-tank-${tankIndex + 6}`,
      type: "tank",
      ...candidate,
      color,
      accent,
    });
    tankIndex += 1;
  }
  for (let index = 0; index < Math.min(20, cityRoadCandidates.length); index += 1) {
    const candidate = cityRoadCandidates[Math.floor((index + 0.5) * cityRoadCandidates.length / 20)];
    if (!candidate) continue;
    const [color, accent] = CITY_CAR_PAINTS[index % CITY_CAR_PAINTS.length];
    spawns.push({ id: `city-car-${index + 1}`, type: "car", ...candidate, color, accent });
  }
  return new Map(spawns.map(({ id, type, x, z, color, accent }) => [
    id,
    {
      id,
      type,
      ...(color ? { color, accent } : {}),
      x,
      y: terrainHeightAt(x, z, seed),
      z,
      yaw: 0,
      turretYaw: 0,
      occupantId: null,
    },
  ]));
}

function restoreVehicles(savedVehicles, seed) {
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
    vehicles.set(savedVehicle.id, {
      ...existing,
      ...savedVehicle,
      y: Number.isFinite(savedVehicle.y) ? savedVehicle.y : existing.y,
      turretYaw: Number.isFinite(savedVehicle.turretYaw)
        ? Math.atan2(Math.sin(savedVehicle.turretYaw), Math.cos(savedVehicle.turretYaw))
        : Number.isFinite(savedVehicle.yaw) ? savedVehicle.yaw : existing.turretYaw,
      occupantId: null,
    });
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
      animals.set(id, {
        id,
        species: species.id,
        name: species.name,
        model: species.model,
        color: species.color,
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

function serializeAnimals(room) {
  return [...room.animals.values()].map(({ id, species, name, model, color, habitat, aquatic, flying, scale, pattern, x, y, z, yaw, walking }) => ({
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
  }));
}

function createMonsters() {
  return new Map([
    ["monster-crab", {
      id: "monster-crab", name: "Dune Crab", species: "crab", x: 0, z: 126, yaw: 0, color: "#e58154",
      homeX: 0, homeZ: 126, targetX: 0, targetZ: 126, health: 60, maxHealth: 60, lastAttackAt: 0, respawnAt: 0, boss: false, active: true,
    }],
    ["monster-slime", {
      id: "monster-slime", name: "Moss Slime", species: "slime", x: 4, z: 210, yaw: 0, color: "#79c66f",
      homeX: 4, homeZ: 210, targetX: 4, targetZ: 210, health: 60, maxHealth: 60, lastAttackAt: 0, respawnAt: 0, boss: false, active: true,
    }],
    ["monster-wisp", {
      id: "monster-wisp", name: "Highland Wisp", species: "wisp", x: 44, z: 284, yaw: 0, color: "#76cbd1",
      homeX: 44, homeZ: 284, targetX: 44, targetZ: 284, health: 60, maxHealth: 60, lastAttackAt: 0, respawnAt: 0, boss: false, active: true,
    }],
    ["monster-skeleton", {
      id: "monster-skeleton", name: "Crypt Skeleton", species: "skeleton", x: -150, z: 112, yaw: 0, color: "#d0dae8",
      homeX: -150, homeZ: 112, targetX: -150, targetZ: 112, health: 90, maxHealth: 90, lastAttackAt: 0, respawnAt: 0, boss: false, active: false,
    }],
    ["monster-warden", {
      id: "monster-warden", name: "Mine Warden", species: "warden", x: -120, z: -171, yaw: 0, color: "#a9e0b3",
      homeX: -120, homeZ: -171, targetX: -120, targetZ: -171, health: 120, maxHealth: 120, lastAttackAt: 0, respawnAt: 0, boss: false, active: false,
    }],
    ["boss-ashen-king", {
      id: "boss-ashen-king", name: "Ashen King", species: "boss", x: 160, z: -120, yaw: 0, color: "#ffb166",
      homeX: 160, homeZ: -120, targetX: 160, targetZ: -120, health: 220, maxHealth: 220, lastAttackAt: 0, respawnAt: 0, boss: true, active: false,
    }],
    ["monster-spider", {
      id: "monster-spider", name: "Thicket Spider", species: "spider", x: 12, z: 222, yaw: 0, color: "#a56e52",
      homeX: 12, homeZ: 222, targetX: 12, targetZ: 222, health: 75, maxHealth: 75, lastAttackAt: 0, respawnAt: 0, boss: false, active: false,
    }],
    ["monster-golem", {
      id: "monster-golem", name: "Ashvault Golem", species: "golem", x: 523, z: 35, yaw: 0, color: "#92776b",
      homeX: 523, homeZ: 35, targetX: 523, targetZ: 35, health: 160, maxHealth: 160, lastAttackAt: 0, respawnAt: 0, boss: false, active: false,
    }],
    ["monster-phantom", {
      id: "monster-phantom", name: "Dragonpeak Phantom", species: "phantom", x: -180, z: 250, yaw: 0, color: "#8872d6",
      homeX: -180, homeZ: 250, targetX: -180, targetZ: 250, health: 110, maxHealth: 110, lastAttackAt: 0, respawnAt: 0, boss: false, active: false,
    }],
  ]);
}

function serializeMonsters(room) {
  return [...room.monsters.values()]
    .filter((monster) => monster.health > 0 && monster.active !== false)
    .map(({ id, name, species, x, z, yaw, color, health, maxHealth, boss }) => ({
      id,
      name,
      species,
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
    : new Map();
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

function entityCanOccupy(room, x, z, feetY, radius = 0.3) {
  for (const offsetX of [-radius, 0, radius]) {
    for (const offsetZ of [-radius, 0, radius]) {
      const blockX = Math.round(x + offsetX);
      const blockZ = Math.round(z + offsetZ);
      for (const blockY of [feetY, feetY + 1]) {
        const key = blockKey(blockX, blockY, blockZ);
        const type = room.blocks.has(key)
          ? room.blocks.get(key)
          : getBaseBlockAt(blockX, blockY, blockZ, room.seed);
        if (type && type !== "water" && type !== "oak_door") return false;
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

function findNearbyPlayer(room, players, bot, range) {
  let nearest = null;
  let nearestDistance = range;
  for (const id of room.members) {
    const candidate = players.get(id);
    if (!candidate || candidate.health <= 0) continue;
    const distance = Math.hypot(candidate.x - bot.x, candidate.z - bot.z);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest ? { player: nearest, distance: nearestDistance } : null;
}

function chooseBotStep(room, bot, step) {
  const targetX = bot.targetX - bot.x;
  const targetZ = bot.targetZ - bot.z;
  const distance = Math.hypot(targetX, targetZ);
  if (distance < 0.001) return null;
  const desiredAngle = Math.atan2(targetZ, targetX);
  const direction = Math.sign((bot.id.charCodeAt(bot.id.length - 1) || 0) % 2 ? 1 : -1);
  const offsets = [0, direction * Math.PI / 6, -direction * Math.PI / 6, direction * Math.PI / 3, -direction * Math.PI / 3, direction * Math.PI / 2, -direction * Math.PI / 2, Math.PI];
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
  player.vehicleId = null;
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
    droppedItems: new Map(Array.isArray(saved.droppedItems) ? saved.droppedItems : []),
    vehicles: restoreVehicles(
      saved.vehicles,
      Number.isSafeInteger(saved.seed) ? saved.seed : 1,
    ),
    properties: new Map(
      Array.isArray(saved.properties)
        ? saved.properties.filter(([id, property]) => typeof id === "string" && property && typeof property.ownerId === "string")
        : [],
    ),
    savedPlayers,
    bots: createBots(),
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
  seed: requestedSeed,
  saveDirectory = DEFAULT_SAVE_DIRECTORY,
  databaseUrl = process.env.DATABASE_URL,
  autosaveIntervalMs = AUTO_SAVE_INTERVAL_MS,
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
  const bots = createBots();
  const httpServer = createServer(staticResponse);
  const webSocketServer = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    maxPayload: 4096,
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
    .filter((room) => room.members.size < 8)
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
    players: [...room.members].map((id) => players.get(id)).filter(Boolean).map(({ id, name, x, y, z, yaw, color, health, vehicleId }) => ({
      id,
      name,
      x,
      y,
      z,
      yaw,
      color,
      health,
      vehicleId: vehicleId ?? null,
    })),
    bots: [...room.bots.values()],
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
    properties: [...(room.properties ?? new Map()).entries()].map(([id, property]) => ({ id, ...property })),
  });

  const broadcastToRoom = (room, message) => {
    const encoded = JSON.stringify(message);
    for (const id of room.members) {
      const member = players.get(id);
      if (member?.socket.readyState === WebSocket.OPEN) member.socket.send(encoded);
    }
  };

  const sendInitial = (player, room) => writeJson(player.socket, {
    type: "init",
    id: player.id,
    seed: room.seed,
    mode: room.mode,
    autosaveEnabled: room.autosaveEnabled !== false,
    chunkSize: CHUNK_SIZE,
    players: [...room.members].map((id) => players.get(id)).filter(Boolean).map(({ id, name, x, y, z, yaw, color, health, vehicleId }) => ({
      id,
      name,
      x,
      y,
      z,
      yaw,
      color,
      health,
      vehicleId: vehicleId ?? null,
    })),
    bots: [...room.bots.values()],
    animals: serializeAnimals(room),
    monsters: serializeMonsters(room),
    drops: [...room.droppedItems.values()].map(({ id, item, count, x, z }) => ({ id, item, count, x, z })),
    vehicles: [...room.vehicles.values()],
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
      if (!room.started || !room.autosaveEnabled || room.autosaveInProgress || now - room.lastAutosaveAt < autosaveIntervalMs) continue;
      room.lastAutosaveAt = now;
      room.autosaveInProgress = true;
      const save = pool
        ? persistRoomToDatabase(room, players, pool)
        : Promise.resolve().then(() => persistRoom(room, players, saveDirectory));
      save.catch(() => {
        room.lastAutosaveAt = Date.now() - autosaveIntervalMs;
      }).finally(() => {
        room.autosaveInProgress = false;
      });
    }
  }, autosaveIntervalMs);
  const botTimer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (!room.started) continue;
      for (const bot of room.bots.values()) {
        if (now >= bot.nextDecisionAt) {
          const nearby = findNearbyPlayer(room, players, bot, 10);
          if (nearby) {
            bot.targetX = nearby.distance > 2.2 ? nearby.player.x : bot.x;
            bot.targetZ = nearby.distance > 2.2 ? nearby.player.z : bot.z;
            bot.behavior = "follow";
          } else if (bot.behavior === "follow" || bot.behavior === "idle"
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
        const nearby = bot.behavior === "follow" ? findNearbyPlayer(room, players, bot, 10) : null;
        const stopDistance = nearby ? 2.2 : 0.45;
        if (distance <= stopDistance) {
          bot.walking = false;
          bot.stuckTicks = 0;
          continue;
        }

        const step = Math.min(0.32, distance - stopDistance);
        const movement = chooseBotStep(room, bot, step);
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
      for (const animal of room.animals.values()) {
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
          const latitude = (monster.z - PLANET_MIN_Z + 0.5) / PLANET_LATITUDE_BLOCKS * Math.PI - Math.PI / 2;
          const east = wrapPlanetX(candidate.x - monster.x) * Math.cos(latitude);
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
          if (now - monster.lastAttackAt >= MONSTER_ATTACK_COOLDOWN_MS) {
            closestPlayer.health = Math.max(0, closestPlayer.health - MONSTER_ATTACK_DAMAGE);
            monster.lastAttackAt = now;
            changed = true;
          }
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

  webSocketServer.on("connection", (socket) => {
    const id = randomUUID();
    const colors = ["#e58b64", "#70a8d2", "#d4bd68", "#c27db7"];
    const player = {
      id,
      name: `Guest-${id.slice(0, 4)}`,
      x: 0,
      y: terrainHeightAt(0, 0, seed) + 2.65,
      z: 0,
      yaw: 0,
      health: MAX_PLAYER_HEALTH,
      xp: 0,
      level: 0,
      coins: STARTING_COINS,
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
          mode: message.mode === "design" ? "design" : "survival",
          seed,
          started: false,
          blocks: new Map(),
          blockChanges: new Map(),
          droppedItems: new Map(),
          vehicles: createVehicles(seed),
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
        if (!room || room.members.size >= 8) {
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
          player.level = Number.isFinite(Number(savedPlayer.level)) ? Number(savedPlayer.level) : 0;
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
          ? WORLD_LOCATIONS.find((candidate) => candidate.id === message.locationId)
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
        releaseVehicle(room, player);
        player.x = property.entranceX;
        player.z = property.entranceZ;
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

      if (message.type === "attack" || message.type === "tank_fire") {
        const room = rooms.get(player.roomId);
        const isTankAttack = message.type === "tank_fire";
        const vehicle = room?.vehicles.get(player.vehicleId);
        const playerTarget = room?.started && room.members.has(message.targetId)
          ? players.get(message.targetId)
          : null;
        const monsterTarget = room?.started ? room.monsters.get(message.targetId) : null;
        const target = playerTarget ?? monsterTarget;
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
        if (
          !room?.started ||
          player.health <= 0 ||
          now - player.lastAttackAt < (isTankAttack ? TANK_ATTACK_COOLDOWN_MS : PLAYER_ATTACK_COOLDOWN_MS)
        ) {
          writeJson(socket, { type: "attack_result", hit: false, tank: isTankAttack });
          return;
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
        if (!target || target.id === player.id || target.health <= 0) {
          writeJson(socket, { type: "attack_result", hit: false, tank: isTankAttack });
          return;
        }

        const weapon = !isTankAttack && typeof message.weapon === "string" ? message.weapon : null;
        if (weapon && (!PLAYER_WEAPON_DAMAGE.has(weapon) || (player.inventory.get(weapon) ?? 0) < 1)) {
          writeJson(socket, { type: "attack_result", hit: false, message: "You do not have that weapon equipped." });
          return;
        }

        const latitude = (player.z - PLANET_MIN_Z + 0.5) / PLANET_LATITUDE_BLOCKS * Math.PI - Math.PI / 2;
        const east = wrapPlanetX(target.x - player.x) * Math.cos(latitude);
        const north = target.z - player.z;
        const distance = Math.hypot(east, north);
        const aimYaw = isTankAttack
          ? vehicle.turretYaw ?? vehicle.yaw
          : player.yaw;
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
        let reward = null;
        if (monsterTarget && target.health === 0) {
          target.respawnAt = now + MONSTER_RESPAWN_MS;
          await incrementProfileStat(player, "creaturesDefeated", 1, profiles, pool);
          player.xp = (player.xp ?? 0) + MONSTER_KILL_XP;
          player.level = Math.max(player.level ?? 0, Math.floor(player.xp / XP_PER_LEVEL));
          player.coins = (player.coins ?? 0) + MONSTER_KILL_COINS;
          reward = { xp: player.xp, level: player.level, coins: player.coins, xpGained: MONSTER_KILL_XP, coinsGained: MONSTER_KILL_COINS };
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
        writeJson(socket, {
          type: "sell_result",
          item,
          count,
          value: payout,
          coins: player.coins,
          message: `Sold ${count} ${fish.label} for ${payout} coins.`,
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
        if (!validPlayerPosition(message.position)) {
          writeJson(socket, { type: "error", message: "Movement was outside the world." });
          return;
        }
        const room = rooms.get(player.roomId);
        const vehicle = room?.vehicles.get(player.vehicleId);
        if (player.vehicleId && vehicle?.occupantId !== player.id) return;
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
        if (
          !room ||
          !playerCanOccupy(
            room,
            message.position.x,
            message.position.y ?? player.y,
            message.position.z,
          )
        ) {
          writeJson(socket, {
            type: "move_rejected",
            position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
          });
          return;
        }
        player.x = message.position.x;
        player.z = message.position.z;
        player.y = Number.isFinite(message.position.y)
          ? message.position.y
          : terrainHeightAt(player.x, player.z, room.seed) + 2.65;
        if (vehicle?.type === "boat") player.y = vehicle.y + 2.65;
        player.yaw = message.position.yaw;
        if (vehicle) {
          const previousVehicleYaw = vehicle.yaw;
          vehicle.x = player.x;
          vehicle.y = player.y - 2.65;
          vehicle.z = player.z;
          vehicle.yaw = player.yaw;
          if (vehicle.type === "tank" && Number.isFinite(message.position.turretYaw)) {
            vehicle.turretYaw = Math.atan2(
              Math.sin(message.position.turretYaw),
              Math.cos(message.position.turretYaw),
            );
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

      if (message.type === "vehicle_enter" || message.type === "vehicle_exit") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0) return;
        if (message.type === "vehicle_exit") {
          releaseVehicle(room, player);
          writeJson(socket, { type: "vehicle_result", vehicleId: null, message: "You left the vehicle." });
          broadcastToRoom(room, roomSnapshot(room));
          return;
        }
        const vehicle = room.vehicles.get(message.vehicleId);
        if (
          !vehicle ||
          (vehicle.occupantId && vehicle.occupantId !== player.id) ||
          Math.hypot(wrapPlanetX(vehicle.x - player.x), vehicle.z - player.z) > 4
        ) {
          writeJson(socket, { type: "vehicle_result", vehicleId: null, message: "Move closer to an available vehicle." });
          return;
        }
        releaseVehicle(room, player);
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
        writeJson(socket, {
          type: "vehicle_result",
          vehicleId: vehicle.id,
          vehicleType: vehicle.type,
          message: `Entered ${vehicle.type}. Press E to exit.`,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "fly_toggle") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health <= 0 || typeof message.enabled !== "boolean") {
          writeJson(socket, { type: "fly_result", enabled: false, message: "Flight is unavailable right now." });
          return;
        }
        player.flightEnabled = message.enabled;
        writeJson(socket, {
          type: "fly_result",
          enabled: player.flightEnabled,
          message: player.flightEnabled ? "Flight enabled." : "Flight disabled.",
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
        for (const [item, amount] of Object.entries(recipe.ingredients)) {
          removeItems(player.inventory, item, amount);
        }
        addItems(player.inventory, recipe.result, recipe.resultCount);
        player.xp = (player.xp ?? 0) + 2;
        player.level = (player.level ?? 0) + 2;
        await incrementProfileStat(player, "itemsCrafted", recipe.resultCount, profiles, pool);
        writeJson(socket, { type: "xp", xp: player.xp, level: player.level });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
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
    });
  });

  return {
    rooms,
    players,
    bots,
    async listen() {
      if (pool && !databaseInitialized) {
        const savedRooms = await initializeDatabase(pool);
        for (const room of savedRooms) rooms.set(room.id, room);
        databaseInitialized = true;
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
      for (const socket of webSocketServer.clients) socket.terminate();
      await new Promise((resolveClose) => {
        webSocketServer.close(() => httpServer.close(() => resolveClose()));
      });
      await pool?.end();
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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

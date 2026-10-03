import { MODEL_ITEM_BY_ID } from "./models.js";

export const BLOCK_TYPES = new Set([
  "grass",
  "dirt",
  "stone",
  "oak_planks",
  "oak_door",
  "oak_log",
  "glass",
  "leaves",
  "sand",
  "campfire",
  "brick",
  "obsidian",
  "snow",
  "ice",
  "black_concrete",
  "white_concrete",
  "blue_concrete",
  "red_concrete",
  "crafting_table",
  "water",
  "fishing_rod",
  "raw_fish",
  "sunfish",
  "gold_fish",
  "salmon",
  "copper_ore",
  "copper_ingot",
  "iron_ore",
  "iron_ingot",
  "paper",
  "silver_ore",
  "silver_ingot",
  "steel_ingot",
  "coal",
  "ruby",
  "emerald",
  "torch",
  "lantern",
  "wooden_sword",
  "stone_sword",
  "stone_pickaxe",
  "iron_pickaxe",
  "iron_axe",
  "iron_sword",
  "steel_pickaxe",
  "steel_axe",
  "steel_sword",
  "shield",
  "bucket",
  "compass",
  "spyglass",
  "map",
  "health_potion",
  "strength_potion",
  "iron_armor",
  "steel_armor",
  "guardian_helm",
  "boss_key",
]);

export const CHUNK_SIZE = 16;
export const BEDROCK_Y = -32;
export const MIN_BUILD_Y = BEDROCK_Y + 1;
export const MAX_BUILD_HEIGHT = 128;
export const PLANET_RADIUS = 256;
export const PLANET_LONGITUDE_BLOCKS = 1600;
export const PLANET_LATITUDE_BLOCKS = 800;
export const CITY_RADIUS = 108;
export const CITY_BEACH_OUTER_RADIUS = 140;
export const HARBOR_WATER_OUTER_RADIUS = 190;
export const HARBOR_BUILD_RADIUS = 170;
export const FOREST_OUTER_RADIUS = 228;
export const CITY_BLOCK_SIZE = 32;
export const MAX_CITY_BUILDING_HEIGHT = 40;
export const WORLD_LOCATIONS = [
  { id: "village", name: "Starter Village", x: 0, z: 0, yaw: 0, type: "village" },
  { id: "north-village", name: "Northwatch Village", x: -72, z: -46, yaw: 0, type: "village" },
  { id: "east-village", name: "Amber Fields", x: 104, z: 22, yaw: 0, type: "village" },
  { id: "city", name: "Glass City", x: 48, z: 0, yaw: Math.PI, type: "city" },
  { id: "airport", name: "Glass City Airport", x: 72, z: -72, yaw: Math.PI, type: "airport" },
  { id: "beach", name: "Sandy Beach", x: 0, z: 124, yaw: 0, type: "beach" },
  { id: "harbor", name: "Harbor Pier", x: 0, z: 140, yaw: 0, type: "harbor" },
  { id: "forest", name: "Pine Forest", x: 0, z: 210, yaw: 0, type: "forest" },
  { id: "highlands", name: "Highlands", x: 40, z: 284, yaw: 0, type: "highlands" },
  { id: "mine", name: "Copper Mine", x: -120, z: -170, yaw: 0, type: "mine" },
  { id: "dungeon", name: "Moonstone Dungeon", x: -150, z: 110, yaw: 0, type: "dungeon" },
  { id: "castle", name: "Sunspire Castle", x: 160, z: -120, yaw: 0, type: "castle" },
  { id: "ruins", name: "Ancient Ruins", x: 128, z: 184, yaw: 0, type: "ruins" },
  { id: "dragon-peak", name: "Dragon Peak", x: -180, z: 250, yaw: 0, type: "boss" },
];

export const VILLAGE_TRAVEL_NETWORK = [
  { from: "village", to: "north-village", route: "North Road", distance: "short" },
  { from: "village", to: "city", route: "Market Lane", distance: "short" },
  { from: "city", to: "east-village", route: "East Road", distance: "moderate" },
  { from: "city", to: "harbor", route: "Harbor Walk", distance: "moderate" },
  { from: "harbor", to: "forest", route: "Forest Trail", distance: "moderate" },
  { from: "forest", to: "highlands", route: "Highland Pass", distance: "long" },
  { from: "village", to: "mine", route: "Mine Way", distance: "long" },
  { from: "north-village", to: "dungeon", route: "Watch Path", distance: "moderate" },
  { from: "east-village", to: "castle", route: "Castle Road", distance: "long" },
  { from: "forest", to: "ruins", route: "Moon Trail", distance: "long" },
  { from: "highlands", to: "dragon-peak", route: "Dragon Spur", distance: "long" },
];

export function findTravelRoute(fromId, toId) {
  if (!fromId || !toId) return null;
  const start = String(fromId);
  const target = String(toId);
  if (start === target) return { from: start, to: target, path: [start], legs: [], route: "Here" };

  const adjacency = new Map();
  for (const leg of VILLAGE_TRAVEL_NETWORK) {
    const from = String(leg.from);
    const to = String(leg.to);
    if (!adjacency.has(from)) adjacency.set(from, []);
    if (!adjacency.has(to)) adjacency.set(to, []);
    adjacency.get(from).push({ ...leg, from, to });
    adjacency.get(to).push({ ...leg, from: to, to: from });
  }

  const queue = [start];
  const previous = new Map([[start, null]]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === target) break;
    for (const leg of adjacency.get(current) ?? []) {
      if (previous.has(leg.to)) continue;
      previous.set(leg.to, current);
      queue.push(leg.to);
    }
  }

  if (!previous.has(target)) return null;
  const path = [];
  const legs = [];
  let cursor = target;
  while (cursor) {
    path.unshift(cursor);
    const prev = previous.get(cursor);
    if (prev) {
      const connection = (adjacency.get(prev) ?? []).find((leg) => leg.to === cursor);
      if (connection) legs.unshift(connection);
      cursor = prev;
    } else {
      cursor = null;
    }
  }

  return {
    from: start,
    to: target,
    path,
    legs,
    route: legs.map((leg) => leg.route).join(" → ") || "Direct travel",
  };
}
export const HARBOR_SEABED_Y = -4;
export const HARBOR_DOCK_MIN_Z = 120;
export const HARBOR_DOCK_MAX_Z = 164;
export const PLANET_MIN_X = -PLANET_LONGITUDE_BLOCKS / 2;
export const PLANET_MAX_X = PLANET_MIN_X + PLANET_LONGITUDE_BLOCKS - 1;
export const PLANET_MIN_Z = -PLANET_LATITUDE_BLOCKS / 2;
export const PLANET_MAX_Z = PLANET_MIN_Z + PLANET_LATITUDE_BLOCKS - 1;
export const MIN_PLANET_CHUNK_X = Math.floor(PLANET_MIN_X / CHUNK_SIZE);
export const MAX_PLANET_CHUNK_X = Math.floor(PLANET_MAX_X / CHUNK_SIZE);
export const MIN_PLANET_CHUNK_Z = Math.floor(PLANET_MIN_Z / CHUNK_SIZE);
export const MAX_PLANET_CHUNK_Z = Math.floor(PLANET_MAX_Z / CHUNK_SIZE);
export const MAX_WORLD_COORDINATE = Math.max(Math.abs(PLANET_MIN_X), Math.abs(PLANET_MIN_Z));
export const MAX_CHUNK_COORDINATE = Math.max(
  Math.abs(MIN_PLANET_CHUNK_X),
  Math.abs(MAX_PLANET_CHUNK_X),
  Math.abs(MIN_PLANET_CHUNK_Z),
  Math.abs(MAX_PLANET_CHUNK_Z),
);
export const MAX_STACK_SIZE = 64;
export const FISH_TYPES = [
  { id: "raw_fish", label: "Bluegill", rarity: "common", value: 3, weight: 60 },
  { id: "sunfish", label: "Sunfish", rarity: "uncommon", value: 8, weight: 28 },
  { id: "gold_fish", label: "Goldfish", rarity: "rare", value: 18, weight: 9 },
  { id: "salmon", label: "Salmon", rarity: "epic", value: 32, weight: 3 },
];
export const FISH_TYPE_BY_ID = new Map(FISH_TYPES.map((fish) => [fish.id, fish]));
export const FISH_ITEMS = FISH_TYPES.map((fish) => fish.id);
export function rollFishReward() {
  const totalWeight = FISH_TYPES.reduce((sum, fish) => sum + fish.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const fish of FISH_TYPES) {
    roll -= fish.weight;
    if (roll < 0) return fish;
  }
  return FISH_TYPES[0];
}
export const RECIPES = [
  {
    id: "planks",
    label: "Wooden planks ×4",
    ingredients: { oak_log: 1 },
    result: "oak_planks",
    resultCount: 4,
  },
  {
    id: "glass",
    label: "Glass block ×1",
    ingredients: { sand: 2, stone: 1 },
    result: "glass",
    resultCount: 1,
  },
  {
    id: "campfire",
    label: "Campfire ×1",
    ingredients: { oak_log: 2, stone: 3 },
    result: "campfire",
    resultCount: 1,
  },
  {
    id: "crafting_table",
    label: "Crafting table ×1",
    ingredients: { oak_planks: 4 },
    result: "crafting_table",
    resultCount: 1,
  },
  {
    id: "fishing_rod",
    label: "Fishing rod ×1",
    ingredients: { oak_planks: 2, oak_log: 1 },
    result: "fishing_rod",
    resultCount: 1,
  },
  {
    id: "wooden_sword",
    label: "Wooden sword ×1",
    ingredients: { oak_planks: 2, oak_log: 1 },
    result: "wooden_sword",
    resultCount: 1,
  },
  {
    id: "stone_sword",
    label: "Stone sword ×1",
    ingredients: { oak_planks: 1, stone: 2 },
    result: "stone_sword",
    resultCount: 1,
  },
  {
    id: "stone_pickaxe",
    label: "Stone pickaxe ×1",
    ingredients: { stone: 3, oak_planks: 2 },
    result: "stone_pickaxe",
    resultCount: 1,
  },
  {
    id: "iron_ingot",
    label: "Iron ingot ×1",
    ingredients: { iron_ore: 2, campfire: 1 },
    result: "iron_ingot",
    resultCount: 1,
  },
  {
    id: "steel_ingot",
    label: "Steel ingot ×1",
    ingredients: { iron_ingot: 2, coal: 1 },
    result: "steel_ingot",
    resultCount: 1,
  },
  {
    id: "health_potion",
    label: "Health potion ×1",
    ingredients: { glass: 1, ruby: 1, water: 1 },
    result: "health_potion",
    resultCount: 1,
  },
  {
    id: "strength_potion",
    label: "Strength potion ×1",
    ingredients: { glass: 1, emerald: 1, coal: 1 },
    result: "strength_potion",
    resultCount: 1,
  },
  {
    id: "iron_armor",
    label: "Iron armor ×1",
    ingredients: { iron_ingot: 4, oak_planks: 1 },
    result: "iron_armor",
    resultCount: 1,
  },
  {
    id: "steel_armor",
    label: "Steel armor ×1",
    ingredients: { steel_ingot: 3, ruby: 1 },
    result: "steel_armor",
    resultCount: 1,
  },
  {
    id: "guardian_helm",
    label: "Guardian helm ×1",
    ingredients: { iron_ingot: 2, emerald: 1, glass: 1 },
    result: "guardian_helm",
    resultCount: 1,
  },
  {
    id: "boss_key",
    label: "Boss key ×1",
    ingredients: { ruby: 2, steel_ingot: 1 },
    result: "boss_key",
    resultCount: 1,
  },
  {
    id: "iron_pickaxe",
    label: "Iron pickaxe ×1",
    ingredients: { iron_ingot: 3, oak_planks: 2 },
    result: "iron_pickaxe",
    resultCount: 1,
  },
  {
    id: "iron_axe",
    label: "Iron axe ×1",
    ingredients: { iron_ingot: 3, oak_planks: 1 },
    result: "iron_axe",
    resultCount: 1,
  },
  {
    id: "iron_sword",
    label: "Iron sword ×1",
    ingredients: { iron_ingot: 2, oak_planks: 1 },
    result: "iron_sword",
    resultCount: 1,
  },
  {
    id: "steel_pickaxe",
    label: "Steel pickaxe ×1",
    ingredients: { steel_ingot: 3, oak_planks: 2 },
    result: "steel_pickaxe",
    resultCount: 1,
  },
  {
    id: "steel_axe",
    label: "Steel axe ×1",
    ingredients: { steel_ingot: 3, oak_planks: 1 },
    result: "steel_axe",
    resultCount: 1,
  },
  {
    id: "steel_sword",
    label: "Steel sword ×1",
    ingredients: { steel_ingot: 2, oak_planks: 1 },
    result: "steel_sword",
    resultCount: 1,
  },
  {
    id: "torch",
    label: "Torch ×4",
    ingredients: { coal: 1, oak_log: 1 },
    result: "torch",
    resultCount: 4,
  },
  {
    id: "lantern",
    label: "Lantern ×1",
    ingredients: { iron_ingot: 2, glass: 1, torch: 1 },
    result: "lantern",
    resultCount: 1,
  },
  {
    id: "shield",
    label: "Shield ×1",
    ingredients: { steel_ingot: 2, oak_planks: 2 },
    result: "shield",
    resultCount: 1,
  },
  {
    id: "compass",
    label: "Compass ×1",
    ingredients: { iron_ingot: 2, red_concrete: 1 },
    result: "compass",
    resultCount: 1,
  },
  {
    id: "spyglass",
    label: "Spyglass ×1",
    ingredients: { glass: 2, iron_ingot: 1, oak_planks: 1 },
    result: "spyglass",
    resultCount: 1,
  },
  {
    id: "map",
    label: "Map ×1",
    ingredients: { paper: 2, red_concrete: 1 },
    result: "map",
    resultCount: 1,
  },
  {
    id: "copper_ingot",
    label: "Copper ingot ×1",
    ingredients: { copper_ore: 2, campfire: 1 },
    result: "copper_ingot",
    resultCount: 1,
  },
];

export function blockKey(x, y, z) {
  return `${wrapPlanetX(x)},${y},${z}`;
}

export function wrapPlanetX(x) {
  return ((x - PLANET_MIN_X) % PLANET_LONGITUDE_BLOCKS + PLANET_LONGITUDE_BLOCKS)
    % PLANET_LONGITUDE_BLOCKS + PLANET_MIN_X;
}

export function planetPointAt(x, height, z) {
  const { longitude, latitude } = planetFrameAt(x, z);
  const radius = PLANET_RADIUS + height;
  const latitudeScale = Math.cos(latitude);
  return {
    x: radius * latitudeScale * Math.sin(longitude),
    y: radius * Math.sin(latitude),
    z: radius * latitudeScale * Math.cos(longitude),
  };
}

export function planetFrameAt(x, z) {
  const longitude = (wrapPlanetX(x) - PLANET_MIN_X + 0.5) / PLANET_LONGITUDE_BLOCKS * Math.PI * 2 - Math.PI;
  const latitude = (z - PLANET_MIN_Z + 0.5) / PLANET_LATITUDE_BLOCKS * Math.PI - Math.PI / 2;
  const sinLongitude = Math.sin(longitude);
  const cosLongitude = Math.cos(longitude);
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  return {
    longitude,
    latitude,
    up: { x: cosLatitude * sinLongitude, y: sinLatitude, z: cosLatitude * cosLongitude },
    east: { x: cosLongitude, y: 0, z: -sinLongitude },
    north: { x: -sinLatitude * sinLongitude, y: cosLatitude, z: -sinLatitude * cosLongitude },
  };
}

export function advancePlanetPosition(x, z, eastDistance, northDistance, yaw = 0) {
  const { latitude } = planetFrameAt(x, z);
  const longitudeScale = Math.max(0.1, Math.cos(latitude));
  let nextX = x + eastDistance * PLANET_LONGITUDE_BLOCKS / (Math.PI * 2 * PLANET_RADIUS * longitudeScale);
  let nextZ = z + northDistance * PLANET_LATITUDE_BLOCKS / (Math.PI * PLANET_RADIUS);
  let poleCrossings = 0;
  const northPole = PLANET_MAX_Z + 0.5;
  const southPole = PLANET_MIN_Z - 0.5;
  while (nextZ > northPole || nextZ < southPole) {
    if (nextZ > northPole) nextZ = 2 * northPole - nextZ;
    else nextZ = 2 * southPole - nextZ;
    poleCrossings += 1;
  }
  return {
    x: wrapPlanetX(nextX + poleCrossings * PLANET_LONGITUDE_BLOCKS / 2),
    z: nextZ,
    yaw: yaw + poleCrossings * Math.PI,
  };
}

export function isNearHarbor(x, z) {
  return Math.abs(wrapPlanetX(x)) <= 22 && z >= 132 && z <= HARBOR_DOCK_MAX_Z;
}

function normalizeSeed(seed) {
  return Number(seed) >>> 0;
}

function smoothStep(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function hashNoise(x, z, seed) {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 0.017 + 74.7) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}

function noise2d(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const top = hashNoise(x0, z0, seed) * (1 - sx) + hashNoise(x0 + 1, z0, seed) * sx;
  const bottom =
    hashNoise(x0, z0 + 1, seed) * (1 - sx) + hashNoise(x0 + 1, z0 + 1, seed) * sx;
  return top * (1 - sz) + bottom * sz;
}

export function harborSeabedAt(x, z, seed = 1) {
  const radius = Math.hypot(wrapPlanetX(x), z);
  const radialDepth = 3 + Math.round(smoothStep(CITY_BEACH_OUTER_RADIUS, HARBOR_WATER_OUTER_RADIUS, radius) * 3);
  const channel = Math.round(noise2d(x * 0.055, z * 0.055, normalizeSeed(seed)) * 1.5);
  return -Math.max(2, Math.min(8, radialDepth + channel));
}

function structureBlockAt(x, y, z, seed = 1) {
  const worldSeed = normalizeSeed(seed);
  const mine = WORLD_LOCATIONS.find((entry) => entry.id === "mine");
  const dungeon = WORLD_LOCATIONS.find((entry) => entry.id === "dungeon");
  const castle = WORLD_LOCATIONS.find((entry) => entry.id === "castle");
  const airport = WORLD_LOCATIONS.find((entry) => entry.id === "airport");

  if (airport) {
    const airportX = x - airport.x;
    const airportZ = z - airport.z;
    if (Math.abs(airportX) <= 5 && Math.abs(airportZ) <= 25) {
      if (y === 0) return "black_concrete";
      if (y === 1 && airportX === 0 && Math.abs(airportZ) % 8 <= 2) return "white_concrete";
    }
    if (airportX >= 8 && airportX <= 19 && airportZ >= -17 && airportZ <= -5) {
      if (y === 0) return "white_concrete";
      if (y >= 1 && y <= 5) {
        if (airportX === 8 || airportX === 19 || airportZ === -17 || airportZ === -5) {
          if (airportX === 13 && airportZ === -17 && y <= 2) return null;
          if (y === 2 && (airportX === 11 || airportX === 16)) return "glass";
          return "white_concrete";
        }
        return null;
      }
      if (y === 6) return "black_concrete";
    }
  }

  if (mine && Math.hypot(x - mine.x, z - mine.z) <= 12) {
    const offsetX = x - mine.x;
    const offsetZ = z - mine.z;
    const depth = y;
    if (y === 0 && Math.abs(offsetX) <= 4 && Math.abs(offsetZ) <= 4) return "stone";
    if (y > 0 && y <= 12 && Math.abs(offsetX) <= 3 && Math.abs(offsetZ) <= 3) {
      if (y % 3 === 0 && (offsetX !== 0 || offsetZ !== 0)) return "iron_ore";
      if (y % 2 === 0 && (Math.abs(offsetX) + Math.abs(offsetZ) > 0)) return "coal";
      return "stone";
    }
    if (y >= 2 && y <= 8 && Math.abs(offsetX) <= 1 && Math.abs(offsetZ) <= 1 && (offsetX === 0 || offsetZ === 0)) {
      return (depth + (offsetX + offsetZ + worldSeed) % 3) % 3 === 0 ? "copper_ore" : "stone";
    }
    if (y === 1 && Math.abs(offsetX) <= 5 && Math.abs(offsetZ) <= 5) return "oak_log";
  }

  if (dungeon && Math.hypot(x - dungeon.x, z - dungeon.z) <= 14) {
    const offsetX = x - dungeon.x;
    const offsetZ = z - dungeon.z;
    if (y === 0 && Math.abs(offsetX) <= 6 && Math.abs(offsetZ) <= 6) return "stone";
    if (y > 0 && y <= 6 && Math.abs(offsetX) <= 5 && Math.abs(offsetZ) <= 5) {
      const wall = (Math.abs(offsetX) === 5 || Math.abs(offsetZ) === 5) && y >= 1 && y <= 5;
      if (wall) return (x + z + worldSeed) % 3 === 0 ? "obsidian" : "stone";
      if ((x + z + worldSeed) % 7 === 0) return "torch";
      return "stone";
    }
    if (y === 3 && Math.abs(offsetX) <= 2 && Math.abs(offsetZ) <= 2) return "red_concrete";
  }

  if (castle && Math.hypot(x - castle.x, z - castle.z) <= 19) {
    const offsetX = x - castle.x;
    const offsetZ = z - castle.z;
    if (y === 0 && Math.abs(offsetX) <= 8 && Math.abs(offsetZ) <= 8) return "brick";
    if (y >= 1 && y <= 8 && Math.abs(offsetX) <= 8 && Math.abs(offsetZ) <= 8) {
      const wall = Math.abs(offsetX) === 8 || Math.abs(offsetZ) === 8 || (Math.abs(offsetX) <= 2 && Math.abs(offsetZ) <= 2 && y >= 2);
      if (wall) return (x + z + y + worldSeed) % 4 === 0 ? "black_concrete" : "brick";
      if ((x + z + y) % 9 === 0 && y <= 5) return "lantern";
      if (y === 2 && ((Math.abs(offsetX) <= 2 && Math.abs(offsetZ) <= 2) || (Math.abs(offsetX) <= 1 && Math.abs(offsetZ) <= 1))) {
        return "glass";
      }
      return "stone";
    }
  }

  return null;
}

export function terrainHeightAt(x, z, seed = 1) {
  x = wrapPlanetX(x);
  z = Math.max(PLANET_MIN_Z, Math.min(PLANET_MAX_Z, z));
  const distanceFromHarbor = Math.hypot(x, z);
  if (distanceFromHarbor <= CITY_BEACH_OUTER_RADIUS) return 0;
  if (distanceFromHarbor <= HARBOR_WATER_OUTER_RADIUS) return harborSeabedAt(x, z, seed);
  const worldSeed = normalizeSeed(seed);
  const longitude = (x - PLANET_MIN_X + 0.5) / PLANET_LONGITUDE_BLOCKS * Math.PI * 2 - Math.PI;
  const latitude = (z - PLANET_MIN_Z + 0.5) / PLANET_LATITUDE_BLOCKS * Math.PI - Math.PI / 2;
  const sphereX = PLANET_RADIUS * Math.cos(latitude) * Math.sin(longitude) + PLANET_RADIUS * Math.sin(latitude) * 0.37;
  const sphereZ = PLANET_RADIUS * Math.cos(latitude) * Math.cos(longitude) - PLANET_RADIUS * Math.sin(latitude) * 0.29;
  const centralAngle = Math.acos(clampUnit(Math.cos(latitude) * Math.cos(longitude)));
  const distance = centralAngle * PLANET_RADIUS;
  const broad = noise2d(sphereX * 0.027, sphereZ * 0.027, worldSeed);
  const detail = noise2d(sphereX * 0.081 + 37, sphereZ * 0.081 - 19, worldSeed);
  const ridgeNoise = noise2d(sphereX * 0.052 + 81, sphereZ * 0.052 + 17, worldSeed);
  const roughness = noise2d(sphereX * 0.13 - 57, sphereZ * 0.13 + 34, worldSeed);
  if (distance <= 12) return 0;

  const foothills = smoothStep(12, 34, distance);
  const mountains = smoothStep(25, 53, distance);
  const ridges = 1 - Math.abs(ridgeNoise);
  const height =
    1.2 +
    broad * 1.4 +
    detail * 0.8 +
    foothills * (1 + Math.max(0, broad) * 3) +
    mountains * (5 + ridges * 17 + roughness * 2);

  return Math.max(0, Math.min(30, Math.round(height)));
}

function clampUnit(value) {
  return Math.max(-1, Math.min(1, value));
}

function seededValue(x, z, seed) {
  return (hashNoise(x * 19.19 + 11, z * 7.73 - 29, seed) + 1) / 2;
}

function cityTreeAt(x, z, seed) {
  const cellX = Math.floor((x + CITY_BLOCK_SIZE / 2) / CITY_BLOCK_SIZE);
  const cellZ = Math.floor((z + CITY_BLOCK_SIZE / 2) / CITY_BLOCK_SIZE);
  if (seededValue(cellX + 31, cellZ - 17, seed) >= 0.72) return null;
  const side = seededValue(cellX + 9, cellZ + 4, seed) < 0.5 ? -12 : 12;
  const offset = (Math.floor(seededValue(cellX - 5, cellZ + 13, seed) * 4) * 6) - 9;
  const treeX = cellX * CITY_BLOCK_SIZE + side;
  const treeZ = cellZ * CITY_BLOCK_SIZE + offset;
  if (x !== treeX || z !== treeZ || Math.hypot(x, z) > CITY_RADIUS - 6) return null;
  return {
    x: treeX,
    z: treeZ,
    ground: 0,
    height: 3 + Math.floor(seededValue(cellX + 23, cellZ + 7, seed) * 3),
  };
}

function cityTreeBlockAt(x, y, z, seed) {
  const tree = cityTreeAt(x, z, seed);
  if (!tree) return null;
  const trunkTop = tree.ground + tree.height;
  if (y > tree.ground && y <= trunkTop) return "oak_log";
  const leafDistance = Math.abs(x - tree.x) + Math.abs(z - tree.z);
  for (let layer = trunkTop - 1; layer <= trunkTop + 2; layer += 1) {
    const radius = layer === trunkTop + 2 ? 1 : 2;
    if (y === layer && leafDistance <= radius * 2) return "leaves";
  }
  return null;
}

function cityColumnAt(x, z, seed) {
  if (Math.hypot(x, z) > CITY_RADIUS || Math.hypot(x, z) < 14) return null;

  const cellX = Math.floor((x + CITY_BLOCK_SIZE / 2) / CITY_BLOCK_SIZE);
  const cellZ = Math.floor((z + CITY_BLOCK_SIZE / 2) / CITY_BLOCK_SIZE);
  const localX = x - cellX * CITY_BLOCK_SIZE;
  const localZ = z - cellZ * CITY_BLOCK_SIZE;
  const roadEdge = Math.abs(localX) >= 12 || Math.abs(localZ) >= 12;
  if (roadEdge) return {
    height: 0,
    street: true,
    type: Math.abs(localX) === 12 || Math.abs(localX) === 13 || Math.abs(localZ) === 12 || Math.abs(localZ) === 13
      ? "white_concrete"
      : "black_concrete",
  };

  if (Math.hypot(cellX * CITY_BLOCK_SIZE, cellZ * CITY_BLOCK_SIZE) < 18) return null;
  const width = 10 + Math.floor(seededValue(cellX + 11, cellZ - 7, seed) * 12);
  const depth = 10 + Math.floor(seededValue(cellX - 5, cellZ + 15, seed) * 12);
  if (Math.abs(localX) > Math.floor(width / 2) || Math.abs(localZ) > Math.floor(depth / 2)) return null;

  const fortified = Math.hypot(cellX * CITY_BLOCK_SIZE, cellZ * CITY_BLOCK_SIZE) < 80 && (Math.abs(cellX) + Math.abs(cellZ)) % 2 === 0;
  const height = fortified
    ? 18 + Math.floor(seededValue(cellX, cellZ, seed) * 18)
    : 12 + Math.floor(seededValue(cellX, cellZ, seed) * 28);
  const palette = ["white_concrete", "black_concrete", "brick", "red_concrete"];
  const facade = palette[Math.floor(seededValue(cellX + 8, cellZ + 4, seed) * palette.length)];
  const accent = seededValue(cellX - 19, cellZ + 27, seed) > 0.73
    ? "red_concrete"
    : seededValue(cellX + 13, cellZ - 11, seed) > 0.83
      ? "brick"
      : "white_concrete";
  const wall = Math.abs(localX) === Math.floor(width / 2) || Math.abs(localZ) === Math.floor(depth / 2);
  return {
    height,
    facade,
    accent,
    fortified,
    wall,
    localX,
    localZ,
    width,
    depth,
    corner: Math.abs(localX) === Math.floor(width / 2) && Math.abs(localZ) === Math.floor(depth / 2),
    window: (Math.abs(localX + localZ + cellX + cellZ) % 3) === 0,
  };
}

function cityColumnBlockAt(column, y) {
  if (!column) return null;
  if (column.street) return y === 0 ? column.type : null;
  const { height, facade, accent, fortified, wall, corner, window, localX = 0, localZ = 0, depth = 12 } = column;
  if (y === 0) return "white_concrete";
  if (y < 0 || y > height) return null;
  const entrance = localX === 0 && localZ === -Math.floor(depth / 2);
  if (entrance && y <= 2) return "oak_door";
  if (
    y > 0 &&
    localZ === -2 &&
    localX >= -2 &&
    localX <= 1 &&
    y % 4 === (localX + 3) % 4
  ) {
    return "oak_planks";
  }
  if (y % 4 === 0 && y < height && !wall) {
    if (localZ === -2 && localX >= -2 && localX <= 1) return null;
    return "oak_planks";
  }
  if (fortified && y > height - 4 && wall) return "brick";
  if (y === height) return accent;
  if (y >= height - 2 && wall) return accent;
  if (y > 0 && y < height && !wall) return null;
  if (y % 4 === 0) return wall ? facade : "white_concrete";
  if (y % 4 === 1 && corner) return "black_concrete";
  if ((y + Math.abs(localX) + Math.abs(localZ)) % 5 === 0 && wall) return accent;
  if (wall && y % 4 === 2 && window) return "glass";
  return wall ? facade : null;
}

export function listCityProperties(seed = 1) {
  const properties = [];
  const worldSeed = normalizeSeed(seed);
  for (let cellX = -4; cellX <= 4; cellX += 1) {
    for (let cellZ = -4; cellZ <= 4; cellZ += 1) {
      const x = cellX * CITY_BLOCK_SIZE;
      const z = cellZ * CITY_BLOCK_SIZE;
      const column = cityColumnAt(x, z, worldSeed);
      if (!column || column.street) continue;
      properties.push({
        id: `city-home-${cellX}-${cellZ}`,
        name: `Glass City Residence ${properties.length + 1}`,
        x,
        z,
        entranceX: x,
        entranceZ: z - Math.floor(column.depth / 2) - 1,
        price: 250 + column.height * 25,
        height: column.height,
      });
    }
  }
  return properties;
}

export function cityPropertyNear(x, z, seed = 1, maxDistance = 5) {
  let nearest = null;
  let nearestDistance = maxDistance;
  for (const property of listCityProperties(seed)) {
    const distance = Math.hypot(wrapPlanetX(x - property.entranceX), z - property.entranceZ);
    if (distance <= nearestDistance) {
      nearest = property;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function cityBlockAt(x, y, z, seed) {
  return cityColumnBlockAt(cityColumnAt(x, z, seed), y);
}

function harborBlockAt(x, y, z, seed = 1) {
  const walkway = Math.abs(x) <= 3 && z >= HARBOR_DOCK_MIN_Z && z <= 152;
  const pierEnd = Math.abs(x) <= 14 && z >= 150 && z <= HARBOR_DOCK_MAX_Z;
  const baitShackDeck = x >= -17 && x <= -6 && z >= 126 && z <= 138;
  if ((walkway || pierEnd || baitShackDeck) && y === 0) return "oak_planks";

  if (walkway && (Math.abs(x) === 3 || (z % 7 === 0 && Math.abs(x) === 2)) && y > terrainHeightAt(x, z, seed) && y <= -1) {
    return "oak_log";
  }

  const shackWall = baitShackDeck && (x === -17 || x === -6 || z === 126 || z === 138);
  if (shackWall && y >= 1 && y <= 3) {
    if (x === -6 && z >= 131 && z <= 132) return null;
    const window = y === 2 && (z === 126 || z === 138) && (x === -14 || x === -9);
    return window ? "glass" : "oak_log";
  }

  if (baitShackDeck && y === 4 && z === 132) return "oak_planks";
  if (pierEnd && y === 1 && (Math.abs(x) === 14 || z === 150 || z === HARBOR_DOCK_MAX_Z) && (x + z) % 3 === 0) {
    return "oak_log";
  }
  return null;
}

function treePosition(gridX, gridZ, seed) {
  const x = gridX * 10 + Math.round((seededValue(gridX, gridZ, seed) - 0.5) * 6);
  const z = gridZ * 10 + Math.round((seededValue(gridZ, gridX, seed) - 0.5) * 6);
  const distanceFromCity = Math.hypot(x, z);
  const treeChance = distanceFromCity <= CITY_RADIUS ? 0 : distanceFromCity <= FOREST_OUTER_RADIUS ? 0.72 : 0.32;
  if (seededValue(x + 3, z - 7, seed) >= treeChance) return null;
  const ground = terrainHeightAt(x, z, seed);
  if (ground < 0 || ground >= 17) return null;
  return { x, z, ground, height: 3 + Math.floor(seededValue(x - 13, z + 9, seed) * 3) };
}

function treeBlockAt(x, y, z, seed) {
  const cityTree = cityTreeBlockAt(x, y, z, seed);
  if (cityTree) return cityTree;
  const gridX = Math.round(x / 10);
  const gridZ = Math.round(z / 10);
  for (let gx = gridX - 2; gx <= gridX + 2; gx += 1) {
    for (let gz = gridZ - 2; gz <= gridZ + 2; gz += 1) {
      const tree = treePosition(gx, gz, seed);
      if (!tree || Math.hypot(x - tree.x, z - tree.z) > 3.5) continue;
      const trunkTop = tree.ground + tree.height;
      if (x === tree.x && z === tree.z && y > tree.ground && y <= trunkTop) {
        return "oak_log";
      }
      const leafDistance = Math.abs(x - tree.x) + Math.abs(z - tree.z);
      for (let layer = trunkTop - 1; layer <= trunkTop + 2; layer += 1) {
        const radius = layer === trunkTop + 2 ? 1 : 2;
        if (y === layer && leafDistance <= radius * 2) return "leaves";
      }
    }
  }
  return null;
}

function houseBlockAt(x, y, z) {
  if (x >= 3 && x <= 7 && z >= 2 && z <= 6 && y === 0) return "oak_planks";
  if (x >= 2 && x <= 8 && z >= 1 && z <= 7 && y === 4) return "oak_planks";
  if (y < 1 || y > 3 || x < 3 || x > 7 || z < 2 || z > 6) return null;
  if (z === 2 || z === 6) {
    if (z === 2 && x === 5 && y <= 2) return "oak_door";
    if (y === 2 && ((z === 6 && (x === 4 || x === 6)) || (z === 2 && x === 4))) {
      return "glass";
    }
    return "oak_log";
  }
  if (x === 3 || x === 7) {
    if (y === 2 && z === 4) return "glass";
    return "oak_log";
  }
  return null;
}

export function getBaseBlockAt(x, y, z, seed = 1) {
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    !Number.isSafeInteger(z) ||
    y < BEDROCK_Y ||
    y > MAX_BUILD_HEIGHT
  ) {
    return null;
  }

  if (y === BEDROCK_Y) return "stone";
  const house = houseBlockAt(x, y, z);
  if (house) return house;
  const cityBlock = cityBlockAt(wrapPlanetX(x), y, z, normalizeSeed(seed));
  if (cityBlock) return cityBlock;
  const harbor = harborBlockAt(x, y, z, seed);
  if (harbor) return harbor;
  const structure = structureBlockAt(x, y, z, seed);
  if (structure) return structure;
  const beach = Math.hypot(wrapPlanetX(x), z) > CITY_RADIUS && Math.hypot(wrapPlanetX(x), z) <= CITY_BEACH_OUTER_RADIUS;
  if (beach && y === 0) return "sand";
  const water = Math.hypot(wrapPlanetX(x), z);
  const seabed = terrainHeightAt(x, z, seed);
  if (water > CITY_BEACH_OUTER_RADIUS && water <= HARBOR_WATER_OUTER_RADIUS && y > seabed && y <= 0) {
    return "water";
  }
  if (x >= -2 && x <= 3 && y === 0 && z === 2) return "sand";

  const tree = treeBlockAt(x, y, z, normalizeSeed(seed));
  if (tree) return tree;

  const surface = terrainHeightAt(x, z, seed);
  if (y > surface) return null;
  if (y === surface) {
    const coastal = Math.hypot(wrapPlanetX(x), z) <= HARBOR_WATER_OUTER_RADIUS;
    return coastal ? "sand" : "grass";
  }
  if (y >= surface - 2) return "dirt";
  return "stone";
}

export function createChunkBlocks(chunkX, chunkZ, seed = 1) {
  if (
    !Number.isSafeInteger(chunkX) ||
    !Number.isSafeInteger(chunkZ) ||
    chunkX < MIN_PLANET_CHUNK_X ||
    chunkX > MAX_PLANET_CHUNK_X ||
    chunkZ < MIN_PLANET_CHUNK_Z ||
    chunkZ > MAX_PLANET_CHUNK_Z
  ) {
    throw new RangeError("Chunk coordinates are outside the supported world range.");
  }

  const blocks = new Map();
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;
  for (let x = startX; x < startX + CHUNK_SIZE; x += 1) {
    for (let z = startZ; z < startZ + CHUNK_SIZE; z += 1) {
      const surface = terrainHeightAt(x, z, seed);
      const beach = Math.hypot(x, z) > CITY_RADIUS && Math.hypot(x, z) <= HARBOR_WATER_OUTER_RADIUS;
      for (let y = BEDROCK_Y + 1; y <= surface; y += 1) {
        const type = y === surface ? beach ? "sand" : "grass" : y >= surface - 2 ? "dirt" : "stone";
        if (type) blocks.set(blockKey(x, y, z), type);
      }
      const waterDistance = Math.hypot(x, z);
      if (waterDistance > CITY_BEACH_OUTER_RADIUS && waterDistance <= HARBOR_WATER_OUTER_RADIUS) {
        for (let y = surface + 1; y <= 0; y += 1) {
          blocks.set(blockKey(x, y, z), "water");
        }
      }
    }
  }

  const firstGridX = Math.floor(startX / 10) - 2;
  const lastGridX = Math.floor((startX + CHUNK_SIZE - 1) / 10) + 2;
  const firstGridZ = Math.floor(startZ / 10) - 2;
  const lastGridZ = Math.floor((startZ + CHUNK_SIZE - 1) / 10) + 2;
  for (let gridX = firstGridX; gridX <= lastGridX; gridX += 1) {
    for (let gridZ = firstGridZ; gridZ <= lastGridZ; gridZ += 1) {
      const tree = treePosition(gridX, gridZ, normalizeSeed(seed));
      if (!tree) continue;
      const trunkTop = tree.ground + tree.height;
      for (let x = tree.x - 2; x <= tree.x + 2; x += 1) {
        if (x < startX || x >= startX + CHUNK_SIZE) continue;
        for (let z = tree.z - 2; z <= tree.z + 2; z += 1) {
          if (z < startZ || z >= startZ + CHUNK_SIZE) continue;
          if (x === tree.x && z === tree.z) {
            for (let y = tree.ground + 1; y <= trunkTop; y += 1) {
              blocks.set(blockKey(x, y, z), "oak_log");
            }
          }
          const leafDistance = Math.abs(x - tree.x) + Math.abs(z - tree.z);
          for (let y = trunkTop - 1; y <= trunkTop + 2; y += 1) {
            const radius = y === trunkTop + 2 ? 1 : 2;
            if (leafDistance <= radius * 2) blocks.set(blockKey(x, y, z), "leaves");
          }
        }
      }
    }
  }

  const citySeed = normalizeSeed(seed);
  for (let x = Math.max(startX, -CITY_RADIUS); x < Math.min(startX + CHUNK_SIZE, CITY_RADIUS + 1); x += 1) {
    for (let z = Math.max(startZ, -CITY_RADIUS); z < Math.min(startZ + CHUNK_SIZE, CITY_RADIUS + 1); z += 1) {
      const column = cityColumnAt(x, z, citySeed);
      if (!column) continue;
      for (let y = 0; y <= Math.min(column.height, MAX_CITY_BUILDING_HEIGHT); y += 1) {
        const type = cityColumnBlockAt(column, y);
        if (type) blocks.set(blockKey(x, y, z), type);
      }
    }
  }

  for (let x = Math.max(startX, -18); x < Math.min(startX + CHUNK_SIZE, 19); x += 1) {
    for (let z = Math.max(startZ, HARBOR_DOCK_MIN_Z); z < Math.min(startZ + CHUNK_SIZE, HARBOR_DOCK_MAX_Z + 1); z += 1) {
      for (let y = HARBOR_SEABED_Y - 5; y <= 4; y += 1) {
        const type = harborBlockAt(x, y, z, seed);
        if (type) blocks.set(blockKey(x, y, z), type);
      }
    }
  }

  for (let x = Math.max(startX, -CITY_RADIUS); x < Math.min(startX + CHUNK_SIZE, CITY_RADIUS + 1); x += 1) {
    for (let z = Math.max(startZ, -CITY_RADIUS); z < Math.min(startZ + CHUNK_SIZE, CITY_RADIUS + 1); z += 1) {
      const tree = cityTreeAt(x, z, normalizeSeed(seed));
      if (!tree) continue;
      const trunkTop = tree.ground + tree.height;
      for (let y = tree.ground + 1; y <= trunkTop; y += 1) {
        blocks.set(blockKey(x, y, z), "oak_log");
      }
      for (let treeX = tree.x - 2; treeX <= tree.x + 2; treeX += 1) {
        if (treeX < startX || treeX >= startX + CHUNK_SIZE) continue;
        for (let treeZ = tree.z - 2; treeZ <= tree.z + 2; treeZ += 1) {
          if (treeZ < startZ || treeZ >= startZ + CHUNK_SIZE) continue;
          const leafDistance = Math.abs(treeX - tree.x) + Math.abs(treeZ - tree.z);
          for (let y = trunkTop - 1; y <= trunkTop + 2; y += 1) {
            const radius = y === trunkTop + 2 ? 1 : 2;
            if (leafDistance <= radius * 2) blocks.set(blockKey(treeX, y, treeZ), "leaves");
          }
        }
      }
    }
  }

  for (let x = startX; x < startX + CHUNK_SIZE; x += 1) {
    for (let z = startZ; z < startZ + CHUNK_SIZE; z += 1) {
      for (let y = BEDROCK_Y + 1; y <= MAX_BUILD_HEIGHT; y += 1) {
        const structure = structureBlockAt(x, y, z, seed);
        if (structure) blocks.set(blockKey(x, y, z), structure);
      }
    }
  }

  const village = Math.hypot(startX + CHUNK_SIZE / 2, startZ + CHUNK_SIZE / 2) < 24;
  if (village) {
    for (let x = Math.max(startX, -2); x < Math.min(startX + CHUNK_SIZE, 4); x += 1) {
      blocks.set(blockKey(x, 0, 2), "sand");
    }
    for (let x = Math.max(startX, 2); x < Math.min(startX + CHUNK_SIZE, 9); x += 1) {
      for (let z = Math.max(startZ, 1); z < Math.min(startZ + CHUNK_SIZE, 8); z += 1) {
        for (let y = 0; y <= 4; y += 1) {
          const type = houseBlockAt(x, y, z);
          const key = blockKey(x, y, z);
          if (type) blocks.set(key, type);
          else if (y <= 0 && x >= 3 && x <= 7 && z >= 2 && z <= 6) blocks.delete(key);
        }
      }
    }
  }

  for (let x = startX; x < startX + CHUNK_SIZE; x += 1) {
    for (let z = startZ; z < startZ + CHUNK_SIZE; z += 1) {
      blocks.set(blockKey(x, BEDROCK_Y, z), "stone");
    }
  }
  return blocks;
}

export function createInitialBlocks(seed = 1) {
  const blocks = new Map();
  for (let chunkX = -3; chunkX <= 3; chunkX += 1) {
    for (let chunkZ = -3; chunkZ <= 3; chunkZ += 1) {
      for (const [key, type] of createChunkBlocks(chunkX, chunkZ, seed)) {
        blocks.set(key, type);
      }
    }
  }
  return blocks;
}

export function isValidBlockPosition(position) {
  return (
    position !== null &&
    typeof position === "object" &&
    Number.isSafeInteger(position.x) &&
    Number.isSafeInteger(position.y) &&
    Number.isSafeInteger(position.z) &&
    position.x >= PLANET_MIN_X &&
    position.x <= PLANET_MAX_X &&
    position.z >= PLANET_MIN_Z &&
    position.z <= PLANET_MAX_Z &&
    position.y >= MIN_BUILD_Y &&
    position.y <= MAX_BUILD_HEIGHT
  );
}

export function canEditBlock(position, type, action, blocks, seed = 1) {
  if (!isValidBlockPosition(position)) return false;
  const key = blockKey(position.x, position.y, position.z);
  const current = blocks.has(key) ? blocks.get(key) : getBaseBlockAt(position.x, position.y, position.z, seed);
  if (action === "remove") return current !== null && position.y > BEDROCK_Y;
  if (action === "place") return (BLOCK_TYPES.has(type) || MODEL_ITEM_BY_ID.has(type)) && current === null;
  return false;
}

export function canCraft(inventory, recipe) {
  return Object.entries(recipe.ingredients).every(
    ([item, amount]) => (inventory.get(item) ?? 0) >= amount,
  );
}

export const BLOCK_TYPES = new Set([
  "grass",
  "dirt",
  "stone",
  "oak_planks",
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
export const FOREST_OUTER_RADIUS = 228;
export const CITY_BLOCK_SIZE = 32;
export const MAX_CITY_BUILDING_HEIGHT = 26;
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

export function terrainHeightAt(x, z, seed = 1) {
  x = wrapPlanetX(x);
  z = Math.max(PLANET_MIN_Z, Math.min(PLANET_MAX_Z, z));
  if (Math.hypot(x, z) <= CITY_BEACH_OUTER_RADIUS) return 0;
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

function cityBlockAt(x, y, z, seed) {
  if (Math.hypot(x, z) > CITY_RADIUS || Math.hypot(x, z) < 14) return null;

  const cellX = Math.floor((x + CITY_BLOCK_SIZE / 2) / CITY_BLOCK_SIZE);
  const cellZ = Math.floor((z + CITY_BLOCK_SIZE / 2) / CITY_BLOCK_SIZE);
  const localX = x - cellX * CITY_BLOCK_SIZE;
  const localZ = z - cellZ * CITY_BLOCK_SIZE;
  const onStreet = Math.abs(localX) >= 12 || Math.abs(localZ) >= 12;
  if (onStreet) {
    if (y !== 0) return null;
    return Math.abs(localX) === 12 || Math.abs(localX) === 13 || Math.abs(localZ) === 12 || Math.abs(localZ) === 13
      ? "white_concrete"
      : "black_concrete";
  }

  if (Math.hypot(cellX * CITY_BLOCK_SIZE, cellZ * CITY_BLOCK_SIZE) < 18) return null;
  const width = 14 + Math.floor(seededValue(cellX + 17, cellZ - 3, seed) * 6);
  const depth = 14 + Math.floor(seededValue(cellX - 9, cellZ + 21, seed) * 6);
  if (Math.abs(localX) > Math.floor(width / 2) || Math.abs(localZ) > Math.floor(depth / 2)) return null;

  const height = 9 + Math.floor(seededValue(cellX, cellZ, seed) * 18);
  const palette = ["white_concrete", "black_concrete"];
  const facade = palette[Math.floor(seededValue(cellX + 5, cellZ + 11, seed) * palette.length)];
  const wall = Math.abs(localX) === Math.floor(width / 2) || Math.abs(localZ) === Math.floor(depth / 2);
  if (y === 0) return "white_concrete";
  if (y < 0 || y > height) return null;
  if (y === height) return "black_concrete";
  if (y % 5 === 0) return wall ? facade : "white_concrete";
  if (!wall) return null;
  if (y % 5 === 2 && (Math.abs(localX + localZ + cellX + cellZ) % 4 === 0)) return "glass";
  if (y % 5 === 1 && Math.abs(localX) === Math.floor(width / 2) && Math.abs(localZ) === Math.floor(depth / 2)) {
    return "black_concrete";
  }
  return facade;
}

function treePosition(gridX, gridZ, seed) {
  const x = gridX * 10 + Math.round((seededValue(gridX, gridZ, seed) - 0.5) * 6);
  const z = gridZ * 10 + Math.round((seededValue(gridZ, gridX, seed) - 0.5) * 6);
  const distanceFromCity = Math.hypot(x, z);
  const treeChance = distanceFromCity <= CITY_RADIUS ? 0 : distanceFromCity <= FOREST_OUTER_RADIUS ? 0.72 : 0.32;
  if (seededValue(x + 3, z - 7, seed) >= treeChance) return null;
  const ground = terrainHeightAt(x, z, seed);
  if (ground >= 17) return null;
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
    if (z === 2 && x === 5 && y <= 2) return null;
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
  const beach = Math.hypot(wrapPlanetX(x), z) > CITY_RADIUS && Math.hypot(wrapPlanetX(x), z) <= CITY_BEACH_OUTER_RADIUS;
  if (beach && y === 0) return "sand";
  if (x >= -2 && x <= 3 && y === 0 && z === 2) return "sand";

  const tree = treeBlockAt(x, y, z, normalizeSeed(seed));
  if (tree) return tree;

  const surface = terrainHeightAt(x, z, seed);
  if (y > surface) return null;
  if (y === surface) return "grass";
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
      const beach = Math.hypot(x, z) > CITY_RADIUS && Math.hypot(x, z) <= CITY_BEACH_OUTER_RADIUS;
      for (let y = BEDROCK_Y + 1; y <= surface; y += 1) {
        const type = y === surface ? beach ? "sand" : "grass" : y >= surface - 2 ? "dirt" : "stone";
        if (type) blocks.set(blockKey(x, y, z), type);
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

  for (let x = Math.max(startX, -CITY_RADIUS); x < Math.min(startX + CHUNK_SIZE, CITY_RADIUS + 1); x += 1) {
    for (let z = Math.max(startZ, -CITY_RADIUS); z < Math.min(startZ + CHUNK_SIZE, CITY_RADIUS + 1); z += 1) {
      for (let y = 0; y <= MAX_CITY_BUILDING_HEIGHT; y += 1) {
        const type = cityBlockAt(x, y, z, normalizeSeed(seed));
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
  if (action === "place") return BLOCK_TYPES.has(type) && current === null;
  return false;
}

export function canCraft(inventory, recipe) {
  return Object.entries(recipe.ingredients).every(
    ([item, amount]) => (inventory.get(item) ?? 0) >= amount,
  );
}

import test from "node:test";
import assert from "node:assert/strict";
import {
  BEDROCK_Y,
  advancePlanetPosition,
  blockKey,
  canCraft,
  canEditBlock,
  createChunkBlocks,
  getBaseBlockAt,
  isValidBlockPosition,
  MAX_PLANET_CHUNK_X,
  MAX_PLANET_CHUNK_Z,
  MAX_WORLD_COORDINATE,
  PLANET_MAX_X,
  PLANET_MAX_Z,
  PLANET_MIN_X,
  PLANET_MIN_Z,
  PLANET_RADIUS,
  planetPointAt,
  RECIPES,
  terrainHeightAt,
  wrapPlanetX,
} from "../server/world.js";

test("generates repeatable terrain from a seed and varies terrain across seeds", () => {
  const first = [...createChunkBlocks(2, 1, 481516)].sort(([a], [b]) => a.localeCompare(b));
  const repeat = [...createChunkBlocks(2, 1, 481516)].sort(([a], [b]) => a.localeCompare(b));
  const otherSeed = [...createChunkBlocks(2, 1, 2012)].sort(([a], [b]) => a.localeCompare(b));

  assert.deepEqual(repeat, first);
  assert.notDeepEqual(otherSeed, first);
  assert.equal(terrainHeightAt(0, 0, 481516), 0);
});

test("generates adjacent chunks within the finite planet", () => {
  const westernChunk = createChunkBlocks(-1, 0, 9);
  const easternChunk = createChunkBlocks(0, 0, 9);
  assert.ok(westernChunk.has(blockKey(-1, 0, 0)));
  assert.ok(easternChunk.has(blockKey(0, 0, 0)));
  assert.equal(westernChunk.has(blockKey(0, 0, 0)), false);
  assert.equal(easternChunk.has(blockKey(-1, 0, 0)), false);
  assert.equal(getBaseBlockAt(800, -1, -450, 9), "stone");
  assert.equal(getBaseBlockAt(0, BEDROCK_Y, 0, 9), "stone");
  assert.throws(() => createChunkBlocks(MAX_PLANET_CHUNK_X + 1, 0, 9), RangeError);
  assert.throws(() => createChunkBlocks(0, MAX_PLANET_CHUNK_Z + 1, 9), RangeError);
});

test("wraps planet longitude and maps surface points onto a sphere", () => {
  assert.equal(wrapPlanetX(PLANET_MAX_X + 1), PLANET_MIN_X);
  assert.equal(terrainHeightAt(PLANET_MIN_X, 0, 19), terrainHeightAt(PLANET_MAX_X + 1, 0, 19));

  const point = planetPointAt(0, 12, 0);
  assert.ok(Math.abs(Math.hypot(point.x, point.y, point.z) - (PLANET_RADIUS + 12)) < 1e-9);
});

test("walks around the longitude seam and across both poles", () => {
  assert.ok(advancePlanetPosition(PLANET_MAX_X - 1, 0, 3, 0).x < PLANET_MIN_X + 5);
  const northPole = advancePlanetPosition(0, PLANET_MAX_Z, 0, 10);
  const southPole = advancePlanetPosition(0, PLANET_MIN_Z, 0, -10);
  assert.ok(northPole.z < PLANET_MAX_Z);
  assert.ok(southPole.z > PLANET_MIN_Z);
  assert.equal(northPole.yaw, Math.PI);
  assert.equal(southPole.yaw, Math.PI);
  assert.equal(northPole.x, PLANET_MIN_X);
  assert.equal(southPole.x, PLANET_MIN_X);
});

test("allows mining and placing underground while protecting bedrock", () => {
  const edits = new Map();
  const seed = 27;
  const underground = { x: 20, y: -10, z: 20 };
  const bedrock = { x: 20, y: BEDROCK_Y, z: 20 };

  assert.equal(getBaseBlockAt(underground.x, underground.y, underground.z, seed), "stone");
  assert.equal(canEditBlock(underground, "stone", "remove", edits, seed), true);
  edits.set(blockKey(underground.x, underground.y, underground.z), null);
  assert.equal(canEditBlock(underground, "stone", "place", edits, seed), true);
  assert.equal(canEditBlock(bedrock, "stone", "remove", edits, seed), false);
});

test("allows placing the expanded building palette", () => {
  const edits = new Map();
  const position = { x: 50, y: 100, z: 50 };

  for (const block of ["brick", "obsidian", "snow", "ice"]) {
    assert.equal(canEditBlock(position, block, "place", edits, 1), true);
  }
});

test("crafts a placeable crafting table from four planks", () => {
  const recipe = RECIPES.find((candidate) => candidate.id === "crafting_table");
  assert.ok(recipe);
  assert.equal(canCraft(new Map([["oak_planks", 4]]), recipe), true);
  assert.equal(canCraft(new Map([["oak_planks", 3]]), recipe), false);
});

test("keeps block coordinates inside the finite planet", () => {
  assert.equal(isValidBlockPosition({ x: PLANET_MAX_X, y: -20, z: PLANET_MIN_Z }), true);
  assert.equal(isValidBlockPosition({ x: PLANET_MAX_X + 1, y: 1, z: 0 }), false);
  assert.equal(isValidBlockPosition({ x: 0, y: 1, z: PLANET_MAX_Z + 1 }), false);
  assert.equal(isValidBlockPosition({ x: 0, y: BEDROCK_Y, z: 0 }), false);
  assert.equal(
    isValidBlockPosition({ x: MAX_WORLD_COORDINATE + 1, y: 1, z: 0 }),
    false,
  );
  assert.equal(isValidBlockPosition({ x: 0.5, y: 1, z: 0 }), false);
});

test("preserves the starter house in the spawn chunk", () => {
  const blocks = createChunkBlocks(0, 0, 12345);
  assert.equal(blocks.get(blockKey(4, 0, 4)), "oak_planks");
  assert.equal(blocks.has(blockKey(5, 1, 2)), false);
  assert.equal(blocks.get(blockKey(5, 3, 2)), "oak_log");
  assert.equal(blocks.get(blockKey(4, 2, 6)), "glass");
});

test("generates a seeded city building and road blocks", () => {
  const cityChunk = createChunkBlocks(4, 0, 12345);

  assert.equal(terrainHeightAt(71, 0, 12345), 0);
  const facade = [...cityChunk].find(([key, type]) => {
    const [x, y, z] = key.split(",").map(Number);
    return x >= 64 && x < 80 && z >= 0 && z < 16 && y > 0 && ["black_concrete", "white_concrete"].includes(type);
  });
  assert.ok(facade);
  assert.equal(cityChunk.get(blockKey(77, 0, 0)), "white_concrete");
  assert.equal(cityChunk.get(blockKey(79, 0, 0)), "black_concrete");
  const [key, type] = facade;
  const [x, y, z] = key.split(",").map(Number);
  assert.ok(canEditBlock({ x, y, z }, type, "remove", cityChunk, 12345));
});

test("generates a sandy city beach, city sidewalk trees, and surrounding forest", () => {
  const beachChunk = createChunkBlocks(7, 0, 12345);
  const cityTreeChunk = createChunkBlocks(-6, -3, 12345);
  const forestChunk = createChunkBlocks(10, 0, 12345);

  assert.equal(beachChunk.get(blockKey(120, 0, 0)), "sand");
  assert.equal(cityTreeChunk.get(blockKey(-84, 1, -35)), "oak_log");
  assert.ok([...forestChunk].some(([key, type]) => {
    const [x, y, z] = key.split(",").map(Number);
    return type === "oak_log" && y > 0 && Math.hypot(x, z) > 140 && Math.hypot(x, z) < 228;
  }));
});

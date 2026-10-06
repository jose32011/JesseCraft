import test from "node:test";
import assert from "node:assert/strict";
import {
  BEDROCK_Y,
  advancePlanetPosition,
  blockKey,
  canCraft,
  canEditBlock,
  cityPropertyNear,
  createChunkBlocks,
  findTravelRoute,
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
  isNearBoatWorkshop,
  isNearHarbor,
  listCityProperties,
  listCityShops,
  RECIPES,
  terrainHeightAt,
  wrapPlanetX,
  WORLD_LOCATIONS,
} from "../server/world.js";
import { MODEL_CATALOG, MODEL_CATEGORIES_LIST, MODEL_ITEM_BY_ID } from "../shared/models.js";

test("provides a thousand procedural models plus supplied, CC0, and mod asset models", () => {
  assert.equal(MODEL_CATALOG.length, 1121);
  assert.equal(MODEL_ITEM_BY_ID.size, 1121);
  assert.equal(new Set(MODEL_CATALOG.map(({ id }) => id)).size, 1121);
  assert.equal(new Set(MODEL_CATALOG.map(({ category }) => category)).size, 11);
  assert.equal(MODEL_CATALOG.filter(({ assetKey }) => assetKey?.startsWith("block-bits/")).length, 40);
  assert.equal(MODEL_CATALOG.filter(({ assetKey }) => assetKey?.startsWith("kenney-blaster-kit/")).length, 3);
  assert.equal(MODEL_CATALOG.filter(({ assetKey }) => assetKey?.startsWith("mod-car-kit/")).length, 50);
  assert.equal(MODEL_CATALOG.filter(({ assetKey }) => assetKey?.startsWith("mod-low-poly-plane/")).length, 4);
  assert.equal(MODEL_CATALOG.filter(({ assetKey }) => assetKey?.startsWith("quaternius-furniture/")).length, 12);
  assert.equal(MODEL_CATALOG.filter(({ assetKey }) => assetKey?.startsWith("quaternius-medieval-weapons/")).length, 12);
  assert.equal(MODEL_ITEM_BY_ID.get("quaternius_furniture_beddouble")?.name, "Bed Double");
  assert.equal(MODEL_ITEM_BY_ID.get("quaternius_weapon_sword_golden")?.name, "Sword Golden");
  assert.equal(MODEL_CATEGORIES_LIST[0].id, "imported");
  assert.ok(MODEL_CATALOG.slice(0, 43).every(({ assetKey }) => assetKey));
  for (const model of MODEL_CATALOG) {
    assert.ok(model.name);
    assert.ok(model.price > 0);
    assert.equal(canEditBlock({ x: 20, y: 100, z: 20 }, model.id, "place", new Map(), 27), true);
  }
});

test("generates repeatable terrain from a seed and varies terrain across seeds", () => {
  const first = [...createChunkBlocks(2, 1, 481516)].sort(([a], [b]) => a.localeCompare(b));
  const repeat = [...createChunkBlocks(2, 1, 481516)].sort(([a], [b]) => a.localeCompare(b));
  const otherSeed = [...createChunkBlocks(2, 1, 2012)].sort(([a], [b]) => a.localeCompare(b));

  assert.deepEqual(repeat, first);
  assert.notDeepEqual(otherSeed, first);
  assert.equal(terrainHeightAt(0, 0, 481516), 0);
});

test("generates seeded islands, ocean water, and connected landmark routes", () => {
  const seed = 481516;
  const island = terrainHeightAt(500, 52, seed);
  const seaFloor = terrainHeightAt(700, 52, seed);
  assert.ok(island > 0);
  assert.ok(seaFloor <= -12 && seaFloor >= -20);
  assert.equal(getBaseBlockAt(700, seaFloor + 1, 52, seed), "water");
  assert.equal(getBaseBlockAt(700, seaFloor, 52, seed), "sand");
  assert.equal(getBaseBlockAt(500, island, 52, seed), island <= 1 ? "sand" : "grass");
  assert.ok(WORLD_LOCATIONS.some(({ id }) => id === "ember-village"));
  assert.ok(WORLD_LOCATIONS.some(({ id }) => id === "verdant-dungeon"));
  for (const id of ["ember-village", "storm-village", "verdant-village", "frost-village"]) {
    const location = WORLD_LOCATIONS.find((entry) => entry.id === id);
    assert.ok(terrainHeightAt(location.x, location.z, seed) > 0);
  }
  const islandChunk = createChunkBlocks(Math.floor(700 / 16), Math.floor(52 / 16), seed);
  assert.equal(islandChunk.get(blockKey(700, seaFloor + 1, 52)), "water");
  assert.equal(islandChunk.get(blockKey(700, seaFloor, 52)), "sand");
  for (const [x, z] of [[94, 281], [-187, -262]]) {
    const channelFloor = terrainHeightAt(x, z, seed);
    assert.ok(channelFloor <= -12);
    assert.equal(getBaseBlockAt(x, 0, z, seed), "water");
    assert.equal(getBaseBlockAt(x, channelFloor, z, seed), "sand");
  }
  assert.ok(findTravelRoute("village", "frost-village"));
});

test("generates adjacent chunks within the finite planet", () => {
  const westernChunk = createChunkBlocks(-1, 0, 9);
  const easternChunk = createChunkBlocks(0, 0, 9);
  assert.ok(westernChunk.has(blockKey(-1, 0, 0)));
  assert.ok(easternChunk.has(blockKey(0, 0, 0)));
  assert.equal(westernChunk.has(blockKey(0, 0, 0)), false);
  assert.equal(easternChunk.has(blockKey(-1, 0, 0)), false);
  assert.equal(getBaseBlockAt(800, -1, -450, 9), "water");
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
  const chunk = createChunkBlocks(1, 1, seed);

  assert.equal(getBaseBlockAt(underground.x, underground.y, underground.z, seed), "stone");
  assert.equal(canEditBlock(underground, "stone", "remove", edits, seed), true);
  edits.set(blockKey(underground.x, underground.y, underground.z), null);
  assert.equal(canEditBlock(underground, "stone", "place", edits, seed), true);
  assert.equal(chunk.get(blockKey(20, BEDROCK_Y, 20)), "stone");
  assert.equal(isValidBlockPosition({ ...bedrock, y: BEDROCK_Y - 1 }), false);
  assert.equal(isValidBlockPosition({ ...bedrock, y: BEDROCK_Y + 1 }), true);
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
  assert.equal(blocks.get(blockKey(5, 1, 2)), "oak_door");
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

test("generates city residences with floor plates, stair access, and entrance openings", () => {
  const seed = 12345;
  const property = listCityProperties(seed)[0];
  assert.ok(property);
  assert.equal(cityPropertyNear(property.entranceX, property.entranceZ, seed)?.id, property.id);

  const blocks = createChunkBlocks(Math.floor(property.x / 16), Math.floor(property.z / 16), seed);
  assert.equal(blocks.get(blockKey(property.x, 4, property.z)), "oak_planks");
  assert.equal(getBaseBlockAt(property.x - 2, 1, property.z - 2, seed), "oak_planks");
  assert.equal(getBaseBlockAt(property.x - 1, 2, property.z - 2, seed), "oak_planks");
  assert.equal(getBaseBlockAt(property.entranceX, 1, property.entranceZ + 1, seed), "oak_door");
  assert.equal(getBaseBlockAt(property.entranceX, 2, property.entranceZ + 1, seed), "oak_door");
  const skyline = listCityProperties(seed).filter(({ height }) => height >= 46);
  assert.ok(skyline.length > 0);
  assert.ok(skyline.every(({ x, z, height }) => getBaseBlockAt(x, height + 5, z, seed) === "lantern"));
});

test("keeps shop signs outside storefront walls and returns city sign locations", () => {
  const shops = listCityShops(12345);
  assert.ok(shops.length >= 4);
  assert.ok(shops.some(({ name }) => name === "MARKET"));
  for (const shop of shops) {
    const facade = getBaseBlockAt(shop.x, 5, shop.z + 1, 12345);
    assert.ok(facade);
    assert.notEqual(facade, "shop_sign");
    assert.equal(shop.y, 5.8);
  }
});

test("generates a named airport location with runway and terminal", () => {
  const airport = WORLD_LOCATIONS.find(({ id }) => id === "airport");
  assert.deepEqual(airport, {
    id: "airport",
    name: "Glass City Airport",
    x: 72,
    z: -72,
    yaw: Math.PI,
    type: "airport",
  });

  const airportChunk = createChunkBlocks(4, -5, 12345);
  const terminalChunk = createChunkBlocks(5, -6, 12345);
  assert.equal(airportChunk.get(blockKey(72, 0, -72)), "black_concrete");
  assert.equal(airportChunk.get(blockKey(72, 1, -72)), "white_concrete");
  assert.equal(terminalChunk.get(blockKey(83, 0, -84)), "white_concrete");
  assert.equal(terminalChunk.get(blockKey(83, 6, -84)), "black_concrete");
});

test("generates a sandy city beach, city sidewalk trees, and surrounding forest", () => {
  const beachChunk = createChunkBlocks(7, 0, 12345);
  const cityTreeChunk = createChunkBlocks(-6, -3, 12345);
  const forestChunk = createChunkBlocks(11, -1, 12345);

  assert.equal(beachChunk.get(blockKey(120, 0, 0)), "sand");
  assert.equal(cityTreeChunk.get(blockKey(-84, 1, -35)), "oak_log");
  assert.ok([...forestChunk].some(([key, type]) => {
    const [x, y, z] = key.split(",").map(Number);
    return type === "oak_log" && y > 0 && Math.hypot(x, z) > 190 && Math.hypot(x, z) < 228;
  }));
});

test("generates harbor water, a walkable pier, and a fishing boundary", () => {
  const oceanChunk = createChunkBlocks(10, 0, 12345);
  const dockChunk = createChunkBlocks(0, 8, 12345);

  const seabed = terrainHeightAt(160, 0, 12345);
  const seabedSamples = [
    [160, 0],
    [164, 0],
    [168, 0],
    [172, 0],
    [176, 0],
    [180, 0],
  ].map(([x, z]) => terrainHeightAt(x, z, 12345));
  assert.ok(seabed >= -8 && seabed <= -2);
  assert.ok(new Set(seabedSamples).size > 1);
  assert.equal(oceanChunk.get(blockKey(160, 0, 0)), "water");
  assert.equal(oceanChunk.get(blockKey(160, seabed, 0)), "sand");
  assert.equal(oceanChunk.get(blockKey(160, seabed + 1, 0)), "water");
  assert.equal([...oceanChunk.values()].some((type) => type === "oak_log" || type === "leaves"), false);
  assert.equal(dockChunk.get(blockKey(0, 0, 140)), "oak_planks");
  assert.equal(getBaseBlockAt(11, 1, 126, 12345), "oak_door");
  assert.equal(getBaseBlockAt(11, 2, 126, 12345), "oak_door");
  assert.equal(getBaseBlockAt(6, 2, 129, 12345), "glass");
  assert.equal(getBaseBlockAt(11, 5, 132, 12345), "oak_planks");
  assert.equal(isNearBoatWorkshop(11, 132), true);
  assert.equal(isNearBoatWorkshop(11, 116), true);
  assert.equal(isNearBoatWorkshop(11, 115), false);
  assert.equal(isNearBoatWorkshop(80, 140), false);
  assert.equal(getBaseBlockAt(-17, 1, 132, 12345), "oak_log");
  assert.equal(isNearHarbor(0, 140), true);
  assert.equal(isNearHarbor(80, 140), false);
  assert.equal(isNearHarbor(0, 120), false);
});

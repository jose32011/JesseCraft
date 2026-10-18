import { WORLD_LOCATIONS } from "./world.js";

export const CROP_SEED_ITEM = "wheat_seed";
export const CROP_HARVEST_ITEM = "wheat";
export const CROP_GROW_MS = 60_000;
export const CROP_HARVEST_SEEDS = 2;
export const CROP_HARVEST_YIELD = 1;
export const CROP_HEALING = 4;
export const STARTING_SEED_COUNT = 5;

const FARM = WORLD_LOCATIONS.find((location) => location.id === "farm");

// Six plots laid out in two rows of three, centred on the farm.
export const FARM_PLOT_OFFSETS = [
  { dx: -8, dz: -4 },
  { dx: 0, dz: -4 },
  { dx: 8, dz: -4 },
  { dx: -8, dz: 4 },
  { dx: 0, dz: 4 },
  { dx: 8, dz: 4 },
];

export const FARM_PLOTS = FARM
  ? FARM_PLOT_OFFSETS.map(({ dx, dz }, index) => ({ id: index, x: FARM.x + dx, z: FARM.z + dz }))
  : [];

export function cropStage(crop, now = Date.now()) {
  return now - crop.plantedAt >= CROP_GROW_MS ? "ripe" : "growing";
}

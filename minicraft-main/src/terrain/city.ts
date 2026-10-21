import { BlockID } from "../Block";
import { blockIndex, ChunkSize } from "../chunk/ChunkData";

import { Biome, biomeDef } from "./biomes";
import { hashUnit } from "./noise";
import { placeTree, TREE_REACH } from "./trees";

/** Lowest x and z of the city square, which is centred on the world origin */
export const CITY_MIN = -144;
/** Blocks per side of the city square */
const CITY_SIZE = 288;
/** Distance between street centres: each city block is PITCH wide */
const PITCH = 36;
/** Width of each street in blocks */
const ROAD = 6;
/** Width of a lot between streets */
const LOT = PITCH - ROAD;
/** Lots per side of the square */
const LOTS = CITY_SIZE / PITCH;

/** Whether a lot is a park (grass and trees) rather than a building plot */
const isPark = (seed: number, i: number, j: number) =>
  hashUnit(seed, i, j, 21) < 0.2;

/**
 * Surface block of the city at world (wx, wz), or null outside the city.
 * Streets are stone brick, park lots are grass and building plots are
 * sandstone.
 */
export function cityTopAt(
  seed: number,
  wx: number,
  wz: number
): BlockID | null {
  const u = wx - CITY_MIN;
  const v = wz - CITY_MIN;
  if (u < 0 || v < 0 || u >= CITY_SIZE || v >= CITY_SIZE) return null;
  if (u % PITCH < ROAD || v % PITCH < ROAD) return BlockID.StoneBrick;
  const i = Math.floor(u / PITCH);
  const j = Math.floor(v / PITCH);
  return isPark(seed, i, j) ? BlockID.Grass : BlockID.Sandstone;
}

/**
 * Places the above-ground parts of the city (street lamps, buildings and
 * park trees) that fall inside chunk (originX, originZ). Every lot's layout
 * comes from its own index hash, so neighbouring chunks agree on the shared
 * geometry.
 */
export function placeCity(
  size: ChunkSize,
  seed: number,
  data: Uint8Array,
  originX: number,
  originZ: number,
  groundY: number
) {
  const w = size.width;

  const setLocal = (lx: number, y: number, lz: number, id: BlockID) => {
    if (lx < 0 || lx >= w || lz < 0 || lz >= w || y < 0 || y >= size.height)
      return;
    data[blockIndex(size, lx, y, lz)] = id;
  };
  const atLocal = (lx: number, y: number, lz: number): BlockID =>
    lx < 0 || lx >= w || lz < 0 || lz >= w || y < 0 || y >= size.height
      ? BlockID.Air
      : data[blockIndex(size, lx, y, lz)];
  const setWorld = (wx: number, y: number, wz: number, id: BlockID) =>
    setLocal(wx - originX, y, wz - originZ, id);

  // Lots that overlap this chunk, plus those whose trees reach into it
  const i0 = Math.max(0, Math.floor((originX - TREE_REACH - CITY_MIN) / PITCH));
  const i1 = Math.min(
    LOTS - 1,
    Math.floor((originX + w + TREE_REACH - 1 - CITY_MIN) / PITCH)
  );
  const j0 = Math.max(0, Math.floor((originZ - TREE_REACH - CITY_MIN) / PITCH));
  const j1 = Math.min(
    LOTS - 1,
    Math.floor((originZ + w + TREE_REACH - 1 - CITY_MIN) / PITCH)
  );

  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const lotX = CITY_MIN + i * PITCH + ROAD;
      const lotZ = CITY_MIN + j * PITCH + ROAD;

      if (isPark(seed, i, j)) {
        if (hashUnit(seed, i, j, 22) < 0.6) {
          const tx =
            lotX + 4 + Math.floor(hashUnit(seed, i, j, 23) * (LOT - 8));
          const tz =
            lotZ + 4 + Math.floor(hashUnit(seed, i, j, 24) * (LOT - 8));
          placeTree(
            biomeDef(Biome.Forest),
            seed,
            tx,
            tz,
            tx - originX,
            groundY + 1,
            tz - originZ,
            setLocal,
            atLocal,
            false
          );
        }
        continue;
      }

      // Street lamp in the lot corner, kept clear of the buildings
      const lampX = lotX + 1;
      const lampZ = lotZ + 1;
      for (let y = 1; y <= 3; y++)
        setWorld(lampX, groundY + y, lampZ, BlockID.OakLog);
      setWorld(lampX, groundY + 4, lampZ, BlockID.RedstoneLamp);

      // Building footprint and height from the lot hash
      const bw = 8 + Math.floor(hashUnit(seed, i, j, 31) * 11);
      const bd = 8 + Math.floor(hashUnit(seed, i, j, 32) * 11);
      const bx =
        lotX + 2 + Math.floor(hashUnit(seed, i, j, 33) * (LOT - 4 - bw + 1));
      const bz =
        lotZ + 2 + Math.floor(hashUnit(seed, i, j, 34) * (LOT - 4 - bd + 1));
      const bh = 5 + Math.floor(hashUnit(seed, i, j, 35) * 16);
      const wallRoll = hashUnit(seed, i, j, 36);
      const wall =
        wallRoll < 0.4
          ? BlockID.StoneBrick
          : wallRoll < 0.7
          ? BlockID.Sandstone
          : BlockID.WoodPlanks;
      const doorX = bx + Math.floor(bw / 2);

      for (let x = bx; x < bx + bw; x++) {
        for (let z = bz; z < bz + bd; z++) {
          const onEdge =
            x === bx || x === bx + bw - 1 || z === bz || z === bz + bd - 1;
          for (let y = groundY + 1; y <= groundY + bh; y++) {
            let id: BlockID = BlockID.Air;
            if (y === groundY + bh) {
              id = BlockID.Stone;
            } else if (onEdge) {
              id = wall;
              const xFace = x === bx || x === bx + bw - 1;
              const zFace = z === bz || z === bz + bd - 1;
              const idx = xFace ? z - bz : x - bx;
              const windowRow = y === groundY + 3 || y === groundY + 4;
              if (windowRow && idx % 3 === 1 && !(xFace && zFace)) {
                id = BlockID.Glass;
              }
              // Door on the -z face, two blocks tall
              if (z === bz && x === doorX && y <= groundY + 2) {
                id = BlockID.OakDoor;
              }
            }
            setWorld(x, y, z, id);
          }
        }
      }
      if (bh >= 5) {
        setWorld(
          bx + Math.floor(bw / 2),
          groundY + bh - 1,
          bz + Math.floor(bd / 2),
          BlockID.RedstoneLamp
        );
      }
    }
  }
}

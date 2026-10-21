import { ChunkSize } from "./chunk/ChunkData";
import { Biome } from "./terrain/biomes";
import { newColumn, sampleColumn } from "./terrain/generator";
import { worldNoise } from "./terrain/noise";
import { WorldParams } from "./WorldParams";

/** Half-width of the mapped square in blocks, centred on the world origin */
export const MAP_RADIUS = 512;
/** Blocks covered by one map pixel */
export const MAP_SCALE = 4;
const MAP_PIXELS = (MAP_RADIUS * 2) / MAP_SCALE;

/** Map colour per biome, before height shading */
const BIOME_COLORS: Record<Biome, [number, number, number]> = {
  [Biome.DeepOcean]: [20, 40, 110],
  [Biome.Ocean]: [35, 70, 160],
  [Biome.Beach]: [230, 220, 150],
  [Biome.StonyShore]: [140, 140, 130],
  [Biome.River]: [60, 110, 200],
  [Biome.Plains]: [110, 170, 80],
  [Biome.Forest]: [60, 130, 60],
  [Biome.BirchForest]: [120, 170, 90],
  [Biome.Swamp]: [80, 110, 70],
  [Biome.Desert]: [225, 200, 110],
  [Biome.Savanna]: [170, 160, 80],
  [Biome.Taiga]: [60, 100, 80],
  [Biome.SnowyTundra]: [230, 240, 240],
  [Biome.SnowyTaiga]: [200, 220, 220],
  [Biome.Mountains]: [125, 125, 125],
  [Biome.SnowyPeaks]: [250, 250, 255],
  [Biome.Count]: [0, 0, 0],
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Overview map drawn into a canvas in the pause menu. The terrain is sampled
 * with the same column generator as the world and cached per seed and terrain
 * settings; only the player marker is redrawn each time the menu opens.
 */
export class WorldMap {
  private readonly ctx: CanvasRenderingContext2D;
  private terrain: ImageData | null = null;
  private terrainKey = "";

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.width = MAP_PIXELS;
    canvas.height = MAP_PIXELS;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
  }

  /** Draws the terrain (re-sampled only when seed or terrain settings change) and the player */
  draw(params: WorldParams, size: ChunkSize, playerX: number, playerZ: number) {
    const key = `${params.seed}|${JSON.stringify(params.terrain)}`;
    if (!this.terrain || key !== this.terrainKey) {
      this.terrain = sampleTerrain(params, size);
      this.terrainKey = key;
    }
    this.ctx.putImageData(this.terrain, 0, 0);

    const px = clamp01((playerX + MAP_RADIUS) / (MAP_RADIUS * 2)) * MAP_PIXELS;
    const pz = clamp01((playerZ + MAP_RADIUS) / (MAP_RADIUS * 2)) * MAP_PIXELS;
    this.ctx.beginPath();
    this.ctx.arc(px, pz, 4, 0, Math.PI * 2);
    this.ctx.fillStyle = "#ff3030";
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.stroke();
  }
}

/** Samples the terrain over the mapped square and shades each pixel by biome and height */
function sampleTerrain(params: WorldParams, size: ChunkSize): ImageData {
  const noise = worldNoise(params.seed);
  const sea = params.terrain.seaLevel;
  const image = new ImageData(MAP_PIXELS, MAP_PIXELS);
  const data = image.data;
  for (let j = 0; j < MAP_PIXELS; j++) {
    for (let i = 0; i < MAP_PIXELS; i++) {
      const wx = i * MAP_SCALE - MAP_RADIUS;
      const wz = j * MAP_SCALE - MAP_RADIUS;
      const col = sampleColumn(noise, params, size, wx, wz, newColumn());
      const [r, g, b] = BIOME_COLORS[col.biome];
      // Higher ground is lighter, lower ground darker, so relief shows
      const shade = Math.min(
        1.2,
        Math.max(0.6, 0.8 + (col.height - sea) / 120)
      );
      const o = (j * MAP_PIXELS + i) * 4;
      data[o] = r * shade;
      data[o + 1] = g * shade;
      data[o + 2] = b * shade;
      data[o + 3] = 255;
    }
  }
  return image;
}

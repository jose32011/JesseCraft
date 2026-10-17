import { createChunkBlocks } from "../shared/world.js";

self.addEventListener("message", (event) => {
  const { chunkX, chunkZ, seed, generation } = event.data;
  try {
    const blocks = createChunkBlocks(chunkX, chunkZ, seed);
    self.postMessage({ chunkX, chunkZ, generation, blocks });
  } catch (error) {
    self.postMessage({
      chunkX,
      chunkZ,
      generation,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

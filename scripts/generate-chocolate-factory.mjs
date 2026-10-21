// Generates src/assets/chocolate-factory/chocolate-factory.glb from simple primitives.
// Run with: node scripts/generate-chocolate-factory.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// GLTFExporter reads binary output through FileReader, which Node does not provide.
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "src/assets/chocolate-factory/chocolate-factory.glb");

const materials = {
  stone: new THREE.MeshStandardMaterial({ color: 0xc9b8a0, roughness: 0.9, name: "stone" }),
  brick: new THREE.MeshStandardMaterial({ color: 0x5a2e1c, roughness: 0.85, name: "chocolateBrick" }),
  chocolate: new THREE.MeshStandardMaterial({ color: 0x4a2414, roughness: 0.4, name: "chocolate" }),
  pink: new THREE.MeshStandardMaterial({ color: 0xf2a7c3, roughness: 0.5, name: "candyPink" }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fd8ec, roughness: 0.1, transparent: true, opacity: 0.6, name: "glass" }),
  gold: new THREE.MeshStandardMaterial({ color: 0xe0b040, roughness: 0.3, metalness: 0.6, name: "gold" }),
};

const factory = new THREE.Group();
factory.name = "ChocolateFactory";

function add(geometry, material, x, y, z, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.name = name;
  factory.add(mesh);
  return mesh;
}

// Main hall: a long stone facade, centred on the origin with its base at y = 0.
add(new THREE.BoxGeometry(28, 6, 16), materials.stone, 0, 3, 0, "hall");
// Brick roof slab over the hall.
add(new THREE.BoxGeometry(28.6, 0.8, 16.6), materials.brick, 0, 6.4, 0, "roof");

// Central tower with a glass band and a brick cap.
add(new THREE.BoxGeometry(6, 22, 6), materials.stone, 0, 11, 0, "tower");
add(new THREE.BoxGeometry(6.4, 1, 6.4), materials.brick, 0, 22.5, 0, "towerCap");
add(new THREE.BoxGeometry(3, 3, 0.2), materials.glass, 0, 15, -3.1, "towerWindow");
// Gold pinnacle with a candy-pink ball on top.
add(new THREE.ConeGeometry(1.2, 4, 6), materials.gold, 0, 25, 0, "pinnacle");
add(new THREE.SphereGeometry(0.8, 12, 8), materials.pink, 0, 27.5, 0, "pinnacleBall");

// Four spires on the hall corners.
for (const [x, z] of [[-9, -6], [9, -6], [-9, 6], [9, 6]]) {
  add(new THREE.CylinderGeometry(1, 1.2, 10, 8), materials.stone, x, 11, z, "spireBody");
  add(new THREE.ConeGeometry(1.4, 4, 8), materials.brick, x, 15, z, "spireRoof");
}

// Chocolate river pipes running down the front, plus a chimney.
add(new THREE.CylinderGeometry(0.6, 0.6, 16, 8), materials.chocolate, -7, 8, 9, "pipeA");
add(new THREE.CylinderGeometry(0.6, 0.6, 16, 8), materials.chocolate, 7, 8, 9, "pipeB");
add(new THREE.CylinderGeometry(1.2, 1.4, 14, 10), materials.brick, 12, 7, -4, "chimney");

// Front door and a row of windows.
add(new THREE.BoxGeometry(3, 3.5, 0.3), materials.chocolate, 0, 1.75, 8.1, "door");
for (let i = -2; i <= 2; i += 2) {
  if (i === 0) continue;
  add(new THREE.BoxGeometry(2, 2, 0.2), materials.glass, i * 4 + 0, 3.5, 8.05, "windowFront");
}

const scene = new THREE.Scene();
scene.add(factory);

const exporter = new GLTFExporter();
const buffer = await new Promise((resolveExport, rejectExport) => {
  exporter.parse(scene, resolveExport, rejectExport, { binary: true });
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(buffer));
console.log(`wrote ${outputPath} (${buffer.byteLength} bytes)`);

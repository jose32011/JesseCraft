import * as THREE from "three";

export interface HorseParts {
  legs: THREE.Group[];
  tail: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Group;
  phase: number;
}

const BODY_Y = 0.86;

/** Blocky Minecraft-style horse: brown body, dark mane and tail, white socks. */
export function createHorse(bodyColor = "#8a5a36"): THREE.Group {
  const group = new THREE.Group();
  group.scale.setScalar(1.1);
  const skin = new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}textures/entity/horse.png`
  );
  skin.magFilter = THREE.NearestFilter;
  skin.minFilter = THREE.NearestFilter;
  const material = (color: THREE.ColorRepresentation) =>
    new THREE.MeshBasicMaterial({ color });
  const skinned = (color: THREE.ColorRepresentation) =>
    new THREE.MeshBasicMaterial({ color, map: skin });
  const bodyMaterial = skinned(bodyColor);
  const legMaterial = skinned(
    new THREE.Color(bodyColor).multiplyScalar(0.8)
  );
  const darkMaterial = material("#2a1a10");
  const muzzleMaterial = material("#4a2f1c");
  const sockMaterial = material("#ebe6dc");
  const eyeMaterial = material("#17130f");

  const addBox = (
    parent: THREE.Object3D,
    size: [number, number, number],
    position: [number, number, number],
    partMaterial: THREE.Material
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), partMaterial);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };

  const body = addBox(group, [0.62, 0.5, 1.0], [0, BODY_Y, 0], bodyMaterial);

  const neck = new THREE.Group();
  neck.position.set(0, 1.0, -0.4);
  neck.rotation.x = -0.5;
  group.add(neck);
  addBox(neck, [0.26, 0.52, 0.28], [0, 0.22, 0], bodyMaterial);
  addBox(neck, [0.1, 0.5, 0.14], [0, 0.2, 0.14], darkMaterial);

  const head = new THREE.Group();
  head.position.set(0, 0.5, -0.02);
  neck.add(head);
  addBox(head, [0.24, 0.26, 0.36], [0, 0.1, -0.12], bodyMaterial);
  addBox(head, [0.22, 0.2, 0.2], [0, -0.02, -0.4], muzzleMaterial);
  addBox(head, [0.08, 0.16, 0.02], [0, 0.12, -0.305], sockMaterial);
  for (const side of [-1, 1]) {
    addBox(head, [0.03, 0.05, 0.05], [side * 0.125, 0.16, -0.14], eyeMaterial);
    addBox(head, [0.05, 0.1, 0.05], [side * 0.07, 0.3, 0], darkMaterial);
  }

  const legs: THREE.Group[] = [];
  for (const x of [-0.2, 0.2]) {
    for (const z of [-0.34, 0.34]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.64, z);
      addBox(pivot, [0.15, 0.38, 0.15], [0, -0.19, 0], legMaterial);
      addBox(pivot, [0.16, 0.24, 0.16], [0, -0.5, 0], sockMaterial);
      group.add(pivot);
      legs.push(pivot);
    }
  }

  const tail = new THREE.Group();
  tail.position.set(0, BODY_Y + 0.12, 0.52);
  addBox(tail, [0.1, 0.46, 0.1], [0, -0.2, 0.04], darkMaterial);
  group.add(tail);

  const parts: HorseParts = {
    legs,
    tail,
    body,
    head,
    phase: Math.random() * Math.PI * 2,
  };
  group.userData.horse = parts;
  return group;
}

/** Gentle idle: legs shift, tail swishes, head bobs, body breathes. */
export function animateHorse(group: THREE.Group, time: number) {
  const parts = group.userData.horse as HorseParts | undefined;
  if (!parts) return;
  const t = time + parts.phase;
  parts.legs.forEach((leg, i) => {
    leg.rotation.x = Math.sin(t * 1.5 + (i % 2 === 0 ? 0 : Math.PI)) * 0.03;
  });
  parts.tail.rotation.z = Math.sin(t * 2) * 0.25;
  parts.head.rotation.x = Math.sin(t * 0.8) * 0.05;
  parts.body.position.y = BODY_Y + Math.sin(t * 1.5) * 0.01;
}

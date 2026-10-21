import * as THREE from "three";
import { animateHorse, createHorse } from "./Horse";
import type { EntityKind, SharedEntity } from "./Multiplayer";

/** Top solid block y at a block column, or null if it is water, unloaded or not solid */
export type GroundLookup = (x: number, z: number) => number | null;
export type EntitySender = (entity: Omit<SharedEntity, "owner">) => void;

const SPEED: Record<EntityKind, number> = { horse: 1.6, car: 4, bot: 2.2 };
const ROAM_RADIUS: Record<EntityKind, number> = { horse: 9, car: 16, bot: 12 };
const SEND_INTERVAL_MS = 250;
const FOLLOW_RATE = 6;
const TARGET_TIMEOUT_S = 12;
const ARRIVE_DISTANCE = 0.25;

/** Blocky car: painted body, glass cabin, dark trim and four wheels. Faces -z. */
export function createCar(color: string): THREE.Group {
  const group = new THREE.Group();
  const paint = new THREE.MeshBasicMaterial({ color });
  const trim = new THREE.MeshBasicMaterial({ color: "#343c40" });
  const glass = new THREE.MeshBasicMaterial({ color: "#83c9dc" });
  const wheelMaterial = new THREE.MeshBasicMaterial({ color: "#1d1d1d" });

  const addBox = (
    size: [number, number, number],
    position: [number, number, number],
    material: THREE.Material
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    group.add(mesh);
  };

  addBox([1.85, 0.48, 3.2], [0, 0.55, 0], paint);
  addBox([1.35, 0.66, 1.45], [0, 1.08, 0.22], glass);
  addBox([1.95, 0.16, 1.25], [0, 0.88, -0.95], paint);
  for (const side of [-1, 1]) {
    addBox([0.035, 0.09, 1.45], [side * 0.93, 0.63, 0.12], trim);
    addBox([0.04, 0.045, 1.5], [side * 0.94, 0.37, 0.12], paint);
    addBox([0.13, 0.08, 0.35], [side * 0.83, 0.88, -0.56], trim);
  }
  for (const x of [-0.98, 0.98]) {
    for (const z of [-1.05, 1.08]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10),
        wheelMaterial
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.34, z);
      group.add(wheel);
    }
  }
  group.scale.setScalar(0.9);
  return group;
}

/** Name tag drawn as a sprite above a bot's head */
function nameTag(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const material = new THREE.SpriteMaterial({
    map: context ? new THREE.CanvasTexture(canvas) : null,
    depthTest: false,
  });
  if (context) {
    context.fillStyle = "rgba(0, 0, 0, 0.55)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.font = "bold 30px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text.slice(0, 16), canvas.width / 2, canvas.height / 2 + 2);
  }
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.y = 2.4;
  return sprite;
}

/** Blocky walking figure in the given shirt colour, with a name tag. Faces -z. */
export function createBot(color: string, name: string): THREE.Group {
  const group = new THREE.Group();
  const shirt = new THREE.MeshBasicMaterial({ color });
  const skin = new THREE.MeshBasicMaterial({ color: "#e0b48c" });
  const pants = new THREE.MeshBasicMaterial({ color: "#2d3a57" });

  const addBox = (
    size: [number, number, number],
    position: [number, number, number],
    material: THREE.Material
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    group.add(mesh);
  };

  addBox([0.5, 0.75, 0.3], [0, 1.15, 0], shirt);
  addBox([0.5, 0.5, 0.5], [0, 1.8, 0], skin);
  for (const side of [-1, 1]) {
    addBox([0.22, 0.75, 0.24], [side * 0.14, 0.375, 0], pants);
    addBox([0.2, 0.7, 0.22], [side * 0.36, 1.15, 0], shirt);
  }
  group.add(nameTag(name));
  return group;
}

/** An entity this client or another player is responsible for */
interface Tracked {
  /** Live state when owned; last server state when followed */
  state: SharedEntity;
  group: THREE.Group;
  owned: boolean;
  home: { x: number; z: number };
  target: { x: number; z: number } | null;
  targetAge: number;
  dirty: boolean;
  lastSent: number;
}

/**
 * Horses, cars and bots shared by a room. The client that owns an entity
 * wanders it around and sends its position; every other client moves its
 * copy towards the positions the server relays.
 */
export class SharedEntities {
  private tracked = new Map<string, Tracked>();

  constructor(
    private scene: THREE.Scene,
    private localId: string,
    private ground: GroundLookup,
    private send: EntitySender
  ) {}

  has(id: string): boolean {
    return this.tracked.has(id);
  }

  /** Creates an entity this client owns, if it does not exist in the room yet */
  spawn(kind: EntityKind, id: string, x: number, z: number, color: string, name: string | null) {
    if (this.tracked.has(id)) return;
    const top = this.ground(Math.floor(x), Math.floor(z));
    if (top === null) return;
    const state: SharedEntity = {
      id,
      kind,
      x,
      y: top + 1,
      z,
      yaw: 0,
      color,
      name,
      owner: this.localId,
    };
    this.add(state, true);
    this.send(this.wire(state));
  }

  /** Applies an entity from the server, creating it if this client has not seen it */
  apply(entity: SharedEntity) {
    const existing = this.tracked.get(entity.id);
    if (!existing) {
      this.add(entity, entity.owner === this.localId);
      return;
    }
    if (entity.owner === this.localId) return;
    if (existing.owned) this.release(existing);
    existing.state = entity;
  }

  /** The room has handed an entity to a different player (or to this client) */
  setOwner(id: string, owner: string) {
    const existing = this.tracked.get(id);
    if (!existing) return;
    if (owner === this.localId) {
      if (existing.owned) return;
      existing.owned = true;
      existing.home = { x: existing.state.x, z: existing.state.z };
      existing.target = null;
      existing.state.owner = this.localId;
    } else if (existing.owned) {
      this.release(existing);
    } else {
      existing.state.owner = owner;
    }
  }

  /** Moves owned entities, eases followed ones, and animates horses */
  update(seconds: number, time: number, now: number) {
    for (const entity of this.tracked.values()) {
      if (entity.state.kind === "horse") animateHorse(entity.group, time);
      if (entity.owned) {
        this.wander(entity, seconds);
        if (entity.dirty && now - entity.lastSent >= SEND_INTERVAL_MS) {
          entity.dirty = false;
          entity.lastSent = now;
          this.send(this.wire(entity.state));
        }
        entity.group.position.set(entity.state.x, entity.state.y, entity.state.z);
        entity.group.rotation.y = entity.state.yaw;
      } else {
        this.follow(entity, seconds);
      }
    }
  }

  private add(state: SharedEntity, owned: boolean) {
    const group = this.build(state);
    group.position.set(state.x, state.y, state.z);
    group.rotation.y = state.yaw;
    this.scene.add(group);
    this.tracked.set(state.id, {
      state,
      group,
      owned,
      home: { x: state.x, z: state.z },
      target: null,
      targetAge: 0,
      dirty: false,
      lastSent: 0,
    });
  }

  private build(state: SharedEntity): THREE.Group {
    const color = state.color ?? "#8a5a36";
    if (state.kind === "horse") return createHorse(color);
    if (state.kind === "car") return createCar(color);
    return createBot(color, state.name ?? "Bot");
  }

  /** Gives an owned entity up; its last position stays as the followed state */
  private release(entity: Tracked) {
    entity.owned = false;
    entity.target = null;
    entity.state.owner = "";
  }

  private wander(entity: Tracked, seconds: number) {
    const s = entity.state;
    entity.targetAge += seconds;
    const reached =
      entity.target !== null &&
      Math.hypot(entity.target.x - s.x, entity.target.z - s.z) < ARRIVE_DISTANCE;
    if (!entity.target || reached || entity.targetAge > TARGET_TIMEOUT_S) {
      entity.target = this.pickTarget(entity);
      entity.targetAge = 0;
      if (!entity.target) return;
    }

    const dx = entity.target.x - s.x;
    const dz = entity.target.z - s.z;
    const distance = Math.hypot(dx, dz);
    const step = Math.min(distance, SPEED[s.kind] * seconds);
    const nx = s.x + (dx / distance) * step;
    const nz = s.z + (dz / distance) * step;
    const top = this.ground(Math.floor(nx), Math.floor(nz));
    if (top === null) {
      // Water or unloaded terrain ahead: pick another destination next frame
      entity.target = null;
      return;
    }
    if (step > 0) {
      s.yaw = Math.atan2(-dx, -dz);
      s.x = nx;
      s.z = nz;
      s.y = top + 1;
      entity.dirty = true;
    }
  }

  /** A random walkable spot near home, or null if none was found */
  private pickTarget(entity: Tracked): { x: number; z: number } | null {
    const radius = ROAM_RADIUS[entity.state.kind];
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * radius;
      const x = entity.home.x + Math.cos(angle) * distance;
      const z = entity.home.z + Math.sin(angle) * distance;
      if (this.ground(Math.floor(x), Math.floor(z)) !== null) return { x, z };
    }
    return null;
  }

  private follow(entity: Tracked, seconds: number) {
    const s = entity.state;
    const k = Math.min(1, seconds * FOLLOW_RATE);
    const g = entity.group;
    g.position.x += (s.x - g.position.x) * k;
    g.position.y += (s.y - g.position.y) * k;
    g.position.z += (s.z - g.position.z) * k;
    let turn = s.yaw - g.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    g.rotation.y += turn * k;
  }

  private wire(state: SharedEntity): Omit<SharedEntity, "owner"> {
    const { id, kind, x, y, z, yaw, color, name } = state;
    return { id, kind, x, y, z, yaw, color, name };
  }
}

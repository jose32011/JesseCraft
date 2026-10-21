import type { BlockID } from "./Block";

export type RemotePlayer = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
};

export type EntityKind = "horse" | "car" | "bot";

/** A horse, car or bot that one player's client drives and the room shares */
export type SharedEntity = {
  id: string;
  kind: EntityKind;
  x: number;
  y: number;
  z: number;
  yaw: number;
  color: string | null;
  name: string | null;
  owner: string;
};

export type Welcome = {
  seed: number;
  edits: [number, number, number, number][];
  players: RemotePlayer[];
  entities: SharedEntity[];
};

type Handlers = {
  onPlayerJoined: (player: RemotePlayer) => void;
  onPlayerMoved: (player: RemotePlayer) => void;
  onPlayerLeft: (id: string) => void;
  onBlock: (x: number, y: number, z: number, id: BlockID) => void;
  onEntity: (entity: SharedEntity) => void;
  onEntityOwner: (id: string, owner: string) => void;
  onError: (message: string) => void;
};

/** Room code from the `?room=` query parameter, or null for solo play */
export function readRoomCode(): string | null {
  const code = new URLSearchParams(window.location.search).get("room");
  return code && /^[A-Za-z0-9_-]{3,24}$/.test(code) ? code : null;
}

/** Player name, world name and create flag passed from the arcade lobby, or null for solo play */
export function readLobbySettings(): { name: string; world: string; create: boolean } {
  const params = new URLSearchParams(window.location.search);
  return {
    name: (params.get("name") ?? "").trim().slice(0, 20) || "Player",
    world: (params.get("world") ?? "").trim().slice(0, 24) || "World",
    create: params.get("create") === "1",
  };
}

/**
 * Connection to a shared Minicraft room on the arcade server. Sends this
 * player's position and block edits, and reports everyone else's.
 */
export class Multiplayer {
  readonly id = Math.random().toString(36).slice(2, 12).padEnd(10, "0");
  private socket: WebSocket | null = null;

  constructor(private handlers: Handlers) {}

  /** Joins the room and resolves with its seed, edits and current players */
  connect(room: string, name: string, world: string, create: boolean): Promise<Welcome> {
    const url = new URL("/ws/minicraft", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(url.toString());
    this.socket = socket;

    return new Promise<Welcome>((resolve, reject) => {
      let joined = false;

      socket.onopen = () => {
        this.send({ type: "join", room, name, world, create, id: this.id });
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === "welcome" && !joined) {
          joined = true;
          resolve(message as Welcome);
        } else if (message.type === "player_joined") {
          this.handlers.onPlayerJoined(message.player);
        } else if (message.type === "player_moved") {
          this.handlers.onPlayerMoved(message);
        } else if (message.type === "player_left") {
          this.handlers.onPlayerLeft(message.id);
        } else if (message.type === "block") {
          this.handlers.onBlock(message.x, message.y, message.z, message.id);
        } else if (message.type === "entity") {
          this.handlers.onEntity(message as SharedEntity);
        } else if (message.type === "entity_owner") {
          this.handlers.onEntityOwner(message.id, message.owner);
        } else if (message.type === "error") {
          if (joined) this.handlers.onError(message.message);
          else reject(new Error(message.message));
        }
      };

      socket.onclose = () => {
        if (!joined) reject(new Error("Could not reach the Minicraft room server."));
        else this.handlers.onError("Disconnected from the room.");
      };
    });
  }

  sendMove(x: number, y: number, z: number, yaw: number, pitch: number) {
    this.send({ type: "move", x, y, z, yaw, pitch });
  }

  sendBlock(x: number, y: number, z: number, id: BlockID) {
    this.send({ type: "block", x, y, z, id });
  }

  sendEntity(entity: Omit<SharedEntity, "owner">) {
    this.send({ type: "entity", ...entity });
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }

  private send(message: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}

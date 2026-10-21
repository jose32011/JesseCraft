import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module";

import { AdaptiveRenderDistance } from "./AdaptiveRenderDistance";
import audioManager from "./audio/AudioManager";
import { MusicManager } from "./audio/MusicManager";
import { BlockID } from "./Block";
import { getBlockDef } from "./Block/blocks";
import {
  BlockTextures,
  buildBlockIcons,
  loadBlockTextures,
} from "./Block/textures";
import { ChunkMaterials } from "./chunk/ChunkMaterial";
import { Clouds } from "./Clouds";
import { BlockBreaker } from "./gameplay/BlockBreaker";
import { HandRenderer } from "./gameplay/HandRenderer";
import { Multiplayer, readLobbySettings, readRoomCode, RemotePlayer, Welcome } from "./Multiplayer";
import { CityHub, TeleportMenu } from "./Teleport";
import { Hud } from "./gameplay/Hud";
import { InventoryMenu } from "./gameplay/InventoryMenu";
import { Particles } from "./gameplay/Particles";
import { isTouchDevice, TouchControls } from "./gameplay/TouchControls";
import { createUI } from "./GUI";
import {
  loadRenderDistance,
  randomSeed,
  SAVE_VERSION,
  saveRenderDistance,
  WorldMeta,
  WorldStorage,
} from "./persistence/WorldStorage";
import { Physics } from "./Physics";
import { Player } from "./Player";
import { Sky } from "./Sky";
import { SharedEntities } from "./SharedEntities";
import { numberWithCommas } from "./util";
import { World } from "./World";
import { WorldMap } from "./WorldMap";

const MIN_RENDER_DISTANCE = 2;
const MAX_RENDER_DISTANCE = 32;

/** Chromium's pointer-lock cooldown after an Esc exit is 1.25 s */
const LOCK_RETRY_MS = 1300;

const UNDERWATER_FOG = new THREE.Color(0x0a2a55);
const LAVA_FOG = new THREE.Color(0x7a1e00);

/** Visible area in CSS pixels; visualViewport excludes mobile browser bars */
const viewportSize = () => ({
  width: window.visualViewport?.width ?? window.innerWidth,
  height: window.visualViewport?.height ?? window.innerHeight,
});

export default class Game {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;

  private stats!: Stats;
  private gui: ReturnType<typeof createUI> | null = null;
  private debugVisible = false;
  private clock!: THREE.Clock;

  private storage!: WorldStorage;
  private meta!: WorldMeta;
  private lastSave = 0;
  /** Seconds between autosaves of edits and the player position */
  private saveInterval = 3;

  private sky!: Sky;
  world!: World;
  player!: Player;
  private physics!: Physics;
  private breaker!: BlockBreaker;
  private hand!: HandRenderer;
  private particles!: Particles;
  private hud = new Hud();
  private adaptive!: AdaptiveRenderDistance;
  private music = new MusicManager();
  private clouds!: Clouds;
  /** Horses, cars and bots shared by the room, including this player's own car and bot */
  private entities!: SharedEntities;
  private entitiesPlaced = false;
  /** Shared room connection; null when playing solo */
  private multiplayer: Multiplayer | null = null;
  private remotePlayers = new Map<string, THREE.Mesh>();
  /** Remote events that arrived before the world exists */
  private pendingRemote: (() => void)[] = [];
  private lastMoveSent = 0;
  /** Deferred right-click repeat, like vanilla's 4-tick place delay */
  private placeCooldown = 0;
  private placing = false;
  private wantLock = false;
  /** On-screen controls, created only on touch devices */
  private touch: TouchControls | null = null;
  private teleport: TeleportMenu | null = null;
  private inventory: InventoryMenu | null = null;
  /** Overview map shown in the pause menu, created on first use */
  private worldMap: WorldMap | null = null;
  private lockRetried = false;
  private lockRetry = 0;

  private previousTime = 0;
  private readonly fogColor = new THREE.Color();

  constructor() {
    this.previousTime = performance.now();
    this.clock = new THREE.Clock();
    this.start();
  }

  /**
   * Boots straight into the saved world (or a brand new one with a random
   * seed) and shows the pause menu once the terrain around the player is in.
   */
  async start() {
    const loadingScreen = document.getElementById("loading");
    if (loadingScreen) loadingScreen.style.display = "block";

    const [textures, storage] = await Promise.all([
      loadBlockTextures(),
      WorldStorage.open(),
    ]);
    buildBlockIcons(textures.icons);
    this.storage = storage;

    const roomCode = readRoomCode();
    const welcome = roomCode ? await this.joinRoom(roomCode) : null;

    // A shared room has its own seed and edits, so the solo save is not read
    const saved = welcome ? null : await storage.loadMeta();
    this.meta = welcome ? { ...Game.newMeta(), seed: welcome.seed } : saved ?? Game.newMeta();
    this.initScene(textures, this.meta.seed);
    if (welcome) this.setUpRoom(welcome);
    this.world.renderDistance = THREE.MathUtils.clamp(
      loadRenderDistance(this.world.renderDistance),
      MIN_RENDER_DISTANCE,
      MAX_RENDER_DISTANCE
    );
    this.adaptive = new AdaptiveRenderDistance(
      this.world.renderDistance,
      (distance) => {
        this.world.renderDistance = distance;
        this.refreshRenderDistanceLabel();
      }
    );

    if (saved) {
      this.world.dataStore.load(await storage.loadChunks());
      if (saved.player) {
        const { x, y, z, yaw, pitch } = saved.player;
        this.world.restore(this.player, new THREE.Vector3(x, y, z));
        this.player.setLook(yaw, pitch);
      }
    } else if (!welcome) {
      await storage.saveMeta(this.meta);
    }
    this.refreshHotbar();

    this.initStats();
    this.initListeners();
    this.initPauseMenu();
    this.updateSeedLabel();
    this.draw();
  }

  private static newMeta(): WorldMeta {
    const now = Date.now();
    return {
      version: SAVE_VERSION,
      seed: randomSeed(),
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Wipes the save and generates a fresh world from a random seed */
  async newWorld() {
    if (this.multiplayer) return;
    await this.flushSave();
    this.meta = Game.newMeta();
    this.world.dataStore.clear();
    await this.storage.clear();
    await this.storage.saveMeta(this.meta);
    this.world.seed = this.meta.seed;
    this.updateSeedLabel();
    this.setPauseVisible(false);
    this.world.regenerate(this.player);
  }

  /** Regenerates with the current (debug-tweaked) params, discarding edits */
  async regenerateWorld() {
    if (this.multiplayer) return;
    await this.flushSave();
    this.meta = { ...Game.newMeta(), seed: this.world.seed };
    this.world.dataStore.clear();
    await this.storage.clear();
    await this.storage.saveMeta(this.meta);
    this.updateSeedLabel();
    this.world.regenerate(this.player);
  }

  // ------------------------------------------------------------------ hud

  private refreshHotbar() {
    this.hud.renderHotbar(this.player.hotbar);
  }

  setRenderDistance(value: number) {
    const rd = THREE.MathUtils.clamp(
      Math.round(value),
      MIN_RENDER_DISTANCE,
      MAX_RENDER_DISTANCE
    );
    saveRenderDistance(rd);
    this.adaptive.setMax(rd);
    this.refreshRenderDistanceLabel();
    const slider = document.getElementById("render-distance-slider");
    if (slider instanceof HTMLInputElement) slider.value = String(rd);
  }

  private refreshRenderDistanceLabel() {
    const label = document.getElementById("render-distance");
    if (!label) return;
    const { max, current } = this.adaptive;
    label.textContent =
      current < max
        ? `Render Distance: ${max} chunks (auto ${current})`
        : `Render Distance: ${max} chunks`;
  }

  // ----------------------------------------------------------------- menus

  initPauseMenu() {
    const click = (id: string, handler: () => void) => {
      document.getElementById(id)?.addEventListener("click", () => {
        audioManager.play("ui.button.click");
        handler();
      });
    };

    click("resume", () => this.lockControls());
    // Clicking the dimmed world behind the menu also resumes, since Esc alone
    // cannot re-lock the pointer in Chromium
    document.getElementById("pause")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) this.lockControls();
    });
    click("new-world", () => {
      if (confirm("Create a new world? The current world will be deleted.")) {
        this.newWorld();
      }
    });
    click("github", () => window.open("https://github.com/0kzh/minicraft"));

    const slider = document.getElementById("render-distance-slider");
    if (slider instanceof HTMLInputElement) {
      slider.min = String(MIN_RENDER_DISTANCE);
      slider.max = String(MAX_RENDER_DISTANCE);
      slider.addEventListener("input", () =>
        this.setRenderDistance(Number(slider.value))
      );
      slider.addEventListener("change", () =>
        audioManager.play("ui.button.click")
      );
    }
    this.setRenderDistance(this.adaptive.max);

    const musicSlider = document.getElementById("music-volume-slider");
    const musicLabel = document.getElementById("music-volume");
    if (musicSlider instanceof HTMLInputElement && musicLabel) {
      const show = () =>
        (musicLabel.textContent = `Music: ${Math.round(
          this.music.volume * 100
        )}%`);
      musicSlider.value = String(Math.round(this.music.volume * 100));
      show();
      musicSlider.addEventListener("input", () => {
        this.music.setVolume(Number(musicSlider.value) / 100);
        show();
      });
      musicSlider.addEventListener("change", () =>
        audioManager.play("ui.button.click")
      );
    }

    this.player.controls.addEventListener("lock", () => {
      this.wantLock = false;
      this.setPauseVisible(false);
    });
    document.addEventListener("pointerlockerror", () =>
      this.onPointerLockError()
    );
    this.player.controls.addEventListener("unlock", () => {
      this.wantLock = false;
      window.clearTimeout(this.lockRetry);
      this.breaker.stop();
      this.placing = false;
      if (this.world.initialLoadComplete) this.setPauseVisible(true);
    });
    this.world.onInitialLoad = () => {
      // Touch play needs no pointer lock, so phones start straight away and show
      // the touch controls at once
      if (this.touch) {
        this.lockControls();
        return;
      }
      // Desktop pointer lock needs a user gesture, so the first press starts play
      const start = () => {
        window.removeEventListener("pointerdown", start);
        this.lockControls();
      };
      window.addEventListener("pointerdown", start);
      this.flushSave();
    };
  }

  /** True while the player is in the game rather than a menu */
  private isPlaying() {
    return this.touch ? this.touch.playing : this.player.controls.isLocked;
  }

  private lockControls() {
    if (!this.world.initialLoadComplete || this.isPlaying()) return;
    if (this.touch) {
      this.setPauseVisible(false);
      this.touch.setPlaying(true);
      return;
    }
    window.clearTimeout(this.lockRetry);
    this.wantLock = true;
    this.lockRetried = false;
    this.player.controls.lock();
  }

  /**
   * Chromium refuses pointer lock for ~1.25 s after an Esc-triggered exit
   * (`pointerlockerror`); one retry after the cooldown covers a click that
   * landed inside it. Esc itself never counts as a user gesture in Chromium,
   * so a request it triggered can fail for good: the menu then stays up until
   * the player clicks.
   */
  private onPointerLockError() {
    if (!this.wantLock || this.lockRetried) return;
    this.lockRetried = true;
    window.clearTimeout(this.lockRetry);
    this.lockRetry = window.setTimeout(
      () => this.player.controls.lock(),
      LOCK_RETRY_MS
    );
  }

  /** Esc toggles between the pause menu and the game */
  private togglePause() {
    if (this.isPlaying()) {
      if (this.touch) this.touchPause();
      else this.player.controls.unlock();
    } else {
      this.lockControls();
    }
  }

  /** Pause button on the touch overlay: the touch equivalent of unlocking */
  private touchPause() {
    this.touch?.setPlaying(false);
    this.breaker.stop();
    this.placing = false;
    this.setPauseVisible(true);
  }

  private setPauseVisible(visible: boolean) {
    const pause = document.getElementById("pause");
    if (pause) pause.style.display = visible ? "flex" : "none";
    this.music.setMuted(visible);
    if (visible) this.updateWorldMap();
  }

  /** Redraws the pause-menu map with the player's current position */
  private updateWorldMap() {
    if (!this.world.initialLoadComplete) return;
    if (!this.worldMap) {
      const canvas = document.getElementById("world-map");
      if (!(canvas instanceof HTMLCanvasElement)) return;
      this.worldMap = new WorldMap(canvas);
    }
    const p = this.player.position;
    this.worldMap.draw(this.world.params, this.world.chunkSize, p.x, p.z);
    const label = document.getElementById("map-label");
    if (label) {
      label.textContent = `X: ${Math.floor(p.x)}  Z: ${Math.floor(p.z)}`;
    }
  }

  private updateSeedLabel() {
    const label = document.getElementById("seed-label");
    if (label) label.textContent = `Seed: ${this.meta.seed}`;
    const debugSeed = document.getElementById("world-seed");
    if (debugSeed) debugSeed.textContent = `seed: ${this.meta.seed}`;
  }

  /** Shows/hides the debug overlay, FPS panel and tuning controls (F3) */
  toggleDebug() {
    this.debugVisible = !this.debugVisible;
    const debug = document.getElementById("debug");
    if (debug) debug.style.display = this.debugVisible ? "flex" : "none";
    if (this.stats) {
      this.stats.dom.style.display = this.debugVisible ? "block" : "none";
    }
    if (this.debugVisible) {
      if (!this.gui) this.gui = this.createGUI();
      this.gui.show();
    } else {
      this.gui?.hide();
    }
  }

  private createGUI() {
    return createUI(this.world, this.player, this.physics, this.sky, () =>
      this.regenerateWorld()
    );
  }

  /** Persists dirty chunk edits and the player's position */
  private async flushSave() {
    // A shared room's edits belong to the room, not the local save
    if (!this.world.initialLoadComplete || this.multiplayer) return;
    const dirty = this.world.dataStore.takeDirty();
    const look = this.player.getLook();
    const p = this.player.position;
    this.meta.player = {
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: look.yaw,
      pitch: look.pitch,
    };
    this.meta.updatedAt = Date.now();
    await Promise.all([
      dirty.length ? this.storage.saveChunks(dirty) : undefined,
      this.storage.saveMeta(this.meta),
    ]);
  }

  // ----------------------------------------------------------------- setup

  initStats() {
    this.stats = new Stats();
    this.stats.dom.style.display = "none";
    document.body.appendChild(this.stats.dom);
  }

  initScene(textures: BlockTextures, seed: number) {
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer();
    // Phones often report 3x; capping at 2 keeps the frame rate usable
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const size = viewportSize();
    this.renderer.setSize(size.width, size.height);
    this.renderer.setClearColor(0x80abfe);
    // The hand is drawn in a second pass over the world, so clear by hand
    this.renderer.autoClear = false;
    document.body.appendChild(this.renderer.domElement);

    this.sky = new Sky();
    this.scene.add(this.sky.mesh);
    this.clouds = new Clouds();
    this.scene.add(this.clouds.group);

    this.world = new World(seed, this.scene, new ChunkMaterials(textures));
    this.scene.add(this.world);

    this.player = new Player(this.scene);
    this.player.camera.aspect = size.width / size.height;
    this.player.camera.updateProjectionMatrix();
    this.player.onHotbarChange = () => this.refreshHotbar();
    this.physics = new Physics(this.scene);
    this.hand = new HandRenderer(textures);
    this.entities = new SharedEntities(
      this.scene,
      this.multiplayer?.id ?? "solo",
      (x, z) => this.groundTopAt(x, z),
      (entity) => this.multiplayer?.sendEntity(entity)
    );

    this.particles = new Particles(textures, this.world);
    this.scene.add(this.particles.mesh);
    this.breaker = new BlockBreaker(this.particles);

    // Compile the particle and hand programs now rather than stalling the
    // frame the first time a block is hit
    this.renderer.compile(this.scene, this.player.camera);
    this.hand.precompile(this.renderer);
  }

  initListeners() {
    window.addEventListener("resize", this.onWindowResize.bind(this), false);
    // Mobile browsers resize the visible area when the address bar moves,
    // which fires visualViewport resize but not always window resize
    window.visualViewport?.addEventListener("resize", this.onWindowResize.bind(this));
    document.addEventListener("mousedown", this.onMouseDown.bind(this), false);
    document.addEventListener("mouseup", this.onMouseUp.bind(this), false);
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("keydown", (e) => {
      if (e.code === "F3") {
        e.preventDefault();
        this.toggleDebug();
      } else if (e.code === "KeyT" && this.world.initialLoadComplete) {
        this.toggleTeleport();
      } else if (
        e.code === "KeyE" &&
        this.world.initialLoadComplete &&
        !this.teleport?.isOpen &&
        (this.isPlaying() || this.inventory?.isOpen)
      ) {
        this.toggleInventory();
      } else if (e.code === "Escape") {
        if (this.inventory?.isOpen) {
          this.inventory.close();
          return;
        }
        if (this.teleport?.isOpen) {
          this.teleport.close();
          return;
        }
        // Browsers release pointer lock on Esc themselves (firing `unlock`);
        // when the menu is already up, Esc goes back into the game
        if (!this.isPlaying()) this.togglePause();
      }
    });
    if (isTouchDevice()) {
      this.touch = new TouchControls(this.player, {
        onAttack: (down) => {
          if (down) this.breaker.start();
          else this.breaker.stop();
        },
        onPlace: (down) => {
          this.placing = down;
          this.placeCooldown = 0;
        },
        onSlot: (index) => this.player.selectSlot(index),
        onPause: () => this.touchPause(),
        onInventory: () => this.toggleInventory(),
      });
    }
    // Save before the tab goes away; IndexedDB writes started here complete
    window.addEventListener("pagehide", () => this.flushSave());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.flushSave();
    });
  }

  /** E opens the block inventory, which frees the pointer for clicks */
  private toggleInventory() {
    if (!this.inventory) {
      this.inventory = new InventoryMenu(
        (id) => {
          this.player.hotbar.setSelectedBlock(id);
          this.refreshHotbar();
        },
        () => this.lockControls()
      );
    }
    if (this.inventory.isOpen) {
      this.inventory.close();
      return;
    }
    if (this.isPlaying()) {
      this.breaker.stop();
      this.placing = false;
      if (this.touch) this.touch.setPlaying(false);
      else this.player.controls.unlock();
    }
    this.inventory.open(this.player.hotbar.selected + 1);
  }

  /** T opens the city teleport panel, which frees the pointer for clicks */
  private toggleTeleport() {
    if (!this.teleport) {
      this.teleport = new TeleportMenu(
        (hub) => this.teleportTo(hub),
        () => this.lockControls()
      );
    }
    if (this.teleport.isOpen) {
      this.teleport.close();
      return;
    }
    if (this.isPlaying()) this.player.controls.unlock();
    this.teleport.open();
  }

  /** Regenerates the world around a city hub and drops the player there */
  private teleportTo(hub: CityHub) {
    this.breaker.stop();
    this.placing = false;
    this.world.regenerate(this.player, new THREE.Vector3(hub.x, 0, hub.z));
  }

  onWindowResize() {
    const size = viewportSize();
    this.player.camera.aspect = size.width / size.height;
    this.player.camera.updateProjectionMatrix();
    this.renderer.setSize(size.width, size.height);
  }

  // ------------------------------------------------------------ interaction

  onMouseDown(event: MouseEvent) {
    if (!this.player.controls.isLocked) return;
    if (event.button === 0) {
      // Minecraft.startAttack swings even when nothing is hit
      this.player.swing();
      this.breaker.start();
    } else if (event.button === 2) {
      this.placing = true;
      this.placeCooldown = 0;
    }
  }

  onMouseUp(event: MouseEvent) {
    if (event.button === 0) this.breaker.stop();
    if (event.button === 2) this.placing = false;
  }

  private tryPlace() {
    const target = this.player.blockPlacementCoords;
    const id = this.player.activeBlockId;
    if (!target || id === null) return;
    const def = getBlockDef(id);
    if (
      !def.passable &&
      this.player.intersectsBlock(target.x, target.y, target.z)
    )
      return;
    if (this.world.addBlock(target.x, target.y, target.z, id)) {
      this.player.swing();
    }
  }

  private updateInteraction(dt: number) {
    if (!this.isPlaying()) return;
    this.breaker.update(dt, this.player, this.world);
    if (this.placing) {
      this.placeCooldown -= dt;
      if (this.placeCooldown <= 0) {
        this.tryPlace();
        this.placeCooldown = 4 * Physics.TICK;
      }
    }
  }

  // ----------------------------------------------------------- atmosphere

  private updateAtmosphere() {
    const time = this.clock.getElapsedTime();
    this.sky.update(time, this.player.camera.position);
    this.world.materials.sunLight = this.sky.daylight;
    this.world.materials.time = time;

    // Fog fades terrain out over the last chunks of the render distance so
    // the edge of the loaded world melts into the horizon instead of ending
    // in a hard silhouette. Cylindrical distance keeps the fade at the same
    // radius no matter how high the camera is.
    let start: number;
    let end: number;
    let cylindrical = true;
    if (this.player.eyeSubmerged) {
      const lava = this.player.inLava;
      this.fogColor.copy(lava ? LAVA_FOG : UNDERWATER_FOG);
      start = lava ? 0 : 1;
      end = lava ? 4 : 22;
      cylindrical = false;
    } else {
      this.fogColor.copy(this.sky.horizon);
      const radius =
        (this.world.renderDistance + 0.5) * this.world.chunkSize.width;
      start = radius * 0.62;
      end = radius * 0.96;
      this.sky.fogEnd = end;
    }
    this.world.materials.setFog(this.fogColor, start, end, cylindrical);
    // FogRenderer.setupFog(FOG_TERRAIN): clouds fade only over the last
    // viewDistance / 10 blocks (4..64), so they stay visible past the terrain
    this.clouds.setFog(
      this.fogColor,
      cylindrical ? end - THREE.MathUtils.clamp(end / 10, 4, 64) : start,
      end
    );
    this.clouds.update(time, this.sky.timeOfDay, this.player.camera.position);
    this.renderer.setClearColor(this.fogColor);
    this.particles.setLighting(this.sky.daylight, this.fogColor, start, end);
    this.hand.setLight(this.sky.daylight, this.skyVisibleAbovePlayer());
  }

  /** Whether nothing opaque sits above the eyes (rough stand-in for sky light) */
  private skyVisibleAbovePlayer() {
    const p = this.player.position;
    const x = Math.floor(p.x);
    const z = Math.floor(p.z);
    for (let y = Math.floor(p.y) + 1; y < this.world.chunkSize.height; y++) {
      const id = this.world.getBlock(x, y, z);
      if (id !== undefined && id !== BlockID.Air && getBlockDef(id).opaque) {
        return false;
      }
    }
    return true;
  }

  // ------------------------------------------------------------------ loop

  draw() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.previousTime) / 1000;

    requestAnimationFrame(() => {
      this.draw();
    });

    this.updateAtmosphere();
    this.music.update(deltaTime);
    this.adaptive.update(
      deltaTime,
      this.world.initialLoadComplete && this.isPlaying()
    );

    if (this.world.initialLoadComplete) {
      this.physics.update(deltaTime, this.player, this.world);
      this.updateInteraction(deltaTime);
      this.hand.update(deltaTime, this.player);
      this.particles.update(deltaTime);
    }
    this.world.update(this.player);
    if (this.world.initialLoadComplete) {
      if (!this.entitiesPlaced) this.placeEntities();
      this.entities.update(Math.min(deltaTime, 0.25), currentTime / 1000, currentTime);
      this.world.fluids.update(Math.min(deltaTime, 0.25));
      if (this.multiplayer && currentTime - this.lastMoveSent > 100) {
        this.lastMoveSent = currentTime;
        const look = this.player.getLook();
        // The camera sits at eye height; send the feet so others draw the body on the ground
        const p = this.player.position;
        this.multiplayer.sendMove(p.x, p.y - this.player.eyeHeight, p.z, look.yaw, look.pitch);
      }
      if (currentTime - this.lastSave > this.saveInterval * 1000) {
        this.lastSave = currentTime;
        this.flushSave();
      }
    }

    // update triangle count
    const triangleCount = document.getElementById("triangle-count");
    if (triangleCount) {
      triangleCount.innerHTML = `triangles: ${numberWithCommas(
        this.renderer.info.render.triangles
      )}`;
    }

    const renderCalls = document.getElementById("render-calls");
    if (renderCalls) {
      renderCalls.innerHTML = `draw calls: ${numberWithCommas(
        this.renderer.info.render.calls
      )}`;
    }

    if (this.stats) this.stats.update();

    this.renderWorldAndHand();

    this.previousTime = currentTime;
  }

  /** Top solid block y at (x, z), or null if it is water, lava or unloaded */
  private groundTopAt(x: number, z: number): number | null {
    for (let y = this.world.chunkSize.height - 1; y > 0; y--) {
      const id = this.world.getBlock(x, y, z);
      if (id === undefined) return null;
      if (id === BlockID.Air) continue;
      const def = getBlockDef(id);
      if (def.fluid) return null;
      return def.passable ? null : y;
    }
    return null;
  }

  /** Connects to a shared room; falls back to solo play if it can't be joined */
  private async joinRoom(room: string): Promise<Welcome | null> {
    const multiplayer = new Multiplayer({
      onPlayerJoined: (player) => this.afterSetup(() => this.placeRemotePlayer(player)),
      onPlayerMoved: (player) => this.afterSetup(() => this.placeRemotePlayer(player)),
      onPlayerLeft: (id) => this.afterSetup(() => this.removeRemotePlayer(id)),
      onBlock: (x, y, z, id) => this.afterSetup(() => this.world.applyRemoteBlock(x, y, z, id)),
      onEntity: (entity) => this.afterSetup(() => this.entities.apply(entity)),
      onEntityOwner: (id, owner) => this.afterSetup(() => this.entities.setOwner(id, owner)),
      onError: (message) => window.alert(message),
    });
    try {
      const { name, world, create } = readLobbySettings();
      const welcome = await multiplayer.connect(room, name, world, create);
      this.multiplayer = multiplayer;
      this.updateLobbyStat();
      return welcome;
    } catch (error) {
      multiplayer.close();
      window.alert(`Could not join room "${room}": ${(error as Error).message} Playing solo instead.`);
      return null;
    }
  }

  /** Applies the room's edits and players once the scene exists */
  private setUpRoom(welcome: Welcome) {
    this.world.onBlockEdit = (x, y, z, id) => this.multiplayer?.sendBlock(x, y, z, id);
    for (const [x, y, z, id] of welcome.edits) {
      this.world.applyRemoteBlock(x, y, z, id as BlockID);
    }
    for (const entity of welcome.entities) this.entities.apply(entity);
    for (const player of welcome.players) this.placeRemotePlayer(player);
    for (const apply of this.pendingRemote) apply();
    this.pendingRemote = [];
  }

  private afterSetup(apply: () => void) {
    if (this.world) apply();
    else this.pendingRemote.push(apply);
  }

  private placeRemotePlayer(player: RemotePlayer) {
    let mesh = this.remotePlayers.get(player.id);
    if (!mesh) {
      const hue = ((player.id.charCodeAt(0) * 37) % 360) / 360;
      // The scene has no lights, so an unlit material keeps other players visible in the dark
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(hue, 0.7, 0.5),
      });
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), material);
      this.scene.add(mesh);
      this.remotePlayers.set(player.id, mesh);
      this.updateLobbyStat();
    }
    mesh.position.set(player.x, player.y + 0.9, player.z);
    mesh.rotation.y = player.yaw;
  }

  private removeRemotePlayer(id: string) {
    const mesh = this.remotePlayers.get(id);
    if (!mesh) return;
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    this.remotePlayers.delete(id);
    this.updateLobbyStat();
  }

  /** Shows the lobby's world name and player count in the debug panel */
  private updateLobbyStat() {
    const stat = document.getElementById("lobby-stat");
    if (!stat) return;
    if (!this.multiplayer) {
      stat.textContent = "";
      return;
    }
    const { world } = readLobbySettings();
    stat.textContent = `Lobby: ${world} - ${this.remotePlayers.size + 1} players`;
  }

  /**
   * Places the room's horses and this player's car and bot near spawn once the
   * first chunks load. Entities that already exist in the room are left alone.
   */
  private placeEntities() {
    this.entitiesPlaced = true;
    const originX = Math.floor(this.player.camera.position.x);
    const originZ = Math.floor(this.player.camera.position.z);
    const horses: [number, number, string][] = [
      [6, 4, "#8a5a36"],
      [-5, 7, "#3b2a1e"],
      [3, -8, "#c7a27a"],
    ];
    horses.forEach(([dx, dz, color], i) => {
      this.entities.spawn("horse", `horse-${i}`, originX + dx + 0.5, originZ + dz + 0.5, color, null);
    });

    const id = this.multiplayer?.id ?? "solo";
    const pick = (colors: string[]) => colors[Math.floor(Math.random() * colors.length)];
    this.entities.spawn(
      "car",
      `car-${id}`,
      originX - 8.5,
      originZ - 3.5,
      pick(["#d64541", "#2e86de", "#f1c40f", "#8e44ad"]),
      null
    );
    this.entities.spawn(
      "bot",
      `bot-${id}`,
      originX + 2.5,
      originZ - 2.5,
      pick(["#3ba55c", "#e67e22", "#9b59b6"]),
      readLobbySettings().name
    );
  }

  /** World pass, then the first-person hand on top */
  private renderWorldAndHand() {
    this.renderer.clear();
    this.renderer.render(this.scene, this.player.camera);
    if (this.world.initialLoadComplete) {
      this.hand.render(
        this.renderer,
        this.player,
        this.physics.accumulator / Physics.TICK
      );
    }
  }
}

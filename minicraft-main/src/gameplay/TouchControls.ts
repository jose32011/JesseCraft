import { Player } from "../Player";

export interface TouchActions {
  /** Break-block button pressed (true) or released (false) */
  onAttack(down: boolean): void;
  /** Place-block button pressed (true) or released (false) */
  onPlace(down: boolean): void;
  /** Hotbar slot tapped, 0-based */
  onSlot(index: number): void;
  /** Pause button tapped */
  onPause(): void;
  /** Inventory button tapped */
  onInventory(): void;
}

const SLOT_COUNT = 9;

/**
 * True for any device with touch input: phones, tablets (including ones with
 * a mouse or keyboard attached) and touchscreen laptops. Desktops without a
 * touchscreen keep the mouse controls.
 */
export function isTouchDevice(): boolean {
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(any-pointer: coarse)").matches
  );
}

/**
 * Touch overlay used in place of pointer lock. Left side is a joystick,
 * dragging anywhere else turns the camera, and the buttons on the right
 * drive the same actions as the mouse and keyboard.
 */
export class TouchControls {
  private readonly root: HTMLElement;
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;

  private stickId: number | null = null;
  private stickCenter = { x: 0, y: 0 };
  private stickRadius = 1;

  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };

  /** Touch id to button name, for buttons currently held */
  private held = new Map<number, string>();

  playing = false;

  constructor(
    private readonly player: Player,
    private readonly actions: TouchActions
  ) {
    this.root = document.createElement("div");
    this.root.id = "touch-controls";
    this.root.innerHTML = `
      <div id="touch-stick"><div id="touch-stick-knob"></div></div>
      <button class="touch-button" data-action="jump">Jump</button>
      <button class="touch-button" data-action="attack">Break</button>
      <button class="touch-button" data-action="place">Place</button>
      <button class="touch-button" data-action="inventory">Inv</button>
      <button class="touch-button" data-action="pause">Menu</button>
    `;
    document.body.appendChild(this.root);
    this.stick = this.root.querySelector("#touch-stick") as HTMLElement;
    this.knob = this.root.querySelector("#touch-stick-knob") as HTMLElement;

    const opts = { passive: false };
    this.root.addEventListener("touchstart", (e) => this.onStart(e), opts);
    this.root.addEventListener("touchmove", (e) => this.onMove(e), opts);
    this.root.addEventListener("touchend", (e) => this.onEnd(e), opts);
    this.root.addEventListener("touchcancel", (e) => this.onEnd(e), opts);
    this.setPlaying(false);
  }

  /** Shows or hides the overlay. Hiding clears all held input. */
  setPlaying(on: boolean) {
    this.playing = on;
    this.root.style.display = on ? "block" : "none";
    if (!on) this.reset();
  }

  private reset() {
    this.player.touchMove.set(0, 0);
    this.player.touchSprint = false;
    this.player.touchJump = false;
    this.stickId = null;
    this.lookId = null;
    this.held.clear();
    this.knob.style.transform = "translate(-50%, -50%)";
    this.root
      .querySelectorAll(".touch-button.active")
      .forEach((el) => el.classList.remove("active"));
  }

  private onStart(e: TouchEvent) {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const target = t.target as Element;
      const button = target.closest<HTMLElement>("[data-action]");
      if (button) {
        this.pressButton(t.identifier, button.dataset.action ?? "");
        continue;
      }
      // This overlay covers the hotbar, so hit-test its box by coordinates
      const rect = document.getElementById("toolbar")?.getBoundingClientRect();
      if (
        rect &&
        t.clientX >= rect.left &&
        t.clientX <= rect.right &&
        t.clientY >= rect.top &&
        t.clientY <= rect.bottom
      ) {
        const slot = Math.floor(
          ((t.clientX - rect.left) / rect.width) * SLOT_COUNT
        );
        this.actions.onSlot(Math.min(SLOT_COUNT - 1, Math.max(0, slot)));
        continue;
      }
      if (target.closest("#touch-stick") && this.stickId === null) {
        this.stickId = t.identifier;
        const rect = this.stick.getBoundingClientRect();
        this.stickCenter = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
        this.stickRadius = rect.width / 2;
        this.moveStick(t.clientX, t.clientY);
        continue;
      }
      if (this.lookId === null) {
        this.lookId = t.identifier;
        this.lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  }

  private onMove(e: TouchEvent) {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.stickId) {
        this.moveStick(t.clientX, t.clientY);
      } else if (t.identifier === this.lookId) {
        this.player.addLookDelta(
          t.clientX - this.lookLast.x,
          t.clientY - this.lookLast.y
        );
        this.lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  }

  private onEnd(e: TouchEvent) {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.stickId) {
        this.stickId = null;
        this.player.touchMove.set(0, 0);
        this.player.touchSprint = false;
        this.knob.style.transform = "translate(-50%, -50%)";
      } else if (t.identifier === this.lookId) {
        this.lookId = null;
      } else {
        this.releaseButton(t.identifier);
      }
    }
  }

  private moveStick(x: number, y: number) {
    let dx = (x - this.stickCenter.x) / this.stickRadius;
    let dy = (y - this.stickCenter.y) / this.stickRadius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    // Screen y grows downward; forward is positive
    this.player.touchMove.set(dx, -dy);
    this.player.touchSprint = -dy > 0.9;
    const knobRadius = this.stickRadius * 0.8;
    this.knob.style.transform = `translate(calc(-50% + ${
      dx * knobRadius
    }px), calc(-50% + ${dy * knobRadius}px))`;
  }

  private pressButton(id: number, action: string) {
    this.held.set(id, action);
    this.setActive(action, true);
    switch (action) {
      case "jump":
        this.player.touchJump = true;
        break;
      case "attack":
        this.actions.onAttack(true);
        break;
      case "place":
        this.actions.onPlace(true);
        break;
      case "pause":
        this.held.delete(id);
        this.setActive(action, false);
        this.actions.onPause();
        break;
      case "inventory":
        this.held.delete(id);
        this.setActive(action, false);
        this.actions.onInventory();
        break;
    }
  }

  private releaseButton(id: number) {
    const action = this.held.get(id);
    if (!action) return;
    this.held.delete(id);
    this.setActive(action, false);
    switch (action) {
      case "jump":
        this.player.touchJump = false;
        break;
      case "attack":
        this.actions.onAttack(false);
        break;
      case "place":
        this.actions.onPlace(false);
        break;
    }
  }

  private setActive(action: string, active: boolean) {
    const el = this.root.querySelector(`[data-action="${action}"]`);
    el?.classList.toggle("active", active);
  }
}

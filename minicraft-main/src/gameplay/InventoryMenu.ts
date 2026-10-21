import { BlockID, blockIdToKey } from "../Block";
import { BLOCKS } from "../Block/blocks";

/**
 * Every block that can go on the hotbar: registered, has an icon, and is not
 * air or a flowing-liquid variant (those ids start at BlockID.FlowingWater).
 */
function pickableBlocks(): BlockID[] {
  return BLOCKS.filter(
    (def) =>
      def &&
      def.id !== BlockID.Air &&
      def.id < BlockID.FlowingWater &&
      def.uiTexture
  ).map((def) => def.id);
}

const labelFor = (id: BlockID) =>
  ((blockIdToKey as Record<number, string>)[id] ?? `block ${id}`)
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * Overlay listing all blocks. Opened with E in game; clicking a block puts it
 * in the selected hotbar slot. Pressing E/Esc again closes it.
 */
export class InventoryMenu {
  private root: HTMLDivElement;
  private title: HTMLDivElement;
  private grid: HTMLDivElement;
  private opened = false;

  constructor(
    private onPick: (id: BlockID) => void,
    private onClose: () => void
  ) {
    this.root = document.createElement("div");
    this.root.id = "inventory";
    Object.assign(this.root.style, {
      position: "fixed",
      inset: "0",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0, 0, 0, 0.55)",
      zIndex: "20",
      fontFamily: "monospace",
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: "#2b2b2b",
      color: "#fff",
      padding: "16px 20px",
      border: "3px solid #111",
      maxWidth: "92vw",
      maxHeight: "86vh",
      overflowY: "auto",
      boxSizing: "border-box",
    });

    this.title = document.createElement("div");
    Object.assign(this.title.style, { marginBottom: "12px", fontSize: "16px" });
    panel.appendChild(this.title);

    this.grid = document.createElement("div");
    Object.assign(this.grid.style, {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, 52px)",
      gap: "6px",
      justifyContent: "start",
    });
    panel.appendChild(this.grid);

    this.root.appendChild(panel);
    document.body.appendChild(this.root);
  }

  get isOpen() {
    return this.opened;
  }

  /** Opens the grid; `slotNumber` is the 1-based hotbar slot being filled */
  open(slotNumber: number) {
    if (this.opened) return;
    this.opened = true;
    this.title.textContent = `Click a block for hotbar slot ${slotNumber} (E to close)`;
    this.fill();
    this.root.style.display = "flex";
  }

  private fill() {
    this.grid.replaceChildren();
    for (const id of pickableBlocks()) {
      const cell = document.createElement("button");
      cell.title = labelFor(id);
      cell.setAttribute("aria-label", labelFor(id));
      Object.assign(cell.style, {
        width: "52px",
        height: "52px",
        padding: "4px",
        cursor: "pointer",
        backgroundColor: "#3a3a3a",
        backgroundImage: `url('${BLOCKS[id].uiTexture}')`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        border: "2px solid #111",
      });
      cell.addEventListener("click", () => {
        // Hide without relocking: the caller decides what happens next
        this.hide();
        this.onPick(id);
        this.onClose();
      });
      this.grid.appendChild(cell);
    }
  }

  private hide() {
    this.opened = false;
    this.root.style.display = "none";
  }

  close() {
    if (!this.opened) return;
    this.hide();
    this.onClose();
  }

  toggle(slotNumber: number) {
    if (this.opened) this.close();
    else this.open(slotNumber);
  }
}

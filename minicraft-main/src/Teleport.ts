/** A city hub the player can teleport to, as a point in the generated world */
export interface CityHub {
  name: string;
  x: number;
  z: number;
}

export const CITY_HUBS: CityHub[] = [
  { name: "Spawn Hub", x: 32, z: 32 },
  { name: "Riverside", x: 256, z: 32 },
  { name: "Highland", x: -192, z: 160 },
  { name: "Coastline", x: 160, z: -224 },
];

/**
 * Overlay listing the city hubs. Opened with T in game; picking a hub or
 * pressing T/Esc again closes it.
 */
export class TeleportMenu {
  private root: HTMLDivElement;
  private opened = false;

  constructor(
    private onSelect: (hub: CityHub) => void,
    private onClose: () => void
  ) {
    this.root = document.createElement("div");
    this.root.id = "teleport";
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
      padding: "20px 24px",
      border: "3px solid #111",
      minWidth: "260px",
    });

    const title = document.createElement("div");
    title.textContent = "Teleport to a city (T to close)";
    Object.assign(title.style, { marginBottom: "12px", fontSize: "16px" });
    panel.appendChild(title);

    for (const hub of CITY_HUBS) {
      const button = document.createElement("button");
      button.textContent = hub.name;
      Object.assign(button.style, {
        display: "block",
        width: "100%",
        margin: "6px 0",
        padding: "8px",
        font: "inherit",
        cursor: "pointer",
      });
      button.addEventListener("click", () => {
        // Hide without relocking: the world is about to regenerate
        this.hide();
        this.onSelect(hub);
      });
      panel.appendChild(button);
    }

    this.root.appendChild(panel);
    document.body.appendChild(this.root);
  }

  get isOpen() {
    return this.opened;
  }

  open() {
    if (this.opened) return;
    this.opened = true;
    this.root.style.display = "flex";
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

  toggle() {
    if (this.opened) this.close();
    else this.open();
  }
}

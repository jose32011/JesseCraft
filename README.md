# Voxland

Voxland is a small, original voxel sandbox built on the assets and ideas already in this repository. It is **not** Minecraft and does not use Minecraft branding or proprietary Minecraft content.

## Run locally

From this directory:

```sh
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). To play from a phone on the same Wi-Fi, open that URL using the computer's LAN IP address. The Node.js WebSocket server listens on port `3001`.

For a production build:

```sh
npm run build
npm start
```

The production server serves the built client and the multiplayer WebSocket endpoint on port `3001`.

## Saved-world persistence

Without a database, saved worlds are stored as JSON files in `.data/saves`. To store them in Railway Postgres, add a `DATABASE_URL` variable to the game server service. When both services are in the same Railway project and environment, reference the Postgres service's private URL, for example `${{Postgres.DATABASE_URL}}` (replace `Postgres` with the exact service name). The server creates `voxland_worlds` and `voxland_profiles` at startup. Started worlds autosave every minute by default; players can toggle autosave in the world menu or save immediately with **Save world**. Player profiles, character colors, and profile statistics are keyed by a browser-generated profile ID and stored in Postgres.

For local development, set `DATABASE_URL` in the shell before starting the server, using the public TCP Proxy URL from Railway. Keep the URL private and out of source control. If the database password has been exposed, rotate it in Railway before connecting.

## Controls

- Desktop: `W`/`A`/`S`/`D` to move, `Space` to jump, `G` or the **Fly** button to toggle flight, and hold `Space`/`Shift` or `Page Up`/`Page Down` to rise/descend while flying or piloting a plane. When driving a tank, hold `Z`/`C` to turn the turret and press `F` to fire. Drag the view to look, and point with the mouse crosshair to break or place blocks (left-click/right-click).
- Mobile: use the on-screen joystick to move, drag the view to look, and use **Jump**, **Break**, and **Place**.
- Controller: connect a standard Gamepad API-compatible controller. The left stick moves (and navigates open menus), right stick aims from the centered crosshair, A jumps or (while flying) rises and activates the focused menu control, B attacks or (while flying) descends, X interacts, Y toggles flight, triggers break/place at the crosshair (or climb/descend in a plane; the right trigger fires a tank cannon), bumpers cycle hotbar items, Back opens inventory, and Start opens settings. D-pad navigates open panels; use left/right to change focused selections.
- In water, hold `Space` to rise or `Shift` to dive; touch players can use the **Rise** and **Dive** buttons that appear in the water.
- Use `E` near a parked car, plane, or tank (or tap the vehicle button on touch) to enter; press `E` again to exit. Drive with `W`/`S`, steer with `A`/`D`, and use `Space`/`Shift` or `Page Up`/`Page Down` to climb or descend in the plane. Touch players get dedicated **Up** and **Down** flight buttons while flying or piloting. In a tank, use the mobile **Aim** and **Fire** buttons, or hold `Z`/`C` and press `F` on desktop; the camera moves behind the tank so you can see the turret direction. Cannon hits have a cooldown.
- Glass City buildings include floors, stair runs, windows, and walk-through doors. Open the Village Market near a building entrance to buy an available residence; use **Go to my home** or a home's **Go home** button to return there. Ownership is saved with the world.
- Select a block from the hotbar or use number keys `1`–`9`. `Q` breaks and `E` places when not beside a vehicle.
- Press `I` or tap **Bag** to open inventory. Mining collects blocks, dropped items can be picked up by walking close, and inventory rows let you drop items.
- Item counts beyond 64 are split into separate 64-item stacks in the bag.
- Drag an inventory item onto a hotbar slot to assign it. On touch screens, tap the inventory item, then tap a hotbar slot.
- Craft planks from logs, glass from sand and stone, and campfires from logs and stone. Crafted/placeable blocks appear in the hotbar with their inventory counts.
- Defeat monsters for 50 XP and 25 coins. Open **World settings → Village market** near the spawn village to browse 1,000 procedural models, 40 supplied Block Bits models, 54 imported mod assets, and three Kenney blasters across furniture, plants, animals, monsters, dragons, armor, weapons, tools, crystals, and decor. Imported assets appear first in the market list and can be isolated with the **Imported assets** filter. Buy or add a model, assign it from your inventory to the hotbar, and place it to decorate your home. The Kenney blasters can also be selected as held weapons.
- The harbor has a Kenney Pirate Kit ship and rowboat (CC0). New building, terrain, wood, and water textures from PixelTexturePack are applied to matching block materials; credit Jestan for those textures.
- Open **World settings → Open map** and choose **Expand map** for a full-screen view. Select a location marker, then use **Teleport** to travel there.

## Asset credits

- PixelTexturePack textures by Jestan, used under Jestan's Public License for Using This Product; attribution requested.
- Pirate Kit models by Kenney, CC0 1.0.
- KayKit Block Bits models by Kay Lousberg, CC0 1.0.
- Edit your displayed player name in the top bar.

The shared starter world is generated from a random 32-bit seed shown in the top bar. The seed deterministically generates terrain, forested foothills, mountain ranges, and a flat spawn village as players explore; chunks are generated around each player and unloaded behind them. Set `WORLD_SEED` to a number from `0` to `4294967295` when starting the server to generate the same terrain again. Mining works underground down to the unbreakable bedrock layer, with gravity and landing on exposed blocks. The world includes a small house, buildable blocks, inventory, crafting, dropped items, and three server-simulated village bots that wander locally, approach nearby players, and steer around solid blocks. It also has a generated creature catalogue with 256 species variants each for the village, coast, ocean, forest, and highlands (1,280 variants total). A small habitat-specific selection roams each region at once; names, animal model forms, colors, and sizes vary by world seed. Players can fight monsters, earn XP and coins, and spend coins on placeable procedural models at the village market. World edits and player inventory/progression are included in world saves and autosaves; without saving, data is held in server memory. Browser profiles are not authenticated accounts.

## Minecraft mod compatibility

Minecraft Java mods built for Forge or Fabric cannot be loaded directly by this Node.js/browser game: they target Minecraft's Java runtime and mod APIs, not this game's WebSocket protocol or Three.js client. Bedrock add-ons have a separate format and runtime too. A feature can be recreated or ported as original game code, and individual mod assets/code can only be reused if their license explicitly allows it and its terms are followed. Do not redistribute Minecraft's proprietary assets or code. A future Voxland plugin API could let original community extensions register blocks, items, recipes, and bots.

## Asset and code credits

Block texture packs are bundled in `src/assets/blocks/own/`, `src/assets/blocks/pixel-perfection/`, and `src/assets/blocks/vibes/` so the game client does not depend on the Voxelize submodule at runtime or build time. Pack folders are kept separate because their textures have overlapping filenames. The game currently uses textures from `own/`.

Voxelize's README attributes Pixel Perfection by XSSheep, modified, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); redistributed adaptations of those textures must follow its attribution and share-alike terms. The repository did not provide separate license metadata for the `own` and `vibes` packs, so verify their provenance and usage rights before redistributing them outside this project.

The Voxland client/server code and generated campfire texture are original and separate from the Voxelize runtime. Check individual licenses before reusing other third-party assets or code.

In-game animals and fish use block-form meshes with species-specific colors and shapes. The repository also retains animal GLTF source files from Quaternius' [Ultimate Animated Animal Pack](https://quaternius.com/packs/ultimateanimatedanimals.html), released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); these source models are not loaded by the game.

The supplied Block Bits glTF models in `src/assets/Assets/gltf/` use the supplied texture atlas in `src/assets/Textures/`. No source or license metadata was included with those files; verify their redistribution terms before publishing the game or its assets.

Three weapon models (blaster-a, blaster-b, and blaster-c) are from Kenney's [Blaster Kit](https://kenney.nl/assets/blaster-kit), licensed CC0 1.0. The pack's license is included at `src/assets/kenney-blaster-kit/License.txt`.
# JesseCraft

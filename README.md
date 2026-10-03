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

- Desktop: `W`/`A`/`S`/`D` to move, `Space` to jump, drag the view to look, click to break, right-click to place.
- Mobile: use the on-screen joystick to move, drag the view to look, and use **Jump**, **Break**, and **Place**.
- In water, hold `Space` to rise or `Shift` to dive; touch players can use the **Rise** and **Dive** buttons that appear in the water.
- Select a block from the hotbar or use number keys `1`–`9`. `Q` breaks and `E` places.
- Press `I` or tap **Bag** to open inventory. Mining collects blocks, dropped items can be picked up by walking close, and inventory rows let you drop items.
- Drag an inventory item onto a hotbar slot to assign it. On touch screens, tap the inventory item, then tap a hotbar slot.
- Craft planks from logs, glass from sand and stone, and campfires from logs and stone. Crafted/placeable blocks appear in the hotbar with their inventory counts.
- Defeat monsters for 50 XP and 25 coins. Open **World settings → Village market** near the spawn village to browse 1,000 procedural models across furniture, plants, animals, monsters, dragons, armor, weapons, tools, crystals, and decor. Buy or add a model, assign it from your inventory to the hotbar, and place it to decorate your home.
- Edit your displayed player name in the top bar.

The shared starter world is generated from a random 32-bit seed shown in the top bar. The seed deterministically generates terrain, forested foothills, mountain ranges, and a flat spawn village as players explore; chunks are generated around each player and unloaded behind them. Set `WORLD_SEED` to a number from `0` to `4294967295` when starting the server to generate the same terrain again. Mining works underground down to the unbreakable bedrock layer, with gravity and landing on exposed blocks. The world includes a small house, buildable blocks, inventory, crafting, dropped items, three server-simulated wandering bots, and a generated creature catalogue with 256 species variants each for the village, coast, ocean, forest, and highlands (1,280 variants total). A small habitat-specific selection roams each region at once; names, animal model forms, colors, and sizes vary by world seed. Players can fight monsters, earn XP and coins, and spend coins on placeable procedural models at the village market. World edits and player inventory/progression are included in world saves and autosaves; without saving, data is held in server memory. Browser profiles are not authenticated accounts.

## Minecraft mod compatibility

Minecraft Java mods built for Forge or Fabric cannot be loaded directly by this Node.js/browser game: they target Minecraft's Java runtime and mod APIs, not this game's WebSocket protocol or Three.js client. Bedrock add-ons have a separate format and runtime too. A feature can be recreated or ported as original game code, and individual mod assets/code can only be reused if their license explicitly allows it and its terms are followed. Do not redistribute Minecraft's proprietary assets or code. A future Voxland plugin API could let original community extensions register blocks, items, recipes, and bots.

## Asset and code credits

Block texture packs are bundled in `src/assets/blocks/own/`, `src/assets/blocks/pixel-perfection/`, and `src/assets/blocks/vibes/` so the game client does not depend on the Voxelize submodule at runtime or build time. Pack folders are kept separate because their textures have overlapping filenames. The game currently uses textures from `own/`.

Voxelize's README attributes Pixel Perfection by XSSheep, modified, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); redistributed adaptations of those textures must follow its attribution and share-alike terms. The repository did not provide separate license metadata for the `own` and `vibes` packs, so verify their provenance and usage rights before redistributing them outside this project.

The Voxland client/server code and generated campfire texture are original and separate from the Voxelize runtime. Check individual licenses before reusing other third-party assets or code.

Animal models are from Quaternius' [Ultimate Animated Animal Pack](https://quaternius.com/packs/ultimateanimatedanimals.html), released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The bundled cow, alpaca, fox, and wolf models include idle and walking animations.
# JesseCraft
